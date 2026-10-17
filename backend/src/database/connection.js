const fs = require("node:fs");
const path = require("node:path");
const { Pool } = require("pg");

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    totp_secret TEXT,
    totp_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    last_totp_step BIGINT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS auth_sessions (
    id TEXT PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ
  );
  CREATE INDEX IF NOT EXISTS auth_sessions_user_id_idx ON auth_sessions(user_id);
  CREATE TABLE IF NOT EXISTS password_reset_tokens (
    token_hash TEXT PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ
  );
  CREATE TABLE IF NOT EXISTS recovery_codes (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code_hash TEXT NOT NULL,
    used_at TIMESTAMPTZ
  );
  CREATE TABLE IF NOT EXISTS auth_alert_state (
    email_hash TEXT PRIMARY KEY,
    user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
    failures INTEGER NOT NULL DEFAULT 0,
    last_notified_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS auth_login_failures (
    key TEXT PRIMARY KEY,
    failures INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS rate_limit_windows (
    key TEXT PRIMARY KEY,
    count INTEGER NOT NULL,
    reset_at TIMESTAMPTZ NOT NULL
  );
`;

const ROW_LEVEL_SECURITY = `
  ALTER TABLE users ENABLE ROW LEVEL SECURITY;
  ALTER TABLE auth_sessions ENABLE ROW LEVEL SECURITY;
  ALTER TABLE password_reset_tokens ENABLE ROW LEVEL SECURITY;
  ALTER TABLE recovery_codes ENABLE ROW LEVEL SECURITY;
  ALTER TABLE auth_alert_state ENABLE ROW LEVEL SECURITY;
  ALTER TABLE auth_login_failures ENABLE ROW LEVEL SECURITY;
  ALTER TABLE rate_limit_windows ENABLE ROW LEVEL SECURITY;
`;

function createPostgresDatabase(connectionString) {
  const options = {
    connectionString,
    ssl: process.env.SUPABASE_DB_SSL === "false"
      ? false
      : {
          rejectUnauthorized: true,
          ...(process.env.SUPABASE_DB_CA
            ? { ca: fs.readFileSync(path.resolve(process.env.SUPABASE_DB_CA), "utf8") }
            : {}),
        },
    max: 10,
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 30_000,
  };
  const pool = new Pool(options);
  const ready = (async () => {
    const legacyTables = [
      "users",
      "auth_sessions",
      "password_reset_tokens",
      "recovery_codes",
      "auth_alert_state",
      "auth_login_failures",
      "rate_limit_windows",
    ];
    for (const table of legacyTables) {
      const result = await pool.query(
        "SELECT to_regclass($1) AS legacy, to_regclass($2) AS current",
        [`asvs_auth.${table}`, `public.${table}`],
      );
      if (result.rows[0].legacy && !result.rows[0].current) {
        await pool.query(`ALTER TABLE asvs_auth.${table} SET SCHEMA public`);
      }
    }
    await pool.query(SCHEMA);
    await pool.query(ROW_LEVEL_SECURITY);
  })();

  return {
    isPostgres: true,
    ready,
    query(text, values = []) {
      return ready.then(() => pool.query(text, values));
    },
    async close() {
      await ready.catch(() => undefined);
      await pool?.end();
    },
  };
}

function createDatabase({ databaseUrl = process.env.SUPABASE_DB_URL } = {}) {
  if (!databaseUrl) {
    throw new Error("SUPABASE_DB_URL est obligatoire. Configurez Supabase PostgreSQL.");
  }
  return createPostgresDatabase(databaseUrl);
}

module.exports = { createDatabase, SCHEMA };
