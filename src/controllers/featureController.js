const { query, initDatabase } = require('../database/connection');

exports.getAllFeatureFlags = async (req, res) => {
  try {
    await initDatabase();
    
    const result = await query('SELECT * FROM feature_flags ORDER BY feature_name');

    res.json({ features: result.rows });
  } catch (error) {
    console.error('Get feature flags error:', error);
    res.status(500).json({ error: 'Failed to get feature flags' });
  }
};

exports.updateFeatureFlag = async (req, res) => {
  try {
    await initDatabase();
    
    const { feature_name, is_enabled, target_group, target_user_id, reason } = req.body;
    const changedBy = req.user?.participantCode || 'admin';

    const result = await query(
      `UPDATE feature_flags 
       SET is_enabled = $1, target_group = $2, target_user_id = $3, changed_by = $4, changed_at = CURRENT_TIMESTAMP, reason = $5
       WHERE feature_name = $6
       RETURNING *`,
      [is_enabled, target_group, target_user_id, changedBy, reason, feature_name]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Feature flag not found' });
    }

    const updatedFeature = result.rows[0];

    // Log the change
    await query(
      'INSERT INTO audit_logs (action, table_name, new_value) VALUES ($1, $2, $3)',
      ['feature_flag_updated', 'feature_flags', JSON.stringify(updatedFeature)]
    );

    res.json({
      message: 'Feature flag updated successfully',
      feature: updatedFeature
    });
  } catch (error) {
    console.error('Update feature flag error:', error);
    res.status(500).json({ error: 'Failed to update feature flag' });
  }
};

exports.getUserFeatureFlags = async (req, res) => {
  try {
    await initDatabase();
    
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get feature flags that apply to this user
    const result = await query(
      `SELECT * FROM feature_flags 
       WHERE target_group = 'all' 
          OR (target_group = 'specific_user' AND target_user_id = $1)
          OR target_user_id IS NULL`,
      [userId]
    );

    res.json({ features: result.rows });
  } catch (error) {
    console.error('Get user feature flags error:', error);
    res.status(500).json({ error: 'Failed to get user feature flags' });
  }
};