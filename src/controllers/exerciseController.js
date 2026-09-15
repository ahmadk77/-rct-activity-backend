const { query, initDatabase } = require('../database/connection');

exports.getExercises = async (req, res) => {
  try {
    await initDatabase();
    
    const { difficulty, cultural_tag, limit = 20, offset = 0 } = req.query;

    let sql = 'SELECT * FROM exercise_media WHERE is_active = true';
    const params = [];
    let paramIndex = 1;

    if (difficulty) {
      sql += ` AND difficulty_level = $${paramIndex}`;
      params.push(difficulty);
      paramIndex++;
    }

    if (cultural_tag) {
      sql += ` AND cultural_tags LIKE $${paramIndex}`;
      params.push(`%${cultural_tag}%`);
      paramIndex++;
    }

    sql += ` ORDER BY created_at DESC LIMIT $${paramIndex}`;
    params.push(limit);
    paramIndex++;

    sql += ` OFFSET $${paramIndex}`;
    params.push(offset);

    const result = await query(sql, params);

    res.json({ exercises: result.rows });
  } catch (error) {
    console.error('Get exercises error:', error);
    res.status(500).json({ error: 'Failed to get exercises' });
  }
};

exports.completeExercise = async (req, res) => {
  try {
    await initDatabase();
    
    const { exerciseId } = req.params;
    const { duration_minutes } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Insert exercise progress
    await query(
      'INSERT INTO user_exercise_progress (user_id, exercise_id, duration_completed) VALUES ($1, $2, $3)',
      [userId, exerciseId, duration_minutes * 60] // Convert to seconds
    );

    // Award points for completing exercise
    const existingGamification = await query('SELECT * FROM gamification WHERE user_id = $1', [userId]);

    if (existingGamification.rows.length > 0) {
      await query(
        'UPDATE gamification SET total_points = total_points + 5, weekly_points = weekly_points + 5, last_updated = CURRENT_TIMESTAMP WHERE user_id = $1',
        [userId]
      );
    } else {
      await query(
        'INSERT INTO gamification (user_id, total_points, weekly_points, current_level) VALUES ($1, 5, 5, $2)',
        [userId, 'bronze']
      );
    }

    // Log the completion
    await query(
      'INSERT INTO audit_logs (action, table_name, new_value) VALUES ($1, $2, $3)',
      ['exercise_completed', 'user_exercise_progress', JSON.stringify({ userId, exerciseId })]
    );

    res.status(201).json({
      message: 'Exercise completed successfully'
    });
  } catch (error) {
    console.error('Complete exercise error:', error);
    res.status(500).json({ error: 'Failed to complete exercise' });
  }
};

exports.getUserExerciseHistory = async (req, res) => {
  try {
    await initDatabase();
    
    const userId = req.user?.id;
    const { limit = 20, offset = 0 } = req.query;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const result = await query(
      `SELECT uep.*, em.title, em.media_url, em.thumbnail_url 
       FROM user_exercise_progress uep 
       JOIN exercise_media em ON uep.exercise_id = em.id 
       WHERE uep.user_id = $1 
       ORDER BY uep.completed_at DESC 
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    res.json({ history: result.rows });
  } catch (error) {
    console.error('Get exercise history error:', error);
    res.status(500).json({ error: 'Failed to get exercise history' });
  }
};