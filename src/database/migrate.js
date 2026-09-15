const { query, initDatabase } = require('./connection');

async function runMigrations() {
  try {
    console.log('Starting PostgreSQL database migration...');

    // Wait for database to be initialized
    await initDatabase();

    console.log('Database initialized, creating tables...');

    // Create tables using PostgreSQL syntax
    const tables = [
      // Users Table
      `CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        participant_code VARCHAR(20) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        language VARCHAR(10) DEFAULT 'ar',
        fcm_token TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_active BOOLEAN DEFAULT true
      )`,

      // Cultural Profile
      `CREATE TABLE IF NOT EXISTS cultural_profiles (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        age_range VARCHAR(10),
        residence_location VARCHAR(50),
        health_status TEXT,
        smartwatch_type VARCHAR(50),
        religious_affiliation VARCHAR(50),
        female_trainer_preference BOOLEAN DEFAULT false,
        family_importance_score INTEGER CHECK (family_importance_score BETWEEN 1 AND 5),
        personal_preferences TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,

      // Family Coach
      `CREATE TABLE IF NOT EXISTS family_coaches (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        coach_name VARCHAR(255) NOT NULL,
        relationship VARCHAR(100),
        contact_method VARCHAR(20),
        contact_number VARCHAR(20),
        invitation_status VARCHAR(20) DEFAULT 'pending',
        invite_code VARCHAR(50) UNIQUE,
        invited_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        accepted_at TIMESTAMP
      )`,

      // Invitations Table - Enhanced invitation system
      `CREATE TABLE IF NOT EXISTS invitations (
        id SERIAL PRIMARY KEY,
        inviter_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        invitee_email VARCHAR(255),
        invite_code VARCHAR(20) UNIQUE NOT NULL,
        invitation_type VARCHAR(20) DEFAULT 'family', -- 'family', 'friend', 'general'
        status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'accepted', 'expired', 'revoked'
        expires_at TIMESTAMP NOT NULL,
        accepted_at TIMESTAMP,
        accepted_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        reward_points INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,

      // Reactions Table - Emoji reactions between users
      `CREATE TABLE IF NOT EXISTS reactions (
        id SERIAL PRIMARY KEY,
        sender_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        receiver_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        emoji VARCHAR(50) NOT NULL,
        reaction_type VARCHAR(20) DEFAULT 'encouragement', -- 'encouragement', 'celebration', 'support'
        context_type VARCHAR(20), -- 'progress', 'achievement', 'general'
        context_id INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_read BOOLEAN DEFAULT false
      )`,

      // Smartwatch Connections
      `CREATE TABLE IF NOT EXISTS smartwatch_connections (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        provider VARCHAR(50) NOT NULL,
        access_token TEXT,
        refresh_token TEXT,
        token_expires_at TIMESTAMP,
        last_sync_at TIMESTAMP,
        is_active BOOLEAN DEFAULT true,
        connected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,

      // Activity Data
      `CREATE TABLE IF NOT EXISTS activity_data (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        date DATE NOT NULL,
        steps_count INTEGER DEFAULT 0,
        mvpa_minutes INTEGER DEFAULT 0,
        calories_burned INTEGER DEFAULT 0,
        heart_rate_avg INTEGER,
        sync_source VARCHAR(50),
        synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        uuid UUID DEFAULT gen_random_uuid(),
        pending_sync BOOLEAN DEFAULT false,
        UNIQUE(user_id, date, uuid)
      )`,

      // Gamification
      `CREATE TABLE IF NOT EXISTS gamification (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        total_points INTEGER DEFAULT 0,
        current_level VARCHAR(20) DEFAULT 'bronze',
        weekly_points INTEGER DEFAULT 0,
        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id)
      )`,

      // Achievements
      `CREATE TABLE IF NOT EXISTS achievements (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        achievement_type VARCHAR(50) NOT NULL,
        achievement_value INTEGER,
        achieved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        certificate_url TEXT
      )`,

      // AI Messages
      `CREATE TABLE IF NOT EXISTS ai_messages (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        message_content TEXT NOT NULL,
        message_type VARCHAR(20),
        is_ai_generated BOOLEAN DEFAULT true,
        sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        read_at TIMESTAMP,
        reaction VARCHAR(20)
      )`,

      // Fallback Messages
      `CREATE TABLE IF NOT EXISTS fallback_messages (
        id SERIAL PRIMARY KEY,
        cultural_tag VARCHAR(50),
        message_type VARCHAR(20),
        message_content TEXT NOT NULL,
        language VARCHAR(10) DEFAULT 'ar',
        is_active BOOLEAN DEFAULT true
      )`,

      // Exercise Media
      `CREATE TABLE IF NOT EXISTS exercise_media (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        media_type VARCHAR(20) NOT NULL,
        media_url TEXT NOT NULL,
        thumbnail_url TEXT,
        duration_seconds INTEGER,
        cultural_tags TEXT,
        difficulty_level VARCHAR(20),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,

      // User Exercise Progress
      `CREATE TABLE IF NOT EXISTS user_exercise_progress (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        exercise_id INTEGER REFERENCES exercise_media(id) ON DELETE CASCADE,
        completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        duration_completed INTEGER,
        uuid UUID DEFAULT gen_random_uuid(),
        pending_sync BOOLEAN DEFAULT false
      )`,

      // Feature Flags
      `CREATE TABLE IF NOT EXISTS feature_flags (
        id SERIAL PRIMARY KEY,
        feature_name VARCHAR(100) UNIQUE NOT NULL,
        is_enabled BOOLEAN DEFAULT true,
        target_group VARCHAR(50),
        target_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        changed_by VARCHAR(100),
        changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        reason TEXT
      )`,

      // Sync Queue
      `CREATE TABLE IF NOT EXISTS sync_queue (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        operation_type VARCHAR(50) NOT NULL,
        table_name VARCHAR(50) NOT NULL,
        payload JSONB,
        uuid UUID DEFAULT gen_random_uuid() NOT NULL,
        status VARCHAR(20) DEFAULT 'pending',
        retry_count INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        synced_at TIMESTAMP,
        error_message TEXT
      )`,

      // Audit Logs
      `CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        action VARCHAR(100) NOT NULL,
        table_name VARCHAR(50),
        record_id INTEGER,
        old_value JSONB,
        new_value JSONB,
        ip_address VARCHAR(45),
        user_agent TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,

      // Family Interactions
      `CREATE TABLE IF NOT EXISTS family_interactions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        coach_id INTEGER REFERENCES family_coaches(id) ON DELETE CASCADE,
        interaction_type VARCHAR(20) NOT NULL,
        message_content TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,

      // Weekly Family Rankings
      `CREATE TABLE IF NOT EXISTS weekly_family_rankings (
        id SERIAL PRIMARY KEY,
        family_group_id VARCHAR(50),
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        week_number INTEGER NOT NULL,
        year INTEGER NOT NULL,
        steps_count INTEGER DEFAULT 0,
        rank_position INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, week_number, year)
      )`,

      // Push Notifications
      `CREATE TABLE IF NOT EXISTS push_notifications (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        notification_type VARCHAR(50) NOT NULL,
        title VARCHAR(255),
        body TEXT,
        payload JSONB,
        sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        read_at TIMESTAMP,
        delivered BOOLEAN DEFAULT false
      )`,

      // Consent Records
      `CREATE TABLE IF NOT EXISTS consent_records (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        consent_version VARCHAR(20) NOT NULL,
        consent_text TEXT NOT NULL,
        agreed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        ip_address VARCHAR(45),
        user_agent TEXT
      )`,

      // Screening Surveys
      `CREATE TABLE IF NOT EXISTS screening_surveys (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        age INTEGER CHECK (age BETWEEN 18 AND 65),
        residence_malaysia BOOLEAN,
        residence_type VARCHAR(20),
        health_concerns TEXT,
        smartwatch_type VARCHAR(50),
        completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,

      // Certificates
      `CREATE TABLE IF NOT EXISTS certificates (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        certificate_type VARCHAR(50) NOT NULL,
        certificate_url TEXT,
        generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        issued_at TIMESTAMP
      )`
    ];

    for (const table of tables) {
      await query(table);
      console.log('Created table successfully');
    }

    // Create indexes
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_activity_data_user_date ON activity_data(user_id, date)',
      'CREATE INDEX IF NOT EXISTS idx_activity_data_uuid ON activity_data(uuid)',
      'CREATE INDEX IF NOT EXISTS idx_sync_queue_user_status ON sync_queue(user_id, status)',
      'CREATE INDEX IF NOT EXISTS idx_ai_messages_user ON ai_messages(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_feature_flags_name ON feature_flags(feature_name)',
      'CREATE INDEX IF NOT EXISTS idx_family_interactions_user ON family_interactions(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_weekly_rankings_week ON weekly_family_rankings(week_number, year)',
      'CREATE INDEX IF NOT EXISTS idx_push_notifications_user ON push_notifications(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_screening_surveys_user ON screening_surveys(user_id)',
    ];

    for (const index of indexes) {
      await query(index);
      console.log('Created index successfully');
    }

    // Insert sample data
    await insertSampleData();

    console.log('Migration completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

async function insertSampleData() {
  // Insert comprehensive exercise library
  const exercises = [
    // Beginner - Warmup
    {
      title: 'تمارين إحماء للمبتدئين',
      media_type: 'youtube',
      media_url: 'https://www.youtube.com/watch?v=ml6cT5AZb1M',
      thumbnail_url: 'https://img.youtube.com/vi/ml6cT5AZb1M/0.jpg',
      duration_seconds: 600,
      cultural_tags: 'beginner,warmup,home',
      difficulty_level: 'beginner'
    },
    {
      title: 'إحماء كامل للجسم',
      media_type: 'youtube',
      media_url: 'https://www.youtube.com/watch?v=-5qQrL7uK5A',
      thumbnail_url: 'https://img.youtube.com/vi/-5qQrL7uK5A/0.jpg',
      duration_seconds: 480,
      cultural_tags: 'beginner,warmup,home',
      difficulty_level: 'beginner'
    },
    // Beginner - Stretching
    {
      title: 'تمارين الإطالة والاسترخاء',
      media_type: 'youtube',
      media_url: 'https://www.youtube.com/watch?v=f7XMoOvpE3M',
      thumbnail_url: 'https://img.youtube.com/vi/f7XMoOvpE3M/0.jpg',
      duration_seconds: 720,
      cultural_tags: 'beginner,stretching,relaxation,home',
      difficulty_level: 'beginner'
    },
    {
      title: 'إطالة للمبتدئين',
      media_type: 'youtube',
      media_url: 'https://www.youtube.com/watch?v=Z5-0rYv9NpY',
      thumbnail_url: 'https://img.youtube.com/vi/Z5-0rYv9NpY/0.jpg',
      duration_seconds: 900,
      cultural_tags: 'beginner,stretching,home',
      difficulty_level: 'beginner'
    },
    // Intermediate - Strength
    {
      title: 'تمارين القوة في المنزل',
      media_type: 'youtube',
      media_url: 'https://www.youtube.com/watch?v=IODxDxX7oi4',
      thumbnail_url: 'https://img.youtube.com/vi/IODxDxX7oi4/0.jpg',
      duration_seconds: 900,
      cultural_tags: 'intermediate,strength,home',
      difficulty_level: 'intermediate'
    },
    {
      title: 'تمارين البطن',
      media_type: 'youtube',
      media_url: 'https://www.youtube.com/watch?v=2PYS6TgNE8A',
      thumbnail_url: 'https://img.youtube.com/vi/2PYS6TgNE8A/0.jpg',
      duration_seconds: 900,
      cultural_tags: 'intermediate,abs,core,home',
      difficulty_level: 'intermediate'
    },
    {
      title: 'تمارين الذراعين بدون معدات',
      media_type: 'youtube',
      media_url: 'https://www.youtube.com/watch?v=eM895z2pL8w',
      thumbnail_url: 'https://img.youtube.com/vi/eM895z2pL8w/0.jpg',
      duration_seconds: 720,
      cultural_tags: 'intermediate,strength,home',
      difficulty_level: 'intermediate'
    },
    {
      title: 'تمارين الساقين',
      media_type: 'youtube',
      media_url: 'https://www.youtube.com/watch?v=CLLj3t2eS3k',
      thumbnail_url: 'https://img.youtube.com/vi/CLLj3t2eS3k/0.jpg',
      duration_seconds: 840,
      cultural_tags: 'intermediate,strength,legs,home',
      difficulty_level: 'intermediate'
    },
    // Advanced - Cardio
    {
      title: 'تمارين الكارديو',
      media_type: 'youtube',
      media_url: 'https://www.youtube.com/watch?v=Tzo4M9F8kOk',
      thumbnail_url: 'https://img.youtube.com/vi/Tzo4M9F8kOk/0.jpg',
      duration_seconds: 1200,
      cultural_tags: 'advanced,cardio,home',
      difficulty_level: 'advanced'
    },
    {
      title: 'HIIT للإحراق السريع',
      media_type: 'youtube',
      media_url: 'https://www.youtube.com/watch?v=ml6cT5AZb1M',
      thumbnail_url: 'https://img.youtube.com/vi/ml6cT5AZb1M/0.jpg',
      duration_seconds: 900,
      cultural_tags: 'advanced,cardio,hiit,home',
      difficulty_level: 'advanced'
    },
    {
      title: 'تمارين القفز والسرعة',
      media_type: 'youtube',
      media_url: 'https://www.youtube.com/watch?v=8g0vNj-3Oqg',
      thumbnail_url: 'https://img.youtube.com/vi/8g0vNj-3Oqg/0.jpg',
      duration_seconds: 600,
      cultural_tags: 'advanced,cardio,plyometric,home',
      difficulty_level: 'advanced'
    },
    // Yoga/Flexibility
    {
      title: 'يوغا للمبتدئين',
      media_type: 'youtube',
      media_url: 'https://www.youtube.com/watch?v=v7AYKMP6rOE',
      thumbnail_url: 'https://img.youtube.com/vi/v7AYKMP6rOE/0.jpg',
      duration_seconds: 1200,
      cultural_tags: 'beginner,yoga,flexibility,home',
      difficulty_level: 'beginner'
    },
    {
      title: 'يوغا متوسطة',
      media_type: 'youtube',
      media_url: 'https://www.youtube.com/watch?v=sTANio_2E0Q',
      thumbnail_url: 'https://img.youtube.com/vi/sTANio_2E0Q/0.jpg',
      duration_seconds: 1080,
      cultural_tags: 'intermediate,yoga,flexibility,home',
      difficulty_level: 'intermediate'
    },
    // Full Body
    {
      title: 'تمرين كامل للجسم',
      media_type: 'youtube',
      media_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      thumbnail_url: 'https://img.youtube.com/vi/dQw4w9WgXcQ/0.jpg',
      duration_seconds: 1500,
      cultural_tags: 'intermediate,fullbody,home',
      difficulty_level: 'intermediate'
    },
    {
      title: 'تمرين 30 دقيقة للجسم',
      media_type: 'youtube',
      media_url: 'https://www.youtube.com/watch?v=j5yNoONnIe0',
      thumbnail_url: 'https://img.youtube.com/vi/j5yNoONnIe0/0.jpg',
      duration_seconds: 1800,
      cultural_tags: 'advanced,fullbody,home',
      difficulty_level: 'advanced'
    },
    // Walking/Low Impact
    {
      title: 'تمارين المشي في المكان',
      media_type: 'youtube',
      media_url: 'https://www.youtube.com/watch?v=6w-9v8Z3X3c',
      thumbnail_url: 'https://img.youtube.com/vi/6w-9v8Z3X3c/0.jpg',
      duration_seconds: 1200,
      cultural_tags: 'beginner,lowimpact,walking,home',
      difficulty_level: 'beginner'
    },
    {
      title: 'تمارين جلوسية للكبار',
      media_type: 'youtube',
      media_url: 'https://www.youtube.com/watch?v=ea-0r2pQ1DQ',
      thumbnail_url: 'https://img.youtube.com/vi/ea-0r2pQ1DQ/0.jpg',
      duration_seconds: 900,
      cultural_tags: 'beginner,lowimpact,seated,home',
      difficulty_level: 'beginner'
    }
  ];

  for (const exercise of exercises) {
    await query(
      `INSERT INTO exercise_media (title, media_type, media_url, thumbnail_url, duration_seconds, cultural_tags, difficulty_level) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) 
       ON CONFLICT DO NOTHING`,
      [exercise.title, exercise.media_type, exercise.media_url, exercise.thumbnail_url,
       exercise.duration_seconds, exercise.cultural_tags, exercise.difficulty_level]
    );
  }
  console.log('Inserted exercises successfully');

  // Insert fallback messages
  const messages = [
    { cultural_tag: 'islam', message_type: 'morning', message_content: 'بسم الله الرحمن الرحيم، ابدأ يومك بحركة بسيطة واحتسبها عبادة.', language: 'ar' },
    { cultural_tag: 'islam', message_type: 'noon', message_content: 'استمر في جهودك! الحركة في منتصف اليوم تزيد من طاقتك للعبادة.', language: 'ar' },
    { cultural_tag: 'islam', message_type: 'evening', message_content: 'أحسنت على مجهودك اليوم! غداً يوم جديد لزيادة نشاطك.', language: 'ar' },
    { cultural_tag: 'general', message_type: 'morning', message_content: 'صباح الخير! ابدأ يومك بحركة بسيطة لزيادة طاقتك.', language: 'ar' },
    { cultural_tag: 'general', message_type: 'noon', message_content: 'وقت رائع للتحرك قليلاً حتى لو كانت خطوات قليلة.', language: 'ar' },
    { cultural_tag: 'general', message_type: 'evening', message_content: 'عمل جيد اليوم! كل خطوة مهمة.', language: 'ar' },
    { cultural_tag: 'islam', message_type: 'morning', message_content: 'Start your day with movement and count it as worship.', language: 'en' },
    { cultural_tag: 'islam', message_type: 'noon', message_content: 'Keep going! Movement at midday increases your energy for worship.', language: 'en' },
    { cultural_tag: 'islam', message_type: 'evening', message_content: 'Well done on your effort today! Tomorrow is a new day to increase activity.', language: 'en' },
    { cultural_tag: 'general', message_type: 'morning', message_content: 'Good morning! Start your day with simple movement to boost energy.', language: 'en' },
    { cultural_tag: 'general', message_type: 'noon', message_content: 'Great time to move a little, even if just a few steps.', language: 'en' },
    { cultural_tag: 'general', message_type: 'evening', message_content: 'Good work today! Every step matters.', language: 'en' }
  ];

  for (const message of messages) {
    await query(
      `INSERT INTO fallback_messages (cultural_tag, message_type, message_content, language) 
       VALUES ($1, $2, $3, $4) 
       ON CONFLICT DO NOTHING`,
      [message.cultural_tag, message.message_type, message.message_content, message.language]
    );
  }
  console.log('Inserted fallback messages successfully');

  // Insert feature flags
  const featureFlags = [
    { feature_name: 'smartwatch_sync', is_enabled: true, target_group: 'all' },
    { feature_name: 'points_system', is_enabled: true, target_group: 'all' },
    { feature_name: 'badges_ranks', is_enabled: true, target_group: 'all' },
    { feature_name: 'certificates', is_enabled: true, target_group: 'all' },
    { feature_name: 'family_module', is_enabled: true, target_group: 'all' },
    { feature_name: 'family_ranking', is_enabled: true, target_group: 'all' },
    { feature_name: 'ai_messages', is_enabled: true, target_group: 'all' },
    { feature_name: 'morning_notifications', is_enabled: true, target_group: 'all' },
    { feature_name: 'noon_notifications', is_enabled: true, target_group: 'all' },
    { feature_name: 'evening_notifications', is_enabled: true, target_group: 'all' },
    { feature_name: 'video_library', is_enabled: true, target_group: 'all' },
    { feature_name: 'female_only_content', is_enabled: true, target_group: 'all' },
    { feature_name: 'offline_mode', is_enabled: true, target_group: 'all' },
    { feature_name: 'push_notifications', is_enabled: true, target_group: 'all' }
  ];

  for (const flag of featureFlags) {
    await query(
      `INSERT INTO feature_flags (feature_name, is_enabled, target_group) 
       VALUES ($1, $2, $3) 
       ON CONFLICT (feature_name) DO UPDATE SET is_enabled = $2, target_group = $3`,
      [flag.feature_name, flag.is_enabled, flag.target_group]
    );
  }
  console.log('Inserted feature flags successfully');
}

runMigrations();