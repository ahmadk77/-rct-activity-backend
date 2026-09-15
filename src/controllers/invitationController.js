const { query, initDatabase } = require('../database/connection');
const crypto = require('crypto');

// Generate unique invitation code
const generateInviteCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

// Create new invitation
exports.createInvitation = async (req, res) => {
  try {
    await initDatabase();
    
    const { invitee_email, invitation_type = 'general' } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Check user's invitation limits (max 10 per week)
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    
    const recentInvites = await query(
      'SELECT COUNT(*) as count FROM invitations WHERE inviter_id = $1 AND created_at > $2',
      [userId, weekAgo]
    );

    if (recentInvites.rows[0].count >= 10) {
      return res.status(429).json({ error: 'Weekly invitation limit reached (10 per week)' });
    }

    // Generate unique invite code
    let inviteCode;
    let isUnique = false;
    let attempts = 0;

    while (!isUnique && attempts < 10) {
      inviteCode = generateInviteCode();
      const existing = await query('SELECT id FROM invitations WHERE invite_code = $1', [inviteCode]);
      if (existing.rows.length === 0) {
        isUnique = true;
      }
      attempts++;
    }

    if (!isUnique) {
      return res.status(500).json({ error: 'Failed to generate unique invite code' });
    }

    // Set expiration (7 days from now)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // Insert invitation
    const result = await query(
      `INSERT INTO invitations (inviter_id, invitee_email, invite_code, invitation_type, expires_at) 
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [userId, invitee_email, inviteCode, invitation_type, expiresAt]
    );

    const invitation = result.rows[0];

    // Log the invitation
    await query(
      'INSERT INTO audit_logs (action, table_name, new_value) VALUES ($1, $2, $3)',
      ['invitation_created', 'invitations', JSON.stringify({ userId, inviteCode })]
    );

    res.status(201).json({
      message: 'Invitation created successfully',
      invitation: {
        id: invitation.id,
        invite_code: invitation.invite_code,
        invite_link: `https://rct-activity.app/invite/${invitation.invite_code}`,
        invitation_type: invitation.invitation_type,
        expires_at: invitation.expires_at,
        status: invitation.status
      }
    });
  } catch (error) {
    console.error('Create invitation error:', error);
    res.status(500).json({ error: 'Failed to create invitation' });
  }
};

// Accept invitation
exports.acceptInvitation = async (req, res) => {
  try {
    await initDatabase();
    
    const { invite_code } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Find invitation
    const invitationResult = await query(
      'SELECT * FROM invitations WHERE invite_code = $1 AND status = $2',
      [invite_code, 'pending']
    );

    if (invitationResult.rows.length === 0) {
      return res.status(404).json({ error: 'Invalid or expired invitation' });
    }

    const invitation = invitationResult.rows[0];

    // Check if expired
    if (new Date() > new Date(invitation.expires_at)) {
      await query('UPDATE invitations SET status = $1 WHERE id = $2', ['expired', invitation.id]);
      return res.status(400).json({ error: 'Invitation has expired' });
    }

    // Update invitation status
    await query(
      `UPDATE invitations 
       SET status = $1, accepted_at = CURRENT_TIMESTAMP, accepted_by = $2, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $3`,
      ['accepted', userId, invitation.id]
    );

    // Award points to inviter (50 points)
    const rewardPoints = 50;
    await query(
      `UPDATE gamification 
       SET total_points = total_points + $1, weekly_points = weekly_points + $1, last_updated = CURRENT_TIMESTAMP 
       WHERE user_id = $2`,
      [rewardPoints, invitation.inviter_id]
    );

    // Update invitation with reward points
    await query(
      'UPDATE invitations SET reward_points = $1 WHERE id = $2',
      [rewardPoints, invitation.id]
    );

    // Log the acceptance
    await query(
      'INSERT INTO audit_logs (action, table_name, new_value) VALUES ($1, $2, $3)',
      ['invitation_accepted', 'invitations', JSON.stringify({ userId, invite_code, reward_points })]
    );

    res.json({
      message: 'Invitation accepted successfully',
      reward_points: rewardPoints
    });
  } catch (error) {
    console.error('Accept invitation error:', error);
    res.status(500).json({ error: 'Failed to accept invitation' });
  }
};

// Get user's invitations
exports.getUserInvitations = async (req, res) => {
  try {
    await initDatabase();
    
    const userId = req.user?.id;
    const { status } = req.query;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    let sql = 'SELECT * FROM invitations WHERE inviter_id = $1';
    const params = [userId];

    if (status) {
      sql += ' AND status = $2';
      params.push(status);
    }

    sql += ' ORDER BY created_at DESC';

    const result = await query(sql, params);

    res.json({ invitations: result.rows });
  } catch (error) {
    console.error('Get user invitations error:', error);
    res.status(500).json({ error: 'Failed to get invitations' });
  }
};

// Get invitation statistics
exports.getInvitationStats = async (req, res) => {
  try {
    await initDatabase();
    
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get statistics
    const totalInvites = await query(
      'SELECT COUNT(*) as count FROM invitations WHERE inviter_id = $1',
      [userId]
    );

    const acceptedInvites = await query(
      'SELECT COUNT(*) as count FROM invitations WHERE inviter_id = $1 AND status = $2',
      [userId, 'accepted']
    );

    const pendingInvites = await query(
      'SELECT COUNT(*) as count FROM invitations WHERE inviter_id = $1 AND status = $2',
      [userId, 'pending']
    );

    const expiredInvites = await query(
      'SELECT COUNT(*) as count FROM invitations WHERE inviter_id = $1 AND status = $2',
      [userId, 'expired']
    );

    const totalRewards = await query(
      'SELECT COALESCE(SUM(reward_points), 0) as total FROM invitations WHERE inviter_id = $1 AND status = $2',
      [userId, 'accepted']
    );

    // Weekly stats
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const weeklyInvites = await query(
      'SELECT COUNT(*) as count FROM invitations WHERE inviter_id = $1 AND created_at > $2',
      [userId, weekAgo]
    );

    const weeklyAccepted = await query(
      'SELECT COUNT(*) as count FROM invitations WHERE inviter_id = $1 AND status = $2 AND accepted_at > $3',
      [userId, 'accepted', weekAgo]
    );

    res.json({
      stats: {
        total_invitations: parseInt(totalInvites.rows[0].count),
        accepted_invitations: parseInt(acceptedInvites.rows[0].count),
        pending_invitations: parseInt(pendingInvites.rows[0].count),
        expired_invitations: parseInt(expiredInvites.rows[0].count),
        total_reward_points: parseInt(totalRewards.rows[0].total),
        weekly_invitations: parseInt(weeklyInvites.rows[0].count),
        weekly_accepted: parseInt(weeklyAccepted.rows[0].count),
        acceptance_rate: totalInvites.rows[0].count > 0 
          ? ((acceptedInvites.rows[0].count / totalInvites.rows[0].count) * 100).toFixed(2) + '%'
          : '0%'
      }
    });
  } catch (error) {
    console.error('Get invitation stats error:', error);
    res.status(500).json({ error: 'Failed to get invitation statistics' });
  }
};

// Revoke invitation
exports.revokeInvitation = async (req, res) => {
  try {
    await initDatabase();
    
    const { invite_code } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Check if user owns this invitation
    const invitation = await query(
      'SELECT * FROM invitations WHERE invite_code = $1 AND inviter_id = $2',
      [invite_code, userId]
    );

    if (invitation.rows.length === 0) {
      return res.status(404).json({ error: 'Invitation not found or not authorized' });
    }

    if (invitation.rows[0].status !== 'pending') {
      return res.status(400).json({ error: 'Can only revoke pending invitations' });
    }

    // Revoke invitation
    await query(
      'UPDATE invitations SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      ['revoked', invitation.rows[0].id]
    );

    // Log the revocation
    await query(
      'INSERT INTO audit_logs (action, table_name, new_value) VALUES ($1, $2, $3)',
      ['invitation_revoked', 'invitations', JSON.stringify({ userId, invite_code })]
    );

    res.json({ message: 'Invitation revoked successfully' });
  } catch (error) {
    console.error('Revoke invitation error:', error);
    res.status(500).json({ error: 'Failed to revoke invitation' });
  }
};

// Validate invitation code (for registration)
exports.validateInvitation = async (req, res) => {
  try {
    await initDatabase();
    
    const { invite_code } = req.params;

    const invitation = await query(
      'SELECT * FROM invitations WHERE invite_code = $1 AND status = $2',
      [invite_code, 'pending']
    );

    if (invitation.rows.length === 0) {
      return res.status(404).json({ error: 'Invalid invitation code' });
    }

    const inv = invitation.rows[0];

    // Check if expired
    if (new Date() > new Date(inv.expires_at)) {
      await query('UPDATE invitations SET status = $1 WHERE id = $2', ['expired', inv.id]);
      return res.status(400).json({ error: 'Invitation has expired' });
    }

    res.json({
      valid: true,
      invitation_type: inv.invitation_type,
      expires_at: inv.expires_at
    });
  } catch (error) {
    console.error('Validate invitation error:', error);
    res.status(500).json({ error: 'Failed to validate invitation' });
  }
};
