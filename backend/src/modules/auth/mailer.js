const nodemailer = require("nodemailer");

function createMailer(
  smtp,
  frontendUrl,
  emailApi = {},
  fetchRequest = fetch,
  createTransport = nodemailer.createTransport,
) {
  const configured = Boolean(smtp.host && smtp.from);
  const resendConfigured = Boolean(emailApi.resendApiKey && emailApi.from);
  const brevoConfigured = Boolean(emailApi.brevoApiKey && emailApi.brevoFrom);
  const transporter = configured
    ? createTransport({
        host: smtp.host,
        port: smtp.port,
        secure: smtp.secure,
        requireTLS: smtp.requireTLS ?? !smtp.secure,
        auth: smtp.user ? { user: smtp.user, pass: smtp.password } : undefined,
      })
    : null;

  async function send({ to, subject, text }) {
    if (brevoConfigured) {
      const senderMatch = emailApi.brevoFrom.match(/^\s*(.*?)\s*<([^<>]+)>\s*$/);
      const sender = senderMatch
        ? { name: senderMatch[1].trim(), email: senderMatch[2].trim() }
        : { email: emailApi.brevoFrom.trim() };
      const response = await fetchRequest("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          "api-key": emailApi.brevoApiKey,
          "Content-Type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify({
          sender,
          to: [{ email: to }],
          subject,
          textContent: text,
        }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) {
        const providerError = await readProviderError(response);
        const error = new Error(`Brevo a refusé l’envoi du courriel (${response.status}).`);
        error.code = "EMAIL_API_REJECTED";
        error.status = response.status;
        if (typeof providerError.code === "string") {
          error.providerCode = providerError.code.slice(0, 100);
        }
        if (typeof providerError.message === "string") {
          error.providerMessage = providerError.message.slice(0, 300);
        }
        throw error;
      }
      return;
    }
    if (transporter) {
      await transporter.sendMail({ from: smtp.from, to, subject, text });
      return;
    }
    if (resendConfigured) {
      const response = await fetchRequest("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${emailApi.resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: emailApi.from,
          to: [to],
          subject,
          text,
        }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) {
        const providerError = await readProviderError(response);
        const error = new Error(`Resend a refusé l’envoi du courriel (${response.status}).`);
        error.code = "EMAIL_API_REJECTED";
        error.status = response.status;
        if (typeof providerError.name === "string") {
          error.providerCode = providerError.name.slice(0, 100);
        }
        if (typeof providerError.message === "string") {
          error.providerMessage = providerError.message.slice(0, 300);
        }
        throw error;
      }
      return;
    }
    const error = new Error("Le service d’envoi des courriels n’est pas configuré.");
    error.status = 503;
    throw error;
  }

  return {
    sendPasswordReset(email, token) {
      const link = `${frontendUrl}/reset-password?token=${encodeURIComponent(token)}`;
      return send({
        to: email,
        subject: "Réinitialisation du mot de passe",
        text: `Une demande de réinitialisation a été effectuée. Si vous en êtes à l’origine, ouvrez ce lien valable 10 minutes : ${link}\n\nSi vous n’avez pas demandé cette réinitialisation, ignorez ce message.`,
      });
    },
    sendSecurityNotice(email, action) {
      return send({
        to: email,
        subject: "Alerte de sécurité du compte",
        text: `Une modification de sécurité a été effectuée sur votre compte : ${action}. Si vous n’êtes pas à l’origine de cette action, contactez immédiatement l’administrateur du service.`,
      });
    },
  };
}

async function readProviderError(response) {
  try {
    return JSON.parse(await response.text());
  } catch {
    return {};
  }
}

module.exports = { createMailer };
