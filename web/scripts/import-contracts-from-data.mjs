import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import xlsx from "xlsx";
import pg from "pg";

const { Client } = pg;

const rootDir = path.resolve(process.cwd(), "..");
const dataDir = path.resolve(rootDir, "data");
const databaseSchemaPath = path.resolve(rootDir, "database", "schema.sql");
const outDir = path.resolve(rootDir, "reports", "import");
const filePattern = /^(.+)_([0-9]{8})_(.+)\.pdf$/i;
const defaultContractName = process.env.DEFAULT_CONTRACT_NAME ?? "LAS점주점장계약서";

function normalizeText(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

function isSummaryName(value) {
  return normalizeText(value).replace(/\s/g, "") === "??";
}

function yyyymmddToIso(value) {
  if (!/^\d{8}$/.test(value)) return "";
  const iso = `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  if (d.getFullYear() !== Number(value.slice(0, 4))) return "";
  if (d.getMonth() + 1 !== Number(value.slice(4, 6))) return "";
  if (d.getDate() !== Number(value.slice(6, 8))) return "";
  return iso;
}

function normalizeDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const parsed = xlsx.SSF.parse_date_code(value);
    if (parsed && parsed.y && parsed.m && parsed.d) {
      const y = String(parsed.y);
      const m = String(parsed.m).padStart(2, "0");
      const d = String(parsed.d).padStart(2, "0");
      return yyyymmddToIso(`${y}${m}${d}`);
    }
  }
  const v = String(value ?? "").trim();
  if (!v) return "";
  if (/^\d{5,6}$/.test(v)) {
    const serial = Number(v);
    if (Number.isFinite(serial)) {
      const parsed = xlsx.SSF.parse_date_code(serial);
      if (parsed && parsed.y && parsed.m && parsed.d) {
        const y = String(parsed.y);
        const m = String(parsed.m).padStart(2, "0");
        const d = String(parsed.d).padStart(2, "0");
        return yyyymmddToIso(`${y}${m}${d}`);
      }
    }
  }
  if (/^\d{8}$/.test(v)) return yyyymmddToIso(v);
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return yyyymmddToIso(v.replaceAll("-", ""));
  if (/^\d{4}\.\d{1,2}\.\d{1,2}$/.test(v)) {
    const [y, m, d] = v.split(".");
    const date8 = `${y}${m.padStart(2, "0")}${d.padStart(2, "0")}`;
    return yyyymmddToIso(date8);
  }
  return "";
}

function buildMatchKey(contractName, firstAllowanceDate, contractorName) {
  return `${normalizeText(contractName)}|${firstAllowanceDate}|${normalizeText(contractorName)}`;
}

function formatNumberWithCommas(value) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (!digits) return "";
  return Number(digits).toLocaleString("ko-KR");
}

function scanFilesRecursive(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const results = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...scanFilesRecursive(full));
      continue;
    }
    results.push(full);
  }
  return results;
}

function parsePdfFileName(fileName) {
  const m = fileName.match(filePattern);
  if (!m) return { ok: false, error: "INVALID_FILENAME" };
  const contractName = m[1].trim();
  const firstAllowanceDate = yyyymmddToIso(m[2]);
  const contractorName = m[3].trim();
  if (!firstAllowanceDate) return { ok: false, error: "INVALID_DATE" };
  if (!contractName || !contractorName) return { ok: false, error: "EMPTY_FIELD" };
  return {
    ok: true,
    contractName,
    firstAllowanceDate,
    contractorName,
    matchKey: buildMatchKey(contractName, firstAllowanceDate, contractorName)
  };
}

function pick(row, keys) {
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== "") return row[k];
  }
  return "";
}

function rowsFromWorksheet(ws) {
  const grid = xlsx.utils.sheet_to_json(ws, { header: 1, defval: "" });
  const headerRowIndex = grid.findIndex((r) => Array.isArray(r) && r.some((c) => String(c).includes("성명")) && r.some((c) => String(c).includes("최초")));
  if (headerRowIndex < 0) return [];
  const headers = grid[headerRowIndex].map((x) => String(x).trim());
  const rows = [];
  for (let i = headerRowIndex + 1; i < grid.length; i += 1) {
    const line = grid[i];
    if (!line || line.every((c) => String(c).trim() === "")) continue;
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h || `__COL_${idx}`] = line[idx] ?? "";
    });
    rows.push(obj);
  }
  return rows;
}

function rowsFromWorkbook(wb) {
  const monthSheetName = /^\d{1,2}월$/;
  const rows = [];
  for (const sheetName of wb.SheetNames) {
    if (!monthSheetName.test(sheetName)) continue;
    const ws = wb.Sheets[sheetName];
    const sheetRows = rowsFromWorksheet(ws).map((r) => ({ ...r, __sheetName: sheetName }));
    rows.push(...sheetRows);
  }
  return rows;
}

function toCsv(rows) {
  const escape = (v) => `"${String(v ?? "").replaceAll('"', '""')}"`;
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const head = headers.map(escape).join(",");
  const body = rows.map((r) => headers.map((h) => escape(r[h])).join(",")).join("\n");
  return `${head}\n${body}\n`;
}

function safeWriteReport(preferredPath, content) {
  const dir = path.dirname(preferredPath);
  const ext = path.extname(preferredPath);
  const base = preferredPath.slice(0, -ext.length);
  const candidates = [
    preferredPath,
    `${base}_${Date.now()}${ext}`,
    path.join(process.cwd(), `matching_result_${Date.now()}.csv`)
  ];
  for (const p of candidates) {
    try {
      fs.mkdirSync(path.dirname(p), { recursive: true });
      fs.writeFileSync(p, content, "utf8");
      return p;
    } catch {
      // try next
    }
  }
  throw new Error(`리포트 파일 저장 실패: ${dir}`);
}

async function ensureSchema(client) {
  const schema = fs.readFileSync(databaseSchemaPath, "utf8");
  await client.query(schema);
}

async function main() {
  const apply = process.argv.includes("--apply");
  const batchFile = scanFilesRecursive(dataDir).find((x) => x.toLowerCase().endsWith(".xlsx"));
  if (!batchFile) throw new Error("data 폴더에서 xlsx 파일을 찾지 못했습니다.");

  const allFiles = scanFilesRecursive(dataDir);
  const pdfFiles = allFiles.filter((x) => x.toLowerCase().endsWith(".pdf"));
  const pdfByKey = new Map();
  const pdfIssues = [];
  for (const full of pdfFiles) {
    const parsed = parsePdfFileName(path.basename(full));
    if (!parsed.ok) {
      pdfIssues.push({ fileName: path.basename(full), issue: parsed.error });
      continue;
    }
    const arr = pdfByKey.get(parsed.matchKey) ?? [];
    arr.push(full);
    pdfByKey.set(parsed.matchKey, arr);
  }

  const wb = xlsx.readFile(batchFile);
  const rawRows = rowsFromWorkbook(wb);
  const mapped = rawRows.map((r, i) => {
    const contractName = String(pick(r, ["계약서명", "계약명", "계약종류"])).trim() || defaultContractName;
    const firstAllowanceDate = normalizeDate(pick(r, ["최초수당지급일", "수당지급일", "최초지급일"]));
    const contractorName = String(pick(r, ["계약자명", "성명", "이름"])).trim();
    const contractNo = String(pick(r, ["계약번호"])).trim();
    const contractDate = normalizeDate(pick(r, ["계약일", "계약일자", "입금일/결제일"]));
    const depositAmount = formatNumberWithCommas(pick(r, ["보증금액", "보증금", "보증금액(원)", "보증금(원)"]));
    const workDays = String(pick(r, ["근무일수", "근무여부"])).trim();
    const workAllowance = formatNumberWithCommas(pick(r, ["근무수당(원)", "수당", "근무수당", "수익금(원)"]));
    const phone = String(pick(r, ["연락처", "전화번호", "핸드폰번호"])).trim();
    const key = contractName && firstAllowanceDate && contractorName
      ? buildMatchKey(contractName, firstAllowanceDate, contractorName)
      : "";
    return {
      rowNo: i + 2,
      contractNo,
      contractName,
      contractorName,
      firstAllowanceDate,
      contractDate,
      depositAmount,
      workDays,
      workAllowance,
      phone,
      matchKey: key
    };
  });

  const results = mapped.map((r) => {
    if (isSummaryName(r.contractorName)) {
      return { ...r, matchStatus: "REVIEW_REQUIRED", errorCode: "SUMMARY_ROW", errorReason: "?? ???", matchedPdfFile: "" };
    }
    if (!r.contractName || !r.firstAllowanceDate || !r.contractorName) {
      return { ...r, matchStatus: "REVIEW_REQUIRED", errorCode: "MISSING_REQUIRED", errorReason: "필수값 누락", matchedPdfFile: "" };
    }
    const cands = pdfByKey.get(r.matchKey) ?? [];
    if (cands.length === 1) {
      return { ...r, matchStatus: "MATCHED", errorCode: "", errorReason: "", matchedPdfFile: path.basename(cands[0]) };
    }
    if (cands.length > 1) {
      return { ...r, matchStatus: "DUPLICATE_PDF", errorCode: "DUPLICATE_PDF", errorReason: "동일 키 PDF 복수", matchedPdfFile: "" };
    }
    return { ...r, matchStatus: "UNMATCHED_ROW", errorCode: "UNMATCHED_ROW", errorReason: "매칭 PDF 없음", matchedPdfFile: "" };
  });

  fs.mkdirSync(outDir, { recursive: true });
  const now = new Date();
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}_${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}`;
  const reportPath = safeWriteReport(path.join(outDir, `matching_result_${stamp}.csv`), toCsv(results));

  const summary = {
    totalRows: results.length,
    matched: results.filter((r) => r.matchStatus === "MATCHED").length,
    review: results.filter((r) => r.matchStatus === "REVIEW_REQUIRED").length,
    unmatched: results.filter((r) => r.matchStatus === "UNMATCHED_ROW").length,
    duplicatePdf: results.filter((r) => r.matchStatus === "DUPLICATE_PDF").length,
    invalidPdfFiles: pdfIssues.length,
    reportPath
  };

  if (!apply) {
    console.log(JSON.stringify({ mode: "dry-run", summary }, null, 2));
    return;
  }

  const client = new Client({
    host: process.env.PGHOST,
    port: Number(process.env.PGPORT ?? 5432),
    database: process.env.PGDATABASE,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    ssl: process.env.PGSSL === "true" ? { rejectUnauthorized: false } : false
  });

  await client.connect();
  try {
    await client.query("begin");
    await ensureSchema(client);
    const batchRes = await client.query(
      `insert into import_batches (source_file_name,status,total_rows,matched_rows,review_rows,failed_rows,created_by)
       values ($1,$2,$3,$4,$5,$6,$7) returning id`,
      [
        path.basename(batchFile),
        "COMPLETED",
        summary.totalRows,
        summary.matched,
        summary.review,
        summary.unmatched + summary.duplicatePdf + summary.invalidPdfFiles,
        "cli-import"
      ]
    );
    const batchId = batchRes.rows[0].id;

    for (const r of results) {
      await client.query(
        `insert into staging_contract_rows
         (batch_id,row_no,contract_no,contract_name,contractor_name,first_allowance_date,match_key,match_status,matched_pdf_file,error_code,error_reason,raw_payload)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [
          batchId,
          r.rowNo,
          r.contractNo || null,
          r.contractName || null,
          r.contractorName || null,
          r.firstAllowanceDate || null,
          r.matchKey || null,
          r.matchStatus,
          r.matchedPdfFile || null,
          r.errorCode || null,
          r.errorReason || null,
          JSON.stringify(r)
        ]
      );

      if (!r.contractorName || isSummaryName(r.contractorName)) continue;
      if (!r.firstAllowanceDate && !r.contractDate) continue;
      const contractUpsert = await client.query(
        `insert into contracts (contract_no,contract_name,contractor_name,first_allowance_date,contract_date,deposit_amount,work_days,work_allowance,phone)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         on conflict (contract_no) do update set
           contract_name = excluded.contract_name,
           contractor_name = excluded.contractor_name,
           first_allowance_date = excluded.first_allowance_date,
           contract_date = excluded.contract_date,
           deposit_amount = excluded.deposit_amount,
           work_days = excluded.work_days,
           work_allowance = excluded.work_allowance,
           phone = excluded.phone,
           updated_at = now()
         returning id`,
        [
          r.contractNo || null,
          r.contractName,
          r.contractorName,
          r.firstAllowanceDate || r.contractDate || "1970-01-01",
          r.contractDate || null,
          r.depositAmount ? Number(r.depositAmount.replaceAll(",", "")) : null,
          r.workDays || null,
          r.workAllowance ? Number(r.workAllowance.replaceAll(",", "")) : null,
          r.phone || null
        ]
      );
      const contractId = contractUpsert.rows[0].id;
      if (r.matchStatus !== "MATCHED") continue;
      await client.query(
        `insert into contract_documents (contract_id,file_type,original_file_name,storage_path,match_key,matched_by,matched_at)
         values ($1,'CONTRACT_PDF',$2,$3,$4,'cli-import',now())
         on conflict do nothing`,
        [contractId, r.matchedPdfFile, path.join("data", r.matchedPdfFile), r.matchKey]
      );
    }

    for (const issue of pdfIssues) {
      await client.query(
        `insert into import_issues (batch_id,row_no,issue_code,issue_reason,payload)
         values ($1,null,$2,$3,$4)`,
        [batchId, issue.issue, "PDF 파일명 검증 실패", JSON.stringify(issue)]
      );
    }

    await client.query("commit");
    console.log(JSON.stringify({ mode: "apply", summary, batchId }, null, 2));
  } catch (e) {
    await client.query("rollback");
    throw e;
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
