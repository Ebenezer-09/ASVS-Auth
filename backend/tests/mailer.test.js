const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const path = require("node:path");
const { test } = require("node:test");
const { createMailer } = require("../src/modules/auth/mailer");

test("Resend API sends password reset email over HTTPS", async () => {
  let request;
  const mailer = createMailer(
    {},
    "https://frontend.example",
    { resendApiKey: "test-api-key", from: "Auth <auth@example.com>" },
    async (url, options) => {
      request = { url, options };
      return { ok: true };
    },
  );

  await mailer.sendPasswordReset("user@example.com", "reset-token");

  assert.equal(request.url, "https://api.resend.com/emails");
  assert.equal(request.options.method, "POST");
  assert.equal(request.options.headers.Authorization, "Bearer test-api-key");
  const payload = JSON.parse(request.options.body);
  assert.deepEqual(
    { from: payload.from, to: payload.to, subject: payload.subject },
    {
      from: "Auth <auth@example.com>",
      to: ["user@example.com"],
      subject: "Réinitialisation du mot de passe",
    },
  );
  assert.match(payload.text, /reset-password\?token=reset-token/);
  assert.equal(request.options.signal instanceof AbortSignal, true);
});

test("Resend API errors are surfaced to password reset handling", async () => {
  const mailer = createMailer(
    {},
    "https://frontend.example",
    { resendApiKey: "test-api-key", from: "Auth <auth@example.com>" },
    async () => ({
      ok: false,
      status: 403,
      text: async () =>
        JSON.stringify({
          name: "validation_error",
          message: "Verify the sender domain before sending.",
        }),
    }),
  );

  await assert.rejects(mailer.sendPasswordReset("user@example.com", "reset-token"), {
    code: "EMAIL_API_REJECTED",
    status: 403,
    providerCode: "validation_error",
    providerMessage: "Verify the sender domain before sending.",
  });
});

test("configured SMTP is preferred over Resend", async () => {
  let transportOptions;
  let sentMessage;
  const mailer = createMailer(
    {
      host: "smtp-relay.brevo.com",
      port: 587,
      secure: false,
      requireTLS: true,
      user: "brevo-user",
      password: "brevo-password",
      from: "Auth <auth@example.com>",
    },
    "https://frontend.example",
    { resendApiKey: "test-api-key", from: "Auth <auth@example.com>" },
    async () => {
      throw new Error("Resend must not be called when SMTP is configured");
    },
    (options) => {
      transportOptions = options;
      return {
        async sendMail(message) {
          sentMessage = message;
        },
      };
    },
  );

  await mailer.sendPasswordReset("user@example.com", "reset-token");

  assert.equal(transportOptions.host, "smtp-relay.brevo.com");
  assert.equal(transportOptions.port, 587);
  assert.equal(transportOptions.secure, false);
  assert.equal(transportOptions.requireTLS, true);
  assert.deepEqual(transportOptions.auth, { user: "brevo-user", pass: "brevo-password" });
  assert.equal(sentMessage.from, "Auth <auth@example.com>");
  assert.equal(sentMessage.to, "user@example.com");
});

test("Brevo HTTPS API sends a password reset email and takes priority over SMTP", async () => {
  let request;
  const mailer = createMailer(
    {
      host: "smtp-relay.brevo.com",
      port: 587,
      from: "auth@example.com",
    },
    "https://frontend.example",
    {
      brevoApiKey: "test-brevo-key",
      brevoFrom: "Auth Service <auth@example.com>",
    },
    async (url, options) => {
      request = { url, options };
      return { ok: true };
    },
    () => {
      return {
        async sendMail() {
          throw new Error("SMTP must not be used when the Brevo API is configured");
        },
      };
    },
  );

  await mailer.sendPasswordReset("user@example.com", "reset-token");

  assert.equal(request.url, "https://api.brevo.com/v3/smtp/email");
  assert.equal(request.options.method, "POST");
  assert.equal(request.options.headers["api-key"], "test-brevo-key");
  const payload = JSON.parse(request.options.body);
  assert.deepEqual(payload.sender, {
    name: "Auth Service",
    email: "auth@example.com",
  });
  assert.deepEqual(payload.to, [{ email: "user@example.com" }]);
  assert.equal(payload.subject, "Réinitialisation du mot de passe");
  assert.match(payload.textContent, /reset-password\?token=reset-token/);
  assert.equal(request.options.signal instanceof AbortSignal, true);
});

test("Brevo API errors are surfaced without exposing the API key", async () => {
  const mailer = createMailer(
    {},
    "https://frontend.example",
    { brevoApiKey: "test-brevo-key", brevoFrom: "auth@example.com" },
    async () => ({
      ok: false,
      status: 401,
      text: async () => JSON.stringify({ code: "unauthorized", message: "Invalid API key" }),
    }),
  );

  await assert.rejects(mailer.sendPasswordReset("user@example.com", "reset-token"), {
    code: "EMAIL_API_REJECTED",
    status: 401,
    providerCode: "unauthorized",
    providerMessage: "Invalid API key",
  });
});

test("Brevo SMTP environment variable names map to backend configuration", () => {
  const output = execFileSync(
    process.execPath,
    [
      "-e",
      'const { smtp } = require("./src/config/env"); process.stdout.write(JSON.stringify({ host: smtp.host, port: smtp.port, secure: smtp.secure, requireTLS: smtp.requireTLS, user: smtp.user, from: smtp.from }));',
    ],
    {
      cwd: path.resolve(__dirname, ".."),
      env: {
        NODE_ENV: "test",
        EMAIL_HOST: "smtp-relay.brevo.com",
        EMAIL_PORT: "587",
        EMAIL_HOST_USER: "brevo-user",
        EMAIL_HOST_PASSWORD: "test-password",
        EMAIL_USE_TLS: "True",
        DEFAULT_FROM_EMAIL: "auth@example.com",
      },
    },
  );

  assert.deepEqual(JSON.parse(output), {
    host: "smtp-relay.brevo.com",
    port: 587,
    secure: false,
    requireTLS: true,
    user: "brevo-user",
    from: "auth@example.com",
  });
});

test("Brevo API environment variables map to email API configuration", () => {
  const output = execFileSync(
    process.execPath,
    [
      "-e",
      'const { emailApi } = require("./src/config/env"); process.stdout.write(JSON.stringify({ brevoApiKeyConfigured: Boolean(emailApi.brevoApiKey), brevoFrom: emailApi.brevoFrom }));',
    ],
    {
      cwd: path.resolve(__dirname, ".."),
      env: {
        NODE_ENV: "test",
        BREVO_API_KEY: "test-brevo-key",
        DEFAULT_FROM_EMAIL: "Auth <auth@example.com>",
      },
    },
  );

  assert.deepEqual(JSON.parse(output), {
    brevoApiKeyConfigured: true,
    brevoFrom: "Auth <auth@example.com>",
  });
});
