const express = require("express");
const { onRequest } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");
const pg = require("pg");
const admin = require("firebase-admin");
const { google } = require("googleapis");

if (!admin.apps.length) admin.initializeApp();
const bucket = admin.storage().bucket("contractmanager-pdf-storage");

// ── Google Drive ────────────────────────────────────────────────────────
const DRIVE_ROOT_FOLDER = "1HYwbkIyfxRiRTuJNTvcnW5SfZ-UqJ3nf";

async function getDriveClient() {
  const auth = new google.auth.GoogleAuth({
    scopes: ["https://www.googleapis.com/auth/drive"],
  });
  const authClient = await auth.getClient();
  return google.drive({ version: "v3", auth: authClient });
}

// Drive에서 파일을 스트리밍으로 가져와 응답에 파이핑
async function streamDriveFile(fileId, res) {
  const drive = await getDriveClient();
  const meta = await drive.files.get({ fileId, fields: "name,mimeType" });
  res.setHeader("Content-Type", meta.data.mimeType || "application/pdf");
  res.setHeader("Content-Disposition", "inline");
  const stream = await drive.files.get({ fileId, alt: "media" }, { responseType: "stream" });
  stream.data.pipe(res);
}

// year 폴더 ID 조회 또는 생성
async function getOrCreateYearFolder(drive, year) {
  const q = `'${DRIVE_ROOT_FOLDER}' in parents and name = '${year}년' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  const list = await drive.files.list({ q, fields: "files(id,name)", pageSize: 1 });
  if (list.data.files.length > 0) return list.data.files[0].id;
  const folder = await drive.files.create({
    requestBody: { name: `${year}년`, mimeType: "application/vnd.google-apps.folder", parents: [DRIVE_ROOT_FOLDER] },
    fields: "id",
  });
  return folder.data.id;
}

// Drive 폴더 아래 파일 전체 목록 재귀 조회
async function listDriveFilesRecursive(drive, folderId) {
  const results = [];
  let pageToken = null;
  do {
    const q = `'${folderId}' in parents and trashed = false`;
    const res = await drive.files.list({
      q,
      fields: "nextPageToken,files(id,name,mimeType,parents)",
      pageSize: 1000,
      pageToken: pageToken || undefined,
    });
    for (const f of res.data.files) {
      if (f.mimeType === "application/vnd.google-apps.folder") {
        const children = await listDriveFilesRecursive(drive, f.id);
        results.push(...children);
      } else {
        results.push(f);
      }
    }
    pageToken = res.data.nextPageToken;
  } while (pageToken);
  return results;
}
// ────────────────────────────────────────────────────────────────────────

const { Pool } = pg;

setGlobalOptions({ region: "asia-northeast3", maxInstances: 10 });

const app = express();
app.use(express.json({ limit: "10mb" }));
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
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addYears(dateText, years) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateText)) return "2026-01-01";
  const d = new Date(`${dateText}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "2026-01-01";
  d.setFullYear(d.getFullYear() + years);
  return d.toISOString().slice(0, 10);
}

function excelDateToIso(val) {
  if (!val) return null;
  if (typeof val === "number") {
    const d = new Date((val - 25569) * 86400 * 1000);
    return d.toISOString().slice(0, 10);
  }
  if (typeof val === "string" && /^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
  return null;
}

function normalizeRows(rows) {
  return rows.map((row) => ({
    id: row.id,
    no: (row.contract_no && row.contract_no.trim()) ? row.contract_no : `LASM-${(toIsoDate(row.contract_date) || toIsoDate(row.first_allowance_date) || "2026-01-01").replaceAll("-", "")}-${String(row.id).padStart(3, "0")}`,
    name: row.contractor_name ?? "",
    ref: row.referrer_name ?? "",
    bankName: row.bank_name ?? "",
    accountNo: row.account_no ?? "",
    type: row.contract_name ?? "",
    status: row.status ?? "정상운영",
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
    isAppointment: row.is_appointment ?? false,
    insuranceType: row.insurance_type ?? "사업소득",
    workStartDate: row.work_start_date ? String(row.work_start_date).slice(0, 10) : "",
    reportStartDate: row.report_start_date ? String(row.report_start_date).slice(0, 10) : "",
    position: row.position ?? "",
    phone: row.phone ?? "",
    createdAt: row.created_at ? toIsoDate(row.created_at) : "",
    updatedAt: row.updated_at ? toIsoDate(row.updated_at) : "",
    workType: row.work_type || "4일근무",
    affiliation: row.affiliation ?? "",
    managerName: row.manager_name ?? "",
    company: row.company ?? ""
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
  await safeAlter("alter table contracts add column if not exists is_appointment boolean not null default false");
  await safeAlter("alter table contracts add column if not exists insurance_type varchar(20) not null default '사업소득'");
  await safeAlter("alter table contracts add column if not exists status varchar(20) not null default '정상운영'");
  await safeAlter("alter table contracts add column if not exists work_start_date date");
  await safeAlter("alter table contracts add column if not exists report_start_date date");
  await safeAlter("alter table contracts add column if not exists position varchar(50)");
  await safeAlter("alter table contracts add column if not exists pdf_storage_path text");
  await safeAlter("alter table contracts add column if not exists work_type text");
  await safeAlter("alter table contracts add column if not exists affiliation text");
  await safeAlter("alter table contracts add column if not exists manager_name text");
  await safeAlter("alter table contracts add column if not exists company text");
  await safeAlter("update contracts set company = 'A' where company is null and is_appointment = false");
  await safeAlter("alter table contracts drop constraint if exists contracts_contract_no_key");
  await safeAlter("alter table contract_documents add column if not exists original_name text");
  await safeAlter("alter table contract_documents add column if not exists reason text");
  await safeAlter("alter table contract_documents add column if not exists deleted_at timestamptz");
  await safeAlter("alter table contract_documents add column if not exists drive_file_id text");
  await safeAlter("alter table contract_documents add column if not exists page_range text");
  await safeAlter("alter table contracts add column if not exists verified_at timestamptz");
  await safeAlter("alter table contracts add column if not exists tags text[]");
  await safeAlter("alter table contracts add column if not exists meta_memo text");
  await safeAlter("alter table contracts add column if not exists transferred_from_id bigint");
  await safeAlter("alter table contract_changes add column if not exists apply_month text");
  await safeAlter("alter table contract_changes add column if not exists applied boolean not null default false");
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
  await pool.query(`
    create table if not exists contract_changes (
      id bigserial primary key,
      contract_id bigint not null,
      at timestamptz not null default now(),
      before_text text,
      after_text text,
      reason text,
      changed_fields jsonb,
      created_at timestamptz not null default now()
    );
  `);
  await pool.query(`
    create table if not exists contract_memos (
      id bigserial primary key,
      contract_id text not null,
      slot_index int not null default 0,
      content text not null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique(contract_id, slot_index)
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

app.get("/contracts/:id/memos", async (req, res) => {
  const { id } = req.params;
  try {
    await ensureAppSchema();
    const result = await pool.query("select slot_index as \"slotIndex\", content, updated_at as \"updatedAt\" from contract_memos where contract_id = $1 order by slot_index asc", [id]);
    res.json({ rows: result.rows });
  } catch (error) { res.status(500).json({ message: String(error) }); }
});

app.post("/contracts/:id/memos", async (req, res) => {
  const { id } = req.params;
  const { slotIndex, content } = req.body ?? {};
  try {
    await ensureAppSchema();
    await pool.query(
      "insert into contract_memos (contract_id, slot_index, content) values ($1, $2, $3) on conflict (contract_id, slot_index) do update set content = excluded.content, updated_at = now()",
      [id, slotIndex, content]
    );
    res.json({ ok: true });
  } catch (error) { res.status(500).json({ message: String(error) }); }
});

app.get("/contracts/statement", async (_req, res) => {
  try {
    await ensureAppSchema();
    const contracts = await pool.query(`
      select id, contractor_name, contract_name,
             contract_date, first_allowance_date, deposit_amount,
             manager_name, company, affiliation, status
      from contracts
      where is_appointment = false
        and contractor_name is not null
        and btrim(contractor_name) <> ''
      order by manager_name nulls last, contractor_name, contract_date
    `);
    if (contracts.rows.length === 0) return res.json({ rows: [] });

    const ids = contracts.rows.map(r => r.id);
    const changes = await pool.query(`
      select contract_id, changed_fields, apply_month, at
      from contract_changes
      where contract_id = any($1)
        and changed_fields is not null
      order by at asc
    `, [ids]);

    const incMap = {};
    for (const ch of changes.rows) {
      const fields = ch.changed_fields || [];
      const df = fields.find(f => f.field === "보증금");
      if (df) {
        const before = Number(String(df.before).replace(/[^0-9]/g, ""));
        const after  = Number(String(df.after).replace(/[^0-9]/g, ""));
        if (after > before) {
          if (!incMap[ch.contract_id]) incMap[ch.contract_id] = [];
          incMap[ch.contract_id].push({ delta: after - before, applyMonth: ch.apply_month || null, at: ch.at });
        }
      }
    }

    const rows = contracts.rows.map(r => ({
      id: r.id,
      name: r.contractor_name,
      type: r.contract_name || "",
      contractDate: r.contract_date ? String(r.contract_date).slice(0, 10) : "",
      payoutDate: r.first_allowance_date ? String(r.first_allowance_date).slice(0, 10) : "",
      depositAmount: r.deposit_amount ?? 0,
      managerName: r.manager_name || "",
      company: r.company || "",
      affiliation: r.affiliation || "",
      status: r.status || "정상운영",
      increases: incMap[r.id] || []
    }));

    res.json({ rows });
  } catch (error) {
    res.status(500).json({ message: String(error) });
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
        is_appointment,
        insurance_type,
        status,
        work_start_date,
        report_start_date,
        position,
        created_at,
        updated_at,
        work_type,
        affiliation,
        manager_name,
        company
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

app.post("/contracts", async (req, res) => {
  const body = req.body ?? {};
  try {
    await ensureAppSchema();
    const result = await pool.query(
      `INSERT INTO contracts (
        contract_no, contractor_name, contract_name,
        referrer_name, contract_date, first_allowance_date, contract_end_date,
        deposit_amount, work_allowance, bank_name, account_no, account_holder,
        resident_registration_number, phone, is_appointment, insurance_type,
        work_start_date, report_start_date, position, affiliation, manager_name, company
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
      RETURNING id, contract_no`,
      [
        body.contractNo ?? null,
        body.name ?? null,
        body.type ?? null,
        body.ref ?? null,
        body.contractDate ?? null,
        body.payoutDate ?? null,
        body.endDate ?? null,
        body.depositAmountValue != null ? body.depositAmountValue : null,
        body.allowanceAmountValue != null ? body.allowanceAmountValue : null,
        body.bankName ?? null,
        body.accountNo ?? null,
        body.accountHolder ?? null,
        body.residentRegistrationNumber ?? null,
        body.phone ?? null,
        body.isAppointment === true,
        body.insuranceType ?? "사업소득",
        body.workStartDate ?? null,
        body.reportStartDate ?? null,
        body.position ?? null,
        body.affiliation ?? null,
        body.managerName ?? null,
        body.company ?? null
      ]
    );
    res.json({ ok: true, id: result.rows[0].id, contractNo: result.rows[0].contract_no });
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
        phone = coalesce($16, phone),
        insurance_type = coalesce($17, insurance_type),
        work_start_date = coalesce($18, work_start_date),
        report_start_date = coalesce($19, report_start_date),
        position = coalesce($20, position),
        work_type = coalesce($21, work_type),
        affiliation = coalesce($22, affiliation),
        manager_name = coalesce($23, manager_name),
        status = coalesce($24, status),
        company = coalesce($25, company),
        contract_no = coalesce($26, contract_no),
        updated_at = now()
      where contract_no = $1 or id::text = $1 or id::text = split_part($1, '-', 3)
      returning contract_no
      `,
      [
        contractNo,
        body.name ?? null,
        body.type ?? null,
        body.contractDate || null,
        body.payoutDate || null,
        body.endDate || null,
        body.depositAmountValue ?? null,
        body.allowanceAmountValue ?? null,
        body.ref ?? null,
        body.bankName ?? null,
        body.accountNo ?? null,
        body.paymentMethod ?? null,
        body.accountHolder ?? null,
        body.residentRegistrationNumber ?? null,
        body.remarks ?? null,
        body.phone ?? null,
        body.insuranceType ?? null,
        body.workStartDate ?? null,
        body.reportStartDate ?? null,
        body.position ?? null,
        body.workType || null,
        body.affiliation ?? null,
        body.managerName ?? null,
        body.status ?? null,
        body.company ?? null,
        body.contractNo ?? null
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

app.delete("/contracts/all", async (_req, res) => {
  try {
    await ensureAppSchema();
    const result = await pool.query("delete from contracts returning id");
    res.json({ ok: true, deleted: result.rowCount });
  } catch (error) {
    res.status(500).json({ message: String(error) });
  }
});

app.delete("/contracts/appointments/clear", async (_req, res) => {
  try {
    await ensureAppSchema();
    const result = await pool.query("delete from contracts where is_appointment = true returning id");
    res.json({ ok: true, deleted: result.rowCount });
  } catch (error) {
    res.status(500).json({ message: String(error) });
  }
});

app.patch("/contracts/:id/status", async (req, res) => {
  const { id } = req.params;
  const { status } = req.body ?? {};
  const allowed = ["정상운영", "일시정지", "계약해지", "계약만료", "양도", "양수"];
  if (!status || !allowed.includes(status)) return res.status(400).json({ message: "유효하지 않은 상태값" });
  try {
    await ensureAppSchema();
    const result = await pool.query(
      "update contracts set status = $1, updated_at = now() where id = $2 returning id",
      [status, id]
    );
    if (result.rowCount === 0) return res.status(404).json({ message: "contract not found" });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ message: String(error) });
  }
});

app.get("/contracts/:id/history", async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      "select at, before_text as before, after_text as after, reason, changed_fields as \"changedFields\" from contract_changes where contract_id = $1 order by at desc",
      [id]
    );
    res.json({ rows: result.rows });
  } catch (error) {
    res.status(500).json({ message: String(error) });
  }
});

app.post("/contracts/:id/history", async (req, res) => {
  const { id } = req.params;
  const { before, after, reason, changedFields, applyMonth } = req.body ?? {};
  try {
    await pool.query(
      "insert into contract_changes (contract_id, before_text, after_text, reason, changed_fields, apply_month) values ($1, $2, $3, $4, $5, $6)",
      [id, before, after, reason, JSON.stringify(changedFields || []), applyMonth || null]
    );
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ message: String(error) });
  }
});

// 변경이력 통합 조회 (기간/이름/추천인/계약종류 필터)
app.get("/changes", async (req, res) => {
  const { dateFrom, dateTo, name, referrer, contractType } = req.query;
  const conditions = [];
  const params = [];
  let idx = 1;
  if (dateFrom) { conditions.push(`cc.at >= $${idx++}`); params.push(dateFrom); }
  if (dateTo) { conditions.push(`cc.at < ($${idx++}::date + interval '1 day')`); params.push(dateTo); }
  if (name) { conditions.push(`c.contractor_name ilike $${idx++}`); params.push(`%${name}%`); }
  if (referrer) { conditions.push(`c.referrer_name ilike $${idx++}`); params.push(`%${referrer}%`); }
  if (contractType === "점주점장") { conditions.push(`c.is_appointment = false`); }
  else if (contractType === "임용") { conditions.push(`c.is_appointment = true`); }
  const where = conditions.length ? `where ${conditions.join(" and ")}` : "";
  try {
    const result = await pool.query(
      `select cc.id, cc.contract_id, cc.at, cc.before_text, cc.after_text, cc.reason,
              cc.changed_fields, cc.apply_month, cc.applied,
              c.contractor_name, c.referrer_name, c.is_appointment
       from contract_changes cc
       join contracts c on c.id = cc.contract_id
       ${where}
       order by cc.at desc
       limit 500`,
      params
    );
    res.json({ rows: result.rows });
  } catch (error) {
    res.status(500).json({ message: String(error) });
  }
});

// 특정 월 미적용 변경건 조회
app.get("/changes/pending", async (req, res) => {
  const { month } = req.query;
  if (!month) return res.status(400).json({ message: "month required" });
  try {
    const result = await pool.query(
      `select cc.id, cc.contract_id, cc.at, cc.before_text, cc.after_text, cc.reason,
              cc.changed_fields, cc.apply_month, cc.applied,
              c.contractor_name, c.referrer_name, c.is_appointment
       from contract_changes cc
       join contracts c on c.id = cc.contract_id
       where cc.apply_month = $1 and cc.applied = false
       order by cc.at desc`,
      [month]
    );
    res.json({ rows: result.rows });
  } catch (error) {
    res.status(500).json({ message: String(error) });
  }
});

// 변경건 적용완료 처리
app.patch("/changes/:id/applied", async (req, res) => {
  const { id } = req.params;
  const { applied } = req.body ?? {};
  try {
    await pool.query("update contract_changes set applied = $1 where id = $2", [applied !== false, id]);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ message: String(error) });
  }
});

// 변경이력 삭제
app.delete("/changes/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query("delete from contract_changes where id = $1", [id]);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ message: String(error) });
  }
});

// ── Staging & Drive Verification ──────────────────────────────────────────

app.get("/drive/files", async (_req, res) => {
  try {
    const drive = await getDriveClient();
    const files = await listDriveFilesRecursive(drive, DRIVE_ROOT_FOLDER);
    res.json({ rows: files });
  } catch (error) {
    // Fallback to drive_all.json if API fails
    try {
      const fs = require("fs");
      const path = require("path");
      const driveAllPath = path.join(__dirname, "..", "drive_all.json");
      if (fs.existsSync(driveAllPath)) {
        const data = JSON.parse(fs.readFileSync(driveAllPath, "utf8"));
        return res.json({ rows: data.files || [] });
      }
    } catch (e) {}
    res.status(500).json({ message: String(error) });
  }
});

app.get("/drive/stream/:fileId", async (req, res) => {
  const { fileId } = req.params;
  try {
    await streamDriveFile(fileId, res);
  } catch (error) {
    res.status(500).send(String(error));
  }
});

app.post("/staging/import", async (req, res) => {
  const { filePath } = req.body;
  if (!filePath) return res.status(400).json({ message: "filePath required" });
  
  const fs = require("fs");
  const xlsx = require("xlsx");
  if (!fs.existsSync(filePath)) return res.status(404).json({ message: "file not found" });

  try {
    const wb = xlsx.readFile(filePath);
    const sheetName = wb.SheetNames[0];
    const ws = wb.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(ws, { header: 1 });
    
    // Headers: ['', '계약구분', '소속', '추천인', '성명', '보증금(원)', '수익금(원)', '최초지급일', '계약일', '은행명', '계좌번호', '예금주', '주민등록번호', '핸드폰번호', '계약만료일', '계약서번호', '현금/카드', '비고']
    const rows = [];
    for (let i = 1; i < data.length; i++) {
      const r = data[i];
      if (!r || !r[4]) continue; // Skip if no name
      rows.push({
        status: r[0],
        type: r[1],
        affiliation: r[2],
        ref: r[3],
        name: r[4],
        deposit: r[5],
        allowance: r[6],
        payoutDate: excelDateToIso(r[7]),
        contractDate: excelDateToIso(r[8]),
        bankName: r[9],
        accountNo: r[10],
        accountHolder: r[11],
        rrn: r[12],
        phone: r[13],
        endDate: excelDateToIso(r[14]),
        no: r[15],
        remarks: r[17]
      });
    }

    await pool.query("delete from staging_contract_rows");
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      await pool.query(
        `insert into staging_contract_rows 
         (batch_id, row_no, contract_no, contract_name, contractor_name, first_allowance_date, raw_payload)
         values (0, $1, $2, $3, $4, $5, $6)`,
        [i + 1, r.no || null, r.type || null, r.name, r.payoutDate || null, JSON.stringify(r)]
      );
    }

    res.json({ ok: true, count: rows.length });
  } catch (error) {
    res.status(500).json({ message: String(error) });
  }
});

app.get("/staging/search", async (req, res) => {
  const { name } = req.query;
  if (!name) return res.json({ rows: [] });
  try {
    const result = await pool.query(
      "select * from staging_contract_rows where contractor_name ilike $1 order by row_no",
      [`%${name}%`]
    );
    res.json({ rows: result.rows });
  } catch (error) {
    res.status(500).json({ message: String(error) });
  }
});

app.delete("/staging/clear", async (_req, res) => {
  try {
    await pool.query("delete from staging_contract_rows");
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ message: String(error) });
  }
});

app.get("/contracts/:id/pdf", async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query("select contractor_name, pdf_storage_path from contracts where id = $1", [id]);
    if (result.rowCount === 0) return res.status(404).send("Contract not found in database");

    const { contractor_name, pdf_storage_path } = result.rows[0];

    // contract_documents에서 최신 파일 조회
    const docResult = await pool.query(
      "select storage_path, drive_file_id from contract_documents where contract_id = $1 and deleted_at is null order by created_at desc limit 1",
      [id]
    );
    if (docResult.rowCount > 0) {
      const { storage_path, drive_file_id } = docResult.rows[0];
      if (drive_file_id) {
        return streamDriveFile(drive_file_id, res);
      }
      if (storage_path) {
        const file = bucket.file(storage_path);
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", "inline");
        return file.createReadStream()
          .on("error", (err) => res.status(500).send(String(err)))
          .pipe(res);
      }
    }

    // 레거시 fallback: pdf_storage_path 직접 사용
    if (pdf_storage_path) {
      const file = bucket.file(pdf_storage_path);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", "inline");
      return file.createReadStream()
        .on("error", (err) => res.status(500).send(String(err)))
        .pipe(res);
    }

    // 없으면 계약자명으로 로컬 파일 검색 (레거시 fallback)
    const fs = require("fs");
    const path = require("path");
    const dataRoot = path.join(__dirname, "data");
    const cleanName = (contractor_name || "").trim();

    function findFileRecursive(dir) {
      if (!fs.existsSync(dir)) return null;
      const items = fs.readdirSync(dir);
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          const found = findFileRecursive(fullPath);
          if (found) return found;
        } else if (item.toLowerCase().endsWith(".pdf") && item.includes(cleanName)) {
          return fullPath;
        }
      }
      return null;
    }

    const filePath = findFileRecursive(dataRoot);
    if (!filePath) return res.status(404).send(`PDF file not found for contractor [${cleanName}]`);

    res.setHeader("Content-Type", "application/pdf");
    res.sendFile(filePath);
  } catch (error) {
    res.status(500).send(String(error));
  }
});

app.post("/contracts/:id/pdf", async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query("select contractor_name from contracts where id = $1", [id]);
    if (result.rowCount === 0) return res.status(404).json({ ok: false, message: "Contract not found" });

    const { filename, data, mimeType, reason } = req.body || {};
    if (!filename || !data) return res.status(400).json({ ok: false, message: "filename, data 필수" });

    const buffer = Buffer.from(data, "base64");
    const safeName = filename.replace(/[#[\]*?]/g, "_");

    // Drive 업로드 시도, 실패 시 Firebase Storage fallback
    let driveFileId = null;
    let storagePath = null;
    try {
      const drive = await getDriveClient();
      const contractRow = await pool.query("select first_allowance_date, contract_date from contracts where id = $1", [id]);
      const dateVal = contractRow.rows[0]?.first_allowance_date || contractRow.rows[0]?.contract_date;
      const year = dateVal ? new Date(dateVal).getFullYear() : new Date().getFullYear();
      const yearFolderId = await getOrCreateYearFolder(drive, year);
      const { Readable } = require("stream");
      const stream = Readable.from(buffer);
      const uploadRes = await drive.files.create({
        requestBody: { name: safeName, parents: [yearFolderId] },
        media: { mimeType: mimeType || "application/pdf", body: stream },
        fields: "id",
      });
      driveFileId = uploadRes.data.id;
    } catch (driveErr) {
      // Drive 업로드 실패 시 Firebase Storage로 fallback
      console.error("Drive upload failed, falling back to Firebase Storage:", driveErr.message);
      storagePath = `contracts/${id}/${Date.now()}_${safeName}`;
      const file = bucket.file(storagePath);
      await file.save(buffer, { metadata: { contentType: mimeType || "application/pdf" } });
    }

    await pool.query(
      "insert into contract_documents (contract_id, storage_path, original_file_name, original_name, file_type, reason, drive_file_id) values ($1, $2, $3, $3, 'CONTRACT_PDF', $4, $5)",
      [id, storagePath || "", filename, reason || "파일등록", driveFileId]
    );
    res.json({ ok: true, driveFileId, path: storagePath });
  } catch (error) {
    res.status(500).json({ ok: false, message: String(error) });
  }
});

app.get("/contracts/:id/documents", async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      "select id, storage_path, drive_file_id, coalesce(original_name, original_file_name) as original_name, reason, created_at from contract_documents where contract_id = $1 and deleted_at is null order by coalesce(original_name, original_file_name) asc, created_at asc",
      [id]
    );
    res.json({
      rows: result.rows.map((r) => ({
        id: r.id,
        storagePath: r.storage_path,
        driveFileId: r.drive_file_id || null,
        originalName: r.original_name || (r.storage_path || "").split("/").pop(),
        reason: r.reason || "",
        uploadedAt: r.created_at ? toIsoDate(r.created_at) : ""
      }))
    });
  } catch (error) {
    res.status(500).json({ ok: false, message: String(error) });
  }
});

app.delete("/contracts/:id/documents/:docId", async (req, res) => {
  const { id, docId } = req.params;
  const { requester } = req.body ?? {};
  try {
    await ensureAppSchema();
    const docResult = await pool.query(
      "select coalesce(original_name, original_file_name) as original_name from contract_documents where id = $1 and contract_id = $2 and deleted_at is null",
      [docId, id]
    );
    if (docResult.rowCount === 0) return res.status(404).json({ ok: false, message: "Document not found" });
    const originalName = docResult.rows[0].original_name || `doc-${docId}`;
    await pool.query("update contract_documents set deleted_at = now() where id = $1", [docId]);
    const changedFields = [{ field: "계약서 파일", before: originalName, after: "삭제됨" }];
    await pool.query(
      "insert into contract_changes (contract_id, before_text, after_text, reason, changed_fields) values ($1, $2, $3, $4, $5)",
      [id, `계약서 파일:${originalName}`, "삭제됨", `파일 삭제 (${requester || "관리자"})`, JSON.stringify(changedFields)]
    );
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ ok: false, message: String(error) });
  }
});

app.get("/contracts/:id/documents/:docId/pdf", async (req, res) => {
  const { docId } = req.params;
  try {
    const result = await pool.query("select storage_path, drive_file_id from contract_documents where id = $1", [docId]);
    if (result.rowCount === 0) return res.status(404).send("Document not found");
    const { storage_path, drive_file_id } = result.rows[0];

    if (drive_file_id) {
      return streamDriveFile(drive_file_id, res);
    }
    // Firebase Storage fallback
    const file = bucket.file(storage_path);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "inline");
    file.createReadStream().on("error", (err) => res.status(500).send(String(err))).pipe(res);
  } catch (error) {
    res.status(500).send(String(error));
  }
});

app.patch("/contracts/:id/pdf-path", async (req, res) => {
  const { id } = req.params;
  const { pdfStoragePath } = req.body;
  try {
    await pool.query("update contracts set pdf_storage_path = $1 where id = $2", [pdfStoragePath, id]);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ ok: false, message: String(error) });
  }
});

// ── Admin: Drive 파일 목록 조회 ──────────────────────────────────────────
app.get("/admin/drive-files", async (_req, res) => {
  try {
    const drive = await getDriveClient();
    const files = await listDriveFilesRecursive(drive, DRIVE_ROOT_FOLDER);
    res.json({ count: files.length, files: files.map((f) => ({ id: f.id, name: f.name })) });
  } catch (error) {
    res.status(500).json({ ok: false, message: String(error) });
  }
});

// ── Admin: 엑셀 일괄 등록 + Drive 자동 매칭 ──
app.post("/admin/import-excel", async (req, res) => {
  try {
    await ensureAppSchema();
    const { data } = req.body || {};
    if (!data) return res.status(400).json({ ok: false, message: "data 필수" });

    const XLSX = require("xlsx");
    const buffer = Buffer.from(data, "base64");
    const wb = XLSX.read(buffer, { type: "buffer" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

    function excelDateToIso(val) {
      if (!val || typeof val !== "number") return null;
      const d = XLSX.SSF.parse_date_code(val);
      if (!d) return null;
      return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
    }

    // 헤더 행(0번) 제외, 계약구분 === 'LAS매장점주' & 성명 있는 행만
    const dataRows = rows.slice(1).filter(r => String(r[1] || "").trim() === "LAS매장점주" && String(r[4] || "").trim());

    const inserted = [];
    const skipped = [];

    for (const row of dataRows) {
      const note     = String(row[0] || "").trim();
      const name     = String(row[4] || "").trim();
      const deposit  = typeof row[5] === "number" ? row[5] : null;
      const allowance = typeof row[6] === "number" ? row[6] : null;
      const firstAllowanceDate = excelDateToIso(row[7]);
      const contractDate       = excelDateToIso(row[8]);
      const bankName    = String(row[9]  || "").trim() || null;
      const accountNo   = String(row[10] || "").trim() || null;
      const accountHolder = String(row[11] || "").trim() || null;
      const ssn         = String(row[12] || "").trim() || null;
      const phone       = String(row[13] || "").trim() || null;
      const endDate     = excelDateToIso(row[14]);
      const contractNo  = String(row[15] || "").trim() || null;
      const referrer    = String(row[3]  || "").trim() || null;
      const affiliation = String(row[2]  || "").trim() || null;
      const remarks     = String(row[17] || "").trim() || null;

      let status = "정상운영";
      if (note.includes("폐기")) status = "폐기";
      else if (note.includes("양도")) status = "양도";
      else if (note.includes("양수")) status = "양수";
      else if (note.includes("증액")) status = "증액";
      else if (note.includes("감액")) status = "감액";

      if (!name || !contractDate) { skipped.push({ name, reason: "이름·계약일 없음" }); continue; }

      const dup = await pool.query(
        "SELECT id FROM contracts WHERE contractor_name = $1 AND contract_date::date = $2::date",
        [name, contractDate]
      );
      if (dup.rowCount > 0) { skipped.push({ name, contractDate, reason: "중복" }); continue; }

      const r = await pool.query(
        `INSERT INTO contracts (
          contract_no, contractor_name, contract_name, referrer_name,
          contract_date, first_allowance_date, contract_end_date,
          deposit_amount, work_allowance, bank_name, account_no, account_holder,
          resident_registration_number, phone, affiliation, status, remarks, is_appointment
        ) VALUES ($1,$2,'LAS매장점주',$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,false)
        RETURNING id`,
        [contractNo, name, referrer, contractDate, firstAllowanceDate, endDate,
         deposit, allowance, bankName, accountNo, accountHolder, ssn, phone, affiliation, status, remarks]
      );
      inserted.push({ id: Number(r.rows[0].id), name, contractDate, firstAllowanceDate });
    }

    // 신규 등록된 계약에 대해 Drive 자동 매칭
    let driveMatched = 0;
    if (inserted.length > 0) {
      try {
        const drive = await getDriveClient();
        const driveFiles = await listDriveFilesRecursive(drive, DRIVE_ROOT_FOLDER);
        const pdfFiles = driveFiles.filter(f => f.name.toLowerCase().endsWith(".pdf"));
        const existingDrive = await pool.query("SELECT drive_file_id FROM contract_documents WHERE drive_file_id IS NOT NULL");
        const existingIds = new Set(existingDrive.rows.map(r => r.drive_file_id));

        const normalize = s => String(s || "").trim().replace(/\s+/g, "");
        const dateDiffDays = (a, b) => !a || !b ? Infinity : Math.abs(new Date(a) - new Date(b)) / 86400000;

        function extractName(filename) {
          const base = filename.replace(/\.pdf$/i, "");
          const parts = base.split("_");
          let namePart = parts[parts.length - 1];
          if (/^\d+$/.test(namePart) && parts.length >= 4) namePart = parts[parts.length - 2];
          return namePart.replace(/[（(（][^）)）]*[）)）]/g, "").replace(/[;.]/g, "").trim();
        }
        function extractDate(filename) {
          const base = filename.replace(/\.pdf$/i, "");
          const parts = base.split("_");
          let namePart = parts[parts.length - 1];
          let datePart = parts[parts.length - 2];
          if (/^\d+$/.test(namePart) && parts.length >= 4) datePart = parts[parts.length - 3];
          return /^\d{8}$/.test(datePart)
            ? `${datePart.slice(0,4)}-${datePart.slice(4,6)}-${datePart.slice(6,8)}`
            : null;
        }

        for (const f of pdfFiles) {
          if (existingIds.has(f.id)) continue;
          const driveName = normalize(extractName(f.name));
          const driveDate = extractDate(f.name);

          const candidate = inserted.find(c => {
            if (normalize(c.name) !== driveName) return false;
            if (driveDate) {
              return c.contractDate === driveDate ||
                     c.firstAllowanceDate === driveDate ||
                     dateDiffDays(c.firstAllowanceDate, driveDate) <= 7;
            }
            return true;
          });

          if (candidate) {
            await pool.query(
              "INSERT INTO contract_documents (contract_id, storage_path, original_file_name, original_name, file_type, reason, drive_file_id) VALUES ($1,'', $2, $2, 'CONTRACT_PDF', 'Drive연동', $3)",
              [candidate.id, f.name, f.id]
            );
            existingIds.add(f.id);
            driveMatched++;
          }
        }
      } catch (e) {
        console.error("Drive match 오류:", e.message);
      }
    }

    res.json({ ok: true, inserted: inserted.length, skipped: skipped.length, driveMatched, skippedList: skipped });
  } catch (error) {
    res.status(500).json({ ok: false, message: String(error) });
  }
});

// ── Admin: Drive 파일 ↔ DB 계약 자동 매칭 후 contract_documents 등록 ──
app.post("/admin/drive-match", async (_req, res) => {
  try {
    await ensureAppSchema();
    const drive = await getDriveClient();

    // 1. Drive 파일 전체 목록
    const driveFiles = await listDriveFilesRecursive(drive, DRIVE_ROOT_FOLDER);
    const pdfFiles = driveFiles.filter((f) => f.name.toLowerCase().endsWith(".pdf"));

    // 2. DB 계약 전체 목록
    const dbResult = await pool.query(
      "select id, contractor_name, first_allowance_date, contract_date from contracts where is_appointment = false and contractor_name is not null"
    );
    const contracts = dbResult.rows;

    // 3. 이미 drive_file_id가 등록된 목록 (중복 방지)
    const existingDrive = await pool.query("select drive_file_id from contract_documents where drive_file_id is not null");
    const existingIds = new Set(existingDrive.rows.map((r) => r.drive_file_id));

    const normalize = (s) => String(s || "").trim().replace(/\s+/g, "");

    // 파일명에서 계약자명 추출: 계약서명_yyyymmdd_계약자명[_숫자].pdf
    function extractFromFilename(name) {
      const base = name.replace(/\.pdf$/i, "");
      const parts = base.split("_");

      // 마지막 부분이 순수 숫자면 (_1, _2 등) 앞에서 이름 찾기
      let namePart = parts[parts.length - 1];
      let datePart = parts[parts.length - 2];
      if (/^\d+$/.test(namePart) && parts.length >= 4) {
        namePart = parts[parts.length - 2];
        datePart = parts[parts.length - 3];
      }

      // 이름 정리: 괄호 및 내용 전체 제거, 세미콜론/점 제거
      const cleanName = namePart
        .replace(/[（(（][^）)）]*[）)）]/g, "")
        .replace(/[;.]/g, "")
        .trim();

      if (parts.length >= 3 && /^\d{8}$/.test(datePart)) {
        const iso = `${datePart.slice(0,4)}-${datePart.slice(4,6)}-${datePart.slice(6,8)}`;
        return { contractorName: cleanName, dateIso: iso };
      }
      return { contractorName: cleanName, dateIso: null };
    }

    const matched = [];
    const unmatched = [];
    const matchedContractIds = new Set();

    const dateDiffDays = (isoA, isoB) => {
      if (!isoA || !isoB) return Infinity;
      return Math.abs(new Date(isoA) - new Date(isoB)) / 86400000;
    };

    for (const f of pdfFiles) {
      if (existingIds.has(f.id)) continue;
      const { contractorName, dateIso } = extractFromFilename(f.name);
      const normName = normalize(contractorName);

      // 1순위: 이름 + 정확한 날짜 매칭 (계약일 또는 최초수당지급일)
      let contract = null;
      if (dateIso) {
        contract = contracts.find(
          (c) => normalize(c.contractor_name) === normName &&
            !matchedContractIds.has(c.id) &&
            (toIsoDate(c.first_allowance_date) === dateIso || toIsoDate(c.contract_date) === dateIso)
        );
      }
      // 2순위: 이름 + 최초수당지급일 ±7일 퍼지 매칭 (후보 1건일 때만)
      if (!contract && dateIso) {
        const candidates = contracts.filter(
          (c) => normalize(c.contractor_name) === normName &&
            !matchedContractIds.has(c.id) &&
            dateDiffDays(toIsoDate(c.first_allowance_date), dateIso) <= 7
        );
        if (candidates.length === 1) contract = candidates[0];
      }
      // 3순위: 이름만으로 매칭 (유일한 경우)
      if (!contract) {
        const nameMatches = contracts.filter((c) => normalize(c.contractor_name) === normName && !matchedContractIds.has(c.id));
        if (nameMatches.length === 1) contract = nameMatches[0];
      }
      // 4순위: 동일인 다중계약 → 날짜 가장 가까운 계약에 연결 (±60일)
      if (!contract) {
        const nameMatches = contracts.filter((c) => normalize(c.contractor_name) === normName && !matchedContractIds.has(c.id));
        if (nameMatches.length > 1 && dateIso) {
          const sorted = nameMatches
            .map(c => ({ c, diff: Math.min(dateDiffDays(toIsoDate(c.first_allowance_date), dateIso), dateDiffDays(toIsoDate(c.contract_date), dateIso)) }))
            .sort((a, b) => a.diff - b.diff);
          if (sorted[0].diff <= 60) contract = sorted[0].c;
        }
      }

      if (contract) {
        matchedContractIds.add(contract.id);
        await pool.query(
          "insert into contract_documents (contract_id, storage_path, original_file_name, original_name, file_type, reason, drive_file_id) values ($1, '', $2, $2, 'CONTRACT_PDF', 'Drive연동', $3)",
          [contract.id, f.name, f.id]
        );
        matched.push({ driveFile: f.name, contractId: contract.id, contractorName: contract.contractor_name });
      } else {
        unmatched.push({ driveFile: f.name, extractedName: contractorName, dateIso });
      }
    }

    res.json({ ok: true, matched: matched.length, unmatched: unmatched.length, unmatchedList: unmatched, matchedList: matched });
  } catch (error) {
    res.status(500).json({ ok: false, message: String(error) });
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
    res.json({ rows: result.rows.map((r) => ({ id: Number(r.id), name: r.name, contractYears: r.contract_years, payoutMonths: r.payout_months, rules: r.rules })) });
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

// 대사 작업용 계약 목록 (PDF 연결 여부, 확인 여부 포함)
app.get("/admin/audit-list", async (_req, res) => {
  try {
    await ensureAppSchema();
    const result = await pool.query(`
      select c.id, c.contractor_name, c.status, c.contract_name,
        to_char(c.contract_date,'YYYY-MM-DD') contract_date,
        to_char(c.first_allowance_date,'YYYY-MM-DD') first_allowance_date,
        c.deposit_amount, c.work_allowance, c.referrer_name, c.affiliation,
        c.bank_name, c.account_no, c.account_holder, c.phone, c.remarks,
        c.verified_at, c.tags, c.meta_memo, c.transferred_from_id,
        count(d.id) filter (where d.deleted_at is null) as doc_count,
        (select contractor_name from contracts where id = c.transferred_from_id) as transferred_from_name
      from contracts c
      left join contract_documents d on d.contract_id = c.id
      where c.is_appointment = false
      group by c.id
      order by c.first_allowance_date asc nulls last, c.id asc
    `);
    res.json({ rows: result.rows });
  } catch (error) { res.status(500).json({ message: String(error) }); }
});

// 계약 메타 저장 (대사 작업용)
app.put("/contracts/:id/meta", async (req, res) => {
  try {
    await ensureAppSchema();
    const { id } = req.params;
    const { verified, tags, meta_memo, transferred_from_id, page_range, doc_id } = req.body ?? {};
    await pool.query(`
      update contracts set
        verified_at = case when $2::boolean then coalesce(verified_at, now()) else null end,
        tags = $3::text[],
        meta_memo = $4,
        transferred_from_id = $5
      where id = $1
    `, [id, !!verified, tags || [], meta_memo || null, transferred_from_id || null]);
    if (doc_id && page_range !== undefined) {
      await pool.query("update contract_documents set page_range = $1 where id = $2", [page_range || null, doc_id]);
    }
    res.json({ ok: true });
  } catch (error) { res.status(500).json({ message: String(error) }); }
});

// Drive 파일 검색 (관리자용)
app.post("/admin/drive-search", async (req, res) => {
  try {
    const { query } = req.body ?? {};
    if (!query) return res.status(400).json({ error: "query required" });
    const drive = await getDriveClient();
    const allFiles = await listDriveFilesRecursive(drive, DRIVE_ROOT_FOLDER);
    const filtered = allFiles.filter(f => f.name.includes(query));
    res.json({ files: filtered.map(f => ({ id: f.id, name: f.name })) });
  } catch (error) { res.status(500).json({ message: String(error) }); }
});

// Drive 파일을 계약에 수동 연결 (관리자용)
app.post("/admin/link-document", async (req, res) => {
  try {
    const { contract_id, drive_file_id, file_name } = req.body ?? {};
    if (!contract_id || !drive_file_id) return res.status(400).json({ error: "contract_id, drive_file_id required" });
    await ensureAppSchema();
    await pool.query(
      "insert into contract_documents (contract_id, storage_path, original_file_name, original_name, file_type, reason, drive_file_id) values ($1,'', $2, $2, 'CONTRACT_PDF', 'Drive연동(수동)', $3)",
      [contract_id, file_name || "", drive_file_id]
    );
    res.json({ ok: true, contract_id, drive_file_id, file_name });
  } catch (error) { res.status(500).json({ message: String(error) }); }
});

exports.api = onRequest({ cors: true }, app);
