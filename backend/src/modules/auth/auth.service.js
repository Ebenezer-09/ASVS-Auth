const argon2 = require("argon2");
const { createHash, createHmac, randomBytes, randomUUID } = require("node:crypto");
const { SignJWT } = require("jose");
const { createUserRepository } = require("./user.repository");
const { validateRegistrationPassword } = require("./criteria/password");
const {
  decryptSecret,
  encryptSecret,
  generateTotpSecret,
  verifyTotp,
} = require("./totp");

const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
};
const INVALID_CREDENTIALS = {
  status: 401,
  body: { error: "Adresse e-mail ou mot de passe invalide." },
};
const REGISTRATION_MESSAGE =
  "Si l’adresse peut être utilisée, le compte est prêt. Vous pouvez vous connecter.";

function isValidEmail(email) {
  return (
    typeof email === "string" &&
    email.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  );
}

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

function hashEmail(email, key) {
  return createHmac("sha256", key).update(email).digest("hex");
}

async function isCompromisedPassword(password) {
  const digest = createHash("sha1").update(password, "utf8").digest("hex").toUpperCase();
  const prefix = digest.slice(0, 5);
  const suffix = digest.slice(5);
  let response;
  try {
    response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { "Add-Padding": "true", "User-Agent": "ASVS-Auth-Password-Check" },
      signal: AbortSignal.timeout(5000),
    });
  } catch (cause) {
    throw Object.assign(
      new Error("Le service de vérification des mots de passe compromis est indisponible.", { cause }),
      { code: "PASSWORD_CHECK_UNAVAILABLE" },
    );
  }
  if (!response.ok) {
    throw Object.assign(
      new Error(`La vérification des mots de passe compromis a échoué (${response.status}).`),
      { code: "PASSWORD_CHECK_UNAVAILABLE" },
    );
  }
  const hashes = await response.text();
  return hashes.split(/\r?\n/).some((line) => line.split(":")[0] === suffix);
}

function createAuthService({
  database,
  jwtSecret,
  totpEncryptionKey,
  mailer,
  frontendUrl,
  requireMfa,
  breachChecker = isCompromisedPassword,
}) {
  const users = createUserRepository(database);
  const signingKey = Buffer.from(jwtSecret, "utf8");
  let dummyPasswordHash;
  let failedLoginOperations = 0;

  async function getDummyPasswordHash() {
    dummyPasswordHash ??= await argon2.hash(
      "non-user-authentication-placeholder",
      ARGON2_OPTIONS,
    );
    return dummyPasswordHash;
  }

  async function sendSecurityNotice(email, action) {
    try {
      await mailer.sendSecurityNotice(email, action);
    } catch (error) {
      console.error(`Impossible d’envoyer l’alerte de sécurité (${action}) :`, error);
    }
  }

  async function recordFailedLogin(email, user) {
    const emailHash = hashEmail(email, signingKey);
    const now = new Date();
    const cooldown = new Date(now.getTime() - 30 * 60 * 1000);
    failedLoginOperations += 1;
    if (failedLoginOperations % 500 === 0) {
      const expired = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      await database.query("DELETE FROM auth_alert_state WHERE updated_at <= $1", [
        expired.toISOString(),
      ]);
    }
    const state = await database.query(
      `INSERT INTO auth_alert_state (email_hash, user_id, failures, updated_at)
       VALUES ($1, $2, 1, $3)
       ON CONFLICT (email_hash) DO UPDATE SET
         user_id = EXCLUDED.user_id,
         failures = auth_alert_state.failures + 1,
         updated_at = EXCLUDED.updated_at
       RETURNING failures`,
      [emailHash, user?.id ?? null, now.toISOString()],
    );
    const claimed = await database.query(
      `UPDATE auth_alert_state SET last_notified_at = $1
       WHERE email_hash = $2 AND user_id IS NOT NULL AND failures >= 5
         AND (last_notified_at IS NULL OR last_notified_at <= $3)
       RETURNING email_hash`,
      [now.toISOString(), emailHash, cooldown.toISOString()],
    );
    if (user && Number(state.rows[0].failures) >= 5 && claimed.rowCount === 1) {
      void sendSecurityNotice(user.email, "plusieurs tentatives de connexion échouées");
    }
  }

  async function recordSuccessfulLogin(user) {
    const emailHash = hashEmail(user.email, signingKey);
    const now = new Date();
    const cooldown = new Date(now.getTime() - 30 * 60 * 1000);
    const state = await database.query(
      "SELECT failures FROM auth_alert_state WHERE email_hash = $1",
      [emailHash],
    );
    if (Number(state.rows[0]?.failures || 0) >= 5) {
      const claimed = await database.query(
        `UPDATE auth_alert_state SET failures = 0, last_notified_at = $1
         WHERE email_hash = $2 AND (last_notified_at IS NULL OR last_notified_at <= $3)
         RETURNING email_hash`,
        [now.toISOString(), emailHash, cooldown.toISOString()],
      );
      if (claimed.rowCount === 1) {
        await sendSecurityNotice(user.email, "connexion réussie après plusieurs tentatives échouées");
      }
    } else {
      await database.query(
        "UPDATE auth_alert_state SET failures = 0 WHERE email_hash = $1",
        [emailHash],
      );
    }
  }

  async function validatePassword(password) {
    const errors = validateRegistrationPassword(password);
    if (errors.length > 0) return errors;
    if (await breachChecker(password)) {
      return [{
        criterion: "V6.2.12",
        message: "Ce mot de passe apparaît dans une fuite connue. Choisissez-en un autre.",
      }];
    }
    return [];
  }

  async function issueSession(user) {
    const sessionId = randomUUID();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    await database.query(
      "INSERT INTO auth_sessions (id, user_id, expires_at) VALUES ($1, $2, $3)",
      [sessionId, user.id, expiresAt],
    );
    const token = await new SignJWT({ email: user.email, jti: sessionId })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(String(user.id))
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(signingKey);
    return token;
  }

  async function useRecoveryCode(userId, code) {
    if (typeof code !== "string" || code.length > 64) return false;
    const result = await database.query(
      "SELECT id, code_hash FROM recovery_codes WHERE user_id = $1 AND used_at IS NULL",
      [userId],
    );
    for (const recoveryCode of result.rows) {
      if (await argon2.verify(recoveryCode.code_hash, code)) {
        const used = await database.query(
          "UPDATE recovery_codes SET used_at = $1 WHERE id = $2 AND used_at IS NULL",
          [new Date().toISOString(), recoveryCode.id],
        );
        return used.rowCount === 1;
      }
    }
    return false;
  }

  async function verifyFactorCode(user, code) {
    let verifiedStep = null;
    const secret = decryptSecret(user.totp_secret, totpEncryptionKey);
    if (/^\d{6}$/.test(code)) {
      verifiedStep = verifyTotp(secret, code, Date.now(), user.last_totp_step);
      if (verifiedStep !== null) {
        const updated = await database.query(
          "UPDATE users SET last_totp_step = $1 WHERE id = $2 AND (last_totp_step IS NULL OR last_totp_step < $1)",
          [verifiedStep, user.id],
        );
        if (updated.rowCount !== 1) return null;
      }
    }
    return verifiedStep !== null || (await useRecoveryCode(user.id, code));
  }

  async function completeMfa(user, code) {
    if (!(await verifyFactorCode(user, code))) return null;
    const token = await issueSession(user);
    await recordSuccessfulLogin(user);
    return token;
  }

  return {
    async register({ email, password, confirmPassword }) {
      if (!isValidEmail(email) || typeof password !== "string") {
        return { status: 400, body: { error: "Adresse e-mail ou mot de passe invalide." } };
      }
      if (confirmPassword !== password) {
        return { status: 400, body: { error: "Les mots de passe ne correspondent pas." } };
      }
      const passwordErrors = await validatePassword(password);
      if (passwordErrors.length > 0) return { status: 400, body: { errors: passwordErrors } };

      const passwordHash = await argon2.hash(password, ARGON2_OPTIONS);
      try {
        await users.create(normalizeEmail(email), passwordHash);
        await database.query("DELETE FROM auth_alert_state WHERE email_hash = $1", [
          hashEmail(normalizeEmail(email), signingKey),
        ]);
      } catch (error) {
        if (error.code === "SQLITE_CONSTRAINT_UNIQUE" || error.code === "23505") {
          return { status: 202, body: { message: REGISTRATION_MESSAGE } };
        }
        throw error;
      }
      return { status: 202, body: { message: REGISTRATION_MESSAGE } };
    },

    async login({ email, password }) {
      if (!isValidEmail(email) || typeof password !== "string" || Buffer.byteLength(password, "utf8") > 1024) {
        return { ...INVALID_CREDENTIALS };
      }
      const user = await users.findByEmail(normalizeEmail(email));
      const passwordHash = user?.password_hash || (await getDummyPasswordHash());
      let passwordMatches = false;
      try {
        passwordMatches = await argon2.verify(passwordHash, password);
      } catch (error) {
        if (error instanceof TypeError) passwordMatches = false;
        else throw error;
      }
      if (!user || !passwordMatches) {
        await recordFailedLogin(normalizeEmail(email), user);
        return { ...INVALID_CREDENTIALS };
      }
      if (!user.totp_enabled && requireMfa) {
        const mfaToken = await new SignJWT({ purpose: "mfa-enroll" })
          .setProtectedHeader({ alg: "HS256" })
          .setSubject(String(user.id))
          .setIssuedAt()
          .setExpirationTime("10m")
          .sign(signingKey);
        return { status: 200, body: { mfaEnrollmentRequired: true }, mfaToken };
      }
      if (user.totp_enabled) {
        const mfaToken = await new SignJWT({ purpose: "mfa" })
          .setProtectedHeader({ alg: "HS256" })
          .setSubject(String(user.id))
          .setIssuedAt()
          .setExpirationTime("5m")
          .sign(signingKey);
        return { status: 200, body: { mfaRequired: true }, mfaToken };
      }
      await recordSuccessfulLogin(user);
      return {
        status: 200,
        body: { message: "Connexion réussie." },
        token: await issueSession(user),
      };
    },

    async verifyMfa(userId, code) {
      const user = await users.findById(userId);
      if (!user?.totp_enabled || !user.totp_secret) return null;
      const token = await completeMfa(user, code);
      if (!token) await recordFailedLogin(normalizeEmail(user.email), user);
      return token;
    },

    async findUserById(userId) {
      return users.findById(userId);
    },

    async authenticateSession(sessionId, userId) {
      const result = await database.query(
        "SELECT user_id FROM auth_sessions WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL AND expires_at > $3",
        [sessionId, userId, new Date().toISOString()],
      );
      return result.rows.length === 1 ? users.findById(userId) : null;
    },

    async logout(sessionId) {
      await database.query(
        "UPDATE auth_sessions SET revoked_at = $1 WHERE id = $2 AND revoked_at IS NULL",
        [new Date().toISOString(), sessionId],
      );
    },

    async changePassword(user, { currentPassword, newPassword, confirmPassword }) {
      if (
        typeof currentPassword !== "string" ||
        typeof newPassword !== "string" ||
        newPassword !== confirmPassword
      ) {
        return { status: 400, body: { error: "Les informations de mot de passe sont invalides." } };
      }
      if (!(await argon2.verify(user.password_hash, currentPassword))) {
        return { status: 400, body: { error: "Le mot de passe actuel est incorrect." } };
      }
      const errors = await validatePassword(newPassword);
      if (errors.length > 0) return { status: 400, body: { errors } };
      await database.query(
        "UPDATE users SET password_hash = $1 WHERE id = $2",
        [await argon2.hash(newPassword, ARGON2_OPTIONS), user.id],
      );
      await database.query("DELETE FROM password_reset_tokens WHERE user_id = $1", [user.id]);
      await database.query(
        "UPDATE auth_sessions SET revoked_at = $1 WHERE user_id = $2 AND revoked_at IS NULL",
        [new Date().toISOString(), user.id],
      );
      await sendSecurityNotice(user.email, "changement de mot de passe");
      return { status: 200, body: { message: "Mot de passe modifié. Veuillez vous reconnecter." } };
    },

    async requestPasswordReset(email) {
      if (!isValidEmail(email)) return { status: 202, body: { message: "Si le compte existe, un lien de réinitialisation sera envoyé." } };
      const user = await users.findByEmail(normalizeEmail(email));
      if (user) {
        const token = randomBytes(32).toString("base64url");
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
        await database.query("DELETE FROM password_reset_tokens WHERE user_id = $1", [user.id]);
        await database.query(
          "INSERT INTO password_reset_tokens (token_hash, user_id, expires_at) VALUES ($1, $2, $3)",
          [hashToken(token), user.id, expiresAt],
        );
        try {
          await mailer.sendPasswordReset(user.email, token);
        } catch (error) {
          await database.query(
            "DELETE FROM password_reset_tokens WHERE token_hash = $1",
            [hashToken(token)],
          );
          console.error("Échec de l’envoi du message de réinitialisation.", {
            code: error.code || "unknown",
          });
        }
      }
      return { status: 202, body: { message: "Si le compte existe, un lien de réinitialisation sera envoyé." } };
    },

    async resetPassword({ token, password, confirmPassword }) {
      if (
        typeof token !== "string" ||
        token.length > 128 ||
        typeof password !== "string" ||
        password !== confirmPassword
      ) {
        return { status: 400, body: { error: "Le lien ou les informations de réinitialisation sont invalides." } };
      }
      const tokenHash = hashToken(token);
      const now = new Date().toISOString();
      const available = await database.query(
        "SELECT user_id FROM password_reset_tokens WHERE token_hash = $1 AND used_at IS NULL AND expires_at > $2",
        [tokenHash, now],
      );
      if (available.rowCount !== 1) {
        return { status: 400, body: { error: "Le lien ou les informations de réinitialisation sont invalides." } };
      }
      const errors = await validatePassword(password);
      if (errors.length > 0) return { status: 400, body: { errors } };
      const passwordHash = await argon2.hash(password, ARGON2_OPTIONS);
      const consumed = await database.query(
        "UPDATE password_reset_tokens SET used_at = $1 WHERE token_hash = $2 AND used_at IS NULL AND expires_at > $1 RETURNING user_id",
        [new Date().toISOString(), tokenHash],
      );
      if (consumed.rowCount !== 1) {
        return { status: 400, body: { error: "Le lien ou les informations de réinitialisation sont invalides." } };
      }
      const userId = consumed.rows[0].user_id;
      await database.query(
        "UPDATE users SET password_hash = $1 WHERE id = $2",
        [passwordHash, userId],
      );
      await database.query("DELETE FROM password_reset_tokens WHERE user_id = $1", [userId]);
      await database.query(
        "UPDATE auth_sessions SET revoked_at = $1 WHERE user_id = $2 AND revoked_at IS NULL",
        [new Date().toISOString(), userId],
      );
      const user = await users.findById(userId);
      await sendSecurityNotice(user.email, "réinitialisation du mot de passe");
      return { status: 200, body: { message: "Mot de passe réinitialisé. Vous pouvez vous connecter." } };
    },

    async beginTotpSetup(user) {
      if (user.totp_enabled) return null;
      const secret = generateTotpSecret();
      const encrypted = encryptSecret(secret, totpEncryptionKey);
      await database.query("DELETE FROM recovery_codes WHERE user_id = $1", [user.id]);
      await database.query(
        "UPDATE users SET totp_secret = $1, totp_enabled = FALSE, last_totp_step = NULL WHERE id = $2",
        [encrypted, user.id],
      );
      const label = encodeURIComponent(user.email);
      const issuer = encodeURIComponent("ASVS Auth");
      return {
        secret,
        otpauthUrl: `otpauth://totp/${issuer}:${label}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`,
      };
    },

    async enableTotp(user, code, issueSessionAfterEnable = false) {
      const current = await users.findById(user.id);
      if (!current?.totp_secret || current.totp_enabled) {
        return { status: 400, body: { error: "La configuration MFA n’est pas disponible." } };
      }
      const secret = decryptSecret(current.totp_secret, totpEncryptionKey);
      const step = verifyTotp(secret, code);
      if (step === null) return { status: 400, body: { error: "Code MFA invalide." } };
      const enabled = await database.query(
        "UPDATE users SET totp_enabled = TRUE, last_totp_step = $1 WHERE id = $2 AND totp_enabled = FALSE",
        [step, user.id],
      );
      if (enabled.rowCount !== 1) {
        return { status: 400, body: { error: "La configuration MFA n’est pas disponible." } };
      }
      const codes = Array.from({ length: 10 }, () => randomBytes(9).toString("base64url"));
      for (const recoveryCode of codes) {
        await database.query(
          "INSERT INTO recovery_codes (user_id, code_hash) VALUES ($1, $2)",
          [user.id, await argon2.hash(recoveryCode, ARGON2_OPTIONS)],
        );
      }
      await sendSecurityNotice(user.email, "activation de l’authentification MFA");
      const result = {
        status: 200,
        body: { message: "MFA activée.", recoveryCodes: codes },
      };
      if (issueSessionAfterEnable) {
        result.token = await issueSession(user);
        await recordSuccessfulLogin(user);
      }
      return result;
    },

    async disableTotp(user, { password, code }) {
      if (typeof password !== "string" || !(await argon2.verify(user.password_hash, password))) {
        return { status: 400, body: { error: "Mot de passe ou code MFA invalide." } };
      }
      if (!(await verifyFactorCode(user, code))) {
        return { status: 400, body: { error: "Mot de passe ou code MFA invalide." } };
      }
      await database.query("DELETE FROM recovery_codes WHERE user_id = $1", [user.id]);
      await database.query(
        "UPDATE users SET totp_secret = NULL, totp_enabled = FALSE, last_totp_step = NULL WHERE id = $1",
        [user.id],
      );
      await database.query(
        "UPDATE auth_sessions SET revoked_at = $1 WHERE user_id = $2 AND revoked_at IS NULL",
        [new Date().toISOString(), user.id],
      );
      await sendSecurityNotice(user.email, "désactivation de l’authentification MFA");
      return { status: 200, body: { message: "MFA désactivée. Veuillez vous reconnecter." } };
    },
  };
}

module.exports = { createAuthService, ARGON2_OPTIONS, isCompromisedPassword };
