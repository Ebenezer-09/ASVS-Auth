const { createHash } = require("node:crypto");

class DatabaseRateLimitStore {
  constructor(database) {
    this.database = database;
    this.incrementCount = 0;
  }

  init(options) {
    this.windowMs = options.windowMs;
  }

  async increment(key) {
    const hashedKey = createHash("sha256").update(key).digest("hex");
    const now = new Date();
    this.incrementCount += 1;
    if (this.incrementCount % 500 === 0) {
      await this.database.query("DELETE FROM rate_limit_windows WHERE reset_at <= $1", [
        now.toISOString(),
      ]);
    }
    const resetAt = new Date(now.getTime() + this.windowMs);
    const result = await this.database.query(
      `INSERT INTO rate_limit_windows (key, count, reset_at) VALUES ($1, 1, $2)
       ON CONFLICT (key) DO UPDATE SET
         count = CASE WHEN rate_limit_windows.reset_at <= $3 THEN 1 ELSE rate_limit_windows.count + 1 END,
         reset_at = CASE WHEN rate_limit_windows.reset_at <= $3 THEN $2 ELSE rate_limit_windows.reset_at END
       RETURNING count, reset_at`,
      [hashedKey, resetAt.toISOString(), now.toISOString()],
    );
    return {
      totalHits: Number(result.rows[0].count),
      resetTime: new Date(result.rows[0].reset_at),
    };
  }

  async decrement(key) {
    const hashedKey = createHash("sha256").update(key).digest("hex");
    await this.database.query(
      "UPDATE rate_limit_windows SET count = CASE WHEN count > 0 THEN count - 1 ELSE 0 END WHERE key = $1",
      [hashedKey],
    );
  }

  async resetKey(key) {
    const hashedKey = createHash("sha256").update(key).digest("hex");
    await this.database.query("DELETE FROM rate_limit_windows WHERE key = $1", [hashedKey]);
  }

  async resetAll() {
    await this.database.query("DELETE FROM rate_limit_windows");
  }
}

module.exports = { DatabaseRateLimitStore };
