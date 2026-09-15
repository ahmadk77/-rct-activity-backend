const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

// Fallback to Supabase credentials if env vars not loaded
const DB_HOST = process.env.DB_HOST || 'db.ndycqtvsibwkizdhzdzn.supabase.co';
const DB_PORT = parseInt(process.env.DB_PORT) || 5432;
const DB_NAME = process.env.DB_NAME || 'postgres';
const DB_USER = process.env.DB_USER || 'postgres';
const DB_PASSWORD = process.env.DB_PASSWORD || '121444@#Aazz';

let pool = null;
let initPromise = null;

async function initDatabase() {
  if (initPromise) {
    await initPromise;
    return pool;
  }

  initPromise = (async () => {
    console.log('Initializing PostgreSQL connection...');
    console.log('DB_HOST:', DB_HOST);
    console.log('DB_NAME:', DB_NAME);
    
    // Use connection string for better IPv4 handling
    const connectionString = `postgresql://${DB_USER}:${encodeURIComponent(DB_PASSWORD)}@${DB_HOST}:${DB_PORT}/${DB_NAME}?sslmode=require`;
    
    pool = new Pool({
      connectionString: connectionString,
      ssl: DB_HOST.includes('supabase.co') ? { 
        rejectUnauthorized: false
      } : false,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });

    // Test connection
    try {
      const client = await pool.connect();
      console.log('Successfully connected to PostgreSQL database');
      client.release();
    } catch (error) {
      console.error('Failed to connect to PostgreSQL:', error);
      throw error;
    }

    return pool;
  })();

  return initPromise;
}

function getPool() {
  return pool;
}

async function query(text, params) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log('Executed query', { text, duration, rows: res.rowCount });
    return res;
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
}

async function closeDatabase() {
  if (pool) {
    await pool.end();
    console.log('Database connection closed');
  }
}

module.exports = { 
  initDatabase, 
  getPool,
  query,
  closeDatabase
};