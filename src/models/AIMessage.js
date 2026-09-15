const pool = require('../database/connection').pool;

class AIMessage {
  static async create(data) {
    const { user_id, message_content, message_type, is_ai_generated = true } = data;
    const result = await pool.query(
      `INSERT INTO ai_messages (user_id, message_content, message_type, is_ai_generated) 
       VALUES ($1, $2, $3, $4) 
       RETURNING *`,
      [user_id, message_content, message_type, is_ai_generated]
    );
    return result.rows[0];
  }

  static async findByUserId(user_id, limit = 20) {
    const result = await pool.query(
      'SELECT * FROM ai_messages WHERE user_id = $1 ORDER BY sent_at DESC LIMIT $2',
      [user_id, limit]
    );
    return result.rows;
  }

  static async markAsRead(id) {
    const result = await pool.query(
      'UPDATE ai_messages SET read_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *',
      [id]
    );
    return result.rows[0];
  }

  static async addReaction(id, reaction) {
    const result = await pool.query(
      'UPDATE ai_messages SET reaction = $1 WHERE id = $2 RETURNING *',
      [reaction, id]
    );
    return result.rows[0];
  }

  static async getUnreadCount(user_id) {
    const result = await pool.query(
      'SELECT COUNT(*) FROM ai_messages WHERE user_id = $1 AND read_at IS NULL',
      [user_id]
    );
    return parseInt(result.rows[0].count);
  }
}

module.exports = AIMessage;