const pool = require('../database/connection').pool;

class ActivityData {
  static async create(data) {
    const { user_id, date, steps_count, mvpa_minutes, calories_burned, heart_rate_avg, sync_source, uuid } = data;
    const result = await pool.query(
      `INSERT INTO activity_data (user_id, date, steps_count, mvpa_minutes, calories_burned, heart_rate_avg, sync_source, uuid) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
       ON CONFLICT (user_id, date, uuid) DO UPDATE 
       SET steps_count = EXCLUDED.steps_count, mvpa_minutes = EXCLUDED.mvpa_minutes, 
           calories_burned = EXCLUDED.calories_burned, heart_rate_avg = EXCLUDED.heart_rate_avg,
           sync_source = EXCLUDED.sync_source, synced_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [user_id, date, steps_count, mvpa_minutes, calories_burned, heart_rate_avg, sync_source, uuid]
    );
    return result.rows[0];
  }

  static async findByUserId(user_id, limit = 30) {
    const result = await pool.query(
      'SELECT * FROM activity_data WHERE user_id = $1 ORDER BY date DESC LIMIT $2',
      [user_id, limit]
    );
    return result.rows;
  }

  static async findByDateRange(user_id, start_date, end_date) {
    const result = await pool.query(
      'SELECT * FROM activity_data WHERE user_id = $1 AND date BETWEEN $2 AND $3 ORDER BY date ASC',
      [user_id, start_date, end_date]
    );
    return result.rows;
  }

  static async getDailyStats(user_id, date) {
    const result = await pool.query(
      'SELECT * FROM activity_data WHERE user_id = $1 AND date = $2',
      [user_id, date]
    );
    return result.rows[0];
  }

  static async getWeeklyStats(user_id, start_date, end_date) {
    const result = await pool.query(
      `SELECT 
        COUNT(*) as active_days,
        SUM(steps_count) as total_steps,
        SUM(mvpa_minutes) as total_mvpa_minutes,
        AVG(steps_count) as avg_steps,
        AVG(mvpa_minutes) as avg_mvpa_minutes
       FROM activity_data 
       WHERE user_id = $1 AND date BETWEEN $2 AND $3`,
      [user_id, start_date, end_date]
    );
    return result.rows[0];
  }

  static async getPendingSync(user_id) {
    const result = await pool.query(
      'SELECT * FROM activity_data WHERE user_id = $1 AND pending_sync = true',
      [user_id]
    );
    return result.rows;
  }

  static async markSynced(id) {
    const result = await pool.query(
      'UPDATE activity_data SET pending_sync = false, synced_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *',
      [id]
    );
    return result.rows[0];
  }
}

module.exports = ActivityData;