# RCT Activity App - Backend API

Backend API for the RCT (Randomized Controlled Trial) Activity App - A physical activity motivation study for Malaysian adults.

## Features

- **Authentication**: JWT-based authentication with de-identified participant codes (P001, P002, etc.)
- **Cultural Profiling**: User cultural and religious preferences for personalized content
- **Activity Tracking**: MVPA (Moderate-to-Vigorous Physical Activity) data collection
- **Smartwatch Integration**: Support for Apple HealthKit, Google Fit, Fitbit, Garmin
- **Gamification**: Points system with levels (Bronze, Silver, Gold, Legendary)
- **AI Messages**: Personalized motivational messages with fallback system
- **Offline Support**: Sync queue for offline data collection
- **Feature Flags**: Remote configuration for A/B testing and research control
- **Admin Panel**: Participant management, data export, statistics

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: PostgreSQL
- **Authentication**: JWT (JSON Web Tokens)
- **Security**: Helmet, bcrypt, CORS
- **Validation**: express-validator

## Database Schema

The database includes the following main tables:
- `users` - De-identified user accounts
- `cultural_profiles` - User cultural and religious preferences
- `family_coaches` - Family support system
- `smartwatch_connections` - Smartwatch OAuth tokens
- `activity_data` - MVPA and activity metrics
- `gamification` - Points and levels
- `ai_messages` - Personalized messages
- `fallback_messages` - Static message pool
- `exercise_media` - Video/GIF exercise library
- `feature_flags` - Remote configuration
- `sync_queue` - Offline sync operations
- `audit_logs` - Research integrity logs

## Installation

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
cp .env.example .env
```

Edit `.env` with your configuration:
```
PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=rct_activity_db
DB_USER=postgres
DB_PASSWORD=your_password
JWT_SECRET=your_jwt_secret_key
```

3. Set up PostgreSQL database:
```bash
# Create database
createdb rct_activity_db

# Run schema migration
psql -d rct_activity_db -f src/database/schema.sql
```

## Running the Server

Development mode with auto-reload:
```bash
npm run dev
```

Production mode:
```bash
npm start
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new participant
- `POST /api/auth/login` - Login
- `POST /api/auth/consent` - Submit e-consent
- `POST /api/auth/refresh` - Refresh JWT token

### Users
- `GET /api/users/profile` - Get user profile
- `POST /api/users/cultural-profile` - Update cultural profile
- `GET /api/users/cultural-profile` - Get cultural profile
- `PATCH /api/users/language` - Update language preference

### Activities
- `POST /api/activities/submit` - Submit activity data
- `GET /api/activities/history` - Get activity history
- `GET /api/activities/today` - Get today's activity
- `POST /api/activities/smartwatch-sync` - Sync smartwatch data

### Messages
- `GET /api/messages/` - Get user messages
- `PATCH /api/messages/:id/read` - Mark message as read
- `PATCH /api/messages/:id/react` - React to message
- `GET /api/messages/fallback/list` - Get fallback messages

### Sync (Offline Support)
- `POST /api/sync/push` - Push pending data to server
- `GET /api/sync/pull` - Pull latest data from server
- `GET /api/sync/status` - Get sync status

### Admin
- `GET /api/admin/participants` - Get all participants (de-identified)
- `GET /api/admin/participant/:code/activity` - Get participant activity
- `POST /api/admin/feature-flags` - Toggle feature flag
- `GET /api/admin/feature-flags` - Get feature flags
- `GET /api/admin/export/data` - Export data (CSV/JSON)
- `GET /api/admin/statistics` - Get statistics

## Security Features

- **De-identification**: Users identified by codes (P001, P002) instead of names
- **Data Encryption**: AES-256 for stored data, TLS for data in transit
- **JWT Authentication**: Secure token-based authentication
- **Helmet**: Security headers
- **CORS**: Configurable cross-origin resource sharing
- **Input Validation**: Request validation using express-validator

## Offline Support Architecture

The backend supports offline data collection through:
1. **Sync Queue**: Operations stored with UUID for idempotency
2. **Push/Pull Sync**: Bidirectional synchronization
3. **Retry Logic**: Failed operations are retried with exponential backoff
4. **Audit Logging**: All changes logged for research integrity

## Feature Flags

Remote configuration allows:
- Enable/disable features without app updates
- A/B testing (control vs treatment groups)
- Target specific users or groups
- All changes logged for research documentation

## Data Export

Data can be exported in:
- **JSON format**: For API consumption
- **CSV format**: Compatible with SPSS/Excel for statistical analysis

All exports are de-identified (participant codes only, no personal data).

## Development Notes

- All user data is de-identified using participant codes
- Audit logs track all changes for research integrity
- Feature flags allow remote control during the study
- Offline support ensures no data loss during connectivity issues
- Cultural profiling enables personalized content delivery

## License

MIT
