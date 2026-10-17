const express = require("express");
const { createDatabase } = require("./database/connection");
const { createAuthRouter } = require("./modules/auth/auth.routes");
const { createMailer } = require("./modules/auth/mailer");
const defaultConfig = require("./config/env");

function createApp({
  databaseUrl = defaultConfig.databaseUrl,
  database: injectedDatabase,
  frontendOrigins = defaultConfig.frontendOrigins,
  jwtSecret = defaultConfig.jwtSecret,
  totpEncryptionKey = defaultConfig.totpEncryptionKey,
  frontendUrl = defaultConfig.frontendUrl,
  requireMfa = defaultConfig.requireMfa,
  trustProxyHops = defaultConfig.trustProxyHops,
  smtp = defaultConfig.smtp,
  emailApi = defaultConfig.emailApi,
  mailer: injectedMailer,
  isProduction = defaultConfig.isProduction,
  rateLimitMax = defaultConfig.authRateLimitMax,
  rateLimitWindowMs = defaultConfig.authRateLimitWindowMs,
  breachChecker,
} = {}) {
  const app = express();
const database = injectedDatabase || createDatabase({ databaseUrl });
  const mailer = injectedMailer || createMailer(smtp, frontendUrl, emailApi);

  app.disable("x-powered-by");
  if (trustProxyHops > 0) app.set("trust proxy", trustProxyHops);
  app.use((request, response, next) => {
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("X-Frame-Options", "DENY");
    response.setHeader("Referrer-Policy", "no-referrer");

    const origin = request.get("origin");
    if (origin && !frontendOrigins.includes(origin)) {
      response.status(403).json({ error: "Origine non autorisée." });
      return;
    }

    if (origin) {
      response.setHeader("Access-Control-Allow-Origin", origin);
      response.setHeader("Access-Control-Allow-Credentials", "true");
      response.setHeader("Vary", "Origin");
    }

    if (request.method === "OPTIONS") {
      response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      response.setHeader("Access-Control-Allow-Headers", "Content-Type");
      response.sendStatus(204);
      return;
    }

    next();
  });
  app.use(express.json({ limit: "8kb", strict: true }));
  app.use(async (_request, _response, next) => {
    try {
      await database.ready;
      next();
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/health", async (_request, response, next) => {
    try {
      await database.query("SELECT 1");
      response.json({ status: "ok" });
    } catch (error) {
      next(error);
    }
  });
  app.use(
    "/api/auth",
    createAuthRouter({
      database,
      jwtSecret,
      isProduction,
      rateLimitMax,
      rateLimitWindowMs,
      totpEncryptionKey,
      mailer,
      frontendUrl,
      requireMfa,
      breachChecker,
    }),
  );

  app.use((error, _request, response, _next) => {
    if (error.type === "entity.parse.failed") {
      response.status(400).json({ error: "Corps JSON invalide." });
      return;
    }
    if (error.type === "entity.too.large") {
      response.status(413).json({ error: "Requête trop volumineuse." });
      return;
    }
    if (error.code === "PASSWORD_CHECK_UNAVAILABLE") {
      console.error("Service de vérification des mots de passe indisponible :", error);
      response.status(503).json({
        error: "La vérification de sécurité est temporairement indisponible. Réessayez plus tard.",
      });
      return;
    }

    console.error("Erreur inattendue de l’API :", error);
    response.status(500).json({ error: "Une erreur interne est survenue." });
  });

  app.locals.closeDatabase = () => database.close();
  app.locals.database = database;
  return app;
}

module.exports = { createApp };
