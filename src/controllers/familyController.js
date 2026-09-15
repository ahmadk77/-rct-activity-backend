const { query, initDatabase } = require('../database/connection');

exports.inviteSupporter = async (req, res) => {
  try {
    await initDatabase();
    
    const { coach_name, relationship, contact_method, contact_number } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Generate unique invite code
    const inviteCode = `INV${Date.now()}${Math.random().toString(36).substr(2, 9)}`;

    // Insert family coach invitation
    await query(
      'INSERT INTO family_coaches (user_id, coach_name, relationship, contact_method, contact_number, invitation_status, invite_code) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [userId, coach_name, relationship, contact_method, contact_number, 'pending', inviteCode]
    );

    // Log the invitation
    await query(
      'INSERT INTO audit_logs (action, table_name, new_value) VALUES ($1, $2, $3)',
      ['family_invitation_sent', 'family_coaches', JSON.stringify({ userId, coach_name, inviteCode })]
    );

    res.status(201).json({
      message: 'Invitation sent successfully',
      invite_code: inviteCode,
      invite_link: `https://rct-activity.app/invite/${inviteCode}`
    });
  } catch (error) {
    console.error('Family invitation error:', error);
    res.status(500).json({ error: 'Failed to send invitation' });
  }
};

exports.getFamilyCoaches = async (req, res) => {
  try {
    await initDatabase();
    
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const result = await query(
      'SELECT * FROM family_coaches WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );

    res.json({ coaches: result.rows });
  } catch (error) {
    console.error('Get family coaches error:', error);
    res.status(500).json({ error: 'Failed to get family coaches' });
  }
};

exports.submitInteraction = async (req, res) => {
  try {
    await initDatabase();
    
    const { coach_id, interaction_type, message_content } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Insert family interaction
    await query(
      'INSERT INTO family_interactions (user_id, coach_id, interaction_type, message_content) VALUES ($1, $2, $3, $4)',
      [userId, coach_id, interaction_type, message_content]
    );

    // Log the interaction
    await query(
      'INSERT INTO audit_logs (action, table_name, new_value) VALUES ($1, $2, $3)',
      ['family_interaction', 'family_interactions', JSON.stringify({ userId, coach_id })]
    );

    res.status(201).json({
      message: 'Interaction recorded successfully'
    });
  } catch (error) {
    console.error('Family interaction error:', error);
    res.status(500).json({ error: 'Failed to record interaction' });
  }
};

exports.getWeeklyRankings = async (req, res) => {
  try {
    await initDatabase();
    
    const userId = req.user?.id;
    const { week_number, year } = req.query;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const currentWeek = week_number || getWeekNumber(new Date());
    const currentYear = year || new Date().getFullYear();

    const result = await query(
      'SELECT * FROM weekly_family_rankings WHERE week_number = $1 AND year = $2 ORDER BY rank_position ASC',
      [currentWeek, currentYear]
    );

    res.json({ rankings: result.rows });
  } catch (error) {
    console.error('Get weekly rankings error:', error);
    res.status(500).json({ error: 'Failed to get weekly rankings' });
  }
};

function getWeekNumber(d) {
  d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return weekNo;
}