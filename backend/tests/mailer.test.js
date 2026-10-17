const assert = require("node:assert/strict");
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
