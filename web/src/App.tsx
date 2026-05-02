import {
  Bell,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  Eye,
  FileText,
  Home,
  Landmark,
  Link2,
  Menu,
  Plus,
  Search,
  Settings,
  Trash2,
  UserRound,
  Users,
  Wallet
} from "lucide-react";
import { useMemo, useState, type ChangeEvent, type Dispatch, type SetStateAction } from "react";

type MenuKey = "dashboard" | "contracts" | "referrers" | "allowances" | "account" | "system";
type ContractView = "list" | "create" | "detail";
type DetailTab = "basic" | "document" | "allowance" | "account" | "history" | "memo";
type UserAccount = { id: number; email: string; role: "시스템관리자" | "운영자"; state: "활성" | "비활성"; password: string };

const menus: { key: MenuKey; label: string; icon: JSX.Element }[] = [
  { key: "dashboard", label: "대시보드", icon: <Home size={18} /> },
  { key: "contracts", label: "계약 관리", icon: <FileText size={18} /> },
  { key: "referrers", label: "추천인 관리", icon: <Users size={18} /> },
  { key: "allowances", label: "수당 지급관리", icon: <Wallet size={18} /> },
  { key: "account", label: "계좌 검증", icon: <Landmark size={18} /> },
  { key: "system", label: "시스템 관리", icon: <Settings size={18} /> }
];

function formatDate(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function compactDate(dateText: string) {
  return dateText.replaceAll("-", "");
}

function addMonths(dateText: string, months: number) {
  const date = new Date(`${dateText}T00:00:00`);
  date.setMonth(date.getMonth() + months);
  return formatDate(date);
}

function addYears(dateText: string, years: number) {
  const date = new Date(`${dateText}T00:00:00`);
  date.setFullYear(date.getFullYear() + years);
  return formatDate(date);
}

function formatPhoneNumber(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

function getTodayText() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function makeTempPassword() {
  return `Cm!${Math.random().toString(36).slice(2, 6)}${Math.floor(Math.random() * 900 + 100)}`;
}

const contractRows = Array.from({ length: 10 }).map((_, i) => ({
  contractDate: `2024-05-${String(20 - i).padStart(2, "0")}`,
  no: `LASM-${compactDate(`2024-05-${String(20 - i).padStart(2, "0")}`)}-${String(i + 1).padStart(3, "0")}`,
  name: ["김영수", "박지민", "이서연", "정우진", "한지훈", "최유리", "강민호", "윤지혜", "임재현", "송아름"][i],
  ref: ["이철수", "최민우", "김태훈", "박소영", "이은정", "정민수", "서지현", "박준형", "김나영", "이동건"][i],
  type: "LAS점장점주",
  status: ["정상운영", "정상운영", "지급대기", "정상운영", "계약변경", "정상운영", "지급확정", "정상운영", "입금표 미등록", "정상운영"][i],
  verify: ["검증완료", "검증완료", "검증완료", "검증완료", "검증중", "검증완료", "검증완료", "실명조회 오류", "검증완료", "검증완료"][i]
})).map((row) => ({
  ...row,
  payoutDate: addMonths(row.contractDate, 2),
  endDate: addYears(row.contractDate, 3)
}));

function statusClass(s: string) {
  if (s.includes("정상") || s.includes("완료")) return "green";
  if (s.includes("오류") || s.includes("반려")) return "red";
  if (s.includes("대기") || s.includes("보류")) return "amber";
  return "blue";
}

function PageHeader({ title, desc }: { title: string; desc: string }) {
  return <div className="page-head"><h1>{title}</h1><p>{desc}</p></div>;
}

function StatCards({ items }: { items: { label: string; value: string; icon?: JSX.Element; tone?: "blue" | "green" | "orange" | "violet" }[] }) {
  return (
    <div className="referrer-kpis">
      {items.map((item) => (
        <article key={item.label} className="referrer-kpi">
          <div className={`referrer-kpi-icon ${item.tone ?? "blue"}`}>{item.icon}</div>
          <div className="referrer-kpi-body">
            <div className="referrer-kpi-label">{item.label}</div>
            <div className="referrer-kpi-value">{item.value}</div>
          </div>
        </article>
      ))}
    </div>
  );
}

function DashboardPage({ onDetail }: { onDetail: () => void }) {
  return (
    <div>
      <PageHeader title="대시보드" desc="계약 운영 현황을 한눈에 확인하세요." />
      <StatCards items={[{ label: "전체 계약", value: "12,458 건", icon: <FileText size={18} />, tone: "blue" }, { label: "정상운영", value: "10,842 건", icon: <CheckCircle2 size={18} />, tone: "green" }, { label: "지급예정금액", value: "1,245,680,000 원", icon: <Wallet size={18} />, tone: "orange" }, { label: "검토 필요", value: "236 건", icon: <Search size={18} />, tone: "violet" }]} />
      <section className="card"><div className="card-title-sm">최근 계약 현황</div><ContractSimpleTable onDetail={onDetail} /></section>
    </div>
  );
}

function ContractSimpleTable({ onDetail }: { onDetail?: () => void }) {
  return (
    <table className="grid">
      <thead><tr><th>계약번호</th><th>계약자명</th><th>추천인</th><th>계약일</th><th>상태</th><th>계좌검증</th><th>상세</th></tr></thead>
      <tbody>
        {contractRows.map((r) => (
          <tr key={r.no}>
            <td>{r.no}</td><td>{r.name}</td><td>{r.ref}</td><td>{r.contractDate}</td><td><span className={`badge ${statusClass(r.status)}`}>{r.status}</span></td><td><span className={r.verify.includes("오류") ? "err" : "ok"}>{r.verify}</span></td>
            <td><button className="icon-btn" onClick={onDetail}><Eye size={14} /></button></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ContractListTable({ onDetail }: { onDetail: () => void }) {
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
          {contractRows.map((r) => (
            <tr key={r.no}>
              <td>{r.no}</td><td>{r.name}</td><td><input className="work-check" type="checkbox" defaultChecked={r.name !== "박지민"} /></td><td>{r.type}</td><td>{r.ref}</td><td>{r.contractDate}</td><td>{r.payoutDate}</td><td>{r.endDate}</td><td>100,000,000 원</td><td>1,500,000 원</td>
              <td><span className={`status-fixed ${statusClass(r.status)}`}>{compactStatus(r.status)}</span></td><td><span className={`verify-fixed ${r.verify.includes("오류") ? "err" : "ok"}`}>{compactVerify(r.verify)}</span></td>
              <td><button className="icon-btn" onClick={onDetail}><Eye size={14} /></button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="contract-pagination">
        <div className="pager">
          <button className="pager-btn active">1</button>
          <button className="pager-btn">2</button>
          <button className="pager-btn">3</button>
          <button className="pager-btn">4</button>
          <button className="pager-btn">5</button>
          <span>...</span>
          <button className="pager-btn">125</button>
        </div>
        <div className="per-page">10 / 페이지</div>
      </div>
    </>
  );
}

function ContractList({ onCreate, onDetail }: { onCreate: () => void; onDetail: () => void }) {
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
      <section className="card"><div className="card-title-sm">전체 1,245건</div><ContractListTable onDetail={onDetail} /><div className="contract-footnote">* 최근 10건의 계약을 표시합니다.</div></section>
    </div>
  );
}

function ContractCreate({ onBack }: { onBack: () => void }) {
  const [contractDate, setContractDate] = useState("2024-05-20");
  const [payoutDate, setPayoutDate] = useState(addMonths("2024-05-20", 2));
  const [manualPayout, setManualPayout] = useState(false);
  const [contractName, setContractName] = useState("LAS점장점주");
  const [isWorking, setIsWorking] = useState(true);
  const endDate = addYears(contractDate, 3);
  const contractNo = `LASM-${compactDate(contractDate)}-011`;

  const handleContractDate = (value: string) => {
    setContractDate(value);
    if (!manualPayout) {
      setPayoutDate(addMonths(value, 2));
    }
  };

  return (
    <div>
      <div className="head-with-btn"><PageHeader title="신규 계약 등록" desc="계약 정보를 입력하고 등록하세요." /><button className="line-btn" onClick={onBack}>목록으로</button></div>

      <section className="card">
        <div className="card-title-sm">기본정보</div>
        <div className="basic-grid">
          <label className="field">
            <span>계약명</span>
            <select className="input-input" value={contractName} onChange={(e) => setContractName(e.target.value)}>
              <option value="LAS점장점주">LAS점장점주</option>
              <option value="LAS점장점주(기본형)">LAS점장점주(기본형)</option>
              <option value="LAS점장점주(확장형)">LAS점장점주(확장형)</option>
            </select>
          </label>
          <label className="field"><span>계약번호(자동)</span><div className="input">{contractNo}</div></label>
        </div>
      </section>

      <section className="card">
        <div className="group-head">
          <div className="card-title-sm">계약정보</div>
          <label className="switch-row">
            <span>근무여부</span>
            <button type="button" className={isWorking ? "toggle on" : "toggle"} onClick={() => setIsWorking((v) => !v)}>
              <span className="knob" />
            </button>
            <b>{isWorking ? "근무" : "미근무"}</b>
          </label>
        </div>
        <div className="contract-info-row five">
          <label className="field"><span>추천인명</span><input className="input-input" placeholder="추천인명" /></label>
          <label className="field"><span>계약자명</span><input className="input-input" placeholder="계약자명" /></label>
          <label className="field"><span>주민번호</span><input className="input-input" placeholder="주민번호" /></label>
          <label className="field"><span>연락처</span><input className="input-input" placeholder="연락처" /></label>
          <label className="field"><span>수당</span><input className="input-input" defaultValue="1500000" /></label>
        </div>
        <div className="contract-info-row four">
          <label className="field"><span>주소</span><input className="input-input" placeholder="주소" /></label>
          <label className="field">
            <span>계약일자</span>
            <input className="input-input" type="date" value={contractDate} onChange={(e) => handleContractDate(e.target.value)} />
          </label>
          <label className="field">
            <span>수당지급일</span>
            <input className="input-input" type="date" value={payoutDate} onChange={(e) => { setManualPayout(true); setPayoutDate(e.target.value); }} />
          </label>
          <label className="field">
            <span>계약종료일</span>
            <input className="input-input" type="date" value={endDate} readOnly />
          </label>
        </div>
      </section>

      <section className="card">
        <div className="card-title-sm">계좌정보</div>
        <div className="account-inline">
          <input className="input-input" placeholder="은행명" />
          <input className="input-input" placeholder="계좌번호" />
          <input className="input-input" placeholder="예금주" />
          <button className="primary-btn action-btn">계좌실명확인</button>
        </div>
      </section>

      <section className="card">
        <div className="card-title-sm">첨부파일</div>
        <div className="form-grid">
          <label className="field"><span>첨부파일(계약서, 입금증, 신분증 포함)</span><div className="dropzone">파일을 드래그하거나 클릭하여 업로드하세요</div></label>
        </div>
      </section>

      <div className="actions"><button className="line-btn" onClick={onBack}>취소</button><button className="primary-btn">저장</button></div>
    </div>
  );
}

function DetailBasicTab() { return <section className="card"><div className="card-title-sm">기본정보</div><table className="grid"><tbody><tr><th>계약번호</th><td>LASM-20240520-001</td><th>계약일</th><td>2024-05-20</td></tr><tr><th>계약종류</th><td>LAS점장점주</td><th>종료일</th><td>2027-05-20</td></tr><tr><th>계약자명</th><td>김영수</td><th>보증금액</th><td>1,000,000,000 원</td></tr><tr><th>주민번호</th><td>900101-1******</td><th>근무여부</th><td>근무중</td></tr><tr><th>연락처</th><td>010-1234-5678</td><th>계약상태</th><td>정상운영</td></tr></tbody></table></section>; }
function DetailDocumentTab() { return <section className="card"><div className="card-title-sm">계약서/입금표</div><div className="two-col"><div className="card"><div className="card-title-sm">계약서 PDF</div><div className="input pdf-preview">PDF 미리보기 영역</div><div className="actions detail-file-actions"><button className="line-btn">다운로드</button><button className="line-btn">교체등록</button></div></div><div className="card"><div className="card-title-sm">입금표 PDF</div><div className="input pdf-preview">PDF 미리보기 영역</div><div className="actions detail-file-actions"><button className="line-btn">다운로드</button><button className="line-btn">교체등록</button></div></div></div></section>; }
function DetailAllowanceTab() { return <section className="card"><div className="card-title-sm">수당정보</div><table className="grid"><thead><tr><th>기준월</th><th>산정수당</th><th>공제</th><th>실지급예정금액</th><th>지급상태</th></tr></thead><tbody>{Array.from({ length: 8 }).map((_, i) => <tr key={i}><td>2024-{String(i + 5).padStart(2, "0")}</td><td>100,000 원</td><td>10,000 원</td><td>90,000 원</td><td><span className="badge green">지급완료</span></td></tr>)}</tbody></table></section>; }
function DetailAccountTab() { return <section className="card"><div className="card-title-sm">현재 계좌 정보</div><table className="grid"><tbody><tr><th>은행명</th><td>신한은행</td></tr><tr><th>계좌번호</th><td>110-123-456789</td></tr><tr><th>예금주명</th><td>김영수</td></tr><tr><th>계좌실명조회 상태</th><td><span className="badge green">실명조회 일치</span></td></tr></tbody></table></section>; }
function DetailHistoryTab({
  rows,
  onOpenDetail
}: {
  rows: Array<{ at: string; before: string; after: string; reason: string; changedFields: Array<{ field: string; before: string; after: string }> }>;
  onOpenDetail: (row: { at: string; before: string; after: string; reason: string; changedFields: Array<{ field: string; before: string; after: string }> }) => void;
}) {
  return <section className="card"><div className="card-title-sm">변경이력</div><table className="grid"><thead><tr><th>요청일시</th><th>변경유형</th><th>변경 전</th><th>변경 후</th><th>요청자</th><th>승인자</th><th>처리상태</th></tr></thead><tbody>{rows.length === 0 ? <tr><td colSpan={7}>변경 이력이 없습니다.</td></tr> : rows.map((row, i) => <tr key={`${row.at}-${i}`} style={{ cursor: "pointer" }} onClick={() => onOpenDetail(row)}><td>{row.at}</td><td>계약정보변경</td><td>{row.before}</td><td>{row.after}</td><td>김영수</td><td>시스템관리자</td><td><span className="badge blue">승인대기</span></td></tr>)}</tbody></table></section>;
}
function DetailMemoTab() { return <section className="card"><div><div className="card-title-sm">메모 작성</div><div className="input memo-box">메모를 입력하세요...</div><div className="actions detail-file-actions"><button className="line-btn">파일 첨부</button><button className="primary-btn">등록</button></div></div></section>; }

function ReferrerPage() {
  const [referrerRows, setReferrerRows] = useState(
    Array.from({ length: 10 }).map((_, i) => ({
      id: i + 1,
      name: "김영수",
      org: "영업1팀",
      phone: "010-1234-5678",
      title: "대리",
      contracts: "28건",
      allowance: "3,520,000 원",
      status: "활성"
    }))
  );

  const [editingReferrer, setEditingReferrer] = useState<null | { id: number; name: string; org: string; phone: string; title: string }>(null);
  const [modalForm, setModalForm] = useState({ name: "", org: "", phone: "", title: "" });
  const [referrerForm, setReferrerForm] = useState({ name: "", org: "", phone: "", title: "" });

  const referrerStats = [
    { label: "총 추천인", value: "186 명", sub: "전체 추천인 수", icon: <Users size={24} />, tone: "blue" },
    { label: "활성 추천인", value: "152 명", sub: "81.7%", icon: <CheckCircle2 size={24} />, tone: "green" },
    { label: "계약 연결 수", value: "1,245 건", sub: "전체 계약 연결", icon: <Link2 size={24} />, tone: "orange" },
    { label: "수당 합계", value: "124,568,000 원", sub: "전체 지급 예정/지급 합계", icon: <CircleDollarSign size={24} />, tone: "violet" }
  ] as const;

  const openReferrerDetail = (row: { id: number; name: string; org: string; phone: string; title: string }) => {
    setEditingReferrer(row);
    setModalForm({ name: row.name, org: row.org, phone: row.phone, title: row.title });
  };

  const closeReferrerDetail = () => {
    setEditingReferrer(null);
  };

  const saveReferrerDetail = () => {
    if (!editingReferrer) return;
    setReferrerRows((prev) =>
      prev.map((row) =>
        row.id === editingReferrer.id
          ? { ...row, name: modalForm.name, org: modalForm.org, phone: modalForm.phone, title: modalForm.title }
          : row
      )
    );
    setEditingReferrer(null);
  };

  const saveReferrerForm = () => {
    if (!referrerForm.name.trim() || !referrerForm.org.trim() || !referrerForm.phone.trim()) return;
    const nextId = referrerRows.length ? Math.max(...referrerRows.map((r) => r.id)) + 1 : 1;
    setReferrerRows((prev) => [
      {
        id: nextId,
        name: referrerForm.name.trim(),
        org: referrerForm.org.trim(),
        phone: referrerForm.phone.trim(),
        title: referrerForm.title.trim() || "사원",
        contracts: "0건",
        allowance: "0 원",
        status: "활성"
      },
      ...prev
    ]);
    setReferrerForm({ name: "", org: "", phone: "", title: "" });
  };

  return (
    <div>
      <PageHeader title="추천인 관리" desc="추천인 정보를 관리하고 수당 지급 현황을 확인하세요." />
      <section className="referrer-kpis">
        {referrerStats.map((item) => (
          <article key={item.label} className="referrer-kpi">
            <div className={`referrer-kpi-icon ${item.tone}`}>{item.icon}</div>
            <div className="referrer-kpi-body">
              <div className="referrer-kpi-label">{item.label}</div>
              <div className="referrer-kpi-value">{item.value}</div>
              <div className="referrer-kpi-sub">{item.sub}</div>
            </div>
          </article>
        ))}
      </section>
      <section className="card two-col referrer-layout">
        <div>
          <div className="referrer-filter-row">
            <div className="search-box"><Search size={16} /> 이름, 소속, 전화번호 검색</div>
            <div className="referrer-filters">
              <div className="select">상태 전체 <ChevronDown size={15} /></div>
              <div className="select">소속 전체 <ChevronDown size={15} /></div>
              <button className="line-btn"><Search size={14} /> 상세 필터</button>
            </div>
          </div>
          <div className="referrer-table-scroll">
            <table className="grid referrer-grid">
                        <thead><tr><th>이름</th><th>소속</th><th>전화번호</th><th>직급</th><th>등록계약 수</th><th>지급수당 합계</th><th>상태</th><th>상세</th></tr></thead>
                        <tbody>
                          {referrerRows.map((row) => (
                            <tr key={row.id}>
                              <td>{row.name}</td><td>{row.org}</td><td>{row.phone}</td><td>{row.title}</td><td>{row.contracts}</td><td>{row.allowance}</td><td><span className="badge green">{row.status}</span></td><td><button className="icon-btn" onClick={() => openReferrerDetail(row)}><Eye size={14} /></button></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
          </div>
          <div className="helper-text">지급수당 합계: 해당 추천인에게 누적 확정/지급된 수당 총액</div>
        </div>
        <div>
          <div className="card-title-sm">추천인 등록</div>
          <div className="side-form">
            <label className="field">
              <span>이름<b className="req"> *</b></span>
              <input className="input-input" placeholder="이름 입력" value={referrerForm.name} onChange={(e) => setReferrerForm((prev) => ({ ...prev, name: e.target.value }))} />
            </label>
            <label className="field">
              <span>소속<b className="req"> *</b></span>
              <input className="input-input" placeholder="소속 입력" value={referrerForm.org} onChange={(e) => setReferrerForm((prev) => ({ ...prev, org: e.target.value }))} />
            </label>
            <label className="field">
              <span>전화번호<b className="req"> *</b></span>
              <input className="input-input" placeholder="010-0000-0000" inputMode="numeric" value={referrerForm.phone} onChange={(e) => setReferrerForm((prev) => ({ ...prev, phone: formatPhoneNumber(e.target.value) }))} />
            </label>
            <label className="field">
              <span>직급</span>
              <input className="input-input" placeholder="직급 입력" value={referrerForm.title} onChange={(e) => setReferrerForm((prev) => ({ ...prev, title: e.target.value }))} />
            </label>
          </div>
          <div className="actions referrer-actions"><button className="line-btn" onClick={() => setReferrerForm({ name: "", org: "", phone: "", title: "" })}>취소</button><button className="primary-btn" onClick={saveReferrerForm}>저장</button></div>
        </div>
      </section>

      {editingReferrer && (
        <div className="modal-backdrop" onClick={closeReferrerDetail}>
          <section className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="card-title-sm">추천인 정보 상세</div>
            <div className="side-form">
              <label className="field"><span>이름<b className="req"> *</b></span><input className="input-input" value={modalForm.name} onChange={(e) => setModalForm((prev) => ({ ...prev, name: e.target.value }))} /></label>
              <label className="field"><span>소속<b className="req"> *</b></span><input className="input-input" value={modalForm.org} onChange={(e) => setModalForm((prev) => ({ ...prev, org: e.target.value }))} /></label>
              <label className="field"><span>전화번호<b className="req"> *</b></span><input className="input-input" inputMode="numeric" value={modalForm.phone} onChange={(e) => setModalForm((prev) => ({ ...prev, phone: formatPhoneNumber(e.target.value) }))} /></label>
              <label className="field"><span>직급</span><input className="input-input" value={modalForm.title} onChange={(e) => setModalForm((prev) => ({ ...prev, title: e.target.value }))} /></label>
            </div>
            <div className="actions modal-actions">
              <button className="line-btn" onClick={closeReferrerDetail}>취소</button>
              <button className="primary-btn" onClick={saveReferrerDetail}>저장</button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}


function AllowancePage() {
  const currentYear = new Date().getFullYear();
  const initialStartDate = `${currentYear}-05-01`;
  const initialEndDate = `${currentYear}-06-30`;
  const [startDate, setStartDate] = useState(initialStartDate);
  const [endDate, setEndDate] = useState(initialEndDate);
  const [contractorFilter, setContractorFilter] = useState("전체");
  const [verifyFilter, setVerifyFilter] = useState("전체");
  const [statusFilter, setStatusFilter] = useState("전체");

  const allowanceRows = contractRows.map((r, i) => {
    const year = new Date().getFullYear();
    const day = String(i + 1).padStart(2, "0");
    const baseDate = i < 5 ? `${year}-05-${day}` : `${year}-06-${String(i - 4).padStart(2, "0")}`;
    const accountNo = `1234-5678-${String(100000 + i).padStart(6, "0")}`;
    return ({
    ...r,
    baseDate,
    amount: 320000 + i * 10000,
    bankName: "국민은행",
    accountNo,
    accountMasked: accountNo.replace(/(\d{4}-)\d{4}-(\d{6})/, "$1****-$2"),
    verifyStatus: i === 2 || i === 7 ? "검증오류" : i === 4 ? "검증중" : "검증완료",
    payStatus: r.status.includes("지급") ? r.status : "지급대기"
    });
  });

  const filteredRows = allowanceRows.filter((row) => {
    const inDate = row.baseDate >= startDate && row.baseDate <= endDate;
    const inContractor = contractorFilter === "전체" || row.name === contractorFilter;
    const inVerify = verifyFilter === "전체" || row.verifyStatus === verifyFilter;
    const inStatus = statusFilter === "전체" || row.payStatus === statusFilter;
    return inDate && inContractor && inVerify && inStatus;
  });
  const totalAmount = filteredRows.reduce((sum, row) => sum + row.amount, 0);
  const confirmedAmount = filteredRows.filter((row) => row.status.includes("지급확정") || row.status.includes("정상운영")).reduce((sum, row) => sum + row.amount, 0);
  const completedAmount = filteredRows.filter((row) => row.status.includes("정상운영")).reduce((sum, row) => sum + row.amount, 0);
  const holdAmount = filteredRows.filter((row) => row.status.includes("대기") || row.status.includes("변경")).reduce((sum, row) => sum + row.amount, 0);

  const amountText = (value: number) => `${value.toLocaleString("ko-KR")} 원`;
  const paidAmount = (value: number) => Math.round(value * 0.967);

  const exportFilteredList = async () => {
    const padRight = (value: string, width: number) => value.padEnd(width, " ");
    const padLeft = (value: string, width: number) => value.padStart(width, " ");
    const amountOnly = (value: number) => `${value.toLocaleString("ko-KR")} 원`;

    const nameWidth = 8;
    const bankWidth = 8;
    const accountWidth = 18;
    const amountWidth = 12;

    const header = [
      padRight("계약자명", nameWidth),
      padRight("은행명", bankWidth),
      padRight("계좌번호", accountWidth),
      padLeft("지급금액", amountWidth)
    ].join("  ");

    const separator = "-".repeat(header.length);

    const body = filteredRows.map((r) =>
      [
        padRight(r.name, nameWidth),
        padRight(r.bankName, bankWidth),
        padRight(r.accountNo, accountWidth),
        padLeft(amountOnly(paidAmount(r.amount)), amountWidth)
      ].join("  ")
    );

    const content = [header, separator, ...body].join("\r\n");
    const fileName = `수당지급목록_${endDate}_${startDate}.txt`;

    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    if ("msSaveOrOpenBlob" in navigator) {
      (navigator as any).msSaveOrOpenBlob(blob, fileName);
      return;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const topStats = [
    { label: "지급대상 건수", value: `${filteredRows.length} 건`, sub: "기간 필터 기준", icon: <Wallet size={22} />, tone: "blue" },
    { label: "지급예정 금액", value: amountText(totalAmount), sub: "기간 내 총 예상 지급", icon: <CircleDollarSign size={22} />, tone: "green" },
    { label: "지급보류 건수", value: `${filteredRows.filter((r) => r.status.includes("대기") || r.status.includes("변경")).length} 건`, sub: "대기/변경 건수", icon: <Landmark size={22} />, tone: "orange" }
  ] as const;

  return (
    <div>
      <PageHeader title="수당 지급관리" desc="지급 대상 및 지급 상태를 관리합니다." />

      <section className="allowance-kpis">
        {topStats.map((item) => (
          <article key={item.label} className="referrer-kpi">
            <div className={`referrer-kpi-icon ${item.tone}`}>{item.icon}</div>
            <div className="referrer-kpi-body">
              <div className="referrer-kpi-label">{item.label}</div>
              <div className="referrer-kpi-value">{item.value}</div>
              <div className="referrer-kpi-sub">{item.sub}</div>
            </div>
          </article>
        ))}
      </section>

      <section className="card">
        <div className="allowance-period-filter">
          <label className="field">
            <span>시작일</span>
            <input className="input-input" type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setEndDate(e.target.value); }} />
          </label>
          <label className="field">
            <span>종료일</span>
            <input className="input-input" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </label>
          <label className="field">
            <span>계약자명</span>
            <select className="input-input" value={contractorFilter} onChange={(e) => setContractorFilter(e.target.value)}>
              <option value="전체">전체</option>
              {[...new Set(allowanceRows.map((r) => r.name))].map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>계좌검증</span>
            <select className="input-input" value={verifyFilter} onChange={(e) => setVerifyFilter(e.target.value)}>
              <option value="전체">전체</option>
              <option value="검증완료">검증완료</option>
              <option value="검증중">검증중</option>
              <option value="검증오류">검증오류</option>
            </select>
          </label>
          <label className="field">
            <span>지급상태</span>
            <select className="input-input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="전체">전체</option>
              {[...new Set(allowanceRows.map((r) => r.payStatus))].map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </label>
          <div className="allowance-filter-actions">
          <button className="line-btn allowance-reset-btn" onClick={() => { setStartDate(initialStartDate); setEndDate(initialEndDate); setContractorFilter("전체"); setVerifyFilter("전체"); setStatusFilter("전체"); }}>초기화</button>
            <button className="primary-btn allowance-export-btn" onClick={exportFilteredList}>출력</button>
          </div>
        </div>
      </section>

      <section className="card">
        <table className="grid allowance-grid">
          <thead>
            <tr><th>기준일</th><th>계약자명</th><th>추천인</th><th>은행명</th><th>계좌번호</th><th>수당</th><th>지급금액</th><th>계좌검증</th><th>지급상태</th></tr>
          </thead>
          <tbody>
            {filteredRows.map((r) => (
              <tr key={r.no}>
                <td>{r.baseDate}</td><td>{r.name}</td><td>{r.ref}</td><td>{r.bankName}</td><td>{r.accountMasked}</td><td>{amountText(r.amount)}</td><td>{amountText(paidAmount(r.amount))}</td><td><span className={r.verifyStatus.includes("오류") ? "err" : r.verifyStatus.includes("중") ? "" : "ok"}>{r.verifyStatus}</span></td><td><span className={`badge ${statusClass(r.payStatus)}`}>{r.payStatus}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card total-strip allowance-total-strip">
        <div>
          <div className="total-head"><Wallet size={18} /> <b>합계금액</b></div>
          <span>{amountText(totalAmount)}</span>
        </div>
        <div>
          <div className="total-head"><CircleDollarSign size={18} /> <b>지급확정 금액</b></div>
          <span>{amountText(confirmedAmount)}</span>
        </div>
        <div>
          <div className="total-head"><CheckCircle2 size={18} /> <b>지급완료 금액</b></div>
          <span>{amountText(completedAmount)}</span>
        </div>
        <div>
          <div className="total-head"><Landmark size={18} /> <b>지급보류 금액</b></div>
          <span>{amountText(holdAmount)}</span>
        </div>
      </section>
    </div>
  );
}

function AccountPage() {
  type AccountRow = {
    no: string;
    name: string;
    bankName: string;
    accountNo: string;
    ownerName: string;
    lastCheckedAt: string;
    verifyStatus: string;
    errorDetail: string;
  };

  type VerifyApiResponse = {
    exists: boolean;
    ownerMatch: boolean;
    ownerName?: string;
    message?: string;
  };

  const baseRows: AccountRow[] = Array.from({ length: 20 }).map((_, i) => {
    const r = contractRows[i % contractRows.length];
    const verifyStatus = i < 8 ? "일치" : i < 12 ? "불일치" : i < 16 ? "미조회" : "재확인 필요";
    const errorDetail =
      verifyStatus === "불일치"
        ? "예금주명 불일치"
        : verifyStatus === "재확인 필요"
          ? "은행 응답 지연"
          : verifyStatus === "미조회"
            ? "검증 미실행"
            : "";
    return {
      no: `LASM-202405${String(20 - (i % 20)).padStart(2, "0")}-${String(i + 1).padStart(3, "0")}`,
      name: r.name,
      bankName: "신한은행",
      accountNo: `110-****-${String(123456 + i).padStart(6, "0")}`,
      ownerName: i < 7 ? r.name : "-",
      lastCheckedAt: i < 7 ? `2024-05-20 14:${String(30 + i).padStart(2, "0")}` : "-",
      verifyStatus,
      errorDetail
    };
  });

  const [accountRows, setAccountRows] = useState<AccountRow[]>(baseRows);
  const [selectedNo, setSelectedNo] = useState(accountRows[0]?.no ?? "");
  const [isVerifyingAll, setIsVerifyingAll] = useState(false);
  const [verifyingSet, setVerifyingSet] = useState<Set<string>>(new Set());
  const selectedRow = accountRows.find((row) => row.no === selectedNo) ?? accountRows[0];

  const accountStats = [
    { label: "미조회", value: `${accountRows.filter((r) => r.verifyStatus === "미조회").length} 건`, sub: "검증 미진행", icon: <Search size={22} />, tone: "blue" },
    { label: "일치", value: `${accountRows.filter((r) => r.verifyStatus === "일치").length} 건`, sub: "실명 일치", icon: <CheckCircle2 size={22} />, tone: "green" },
    { label: "불일치", value: `${accountRows.filter((r) => r.verifyStatus === "불일치").length} 건`, sub: "실명 불일치", icon: <CircleDollarSign size={22} />, tone: "orange" },
    { label: "재확인 필요", value: `${accountRows.filter((r) => r.verifyStatus === "재확인 필요").length} 건`, sub: "재검증 대상", icon: <Landmark size={22} />, tone: "violet" }
  ] as const;

  const verifyByApi = async (row: AccountRow): Promise<AccountRow> => {
    const checkedAt = `${formatDate(new Date())} 10:00`;
    try {
      const res = await fetch("/api/account/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bankName: row.bankName,
          accountNo: row.accountNo,
          ownerName: row.ownerName
        })
      });
      if (!res.ok) {
        return { ...row, verifyStatus: "재확인 필요", errorDetail: `API 오류(${res.status})`, lastCheckedAt: checkedAt };
      }
      const data = (await res.json()) as VerifyApiResponse;
      if (!data.exists) {
        return { ...row, verifyStatus: "불일치", errorDetail: data.message || "실계좌 미존재", lastCheckedAt: checkedAt };
      }
      if (!data.ownerMatch) {
        return { ...row, verifyStatus: "불일치", errorDetail: data.message || "예금주 불일치", lastCheckedAt: checkedAt };
      }
      return { ...row, verifyStatus: "일치", errorDetail: "", ownerName: data.ownerName || row.ownerName, lastCheckedAt: checkedAt };
    } catch {
      return { ...row, verifyStatus: "재확인 필요", errorDetail: "검증 API 미연결 또는 통신 실패", lastCheckedAt: checkedAt };
    }
  };

  const recheckOne = async (targetNo: string) => {
    const target = accountRows.find((r) => r.no === targetNo);
    if (!target) return;
    setVerifyingSet((prev) => new Set(prev).add(targetNo));
    setAccountRows((prev) => prev.map((r) => (r.no === targetNo ? { ...r, verifyStatus: "검증중", errorDetail: "" } : r)));
    const verified = await verifyByApi(target);
    setAccountRows((prev) => prev.map((r) => (r.no === targetNo ? verified : r)));
    setVerifyingSet((prev) => {
      const next = new Set(prev);
      next.delete(targetNo);
      return next;
    });
    setSelectedNo(targetNo);
  };

  const runValidationFromUpload = async (rows: AccountRow[]) => {
    const result: AccountRow[] = [];
    for (const row of rows) {
      result.push(await verifyByApi(row));
    }
    return result;
  };

  const verifyAllRows = async () => {
    setIsVerifyingAll(true);
    const keys = accountRows.map((r) => r.no);
    setVerifyingSet(new Set(keys));
    setAccountRows((prev) => prev.map((r) => ({ ...r, verifyStatus: "검증중", errorDetail: "" })));
    const validated = await runValidationFromUpload(accountRows);
    setAccountRows(validated);
    setVerifyingSet(new Set());
    setSelectedNo(validated[0]?.no ?? "");
    setIsVerifyingAll(false);
  };

  const resetAccountRows = () => {
    setAccountRows([]);
    setSelectedNo("");
    setVerifyingSet(new Set());
    setIsVerifyingAll(false);
  };

  const handleExcelUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    if (lines.length < 2) return;

    const parsed: AccountRow[] = lines.slice(1).map((line, idx) => {
      const cols = line.split(",").map((v) => v.trim());
      const no = cols[0] || `UP-${idx + 1}`;
      const name = cols[1] || "-";
      const bankName = cols[2] || "-";
      const accountNo = cols[3] || "-";
      const ownerName = cols[4] || "-";
      return {
        no,
        name,
        bankName,
        accountNo,
        ownerName,
        lastCheckedAt: "-",
        verifyStatus: "미조회",
        errorDetail: ""
      };
    });

    const validated = await runValidationFromUpload(parsed);
    setAccountRows(validated);
    setSelectedNo(validated[0]?.no ?? "");
    e.currentTarget.value = "";
  };

  const downloadValidatedExcel = () => {
    const headers = ["계약번호", "계약자명", "은행명", "계좌번호", "예금주명", "검증상태", "오류내용", "최근조회일시"];
    const rows = accountRows.map((r) => [r.no, r.name, r.bankName, r.accountNo, r.ownerName, r.verifyStatus, r.errorDetail, r.lastCheckedAt]);
    const csvEscape = (v: string) => `"${String(v).replaceAll('"', '""')}"`;
    const content = [headers, ...rows].map((arr) => arr.map((v) => csvEscape(String(v))).join(",")).join("\r\n");
    const bom = "﻿";
    const blob = new Blob([bom + content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `계좌검증결과_${formatDate(new Date())}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadTemplate = () => {
    const headers = ["계약번호", "계약자명", "은행명", "계좌번호", "예금주명"];
    const sampleRows = [
      ["LASM-20240520-001", "김영수", "신한은행", "110-1234-123456", "김영수"],
      ["LASM-20240519-002", "박지민", "신한은행", "110-1234-123457", "박지민"]
    ];
    const csvEscape = (v: string) => `"${String(v).replaceAll('"', '""')}"`;
    const content = [headers, ...sampleRows].map((arr) => arr.map((v) => csvEscape(v)).join(",")).join("\r\n");
    const bom = "﻿";
    const blob = new Blob([bom + content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "계좌검증_업로드템플릿.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <PageHeader title="계좌 검증" desc="계약 계좌의 예금주 정보를 조회하여 일치 여부를 확인하세요." />
      <section className="referrer-kpis">
        {accountStats.map((item) => (
          <article key={item.label} className="referrer-kpi">
            <div className={`referrer-kpi-icon ${item.tone}`}>{item.icon}</div>
            <div className="referrer-kpi-body">
              <div className="referrer-kpi-label">{item.label}</div>
              <div className="referrer-kpi-value">{item.value}</div>
              <div className="referrer-kpi-sub">{item.sub}</div>
            </div>
          </article>
        ))}
      </section>

      <section className="card">
        <div>
          <div className="account-filter-row">
            {["은행명", "상태", "계약종류"].map((x) => <div className="select" key={x}>{x}<ChevronDown size={15} /></div>)}
            <button className="line-btn account-filter-btn" onClick={downloadTemplate}>템플릿다운로드</button>
            <button className="line-btn account-filter-btn" onClick={resetAccountRows}>목록초기화</button>
            <label className="line-btn upload-btn account-filter-btn">
              검증자료업로드
              <input type="file" accept=".csv,text/csv" onChange={handleExcelUpload} hidden />
            </label>
            <button className="line-btn account-filter-btn" onClick={() => void verifyAllRows()} disabled={isVerifyingAll}>
              {isVerifyingAll ? "검증중..." : "전체검증"}
            </button>
            <button className="primary-btn account-filter-btn" onClick={downloadValidatedExcel}>결과 다운로드</button>
          </div>
          <div className="account-table-scroll">
          <table className="grid account-grid">
            <thead><tr><th>계약번호</th><th>계약자명</th><th>은행명</th><th>계좌번호</th><th>예금주명</th><th>최근조회일시</th><th>검증상태</th><th>실행</th></tr></thead>
            <tbody>
              {accountRows.map((row) => (
                <tr key={row.no} className={selectedNo === row.no ? "selected-row" : ""} onClick={() => setSelectedNo(row.no)}>
                  <td>{row.no}</td><td>{row.name}</td><td>{row.bankName}</td><td>{row.accountNo}</td><td>{row.ownerName}</td><td>{row.lastCheckedAt}</td><td><span className={`badge ${row.verifyStatus === "검증중" ? "blue" : statusClass(row.verifyStatus)}`}>{row.verifyStatus}{verifyingSet.has(row.no) ? "..." : ""}</span></td>
                  <td><button className="line-btn" disabled={verifyingSet.has(row.no)} onClick={(e) => { e.stopPropagation(); void recheckOne(row.no); }}>{verifyingSet.has(row.no) ? "검증중" : "검증"}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      </section>
    </div>
  );
}


function ChangePage() {
  type FieldChange = {
    field: string;
    before: string;
    after: string;
  };

  type ChangeRow = {
    id: string;
    requestedAt: string;
    contractNo: string;
    contractor: string;
    workFlag: boolean;
    contractType: string;
    referrer: string;
    contractDate: string;
    payoutDate: string;
    endDate: string;
    depositAmount: string;
    allowanceAmount: string;
    contractState: string;
    accountVerify: string;
    changeType: string;
    beforeValue: string;
    afterValue: string;
    requester: string;
    status: "승인대기" | "승인완료" | "반려" | "임시저장";
    memo: string;
    phone: string;
    accountNo: string;
    fieldChanges: FieldChange[];
  };

  type ChangeHistory = {
    id: string;
    at: string;
    contractNo: string;
    action: string;
    beforeValue: string;
    afterValue: string;
    actor: string;
    result: string;
  };

  const initialRows: ChangeRow[] = Array.from({ length: 10 }).map((_, i) => ({
    id: `chg-${i + 1}`,
    requestedAt: `2024-05-20 14:${String(30 + i).padStart(2, "0")}`,
    contractNo: `LASM-202405${String(20 - i).padStart(2, "0")}-${String(i + 1).padStart(3, "0")}`,
    contractor: contractRows[i].name,
    workFlag: contractRows[i].name !== "박지민",
    contractType: "LAS점장점주",
    referrer: contractRows[i].ref,
    contractDate: contractRows[i].contractDate,
    payoutDate: contractRows[i].payoutDate,
    endDate: contractRows[i].endDate,
    depositAmount: "100,000,000 원",
    allowanceAmount: "1,500,000 원",
    contractState: contractRows[i].status,
    accountVerify: contractRows[i].verify,
    changeType: "계좌정보변경",
    beforeValue: "신한 110-123-****5678",
    afterValue: "신한 110-987-****4321",
    requester: contractRows[i].name,
    status: i % 3 === 0 ? "승인대기" : i % 3 === 1 ? "승인완료" : "반려",
    memo: "",
    phone: `010-12${String(30 + i).padStart(2, "0")}-56${String(70 + i).padStart(2, "0")}`,
    accountNo: `110-987-****${String(4321 + i).padStart(4, "0")}`,
    fieldChanges: [
      { field: "계약번호", before: `LASM-202405${String(20 - i).padStart(2, "0")}-${String(i + 1).padStart(3, "0")}`, after: `LASM-202405${String(20 - i).padStart(2, "0")}-${String(i + 1).padStart(3, "0")}` },
      { field: "계약자명", before: contractRows[i].name, after: contractRows[i].name },
      { field: "추천인명", before: contractRows[i].ref, after: contractRows[i].ref },
      { field: "계약종류", before: "LAS점장점주", after: "LAS점장점주" },
      { field: "계약일자", before: contractRows[i].contractDate, after: contractRows[i].contractDate },
      { field: "수당지급일", before: contractRows[i].payoutDate, after: contractRows[i].payoutDate },
      { field: "계약종료일", before: contractRows[i].endDate, after: contractRows[i].endDate },
      { field: "보증금액", before: "100,000,000 원", after: "100,000,000 원" },
      { field: "수당", before: "1,500,000 원", after: "1,500,000 원" },
      { field: "근무여부", before: i % 2 === 0 ? "근무" : "미근무", after: i % 2 === 0 ? "근무" : "미근무" },
      { field: "주소", before: "서울시 강남구 테헤란로 100", after: "서울시 강남구 테헤란로 100" },
      { field: "연락처", before: `010-12${String(30 + i).padStart(2, "0")}-56${String(70 + i).padStart(2, "0")}`, after: `010-12${String(30 + i).padStart(2, "0")}-56${String(70 + i).padStart(2, "0")}` },
      { field: "주민번호", before: "900101-1234567", after: "900101-1234567" },
      { field: "은행명", before: "신한은행", after: "신한은행" },
      { field: "계좌번호", before: "110-123-456789", after: `110-987-${String(4321 + i).padStart(4, "0")}` },
      { field: "예금주명", before: contractRows[i].name, after: contractRows[i].name }
    ]
  }));

  const [rows, setRows] = useState<ChangeRow[]>(initialRows);
  const [historyRows, setHistoryRows] = useState<ChangeHistory[]>([]);
  const [editing, setEditing] = useState<ChangeRow | null>(null);

  const nowText = () => `${formatDate(new Date())} ${String(new Date().getHours()).padStart(2, "0")}:${String(new Date().getMinutes()).padStart(2, "0")}`;

  const openModal = (row: ChangeRow) => {
    setEditing({ ...row });
  };

  const closeModal = () => {
    setEditing(null);
  };

  const summarizeChange = (changes: FieldChange[]) => {
    const changed = changes.filter((x) => x.before !== x.after);
    if (changed.length === 0) return { beforeValue: "변경 없음", afterValue: "변경 없음" };
    if (changed.length === 1) return { beforeValue: `${changed[0].field}: ${changed[0].before}`, afterValue: `${changed[0].field}: ${changed[0].after}` };
    return {
      beforeValue: `${changed.length}개 항목 변경`,
      afterValue: changed.slice(0, 2).map((x) => `${x.field}: ${x.after}`).join(" / ")
    };
  };

  const revertAfterToBefore = (changes: FieldChange[]) =>
    changes.map((x) => ({ ...x, after: x.before }));

  const saveDraft = () => {
    if (!editing) return;
    const { beforeValue, afterValue } = summarizeChange(editing.fieldChanges);
    setRows((prev) =>
      prev.map((row) =>
        row.id === editing.id
          ? { ...editing, beforeValue, afterValue, status: "임시저장", requestedAt: nowText() }
          : row
      )
    );
    setHistoryRows((prev) => [
      {
        id: `h-${Date.now()}`,
        at: nowText(),
        contractNo: editing.contractNo,
        action: "변경저장",
        beforeValue,
        afterValue,
        actor: editing.requester,
        result: "임시저장"
      },
      ...prev
    ]);
    setEditing(null);
  };

  const requestApprove = () => {
    if (!editing) return;
    const { beforeValue, afterValue } = summarizeChange(editing.fieldChanges);
    setRows((prev) =>
      prev.map((row) =>
        row.id === editing.id
          ? { ...editing, beforeValue, afterValue, status: "승인대기", requestedAt: nowText() }
          : row
      )
    );
    setHistoryRows((prev) => [
      {
        id: `h-${Date.now()}`,
        at: nowText(),
        contractNo: editing.contractNo,
        action: "승인요청",
        beforeValue,
        afterValue,
        actor: editing.requester,
        result: "승인대기"
      },
      ...prev
    ]);
    setEditing(null);
  };

  const approveByAdmin = (id: string) => {
    const target = rows.find((r) => r.id === id);
    if (!target) return;
    const settledChanges = target.fieldChanges.map((x) => ({ ...x, before: x.after }));
    const settledSummary = summarizeChange(settledChanges);
    setRows((prev) =>
      prev.map((row) =>
        row.id === id
          ? {
              ...row,
              status: "승인완료",
              requestedAt: nowText(),
              fieldChanges: settledChanges,
              beforeValue: settledSummary.beforeValue,
              afterValue: settledSummary.afterValue
            }
          : row
      )
    );
    setHistoryRows((prev) => [
      {
        id: `h-${Date.now()}`,
        at: nowText(),
        contractNo: target.contractNo,
        action: "관리자승인",
        beforeValue: target.beforeValue,
        afterValue: target.afterValue,
        actor: "시스템관리자",
        result: "승인완료"
      },
      ...prev
    ]);
  };

  const rejectByAdmin = (id: string) => {
    const target = rows.find((r) => r.id === id);
    if (!target) return;
    const revertedChanges = revertAfterToBefore(target.fieldChanges);
    const revertedSummary = summarizeChange(revertedChanges);
    setRows((prev) =>
      prev.map((row) =>
        row.id === id
          ? {
              ...row,
              status: "반려",
              requestedAt: nowText(),
              fieldChanges: revertedChanges,
              beforeValue: revertedSummary.beforeValue,
              afterValue: revertedSummary.afterValue
            }
          : row
      )
    );
    setHistoryRows((prev) => [
      {
        id: `h-${Date.now()}`,
        at: nowText(),
        contractNo: target.contractNo,
        action: "관리자반려",
        beforeValue: target.beforeValue,
        afterValue: target.beforeValue,
        actor: "시스템관리자",
        result: "반려"
      },
      ...prev
    ]);
  };

  const changeStats = [
    { label: "승인대기", value: `${rows.filter((r) => r.status === "승인대기").length} 건`, sub: "승인 전 처리 대기", icon: <Search size={22} />, tone: "blue" },
    { label: "승인완료", value: `${rows.filter((r) => r.status === "승인완료").length} 건`, sub: "승인 처리 완료", icon: <CheckCircle2 size={22} />, tone: "green" },
    { label: "반려", value: `${rows.filter((r) => r.status === "반려").length} 건`, sub: "반려 처리", icon: <CircleDollarSign size={22} />, tone: "orange" },
    { label: "임시저장", value: `${rows.filter((r) => r.status === "임시저장").length} 건`, sub: "승인요청 전 변경건", icon: <Landmark size={22} />, tone: "violet" }
  ] as const;

  return (
    <div>
      <PageHeader title="계약변경 관리" desc="계약 변경 요청 내역을 확인하고 처리할 수 있습니다." />
      <section className="referrer-kpis">
        {changeStats.map((item) => (
          <article key={item.label} className="referrer-kpi">
            <div className={`referrer-kpi-icon ${item.tone}`}>{item.icon}</div>
            <div className="referrer-kpi-body">
              <div className="referrer-kpi-label">{item.label}</div>
              <div className="referrer-kpi-value">{item.value}</div>
              <div className="referrer-kpi-sub">{item.sub}</div>
            </div>
          </article>
        ))}
      </section>

      <section className="card">
        <div className="filters">{["계약종류", "계약상태", "추천인", "계약일자", "계좌검증"].map((x) => <div className="select" key={x}>{x}<ChevronDown size={15} /></div>)}</div>
        <table className="grid">
          <thead><tr><th>계약번호</th><th>계약자명</th><th>근무여부</th><th>계약종류</th><th>추천인</th><th>계약일자</th><th>수당지급일</th><th>계약종료일</th><th>보증금액</th><th>수당</th><th>상태</th><th>계좌검증</th><th>상세</th></tr></thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.contractNo}</td>
                <td>{row.contractor}</td>
                <td><input className="work-check" type="checkbox" checked={row.workFlag} readOnly /></td>
                <td>{row.contractType}</td>
                <td>{row.referrer}</td>
                <td>{row.contractDate}</td>
                <td>{row.payoutDate}</td>
                <td>{row.endDate}</td>
                <td>{row.depositAmount}</td>
                <td>{row.allowanceAmount}</td>
                <td><span className={`status-fixed ${statusClass(row.contractState)}`}>{row.contractState === "입금표 미등록" ? "입금표미등록" : row.contractState}</span></td>
                <td><span className={`verify-fixed ${row.accountVerify.includes("오류") ? "err" : "ok"}`}>{row.accountVerify === "실명조회 오류" ? "실명조회오류" : row.accountVerify}</span></td>
                <td><button className="icon-btn" onClick={() => openModal(row)}><Eye size={14} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card">
        <div className="card-title-sm">변경 이력</div>
        <table className="grid">
          <thead><tr><th>일시</th><th>계약번호</th><th>처리</th><th>변경 전</th><th>변경 후</th><th>처리자</th><th>결과</th></tr></thead>
          <tbody>
            {historyRows.length === 0 ? (
              <tr><td colSpan={7}>변경 이력이 없습니다.</td></tr>
            ) : (
              historyRows.map((h) => (
                <tr key={h.id}>
                  <td>{h.at}</td><td>{h.contractNo}</td><td>{h.action}</td><td>{h.beforeValue}</td><td>{h.afterValue}</td><td>{h.actor}</td><td>{h.result}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      {editing && (
        <div className="modal-backdrop" onClick={closeModal}>
          <section className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="card-title-sm">계약 변경 상세</div>
            <table className="grid change-input-grid">
              <thead><tr><th>항목</th><th>변경전</th><th>변경후</th></tr></thead>
              <tbody>
                {editing.fieldChanges.map((fc, idx) => (
                  <tr key={fc.field}>
                    <td>{fc.field}</td>
                    <td><span className="cell-text">{fc.before}</span></td>
                    <td>
                      {fc.field === "근무여부" ? (
                        <select
                          className="cell-select"
                          value={fc.after}
                          onChange={(e) =>
                            setEditing((prev) =>
                              prev
                                ? ({
                                    ...prev,
                                    fieldChanges: prev.fieldChanges.map((x, i) =>
                                      i === idx ? ({ ...x, after: e.target.value }) : x
                                    )
                                  })
                                : prev
                            )
                          }
                        >
                          <option value="근무">근무</option>
                          <option value="미근무">미근무</option>
                        </select>
                      ) : (
                        <input
                          className="cell-input"
                          value={fc.after}
                          readOnly={fc.field === "계약번호" || fc.field === "계약종류"}
                          onChange={(e) =>
                            setEditing((prev) =>
                              prev
                                ? ({
                                    ...prev,
                                    fieldChanges: prev.fieldChanges.map((x, i) =>
                                      i === idx ? ({ ...x, after: e.target.value }) : x
                                    )
                                  })
                                : prev
                            )
                          }
                        />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th>요청 사유</th>
                  <td colSpan={2}>
                    <input
                      className="cell-input"
                      value={editing.memo}
                      onChange={(e) => setEditing((prev) => prev ? ({ ...prev, memo: e.target.value }) : prev)}
                    />
                  </td>
                </tr>
              </tfoot>
            </table>
            <div className="actions modal-actions">
              <button className="line-btn" onClick={closeModal}>취소</button>
              <button className="primary-btn" onClick={requestApprove}>승인요청 및 저장</button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function SystemPage({
  users,
  setUsers,
  onAddUserWithTempPassword,
  onResetPassword
}: {
  users: UserAccount[];
  setUsers: Dispatch<SetStateAction<UserAccount[]>>;
  onAddUserWithTempPassword: (email: string, role: "시스템관리자" | "운영자") => void;
  onResetPassword: (id: number) => void;
}) {
  const [newUser, setNewUser] = useState({ email: "", role: "운영자" });
  const [contractTemplate, setContractTemplate] = useState({
    name: "LAS점장점주 표준계약서",
    version: "v1.0",
    appliedFrom: "2024-05-20",
    condition: "계약일 기준 3년, 수당지급일은 계약일+2개월 적용"
  });
  const [allowanceRules, setAllowanceRules] = useState([
    { id: 1, deposit: "10,000,000", workAmount: "1,200,000", nonWorkAmount: "900,000" },
    { id: 2, deposit: "20,000,000", workAmount: "1,300,000", nonWorkAmount: "950,000" },
    { id: 3, deposit: "30,000,000", workAmount: "1,400,000", nonWorkAmount: "1,000,000" },
    { id: 4, deposit: "60,000,000", workAmount: "1,500,000", nonWorkAmount: "1,100,000" }
  ]);

  const addUser = () => {
    if (!newUser.email.trim()) return;
    onAddUserWithTempPassword(newUser.email.trim(), newUser.role as "시스템관리자" | "운영자");
    setNewUser({ email: "", role: "운영자" });
  };

  return (
    <div>
      <PageHeader title="시스템 관리" desc="사용자 권한과 계약서 기준정보를 관리합니다." />

      <section className="card">
        <div className="card-title-sm">사용자권한관리</div>
        <div className="contract-info-row three system-user-row">
          <label className="field"><span>이메일(로그인ID)</span><input className="input-input" type="email" value={newUser.email} onChange={(e) => setNewUser((p) => ({ ...p, email: e.target.value }))} placeholder="user@domain.com" /></label>
          <label className="field"><span>권한</span><select className="input-input" value={newUser.role} onChange={(e) => setNewUser((p) => ({ ...p, role: e.target.value }))}><option value="시스템관리자">시스템관리자</option><option value="운영자">운영자</option></select></label>
          <div className="actions system-user-actions"><button className="primary-btn user-add-btn" onClick={addUser}>사용자 추가</button></div>
        </div>
        <table className="grid">
          <thead><tr><th>이메일(로그인ID)</th><th>권한</th><th>상태</th><th>관리</th></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.email}</td>
                <td>{u.role}</td>
                <td><span className={`badge ${u.state === "활성" ? "green" : "red"}`}>{u.state}</span></td>
                <td>
                  <div className="system-user-btns">
                    <button className="line-btn" onClick={() => setUsers((prev) => prev.map((x) => x.id === u.id ? ({ ...x, state: x.state === "활성" ? "비활성" : "활성" }) : x))}>{u.state === "활성" ? "비활성" : "활성"} 전환</button>
                    <button className="line-btn" onClick={() => onResetPassword(u.id)}>비번초기화</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card">
        <div className="card-title-sm">계약서 관리</div>
        <div className="contract-info-row three">
          <label className="field"><span>계약서명</span><input className="input-input" value={contractTemplate.name} onChange={(e) => setContractTemplate((p) => ({ ...p, name: e.target.value }))} /></label>
          <label className="field"><span>버전</span><input className="input-input" value={contractTemplate.version} onChange={(e) => setContractTemplate((p) => ({ ...p, version: e.target.value }))} /></label>
          <label className="field"><span>적용시작일</span><input className="input-input" type="date" value={contractTemplate.appliedFrom} onChange={(e) => setContractTemplate((p) => ({ ...p, appliedFrom: e.target.value }))} /></label>
        </div>
        <div className="card-title-sm allowance-title">기준수당</div>
        <table className="grid allowance-rule-grid">
          <thead><tr><th>보증금</th><th>근무수당</th><th>미근무수당</th><th></th></tr></thead>
          <tbody>
            {allowanceRules.map((rule) => (
              <tr key={rule.id}>
                <td><input className="input-input" value={rule.deposit} onChange={(e) => setAllowanceRules((prev) => prev.map((x) => x.id === rule.id ? ({ ...x, deposit: e.target.value }) : x))} /></td>
                <td><input className="input-input" value={rule.workAmount} onChange={(e) => setAllowanceRules((prev) => prev.map((x) => x.id === rule.id ? ({ ...x, workAmount: e.target.value }) : x))} /></td>
                <td><input className="input-input" value={rule.nonWorkAmount} onChange={(e) => setAllowanceRules((prev) => prev.map((x) => x.id === rule.id ? ({ ...x, nonWorkAmount: e.target.value }) : x))} /></td>
                <td><button className="line-btn rule-delete-btn" onClick={() => setAllowanceRules((prev) => prev.filter((x) => x.id !== rule.id))}><Trash2 size={18} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="actions">
          <button className="line-btn" onClick={() => setAllowanceRules((prev) => [...prev, { id: Date.now(), deposit: "0", workAmount: "0", nonWorkAmount: "0" }])}>조건 추가</button>
          <button className="primary-btn">조건저장</button>
        </div>
        <label className="field"><span>계약서 원본 PDF 파일 등록</span><div className="dropzone">PDF 파일 업로드 영역</div></label>
        <label className="field"><span>계약서 내용 / 조건 등록</span><textarea className="input-input" style={{ minHeight: 96 }} value={contractTemplate.condition} onChange={(e) => setContractTemplate((p) => ({ ...p, condition: e.target.value }))} /></label>
      </section>
    </div>
  );
}

function ContractDetail({ onBack }: { onBack: () => void }) {
  const [tab, setTab] = useState<DetailTab>("basic");
  const [changeOpen, setChangeOpen] = useState(false);
  const [changeMemo, setChangeMemo] = useState("");
  const [changeHistoryRows, setChangeHistoryRows] = useState<Array<{ at: string; before: string; after: string; reason: string; changedFields: Array<{ field: string; before: string; after: string }> }>>([]);
  const [historyDetailOpen, setHistoryDetailOpen] = useState(false);
  const [selectedHistory, setSelectedHistory] = useState<null | { at: string; before: string; after: string; reason: string; changedFields: Array<{ field: string; before: string; after: string }> }>(null);
  const [changeFields, setChangeFields] = useState([
    { field: "계약번호", before: "LASM-20240520-001", after: "LASM-20240520-001", readOnlyAfter: true },
    { field: "계약자명", before: "김영수", after: "김영수" },
    { field: "추천인명", before: "이철수", after: "이철수" },
    { field: "계약종류", before: "LAS점장점주", after: "LAS점장점주", readOnlyAfter: true },
    { field: "계약일자", before: "2024-05-20", after: "2024-05-20" },
    { field: "수당지급일", before: "2024-07-20", after: "2024-07-20" },
    { field: "계약종료일", before: "2027-05-20", after: "2027-05-20" },
    { field: "보증금액", before: "100,000,000 원", after: "100,000,000 원" },
    { field: "수당", before: "1,500,000 원", after: "1,500,000 원" },
    { field: "근무여부", before: "근무", after: "근무" },
    { field: "주소", before: "서울시 강남구 테헤란로 100", after: "서울시 강남구 테헤란로 100" },
    { field: "연락처", before: "010-1230-5670", after: "010-1230-5670" },
    { field: "주민번호", before: "900101-1234567", after: "900101-1234567" },
    { field: "은행명", before: "신한은행", after: "신한은행" },
    { field: "계좌번호", before: "110-123-456789", after: "110-123-456789" },
    { field: "예금주명", before: "김영수", after: "김영수" }
  ]);

  const saveChangeRequest = () => {
    const changed = changeFields.filter((x) => x.before !== x.after);
    const beforeText = changed.length === 0 ? "변경 없음" : changed.map((x) => `${x.field}:${x.before}`).join(" / ");
    const afterText = changed.length === 0 ? "변경 없음" : changed.map((x) => `${x.field}:${x.after}`).join(" / ");
    const now = new Date();
    const at = `${formatDate(now)} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    setChangeHistoryRows((prev) => [{ at, before: beforeText, after: afterText, reason: changeMemo || "-", changedFields: changed }, ...prev]);
    setChangeOpen(false);
    setTab("history");
  };

  const tabs: { key: DetailTab; label: string }[] = [{ key: "basic", label: "기본정보" }, { key: "document", label: "계약서/입금표" }, { key: "allowance", label: "수당정보" }, { key: "account", label: "계좌정보" }, { key: "history", label: "변경이력" }, { key: "memo", label: "메모" }];
  const tabContent = tab === "basic" ? <DetailBasicTab /> : tab === "document" ? <DetailDocumentTab /> : tab === "allowance" ? <DetailAllowanceTab /> : tab === "account" ? <DetailAccountTab /> : tab === "history" ? <DetailHistoryTab rows={changeHistoryRows} onOpenDetail={(row) => { setSelectedHistory(row); setHistoryDetailOpen(true); }} /> : <DetailMemoTab />;
  return <div><div className="head-with-btn"><PageHeader title="계약 상세" desc="계약 정보를 확인하고 관리하세요." /><div className="actions"><button className="line-btn" onClick={() => setChangeOpen(true)}>변경관리</button><button className="line-btn" onClick={onBack}>목록으로</button></div></div><section className="card summary-row"><div><div className="meta-label">계약번호</div><div className="meta-value">LASM-20240520-001</div></div><div><div className="meta-label">계약자</div><div className="meta-value">김영수</div></div><div><div className="meta-label">계약상태</div><div className="meta-value"><span className="badge green">정상운영</span></div></div><div><div className="meta-label">계약일자</div><div className="meta-value">2024-05-20</div></div><div><div className="meta-label">계약종료일</div><div className="meta-value">2027-05-20</div></div></section><div className="tabs">{tabs.map((t) => <button key={t.key} className={tab === t.key ? "tab active" : "tab"} onClick={() => setTab(t.key)}>{t.label}</button>)}</div>{tabContent}
  {changeOpen && (
    <div className="modal-backdrop" onClick={() => setChangeOpen(false)}>
      <section className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="card-title-sm">계약 변경 상세</div>
        <table className="grid change-input-grid">
          <thead><tr><th>항목</th><th>변경전</th><th>변경후</th></tr></thead>
          <tbody>
            {changeFields.map((fc, idx) => (
              <tr key={fc.field}>
                <td>{fc.field}</td>
                <td><span className="cell-text">{fc.before}</span></td>
                <td>
                  {fc.field === "근무여부" ? (
                    <select className="cell-select" value={fc.after} onChange={(e) => setChangeFields((prev) => prev.map((x, i) => i === idx ? ({ ...x, after: e.target.value }) : x))}>
                      <option value="근무">근무</option>
                      <option value="미근무">미근무</option>
                    </select>
                  ) : (
                    <input className="cell-input" value={fc.after} readOnly={Boolean(fc.readOnlyAfter)} onChange={(e) => setChangeFields((prev) => prev.map((x, i) => i === idx ? ({ ...x, after: e.target.value }) : x))} />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th>요청 사유</th>
              <td colSpan={2}><input className="cell-input" value={changeMemo} onChange={(e) => setChangeMemo(e.target.value)} /></td>
            </tr>
          </tfoot>
        </table>
        <div className="actions modal-actions">
          <button className="line-btn" onClick={() => setChangeOpen(false)}>취소</button>
          <button className="primary-btn" onClick={saveChangeRequest}>승인요청 및 저장</button>
        </div>
      </section>
    </div>
  )}
  {historyDetailOpen && selectedHistory && (
    <div className="modal-backdrop" onClick={() => setHistoryDetailOpen(false)}>
      <section className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="card-title-sm">변경이력 상세</div>
        <table className="grid change-input-grid">
          <thead><tr><th>항목</th><th>변경전</th><th>변경후</th></tr></thead>
          <tbody>
            {selectedHistory.changedFields.length === 0 ? (
              <tr><td>변경 없음</td><td>-</td><td>-</td></tr>
            ) : (
              selectedHistory.changedFields.map((x) => (
                <tr key={`${selectedHistory.at}-${x.field}`}>
                  <td>{x.field}</td>
                  <td><span className="cell-text">{x.before}</span></td>
                  <td><span className="cell-text">{x.after}</span></td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot>
            <tr>
              <th>요청 사유</th>
              <td colSpan={2}><span className="cell-text">{selectedHistory.reason}</span></td>
            </tr>
          </tfoot>
        </table>
        <div className="actions modal-actions history-modal-actions">
          <button className="primary-btn history-close-btn" onClick={() => setHistoryDetailOpen(false)}>닫기</button>
        </div>
      </section>
    </div>
  )}
  </div>;
}

export function App() {
  const [users, setUsers] = useState<UserAccount[]>([
    { id: 1, email: "admin@las.com", role: "시스템관리자", state: "활성", password: "admin123" },
    { id: 2, email: "emp1@las.com", role: "운영자", state: "활성", password: "lasbook" },
    { id: 3, email: "emp2@las.com", role: "운영자", state: "활성", password: "lasbook" }
  ]);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [authUser, setAuthUser] = useState<UserAccount | null>(null);
  const [menu, setMenu] = useState<MenuKey>("dashboard");
  const [contractView, setContractView] = useState<ContractView>("list");

  const addUserWithTempPassword = (email: string, role: "시스템관리자" | "운영자") => {
    const nextId = users.length ? Math.max(...users.map((u) => u.id)) + 1 : 1;
    const tempPassword = makeTempPassword();
    setUsers((prev) => [...prev, { id: nextId, email, role, state: "활성", password: tempPassword }]);
    alert(`사용자 추가 완료\n이메일: ${email}\n임시비밀번호: ${tempPassword}`);
  };

  const resetPassword = (id: number) => {
    const tempPassword = makeTempPassword();
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, password: tempPassword } : u)));
    const target = users.find((u) => u.id === id);
    alert(`비밀번호 초기화 완료\n이메일: ${target?.email ?? "-"}\n임시비밀번호: ${tempPassword}`);
  };

  const doLogin = () => {
    const target = users.find((u) => u.email.toLowerCase() === loginEmail.trim().toLowerCase());
    if (!target) {
      setLoginError("등록되지 않은 이메일입니다.");
      return;
    }
    if (target.state !== "활성") {
      setLoginError("비활성 사용자입니다.");
      return;
    }
    if (target.password !== loginPassword) {
      setLoginError("비밀번호가 일치하지 않습니다.");
      return;
    }
    setAuthUser(target);
    setLoginError("");
  };

  const content = useMemo(() => {
    if (menu === "dashboard") return <DashboardPage onDetail={() => { setMenu("contracts"); setContractView("detail"); }} />;
    if (menu === "contracts") {
      if (contractView === "create") return <ContractCreate onBack={() => setContractView("list")} />;
      if (contractView === "detail") return <ContractDetail onBack={() => setContractView("list")} />;
      return <ContractList onCreate={() => setContractView("create")} onDetail={() => setContractView("detail")} />;
    }
    if (menu === "referrers") return <ReferrerPage />;
    if (menu === "allowances") return <AllowancePage />;
    if (menu === "account") return <AccountPage />;
    return <SystemPage users={users} setUsers={setUsers} onAddUserWithTempPassword={addUserWithTempPassword} onResetPassword={resetPassword} />;
  }, [menu, contractView, users]);

  if (!authUser) {
    return (
      <div className="login-shell">
        <section className="login-card">
          <h1>계약관리 로그인</h1>
          <label className="field"><span>이메일</span><input className="input-input" type="email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} placeholder="admin@contractmanager.com" /></label>
          <label className="field"><span>비밀번호</span><input className="input-input" type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} placeholder="비밀번호" onKeyDown={(e) => { if (e.key === "Enter") doLogin(); }} /></label>
          {loginError ? <div className="login-error">{loginError}</div> : null}
          <button className="primary-btn login-btn" onClick={doLogin}>로그인</button>
        </section>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-wrap">
          <img className="brand-logo" src="/logo.png" alt="LAS 로고" />
          <div className="brand">LAS계약관리</div>
        </div>
        {menus.map((m) => (
          <button
            key={m.key}
            className={`nav ${menu === m.key ? "active" : ""}`}
            onClick={() => {
              setMenu(m.key);
              if (m.key !== "contracts") setContractView("list");
            }}
          >
            {m.icon}<span>{m.label}</span>
          </button>
        ))}
      </aside>
      <div className="main-wrap">
        <header className="topbar"><Menu size={20} /><h2>{menus.find((m) => m.key === menu)?.label}</h2><div className="spacer" /><Bell size={18} /><div className="user"><UserRound size={16} /> {authUser.email} ({authUser.role})</div></header>
        <main className="main">{content}</main>
        <footer className="footer">© 2024 계약관리 시스템. All rights reserved.</footer>
      </div>
    </div>
  );
}

