import fs from "node:fs";
import pg from "pg";

const { Client } = pg;

function toIsoDate(v) {
  if (!v) return "";
  if (typeof v === "string") return v.slice(0, 10);
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).slice(0, 10);
}

function addYears(dateText, years) {
  const d = new Date(`${dateText}T00:00:00`);
  d.setFullYear(d.getFullYear() + years);
  return d.toISOString().slice(0, 10);
}

const client = new Client({
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT ?? 5432),
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD
});

await client.connect();

const res = await client.query(`
  select
    id,
    contract_no,
    contractor_name,
    contract_name,
    first_allowance_date,
    contract_date,
    deposit_amount,
    work_allowance,
    created_at
  from contracts
  where contractor_name is not null
    and btrim(contractor_name) <> ''
    and replace(btrim(contractor_name), ' ', '') <> '합계'
  order by coalesce(contract_date, first_allowance_date) desc nulls last, id desc
`);

const seqByDate = new Map();

const rows = res.rows.map((x) => {
  const contractDate = toIsoDate(x.contract_date || x.first_allowance_date || "");
  const payoutDate = toIsoDate(x.first_allowance_date || "");
  const safeContractDate = contractDate || "2026-01-01";
  const dateKey = safeContractDate.replaceAll("-", "");
  const nextSeq = (seqByDate.get(dateKey) ?? 0) + 1;
  seqByDate.set(dateKey, nextSeq);
  const fallbackNo = `LASM-${dateKey}-${String(nextSeq).padStart(3, "0")}`;

  return {
    contractDate: safeContractDate,
    no: x.contract_no || fallbackNo,
    name: x.contractor_name || "",
    ref: "",
    type: x.contract_name || "LAS점주점장계약서",
    status: "정상운영",
    verify: "검증완료",
    payoutDate: payoutDate || safeContractDate,
    endDate: addYears(safeContractDate, 3),
    depositAmount: x.deposit_amount ? `${Number(x.deposit_amount).toLocaleString("ko-KR")} 원` : "",
    allowanceAmount: x.work_allowance ? `${Number(x.work_allowance).toLocaleString("ko-KR")} 원` : "",
    createdAt: toIsoDate(x.created_at || "")
  };
});

fs.mkdirSync("src/data", { recursive: true });
fs.writeFileSync("src/data/contracts.json", JSON.stringify(rows, null, 2), "utf8");
console.log(`exported ${rows.length} contracts to src/data/contracts.json`);

await client.end();
