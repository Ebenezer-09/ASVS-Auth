process.env.NODE_ENV = "test";

const assert = require("node:assert/strict");
const { once } = require("node:events");
const { after, before, test } = require("node:test");
const { newDb } = require("pg-mem");
const { createApp } = require("../src/app");
const { createDatabase, SCHEMA } = require("../src/database/connection");

const JWT_SECRET = "test-secret-with-at-least-32-bytes-long";
const runningServers = [];
const deliveredMessages = [];

async function startTestServer(options = {}) {
  const postgres = newDb();
  const { Pool } = postgres.adapters.createPg();
  const pool = new Pool();
  await pool.query(SCHEMA);
  const database = {
    ready: Promise.resolve(),
    query: (text, values) => pool.query(text, values),
    close: () => pool.end(),
  };
  const mailer = {
    async sendPasswordReset(email, token) {
      deliveredMessages.push({ type: "reset", email, token });
    },
    async sendSecurityNotice(email, action) {
      deliveredMessages.push({ type: "notice", email, action });
    },
  };
  const app = createApp({
    database,
    frontendOrigins: ["http://localhost:3000"],
    jwtSecret: JWT_SECRET,
    totpEncryptionKey: Buffer.alloc(32, 7),
    breachChecker: async () => false,
    requireMfa: false,
    mailer,
    rateLimitMax: 20,
    ...options,
  });
  const server = app.listen(0);
  await once(server, "listening");
  runningServers.push({ app, server });
  return {
    app,
    baseUrl: `http://127.0.0.1:${server.address().port}`,
  };
}

before(() => {
  process.env.NODE_ENV = "test";
});

after(async () => {
  await Promise.all(
    runningServers.map(
      ({ app, server }) =>
        new Promise((resolve, reject) => {
          server.close(async (error) => {
            try {
              await app.locals.closeDatabase();
            } catch (closeError) {
              reject(closeError);
              return;
            }
            if (error) reject(error);
            else resolve();
          });
        }),
    ),
  );
});

test("health route reports that the API is ready", async () => {
  const { baseUrl } = await startTestServer();
  const response = await fetch(`${baseUrl}/api/health`);

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: "ok" });
});

test("database configuration requires Supabase PostgreSQL", () => {
  assert.throws(
    () => createDatabase({ databaseUrl: "" }),
    /SUPABASE_DB_URL est obligatoire/,
  );
});

test("TOTP follows RFC 6238 and rejects a reused time step", () => {
  const { totpAt, verifyTotp } = require("../src/modules/auth/totp");
  const secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
  assert.equal(totpAt(secret, 1), "287082");
  assert.equal(verifyTotp(secret, "287082", 59_000), 1);
  assert.equal(verifyTotp(secret, "287082", 59_000, 1), null);
});

test("registration enforces password policy and hides account existence", async () => {
  const { app, baseUrl } = await startTestServer();
  const tooShort = await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: "test@example.com",
      password: "short",
      confirmPassword: "short",
    }),
  });
  assert.equal(tooShort.status, 400);
  assert.equal((await tooShort.json()).errors[0].criterion, "V6.2.1");

  const longPassword = "é".repeat(64);
  const longPasswordRegistration = await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: "long-password@example.com",
      password: longPassword,
      confirmPassword: longPassword,
    }),
  });
  assert.equal(longPasswordRegistration.status, 202);

  const oversizedPassword = "é".repeat(513);
  const oversizedRegistration = await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: "oversized@example.com",
      password: oversizedPassword,
      confirmPassword: oversizedPassword,
    }),
  });
  assert.equal(oversizedRegistration.status, 400);
  assert.ok((await oversizedRegistration.json()).errors.some(
    (error) => error.criterion === "V6.2.9",
  ));

  const payload = {
    email: "Test@Example.com",
    password: "a long phrase with spaces 123",
    confirmPassword: "a long phrase with spaces 123",
  };
  const firstRegistration = await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const duplicateRegistration = await fetch(
    `${baseUrl}/api/auth/register`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    },
  );

  assert.equal(firstRegistration.status, 202);
  assert.equal(duplicateRegistration.status, 202);
  assert.deepEqual(
    await firstRegistration.json(),
    await duplicateRegistration.json(),
  );

  const storedUsers = await app.locals.database.query(
    "SELECT email, password_hash FROM users WHERE email = $1",
    ["test@example.com"],
  );
  const storedUser = storedUsers.rows[0];
  assert.equal(storedUser.email, "test@example.com");
  assert.notEqual(storedUser.password_hash, payload.password);
  assert.match(storedUser.password_hash, /^\$argon2id\$/);
});

test("password policy rejects common and application-specific passwords", async () => {
  const { COMMON_PASSWORD_COUNT } = require("../src/modules/auth/criteria/common-passwords");
  assert.ok(COMMON_PASSWORD_COUNT >= 3000);
  const { baseUrl } = await startTestServer();
  const common = await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: "common@example.com",
      password: "password",
      confirmPassword: "password",
    }),
  });
  assert.equal(common.status, 400);
  assert.ok((await common.json()).errors.some((error) => error.criterion === "V6.2.4"));

  const contextual = await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: "context@example.com",
      password: "IRISI-portal-lowercase",
      confirmPassword: "IRISI-portal-lowercase",
    }),
  });
  assert.equal(contextual.status, 400);
  assert.ok((await contextual.json()).errors.some((error) => error.criterion === "V6.2.11"));
});

test("registration rejects passwords reported as compromised", async () => {
  const { baseUrl } = await startTestServer({ breachChecker: async () => true });
  const response = await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: "breached@example.com",
      password: "a private unique phrase",
      confirmPassword: "a private unique phrase",
    }),
  });
  assert.equal(response.status, 400);
  assert.ok((await response.json()).errors.some((error) => error.criterion === "V6.2.12"));
});

test("login verifies exact password and sets an HttpOnly cookie", async () => {
  const { baseUrl } = await startTestServer();
  const account = {
    email: "login@example.com",
    password: "a valid pass phrase",
    confirmPassword: "a valid pass phrase",
  };

  await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(account),
  });

  const invalidLogin = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: account.email,
      password: "A valid pass phrase",
    }),
  });
  assert.equal(invalidLogin.status, 401);

  const validLogin = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: "LOGIN@example.com",
      password: account.password,
    }),
  });
  assert.equal(validLogin.status, 200);
  assert.match(validLogin.headers.get("set-cookie"), /HttpOnly/i);
  assert.match(validLogin.headers.get("set-cookie"), /SameSite=Lax/i);
});

test("password changes require the current password and sessions can be logged out", async () => {
  const { baseUrl } = await startTestServer();
  const account = {
    email: "change@example.com",
    password: "old valid pass phrase",
    confirmPassword: "old valid pass phrase",
  };
  await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(account),
  });

  const login = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: account.email, password: account.password }),
  });
  const cookie = login.headers.get("set-cookie").split(";")[0];
  const unauthorizedChange = await fetch(`${baseUrl}/api/auth/password/change`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      currentPassword: "wrong",
      newPassword: "a new valid phrase",
      confirmPassword: "a new valid phrase",
    }),
  });
  assert.equal(unauthorizedChange.status, 401);

  const changed = await fetch(`${baseUrl}/api/auth/password/change`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: `${cookie}; mfa_pending=stale`,
    },
    body: JSON.stringify({
      currentPassword: account.password,
      newPassword: "a new valid phrase",
      confirmPassword: "a new valid phrase",
    }),
  });
  assert.equal(changed.status, 200);
  assert.match(changed.headers.get("set-cookie"), /auth_token=;/);
  assert.match(changed.headers.get("set-cookie"), /mfa_pending=;/);
  const oldSession = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { cookie },
  });
  assert.equal(oldSession.status, 401);

  const newLogin = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: account.email,
      password: "a new valid phrase",
    }),
  });
  const newCookie = newLogin.headers.get("set-cookie").split(";")[0];
  const logout = await fetch(`${baseUrl}/api/auth/logout`, {
    method: "POST",
    headers: { cookie: `${newCookie}; mfa_pending=stale` },
  });
  assert.equal(logout.status, 204);
  assert.match(logout.headers.get("set-cookie"), /mfa_pending=;/);
  const loggedOutSession = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { cookie: newCookie },
  });
  assert.equal(loggedOutSession.status, 401);
});

test("TOTP expires after 30 seconds and prevents code replay", () => {
  const { generateTotpSecret, totpAt, verifyTotp } = require("../src/modules/auth/totp");
  const secret = generateTotpSecret();
  const code = totpAt(secret, 1);
  assert.equal(verifyTotp(secret, code, 59_999), 1);
  assert.equal(verifyTotp(secret, code, 60_000), null);
  assert.equal(verifyTotp(secret, totpAt(secret, 2), 60_000), 2);
  assert.equal(verifyTotp(secret, totpAt(secret, 2), 60_000, 2), null);
});

test("password reset tokens are emailed and accepted only once", async () => {
  const { baseUrl } = await startTestServer();
  await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: "reset@example.com",
      password: "original valid phrase",
      confirmPassword: "original valid phrase",
    }),
  });
  const request = await fetch(`${baseUrl}/api/auth/password/reset-request`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "reset@example.com" }),
  });
  assert.equal(request.status, 202);
  const { token } = deliveredMessages.find((message) => message.type === "reset");
  const resetPayload = {
    token,
    password: "replacement valid phrase",
    confirmPassword: "replacement valid phrase",
  };
  const reset = await fetch(`${baseUrl}/api/auth/password/reset`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(resetPayload),
  });
  assert.equal(reset.status, 200);
  const replay = await fetch(`${baseUrl}/api/auth/password/reset`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(resetPayload),
  });
  assert.equal(replay.status, 400);
});

test("password reset rejects malformed credentials and removes undelivered tokens", async () => {
  const { app, baseUrl } = await startTestServer({
    mailer: {
      async sendPasswordReset() {
        throw Object.assign(new Error("SMTP unavailable"), { code: "ECONNECTION" });
      },
      async sendSecurityNotice() {},
    },
  });
  await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: "reset-failure@example.com",
      password: "original valid phrase",
      confirmPassword: "original valid phrase",
    }),
  });

  const malformed = await fetch(`${baseUrl}/api/auth/password/reset`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token: "invalid", confirmPassword: undefined }),
  });
  assert.equal(malformed.status, 400);

  const request = await fetch(`${baseUrl}/api/auth/password/reset-request`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "reset-failure@example.com" }),
  });
  assert.equal(request.status, 202);
  assert.match((await request.json()).message, /Si le compte existe/);
  const pendingTokens = await app.locals.database.query(
    "SELECT token_hash FROM password_reset_tokens",
  );
  assert.equal(pendingTokens.rowCount, 0);
});

test("TOTP is required after password login and cannot be replayed", async () => {
  const { baseUrl } = await startTestServer();
  const account = {
    email: "mfa@example.com",
    password: "valid passphrase for mfa",
    confirmPassword: "valid passphrase for mfa",
  };
  await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(account),
  });
  const login = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: account.email, password: account.password }),
  });
  const sessionCookie = login.headers.get("set-cookie").split(";")[0];
  const setup = await fetch(`${baseUrl}/api/auth/mfa/totp/setup`, {
    method: "POST",
    headers: { cookie: sessionCookie },
  });
  const { secret } = await setup.json();
  const { totpAt } = require("../src/modules/auth/totp");
  const currentStep = Math.floor(Date.now() / 30_000);
  const code = totpAt(secret, currentStep);
  const enabled = await fetch(`${baseUrl}/api/auth/mfa/totp/enable`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: sessionCookie },
    body: JSON.stringify({ code }),
  });
  assert.equal(enabled.status, 200);
  const { recoveryCodes } = await enabled.json();

  const mfaLogin = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: account.email, password: account.password }),
  });
  assert.deepEqual(await mfaLogin.json(), { mfaRequired: true });
  const pendingCookie = mfaLogin.headers.get("set-cookie").split(";")[0];
  const verified = await fetch(`${baseUrl}/api/auth/mfa/verify`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: pendingCookie },
    body: JSON.stringify({ code: recoveryCodes[0] }),
  });
  assert.equal(verified.status, 200);
  const verifiedCookie = verified.headers.get("set-cookie").match(/auth_token=[^;,]+/)[0];

  const disabled = await fetch(`${baseUrl}/api/auth/mfa/totp/disable`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: `${verifiedCookie}; mfa_pending=stale`,
    },
    body: JSON.stringify({
      password: account.password,
      code: recoveryCodes[1],
    }),
  });
  assert.equal(disabled.status, 200);
  assert.match(disabled.headers.get("set-cookie"), /auth_token=;/);
  assert.match(disabled.headers.get("set-cookie"), /mfa_pending=;/);
  const afterDisableLogin = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: account.email, password: account.password }),
  });
  assert.equal(afterDisableLogin.status, 200);
  assert.equal((await afterDisableLogin.json()).mfaRequired, undefined);

  const replay = await fetch(`${baseUrl}/api/auth/mfa/verify`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: pendingCookie },
    body: JSON.stringify({ code: recoveryCodes[0] }),
  });
  assert.equal(replay.status, 401);

  const nextChallenge = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: account.email, password: account.password }),
  });
  const nextChallengeCookie = nextChallenge.headers.get("set-cookie").split(";")[0];
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const invalidCode = await fetch(`${baseUrl}/api/auth/mfa/verify`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: nextChallengeCookie },
      body: JSON.stringify({ code: "" }),
    });
    assert.equal(invalidCode.status, 401);
  }
  const limitedCode = await fetch(`${baseUrl}/api/auth/mfa/verify`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: nextChallengeCookie },
    body: JSON.stringify({ code: "" }),
  });
  assert.equal(limitedCode.status, 429);
});

test("new sign-ins cannot access an authenticated route until TOTP is enrolled", async () => {
  const { baseUrl } = await startTestServer({ requireMfa: true });
  const account = {
    email: "mandatory-mfa@example.com",
    password: "long unique account phrase",
    confirmPassword: "long unique account phrase",
  };
  await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(account),
  });
  const login = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: account.email, password: account.password }),
  });
  assert.deepEqual(await login.json(), { mfaEnrollmentRequired: true });
  const pendingCookie = login.headers.get("set-cookie").split(";")[0];

  const setup = await fetch(`${baseUrl}/api/auth/mfa/enroll/setup`, {
    method: "POST",
    headers: { cookie: pendingCookie },
  });
  const { secret } = await setup.json();
  const { totpAt } = require("../src/modules/auth/totp");
  const code = totpAt(secret, Math.floor(Date.now() / 30_000));
  const enrolled = await fetch(`${baseUrl}/api/auth/mfa/enroll/verify`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: pendingCookie },
    body: JSON.stringify({ code }),
  });
  assert.equal(enrolled.status, 200);
  assert.match(enrolled.headers.get("set-cookie"), /auth_token=/);
});

test("authentication endpoints rate-limit repeated attempts", async () => {
  const { baseUrl } = await startTestServer({ rateLimitMax: 2 });

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "missing@example.com",
        password: "incorrect password",
      }),
    });
    assert.equal(response.status, 401);
  }

  const limitedResponse = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: "missing@example.com",
      password: "incorrect password",
    }),
  });
  assert.equal(limitedResponse.status, 429);
});

test("login rate-limits repeated failures for the same account and IP", async () => {
  const { baseUrl } = await startTestServer({ rateLimitMax: 20 });
  const credentials = {
    email: "repeated@example.com",
    password: "wrong password",
  };

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(credentials),
    });
    assert.equal(response.status, 401);
  }

  const limited = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(credentials),
  });
  assert.equal(limited.status, 429);

  const otherAccount = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...credentials, email: "other@example.com" }),
  });
  assert.equal(otherAccount.status, 401);
});

test("login adds a bounded adaptive delay without locking accounts", async () => {
  const { baseUrl } = await startTestServer({
    rateLimitMax: 20,
    trustProxyHops: 1,
  });
  const account = {
    email: "adaptive@example.com",
    password: "valid adaptive passphrase",
    confirmPassword: "valid adaptive passphrase",
  };
  await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(account),
  });
  const forwardedLogin = (ip, password) => fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": ip,
    },
    body: JSON.stringify({ email: account.email, password }),
  });

  const failed = await forwardedLogin("198.51.100.10", "incorrect passphrase");
  assert.equal(failed.status, 401);

  const startedAt = Date.now();
  const successful = await forwardedLogin("198.51.100.11", account.password);
  const elapsed = Date.now() - startedAt;
  assert.equal(successful.status, 200);
  assert.ok(elapsed >= 200, `expected adaptive delay, got ${elapsed}ms`);

  const afterSuccessStartedAt = Date.now();
  const nextSuccessful = await forwardedLogin("198.51.100.12", account.password);
  assert.equal(nextSuccessful.status, 200);
  assert.ok(Date.now() - afterSuccessStartedAt < 200);
});

test("API refuses requests from unknown browser origins", async () => {
  const { baseUrl } = await startTestServer();
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "https://unknown.example",
    },
    body: JSON.stringify({
      email: "test@example.com",
      password: "some password",
    }),
  });

  assert.equal(response.status, 403);
});
