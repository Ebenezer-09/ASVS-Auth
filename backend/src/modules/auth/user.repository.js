function createUserRepository(database) {
  return {
    async create(email, passwordHash) {
      const result = await database.query(
        "INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id",
        [email, passwordHash],
      );
      return result.rows[0].id;
    },
    async findByEmail(email) {
      const result = await database.query(
        "SELECT id, email, password_hash, totp_secret, totp_enabled, last_totp_step FROM users WHERE email = $1",
        [email],
      );
      return result.rows[0];
    },
    async findById(id) {
      const result = await database.query(
        "SELECT id, email, password_hash, totp_secret, totp_enabled, last_totp_step FROM users WHERE id = $1",
        [id],
      );
      return result.rows[0];
    },
  };
}

module.exports = { createUserRepository };
