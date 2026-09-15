const { query, initDatabase } = require('../database/connection');
const { v4: uuidv4 } = require('uuid');

exports.pushSync = async (req, res) => {
  try {
    await initDatabase();
    const userId = req.user?.id;
    const { operations } = req.body;

    const results = [];
    const errors = [];

    for (const op of operations) {
      try {
        const { operation_type, table_name, payload, uuid } = op;

        // Check if already synced (idempotency)
        const existing = await query(
          'SELECT id FROM sync_queue WHERE uuid = $1 AND status = $2',
          [uuid, 'synced']
        );

        if (existing.rows.length > 0) {
          results.push({ uuid, status: 'already_synced' });
          continue;
        }

        // Process based on operation type
        let result;
        switch (operation_type) {
          case 'create':
            result = await handleCreate(userId, table_name, payload);
            break;
          case 'update':
            result = await handleUpdate(userId, table_name, payload);
            break;
          case 'delete':
            result = await handleDelete(userId, table_name, payload);
            break;
          default:
            throw new Error(`Unknown operation type: ${operation_type}`);
        }

        // Mark as synced
        await query(
          `UPDATE sync_queue 
           SET status = 'synced', synced_at = CURRENT_TIMESTAMP 
           WHERE uuid = $1`,
          [uuid]
        );

        results.push({ uuid, status: 'synced', result });
      } catch (error) {
        console.error(`Sync error for operation ${op.uuid}:`, error);
        errors.push({ uuid: op.uuid, error: error.message });
        
        // Update sync queue with error
        await query(
          `UPDATE sync_queue 
           SET status = 'failed', error_message = $1, retry_count = retry_count + 1 
           WHERE uuid = $2`,
          [error.message, op.uuid]
        );
      }
    }

    res.json({
      message: 'Sync completed',
      synced: results.length,
      failed: errors.length,
      results,
      errors
    });
  } catch (error) {
    console.error('Push sync error:', error);
    res.status(500).json({ error: 'Sync failed' });
  }
};

exports.pullSync = async (req, res) => {
  try {
    await initDatabase();
    const userId = req.user?.id;
    const { last_sync_timestamp } = req.query;

    let sql = `
      SELECT sq.operation_type, sq.table_name, sq.payload, sq.uuid, sq.created_at
      FROM sync_queue sq
      WHERE sq.user_id = $1 AND sq.status = 'synced'
    `;
    const params = [userId];

    if (last_sync_timestamp) {
      sql += ' AND sq.synced_at > $2';
      params.push(last_sync_timestamp);
    }

    sql += ' ORDER BY sq.synced_at ASC';

    const result = await query(sql, params);

    res.json({ operations: result.rows });
  } catch (error) {
    console.error('Pull sync error:', error);
    res.status(500).json({ error: 'Pull sync failed' });
  }
};

exports.getSyncStatus = async (req, res) => {
  try {
    await initDatabase();
    const userId = req.user?.id;

    const result = await query(
      `SELECT status, COUNT(*) as count 
       FROM sync_queue 
       WHERE user_id = $1 
       GROUP BY status`,
      [userId]
    );

    const status = {
      pending: 0,
      synced: 0,
      failed: 0
    };

    result.rows.forEach(row => {
      status[row.status] = parseInt(row.count);
    });

    res.json({ status });
  } catch (error) {
    console.error('Get sync status error:', error);
    res.status(500).json({ error: 'Failed to get sync status' });
  }
};

// Helper functions for handling different operations
async function handleCreate(userId, table_name, payload) {
  switch (table_name) {
    case 'activity_data':
      const activityResult = await query(
        `INSERT INTO activity_data 
         (user_id, date, steps_count, mvpa_minutes, calories_burned, heart_rate_avg, sync_source, uuid)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (user_id, date, uuid) DO NOTHING
         RETURNING *`,
        [userId, payload.date, payload.steps_count, payload.mvpa_minutes, 
         payload.calories_burned, payload.heart_rate_avg, 'manual', payload.uuid]
      );
      return activityResult.rows[0];
    default:
      throw new Error(`Unsupported table for create: ${table_name}`);
  }
}

async function handleUpdate(userId, table_name, payload) {
  switch (table_name) {
    case 'activity_data':
      const activityResult = await query(
        `UPDATE activity_data 
         SET steps_count = $1, mvpa_minutes = $2, calories_burned = $3, heart_rate_avg = $4
         WHERE user_id = $5 AND uuid = $6
         RETURNING *`,
        [payload.steps_count, payload.mvpa_minutes, payload.calories_burned, 
         payload.heart_rate_avg, userId, payload.uuid]
      );
      return activityResult.rows[0];
    default:
      throw new Error(`Unsupported table for update: ${table_name}`);
  }
}

async function handleDelete(userId, table_name, payload) {
  switch (table_name) {
    case 'activity_data':
      const activityResult = await query(
        'DELETE FROM activity_data WHERE user_id = $1 AND uuid = $2 RETURNING *',
        [userId, payload.uuid]
      );
      return activityResult.rows[0];
    default:
      throw new Error(`Unsupported table for delete: ${table_name}`);
  }
}
