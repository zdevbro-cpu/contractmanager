const express = require("express");
const { onRequest } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");
const pg = require("pg");

const { Pool } = pg;

setGlobalOptions({ region: "asia-northeast3", maxInstances: 10 });

const app = express();
app.use(express.json());
app.use((req, _res, next) => {
  while (req.url.startsWith("/api/")) req.url = req.url.slice(4);
  if (req.url === "/api") req.url = "/";
  next();
});

const pool = new Pool({
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT || 5432),
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  ssl: process.env.PGSSL === "true" ? { rejectUnauthorized: false } : false
});

function toWonText(value) {
  if (value === null || value === undefined || value === "") return "";
  return `${Number(value).toLocaleString("ko-KR")} 원`;
}

function toIsoDate(value) {
  if (!value) return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  const text = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  const d = new Date(text);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function addYears(dateText, years) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateText)) return "2026-01-01";
  const d = new Date(`${dateText}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "2026-01-01";
  d.setFullYear(d.getFullYear() + years);
  return d.toISOString().slice(0, 10);
}

function normalizeRows(rows) {
  return rows.map((row) => ({
    no: row.contract_no ?? `LASM-${(toIsoDate(row.contract_date) || toIsoDate(row.first_allowance_date) || "2026-01-01").replaceAll("-", "")}-${String(row.id).padStart(3, "0")}`,
    name: row.contractor_name ?? "",
    ref: row.referrer_name ?? "",
    bankName: row.bank_name ?? "",
    accountNo: row.account_no ?? "",
    type: row.contract_name ?? "",
    status: "정상운영",
    verify: "검증완료",
    contractDate: toIsoDate(row.contract_date),
    payoutDate: toIsoDate(row.first_allowance_date),
    endDate:
      row.contract_end_date
        ? toIsoDate(row.contract_end_date)
        : addYears(
            toIsoDate(row.contract_date) || toIsoDate(row.first_allowance_date) || "2026-01-01",
            3
          ),
    depositAmount: toWonText(row.deposit_amount),
    depositAmountRaw: row.deposit_amount ?? null,
    allowanceAmount: toWonText(row.work_allowance),
    allowanceAmountRaw: row.work_allowance ?? null,
    bankName: row.bank_name ?? "",
    accountNo: row.account_no ?? "",
    paymentMethod: row.payment_method ?? "",
    accountHolder: row.account_holder ?? "",
    residentRegistrationNumber: row.resident_registration_number ?? "",
    remarks: row.remarks ?? "",
    phone: row.phone ?? "",
    createdAt: row.created_at ? String(row.created_at).slice(0, 10) : ""
  }));
}

async function ensureAppSchema() {
  const safeAlter = (sql) => pool.query(sql).catch(() => {});
  await safeAlter("alter table contracts add column if not exists contract_end_date date");
  await safeAlter("alter table contracts add column if not exists referrer_name text");
  await safeAlter("alter table contracts add column if not exists bank_name text");
  await safeAlter("alter table contracts add column if not exists account_no text");
  await safeAlter("alter table contracts add column if not exists payment_method text");
  await safeAlter("alter table contracts add column if not exists account_holder text");
  await safeAlter("alter table contracts add column if not exists resident_registration_number text");
  await safeAlter("alter table contracts add column if not exists remarks text");
  await pool.query(`
    create table if not exists contract_types (
      id bigserial primary key,
      name text not null unique,
      contract_years int not null default 3,
      payout_months int not null default 2,
      rules jsonb not null default '[]',
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
  `);
  await pool.query(`
    create table if not exists referrers (
      id bigserial primary key,
      name text not null,
      org text not null,
      phone text not null,
      title text not null default '사원',
      status text not null default '활성',
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
  `);
  await pool.query(`
    create table if not exists app_change_requests (
      id text primary key,
      payload jsonb not null,
      updated_at timestamptz not null default now()
    );
  `);
  await pool.query(`
    create table if not exists app_change_history (
      id text primary key,
      payload jsonb not null,
      updated_at timestamptz not null default now()
    );
  `);
}

app.get("/health", async (_req, res) => {
  try {
    await ensureAppSchema();
    await pool.query("select 1");
    res.json({ ok: true, db: true });
  } catch (error) {
    res.status(500).json({ ok: false, db: false, message: String(error) });
  }
});

app.get("/contracts", async (_req, res) => {
  try {
    await ensureAppSchema();
    const result = await pool.query(`
      select
        id,
        contract_no,
        contractor_name,
        contract_name,
        contract_date,
        first_allowance_date,
        contract_end_date,
        deposit_amount,
        work_allowance,
        phone,
        referrer_name,
        bank_name,
        account_no,
        payment_method,
        account_holder,
        resident_registration_number,
        remarks,
        created_at
      from contracts
      where contractor_name is not null
        and btrim(contractor_name) <> ''
      order by contract_date desc nulls last, contract_no desc
    `);
    res.json({ rows: normalizeRows(result.rows) });
  } catch (error) {
    res.status(500).json({ message: String(error) });
  }
});

app.put("/contracts/:contractNo", async (req, res) => {
  const { contractNo } = req.params;
  const body = req.body ?? {};
  try {
    await ensureAppSchema();
    const result = await pool.query(
      `
      update contracts
      set
        contractor_name = coalesce($2, contractor_name),
        contract_name = coalesce($3, contract_name),
        contract_date = coalesce($4, contract_date),
        first_allowance_date = coalesce($5, first_allowance_date),
        contract_end_date = coalesce($6, contract_end_date),
        deposit_amount = coalesce($7, deposit_amount),
        work_allowance = coalesce($8, work_allowance),
        referrer_name = coalesce($9, referrer_name),
        bank_name = coalesce($10, bank_name),
        account_no = coalesce($11, account_no),
        payment_method = coalesce($12, payment_method),
        account_holder = coalesce($13, account_holder),
        resident_registration_number = coalesce($14, resident_registration_number),
        remarks = coalesce($15, remarks),
        updated_at = now()
      where contract_no = $1
      returning contract_no
      `,
      [
        contractNo,
        body.name ?? null,
        body.type ?? null,
        body.contractDate ?? null,
        body.payoutDate ?? null,
        body.endDate ?? null,
        body.depositAmountValue ?? null,
        body.allowanceAmountValue ?? null,
        body.ref ?? null,
        body.bankName ?? null,
        body.accountNo ?? null,
        body.paymentMethod ?? null,
        body.accountHolder ?? null,
        body.residentRegistrationNumber ?? null,
        body.remarks ?? null
      ]
    );
    if (result.rowCount === 0) {
      res.status(404).json({ message: "contract not found" });
      return;
    }
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ message: String(error) });
  }
});

app.get("/changes", async (_req, res) => {
  try {
    await ensureAppSchema();
    const [reqRows, histRows] = await Promise.all([
      pool.query("select payload from app_change_requests order by updated_at desc"),
      pool.query("select payload from app_change_history order by updated_at desc")
    ]);
    res.json({
      rows: reqRows.rows.map((x) => x.payload),
      history: histRows.rows.map((x) => x.payload)
    });
  } catch (error) {
    res.status(500).json({ message: String(error) });
  }
});

app.put("/changes", async (req, res) => {
  const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
  const history = Array.isArray(req.body?.history) ? req.body.history : [];
  const client = await pool.connect();
  try {
    await ensureAppSchema();
    await client.query("begin");
    await client.query("delete from app_change_requests");
    await client.query("delete from app_change_history");
    for (const row of rows) {
      await client.query(
        "insert into app_change_requests (id, payload, updated_at) values ($1, $2::jsonb, now())",
        [String(row.id), JSON.stringify(row)]
      );
    }
    for (const row of history) {
      await client.query(
        "insert into app_change_history (id, payload, updated_at) values ($1, $2::jsonb, now())",
        [String(row.id), JSON.stringify(row)]
      );
    }
    await client.query("commit");
    res.json({ ok: true });
  } catch (error) {
    await client.query("rollback");
    res.status(500).json({ message: String(error) });
  } finally {
    client.release();
  }
});

app.get("/referrers", async (_req, res) => {
  try {
    await ensureAppSchema();
    const result = await pool.query(
      "select id, name, org, phone, title, email, remarks, status from referrers order by created_at desc"
    );
    res.json({ rows: result.rows });
  } catch (error) {
    res.status(500).json({ message: String(error) });
  }
});

app.post("/referrers", async (req, res) => {
  const { name, org, phone, title, email, remarks } = req.body ?? {};
  if (!name || !org || !phone) {
    res.status(400).json({ message: "name, org, phone 필수" });
    return;
  }
  try {
    await ensureAppSchema();
    const result = await pool.query(
      "insert into referrers (name, org, phone, title, email, remarks) values ($1,$2,$3,$4,$5,$6) returning id, name, org, phone, title, email, remarks, status",
      [name, org, phone, title || "사원", email || null, remarks || null]
    );
    res.json({ ok: true, row: result.rows[0] });
  } catch (error) {
    res.status(500).json({ message: String(error) });
  }
});

app.put("/referrers/:id", async (req, res) => {
  const { id } = req.params;
  const { name, org, phone, title, email, remarks, status } = req.body ?? {};
  try {
    await ensureAppSchema();
    await pool.query(
      `update referrers set
        name = coalesce($2, name),
        org = coalesce($3, org),
        phone = coalesce($4, phone),
        title = coalesce($5, title),
        email = coalesce($6, email),
        remarks = coalesce($7, remarks),
        status = coalesce($8, status),
        updated_at = now()
       where id = $1`,
      [id, name ?? null, org ?? null, phone ?? null, title ?? null, email ?? null, remarks ?? null, status ?? null]
    );
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ message: String(error) });
  }
});

app.delete("/referrers/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await ensureAppSchema();
    await pool.query("delete from referrers where id = $1", [id]);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ message: String(error) });
  }
});

app.get("/contract-types", async (_req, res) => {
  try {
    await ensureAppSchema();
    const result = await pool.query("select id, name, contract_years, payout_months, rules from contract_types order by id");
    res.json({ rows: result.rows.map((r) => ({ id: r.id, name: r.name, contractYears: r.contract_years, payoutMonths: r.payout_months, rules: r.rules })) });
  } catch (error) { res.status(500).json({ message: String(error) }); }
});

app.post("/contract-types", async (req, res) => {
  const { name, contractYears, payoutMonths, rules } = req.body ?? {};
  try {
    await ensureAppSchema();
    const result = await pool.query(
      "insert into contract_types (name, contract_years, payout_months, rules) values ($1,$2,$3,$4::jsonb) returning id",
      [name, contractYears ?? 3, payoutMonths ?? 2, JSON.stringify(rules ?? [])]
    );
    res.json({ ok: true, id: result.rows[0].id });
  } catch (error) { res.status(500).json({ message: String(error) }); }
});

app.put("/contract-types/:id", async (req, res) => {
  const { name, contractYears, payoutMonths, rules } = req.body ?? {};
  try {
    await ensureAppSchema();
    await pool.query(
      "update contract_types set name=$2, contract_years=$3, payout_months=$4, rules=$5::jsonb, updated_at=now() where id=$1",
      [req.params.id, name, contractYears, payoutMonths, JSON.stringify(rules ?? [])]
    );
    res.json({ ok: true });
  } catch (error) { res.status(500).json({ message: String(error) }); }
});

app.delete("/contract-types/:id", async (req, res) => {
  try {
    await ensureAppSchema();
    await pool.query("delete from contract_types where id=$1", [req.params.id]);
    res.json({ ok: true });
  } catch (error) { res.status(500).json({ message: String(error) }); }
});

app.post("/account/verify", (req, res) => {
  const { bankName, accountNo, ownerName } = req.body ?? {};
  if (!bankName || !accountNo || !ownerName) {
    res.status(400).json({ exists: false, ownerMatch: false, message: "bankName, accountNo, ownerName are required." });
    return;
  }
  const normalizedAccount = String(accountNo).replace(/[^\d]/g, "");
  const normalizedOwner = String(ownerName).trim();
  const exists = normalizedAccount.length >= 10 && !/^0+$/.test(normalizedAccount);
  if (!exists) {
    res.json({ exists: false, ownerMatch: false, message: "계좌번호 형식을 확인하세요." });
    return;
  }
  res.json({ exists: true, ownerMatch: true, ownerName: normalizedOwner, message: "실명 일치" });
});

exports.api = onRequest({ cors: true }, app);
