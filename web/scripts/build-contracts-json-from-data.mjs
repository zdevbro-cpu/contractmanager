import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import xlsx from "xlsx";

const rootDir = path.resolve(process.cwd(), "..");
const dataDir = path.resolve(rootDir, "data");
const outPath = path.resolve(process.cwd(), "src", "data", "contracts.json");

function walkFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const out = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkFiles(full));
    else out.push(full);
  }
  return out;
}

function toIsoDate(value) {
  if (value === null || value === undefined || value === "") return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const parsed = xlsx.SSF.parse_date_code(value);
    if (parsed?.y && parsed?.m && parsed?.d) {
      const y = String(parsed.y);
      const m = String(parsed.m).padStart(2, "0");
      const d = String(parsed.d).padStart(2, "0");
      return `${y}-${m}-${d}`;
    }
  }
  const v = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  return "";
}

function toNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
  const digits = String(value).replace(/[^\d-]/g, "");
  if (!digits) return null;
  const n = Number(digits);
  return Number.isFinite(n) ? n : null;
}

function fmtWon(value) {
  if (value === null || value === undefined || value === "") return "";
  return `${Number(value).toLocaleString("ko-KR")} 원`;
}

function addYears(isoDate, years) {
  if (!isoDate) return "";
  const d = new Date(`${isoDate}T00:00:00`);
  d.setFullYear(d.getFullYear() + years);
  return d.toISOString().slice(0, 10);
}

function isMonthlySheet(name) {
  return /^\d{1,2}월$/.test(String(name).trim());
}

function build() {
  const xlsxFile = walkFiles(dataDir).find((x) => x.toLowerCase().endsWith(".xlsx"));
  if (!xlsxFile) throw new Error("data 폴더에 xlsx 파일이 없습니다.");

  const wb = xlsx.readFile(xlsxFile);
  const rows = [];

  for (const sheetName of wb.SheetNames) {
    if (!isMonthlySheet(sheetName)) continue;
    const grid = xlsx.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: "" });
    if (grid.length < 3) continue;

    for (let i = 2; i < grid.length; i += 1) {
      const r = grid[i];
      if (!r || r.length === 0) continue;

      const name = String(r[1] ?? "").trim();
      if (!name || name === "합계") continue;

      const contractDate = toIsoDate(r[3]);
      const payoutDate = toIsoDate(r[6]);
      const endDate = toIsoDate(r[12]) || addYears(contractDate || payoutDate, 3);
      const deposit = toNumber(r[2]);
      const allowance = toNumber(r[5]);
      const ref = String(r[0] ?? "").trim();

      if (!contractDate && !payoutDate) continue;

      rows.push({
        _sheet: sheetName,
        _row: i + 1,
        name,
        ref,
        contractDate: contractDate || payoutDate,
        payoutDate: payoutDate || contractDate,
        endDate,
        depositAmount: fmtWon(deposit),
        allowanceAmount: fmtWon(allowance)
      });
    }
  }

  rows.sort((a, b) => {
    if (a.contractDate !== b.contractDate) return a.contractDate < b.contractDate ? 1 : -1;
    return b._row - a._row;
  });

  const seqByDate = new Map();
  const out = rows.map((r) => {
    const d = (r.contractDate || "2026-01-01").replaceAll("-", "");
    const seq = (seqByDate.get(d) ?? 0) + 1;
    seqByDate.set(d, seq);
    return {
      no: `LASM-${d}-${String(seq).padStart(3, "0")}`,
      name: r.name,
      ref: r.ref,
      type: "LAS점주점장계약서",
      contractDate: r.contractDate || "2026-01-01",
      payoutDate: r.payoutDate || r.contractDate || "2026-01-01",
      endDate: r.endDate || addYears(r.contractDate || "2026-01-01", 3),
      depositAmount: r.depositAmount,
      allowanceAmount: r.allowanceAmount,
      status: "정상운영",
      verify: "검증완료"
    };
  });

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2), "utf8");

  const monthCounts = new Map();
  for (const r of out) {
    const month = r.contractDate.slice(0, 7);
    monthCounts.set(month, (monthCounts.get(month) ?? 0) + 1);
  }

  return { total: out.length, monthCounts: Object.fromEntries([...monthCounts.entries()].sort()) };
}

const result = build();
console.log(JSON.stringify(result, null, 2));
