const fs = require("fs");
let content = fs.readFileSync("web/src/App.tsx", "utf8");

// 1. DashboardPage
const dashTarget1 = `function DashboardPage({ onDetail, rows }: { onDetail: () => void; rows: ContractRowData[] }) {
  return (
    <div>
      <PageHeader title="대시보드" desc="계약 운영 현황을 한눈에 확인하세요." />
      <StatCards items={[{ label: "전체 계약", value: "12,458 건", icon: <FileText size={18} />, tone: "blue" }, { label: "정상운영", value: "10,842 건", icon: <CheckCircle2 size={18} />, tone: "green" }, { label: "지급예정금액", value: "1,245,680,000 원", icon: <Wallet size={18} />, tone: "orange" }, { label: "검토 필요", value: "236 건", icon: <Search size={18} />, tone: "violet" }]} />
      <section className="card"><div className="card-title-sm">최근 계약 현황</div><ContractSimpleTable onDetail={onDetail} rows={rows} /></section>
    </div>
  );
}`;
const dashTarget2 = dashTarget1.replace(/\n/g, "\r\n");

const dashReplace = `function DashboardPage({ onDetail, rows }: { onDetail: () => void; rows: ContractRowData[] }) {
  const totalContracts = rows.length;
  const normalContracts = rows.filter((r) => r.status.includes("정상") || r.status.includes("완료")).length;
  const needReview = rows.filter((r) => r.status.includes("대기") || r.status.includes("보류") || r.verify.includes("오류")).length;
  const totalAllowance = rows.reduce((acc, r) => {
    const v = String(r.allowanceAmount || "").replace(/[^\\d]/g, "");
    return acc + (Number(v) || 0);
  }, 0);

  return (
    <div>
      <PageHeader title="대시보드" desc="계약 운영 현황을 한눈에 확인하세요." />
      <StatCards items={[{ label: "전체 계약", value: \`\${totalContracts.toLocaleString("ko-KR")} 건\`, icon: <FileText size={18} />, tone: "blue" }, { label: "정상운영", value: \`\${normalContracts.toLocaleString("ko-KR")} 건\`, icon: <CheckCircle2 size={18} />, tone: "green" }, { label: "지급예정금액", value: \`\${totalAllowance.toLocaleString("ko-KR")} 원\`, icon: <Wallet size={18} />, tone: "orange" }, { label: "검토 필요", value: \`\${needReview.toLocaleString("ko-KR")} 건\`, icon: <Search size={18} />, tone: "violet" }]} />
      <section className="card"><div className="card-title-sm">최근 계약 현황</div><ContractSimpleTable onDetail={onDetail} rows={rows} /></section>
    </div>
  );
}`;

content = content.replace(dashTarget1, dashReplace).replace(dashTarget2, dashReplace);

// 2. AllowancePage rows map
const allowanceRegex = /const allowanceRows = rows\.map\(\(r, i\) => \{[\s\S]*?\}\);/;
const allowanceReplace = `const allowanceRows = rows.map((r) => {
    const baseDate = r.payoutDate || r.contractDate || "-";
    const amount = Number(String(r.allowanceAmount || "").replace(/[^\\d]/g, "")) || 0;
    return ({
    ...r,
    baseDate,
    amount,
    bankName: "-",
    accountNo: "-",
    accountMasked: "-",
    verifyStatus: r.verify || "미조회",
    payStatus: r.status || "지급대기"
    });
  });`;

content = content.replace(allowanceRegex, allowanceReplace);

// 3. Detail tabs string cleaning
content = content.replace(/<td>1,000,000,000 원<\/td>/g, "<td>-</td>");
content = content.replace(/<td>900101-1\*\*\*\*\*\*<\/td>/g, "<td>-</td>");
content = content.replace(/<td>010-1234-5678<\/td>/g, "<td>-</td>");
content = content.replace(/<td>LAS점장점주<\/td>/g, "<td>-</td>");

// Allowance Array
const detailAllowRegex = /\{Array\.from\(\{ length: 8 \}\)\.map\(\(_, i\) => <tr key=\{i\}><td>2024-\{String\(i \+ 5\)\.padStart\(2, "0"\)\}<\/td><td>100,000 원<\/td><td>10,000 원<\/td><td>90,000 원<\/td><td><span className="badge green">지급완료<\/span><\/td><\/tr>\)\}/;
const detailAllowReplace = `<tr><td colSpan={5}>수당 정보가 없습니다.</td></tr>`;
content = content.replace(detailAllowRegex, detailAllowReplace);

// 4. changeFields
const changeFieldsRegex = /const \[changeFields, setChangeFields\] = useState\(\[[\s\S]*?\]\);/;
const changeFieldsReplace = `const [changeFields, setChangeFields] = useState([
    { field: "계약번호", before: "-", after: "-", readOnlyAfter: true },
    { field: "계약자명", before: "-", after: "-" },
    { field: "추천인명", before: "-", after: "-" },
    { field: "계약종류", before: "-", after: "-", readOnlyAfter: true },
    { field: "계약일자", before: "", after: "" },
    { field: "수당지급일", before: "", after: "" },
    { field: "계약종료일", before: "", after: "" },
    { field: "보증금액", before: "-", after: "-" },
    { field: "수당", before: "-", after: "-" },
    { field: "근무여부", before: "-", after: "-" },
    { field: "주소", before: "-", after: "-" },
    { field: "연락처", before: "-", after: "-" },
    { field: "주민번호", before: "-", after: "-" },
    { field: "은행명", before: "-", after: "-" },
    { field: "계좌번호", before: "-", after: "-" },
    { field: "예금주명", before: "-", after: "-" }
  ]);`;
content = content.replace(changeFieldsRegex, changeFieldsReplace);

fs.writeFileSync("web/src/App.tsx", content);
console.log("Replace OK!");
