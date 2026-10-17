const nodemailer = require("nodemailer");

function createMailer(smtp, frontendUrl, emailApi = {}, fetchRequest = fetch) {
  const configured = Boolean(smtp.host && smtp.from);
  const resendConfigured = Boolean(emailApi.resendApiKey && emailApi.from);
  const transporter = configured
    ? nodemailer.createTransport({
        host: smtp.host,
        port: smtp.port,
        secure: smtp.secure,
        requireTLS: !smtp.secure,
        auth: smtp.user ? { user: smtp.user, pass: smtp.password } : undefined,
      })
    : null;

  async function send({ to, subject, text }) {
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
        const responseText = await response.text();
        let providerError = {};
        try {
          providerError = JSON.parse(responseText);
        } catch {
          providerError = {};
        }
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
    if (!transporter) {
      const error = new Error("Le service SMTP n’est pas configuré.");
      error.status = 503;
      throw error;
    }
    await transporter.sendMail({ from: smtp.from, to, subject, text });
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

module.exports = { createMailer };
