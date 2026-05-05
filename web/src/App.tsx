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
  Pencil,
  Plus,
  Search,
  Settings,
  Trash2,
  UserRound,
  Users,
  Wallet,
  X
} from "lucide-react";
import { useEffect, useMemo, useState, type ChangeEvent, type Dispatch, type SetStateAction } from "react";

type ContractRowData = {
  id: number;
  no: string;
  name: string;
  ref: string;
  bankName?: string;
  accountNo?: string;
  type: string;
  contractDate: string;
  payoutDate: string;
  endDate: string;
  depositAmount: string;
  depositAmountRaw?: number | null;
  allowanceAmount: string;
  allowanceAmountRaw?: number | null;
  phone?: string;
  status: string;
  verify: string;
  accountHolder?: string;
  residentRegistrationNumber?: string;
  isAppointment?: boolean;
  insuranceType?: string;
  workStartDate?: string;
  reportStartDate?: string;
  position?: string;
};

type MenuKey = "dashboard" | "contracts" | "appointment" | "referrers" | "allowances" | "salaries" | "account" | "changes" | "system" | "none";
type ContractView = "list" | "create" | "detail";
type DetailTab = "basic" | "document" | "allowance" | "account" | "history" | "memo";
type UserAccount = { id: number; email: string; role: "시스템관리자" | "운영자"; state: "활성" | "비활성"; password: string };
type ContractTypeRule = { id: number; deposit: number; workAmount4: number; workAmount2: number; nonWorkAmount: number };
type ContractTypeRow = { id: number; name: string; contractYears: number; payoutMonths: number; rules: ContractTypeRule[] };

const BANKS = ["KB국민은행","신한은행","우리은행","하나은행","NH농협은행","IBK기업은행","카카오뱅크","토스뱅크","SC제일은행","경남은행","광주은행","대구은행","부산은행","전북은행","제주은행","케이뱅크","수협은행","우체국","신협","아이엠뱅크"];

function numFmt(v: string): string {
  const n = v.replace(/[^\d]/g, "");
  return n === "" ? "" : Number(n).toLocaleString("ko-KR");
}
function rrnFmt(v: string): string {
  const n = v.replace(/[^\d]/g, "").slice(0, 13);
  if (n.length <= 6) return n;
  return n.slice(0, 6) + "-" + n.slice(6);
}
function phoneFmt(v: string): string {
  const n = v.replace(/[^\d]/g, "").slice(0, 11);
  if (n.length <= 3) return n;
  if (n.length <= 7) return n.slice(0, 3) + "-" + n.slice(3);
  return n.slice(0, 3) + "-" + n.slice(3, 7) + "-" + n.slice(7);
}

const menus: { key: MenuKey; label: string; icon: JSX.Element; indent?: boolean; isHeader?: boolean }[] = [
  { key: "dashboard", label: "대시보드", icon: <Home size={18} /> },
  { key: "none", label: "계약관리", isHeader: true, icon: <FileText size={18} /> },
  { key: "contracts", label: "점주점장계약", indent: true, icon: <UserRound size={18} /> },
  { key: "appointment", label: "임용계약", indent: true, icon: <Plus size={18} /> },
  { key: "none", label: "지급관리", isHeader: true, icon: <Wallet size={18} /> },
  { key: "allowances", label: "수당지급", indent: true, icon: <CircleDollarSign size={18} /> },
  { key: "salaries", label: "급여지급", indent: true, icon: <Landmark size={18} /> },
  { key: "referrers", label: "추천인관리", icon: <Users size={18} /> },
  { key: "system", label: "시스템관리", icon: <Settings size={18} /> }
];

const APPOINTMENT_STATUS_OPTIONS = ["정상운영", "일시정지", "계약해지", "계약만료"];

function appointmentStatusClass(status: string) {
  if (status === "정상운영") return "green";
  if (status === "일시정지") return "orange";
  if (status === "계약해지" || status === "계약만료") return "red";
  return "";
}

function AppointmentListTable({ onDetail, rows, onStatusChange }: { onDetail: (row: ContractRowData) => void; rows: ContractRowData[]; onStatusChange: (id: number, status: string) => void }) {
  return (
    <table className="grid allowance-grid">
      <thead>
        <tr>
          <th className="center-th">계약자명</th>
          <th>계약종류</th>
          <th>추천인</th>
          <th>계약일자</th>
          <th>급여일</th>
          <th>계약종료일</th>
          <th>급여</th>
          <th>활동비</th>
          <th className="center-th">계약상태</th>
          <th>상세</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id}>
            <td>{r.name}</td>
            <td>{r.type}</td>
            <td>{r.ref}</td>
            <td>{r.contractDate}</td>
            <td>{r.payoutDate}</td>
            <td>{r.endDate}</td>
            <td>{r.depositAmount}</td>
            <td>{r.allowanceAmount}</td>
            <td className="center-td">
              <select
                className={`status-select status-${appointmentStatusClass(r.status || "정상운영")}`}
                value={r.status || "정상운영"}
                onChange={(e) => onStatusChange(r.id, e.target.value)}
              >
                {APPOINTMENT_STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </td>
            <td><button className="icon-btn" onClick={() => onDetail(r)}><Eye size={14} /></button></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function AppointmentPage({ onCreate, onDetail, rows, onStatusChange }: { onCreate: () => void; onDetail: (row: ContractRowData) => void; rows: ContractRowData[]; onStatusChange: (id: number, status: string) => void }) {
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);

  const filtered = rows.filter((r) => {
    const q = search.trim().toLowerCase();
    if (q && !r.name.toLowerCase().includes(q) && !(r.ref || "").toLowerCase().includes(q)) return false;
    if (dateFrom && r.contractDate < dateFrom) return false;
    if (dateTo && r.contractDate > dateTo) return false;
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * perPage, safePage * perPage);

  const handleReset = () => { setSearch(""); setDateFrom(""); setDateTo(""); setPage(1); };

  const pageButtons = (): (number | "...")[] => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages: (number | "...")[] = [1];
    if (safePage > 4) pages.push("...");
    for (let i = Math.max(2, safePage - 2); i <= Math.min(totalPages - 1, safePage + 2); i++) pages.push(i);
    if (safePage < totalPages - 3) pages.push("...");
    pages.push(totalPages);
    return pages;
  };

  return (
    <div>
      <PageHeader title="임용계약" desc="임용계약 목록을 조회하고 관리할 수 있습니다." />
      <section className="card">
        <div className="contract-filter-bar">
          <div className="search-box">
            <Search size={16} />
            <input className="input-input" placeholder="계약자명, 추천인 검색" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          </div>
          <input className="date-filter-input" type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} />
          <span className="date-sep">~</span>
          <input className="date-filter-input" type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} />
          <button className="line-btn" onClick={handleReset}>초기화</button>
          <button className="primary-btn" onClick={onCreate}><Plus size={16} /> 신규 계약 등록</button>
        </div>
      </section>
      <section className="card">
        <div className="card-title-sm">전체 {filtered.length.toLocaleString("ko-KR")}건</div>
        <AppointmentListTable onDetail={onDetail} rows={paged} onStatusChange={onStatusChange} />
        <div className="contract-pagination">
          <div className="pager">
            <button className="pager-btn" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage === 1}>‹</button>
            {pageButtons().map((p, i) =>
              p === "..." ? <span key={`el-${i}`} className="pager-ellipsis">…</span> : (
                <button key={`p-${p}`} className={`pager-btn ${safePage === p ? "active" : ""}`} onClick={() => setPage(p as number)}>{p}</button>
              )
            )}
            <button className="pager-btn" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={safePage === totalPages}>›</button>
          </div>
        </div>
      </section>
    </div>
  );
}

function AppointmentCreate({ onBack }: { onBack: () => void }) {
  const [contractTypes, setContractTypes] = useState<ContractTypeRow[]>([]);
  const [referrers, setReferrers] = useState<{ id: number; name: string }[]>([]);
  const [selectedType, setSelectedType] = useState<ContractTypeRow | null>(null);

  const today = new Date().toISOString().slice(0, 10);
  const [contractDate, setContractDate] = useState(today);
  const [payoutDate, setPayoutDate] = useState(addMonths(today, 2));
  const [manualPayout, setManualPayout] = useState(false);

  const [position, setPosition] = useState("");
  const [deposit, setDeposit] = useState("");
  const [allowance, setAllowance] = useState("");
  const [referrerId, setReferrerId] = useState("");
  const [referrerSearch, setReferrerSearch] = useState("");
  const [showReferrerList, setShowReferrerList] = useState(false);
  const [contractorName, setContractorName] = useState("");
  const [rrn, setRrn] = useState("");
  const [phone, setPhone] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountNo, setAccountNo] = useState("");
  const [accountOwner, setAccountOwner] = useState("");
  const [insuranceType, setInsuranceType] = useState<"사업소득" | "4대보험">("사업소득");
  const [manualEnd, setManualEnd] = useState(false);
  const [endDateOverride, setEndDateOverride] = useState("");
  const [workStartDate, setWorkStartDate] = useState("");
  const [reportStartDate, setReportStartDate] = useState("");

  const endDate = manualEnd ? endDateOverride : addYears(contractDate, selectedType?.contractYears ?? 3);
  const [contractNo, setContractNo] = useState("");
  const appointmentTypes = contractTypes.filter(t => (t.rules as any[])?.some(r => r.position));
  const positionOptions: string[] = selectedType ? (selectedType.rules as any[]).map(r => r.position).filter(Boolean) : [];

  const generateContractNo = (date: string) => {
    const prefix = `LASE-${compactDate(date)}-`;
    fetch(`${API_BASE}/contracts`).then(r => r.json()).then(data => {
      const rows: any[] = Array.isArray(data.rows) ? data.rows : [];
      const count = rows.filter(r => (r.no || "").startsWith(prefix)).length;
      setContractNo(`${prefix}${String(count + 1).padStart(3, "0")}`);
    }).catch(() => setContractNo(`${prefix}001`));
  };

  useEffect(() => {
    fetch(`${API_BASE}/contract-types`).then((r) => r.json()).then((d) => {
      const types: ContractTypeRow[] = Array.isArray(d.rows) ? d.rows : [];
      setContractTypes(types);
      const appt = types.filter(t => (t.rules as any[])?.some(r => r.position));
      if (appt.length > 0) setSelectedType(appt[0]);
    }).catch(() => {});
    fetch(`${API_BASE}/referrers`).then((r) => r.json()).then((d) => {
      setReferrers(Array.isArray(d.rows) ? d.rows : []);
    }).catch(() => {});
    generateContractNo(today);
  }, []);

  useEffect(() => {
    generateContractNo(contractDate);
  }, [contractDate]);

  useEffect(() => {
    setPosition("");
    setDeposit("");
    setAllowance("");
  }, [selectedType]);

  useEffect(() => {
    if (!position || !selectedType) return;
    const rule = (selectedType.rules as any[]).find(r => r.position === position);
    if (rule) {
      setDeposit(Number(rule.basic || 0).toLocaleString("ko-KR"));
      setAllowance(Number(rule.activity || 0).toLocaleString("ko-KR"));
    }
  }, [position, selectedType]);

  const handleContractDate = (value: string) => {
    setContractDate(value);
    if (!manualPayout) setPayoutDate(addMonths(value, selectedType?.payoutMonths ?? 2));
    if (!manualEnd) setEndDateOverride(addYears(value, selectedType?.contractYears ?? 3));
  };

  const downloadAccountVerification = () => {
    if (!bankName || !accountNo || !accountOwner) {
      alert("은행, 계좌번호, 예금주를 모두 입력해주세요.");
      return;
    }
    const headers = ["*입금은행", "*입금계좌", "고객관리성명", "*입금액"];
    const rowData = [bankName, accountNo, accountOwner, "1"];
    const csvContent = "\uFEFF" + headers.join(",") + "\n" + rowData.join(",");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `계좌검증_${accountOwner}_${new Date().getTime()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
 
  const handleSave = async () => {
    if (!contractorName || !rrn || !phone) {
      alert("계약자명, 주민번호, 연락처 등 필수 정보를 입력해주세요.");
      return;
    }
    const body = {
      contractNo,
      type: selectedType?.name || "임용계약",
      name: contractorName,
      ref: referrers.find(r => String(r.id) === referrerId)?.name || "",
      contractDate,
      payoutDate,
      endDate,
      depositAmountValue: Number(deposit.replace(/[^\d]/g, "")),
      allowanceAmountValue: Number(allowance.replace(/[^\d]/g, "")),
      bankName,
      accountNo,
      accountHolder: accountOwner,
      residentRegistrationNumber: rrn,
      phone,
      status: "승인대기",
      isAppointment: true,
      insuranceType,
      workStartDate: workStartDate || null,
      reportStartDate: reportStartDate || null,
      position: position || null,
      workFlag: true
    };

    try {
      const res = await fetch("/api/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      if (res.ok) {
        alert("임용계약이 등록되었습니다.");
        onBack();
      } else {
        alert("등록 중 오류가 발생했습니다.");
      }
    } catch (err) {
      console.error(err);
      alert("서버 통신 오류가 발생했습니다.");
    }
  };

  return (
    <div>
      <div className="head-with-btn"><PageHeader title="임용계약 등록" desc="계약 정보를 입력하고 등록하세요." /><button className="line-btn" onClick={onBack}>목록으로</button></div>

      <section className="card">
        <div className="card-title-sm">기본정보</div>
        <div className="basic-grid">
          <label className="field">
            <span>계약명</span>
            <select className="input-input" value={selectedType?.id ?? ""} onChange={(e) => {
              const id = Number(e.target.value);
              const t = appointmentTypes.find((x) => x.id === id) ?? null;
              setSelectedType(t);
              if (!manualPayout) setPayoutDate(addMonths(contractDate, t?.payoutMonths ?? 2));
            }}>
              {appointmentTypes.length === 0 && <option value="">임용계약서 없음 — 시스템관리에서 먼저 등록하세요</option>}
              {appointmentTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </label>
          <label className="field"><span>계약번호</span><input className="input-input" value={contractNo} onChange={(e) => setContractNo(e.target.value)} placeholder="계약번호" /></label>
        </div>
      </section>

      <section className="card">
        <div className="group-head">
          <div className="card-title-sm">계약정보</div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "13px", color: "#6b7280" }}>소득구분</span>
            <button
              type="button"
              onClick={() => setInsuranceType(prev => prev === "사업소득" ? "4대보험" : "사업소득")}
              style={{
                width: "52px", height: "28px", borderRadius: "14px", border: "none", cursor: "pointer",
                background: insuranceType === "4대보험" ? "#2563eb" : "#d1d5db",
                position: "relative", transition: "background 0.2s"
              }}
            >
              <span style={{
                position: "absolute", top: "3px",
                left: insuranceType === "4대보험" ? "26px" : "3px",
                width: "22px", height: "22px", borderRadius: "50%",
                background: "#fff", transition: "left 0.2s", display: "block"
              }} />
            </button>
            <span style={{ fontSize: "13px", fontWeight: 600, color: insuranceType === "4대보험" ? "#2563eb" : "#9ca3af" }}>
              {insuranceType}
            </span>
          </div>
        </div>
        <div className="contract-info-row six">
          <label className="field" style={{ position: "relative" }}>
            <span>추천인/추천점</span>
            <input
              className="input-input"
              placeholder="이름 검색 또는 선택"
              value={referrerSearch}
              autoComplete="off"
              onFocus={() => setShowReferrerList(true)}
              onBlur={() => setTimeout(() => setShowReferrerList(false), 150)}
              onChange={(e) => {
                const val = e.target.value;
                setReferrerSearch(val);
                setShowReferrerList(true);
                const found = referrers.find(r => r.name === val);
                setReferrerId(found ? String(found.id) : "");
              }}
            />
            {showReferrerList && (
              <ul style={{
                position: "absolute", top: "100%", left: 0, right: 0,
                maxHeight: "180px", overflowY: "auto",
                background: "#fff", border: "1px solid #ccc", borderRadius: "4px",
                margin: 0, padding: 0, listStyle: "none", zIndex: 999,
                boxShadow: "0 2px 6px rgba(0,0,0,0.15)"
              }}>
                {[...referrers]
                  .filter(r => !referrerSearch || r.name.includes(referrerSearch))
                  .sort((a, b) => a.name.localeCompare(b.name, "ko"))
                  .map(r => (
                    <li key={r.id}
                      style={{ padding: "6px 10px", cursor: "pointer", fontSize: "13px" }}
                      onMouseEnter={e => (e.currentTarget.style.background = "#f0f0f0")}
                      onMouseLeave={e => (e.currentTarget.style.background = "")}
                      onMouseDown={() => {
                        setReferrerSearch(r.name);
                        setReferrerId(String(r.id));
                        setShowReferrerList(false);
                      }}
                    >{r.name}</li>
                  ))}
              </ul>
            )}
          </label>
          <label className="field"><span>계약자명</span><input className="input-input" placeholder="계약자명" value={contractorName} onChange={(e) => setContractorName(e.target.value)} /></label>
          <label className="field"><span>주민번호</span><input className="input-input" placeholder="000000-0000000" value={rrn} onChange={(e) => setRrn(rrnFmt(e.target.value))} maxLength={14} /></label>
          <label className="field"><span>연락처</span><input className="input-input" placeholder="010-0000-0000" value={phone} onChange={(e) => setPhone(phoneFmt(e.target.value))} maxLength={13} /></label>
          <label className="field">
            <span>직급</span>
            <select className="input-input" value={position} onChange={(e) => setPosition(e.target.value)}>
              <option value="">-- 선택 --</option>
              {positionOptions.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </label>
          <label className="field">
            <span>연봉(원)</span>
            <input className="input-input" placeholder="0" value={deposit} onChange={(e) => { setDeposit(numFmt(e.target.value)); }} />
          </label>
        </div>
        <div className="contract-info-row six">
          <label className="field"><span>계약일</span><input className="input-input" type="date" value={contractDate} onChange={(e) => handleContractDate(e.target.value)} /></label>
          <label className="field">
            <span>급여일</span>
            <input className="input-input" type="date" value={payoutDate} onChange={(e) => { setManualPayout(true); setPayoutDate(e.target.value); }} />
          </label>
          <label className="field"><span>업무개시일</span><input className="input-input" type="date" value={workStartDate} onChange={(e) => setWorkStartDate(e.target.value)} /></label>
          <label className="field"><span>신고개시일</span><input className="input-input" type="date" value={reportStartDate} onChange={(e) => setReportStartDate(e.target.value)} /></label>
          <label className="field">
            <span>계약종료일</span>
            <input className="input-input" type="date" value={endDate} onChange={(e) => { setManualEnd(true); setEndDateOverride(e.target.value); }} />
          </label>
          <label className="field">
            <span>활동비(원)</span>
            <input className="input-input" placeholder="0" value={allowance} onChange={(e) => { setAllowance(numFmt(e.target.value)); }} />
          </label>
        </div>
      </section>

      <section className="card">
        <div className="card-title-sm">계좌정보</div>
        <div className="account-inline">
          <select className="input-input" value={bankName} onChange={(e) => setBankName(e.target.value)}>
            <option value="">-- 은행/기관 선택 --</option>
            {BANKS.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
          <input className="input-input" placeholder="계좌번호" value={accountNo} onChange={(e) => setAccountNo(e.target.value)} />
          <input className="input-input" placeholder="예금주" value={accountOwner} onChange={(e) => setAccountOwner(e.target.value)} />
          <button className="primary-btn action-btn" onClick={downloadAccountVerification}>계좌확인생성</button>
        </div>
      </section>

      <div className="actions contract-create-actions">
        <button className="line-btn create-action-btn" onClick={onBack}>취소</button>
        <button className="primary-btn create-action-btn" onClick={handleSave}>저장</button>
      </div>
    </div>
  );
}

// 2025 간이세액표 (부양가족 1인) [월급여, 소득세]
const TAX_TABLE: [number, number][] = [
  [1060000, 0], [1500000, 14060], [2000000, 35510], [2500000, 57000],
  [3000000, 78410], [3500000, 103190], [4000000, 132440], [4500000, 163690],
  [5000000, 196940], [5500000, 233080], [6000000, 267490],
  [7000000, 341490], [8000000, 440000], [10000000, 650000],
];
function calcIncomeTax(monthly: number): number {
  if (monthly <= TAX_TABLE[0][0]) return 0;
  for (let i = 1; i < TAX_TABLE.length; i++) {
    if (monthly <= TAX_TABLE[i][0]) {
      const [x0, t0] = TAX_TABLE[i - 1];
      const [x1, t1] = TAX_TABLE[i];
      return Math.round(t0 + (t1 - t0) * (monthly - x0) / (x1 - x0));
    }
  }
  const [xLast, tLast] = TAX_TABLE[TAX_TABLE.length - 1];
  return Math.round(tLast + (monthly - xLast) * 0.38);
}
function calcSocialInsurance(salary: number, activity: number): number {
  const monthly = Math.round(salary / 12);
  const taxFreeActivity = Math.min(activity, 400000);
  const taxableActivity = Math.max(activity - 400000, 0);
  const base = Math.min(monthly + taxableActivity, 5900000); // 국민연금 상한
  const pension = Math.round(base * 0.045);
  const health = Math.round(base * 0.03545);
  const ltc = Math.round(health * 0.1295);
  const employ = Math.round(base * 0.009);
  const incomeTax = calcIncomeTax(monthly + taxableActivity);
  const localTax = Math.round(incomeTax * 0.1);
  const totalDeduction = pension + health + ltc + employ + incomeTax + localTax;
  return (monthly + taxFreeActivity + taxableActivity) - totalDeduction;
}

function SalaryPage({ rows }: { rows: ContractRowData[] }) {
  const today = new Date().toISOString().slice(0, 10);
  const [startDate, setStartDate] = useState(`${new Date().getFullYear()}-01-01`);
  const [endDate, setEndDate] = useState(today);
  const [contractorFilter, setContractorFilter] = useState("전체");
  const [perPage, setPerPage] = useState(20);
  const [page, setPage] = useState(1);
  const [activityOverrides, setActivityOverrides] = useState<Record<number, number>>({});


  const allowanceRows = (rows || []).map((r) => {
    const rawAccountNo = r.accountNo || "";
    const masked = rawAccountNo.length > 4
      ? rawAccountNo.slice(0, rawAccountNo.length - 4).replace(/\d/g, "*") + rawAccountNo.slice(-4)
      : rawAccountNo;
    return {
      ...r,
      baseDate: r.payoutDate || "",
      amount: Number(r.allowanceAmountRaw ?? 0),
      salary: Number(r.depositAmountRaw ?? 0),
      bankName: r.bankName || "",
      accountNo: rawAccountNo,
      accountMasked: masked || "",
      verifyStatus: "검증완료",
    };
  });

  const filteredRows = allowanceRows.filter((row) => {
    const inDate = (!startDate || (row.baseDate && row.baseDate >= startDate)) &&
                   (!endDate   || (row.baseDate && row.baseDate <= endDate));
    const inContractor = !contractorFilter || contractorFilter === "전체" || row.name.includes(contractorFilter);
    return inDate && inContractor;
  }).sort((a, b) => b.baseDate.localeCompare(a.baseDate) || a.name.localeCompare(b.name, "ko"));

  const getActivity = (r: typeof filteredRows[0]) => activityOverrides[r.id] ?? r.amount;
  const paidAmount = (r: typeof filteredRows[0]) => {
    const activity = getActivity(r);
    if (r.insuranceType === "4대보험") return calcSocialInsurance(r.salary, activity);
    return Math.round((r.salary / 12 + activity) * 0.967);
  };

  const totalPaid = filteredRows.reduce((sum, r) => sum + paidAmount(r), 0);
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / perPage));
  const safePage = Math.min(page, totalPages);
  const pagedRows = filteredRows.slice((safePage - 1) * perPage, safePage * perPage);

  const amountText = (value: number) => `${Number(value).toLocaleString("ko-KR")} 원`;

  const pageButtons = (): (number | "...")[] => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages: (number | "...")[] = [1];
    if (safePage > 4) pages.push("...");
    for (let i = Math.max(2, safePage - 2); i <= Math.min(totalPages - 1, safePage + 2); i++) pages.push(i);
    if (safePage < totalPages - 3) pages.push("...");
    pages.push(totalPages);
    return pages;
  };

  const exportFilteredList = async () => {
    const amountOnly = (value: number) => `${value.toLocaleString("ko-KR")}원`;
    const body = filteredRows.map((r) => {
      const holder = r.accountHolder || "";
      const name = r.name || "";
      const holderPart = holder && holder !== name ? `(${holder})` : "";
      return [name, amountOnly(paidAmount(r)), r.bankName, r.accountNo + holderPart].join(" ");
    });
    const content = body.join("\r\n");
    const fileName = `급여지급목록_${endDate}_${startDate}.txt`;
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
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
    { label: "지급예정 금액", value: amountText(totalPaid), sub: "기간 내 총 예상 지급", icon: <CircleDollarSign size={22} />, tone: "green" },
    { label: "지급보류 건수", value: `${filteredRows.filter((r) => (r.status || "").includes("대기") || (r.status || "").includes("변경")).length} 건`, sub: "대기/변경 건수", icon: <Landmark size={22} />, tone: "orange" }
  ] as const;

  return (
    <div>
      <PageHeader title="급여지급관리" desc="임직원 급여 정산 및 지급 현황을 관리합니다." />
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
          <label className="field"><span>시작일</span><input className="input-input" type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setPage(1); }} /></label>
          <label className="field"><span>종료일</span><input className="input-input" type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setPage(1); }} /></label>
          <div className="field">
            <span>계약자명</span>
            <div className="search-box" style={{ background: "#fff", position: "relative" }}>
              <Search size={16} />
              <input className="input-input" placeholder="계약자명 검색" value={contractorFilter === "전체" ? "" : contractorFilter} onChange={(e) => setContractorFilter(e.target.value)} title="" autoComplete="off" style={{ paddingRight: "30px" }} />
              <button className="icon-btn" style={{ border: "none", padding: "4px", background: "transparent", color: "#8a97ac", cursor: "pointer", position: "absolute", right: "8px" }} onClick={() => setContractorFilter("전체")}><X size={14} /></button>
            </div>
          </div>
          <div className="allowance-filter-actions">
            <button className="line-btn allowance-reset-btn" onClick={() => { setStartDate(`${new Date().getFullYear()}-01-01`); setEndDate(today); setContractorFilter("전체"); setPage(1); }}>초기화</button>
            <button className="primary-btn allowance-export-btn" onClick={exportFilteredList}>출력</button>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="group-head">
          <div className="card-title-sm">전체 {filteredRows.length.toLocaleString("ko-KR")}건</div>
          <div className="card-title-sm" style={{ fontWeight: 600 }}>지급 총액: {totalPaid.toLocaleString("ko-KR")} 원</div>
        </div>
        <table className="grid allowance-grid">
          <thead>
            <tr><th>급여일</th><th>계약자명</th><th className="text-center">소득구분</th><th>은행명</th><th>계좌번호</th><th>계약일자</th><th>계약종료일</th><th>급여(원)</th><th className="text-center">활동비(원)</th><th className="text-center">지급액(원)</th></tr>
          </thead>
          <tbody>
            {pagedRows.map((r) => (
              <tr key={r.no}>
                <td>{r.baseDate || "-"}</td>
                <td>{r.name || "-"}</td>
                <td className="text-center">
                  <span className={`status-fixed ${r.insuranceType === "4대보험" ? "blue" : "green"}`} style={{ fontSize: "11px", width: "auto", padding: "2px 8px" }}>
                    {r.insuranceType === "4대보험" ? "4대보험" : "사업소득"}
                  </span>
                </td>
                <td>{r.bankName}</td>
                <td>{r.accountMasked}</td>
                <td>{r.contractDate || "-"}</td>
                <td>{r.endDate || "-"}</td>
                <td>{r.salary > 0 ? Math.round(r.salary / 12).toLocaleString("ko-KR") : "-"}</td>
                <td className="text-center">
                  <input
                    className="input-input"
                    style={{ textAlign: "center", width: "100px", padding: "1px 6px", height: "20px", minHeight: "20px" }}
                    value={getActivity(r).toLocaleString("ko-KR")}
                    onChange={(e) => {
                      const n = Number(e.target.value.replace(/[^\d]/g, ""));
                      setActivityOverrides((prev) => ({ ...prev, [r.id]: n }));
                    }}
                  />
                </td>
                <td className="text-center">{paidAmount(r).toLocaleString("ko-KR")}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="contract-pagination">
          <div className="pager">
            <button className="pager-btn" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage === 1}>‹</button>
            {pageButtons().map((p, i) => p === "..." ? <span key={`el-${i}`} className="pager-ellipsis">…</span> : <button key={p} className={`pager-btn${safePage === p ? " active" : ""}`} onClick={() => setPage(p as number)}>{p}</button>)}
            <button className="pager-btn" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={safePage === totalPages}>›</button>
          </div>
          <div className="pager-right">
            {[20, 50, 100].map((n) => <button key={n} className={`pager-btn${perPage === n ? " active" : ""}`} onClick={() => { setPerPage(n); setPage(1); }}>{n}개</button>)}
          </div>
        </div>
      </section>
    </div>
  );
}

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
  return Math.random().toString(36).slice(-8);
}

function formatDateTime(v: string) {
  if (!v) return "-";
  const d = new Date(v);
  if (isNaN(d.getTime())) return v;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day} ${h}:${min}`;
}

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

function DashboardPage({ onDetail, rows }: { onDetail: (row: ContractRowData) => void; rows: ContractRowData[] }) {
  return (
    <div>
      <PageHeader title="대시보드" desc="계약 운영 현황을 한눈에 확인하세요." />

      <StatCards items={[
        { label: "전체 계약", value: (rows || []).length.toLocaleString("ko-KR") + " 건", icon: <FileText size={18} />, tone: "blue" },
        { label: "정상운영", value: (rows || []).filter(r => (r.status || "").includes("정상") || (r.status || "").includes("완료")).length.toLocaleString("ko-KR") + " 건", icon: <CheckCircle2 size={18} />, tone: "green" },
        { label: "지급예정금액", value: (rows || []).reduce((acc, r) => acc + (Number(String(r.allowanceAmount||"").replace(/[^0-9]/g, "")) || 0), 0).toLocaleString("ko-KR") + " 원", icon: <Wallet size={18} />, tone: "orange" },
        { label: "검토 필요", value: (rows || []).filter(r => (r.status || "").includes("대기") || (r.verify || "").includes("오류")).length.toLocaleString("ko-KR") + " 건", icon: <Search size={18} />, tone: "violet" }
      ]} />

      <section className="card"><div className="card-title-sm">최근 계약 현황</div><ContractSimpleTable onDetail={onDetail} rows={rows || []} /></section>
    </div>
  );
}

function ContractSimpleTable({ onDetail, rows }: { onDetail?: (row: ContractRowData) => void; rows: ContractRowData[] }) {
  return (
    <table className="grid">
      <thead><tr><th>계약번호</th><th>계약자명</th><th>추천인</th><th>계약일</th><th>상태</th><th>계좌검증</th><th>상세</th></tr></thead>
      <tbody>
        {rows.slice(0, 10).map((r) => (
          <tr key={r.no}>
            <td>{r.no}</td><td>{r.name}</td><td>{r.ref}</td><td>{r.contractDate}</td><td><span className={`badge ${statusClass(r.status || "")}`}>{r.status}</span></td><td><span className={(r.verify || "").includes("오류") ? "err" : "ok"}>{r.verify || "미검증"}</span></td>
            <td><button className="icon-btn" onClick={() => onDetail?.(r)}><Eye size={14} /></button></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ContractListTable({ onDetail, rows }: { onDetail: (row: ContractRowData) => void; rows: ContractRowData[] }) {
  const compactStatus = (value: string) => {
    if (value === "입금표 미등록") return "입금표미등록";
    return value;
  };

  const compactVerify = (value: string) => {
    if (value === "실명조회 오류") return "실명조회오류";
    return value;
  };

  return (
    <table className="grid contract-grid">
      <thead><tr><th>계약번호</th><th className="center-th">계약자명</th><th>근무여부</th><th>계약종류</th><th>추천인</th><th>계약일자</th><th>수당지급일</th><th>계약종료일</th><th>보증금액</th><th>수당</th><th className="center-th">상태</th><th className="center-th">계좌검증</th><th>상세</th></tr></thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.no}>
            <td>{r.no}</td><td>{r.name}</td><td><input className="work-check" type="checkbox" defaultChecked={r.name !== "박지민"} /></td><td>{r.type}</td><td>{r.ref}</td><td>{r.contractDate}</td><td>{r.payoutDate}</td><td>{r.endDate}</td><td>{r.depositAmount}</td><td>{r.allowanceAmount}</td>
            <td><span className={`status-fixed ${statusClass(r.status || "")}`}>{compactStatus(r.status || "")}</span></td><td><span className={`verify-fixed ${(r.verify || "").includes("오류") ? "err" : "ok"}`}>{compactVerify(r.verify || "미검증")}</span></td>
            <td><button className="icon-btn" onClick={() => onDetail(r)}><Eye size={14} /></button></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ContractList({ onCreate, onDetail, rows }: { onCreate: () => void; onDetail: (row: ContractRowData) => void; rows: ContractRowData[] }) {
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(15);

  const filtered = rows.filter((r) => {
    const q = search.trim().toLowerCase();
    if (q && !r.no.toLowerCase().includes(q) && !r.name.toLowerCase().includes(q) && !(r.ref || "").toLowerCase().includes(q)) return false;
    if (dateFrom && r.contractDate < dateFrom) return false;
    if (dateTo && r.contractDate > dateTo) return false;
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * perPage, safePage * perPage);

  const handleReset = () => { setSearch(""); setDateFrom(""); setDateTo(""); setPage(1); };

  const pageButtons = (): (number | "...")[] => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages: (number | "...")[] = [1];
    if (safePage > 4) pages.push("...");
    for (let i = Math.max(2, safePage - 2); i <= Math.min(totalPages - 1, safePage + 2); i++) pages.push(i);
    if (safePage < totalPages - 3) pages.push("...");
    pages.push(totalPages);
    return pages;
  };

  return (
    <div>
      <PageHeader title="계약 관리" desc="계약 목록을 조회하고 관리할 수 있습니다." />
      <section className="card">
        <div className="contract-filter-bar">
          <div className="search-box">
            <Search size={16} />
            <input className="input-input" placeholder="계약번호, 계약자명, 추천인 검색" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          </div>
          <input className="date-filter-input" type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} />
          <span className="date-sep">~</span>
          <input className="date-filter-input" type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} />
          <button className="line-btn" onClick={handleReset}>초기화</button>
          <button className="primary-btn" onClick={onCreate}><Plus size={16} /> 신규 계약 등록</button>
        </div>
      </section>
      <section className="card">
        <div className="card-title-sm">전체 {filtered.length.toLocaleString("ko-KR")}건</div>
        <ContractListTable onDetail={onDetail} rows={paged} />
        <div className="contract-pagination">
          <div className="pager">
            <button className="pager-btn" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage === 1}>‹</button>
            {pageButtons().map((p, i) =>
              p === "..." ? <span key={`el-${i}`} className="pager-ellipsis">…</span> : (
                <button key={p} className={`pager-btn${safePage === p ? " active" : ""}`} onClick={() => setPage(p as number)}>{p}</button>
              )
            )}
            <button className="pager-btn" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={safePage === totalPages}>›</button>
          </div>
          <div className="pager-right">
            {[15, 50, 100].map((n) => (
              <button key={n} className={`pager-btn${perPage === n ? " active" : ""}`} onClick={() => { setPerPage(n); setPage(1); }}>{n}개</button>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function ContractCreate({ onBack }: { onBack: () => void }) {
  const [contractTypes, setContractTypes] = useState<ContractTypeRow[]>([]);
  const [referrers, setReferrers] = useState<{ id: number; name: string }[]>([]);
  const [selectedType, setSelectedType] = useState<ContractTypeRow | null>(null);

  const today = new Date().toISOString().slice(0, 10);
  const [contractDate, setContractDate] = useState(today);
  const [payoutDate, setPayoutDate] = useState(addMonths(today, 2));
  const [manualPayout, setManualPayout] = useState(false);
  const [workType, setWorkType] = useState<"4일" | "2일" | "미근무">("4일");

  const [deposit, setDeposit] = useState("");
  const [allowance, setAllowance] = useState("");
  const [manualAllowance, setManualAllowance] = useState(false);
  const [referrerId, setReferrerId] = useState("");
  const [referrerSearch, setReferrerSearch] = useState("");
  const [showReferrerList, setShowReferrerList] = useState(false);
  const [contractorName, setContractorName] = useState("");
  const [rrn, setRrn] = useState("");
  const [phone, setPhone] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountNo, setAccountNo] = useState("");
  const [accountOwner, setAccountOwner] = useState("");
  const [manualEnd, setManualEnd] = useState(false);
  const [endDateOverride, setEndDateOverride] = useState("");

  const endDate = manualEnd ? endDateOverride : addYears(contractDate, selectedType?.contractYears ?? 3);
  const contractNo = `LASM-${compactDate(contractDate)}-011`;

  useEffect(() => {
    fetch(`${API_BASE}/contract-types`).then((r) => r.json()).then((d) => {
      const types: ContractTypeRow[] = Array.isArray(d.rows) ? d.rows : [];
      setContractTypes(types);
      if (types.length > 0) setSelectedType(types[0]);
    }).catch(() => {});
    fetch(`${API_BASE}/referrers`).then((r) => r.json()).then((d) => {
      setReferrers(Array.isArray(d.rows) ? d.rows : []);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (manualAllowance || !selectedType?.rules?.length) return;
    const depositNum = Number(deposit.replace(/[^\d]/g, ""));
    if (!depositNum) { setAllowance(""); return; }
    const sorted = [...selectedType.rules].sort((a, b) => a.deposit - b.deposit);
    let matched = sorted[0];
    for (const rule of sorted) { if (rule.deposit <= depositNum) matched = rule; }
    if (matched) {
      const amt = workType === "4일" ? matched.workAmount4 : workType === "2일" ? matched.workAmount2 : matched.nonWorkAmount;
      setAllowance(amt.toLocaleString("ko-KR"));
    }
  }, [deposit, workType, selectedType, manualAllowance]);

  const handleContractDate = (value: string) => {
    setContractDate(value);
    if (!manualPayout) setPayoutDate(addMonths(value, selectedType?.payoutMonths ?? 2));
    if (!manualEnd) setEndDateOverride(addYears(value, selectedType?.contractYears ?? 3));
  };

  const handleTypeChange = (id: number) => {
    const t = contractTypes.find((x) => x.id === id) ?? null;
    setSelectedType(t);
    setManualAllowance(false);
    if (!manualPayout) setPayoutDate(addMonths(contractDate, t?.payoutMonths ?? 2));
  };

  const downloadAccountVerification = () => {
    if (!bankName || !accountNo || !accountOwner) {
      alert("은행, 계좌번호, 예금주를 모두 입력해주세요.");
      return;
    }
    const headers = ["*입금은행", "*입금계좌", "고객관리성명", "*입금액"];
    const rowData = [bankName, accountNo, accountOwner, "1"];
    // UTF-8 BOM (\uFEFF) for Excel compatibility
    const csvContent = "\uFEFF" + headers.join(",") + "\n" + rowData.join(",");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `계좌검증_${accountOwner}_${new Date().getTime()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSave = async () => {
    if (!contractorName || !rrn || !phone) {
      alert("계약자명, 주민번호, 연락처 등 필수 정보를 입력해주세요.");
      return;
    }
    const body = {
      contractNo,
      type: selectedType?.name || "",
      name: contractorName,
      ref: referrers.find(r => String(r.id) === referrerId)?.name || "",
      contractDate,
      payoutDate,
      endDate,
      depositAmountValue: Number(deposit.replace(/[^\d]/g, "")),
      allowanceAmountValue: Number(allowance.replace(/[^\d]/g, "")),
      bankName,
      accountNo,
      accountHolder: accountOwner,
      residentRegistrationNumber: rrn,
      phone,
      status: "승인대기",
      isAppointment: false,
      workFlag: workType !== "미근무"
    };

    try {
      const res = await fetch("/api/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      if (res.ok) {
        alert("계약이 등록되었습니다.");
        onBack();
      } else {
        alert("등록 중 오류가 발생했습니다.");
      }
    } catch (err) {
      console.error(err);
      alert("서버 통신 오류가 발생했습니다.");
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
            <select className="input-input" value={selectedType?.id ?? ""} onChange={(e) => handleTypeChange(Number(e.target.value))}>
              {contractTypes.length === 0 && <option value="">계약서 없음 — 시스템관리에서 먼저 등록하세요</option>}
              {contractTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
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
            <select className="input-input work-type-select" value={workType} onChange={(e) => { setWorkType(e.target.value as "4일" | "2일" | "미근무"); setManualAllowance(false); }}>
              <option value="4일">4일근무</option>
              <option value="2일">2일근무</option>
              <option value="미근무">미근무</option>
            </select>
          </label>
        </div>
        <div className="contract-info-row create-row">
          <label className="field" style={{ position: "relative" }}>
            <span>추천인명</span>
            <input
              className="input-input"
              placeholder="이름 검색 또는 선택"
              value={referrerSearch}
              autoComplete="off"
              onFocus={() => setShowReferrerList(true)}
              onBlur={() => setTimeout(() => setShowReferrerList(false), 150)}
              onChange={(e) => {
                const val = e.target.value;
                setReferrerSearch(val);
                setShowReferrerList(true);
                const found = referrers.find(r => r.name === val);
                setReferrerId(found ? String(found.id) : "");
              }}
            />
            {showReferrerList && (
              <ul style={{
                position: "absolute", top: "100%", left: 0, right: 0,
                maxHeight: "180px", overflowY: "auto",
                background: "#fff", border: "1px solid #ccc", borderRadius: "4px",
                margin: 0, padding: 0, listStyle: "none", zIndex: 999,
                boxShadow: "0 2px 6px rgba(0,0,0,0.15)"
              }}>
                {[...referrers]
                  .filter(r => !referrerSearch || r.name.includes(referrerSearch))
                  .sort((a, b) => a.name.localeCompare(b.name, "ko"))
                  .map(r => (
                    <li key={r.id}
                      style={{ padding: "6px 10px", cursor: "pointer", fontSize: "13px" }}
                      onMouseEnter={e => (e.currentTarget.style.background = "#f0f0f0")}
                      onMouseLeave={e => (e.currentTarget.style.background = "")}
                      onMouseDown={() => {
                        setReferrerSearch(r.name);
                        setReferrerId(String(r.id));
                        setShowReferrerList(false);
                      }}
                    >{r.name}</li>
                  ))}
              </ul>
            )}
          </label>
          <label className="field"><span>계약자명</span><input className="input-input" placeholder="계약자명" value={contractorName} onChange={(e) => setContractorName(e.target.value)} /></label>
          <label className="field"><span>주민번호</span><input className="input-input" placeholder="000000-0000000" value={rrn} onChange={(e) => setRrn(rrnFmt(e.target.value))} maxLength={14} /></label>
          <label className="field"><span>연락처</span><input className="input-input" placeholder="010-0000-0000" value={phone} onChange={(e) => setPhone(phoneFmt(e.target.value))} maxLength={13} /></label>
        </div>
        <div className="contract-info-row create-row">
          <label className="field">
            <span>보증금(원)</span>
            <input className="input-input" placeholder="0" value={deposit} onChange={(e) => { setDeposit(numFmt(e.target.value)); setManualAllowance(false); }} />
          </label>
          <label className="field">
            <span>수당(원)</span>
            <input className="input-input" placeholder="0" value={allowance} onChange={(e) => { setAllowance(numFmt(e.target.value)); setManualAllowance(true); }} />
          </label>
          <label className="field"><span>계약일</span><input className="input-input" type="date" value={contractDate} onChange={(e) => handleContractDate(e.target.value)} /></label>
          <label className="field">
            <span>수당지급일</span>
            <input className="input-input" type="date" value={payoutDate} onChange={(e) => { setManualPayout(true); setPayoutDate(e.target.value); }} />
          </label>
          <label className="field">
            <span>계약종료일</span>
            <input className="input-input" type="date" value={endDate} onChange={(e) => { setManualEnd(true); setEndDateOverride(e.target.value); }} />
          </label>
        </div>
      </section>

      <section className="card">
        <div className="card-title-sm">계좌정보</div>
        <div className="account-inline">
          <select className="input-input" value={bankName} onChange={(e) => setBankName(e.target.value)}>
            <option value="">-- 은행/기관 선택 --</option>
            {BANKS.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
          <input className="input-input" placeholder="계좌번호" value={accountNo} onChange={(e) => setAccountNo(e.target.value)} />
          <input className="input-input" placeholder="예금주" value={accountOwner} onChange={(e) => setAccountOwner(e.target.value)} />
          <button className="primary-btn action-btn" onClick={downloadAccountVerification}>계좌확인생성</button>
        </div>
      </section>

      <section className="card">
        <div className="card-title-sm">첨부파일</div>
        <div className="form-grid">
          <label className="field"><span>첨부파일(계약서, 입금증, 신분증 포함)</span><div className="dropzone">파일을 드래그하거나 클릭하여 업로드하세요</div></label>
        </div>
      </section>

      <div className="actions contract-create-actions">
        <button className="line-btn create-action-btn" onClick={onBack}>취소</button>
        <button className="primary-btn create-action-btn" onClick={handleSave}>저장</button>
      </div>
    </div>
  );
}

function DetailBasicTab({ row }: { row: ContractRowData | null }) {
  return (
    <section className="card">
      <div className="card-title-sm">기본정보</div>
      <table className="grid"><tbody>
        <tr><th>계약번호</th><td>{row?.no ?? "-"}</td><th>계약일</th><td>{row?.contractDate ?? "-"}</td></tr>
        <tr><th>계약종류</th><td>{row?.type ?? "-"}</td><th>계약종료일</th><td>{row?.endDate ?? "-"}</td></tr>
        <tr><th>계약자명</th><td>{row?.name ?? "-"}</td><th>{row?.isAppointment ? "연봉" : "보증금"}</th><td>{row?.depositAmount || "-"}</td></tr>
        <tr><th>주민번호</th><td>{row?.residentRegistrationNumber || "-"}</td><th>{row?.isAppointment ? "급여일" : "첫수당지급일"}</th><td>{row?.payoutDate ?? "-"}</td></tr>
        <tr><th>연락처</th><td>{row?.phone || "-"}</td><th>계약상태</th><td>{row?.status ?? "정상운영"}</td></tr>
      </tbody></table>
    </section>
  );
}
function DetailDocumentTab({ row }: { row: ContractRowData | null }) {
  const pdfLabel = row ? `${row.type}_${row.contractDate}_${row.name}.pdf` : "";
  return (
    <section className="card">
      <div className="card-title-sm">계약서 (입금표/신분증 포함)</div>
      <div className="card">
        <div className="pdf-filename">{pdfLabel || "파일 미등록"}</div>
        {!pdfLabel ? (
          <div className="pdf-empty-box">등록된 계약서 파일이 없습니다.</div>
        ) : (
          <div className="pdf-preview-placeholder">
            <FileText size={48} strokeWidth={1} />
            <p>PDF 파일을 확인하려면 아래 버튼을 클릭하세요.</p>
          </div>
        )}
        <div className="actions detail-file-actions">
          <button className="primary-btn" onClick={() => {
            if (!row?.id) return;
            const url = `${API_BASE}/contracts/${row.id}/pdf`;
            window.open(url, "_blank");
          }}>계약서 보기</button>
          <button className="line-btn">파일 업로드/변경</button>
        </div>
      </div>
    </section>
  );
}
function DetailAllowanceTab() { return <section className="card"><div className="card-title-sm">수당정보</div><table className="grid"><thead><tr><th>기준월</th><th>산정수당</th><th>공제</th><th>실지급예정금액</th><th>지급상태</th></tr></thead><tbody><tr><td colSpan={5}>수당 정보가 없습니다.</td></tr></tbody></table></section>; }
function DetailAccountTab({ row }: { row: ContractRowData | null }) {
  return (
    <section className="card">
      <div className="card-title-sm">현재 계좌 정보</div>
      <table className="grid">
        <tbody>
          <tr><th>은행명</th><td>{row?.bankName || "-"}</td></tr>
          <tr><th>계좌번호</th><td>{row?.accountNo || "-"}</td></tr>
          <tr><th>예금주명</th><td>{row?.accountHolder || "-"}</td></tr>
          <tr><th>계좌실명조회 상태</th><td><span className={`badge ${row?.verify === "검증완료" ? "green" : "red"}`}>{row?.verify || "미검증"}</span></td></tr>
        </tbody>
      </table>
    </section>
  );
}
function DetailHistoryTab({
  rows,
  onOpenDetail
}: {
  rows: Array<{ at: string; before: string; after: string; reason: string; requester: string; changedFields: Array<{ field: string; before: string; after: string }> }>;
  onOpenDetail: (row: { at: string; before: string; after: string; reason: string; requester: string; changedFields: Array<{ field: string; before: string; after: string }> }) => void;
}) {
  return (
    <section className="card">
      <div className="card-title-sm">변경이력</div>
      <table className="grid">
        <thead>
          <tr>
            <th>요청일시</th>
            <th>변경유형</th>
            <th>변경 전</th>
            <th>변경 후</th>
            <th>요청사유</th>
            <th>요청자</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={6}>변경 이력이 없습니다.</td></tr>
          ) : (
            rows.map((row, i) => (
              <tr key={`${row.at}-${i}`} style={{ cursor: "pointer" }} onClick={() => onOpenDetail(row)}>
                <td>{formatDateTime(row.at)}</td>
                <td>계약정보변경</td>
                <td><div className="text-wrap-cell">{row.before}</div></td>
                <td><div className="text-wrap-cell">{row.after}</div></td>
                <td><div className="reason-cell">{row.reason || "-"}</div></td>
                <td>{row.requester || "관리자"}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </section>
  );
}
function DetailMemoTab({ row, onRefresh }: { row: ContractRowData | null; onRefresh?: () => void }) {
  const [memos, setMemos] = useState<Array<{ slotIndex: number; content: string; updatedAt: string }>>([]);
  const [localMemos, setLocalMemos] = useState<string[]>(["", "", "", "", ""]);
  const [savingSlot, setSavingSlot] = useState<number | null>(null);

  const fetchMemos = () => {
    if (!row?.id) return;
    fetch(`/api/contracts/${row.id}/memos`)
      .then(res => res.json())
      .then(data => {
        if (data.rows) {
          setMemos(data.rows);
          const nextLocal = ["", "", "", "", ""];
          data.rows.forEach((m: any) => {
            if (m.slotIndex >= 0 && m.slotIndex < 5) nextLocal[m.slotIndex] = m.content;
          });
          setLocalMemos(nextLocal);
        }
      });
  };

  useEffect(() => { fetchMemos(); }, [row?.id]);

  const handleSave = async (slotIndex: number) => {
    if (!row?.id) return;
    setSavingSlot(slotIndex);
    try {
      const res = await fetch(`/api/contracts/${row.id}/memos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slotIndex, content: localMemos[slotIndex] })
      });
      if (res.ok) {
        alert(`${slotIndex + 1}번 행 메모가 저장되었습니다.`);
        fetchMemos();
        if (onRefresh) onRefresh();
      }
    } finally { setSavingSlot(null); }
  };

  return (
    <section className="card">
      <div className="card-title-sm">메모 관리 (5개 행)</div>
      <table className="grid" style={{ tableLayout: "fixed" }}>
        <thead>
          <tr>
            <th style={{ width: "120px" }}>No</th>
            <th style={{ width: "150px" }}>최종수정일</th>
            <th>메모 내용</th>
            <th style={{ width: "100px" }}>관리</th>
          </tr>
        </thead>
        <tbody>
          {[0, 1, 2, 3, 4].map((idx) => {
            const dbMemo = memos.find(m => m.slotIndex === idx);
            return (
              <tr key={idx}>
                <td style={{ textAlign: "center", fontWeight: 600 }}>{idx + 1}</td>
                <td style={{ textAlign: "center", color: "#66758f", fontSize: "14px" }}>
                  {dbMemo?.updatedAt ? String(dbMemo.updatedAt).slice(0, 10) : "-"}
                </td>
                <td style={{ padding: "0" }}>
                  <textarea
                    className="input memo-box"
                    style={{ border: "0", boxShadow: "none", minHeight: "80px", marginBottom: "0", padding: "12px", width: "100%", background: "#fff", resize: "none" }}
                    value={localMemos[idx]}
                    onChange={(e) => {
                      const next = [...localMemos];
                      next[idx] = e.target.value;
                      setLocalMemos(next);
                    }}
                    placeholder={`${idx + 1}번 메모를 입력하세요...`}
                  />
                </td>
                <td style={{ textAlign: "center" }}>
                  <button
                    className="primary-btn"
                    style={{ padding: "6px 12px", fontSize: "13px" }}
                    onClick={() => handleSave(idx)}
                    disabled={savingSlot === idx}
                  >
                    {savingSlot === idx ? "..." : "저장"}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

const API_BASE = "https://asia-northeast3-contractmanager-32072.cloudfunctions.net/api";

type ReferrerRow = { id: number; name: string; org: string; phone: string; title: string; email?: string; remarks?: string; status: string };

function ReferrerPage() {
  const [referrerRows, setReferrerRows] = useState<ReferrerRow[]>([]);
  const [editingReferrer, setEditingReferrer] = useState<ReferrerRow | null>(null);
  const [modalForm, setModalForm] = useState({ name: "", org: "", phone: "", title: "", email: "", remarks: "" });
  const [referrerForm, setReferrerForm] = useState({ name: "", org: "", phone: "", title: "", email: "", remarks: "" });
  const [isNewOrg, setIsNewOrg] = useState(false);
  const [isModalNewOrg, setIsModalNewOrg] = useState(false);

  const [fName, setFName] = useState("");
  const [fOrg, setFOrg] = useState("");
  const [fEmail, setFEmail] = useState("");
  const [fPhone, setFPhone] = useState("");
  const [fTitle, setFTitle] = useState("");
  const [fRemarks, setFRemarks] = useState("");

  const fetchReferrers = () => {
    fetch(`${API_BASE}/referrers`)
      .then(res => res.json())
      .then(data => setReferrerRows(Array.isArray(data.rows) ? data.rows : []))
      .catch(() => {});
  };

  const deleteReferrer = (id: number) => {
    if (!confirm("정말 삭제하시겠습니까?")) return;
    fetch(`${API_BASE}/referrers/${id}`, { method: "DELETE" })
      .then(() => fetchReferrers())
      .catch(() => {});
  };

  useEffect(() => { fetchReferrers(); }, []);

  const total = referrerRows.length;
  const active = referrerRows.filter(r => r.status === "활성").length;
  const activeRate = total > 0 ? `${((active / total) * 100).toFixed(1)}%` : "-";

  const referrerStats = [
    { label: "총 추천인", value: `${total} 명`, sub: "전체 추천인 수", icon: <Users size={24} />, tone: "blue" },
    { label: "활성 추천인", value: `${active} 명`, sub: activeRate, icon: <CheckCircle2 size={24} />, tone: "green" },
    { label: "계약 연결 수", value: "0 건", sub: "전체 계약 연결", icon: <Link2 size={24} />, tone: "orange" },
    { label: "수당 합계", value: "0 원", sub: "전체 지급 예정/지급 합계", icon: <CircleDollarSign size={24} />, tone: "violet" }
  ] as const;

  const openReferrerDetail = (row: ReferrerRow) => {
    setEditingReferrer(row);
    setModalForm({ 
      name: row.name, 
      org: row.org, 
      phone: row.phone, 
      title: row.title, 
      email: row.email || "", 
      remarks: row.remarks || "",
      createdAt: row.created_at ? String(row.created_at).slice(0, 10) : "",
      updatedAt: row.updated_at ? String(row.updated_at).slice(0, 10) : ""
    });
    setIsModalNewOrg(false);
  };

  const saveReferrerDetail = () => {
    if (!editingReferrer) return;
    fetch(`${API_BASE}/referrers/${editingReferrer.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        name: modalForm.name, 
        org: modalForm.org, 
        phone: modalForm.phone, 
        title: modalForm.title, 
        email: modalForm.email,
        remarks: modalForm.remarks
      })
    }).then(() => { fetchReferrers(); setEditingReferrer(null); }).catch(() => {});
  };

  const saveReferrerForm = () => {
    if (!referrerForm.name.trim() || !referrerForm.org.trim() || !referrerForm.phone.trim()) return;
    fetch(`${API_BASE}/referrers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        name: referrerForm.name.trim(), 
        org: referrerForm.org.trim(), 
        phone: referrerForm.phone.trim(), 
        title: referrerForm.title.trim() || "사원",
        email: referrerForm.email.trim(),
        remarks: referrerForm.remarks.trim()
      })
    }).then(() => { fetchReferrers(); setReferrerForm({ name: "", org: "", phone: "", title: "", email: "", remarks: "" }); setIsNewOrg(false); }).catch(() => {});
  };

  const handleResetFilters = () => {
    setFName(""); setFOrg(""); setFEmail(""); setFPhone(""); setFTitle(""); setFRemarks("");
  };

  const uniqueOrgs = Array.from(new Set(referrerRows.map(r => r.org))).sort((a, b) => a.localeCompare(b, "ko-KR"));

  const filteredReferrers = referrerRows.filter((r) => {
    if (fName && !r.name.includes(fName)) return false;
    if (fOrg && !r.org.includes(fOrg)) return false;
    if (fEmail && !(r.email || "").includes(fEmail)) return false;
    if (fPhone && !r.phone.includes(fPhone)) return false;
    if (fTitle && !r.title.includes(fTitle)) return false;
    if (fRemarks && !(r.remarks || "").includes(fRemarks)) return false;
    return true;
  });

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
      <section className="card">
        <div className="referrer-detailed-filter">
          <label className="field"><span>소속</span>
            <select className="input-input" value={fOrg} onChange={(e) => setFOrg(e.target.value)}>
              <option value="">전체 소속</option>
              {uniqueOrgs.map(org => <option key={org} value={org}>{org}</option>)}
            </select>
          </label>
          <label className="field"><span>이름</span><input className="input-input" value={fName} onChange={(e) => setFName(e.target.value)} /></label>
          <label className="field"><span>전화번호</span><input className="input-input" value={fPhone} onChange={(e) => setFPhone(e.target.value)} /></label>
          <label className="field"><span>이메일</span><input className="input-input" value={fEmail} onChange={(e) => setFEmail(e.target.value)} /></label>
          <label className="field"><span>직급</span><input className="input-input" value={fTitle} onChange={(e) => setFTitle(e.target.value)} /></label>
          <div className="filter-actions-inline">
            <button className="line-btn" onClick={handleResetFilters}>초기화</button>
          </div>
        </div>
      </section>

      <section className="card two-col referrer-layout">
        <div>
          <div className="referrer-table-scroll">
            <table className="grid referrer-grid">
              <thead><tr><th>소속</th><th>이름</th><th>전화번호</th><th>이메일</th><th>직급</th><th className="text-center">관리</th></tr></thead>
              <tbody>
                {filteredReferrers.length === 0
                  ? <tr><td colSpan={6} style={{ textAlign: "center", color: "#8a97ac", padding: "24px" }}>등록된 추천인이 없습니다.</td></tr>
                  : filteredReferrers.map((row) => (
                    <tr key={row.id}>
                      <td>{row.org}</td><td>{row.name}</td><td>{formatPhoneNumber(row.phone)}</td><td>{row.email || "-"}</td><td>{row.title}</td>
                      <td className="text-center">
                        <div style={{ display: "flex", gap: "8px", justifyContent: "center" }}>
                          <button className="icon-btn" onClick={() => openReferrerDetail(row)} title="상세"><Eye size={14} /></button>
                          <button className="icon-btn text-red" onClick={() => deleteReferrer(row.id)} title="삭제"><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div>
        </div>
        <div>
          <div className="card-title-sm">추천인 등록</div>
          <div className="side-form">
            <label className="field"><span>소속<b className="req"> *</b></span>
              {!isNewOrg ? (
                <select className="input-input" value={referrerForm.org} onChange={(e) => {
                  if (e.target.value === "__new__") { setIsNewOrg(true); setReferrerForm(p => ({ ...p, org: "" })); }
                  else { setReferrerForm(p => ({ ...p, org: e.target.value })); }
                }}>
                  <option value="">소속 선택</option>
                  {uniqueOrgs.map(org => <option key={org} value={org}>{org}</option>)}
                  <option value="__new__">[직접 입력]</option>
                </select>
              ) : (
                <div style={{ display: "flex", gap: "4px" }}>
                  <input className="input-input" placeholder="신규 소속 입력" value={referrerForm.org} onChange={(e) => setReferrerForm(p => ({ ...p, org: e.target.value }))} />
                  <button className="line-btn" style={{ padding: "0 8px", minWidth: "auto" }} onClick={() => setIsNewOrg(false)}>취소</button>
                </div>
              )}
            </label>
            <label className="field"><span>이름<b className="req"> *</b></span><input className="input-input" placeholder="이름 입력" value={referrerForm.name} onChange={(e) => setReferrerForm((prev) => ({ ...prev, name: e.target.value }))} /></label>
            <label className="field"><span>전화번호<b className="req"> *</b></span><input className="input-input" placeholder="010-0000-0000" inputMode="numeric" value={referrerForm.phone} onChange={(e) => setReferrerForm((prev) => ({ ...prev, phone: formatPhoneNumber(e.target.value) }))} /></label>
            <label className="field"><span>이메일</span><input className="input-input" placeholder="example@email.com" value={referrerForm.email} onChange={(e) => setReferrerForm((prev) => ({ ...prev, email: e.target.value }))} /></label>
            <label className="field"><span>직급</span><input className="input-input" placeholder="직급 입력" value={referrerForm.title} onChange={(e) => setReferrerForm((prev) => ({ ...prev, title: e.target.value }))} /></label>
          </div>
          <div className="actions referrer-actions"><button className="line-btn" onClick={() => { setReferrerForm({ name: "", org: "", phone: "", title: "", email: "", remarks: "" }); setIsNewOrg(false); }}>취소</button><button className="primary-btn" onClick={saveReferrerForm}>저장</button></div>
        </div>
      </section>

      {editingReferrer && (
        <div className="modal-backdrop" onClick={() => setEditingReferrer(null)}>
          <section className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="card-title-sm">추천인 정보 수정</div>
            <div className="side-form">
              <label className="field"><span>소속<b className="req"> *</b></span>
                {!isModalNewOrg ? (
                  <select className="input-input" value={modalForm.org} onChange={(e) => {
                    if (e.target.value === "__new__") { setIsModalNewOrg(true); setModalForm(p => ({ ...p, org: "" })); }
                    else { setModalForm(p => ({ ...p, org: e.target.value })); }
                  }}>
                    {uniqueOrgs.map(org => <option key={org} value={org}>{org}</option>)}
                    <option value="__new__">[직접 입력]</option>
                  </select>
                ) : (
                  <div style={{ display: "flex", gap: "4px" }}>
                    <input className="input-input" value={modalForm.org} onChange={(e) => setModalForm(p => ({ ...p, org: e.target.value }))} />
                    <button className="line-btn" style={{ padding: "0 8px", minWidth: "auto" }} onClick={() => setIsModalNewOrg(false)}>취소</button>
                  </div>
                )}
              </label>
              <label className="field"><span>이름<b className="req"> *</b></span><input className="input-input" value={modalForm.name} onChange={(e) => setModalForm((prev) => ({ ...prev, name: e.target.value }))} /></label>
              <label className="field"><span>전화번호<b className="req"> *</b></span><input className="input-input" inputMode="numeric" value={modalForm.phone} onChange={(e) => setModalForm((prev) => ({ ...prev, phone: formatPhoneNumber(e.target.value) }))} /></label>
              <label className="field"><span>이메일</span><input className="input-input" value={modalForm.email} onChange={(e) => setModalForm((prev) => ({ ...prev, email: e.target.value }))} /></label>
              <label className="field"><span>직급</span><input className="input-input" value={modalForm.title} onChange={(e) => setModalForm((prev) => ({ ...prev, title: e.target.value }))} /></label>
              <label className="field"><span>등록일/수정일</span><input className="input-input" disabled value={`${modalForm.createdAt} / ${modalForm.updatedAt}`} /></label>
            </div>
            <div className="actions modal-actions">
              <button className="line-btn" onClick={() => setEditingReferrer(null)}>취소</button>
              <button className="primary-btn" onClick={saveReferrerDetail}>저장</button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}


function AllowancePage({ rows }: { rows: ContractRowData[] }) {
  const today = new Date().toISOString().slice(0, 10);
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [contractorFilter, setContractorFilter] = useState("전체");
  const [perPage, setPerPage] = useState(20);
  const [page, setPage] = useState(1);

  const parseLocalDate = (dateStr: string) => {
    const [y, m, d] = dateStr.split("-").map(Number);
    return new Date(y, m - 1, d);
  };

  const allowanceRows = (rows || []).map((r) => {
    const rawAccountNo = r.accountNo || "";
    const masked = rawAccountNo.length > 4
      ? rawAccountNo.slice(0, rawAccountNo.length - 4).replace(/\d/g, "*") + rawAccountNo.slice(-4)
      : rawAccountNo;
    return {
      ...r,
      baseDate: r.payoutDate || "",
      amount: Number(r.allowanceAmountRaw ?? 0),
      bankName: r.bankName || "",
      accountNo: rawAccountNo,
      accountMasked: masked || "",
      verifyStatus: "검증완료",
    };
  });

  const filteredRows = allowanceRows.filter((row) => {
    if (!row.baseDate || !startDate || !endDate) return true;
    
    // Parse filter days
    const filterStart = parseLocalDate(startDate);
    const filterEnd = parseLocalDate(endDate);
    const startDay = filterStart.getDate();
    const endDay = filterEnd.getDate();

    // Parse record day
    const recordDate = parseLocalDate(row.baseDate);
    const recordDay = recordDate.getDate();

    // The core "Aggregation" logic: 
    // Match by day of month, but show original record data
    const dayMatches = recordDay >= startDay && recordDay <= endDay;
    const isPastOrPresent = recordDate.getTime() <= filterEnd.getTime();
    const inDate = dayMatches && isPastOrPresent;

    const inContractor = !contractorFilter || contractorFilter === "전체" || row.name.includes(contractorFilter);
    return inDate && inContractor;
  }).sort((a, b) => b.baseDate.localeCompare(a.baseDate) || a.name.localeCompare(b.name, "ko"));
  const totalAmount = filteredRows.reduce((sum, row) => sum + row.amount, 0);
  const confirmedAmount = filteredRows.filter((row) => row.status.includes("지급확정") || row.status.includes("정상운영")).reduce((sum, row) => sum + row.amount, 0);
  const completedAmount = filteredRows.filter((row) => row.status.includes("정상운영")).reduce((sum, row) => sum + row.amount, 0);
  const holdAmount = filteredRows.filter((row) => row.status.includes("대기") || row.status.includes("변경")).reduce((sum, row) => sum + row.amount, 0);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / perPage));
  const safePage = Math.min(page, totalPages);
  const pagedRows = filteredRows.slice((safePage - 1) * perPage, safePage * perPage);

  const pageButtons = (): (number | "...")[] => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages: (number | "...")[] = [1];
    if (safePage > 4) pages.push("...");
    for (let i = Math.max(2, safePage - 2); i <= Math.min(totalPages - 1, safePage + 2); i++) pages.push(i);
    if (safePage < totalPages - 3) pages.push("...");
    pages.push(totalPages);
    return pages;
  };

  const amountText = (value: number) => `${Number(value).toLocaleString("ko-KR")} 원`;
  const paidAmount = (value: number) => Math.round(value * 0.967);

  const exportFilteredList = async () => {
    const padRight = (value: string, width: number) => value.padEnd(width, " ");
    const padLeft = (value: string, width: number) => value.padStart(width, " ");
    const amountOnly = (value: number) => `${value.toLocaleString("ko-KR")}원`;

    const nameWidth = 8;
    const bankWidth = 8;
    const accountWidth = 18;
    const amountWidth = 12;

    const body = filteredRows.map((r) =>
      [
        r.name,
        amountOnly(paidAmount(r.amount)),
        r.bankName,
        r.accountNo
      ].join(" ")
    );

    const content = body.join("\r\n");
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
    { label: "지급보류 건수", value: `${filteredRows.filter((r) => (r.status || "").includes("대기") || (r.status || "").includes("변경")).length} 건`, sub: "대기/변경 건수", icon: <Landmark size={22} />, tone: "orange" }
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
            <input className="input-input" type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setEndDate(e.target.value); setPage(1); }} />
          </label>
          <label className="field">
            <span>종료일</span>
            <input className="input-input" type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setPage(1); }} />
          </label>
          <div className="field">
            <span>계약자명</span>
            <div className="search-box" style={{ background: "#fff", position: "relative" }}>
              <Search size={16} />
              <input 
                className="input-input" 
                placeholder="계약자명 검색" 
                value={contractorFilter === "전체" ? "" : contractorFilter} 
                onChange={(e) => setContractorFilter(e.target.value)} 
                title=""
                autoComplete="off"
                style={{ paddingRight: "30px" }}
              />
              <button 
                className="icon-btn" 
                style={{ border: "none", padding: "4px", background: "transparent", color: "#8a97ac", cursor: "pointer", position: "absolute", right: "8px" }}
                onClick={() => setContractorFilter("전체")}
              >
                <X size={14} />
              </button>
            </div>
          </div>
          <div className="allowance-filter-actions">
            <button className="line-btn allowance-reset-btn" onClick={() => { setStartDate(today); setEndDate(today); setContractorFilter("전체"); setPage(1); }}>초기화</button>
            <button className="primary-btn allowance-export-btn" onClick={exportFilteredList}>출력</button>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="group-head">
          <div className="card-title-sm">전체 {filteredRows.length.toLocaleString("ko-KR")}건</div>
          <div className="card-title-sm" style={{ fontWeight: 600 }}>지급 총액: {filteredRows.reduce((sum, r) => sum + paidAmount(r.amount), 0).toLocaleString("ko-KR")} 원</div>
        </div>
        <table className="grid allowance-grid">
          <thead>
            <tr><th>지급기준일</th><th>계약자명</th><th>추천인</th><th>은행명</th><th>계좌번호</th><th>계약일자</th><th>계약종료일</th><th>보증금액</th><th className="text-center">수당</th><th className="text-center">지급금액</th></tr>
          </thead>
          <tbody>
            {pagedRows.map((r) => (
              <tr key={r.no}>
                <td>{r.baseDate || "-"}</td><td>{r.name || "-"}</td><td>{r.ref || "-"}</td><td>{r.bankName}</td><td>{r.accountMasked}</td><td>{r.contractDate || "-"}</td><td>{r.endDate || "-"}</td><td>{r.depositAmount || "-"}</td><td className="text-right">{amountText(r.amount)}</td><td className="text-right">{amountText(paidAmount(r.amount))}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="contract-pagination">
          <div className="pager">
            <button className="pager-btn" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage === 1}>‹</button>
            {pageButtons().map((p, i) =>
              p === "..." ? <span key={`el-${i}`} className="pager-ellipsis">…</span> : (
                <button key={p} className={`pager-btn${safePage === p ? " active" : ""}`} onClick={() => setPage(p as number)}>{p}</button>
              )
            )}
            <button className="pager-btn" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={safePage === totalPages}>›</button>
          </div>
          <div className="pager-right">
            {[20, 50, 100].map((n) => (
              <button key={n} className={`pager-btn${perPage === n ? " active" : ""}`} onClick={() => { setPerPage(n); setPage(1); }}>{n}개</button>
            ))}
          </div>
        </div>
      </section>


    </div>
  );
}

function AccountPage({ rows }: { rows: ContractRowData[] }) {
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
    const r = (rows || [])[i % (rows || []).length];
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
      ["LASM-20240520-001", "홍길동", "신한은행", "110-1234-123456", "홍길동"],
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


function ChangePage({ rows: contractRows, authUser }: { rows: ContractRowData[]; authUser: any }) {
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
    result: string;
  };

  const initialRows: ChangeRow[] = Array.from({ length: 10 }).map((_, i) => ({
    id: `chg-${i + 1}`,
    requestedAt: `2024-05-20 14:${String(30 + i).padStart(2, "0")}`,
    contractNo: `LASM-202405${String(20 - i).padStart(2, "0")}-${String(i + 1).padStart(3, "0")}`,
    contractor: (contractRows || [])[i]?.name ?? "-",
    workFlag: (contractRows || [])[i]?.name !== "박지민",
    contractType: "LAS점장점주",
    referrer: (contractRows || [])[i]?.ref ?? "-",
    contractDate: (contractRows || [])[i]?.contractDate ?? "-",
    payoutDate: (contractRows || [])[i]?.payoutDate ?? "-",
    endDate: (contractRows || [])[i]?.endDate ?? "-",
    depositAmount: "100,000,000 원",
    allowanceAmount: "1,500,000 원",
    contractState: (contractRows || [])[i]?.status ?? "-",
    accountVerify: (contractRows || [])[i]?.verify ?? "-",
    changeType: "계좌정보변경",
    beforeValue: "신한 110-123-****5678",
    afterValue: "신한 110-987-****4321",
    requester: authUser?.email || "시스템",
    reason: i % 4 === 0 ? "계좌번호 오타 수정 요청" : i % 4 === 1 ? "계약자명 정정" : i % 4 === 2 ? "추천인 변경 요청" : "기타",
    memo: i % 4 === 0 ? "계좌번호 오타 수정 요청드립니다. 기존 계좌는 해지되었습니다." : i % 4 === 1 ? "계약자명 정정 (박지민 -> 박지명)" : i % 4 === 2 ? "추천인 변경 요청 (김영희 -> 이철수). 담당자 확인 완료되었습니다." : "",
    phone: `010-12${String(30 + i).padStart(2, "0")}-56${String(70 + i).padStart(2, "0")}`,
    accountNo: `110-987-****${String(4321 + i).padStart(4, "0")}`,
    fieldChanges: [
      { field: "계약번호", before: `LASM-202405${String(20 - i).padStart(2, "0")}-${String(i + 1).padStart(3, "0")}`, after: `LASM-202405${String(20 - i).padStart(2, "0")}-${String(i + 1).padStart(3, "0")}` },
      { field: "계약자명", before: (contractRows || [])[i]?.name ?? "-", after: (contractRows || [])[i]?.name ?? "-" },
      { field: "추천인명", before: (contractRows || [])[i]?.ref ?? "-", after: (contractRows || [])[i]?.ref ?? "-" },
      { field: "계약종류", before: "LAS점장점주", after: "LAS점장점주" },
      { field: "계약일자", before: (contractRows || [])[i]?.contractDate ?? "-", after: (contractRows || [])[i]?.contractDate ?? "-" },
      { field: "수당지급일", before: (contractRows || [])[i]?.payoutDate ?? "-", after: (contractRows || [])[i]?.payoutDate ?? "-" },
      { field: "계약종료일", before: (contractRows || [])[i]?.endDate ?? "-", after: (contractRows || [])[i]?.endDate ?? "-" },
      { field: "연봉", before: "100,000,000 원", after: "100,000,000 원" },
      { field: "활동비", before: "1,500,000 원", after: "1,500,000 원" },
      { field: "근무여부", before: i % 2 === 0 ? "근무" : "미근무", after: i % 2 === 0 ? "근무" : "미근무" },
      { field: "주소", before: "서울시 강남구 테헤란로 100", after: "서울시 강남구 테헤란로 100" },
      { field: "연락처", before: `010-12${String(30 + i).padStart(2, "0")}-56${String(70 + i).padStart(2, "0")}`, after: `010-12${String(30 + i).padStart(2, "0")}-56${String(70 + i).padStart(2, "0")}` },
      { field: "주민번호", before: "900101-1234567", after: "900101-1234567" },
      { field: "은행명", before: "신한은행", after: "신한은행" },
      { field: "계좌번호", before: "110-123-456789", after: `110-987-${String(4321 + i).padStart(4, "0")}` },
      { field: "예금주명", before: (contractRows || [])[i]?.name ?? "-", after: (contractRows || [])[i]?.name ?? "-" }
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
          <thead><tr><th>계약번호</th><th>계약자명</th><th>요청사유</th><th>변경내용</th><th>계약종류</th><th>추천인</th><th>계약일자</th><th>수당지급일</th><th>보증금액</th><th>수당</th><th>계좌검증</th><th>상세</th></tr></thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.contractNo}</td>
                <td>{row.contractor}</td>
                <td>
                  <div className="reason-cell">
                    {row.memo || "사유 미입력"}
                    {row.status !== "승인대기" && (
                      <div style={{ marginTop: "4px" }}>
                        <span className={`badge ${statusClass(row.status)}`}>{row.status}</span>
                      </div>
                    )}
                  </div>
                </td>
                <td>
                  <div className="change-summary" title={row.fieldChanges.filter(f => f.before !== f.after).map(f => `${f.field}: ${f.before} -> ${f.after}`).join("\n")}>
                    {row.fieldChanges.filter(f => f.before !== f.after).length}건 변경
                  </div>
                </td>
                <td>{row.contractType}</td>
                <td>{row.referrer}</td>
                <td>{row.contractDate}</td>
                <td>{row.payoutDate}</td>
                <td>{row.depositAmount}</td>
                <td>{row.allowanceAmount}</td>
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
          <thead><tr><th>일시</th><th>계약번호</th><th>처리</th><th>변경 전</th><th>변경 후</th><th>결과</th></tr></thead>
          <tbody>
            {historyRows.length === 0 ? (
              <tr><td colSpan={7}>변경 이력이 없습니다.</td></tr>
            ) : (
              historyRows.map((h) => (
                <tr key={h.id}>
                  <td>{h.at}</td><td>{h.contractNo}</td><td>{h.action}</td><td>{h.beforeValue}</td><td>{h.afterValue}</td><td><span className={`badge ${h.result === "승인" ? "green" : "red"}`}>{h.result}</span></td>
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
                    <textarea
                      className="cell-input"
                      style={{ height: "80px", padding: "8px", resize: "vertical" }}
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

  // 계약서 관리
  const [contractTypes, setContractTypes] = useState<ContractTypeRow[]>([]);
  const [activeSystemTab, setActiveSystemTab] = useState<"LAS" | "APPOINTMENT">("LAS");
  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ContractTypeRow | null>(null);
  const [editName, setEditName] = useState("");
  const [editCategory, setEditCategory] = useState<"LAS" | "APPOINTMENT">("LAS");
  const [editYears, setEditYears] = useState(3);
  const [editMonths, setEditMonths] = useState(2);
  const [editRules, setEditRules] = useState<ContractTypeRule[]>([]);
  const [appointmentRules, setAppointmentRules] = useState<any[]>([]);
  const [ctSaving, setCtSaving] = useState(false);

  const APPOINTMENT_POSITIONS = ["예비과장", "과장", "차장", "부장", "이사"];

  useEffect(() => {
    fetch(`${API_BASE}/contract-types`).then((r) => r.json()).then((d) => {
      setContractTypes(Array.isArray(d.rows) ? d.rows : []);
    }).catch(() => {});
  }, []);

  const openNew = () => {
    setEditTarget(null);
    setEditName(""); setEditCategory(activeSystemTab); setEditYears(3); setEditMonths(2);
    setEditRules([{ id: Date.now(), deposit: 0, workAmount4: 0, workAmount2: 0, nonWorkAmount: 0 }]);
    setAppointmentRules(APPOINTMENT_POSITIONS.map(p => ({ position: p, basic: 0, bonus: 0, activity: 0, insurance: false })));
    setEditOpen(true);
  };

  const openEdit = (ct: ContractTypeRow) => {
    setEditTarget(ct);
    setEditName(ct.name); setEditYears(ct.contractYears); setEditMonths(ct.payoutMonths);
    const category = ct.name.includes("임용") ? "APPOINTMENT" : "LAS";
    setEditCategory(category);
    
    if (category === "APPOINTMENT") {
      setAppointmentRules(ct.rules?.map((r) => ({ ...r })) || APPOINTMENT_POSITIONS.map(p => ({ position: p, basic: 0, bonus: 0, activity: 0 })));
      setEditRules([]);
    } else {
      setEditRules(ct.rules?.map((r) => ({ ...r })) || []);
      setAppointmentRules(APPOINTMENT_POSITIONS.map(p => ({ position: p, basic: 0, bonus: 0, activity: 0 })));
    }
    setEditOpen(true);
  };

  const saveType = async () => {
    if (!editName.trim()) return;
    setCtSaving(true);
    const rules = editCategory === "APPOINTMENT" ? appointmentRules : editRules;
    const body = { name: editName.trim(), contractYears: editYears, payoutMonths: editMonths, rules };
    try {
      if (editTarget) {
        await fetch(`${API_BASE}/contract-types/${editTarget.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        setContractTypes((prev) => prev.map((x) => x.id === editTarget.id ? { ...x, ...body } : x));
      } else {
        const res = await fetch(`${API_BASE}/contract-types`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        const data = await res.json();
        setContractTypes((prev) => [...prev, { id: data.id, ...body }]);
      }
      setEditOpen(false);
    } finally { setCtSaving(false); }
  };

  const deleteType = async (id: number) => {
    if (!window.confirm("계약서를 삭제하시겠습니까?")) return;
    await fetch(`${API_BASE}/contract-types/${id}`, { method: "DELETE" });
    setContractTypes((prev) => prev.filter((x) => x.id !== id));
  };

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
                <td>{u.email}</td><td>{u.role}</td>
                <td><span className={`badge ${u.state === "활성" ? "green" : "red"}`}>{u.state}</span></td>
                <td><div className="system-user-btns">
                  <button className="line-btn" onClick={() => setUsers((prev) => prev.map((x) => x.id === u.id ? ({ ...x, state: x.state === "활성" ? "비활성" : "활성" }) : x))}>{u.state === "활성" ? "비활성" : "활성"} 전환</button>
                  <button className="line-btn" onClick={() => onResetPassword(u.id)}>비번초기화</button>
                </div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card">
        <div className="ct-manage-header" style={{ marginBottom: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
            <div className="card-title-sm" style={{ margin: 0 }}>계약서 관리</div>
            <select className="input-input" style={{ width: "180px" }} value={activeSystemTab} onChange={(e) => setActiveSystemTab(e.target.value as any)}>
              <option value="LAS">LAS점장점주</option>
              <option value="APPOINTMENT">임용계약서</option>
            </select>
          </div>
          <button className="primary-btn" onClick={openNew}><Plus size={15} /> {activeSystemTab === "LAS" ? "LAS 계약서 등록" : "임용 계약서 등록"}</button>
        </div>

        {activeSystemTab === "LAS" ? (
          <table className="grid ct-list-grid">
            <thead><tr><th>계약서명</th><th>계약기간</th><th>수당지급 기준</th><th>수당 조건 수</th><th>관리</th></tr></thead>
            <tbody>
              {contractTypes.filter(ct => !ct.name.includes("임용")).length === 0
                ? <tr><td colSpan={5}>등록된 LAS 계약서가 없습니다.</td></tr>
                : contractTypes.filter(ct => !ct.name.includes("임용")).map((ct) => (
                  <tr key={ct.id}>
                    <td>{ct.name}</td>
                    <td>{ct.contractYears}년</td>
                    <td>계약일 +{ct.payoutMonths}개월</td>
                    <td>{ct.rules.length}개 구간</td>
                    <td><div className="ct-icon-btns">
                      <button className="icon-btn" title="편집" onClick={() => openEdit(ct)}><Pencil size={15} /></button>
                      <button className="icon-btn" title="삭제" onClick={() => deleteType(ct.id)}><Trash2 size={15} /></button>
                    </div></td>
                  </tr>
                ))}
            </tbody>
          </table>
        ) : (
          <table className="grid ct-list-grid">
            <thead><tr><th>계약서명</th><th>계약기간</th><th>직급 체계</th><th>관리</th></tr></thead>
            <tbody>
              {contractTypes.filter(ct => ct.name.includes("임용")).length === 0
                ? <tr><td colSpan={4}>등록된 임용 계약서가 없습니다.</td></tr>
                : contractTypes.filter(ct => ct.name.includes("임용")).map((ct) => (
                  <tr key={ct.id}>
                    <td>{ct.name}</td>
                    <td>{ct.contractYears}년</td>
                    <td>예비과장/과장/차장/부장/이사</td>
                    <td><div className="ct-icon-btns">
                      <button className="icon-btn" title="편집" onClick={() => openEdit(ct)}><Pencil size={15} /></button>
                      <button className="icon-btn" title="삭제" onClick={() => deleteType(ct.id)}><Trash2 size={15} /></button>
                    </div></td>
                  </tr>
                ))}
            </tbody>
          </table>
        )}
      </section>

      {editOpen && (
        <div className="modal-backdrop" onClick={() => setEditOpen(false)}>
          <section className="modal-card ct-edit-modal" onClick={(e) => e.stopPropagation()}>
            <div className="card-title-sm">{editTarget ? "계약서 편집" : "계약서 신규 등록"}</div>
            <div className="contract-info-row three" style={{ marginBottom: 12 }}>
              <label className="field">
                <span>계약서 종류</span>
                <select className="input-input" value={editCategory} onChange={(e) => setEditCategory(e.target.value as any)}>
                  <option value="LAS">LAS점장점주</option>
                  <option value="APPOINTMENT">임용계약서</option>
                </select>
              </label>
              <label className="field"><span>계약서명</span><input className="input-input" value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="예: LAS점장점주" /></label>
              <label className="field"><span>계약기간(년)</span><input className="input-input" type="number" min={1} max={10} value={editYears} onChange={(e) => setEditYears(Number(e.target.value))} /></label>
            </div>

            {editCategory === "LAS" ? (
              <>
                <div className="ct-manage-header allowance-title">
                  <div className="card-title-sm" style={{ margin: 0 }}>보증금별 수당 조건</div>
                  <button className="primary-btn" onClick={() => setEditRules((prev) => [...prev, { id: Date.now(), deposit: 0, workAmount4: 0, workAmount2: 0, nonWorkAmount: 0 }])}><Plus size={14} /> 조건추가</button>
                </div>
                <table className="grid allowance-rule-grid">
                  <thead><tr><th>보증금(원)</th><th>근무수당(4일)(원)</th><th>근무수당(2일)(원)</th><th>미근무(원)</th><th></th></tr></thead>
                  <tbody>
                    {editRules.map((rule, idx) => (
                      <tr key={rule.id}>
                        <td><input className="input-input" value={rule.deposit.toLocaleString("ko-KR")} onChange={(e) => { const n = Number(e.target.value.replace(/[^\d]/g, "")); setEditRules((prev) => prev.map((x, i) => i === idx ? ({ ...x, deposit: n }) : x)); }} /></td>
                        <td><input className="input-input" value={(rule.workAmount4 ?? 0).toLocaleString("ko-KR")} onChange={(e) => { const n = Number(e.target.value.replace(/[^\d]/g, "")); setEditRules((prev) => prev.map((x, i) => i === idx ? ({ ...x, workAmount4: n }) : x)); }} /></td>
                        <td><input className="input-input" value={(rule.workAmount2 ?? 0).toLocaleString("ko-KR")} onChange={(e) => { const n = Number(e.target.value.replace(/[^\d]/g, "")); setEditRules((prev) => prev.map((x, i) => i === idx ? ({ ...x, workAmount2: n }) : x)); }} /></td>
                        <td><input className="input-input" value={rule.nonWorkAmount.toLocaleString("ko-KR")} onChange={(e) => { const n = Number(e.target.value.replace(/[^\d]/g, "")); setEditRules((prev) => prev.map((x, i) => i === idx ? ({ ...x, nonWorkAmount: n }) : x)); }} /></td>
                        <td><button className="icon-btn" onClick={() => setEditRules((prev) => prev.filter((_, i) => i !== idx))}><Trash2 size={15} /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            ) : (
              <>
                <div className="ct-manage-header allowance-title">
                  <div className="card-title-sm" style={{ margin: 0 }}>직급별 급여 조건 설정</div>
                </div>
                <table className="grid appointment-rule-grid">
                  <thead>
                    <tr>
                      <th style={{ textAlign: "center" }}>직급</th>
                      <th>연봉(원)</th>
                      <th>활동비(원)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {appointmentRules.map((rule, idx) => (
                      <tr key={rule.position}>
                        <td style={{ fontWeight: 700, backgroundColor: "#f9fafb", textAlign: "center" }}>{rule.position}</td>
                        <td><input className="input-input" value={rule.basic.toLocaleString("ko-KR")} onChange={(e) => { const n = Number(e.target.value.replace(/[^\d]/g, "")); setAppointmentRules((prev) => prev.map((x, i) => i === idx ? ({ ...x, basic: n }) : x)); }} /></td>
                        <td><input className="input-input" value={rule.activity.toLocaleString("ko-KR")} onChange={(e) => { const n = Number(e.target.value.replace(/[^\d]/g, "")); setAppointmentRules((prev) => prev.map((x, i) => i === idx ? ({ ...x, activity: n }) : x)); }} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}

            <div className="actions modal-actions">
              <button className="line-btn" onClick={() => setEditOpen(false)}>취소</button>
              <button className="primary-btn" onClick={saveType} disabled={ctSaving}>{ctSaving ? "저장중..." : "저장"}</button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function ContractDetail({ row, onBack, authUser, onUpdate }: { row: ContractRowData | null; onBack: () => void; authUser: any; onUpdate?: (r: ContractRowData) => void }) {
  const [tab, setTab] = useState<DetailTab>("basic");
  const [changeOpen, setChangeOpen] = useState(false);
  const [changeMemo, setChangeMemo] = useState("");
  const [changeHistoryRows, setChangeHistoryRows] = useState<Array<{ at: string; before: string; after: string; reason: string; changedFields: Array<{ field: string; before: string; after: string }> }>>([]);
  
  useEffect(() => {
    if (!row?.id) return;
    fetch(`/api/contracts/${row.id}/history`)
      .then(res => res.json())
      .then(data => {
        if (data.rows) setChangeHistoryRows(data.rows);
      })
      .catch(() => {});
  }, [row?.id]);

  const [historyDetailOpen, setHistoryDetailOpen] = useState(false);
  const [selectedHistory, setSelectedHistory] = useState<null | { at: string; before: string; after: string; reason: string; changedFields: Array<{ field: string; before: string; after: string }> }>(null);
  const buildChangeFields = (r: typeof row) => {
    const isAppt = r?.isAppointment ?? false;
    const fmtAmt = (v: string | undefined) => numFmt(v || "");
    return [
      { field: "계약번호", before: r?.no ?? "-", after: r?.no ?? "-", readOnlyAfter: true },
      { field: "계약자명", before: r?.name ?? "-", after: r?.name ?? "-" },
      { field: "추천인명", before: r?.ref || "-", after: r?.ref || "-" },
      { field: "계약종류", before: r?.type ?? "-", after: r?.type ?? "-", readOnlyAfter: true },
      { field: "계약일자", before: r?.contractDate ?? "", after: r?.contractDate ?? "" },
      { field: "수당지급일", before: r?.payoutDate ?? "", after: r?.payoutDate ?? "" },
      { field: "계약종료일", before: r?.endDate ?? "", after: r?.endDate ?? "" },
      { field: isAppt ? "연봉" : "보증금", before: fmtAmt(r?.depositAmount), after: fmtAmt(r?.depositAmount) },
      { field: isAppt ? "활동비" : "수당", before: fmtAmt(r?.allowanceAmount), after: fmtAmt(r?.allowanceAmount) },
      ...(isAppt ? [{ field: "소득구분", before: r?.insuranceType || "사업소득", after: r?.insuranceType || "사업소득" }] : []),
      { field: "근무여부", before: "근무", after: "근무" },
      { field: "연락처", before: r?.phone || "-", after: r?.phone || "-" },
      { field: "주민번호", before: r?.residentRegistrationNumber || "-", after: r?.residentRegistrationNumber || "-" },
      { field: "은행명", before: r?.bankName || "-", after: r?.bankName || "-" },
      { field: "계좌번호", before: r?.accountNo || "-", after: r?.accountNo || "-" },
      { field: "예금주명", before: r?.accountHolder || "-", after: r?.accountHolder || "-" }
    ];
  };

  const [changeFields, setChangeFields] = useState(() => buildChangeFields(row));

  useEffect(() => {
    setChangeFields(buildChangeFields(row));
  }, [row]);

  const saveChangeRequest = async () => {
    const changed = changeFields.filter((x) => x.before !== x.after);
    const beforeText = changed.length === 0 ? "변경 없음" : changed.map((x) => `${x.field}:${x.before}`).join(" / ");
    const afterText = changed.length === 0 ? "변경 없음" : changed.map((x) => `${x.field}:${x.after}`).join(" / ");
    const now = new Date();
    const at = `${formatDate(now)} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    
    if (row?.id) {
      try {
        // 1. Update History
        const histRes = await fetch(`/api/contracts/${row.id}/history`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            before: beforeText,
            after: afterText,
            reason: changeMemo || "-",
            changedFields: changed
          })
        });

        // 2. Update Actual Contract Data
        const updateBody: any = {};
        changed.forEach(f => {
          if (f.field === "계약자명") updateBody.name = f.after;
          if (f.field === "추천인명") updateBody.ref = f.after;
          if (f.field === "계약일자") updateBody.contractDate = f.after;
          if (f.field === "수당지급일") updateBody.payoutDate = f.after;
          if (f.field === "계약종료일") updateBody.endDate = f.after;
          if (f.field === "연봉" || f.field === "보증금") updateBody.depositAmountValue = Number(f.after.replace(/[^0-9]/g, ""));
          if (f.field === "활동비" || f.field === "수당") updateBody.allowanceAmountValue = Number(f.after.replace(/[^0-9]/g, ""));
          if (f.field === "소득구분") updateBody.insuranceType = f.after;
          if (f.field === "연락처") updateBody.phone = f.after;
          if (f.field === "주민번호") updateBody.residentRegistrationNumber = f.after;
          if (f.field === "은행명") updateBody.bankName = f.after;
          if (f.field === "계좌번호") updateBody.accountNo = f.after;
          if (f.field === "예금주명") updateBody.accountHolder = f.after;
        });

        const updateRes = await fetch(`/api/contracts/${row.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updateBody)
        });

        if (histRes.ok && updateRes.ok) {
          alert("변경사항이 저장되었습니다.");
          setChangeHistoryRows((prev) => [{ at, before: beforeText, after: afterText, reason: changeMemo || "-", requester: authUser?.email || "관리자", changedFields: changed }, ...prev]);
          
          // Update parent state immediately for UI sync
          if (onUpdate && row) {
            const updatedRow = { ...row };
            changed.forEach(f => {
              if (f.field === "계약자명") updatedRow.name = f.after;
              if (f.field === "추천인명") updatedRow.ref = f.after;
              if (f.field === "계약일자") updatedRow.contractDate = f.after;
              if (f.field === "수당지급일") updatedRow.payoutDate = f.after;
              if (f.field === "계약종료일") updatedRow.endDate = f.after;
              if (f.field === "연봉" || f.field === "보증금") updatedRow.depositAmount = f.after;
              if (f.field === "활동비" || f.field === "수당") updatedRow.allowanceAmount = f.after;
              if (f.field === "소득구분") updatedRow.insuranceType = f.after;
              if (f.field === "연락처") updatedRow.phone = f.after;
              if (f.field === "주민번호") updatedRow.residentRegistrationNumber = f.after;
              if (f.field === "은행명") updatedRow.bankName = f.after;
              if (f.field === "계좌번호") updatedRow.accountNo = f.after;
              if (f.field === "예금주명") updatedRow.accountHolder = f.after;
            });
            onUpdate(updatedRow);
          }
        }
      } catch (err) {
        console.error("Failed to save changes", err);
        alert("저장 중 오류가 발생했습니다.");
      }
    }
    
    setChangeOpen(false);
    setTab("history");
  };

  const tabs: { key: DetailTab; label: string }[] = [{ key: "basic", label: "기본정보" }, { key: "document", label: "계약서" }, { key: "allowance", label: "수당정보" }, { key: "account", label: "계좌정보" }, { key: "history", label: "변경이력" }, { key: "memo", label: "메모" }];
  const tabContent = tab === "basic" ? <DetailBasicTab row={row} /> : tab === "document" ? <DetailDocumentTab row={row} /> : tab === "allowance" ? <DetailAllowanceTab /> : tab === "account" ? <DetailAccountTab row={row} /> : tab === "history" ? <DetailHistoryTab rows={changeHistoryRows} onOpenDetail={(r) => { setSelectedHistory(r); setHistoryDetailOpen(true); }} /> : <DetailMemoTab row={row} onRefresh={() => {
    // Re-fetch logic if needed, but row is passed from parent.
    // For now, we assume parent state handles it or we could add a refetch here.
    onBack(); // Go back to list to refresh or we can add a specific fetchRow here.
  }} />;
  return <div><div className="head-with-btn"><PageHeader title="계약 상세" desc="계약 정보를 확인하고 관리하세요." /><div className="actions"><button className="line-btn" onClick={() => setChangeOpen(true)}>변경관리</button><button className="line-btn" onClick={onBack}>목록으로</button></div></div><section className="card summary-row"><div><div className="meta-label">계약번호</div><div className="meta-value">{row?.no ?? "-"}</div></div><div><div className="meta-label">계약자</div><div className="meta-value">{row?.name ?? "-"}</div></div><div><div className="meta-label">계약상태</div><div className="meta-value"><span className="badge green">{row?.status ?? "정상운영"}</span></div></div><div><div className="meta-label">계약일자</div><div className="meta-value">{row?.contractDate ?? "-"}</div></div><div><div className="meta-label">계약종료일</div><div className="meta-value">{row?.endDate ?? "-"}</div></div></section><div className="tabs">{tabs.map((t) => <button key={t.key} className={tab === t.key ? "tab active" : "tab"} onClick={() => setTab(t.key)}>{t.label}</button>)}</div>{tabContent}
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
                  ) : fc.field === "소득구분" ? (
                    <select className="cell-select" value={fc.after} onChange={(e) => setChangeFields((prev) => prev.map((x, i) => i === idx ? ({ ...x, after: e.target.value }) : x))}>
                      <option value="사업소득">사업소득</option>
                      <option value="4대보험">4대보험</option>
                    </select>
                  ) : ["연봉", "보증금", "활동비", "수당"].includes(fc.field) ? (
                    <input className="cell-input" value={fc.after} readOnly={Boolean(fc.readOnlyAfter)}
                      onChange={(e) => {
                        const formatted = numFmt(e.target.value);
                        setChangeFields((prev) => prev.map((x, i) => i === idx ? ({ ...x, after: formatted }) : x));
                      }} />
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
              <td colSpan={2}>
                <textarea 
                  className="cell-input" 
                  style={{ height: "80px", padding: "8px", resize: "vertical" }}
                  value={changeMemo} 
                  onChange={(e) => setChangeMemo(e.target.value)} 
                />
              </td>
            </tr>
          </tfoot>
        </table>
        <div className="actions modal-actions">
          <button className="line-btn" onClick={() => setChangeOpen(false)}>취소</button>
          <button className="primary-btn" onClick={() => void saveChangeRequest()}>저장</button>
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
  const [appointmentView, setAppointmentView] = useState<ContractView>("list");
  const [selectedContract, setSelectedContract] = useState<ContractRowData | null>(null);

  const [contracts, setContracts] = useState<ContractRowData[]>([]);
  const loadContracts = () => {
    fetch("/api/contracts")
      .then((res) => res.json())
      .then((data) => {
        if (data.rows) setContracts(data.rows);
      })
      .catch(() => {});
  };

  useEffect(() => {
    loadContracts();
  }, []);

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
    return (
      <div className="container">
        {(() => {
          if (menu === "contracts") {
            if (contractView === "list") return <ContractList rows={contracts.filter(c => !c.isAppointment && !(c.type || "").includes("임용"))} onCreate={() => setContractView("create")} onDetail={(r) => { setSelectedContract(r); setContractView("detail"); }} />;
            if (contractView === "create") return <ContractCreate onBack={() => { loadContracts(); setContractView("list"); }} />;
            if (contractView === "detail") return <ContractDetail row={selectedContract} onBack={() => { loadContracts(); setContractView("list"); }} authUser={authUser} onUpdate={(updated) => setSelectedContract(updated)} />;
          }
          if (menu === "appointment") {
            if (appointmentView === "list") return <AppointmentPage rows={contracts.filter(c => c.isAppointment || (c.type || "").includes("임용"))} onCreate={() => setAppointmentView("create")} onDetail={(r) => { setSelectedContract(r); setAppointmentView("detail"); }} onStatusChange={(id, status) => { fetch(`${API_BASE}/contracts/${id}/status`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) }).then(r => r.json()).then(d => { if (d.ok) setContracts(prev => prev.map(c => c.id === id ? { ...c, status } : c)); }); }} />;
            if (appointmentView === "create") return <AppointmentCreate onBack={() => { loadContracts(); setAppointmentView("list"); }} />;
            if (appointmentView === "detail") return <ContractDetail row={selectedContract} onBack={() => { loadContracts(); setAppointmentView("list"); }} authUser={authUser} onUpdate={(updated) => setSelectedContract(updated)} />;
          }
          if (menu === "referrers") return <ReferrerPage />;
          if (menu === "allowances") return <AllowancePage rows={contracts} />;
          if (menu === "salaries") return <SalaryPage rows={contracts.filter(c => c.isAppointment || (c.type || "").includes("임용"))} />;
          if (menu === "account") return <AccountPage rows={contracts} />;
          if (menu === "changes") return <ChangePage rows={contracts} authUser={authUser} onRefresh={loadContracts} />;
          if (menu === "system") return <SystemPage users={users} setUsers={setUsers} onAddUserWithTempPassword={addUserWithTempPassword} onResetPassword={resetPassword} authUser={authUser} />;
          return <DashboardPage rows={contracts} onDetail={(r) => { setSelectedContract(r); setContractView("detail"); setMenu("contracts"); }} />;
        })()}
      </div>
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menu, contractView, appointmentView, users, contracts, selectedContract, authUser]);

  if (!authUser) {
    return (
      <div className="login-shell">
        <section className="login-card">
          <h1>계약관리 로그인</h1>
          <label className="field"><span>이메일</span><input className="input-input" type="email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} placeholder="admin@contractmanager.com" /></label>
          <label className="field"><span>비밀번호</span><input className="input-input" type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} placeholder="비밀번호" onKeyDown={(e) => { if (e.key === "Enter") doLogin(); }} /></label>
          {loginError ? <div className="login-error">{loginError}</div> : null}
          <div className="modal-actions" style={{ marginTop: "10px" }}>
            <button className="line-btn" type="button" onClick={() => {
              setLoginEmail("");
              setLoginPassword("");
              setLoginError("");
            }}>초기화</button>
            <button className="primary-btn" onClick={doLogin}>로그인</button>
          </div>
        </section>
      </div>
    );
  }

  const renderNavItems = () => {
    return menus.map((m, idx) => {
      if (m.isHeader) {
        return (
          <div key={`header-${idx}`} className="sidebar-header">
            {m.icon}<span>{m.label}</span>
          </div>
        );
      }
      return (
        <button
          key={m.key + idx}
          className={`nav ${menu === m.key ? "active" : ""} ${m.indent ? "indent" : ""}`}
          onClick={() => {
            if (m.key !== "none") {
              setMenu(m.key);
              if (m.key !== "contracts") setContractView("list");
              if (m.key !== "appointment") setAppointmentView("list");
            }
          }}
        >
          {m.icon}<span>{m.label}</span>
        </button>
      );
    });
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-wrap">
          <img className="brand-logo" src="/logo.png" alt="LAS 로고" />
          <div className="brand">LAS계약관리</div>
        </div>
        {renderNavItems()}
      </aside>
      <div className="main-wrap">
        <header className="topbar"><Menu size={20} /><h2>{menus.find((m) => m.key === menu)?.label}</h2><div className="spacer" /><Bell size={18} /><div className="user"><UserRound size={16} /> {authUser.email} ({authUser.role})</div></header>
        <main className="main">{content}</main>
        <footer className="footer">© 2024 계약관리 시스템. All rights reserved.</footer>
      </div>
    </div>
  );
}

