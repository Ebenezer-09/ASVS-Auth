const { randomBytes } = require("node:crypto");

const frontendOrigins = (process.env.FRONTEND_ORIGINS || "http://localhost:3000")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

if (process.env.NODE_ENV === "production" && !process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET doit être défini en production.");
}

if (process.env.NODE_ENV === "production" && !process.env.SUPABASE_DB_URL) {
  throw new Error("SUPABASE_DB_URL doit être défini en production.");
}
if (process.env.NODE_ENV === "production" && process.env.SUPABASE_DB_SSL === "false") {
  throw new Error("TLS ne peut pas être désactivé pour Supabase en production.");
}
if (process.env.NODE_ENV === "production" && process.env.REQUIRE_MFA === "false") {
  throw new Error("REQUIRE_MFA ne peut pas être désactivé en production.");
}
if (process.env.NODE_ENV === "production" && (!process.env.SMTP_HOST || !process.env.SMTP_FROM)) {
  throw new Error("SMTP_HOST et SMTP_FROM doivent être configurés en production.");
}
if (Boolean(process.env.SMTP_USER) !== Boolean(process.env.SMTP_PASS)) {
  throw new Error("SMTP_USER et SMTP_PASS doivent être configurés ensemble.");
}

const jwtSecret = process.env.JWT_SECRET || randomBytes(32).toString("hex");
if (Buffer.byteLength(jwtSecret, "utf8") < 32) {
  throw new Error("JWT_SECRET doit contenir au moins 32 octets.");
}

const totpEncryptionKey = process.env.TOTP_ENCRYPTION_KEY;
const decodedTotpEncryptionKey = totpEncryptionKey
  ? Buffer.from(totpEncryptionKey, "base64")
  : null;
if (
  decodedTotpEncryptionKey &&
  (decodedTotpEncryptionKey.length !== 32 ||
    decodedTotpEncryptionKey.toString("base64") !== totpEncryptionKey)
) {
  throw new Error("TOTP_ENCRYPTION_KEY doit être une clé base64 de 32 octets.");
}
if (process.env.NODE_ENV !== "test" && !totpEncryptionKey) {
  throw new Error("Configurez TOTP_ENCRYPTION_KEY avec une clé persistante de 32 octets.");
}
const trustProxyHops = Number(process.env.TRUST_PROXY_HOPS || "0");
if (!Number.isInteger(trustProxyHops) || trustProxyHops < 0 || trustProxyHops > 5) {
  throw new Error("TRUST_PROXY_HOPS doit être un entier compris entre 0 et 5.");
}
const authRateLimitMax = Number(process.env.AUTH_RATE_LIMIT_MAX || "10");
if (!Number.isInteger(authRateLimitMax) || authRateLimitMax < 1 || authRateLimitMax > 1000) {
  throw new Error("AUTH_RATE_LIMIT_MAX doit être un entier entre 1 et 1000.");
}
const authRateLimitWindowMinutes = Number(
  process.env.AUTH_RATE_LIMIT_WINDOW_MINUTES || "15",
);
if (
  !Number.isInteger(authRateLimitWindowMinutes) ||
  authRateLimitWindowMinutes < 1 ||
  authRateLimitWindowMinutes > 1440
) {
  throw new Error("AUTH_RATE_LIMIT_WINDOW_MINUTES doit être un entier entre 1 et 1440.");
}

module.exports = {
  port: Number.parseInt(process.env.PORT || "4000", 10),
  databaseUrl: process.env.SUPABASE_DB_URL,
  frontendOrigins,
  jwtSecret,
  totpEncryptionKey: totpEncryptionKey
    ? decodedTotpEncryptionKey
    : randomBytes(32),
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:3000",
  requireMfa: process.env.REQUIRE_MFA !== "false",
  trustProxyHops,
  authRateLimitMax,
  authRateLimitWindowMs: authRateLimitWindowMinutes * 60 * 1000,
  smtp: {
    host: process.env.SMTP_HOST,
    port: Number.parseInt(process.env.SMTP_PORT || "587", 10),
    secure: process.env.SMTP_SECURE === "true",
    user: process.env.SMTP_USER,
    password: process.env.SMTP_PASS,
    from: process.env.SMTP_FROM,
  },
  isProduction: process.env.NODE_ENV === "production",
};
