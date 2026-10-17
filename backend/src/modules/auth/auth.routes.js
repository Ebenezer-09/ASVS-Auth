const { Router } = require("express");
const { ipKeyGenerator, rateLimit } = require("express-rate-limit");
const { createHmac } = require("node:crypto");
const { jwtVerify } = require("jose");
const { DatabaseRateLimitStore } = require("../../database/rate-limit-store");
const { createAuthService } = require("./auth.service");

const MAX_ADAPTIVE_LOGIN_DELAY_MS = 2_000;
const ADAPTIVE_LOGIN_DELAY_PER_FAILURE_MS = 250;

function readCookie(request, name) {
  const cookies = request.headers.cookie?.split(";") || [];
  const entry = cookies.map((cookie) => cookie.trim()).find((cookie) => cookie.startsWith(`${name}=`));
  return entry ? entry.slice(name.length + 1) : null;
}

function createAuthRouter({
  database,
  jwtSecret,
  isProduction,
  rateLimitMax = 10,
  rateLimitWindowMs = 15 * 60 * 1000,
  totpEncryptionKey,
  mailer,
  frontendUrl,
  requireMfa,
  breachChecker,
}) {
  const router = Router();
  const auth = createAuthService({
    database,
    jwtSecret,
    totpEncryptionKey,
    mailer,
    frontendUrl,
    requireMfa,
    breachChecker,
  });
  const signingKey = Buffer.from(jwtSecret, "utf8");
  const authRateLimit = rateLimit({
    windowMs: rateLimitWindowMs,
    limit: rateLimitMax,
    store: new DatabaseRateLimitStore(database),
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: "Trop de tentatives. Réessayez plus tard." },
  });
  const loginAttemptRateLimit = rateLimit({
    windowMs: rateLimitWindowMs,
    limit: Math.min(rateLimitMax, 5),
    store: new DatabaseRateLimitStore(database),
    keyGenerator: (request) => {
      const email = typeof request.body?.email === "string"
        ? request.body.email.trim().toLowerCase()
        : "";
      return createHmac("sha256", signingKey)
        .update(`${ipKeyGenerator(request.ip)}\0${email}`)
        .digest("hex");
    },
    skipSuccessfulRequests: true,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: "Trop de tentatives pour ces identifiants. Réessayez plus tard." },
  });
  const failedLoginIpRateLimit = rateLimit({
    windowMs: rateLimitWindowMs,
    limit: rateLimitMax,
    store: new DatabaseRateLimitStore(database),
    keyGenerator: (request) =>
      createHmac("sha256", signingKey)
        .update(`failed-login-ip\0${ipKeyGenerator(request.ip)}`)
        .digest("hex"),
    skipSuccessfulRequests: true,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: "Trop de tentatives depuis cette adresse. Réessayez plus tard." },
  });
  const mfaAttemptRateLimit = rateLimit({
    windowMs: rateLimitWindowMs,
    limit: Math.min(rateLimitMax, 5),
    store: new DatabaseRateLimitStore(database),
    keyGenerator: (request) => {
      const challenge = readCookie(request, "mfa_pending") || "";
      return createHmac("sha256", signingKey).update(challenge).digest("hex");
    },
    skipSuccessfulRequests: true,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: "Trop de codes incorrects. Recommencez la connexion plus tard." },
  });
  const cookieOptions = {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    path: "/",
  };
  let loginFailureOperations = 0;

  function getLoginFailureKeys(request) {
    const email = typeof request.body?.email === "string"
      ? request.body.email.trim().toLowerCase()
      : "";
    const ip = ipKeyGenerator(request.ip);
    return {
      account: createHmac("sha256", signingKey).update(`account\0${email}`).digest("hex"),
      ip: createHmac("sha256", signingKey).update(`ip\0${ip}`).digest("hex"),
    };
  }

  async function applyAdaptiveLoginDelay(keys) {
    const result = await database.query(
      "SELECT key, failures, updated_at FROM auth_login_failures WHERE key IN ($1, $2)",
      [keys.account, keys.ip],
    );
    const now = Date.now();
    const recentFailures = result.rows
      .filter((row) => now - new Date(row.updated_at).getTime() < rateLimitWindowMs)
      .reduce((maximum, row) => Math.max(maximum, Number(row.failures)), 0);
    const delay = Math.min(
      recentFailures * ADAPTIVE_LOGIN_DELAY_PER_FAILURE_MS,
      MAX_ADAPTIVE_LOGIN_DELAY_MS,
    );
    if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
  }

  async function recordLoginFailure(keys) {
    const now = new Date();
    const cutoff = new Date(now.getTime() - rateLimitWindowMs);
    loginFailureOperations += 1;
    if (loginFailureOperations % 500 === 0) {
      await database.query("DELETE FROM auth_login_failures WHERE updated_at <= $1", [
        cutoff.toISOString(),
      ]);
    }
    for (const key of [keys.account, keys.ip]) {
      await database.query(
        `INSERT INTO auth_login_failures (key, failures, updated_at)
         VALUES ($1, 1, $2)
         ON CONFLICT (key) DO UPDATE SET
           failures = CASE
             WHEN auth_login_failures.updated_at <= $3 THEN 1
             ELSE auth_login_failures.failures + 1
           END,
           updated_at = EXCLUDED.updated_at`,
        [key, now.toISOString(), cutoff.toISOString()],
      );
    }
  }

  async function clearAccountLoginFailures(key) {
    await database.query("DELETE FROM auth_login_failures WHERE key = $1", [key]);
  }

  async function requireSession(request, response, next) {
    const token = readCookie(request, "auth_token");
    if (!token) {
      response.status(401).json({ error: "Authentification requise." });
      return;
    }
    try {
      const { payload } = await jwtVerify(token, signingKey);
      if (typeof payload.sub !== "string" || typeof payload.jti !== "string" || payload.purpose) {
        response.status(401).json({ error: "Authentification requise." });
        return;
      }
      const user = await auth.authenticateSession(payload.jti, payload.sub);
      if (!user) {
        response.status(401).json({ error: "Authentification requise." });
        return;
      }
      request.auth = { user, sessionId: payload.jti };
      next();
    } catch (error) {
      if (error.code === "ERR_JWT_EXPIRED" || error.code === "ERR_JWS_INVALID" || error.code === "ERR_JWT_INVALID") {
        response.status(401).json({ error: "Authentification requise." });
        return;
      }
      next(error);
    }
  }

  router.post("/register", authRateLimit, async (request, response) => {
    const result = await auth.register(request.body || {});
    response.status(result.status).json(result.body);
  });

  router.post(
    "/login",
    authRateLimit,
    failedLoginIpRateLimit,
    loginAttemptRateLimit,
    async (request, response) => {
      const failureKeys = getLoginFailureKeys(request);
      await applyAdaptiveLoginDelay(failureKeys);
      const result = await auth.login(request.body || {});
      if (result.status === 401) {
        await recordLoginFailure(failureKeys);
      } else {
        await clearAccountLoginFailures(failureKeys.account);
      }
      if (result.token) {
        response.cookie("auth_token", result.token, {
          ...cookieOptions,
          maxAge: 60 * 60 * 1000,
        });
      }
      if (result.mfaToken) {
        response.cookie("mfa_pending", result.mfaToken, {
          ...cookieOptions,
          maxAge: 5 * 60 * 1000,
        });
      }
      response.status(result.status).json(result.body);
    },
  );

  router.post("/mfa/verify", authRateLimit, mfaAttemptRateLimit, async (request, response) => {
    const token = readCookie(request, "mfa_pending");
    if (!token) {
      response.status(401).json({ error: "Authentification MFA invalide." });
      return;
    }
    try {
      const { payload } = await jwtVerify(token, signingKey);
      if (payload.purpose !== "mfa" || typeof payload.sub !== "string") {
        response.status(401).json({ error: "Authentification MFA invalide." });
        return;
      }
      const sessionToken = await auth.verifyMfa(payload.sub, request.body?.code);
      if (!sessionToken) {
        response.status(401).json({ error: "Code MFA invalide." });
        return;
      }
      response.clearCookie("mfa_pending", cookieOptions);
      response.cookie("auth_token", sessionToken, { ...cookieOptions, maxAge: 60 * 60 * 1000 });
      response.json({ message: "Connexion réussie." });
    } catch (error) {
      if (error.code === "ERR_JWT_EXPIRED" || error.code === "ERR_JWS_INVALID" || error.code === "ERR_JWT_INVALID") {
        response.status(401).json({ error: "Authentification MFA invalide." });
        return;
      }
      throw error;
    }
  });

  router.post("/mfa/enroll/setup", authRateLimit, async (request, response) => {
    const token = readCookie(request, "mfa_pending");
    if (!token) {
      response.status(401).json({ error: "Authentification MFA invalide." });
      return;
    }
    try {
      const { payload } = await jwtVerify(token, signingKey);
      if (payload.purpose !== "mfa-enroll" || typeof payload.sub !== "string") {
        response.status(401).json({ error: "Authentification MFA invalide." });
        return;
      }
      const user = await auth.findUserById(payload.sub);
      if (!user || user.totp_enabled) {
        response.status(401).json({ error: "Authentification MFA invalide." });
        return;
      }
      response.json(await auth.beginTotpSetup(user));
    } catch (error) {
      if (error.code === "ERR_JWT_EXPIRED" || error.code === "ERR_JWS_INVALID" || error.code === "ERR_JWT_INVALID") {
        response.status(401).json({ error: "Authentification MFA invalide." });
        return;
      }
      throw error;
    }
  });

  router.post("/mfa/enroll/verify", authRateLimit, mfaAttemptRateLimit, async (request, response) => {
    const token = readCookie(request, "mfa_pending");
    if (!token) {
      response.status(401).json({ error: "Authentification MFA invalide." });
      return;
    }
    try {
      const { payload } = await jwtVerify(token, signingKey);
      if (payload.purpose !== "mfa-enroll" || typeof payload.sub !== "string") {
        response.status(401).json({ error: "Authentification MFA invalide." });
        return;
      }
      const user = await auth.findUserById(payload.sub);
      if (!user) {
        response.status(401).json({ error: "Authentification MFA invalide." });
        return;
      }
      const result = await auth.enableTotp(user, request.body?.code, true);
      if (result.token) {
        response.clearCookie("mfa_pending", cookieOptions);
        response.cookie("auth_token", result.token, { ...cookieOptions, maxAge: 60 * 60 * 1000 });
      }
      response.status(result.status).json(result.body);
    } catch (error) {
      if (error.code === "ERR_JWT_EXPIRED" || error.code === "ERR_JWS_INVALID" || error.code === "ERR_JWT_INVALID") {
        response.status(401).json({ error: "Authentification MFA invalide." });
        return;
      }
      throw error;
    }
  });

  router.post("/password/reset-request", authRateLimit, async (request, response) => {
    const result = await auth.requestPasswordReset(request.body?.email);
    response.status(result.status).json(result.body);
  });

  router.post("/password/reset", authRateLimit, async (request, response) => {
    const result = await auth.resetPassword(request.body || {});
    response.status(result.status).json(result.body);
  });

  router.get("/me", requireSession, (request, response) => {
    response.json({
      email: request.auth.user.email,
      mfaEnabled: Boolean(request.auth.user.totp_enabled),
    });
  });

  router.post("/logout", requireSession, async (request, response) => {
    await auth.logout(request.auth.sessionId);
    response.clearCookie("auth_token", cookieOptions);
    response.clearCookie("mfa_pending", cookieOptions);
    response.sendStatus(204);
  });

  router.post("/password/change", requireSession, async (request, response) => {
    const result = await auth.changePassword(request.auth.user, request.body || {});
    if (result.status === 200) {
      response.clearCookie("auth_token", cookieOptions);
      response.clearCookie("mfa_pending", cookieOptions);
    }
    response.status(result.status).json(result.body);
  });

  router.post("/mfa/totp/setup", requireSession, async (request, response) => {
    const result = await auth.beginTotpSetup(request.auth.user);
    if (!result) {
      response.status(409).json({ error: "Un facteur MFA est déjà actif." });
      return;
    }
    response.json(result);
  });

  router.post("/mfa/totp/enable", requireSession, async (request, response) => {
    const result = await auth.enableTotp(request.auth.user, request.body?.code);
    response.status(result.status).json(result.body);
  });

  router.post("/mfa/totp/disable", requireSession, async (request, response) => {
    const result = await auth.disableTotp(request.auth.user, request.body || {});
    if (result.status === 200) {
      response.clearCookie("auth_token", cookieOptions);
      response.clearCookie("mfa_pending", cookieOptions);
    }
    response.status(result.status).json(result.body);
  });

  return router;
}

module.exports = { createAuthRouter };
