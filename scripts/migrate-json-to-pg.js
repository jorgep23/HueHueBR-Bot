// scripts/migrate-json-to-pg.js
const { Pool } = require('pg');
const fs = require('fs');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  const data = JSON.parse(fs.readFileSync('database.json','utf8'));
  await pool.query(`CREATE TABLE IF NOT EXISTS users (telegram_id TEXT PRIMARY KEY, data JSONB NOT NULL)`);
  await pool.query(`CREATE TABLE IF NOT EXISTS config (key TEXT PRIMARY KEY, value JSONB NOT NULL)`);
  for (const [id,u] of Object.entries(data.users||{})) {
    await pool.query('INSERT INTO users(telegram_id,data) VALUES($1,$2) ON CONFLICT(telegram_id) DO UPDATE SET data=$2', [id, u]);
  }
  await pool.query('INSERT INTO config(key,value) VALUES($1,$2) ON CONFLICT (key) DO UPDATE SET value=$2', ['main', data.config || {}]);
  console.log('Migration done');
  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
