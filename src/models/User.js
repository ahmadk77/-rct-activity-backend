const pool = require('../database/connection').pool;

class User {
  static async create(data) {
    const { participant_code, email, password_hash, language = 'ar' } = data;
    const result = await pool.query(
      'INSERT INTO users (participant_code, email, password_hash, language) VALUES ($1, $2, $3, $4) RETURNING *',
      [participant_code, email, password_hash, language]
    );
    return result.rows[0];
  }

  static async findByEmail(email) {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    return result.rows[0];
  }

  static async findByParticipantCode(code) {
    const result = await pool.query('SELECT * FROM users WHERE participant_code = $1', [code]);
    return result.rows[0];
  }

  static async findById(id) {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    return result.rows[0];
  }

  static async update(id, data) {
    const { language, is_active, fcm_token } = data;
    const result = await pool.query(
      'UPDATE users SET language = $1, is_active = $2, fcm_token = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4 RETURNING *',
      [language, is_active, fcm_token, id]
    );
    return result.rows[0];
  }

  static async updateFcmToken(id, fcmToken) {
    const result = await pool.query(
      'UPDATE users SET fcm_token = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING id, participant_code, email, language, is_active',
      [fcmToken, id]
    );
    return result.rows[0];
  }
  static async getAll(limit = 50, offset = 0) {
    const result = await pool.query(
      'SELECT id, participant_code, email, language, created_at, is_active FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2',
      [limit, offset]
    );
    return result.rows;
  }

  static async count() {
    const result = await pool.query('SELECT COUNT(*) FROM users');
    return parseInt(result.rows[0].count);
  }
}

module.exports = User;