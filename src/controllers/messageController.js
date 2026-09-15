const { query, initDatabase } = require('../database/connection');
const aiMessageService = require('../services/aiMessageService');

exports.getMessages = async (req, res) => {
  try {
    await initDatabase();
    
    const userId = req.user?.id;
    const { limit = 20, offset = 0 } = req.query;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const result = await query(
      `SELECT * FROM ai_messages 
       WHERE user_id = $1 
       ORDER BY sent_at DESC 
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    res.json({ messages: result.rows });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'Failed to get messages' });
  }
};

exports.markAsRead = async (req, res) => {
  try {
    await initDatabase();
    
    const userId = req.user?.id;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const result = await query(
      'UPDATE ai_messages SET read_at = CURRENT_TIMESTAMP WHERE id = $1 AND user_id = $2 RETURNING *',
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Message not found' });
    }

    res.json({ message: 'Message marked as read' });
  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json({ error: 'Failed to mark message as read' });
  }
};

exports.reactToMessage = async (req, res) => {
  try {
    await initDatabase();
    const db = getDb();
    
    const userId = req.user?.id;
    const { id } = req.params;
    const { reaction } = req.body; // 'like', 'love', 'close'

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!['like', 'love', 'close'].includes(reaction)) {
      return res.status(400).json({ error: 'Invalid reaction' });
    }

    const stmt = db.prepare(
      'UPDATE ai_messages SET reaction = ? WHERE id = ? AND user_id = ?'
    );
    stmt.run(reaction, id, userId);
    stmt.free();

    if (stmt.changes === 0) {
      return res.status(404).json({ error: 'Message not found' });
    }

    const updatedMessage = db.prepare('SELECT * FROM ai_messages WHERE id = ?').get(id);

    saveDatabase();

    res.json({ message: 'Reaction recorded', message: updatedMessage });
  } catch (error) {
    console.error('React to message error:', error);
    res.status(500).json({ error: 'Failed to record reaction' });
  }
};

exports.getFallbackMessages = async (req, res) => {
  try {
    await initDatabase();
    const db = getDb();
    
    const userId = req.user?.id;
    const { cultural_tag, message_type, language } = req.query;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get user's cultural profile if not provided
    let culturalTag = cultural_tag;
    if (!culturalTag) {
      const profileResult = db.prepare(
        'SELECT religious_affiliation FROM cultural_profiles WHERE user_id = ?'
      ).get(userId);
      if (profileResult) {
        culturalTag = profileResult.religious_affiliation || 'general';
      }
    }

    const stmt = db.prepare(
      `SELECT * FROM fallback_messages 
       WHERE is_active = 1 
       AND (? IS NULL OR cultural_tag = ? OR cultural_tag = 'general')
       AND (? IS NULL OR message_type = ?)
       AND (? IS NULL OR language = ?)
       ORDER BY RANDOM()`
    );
    const result = stmt.all(culturalTag, culturalTag, message_type, message_type, language || 'ar', language || 'ar');
    stmt.free();

    res.json({ messages: result });
  } catch (error) {
    console.error('Get fallback messages error:', error);
    res.status(500).json({ error: 'Failed to get fallback messages' });
  }
};

exports.generateAIMessage = async (req, res) => {
  try {
    await initDatabase();
    const db = getDb();
    
    const userId = req.user?.id;
    const { message_type } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get user profile
    const userResult = db.prepare(
      'SELECT participant_code FROM users WHERE id = ?'
    ).get(userId);
    
    if (!userResult) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userProfile = userResult;

    // Get cultural profile
    const culturalResult = db.prepare(
      'SELECT * FROM cultural_profiles WHERE user_id = ?'
    ).get(userId);
    
    const culturalProfile = culturalResult 
      ? culturalResult 
      : { religious_affiliation: 'general', family_importance_score: 3 };

    // Get today's activity
    const activityResult = db.prepare(
      `SELECT COALESCE(SUM(steps_count), 0) as steps, 
              COALESCE(SUM(mvpa_minutes), 0) as mvpa_minutes
       FROM activity_data 
       WHERE user_id = ? 
       AND date = date('now')`
    ).get(userId);

    const activityData = activityResult 
      ? activityResult 
      : { steps: 0, mvpa_minutes: 0 };

    // Generate AI message
    const message = await aiMessageService.generateMessage(
      culturalProfile,
      activityData,
      message_type || 'morning'
    );

    // Save message to database
    const insertStmt = db.prepare(
      `INSERT INTO ai_messages (user_id, message_content, message_type, is_ai_generated, sent_at)
       VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP)`
    );
    insertStmt.run(userId, message, message_type || 'morning');
    insertStmt.free();

    const insertedMessage = db.prepare('SELECT * FROM ai_messages WHERE id = ?').get(insertStmt.lastInsertRowid);

    saveDatabase();

    res.json({ message: insertedMessage });
  } catch (error) {
    console.error('Generate AI message error:', error);
    res.status(500).json({ error: 'Failed to generate AI message' });
  }
};