const fs = require('fs');
let content = fs.readFileSync('c:/ProjectCode/contractmanager/web/src/App.tsx', 'utf8');

// 1. Remove contractRows hardcoding completely
content = content.replace(/const contractRows = Array\.from\(\{ length: 10 \}\)\.map\(\(_, i\) => \(\{[\s\S]*?\}\)\)\.map\(\(row\) => \(\{\n  \.\.\.row,\n  payoutDate: addMonths\(row\.contractDate, 2\),\n  endDate: addYears\(row\.contractDate, 3\)\n\}\)\);\n/g, '');

// 2. Fix ContractSimpleTable
content = content.replace(
  /function ContractSimpleTable\(\{ onDetail \}: \{ onDetail\?: \(\) => void \}\) \{[\s\S]*?<tbody>\s*\{contractRows\.map\(\(r\) => \(/g,
  `function ContractSimpleTable({ onDetail, rows }: { onDetail?: () => void; rows: ContractRowData[] }) {
  return (
    <table className="grid">
      <thead><tr><th>계약번호</th><th>계약자명</th><th>추천인</th><th>계약일</th><th>상태</th><th>계좌검증</th><th>상세</th></tr></thead>
      <tbody>
        {rows.slice(0, 10).map((r) => (`
);

// 3. Fix ContractListTable
content = content.replace(
  /function ContractListTable\(\{ onDetail \}: \{ onDetail: \(\) => void \}\) \{[\s\S]*?<tbody>\s*\{contractRows\.map\(\(r\) => \(/g,
  `function ContractListTable({ onDetail, rows }: { onDetail: () => void; rows: ContractRowData[] }) {
  const compactStatus = (value: string) => {
    if (value === "입금표 미등록") return "입금표미등록";
    return value;
  };

  const compactVerify = (value: string) => {
    if (value === "실명조회 오류") return "실명조회오류";
    return value;
  };

  return (
    <>
      <table className="grid contract-grid">
        <thead><tr><th>계약번호</th><th className="center-th">계약자명</th><th>근무여부</th><th>계약종류</th><th>추천인</th><th>계약일자</th><th>수당지급일</th><th>계약종료일</th><th>보증금액</th><th>수당</th><th className="center-th">상태</th><th className="center-th">계좌검증</th><th>상세</th></tr></thead>
        <tbody>
          {rows.map((r) => (`
);

// 4. In ContractListTable row, replace hardcoded values with r.depositAmount and r.allowanceAmount
content = content.replace(/<td>100,000,000 원<\/td><td>1,500,000 원<\/td>/g, "<td>{r.depositAmount}</td><td>{r.allowanceAmount}</td>");

// 5. Fix ContractList definition and usage
content = content.replace(
  /function ContractList\(\{ onCreate, onDetail \}: \{ onCreate: \(\) => void; onDetail: \(\) => void \}\) \{[\s\S]*?<section className="card"><div className="card-title-sm">전체 1,245건<\/div><ContractListTable onDetail=\{onDetail\} \/><div className="contract-footnote">\* 최근 10건의 계약을 표시합니다\.<\/div><\/section>\s*<\/div>\s*\);\s*\}/g,
  `function ContractList({ onCreate, onDetail, rows }: { onCreate: () => void; onDetail: () => void; rows: ContractRowData[] }) {
  return (
    <div>
      <PageHeader title="계약 관리" desc="계약 목록을 조회하고 관리할 수 있습니다." />
      <section className="card">
        <div className="filter-row"><div className="search-box"><Search size={16} /> 계약번호, 계약자명, 추천인 검색</div><button className="primary-btn" onClick={onCreate}><Plus size={16} /> 신규 계약 등록</button></div>
        <div className="contract-filters">
          <div className="filters">{["계약종류", "계약상태", "추천인", "계약일자", "계좌검증"].map((x) => <div className="select" key={x}>{x}<ChevronDown size={15} /></div>)}</div>
          <button className="line-btn">초기화</button>
        </div>
      </section>
      <section className="card"><div className="card-title-sm">전체 {rows.length.toLocaleString("ko-KR")}건</div><ContractListTable onDetail={onDetail} rows={rows} /><div className="contract-footnote">* 최근 10건의 계약을 표시합니다.</div></section>
    </div>
  );
}`
);

// 6. Fix App's render of ContractList
content = content.replace(
  /<ContractList onCreate=\{\(\) => setView\("create"\)\} onDetail=\{\(\) => setView\("detail"\)\} \/>/g,
  `<ContractList onCreate={() => setView("create")} onDetail={() => setView("detail")} rows={rows} />`
);

fs.writeFileSync('c:/ProjectCode/contractmanager/web/src/App.tsx', content);
console.log('Fixed all remaining mock data!');
