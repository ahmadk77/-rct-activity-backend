const { query, initDatabase } = require('../database/connection');

exports.getAllParticipants = async (req, res) => {
  try {
    await initDatabase();
    const result = await query(
      `SELECT u.id, u.participant_code, u.language, u.created_at, u.is_active,
              cp.age_range, cp.residence_location, cp.smartwatch_type,
              g.total_points, g.current_level
       FROM users u
       LEFT JOIN cultural_profiles cp ON u.id = cp.user_id
       LEFT JOIN gamification g ON u.id = g.user_id
       ORDER BY u.created_at DESC`
    );

    res.json({ participants: result.rows });
  } catch (error) {
    console.error('Get all participants error:', error);
    res.status(500).json({ error: 'Failed to get participants' });
  }
};

exports.getParticipantActivity = async (req, res) => {
  try {
    await initDatabase();
    const { code } = req.params;

    const result = await query(
      `SELECT ad.date, ad.steps_count, ad.mvpa_minutes, ad.calories_burned, ad.synced_at
       FROM activity_data ad
       JOIN users u ON ad.user_id = u.id
       WHERE u.participant_code = $1
       ORDER BY ad.date DESC`,
      [code]
    );

    res.json({ activities: result.rows });
  } catch (error) {
    console.error('Get participant activity error:', error);
    res.status(500).json({ error: 'Failed to get participant activity' });
  }
};

exports.toggleFeatureFlag = async (req, res) => {
  try {
    await initDatabase();
    const { feature_name, is_enabled, target_group = 'all', target_user_id = null, reason } = req.body;

    const result = await query(
      `INSERT INTO feature_flags (feature_name, is_enabled, target_group, target_user_id, changed_by, reason)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (feature_name) DO UPDATE SET
         is_enabled = EXCLUDED.is_enabled,
         target_group = EXCLUDED.target_group,
         target_user_id = EXCLUDED.target_user_id,
         changed_by = EXCLUDED.changed_by,
         reason = EXCLUDED.reason,
         changed_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [feature_name, is_enabled, target_group, target_user_id, 'admin', reason]
    );

    // Log the change
    await pool.query(
      'INSERT INTO audit_logs (action, table_name, new_value) VALUES ($1, $2, $3)',
      ['feature_flag_toggled', 'feature_flags', JSON.stringify(result.rows[0])]
    );

    res.json({ message: 'Feature flag updated', flag: result.rows[0] });
  } catch (error) {
    console.error('Toggle feature flag error:', error);
    res.status(500).json({ error: 'Failed to toggle feature flag' });
  }
};

exports.getFeatureFlags = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM feature_flags ORDER BY changed_at DESC'
    );

    res.json({ flags: result.rows });
  } catch (error) {
    console.error('Get feature flags error:', error);
    res.status(500).json({ error: 'Failed to get feature flags' });
  }
};

exports.exportData = async (req, res) => {
  try {
    const { format = 'json', start_date, end_date } = req.query;

    let query = `
      SELECT u.participant_code, ad.date, ad.steps_count, ad.mvpa_minutes, 
             ad.calories_burned, ad.heart_rate_avg, cp.age_range, cp.residence_location,
             cp.religious_affiliation, g.total_points, g.current_level
      FROM activity_data ad
      JOIN users u ON ad.user_id = u.id
      LEFT JOIN cultural_profiles cp ON u.id = cp.user_id
      LEFT JOIN gamification g ON u.id = g.user_id
    `;

    const params = [];
    if (start_date && end_date) {
      query += ' WHERE ad.date >= $1 AND ad.date <= $2';
      params.push(start_date, end_date);
    }

    query += ' ORDER BY ad.date';

    const result = await pool.query(query, params);

    if (format === 'csv') {
      // Convert to CSV format
      const headers = Object.keys(result.rows[0]).join(',');
      const rows = result.rows.map(row => Object.values(row).join(',')).join('\n');
      const csv = headers + '\n' + rows;

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=rct_activity_data.csv');
      res.send(csv);
    } else {
      res.json({ data: result.rows });
    }
  } catch (error) {
    console.error('Export data error:', error);
    res.status(500).json({ error: 'Failed to export data' });
  }
};

exports.getStatistics = async (req, res) => {
  try {
    // Get various statistics
    const totalUsers = await pool.query('SELECT COUNT(*) as count FROM users WHERE is_active = true');
    const totalActivities = await pool.query('SELECT COUNT(*) as count FROM activity_data');
    const avgSteps = await pool.query('SELECT AVG(steps_count) as avg FROM activity_data');
    const avgMvpa = await pool.query('SELECT AVG(mvpa_minutes) as avg FROM activity_data');
    const activeUsers = await pool.query(`
      SELECT COUNT(DISTINCT user_id) as count 
      FROM activity_data 
      WHERE date >= CURRENT_DATE - INTERVAL '7 days'
    `);

    res.json({
      statistics: {
        total_users: parseInt(totalUsers.rows[0].count),
        total_activities: parseInt(totalActivities.rows[0].count),
        average_steps: Math.round(parseFloat(avgSteps.rows[0].avg) || 0),
        average_mvpa_minutes: Math.round(parseFloat(avgMvpa.rows[0].avg) || 0),
        active_users_last_7_days: parseInt(activeUsers.rows[0].count)
      }
    });
  } catch (error) {
    console.error('Get statistics error:', error);
    res.status(500).json({ error: 'Failed to get statistics' });
  }
};
