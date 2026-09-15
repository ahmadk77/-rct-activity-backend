const { query, initDatabase } = require('../database/connection');
const { v4: uuidv4 } = require('uuid');

exports.submitActivity = async (req, res) => {
  try {
    await initDatabase();
    const userId = req.user?.id;
    const { date, steps_count, mvpa_minutes, calories_burned, heart_rate_avg, sync_source = 'manual', uuid } = req.body;

    // Use provided UUID or generate new one for idempotency
    const activityUuid = uuid || uuidv4();

    // Check if this UUID already exists (idempotency check)
    const existing = await query(
      'SELECT id FROM activity_data WHERE uuid = $1',
      [activityUuid]
    );

    if (existing.rows.length > 0) {
      return res.json({ message: 'Activity already recorded', id: existing.rows[0].id });
    }

    // Insert activity data
    const result = await query(
      `INSERT INTO activity_data 
       (user_id, date, steps_count, mvpa_minutes, calories_burned, heart_rate_avg, sync_source, uuid)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (user_id, date, uuid) DO NOTHING
       RETURNING *`,
      [userId, date, steps_count, mvpa_minutes, calories_burned, heart_rate_avg, sync_source, activityUuid]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Activity already exists for this date' });
    }

    // Update gamification points
    await updateGamificationPoints(userId, steps_count, mvpa_minutes);

    res.json({ message: 'Activity submitted successfully', activity: result.rows[0] });
  } catch (error) {
    console.error('Submit activity error:', error);
    res.status(500).json({ error: 'Failed to submit activity' });
  }
};

exports.getActivityHistory = async (req, res) => {
  try {
    await initDatabase();
    const userId = req.user?.id;
    const { start_date, end_date } = req.query;

    const result = await query(
      `SELECT date, steps_count, mvpa_minutes, calories_burned, heart_rate_avg, synced_at 
       FROM activity_data 
       WHERE user_id = $1 
       AND date >= $2 
       AND date <= $3
       ORDER BY date DESC`,
      [userId, start_date, end_date]
    );

    res.json({ activities: result.rows });
  } catch (error) {
    console.error('Get activity history error:', error);
    res.status(500).json({ error: 'Failed to get activity history' });
  }
};

exports.getTodayActivity = async (req, res) => {
  try {
    await initDatabase();
    const userId = req.user?.id;
    const today = new Date().toISOString().split('T')[0];

    const result = await query(
      'SELECT * FROM activity_data WHERE user_id = $1 AND date = $2',
      [userId, today]
    );

    if (result.rows.length === 0) {
      return res.json({ activity: null });
    }

    res.json({ activity: result.rows[0] });
  } catch (error) {
    console.error('Get today activity error:', error);
    res.status(500).json({ error: 'Failed to get today activity' });
  }
};

exports.syncSmartwatch = async (req, res) => {
  try {
    await initDatabase();
    const userId = req.user?.id;
    const { provider, activities } = req.body;

    // Update smartwatch connection last sync
    await query(
      'UPDATE smartwatch_connections SET last_sync_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND provider = $2',
      [userId, provider]
    );

    // Process each activity
    const results = [];
    for (const activity of activities) {
      const existing = await query(
        `SELECT id FROM activity_data
         WHERE user_id = $1 AND date = $2 AND sync_source = $3
         ORDER BY synced_at DESC LIMIT 1`,
        [userId, activity.date, provider]
      );

      const result = existing.rows.length > 0
        ? await query(
          `UPDATE activity_data
           SET steps_count = $1, mvpa_minutes = $2, calories_burned = $3,
               heart_rate_avg = $4, synced_at = CURRENT_TIMESTAMP
           WHERE id = $5
           RETURNING *`,
          [activity.steps_count, activity.mvpa_minutes, activity.calories_burned,
           activity.heart_rate_avg, existing.rows[0].id]
        )
        : await query(
          `INSERT INTO activity_data
           (user_id, date, steps_count, mvpa_minutes, calories_burned, heart_rate_avg, sync_source, uuid)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING *`,
        [userId, activity.date, activity.steps_count, activity.mvpa_minutes, 
           activity.calories_burned, activity.heart_rate_avg, provider, uuidv4()]
      );

      if (result.rows.length > 0) {
        results.push(result.rows[0]);
        if (existing.rows.length === 0) {
          await updateGamificationPoints(userId, activity.steps_count, activity.mvpa_minutes);
        }
      }
    }

    res.json({ message: 'Smartwatch sync completed', synced: results.length, activities: results });
  } catch (error) {
    console.error('Smartwatch sync error:', error);
    res.status(500).json({ error: 'Failed to sync smartwatch data' });
  }
};

// Helper function to update gamification points
async function updateGamificationPoints(userId, steps, mvpaMinutes) {
  try {
    let pointsEarned = 0;

    // 10 points for 10,000 steps daily
    if (steps >= 10000) {
      pointsEarned += 10;
    }

    // Get current week's MVPA
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);
    
    const mvpaResult = await query(
      `SELECT COALESCE(SUM(mvpa_minutes), 0) as total_mvpa 
       FROM activity_data 
       WHERE user_id = $1 AND date >= $2`,
      [userId, weekStart.toISOString().split('T')[0]]
    );

    const totalMvpa = parseInt(mvpaResult.rows[0].total_mvpa) + mvpaMinutes;
    
    // 50 points for 60 minutes MVPA weekly
    if (totalMvpa >= 60) {
      pointsEarned += 50;
    }

    if (pointsEarned > 0) {
      // Update user's total points
      await query(
        `INSERT INTO gamification (user_id, total_points, weekly_points)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id) DO UPDATE SET
           total_points = gamification.total_points + $2,
           weekly_points = gamification.weekly_points + $3,
           last_updated = CURRENT_TIMESTAMP`,
        [userId, pointsEarned, pointsEarned]
      );

      // Check and update level
      await updateUserLevel(userId);
    }
  } catch (error) {
    console.error('Update gamification points error:', error);
  }
}

async function updateUserLevel(userId) {
  try {
    const result = await query(
      'SELECT total_points FROM gamification WHERE user_id = $1',
      [userId]
    );

    if (result.rows.length === 0) return;

    const points = result.rows[0].total_points;
    let newLevel = 'bronze';

    if (points >= 500) newLevel = 'legendary';
    else if (points >= 300) newLevel = 'gold';
    else if (points >= 150) newLevel = 'silver';

    await query(
      'UPDATE gamification SET current_level = $1 WHERE user_id = $2',
      [newLevel, userId]
    );
  } catch (error) {
    console.error('Update user level error:', error);
  }
}
