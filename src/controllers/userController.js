const { query, initDatabase } = require('../database/connection');

exports.getProfile = async (req, res) => {
  try {
    await initDatabase();
    const userId = req.user?.id;

    const result = await query(
      'SELECT id, participant_code, email, language, created_at FROM users WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user: result.rows[0] });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to get profile' });
  }
};

exports.updateCulturalProfile = async (req, res) => {
  try {
    await initDatabase();
    const userId = req.user?.id;
    const {
      age_range,
      residence_location,
      health_status,
      smartwatch_type,
      religious_affiliation,
      female_trainer_preference,
      family_importance_score,
      personal_preferences
    } = req.body;

    const result = await query(
      `INSERT INTO cultural_profiles 
       (user_id, age_range, residence_location, health_status, smartwatch_type, 
        religious_affiliation, female_trainer_preference, family_importance_score, personal_preferences)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (user_id) DO UPDATE SET
         age_range = EXCLUDED.age_range,
         residence_location = EXCLUDED.residence_location,
         health_status = EXCLUDED.health_status,
         smartwatch_type = EXCLUDED.smartwatch_type,
         religious_affiliation = EXCLUDED.religious_affiliation,
         female_trainer_preference = EXCLUDED.female_trainer_preference,
         family_importance_score = EXCLUDED.family_importance_score,
         personal_preferences = EXCLUDED.personal_preferences
       RETURNING *`,
      [userId, age_range, residence_location, health_status, smartwatch_type,
       religious_affiliation, female_trainer_preference, family_importance_score, personal_preferences]
    );

    // Log for research
    await query(
      'INSERT INTO audit_logs (action, table_name, record_id, user_id, new_value) VALUES ($1, $2, $3, $4, $5)',
      ['cultural_profile_updated', 'cultural_profiles', result.rows[0].id, userId, JSON.stringify(req.body)]
    );

    res.json({ message: 'Cultural profile updated', profile: result.rows[0] });
  } catch (error) {
    console.error('Update cultural profile error:', error);
    res.status(500).json({ error: 'Failed to update cultural profile' });
  }
};

exports.getCulturalProfile = async (req, res) => {
  try {
    await initDatabase();
    const userId = req.user?.id;

    const result = await query(
      'SELECT * FROM cultural_profiles WHERE user_id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Cultural profile not found' });
    }

    res.json({ profile: result.rows[0] });
  } catch (error) {
    console.error('Get cultural profile error:', error);
    res.status(500).json({ error: 'Failed to get cultural profile' });
  }
};

exports.updateLanguage = async (req, res) => {
  try {
    await initDatabase();
    const userId = req.user?.id;
    const { language } = req.body;

    if (!['ar', 'en'].includes(language)) {
      return res.status(400).json({ error: 'Invalid language' });
    }

    await query(
      'UPDATE users SET language = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [language, userId]
    );

    res.json({ message: 'Language updated successfully' });
  } catch (error) {
    console.error('Update language error:', error);
    res.status(500).json({ error: 'Failed to update language' });
  }
};
