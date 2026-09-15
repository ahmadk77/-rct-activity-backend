const pool = require('../database/connection').pool;

class FeatureFlag {
  static async getAll() {
    const result = await pool.query('SELECT * FROM feature_flags ORDER BY feature_name');
    return result.rows;
  }

  static async getByName(feature_name) {
    const result = await pool.query('SELECT * FROM feature_flags WHERE feature_name = $1', [feature_name]);
    return result.rows[0];
  }

  static async getByUser(user_id) {
    const result = await pool.query(
      `SELECT * FROM feature_flags 
       WHERE target_group = 'all' 
       OR target_group = 'specific_user' AND target_user_id = $1`,
      [user_id]
    );
    return result.rows;
  }

  static async isEnabled(feature_name, user_id = null) {
    let query = 'SELECT is_enabled FROM feature_flags WHERE feature_name = $1';
    const params = [feature_name];
    
    if (user_id) {
      query += ' AND (target_group = $2 OR (target_group = $3 AND target_user_id = $4))';
      params.push('all', 'specific_user', user_id);
    } else {
      query += ' AND target_group = $2';
      params.push('all');
    }
    
    const result = await pool.query(query, params);
    if (result.rows.length === 0) return true; // Default to enabled if not found
    return result.rows[0].is_enabled;
  }

  static async toggle(feature_name, is_enabled, changed_by, reason) {
    const result = await pool.query(
      `UPDATE feature_flags 
       SET is_enabled = $1, changed_by = $2, changed_at = CURRENT_TIMESTAMP, reason = $3 
       WHERE feature_name = $4 
       RETURNING *`,
      [is_enabled, changed_by, reason, feature_name]
    );
    return result.rows[0];
  }

  static async create(data) {
    const { feature_name, is_enabled, target_group, target_user_id, changed_by, reason } = data;
    const result = await pool.query(
      `INSERT INTO feature_flags (feature_name, is_enabled, target_group, target_user_id, changed_by, reason) 
       VALUES ($1, $2, $3, $4, $5, $6) 
       RETURNING *`,
      [feature_name, is_enabled, target_group, target_user_id, changed_by, reason]
    );
    return result.rows[0];
  }

  static async delete(feature_name) {
    const result = await pool.query('DELETE FROM feature_flags WHERE feature_name = $1 RETURNING *', [feature_name]);
    return result.rows[0];
  }
}

module.exports = FeatureFlag;