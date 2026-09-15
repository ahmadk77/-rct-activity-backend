-- Users Table (De-identified)
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  participant_code VARCHAR(20) UNIQUE NOT NULL, -- P001, P002, etc.
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  language VARCHAR(10) DEFAULT 'ar', -- 'ar' or 'en'
  fcm_token TEXT, -- Firebase Cloud Messaging token
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT true
);

-- Cultural Profile
CREATE TABLE IF NOT EXISTS cultural_profiles (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  age_range VARCHAR(10), -- '18-25', '26-35', etc.
  residence_location VARCHAR(50), -- 'urban', 'rural'
  health_status TEXT,
  smartwatch_type VARCHAR(50), -- 'apple', 'fitbit', 'garmin', 'google', 'none'
  religious_affiliation VARCHAR(50), -- 'islam', 'buddhist', 'hindu', 'christian', 'none'
  female_trainer_preference BOOLEAN DEFAULT false,
  family_importance_score INTEGER CHECK (family_importance_score BETWEEN 1 AND 5),
  personal_preferences TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Family Coach (Support System)
CREATE TABLE IF NOT EXISTS family_coaches (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  coach_name VARCHAR(255) NOT NULL,
  relationship VARCHAR(100),
  contact_method VARCHAR(20), -- 'whatsapp', 'sms'
  contact_number VARCHAR(20),
  invitation_status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'accepted', 'declined'
  invited_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  accepted_at TIMESTAMP
);

-- Smartwatch Integration
CREATE TABLE IF NOT EXISTS smartwatch_connections (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL, -- 'apple', 'google', 'fitbit', 'garmin'
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMP,
  last_sync_at TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  connected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Activity Data (MVPA - Moderate-to-Vigorous Physical Activity)
CREATE TABLE IF NOT EXISTS activity_data (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  steps_count INTEGER DEFAULT 0,
  mvpa_minutes INTEGER DEFAULT 0, -- Moderate-to-Vigorous Physical Activity minutes
  calories_burned INTEGER DEFAULT 0,
  heart_rate_avg INTEGER,
  sync_source VARCHAR(50), -- 'smartwatch', 'manual'
  synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  uuid UUID DEFAULT gen_random_uuid(), -- For idempotency
  pending_sync BOOLEAN DEFAULT false,
  UNIQUE(user_id, date, uuid)
);

-- Gamification - Points and Levels
CREATE TABLE IF NOT EXISTS gamification (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  total_points INTEGER DEFAULT 0,
  current_level VARCHAR(20) DEFAULT 'bronze', -- 'bronze', 'silver', 'gold', 'legendary'
  weekly_points INTEGER DEFAULT 0,
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id)
);

-- Achievements
CREATE TABLE IF NOT EXISTS achievements (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  achievement_type VARCHAR(50) NOT NULL, -- 'daily_steps', 'weekly_mvpa', 'messages_completed'
  achievement_value INTEGER,
  achieved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  certificate_url TEXT
);

-- AI Messages (Personalized Motivational Messages)
CREATE TABLE IF NOT EXISTS ai_messages (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  message_content TEXT NOT NULL,
  message_type VARCHAR(20), -- 'morning', 'noon', 'evening'
  is_ai_generated BOOLEAN DEFAULT true,
  sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  read_at TIMESTAMP,
  reaction VARCHAR(20) -- 'like', 'love', 'close'
);

-- Fallback Messages (Static pool for when AI is disabled)
CREATE TABLE IF NOT EXISTS fallback_messages (
  id SERIAL PRIMARY KEY,
  cultural_tag VARCHAR(50), -- 'islam', 'buddhist', 'general'
  message_type VARCHAR(20), -- 'morning', 'noon', 'evening'
  message_content TEXT NOT NULL,
  language VARCHAR(10) DEFAULT 'ar',
  is_active BOOLEAN DEFAULT true
);

-- Exercise Media Library
CREATE TABLE IF NOT EXISTS exercise_media (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  media_type VARCHAR(20) NOT NULL, -- 'youtube', 'gif'
  media_url TEXT NOT NULL,
  thumbnail_url TEXT,
  duration_seconds INTEGER,
  cultural_tags TEXT[], -- Array of tags like ['female-only', 'moderate', 'home']
  difficulty_level VARCHAR(20), -- 'beginner', 'intermediate', 'advanced'
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User Exercise Progress
CREATE TABLE IF NOT EXISTS user_exercise_progress (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  exercise_id INTEGER REFERENCES exercise_media(id) ON DELETE CASCADE,
  completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  duration_completed INTEGER,
  uuid UUID DEFAULT gen_random_uuid(),
  pending_sync BOOLEAN DEFAULT false
);

-- Feature Flags (Remote Configuration)
CREATE TABLE IF NOT EXISTS feature_flags (
  id SERIAL PRIMARY KEY,
  feature_name VARCHAR(100) UNIQUE NOT NULL,
  is_enabled BOOLEAN DEFAULT true,
  target_group VARCHAR(50), -- 'all', 'control', 'treatment', 'specific_user'
  target_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  changed_by VARCHAR(100),
  changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  reason TEXT
);

-- Sync Queue (For offline support)
CREATE TABLE IF NOT EXISTS sync_queue (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  operation_type VARCHAR(50) NOT NULL, -- 'create', 'update', 'delete'
  table_name VARCHAR(50) NOT NULL,
  payload JSONB NOT NULL,
  uuid UUID DEFAULT gen_random_uuid() NOT NULL,
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'synced', 'failed'
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  synced_at TIMESTAMP,
  error_message TEXT
);

-- Audit Logs (For research integrity)
CREATE TABLE IF NOT EXISTS audit_logs (
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
);

-- Family Interactions (Supporter reactions)
CREATE TABLE IF NOT EXISTS family_interactions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  coach_id INTEGER REFERENCES family_coaches(id) ON DELETE CASCADE,
  interaction_type VARCHAR(20) NOT NULL, -- 'clap', 'love', 'celebrate', 'message'
  message_content TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Weekly Family Rankings
CREATE TABLE IF NOT EXISTS weekly_family_rankings (
  id SERIAL PRIMARY KEY,
  family_group_id VARCHAR(50), -- Group family members together
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  week_number INTEGER NOT NULL,
  year INTEGER NOT NULL,
  steps_count INTEGER DEFAULT 0,
  rank_position INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, week_number, year)
);

-- Push Notifications
CREATE TABLE IF NOT EXISTS push_notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  notification_type VARCHAR(50) NOT NULL, -- 'message', 'family_interaction', 'achievement', 'reminder'
  title VARCHAR(255),
  body TEXT,
  payload JSONB,
  sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  read_at TIMESTAMP,
  delivered BOOLEAN DEFAULT false
);

-- Consent Records (e-Consent tracking)
CREATE TABLE IF NOT EXISTS consent_records (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  consent_version VARCHAR(20) NOT NULL,
  consent_text TEXT NOT NULL,
  agreed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ip_address VARCHAR(45),
  user_agent TEXT
);

-- Screening Survey Results
CREATE TABLE IF NOT EXISTS screening_surveys (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  age INTEGER CHECK (age BETWEEN 18 AND 65),
  residence_malaysia BOOLEAN,
  residence_type VARCHAR(20), -- 'urban', 'rural'
  health_concerns TEXT,
  smartwatch_type VARCHAR(50),
  completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Certificates (PDF generation records)
CREATE TABLE IF NOT EXISTS certificates (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  certificate_type VARCHAR(50) NOT NULL, -- 'weekly_gold', 'completion', 'achievement'
  certificate_url TEXT,
  generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  issued_at TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_activity_data_user_date ON activity_data(user_id, date);
CREATE INDEX IF NOT EXISTS idx_activity_data_uuid ON activity_data(uuid);
CREATE INDEX IF NOT EXISTS idx_sync_queue_user_status ON sync_queue(user_id, status);
CREATE INDEX IF NOT EXISTS idx_ai_messages_user ON ai_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_feature_flags_name ON feature_flags(feature_name);
CREATE INDEX IF NOT EXISTS idx_family_interactions_user ON family_interactions(user_id);
CREATE INDEX IF NOT EXISTS idx_weekly_rankings_week ON weekly_family_rankings(week_number, year);
CREATE INDEX IF NOT EXISTS idx_push_notifications_user ON push_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_screening_surveys_user ON screening_surveys(user_id);
