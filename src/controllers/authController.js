const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { query, initDatabase } = require('../database/connection');

// Generate participant code (P001, P002, etc.)
const generateParticipantCode = async () => {
  const result = await query('SELECT COUNT(*) as count FROM users');
  const count = result.rows[0].count + 1;
  return `P${String(count).padStart(3, '0')}`;
};

exports.register = async (req, res) => {
  try {
    await initDatabase();
    
    const { email, password, language = 'ar', invite_code } = req.body;

    // Check if user already exists
    const existingUser = await query('SELECT id FROM users WHERE email = $1', [email]);

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Generate participant code
    const participantCode = await generateParticipantCode();

    // Insert user
    const result = await query(
      'INSERT INTO users (email, password_hash, language, participant_code) VALUES ($1, $2, $3, $4) RETURNING id, participant_code, email, language',
      [email, passwordHash, language, participantCode]
    );

    const userId = result.rows[0].id;
    const user = {
      id: userId,
      participant_code: participantCode,
      email: email,
      language: language
    };

    // If invite code provided, accept the invitation
    let inviterInfo = null;
    if (invite_code) {
      const invitation = await query(
        'SELECT * FROM invitations WHERE invite_code = $1 AND status = $2',
        [invite_code, 'pending']
      );

      if (invitation.rows.length > 0) {
        const inv = invitation.rows[0];

        // Check if expired
        if (new Date() <= new Date(inv.expires_at)) {
          // Update invitation status
          await query(
            `UPDATE invitations 
             SET status = $1, accepted_at = CURRENT_TIMESTAMP, accepted_by = $2, updated_at = CURRENT_TIMESTAMP 
             WHERE id = $3`,
            ['accepted', userId, inv.id]
          );

          // Award points to inviter
          const rewardPoints = 50;
          await query(
            `UPDATE gamification 
             SET total_points = total_points + $1, weekly_points = weekly_points + $1, last_updated = CURRENT_TIMESTAMP 
             WHERE user_id = $2`,
            [rewardPoints, inv.inviter_id]
          );

          // Update invitation with reward points
          await query(
            'UPDATE invitations SET reward_points = $1 WHERE id = $2',
            [rewardPoints, inv.id]
          );

          // Get inviter info
          const inviterResult = await query(
            'SELECT id, email, participant_code FROM users WHERE id = $1',
            [inv.inviter_id]
          );

          if (inviterResult.rows.length > 0) {
            inviterInfo = inviterResult.rows[0];
          }

          // Log the acceptance
          await query(
            'INSERT INTO audit_logs (action, table_name, new_value) VALUES ($1, $2, $3)',
            ['invitation_accepted_via_register', 'invitations', JSON.stringify({ userId, invite_code, rewardPoints })]
          );
        }
      }
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: userId, participantCode: user.participant_code },
      process.env.JWT_SECRET || 'default_secret_key',
      { expiresIn: process.env.JWT_EXPIRE || '7d' }
    );

    res.status(201).json({
      message: 'Registration successful',
      user: user,
      inviter: inviterInfo,
      token
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
};

exports.login = async (req, res) => {
  try {
    await initDatabase();
    
    const { email, password } = req.body;

    // Find user
    const result = await query('SELECT * FROM users WHERE email = $1 AND is_active = true', [email]);

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);

    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, participantCode: user.participant_code },
      process.env.JWT_SECRET || 'default_secret_key',
      { expiresIn: process.env.JWT_EXPIRE || '7d' }
    );

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        participantCode: user.participant_code,
        email: user.email,
        language: user.language
      },
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
};

exports.submitConsent = async (req, res) => {
  try {
    await initDatabase();
    
    const { participant_code, consented } = req.body;

    // Update user consent status
    await query('UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE participant_code = $1', [participant_code]);

    // Log consent submission
    await query(
      'INSERT INTO audit_logs (action, table_name, new_value) VALUES ($1, $2, $3)',
      ['consent_submitted', 'users', JSON.stringify({ participant_code, consented })]
    );

    res.json({ message: 'Consent submitted successfully' });
  } catch (error) {
    console.error('Consent submission error:', error);
    res.status(500).json({ error: 'Consent submission failed' });
  }
};

exports.refreshToken = async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Token required' });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default_secret_key');

    // Generate new token
    const newToken = jwt.sign(
      { userId: decoded.userId, participantCode: decoded.participantCode },
      process.env.JWT_SECRET || 'default_secret_key',
      { expiresIn: process.env.JWT_EXPIRE || '7d' }
    );

    res.json({ token: newToken });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
};
