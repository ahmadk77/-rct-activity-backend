const { query, initDatabase } = require('../database/connection');

// Get user's progress (for invitation flow)
exports.getUserProgress = async (req, res) => {
  try {
    await initDatabase();
    
    const { user_id } = req.params;

    // Get user basic info
    const userResult = await query(
      'SELECT id, email, participant_code, language, created_at FROM users WHERE id = $1',
      [user_id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];

    // Get gamification data
    const gamificationResult = await query(
      'SELECT * FROM gamification WHERE user_id = $1',
      [user_id]
    );

    const gamification = gamificationResult.rows.length > 0 ? gamificationResult.rows[0] : null;

    // Get recent activity (last 7 days)
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const activityResult = await query(
      `SELECT date, steps_count, mvpa_minutes, calories_burned 
       FROM activity_data 
       WHERE user_id = $1 AND date >= $2 
       ORDER BY date DESC`,
      [user_id, weekAgo.toISOString().split('T')[0]]
    );

    // Get completed exercises
    const exerciseResult = await query(
      `SELECT uep.*, em.title, em.thumbnail_url 
       FROM user_exercise_progress uep 
       JOIN exercise_media em ON uep.exercise_id = em.id 
       WHERE uep.user_id = $1 
       ORDER BY uep.completed_at DESC 
       LIMIT 10`,
      [user_id]
    );

    // Calculate weekly stats
    let totalSteps = 0;
    let totalMVPA = 0;
    let totalCalories = 0;
    let activeDays = 0;

    activityResult.rows.forEach(activity => {
      totalSteps += activity.steps_count || 0;
      totalMVPA += activity.mvpa_minutes || 0;
      totalCalories += activity.calories_burned || 0;
      if (activity.steps_count > 0 || activity.mvpa_minutes > 0) {
        activeDays++;
      }
    });

    res.json({
      user: {
        id: user.id,
        participant_code: user.participant_code,
        language: user.language,
        joined_at: user.created_at
      },
      gamification: gamification ? {
        total_points: gamification.total_points,
        current_level: gamification.current_level,
        weekly_points: gamification.weekly_points
      } : null,
      weekly_stats: {
        total_steps: totalSteps,
        total_mvpa_minutes: totalMVPA,
        total_calories: totalCalories,
        active_days: activeDays,
        exercises_completed: exerciseResult.rows.length
      },
      recent_activities: activityResult.rows,
      recent_exercises: exerciseResult.rows
    });
  } catch (error) {
    console.error('Get user progress error:', error);
    res.status(500).json({ error: 'Failed to get user progress' });
  }
};

// Send emoji/reaction to another user
exports.sendReaction = async (req, res) => {
  try {
    await initDatabase();
    
    const { receiver_id, emoji, reaction_type = 'encouragement', context_type, context_id } = req.body;
    const senderId = req.user?.id;

    if (!senderId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!receiver_id || !emoji) {
      return res.status(400).json({ error: 'receiver_id and emoji are required' });
    }

    // Insert reaction
    const result = await query(
      `INSERT INTO reactions (sender_id, receiver_id, emoji, reaction_type, context_type, context_id) 
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [senderId, receiver_id, emoji, reaction_type, context_type, context_id]
    );

    const reaction = result.rows[0];

    // Log the reaction
    await query(
      'INSERT INTO audit_logs (action, table_name, new_value) VALUES ($1, $2, $3)',
      ['reaction_sent', 'reactions', JSON.stringify({ senderId, receiver_id, emoji })]
    );

    res.status(201).json({
      message: 'Reaction sent successfully',
      reaction: {
        id: reaction.id,
        emoji: reaction.emoji,
        reaction_type: reaction.reaction_type,
        created_at: reaction.created_at
      }
    });
  } catch (error) {
    console.error('Send reaction error:', error);
    res.status(500).json({ error: 'Failed to send reaction' });
  }
};

// Get reactions for current user
exports.getReactions = async (req, res) => {
  try {
    await initDatabase();
    
    const userId = req.user?.id;
    const { unread_only = false } = req.query;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    let sql = `
      SELECT r.*, u_sender.email as sender_email, u_sender.participant_code as sender_code 
      FROM reactions r 
      JOIN users u_sender ON r.sender_id = u_sender.id 
      WHERE r.receiver_id = $1
    `;

    const params = [userId];

    if (unread_only === 'true') {
      sql += ' AND r.is_read = false';
    }

    sql += ' ORDER BY r.created_at DESC LIMIT 50';

    const result = await query(sql, params);

    res.json({ reactions: result.rows });
  } catch (error) {
    console.error('Get reactions error:', error);
    res.status(500).json({ error: 'Failed to get reactions' });
  }
};

// Mark reactions as read
exports.markReactionsAsRead = async (req, res) => {
  try {
    await initDatabase();
    
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    await query(
      'UPDATE reactions SET is_read = true WHERE receiver_id = $1 AND is_read = false',
      [userId]
    );

    res.json({ message: 'Reactions marked as read' });
  } catch (error) {
    console.error('Mark reactions as read error:', error);
    res.status(500).json({ error: 'Failed to mark reactions as read' });
  }
};

// Get available emojis
exports.getAvailableEmojis = async (req, res) => {
  try {
    const emojis = {
      encouragement: ['👍', '💪', '🔥', '⭐', '🌟', '💯', '🎯', '🚀'],
      celebration: ['🎉', '🎊', '🏆', '🥇', '🎁', '🎈', '👏', '🙌'],
      support: ['❤️', '🤗', '🤝', '💪', '🌈', '☀️', '🌸', '🍀'],
      fitness: ['🏃', '🚴', '🏊', '🧘', '🤸', '⚽', '🏋️', '🧗']
    };

    res.json({ emojis });
  } catch (error) {
    console.error('Get available emojis error:', error);
    res.status(500).json({ error: 'Failed to get available emojis' });
  }
};
