import fs from "node:fs";
import path from "node:path";
import pg from "pg";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "../"); // If script is in web/ folder

function loadEnv() {
  const envPath = path.resolve(rootDir, "web/.env.local");
  if (!fs.existsSync(envPath)) {
    console.error(".env.local not found at", envPath);
    process.exit(1);
  }
  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx < 1) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim().replace(/^['"]|['"]$/g, "");
    process.env[key] = value;
  }
}

loadEnv();

const { Pool } = pg;
const pool = new Pool({
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT ?? 5432),
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  ssl: process.env.PGSSL === "true" ? { rejectUnauthorized: false } : false
});

async function run() {
  try {
    console.log("Migrating database...");
    await pool.query("ALTER TABLE referrers ADD COLUMN IF NOT EXISTS email TEXT");
    
    // Add unique constraint for name and phone if not exists
    try {
        await pool.query("ALTER TABLE referrers ADD CONSTRAINT unique_referrer_name_phone UNIQUE (name, phone)");
    } catch (e) {
        // ignore if already exists
    }
    
    const dataPath = path.resolve(rootDir, "data/새로운.txt");
    if (!fs.existsSync(dataPath)) {
      console.error("Data file not found:", dataPath);
      return;
    }
    
    const rawData = fs.readFileSync(dataPath, "utf8");
    const referrers = JSON.parse(rawData);
    console.log(`Found ${referrers.length} referrers in file.`);
    
    let count = 0;
    for (const r of referrers) {
      await pool.query(
        `INSERT INTO referrers (name, org, phone, title, email, status) 
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (name, phone) DO UPDATE SET 
           org = EXCLUDED.org, 
           title = EXCLUDED.title, 
           email = EXCLUDED.email, 
           updated_at = NOW()`,
        [r.name, r.branch, r.phone, r.user_type, r.email, "활성"]
      );
      count++;
      if (count % 100 === 0) console.log(`${count} processed...`);
    }
    
    console.log("Successfully uploaded referrers.");
  } catch (err) {
    console.error("Task failed:", err);
  } finally {
    await pool.end();
  }
}

run();
