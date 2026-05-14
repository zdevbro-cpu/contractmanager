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

app.get("/contracts/:id/pdf", async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query("select contractor_name, pdf_storage_path from contracts where id = $1", [id]);
    if (result.rowCount === 0) return res.status(404).send("Contract not found in database");

    const { contractor_name, pdf_storage_path } = result.rows[0];

    // contract_documents에서 최신 파일 조회
    const docResult = await pool.query(
      "select storage_path from contract_documents where contract_id = $1 order by created_at desc limit 1",
      [id]
    );
    if (docResult.rowCount > 0) {
      const file = bucket.file(docResult.rows[0].storage_path);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", "inline");
      return file.createReadStream()
        .on("error", (err) => res.status(500).send(String(err)))
        .pipe(res);
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
      "select id, storage_path, drive_file_id, coalesce(original_name, original_file_name) as original_name, reason, created_at from contract_documents where contract_id = $1 and deleted_at is null order by created_at desc",
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

    for (const f of pdfFiles) {
      if (existingIds.has(f.id)) continue;
      const { contractorName, dateIso } = extractFromFilename(f.name);
      const normName = normalize(contractorName);

      // 이름 + 날짜로 매칭
      let contract = null;
      if (dateIso) {
        contract = contracts.find(
          (c) => normalize(c.contractor_name) === normName &&
            !matchedContractIds.has(c.id) &&
            (toIsoDate(c.first_allowance_date) === dateIso || toIsoDate(c.contract_date) === dateIso)
        );
      }
      // 이름만으로 매칭 (유일한 경우)
      if (!contract) {
        const nameMatches = contracts.filter((c) => normalize(c.contractor_name) === normName && !matchedContractIds.has(c.id));
        if (nameMatches.length === 1) contract = nameMatches[0];
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

exports.api = onRequest({ cors: true }, app);
