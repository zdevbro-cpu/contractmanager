const pg = require('pg');
const fs = require('fs');
const path = require('path');

const envPath = path.resolve(__dirname, 'web/.env.local');
const env = fs.readFileSync(envPath, 'utf8');
env.split(/\r?\n/).forEach(line => {
  const idx = line.indexOf('=');
  if (idx > 0) {
    const k = line.slice(0, idx).trim();
    const v = line.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '');
    process.env[k] = v;
  }
});

const pool = new pg.Pool({
  host: process.env.PGHOST,
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  port: Number(process.env.PGPORT || 5432),
  ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : false
});

pool.query('ALTER TABLE referrers ADD COLUMN IF NOT EXISTS remarks TEXT')
  .then(() => {
    console.log('remarks column added');
    return pool.end();
  })
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
