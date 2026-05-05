# -*- coding: utf-8 -*-
"""
임용계약 일괄 Import 스크립트 (클리어 후 재적재)
대상: 26년 계약서 접수 정리(과장 계약서).xlsx > 보고서 시트
- 연봉/활동비: 임용계약서(2026.01) 템플릿 직급별 금액 적용
- 소득구분: 사업소득 고정

실행 방법:
  py data/import_appointments.py
"""

import sys
import json
import requests
import openpyxl
from datetime import datetime

sys.stdout.reconfigure(encoding="utf-8")

API_BASE        = "https://api-wj5zu6alya-du.a.run.app"
EXCEL_PATH      = "c:/ProjectCode/contractmanager/data/26년 계약서 접수 정리(과장 계약서).xlsx"
SHEET_NAME      = "보고서"
TARGET_TYPE     = "임용계약서(2026.01)"

# ─────────────────────────────────────────────
# 1단계: 계약 유형 → 직급별 연봉/활동비 매핑
# ─────────────────────────────────────────────
print("[ 1단계 ] 계약 유형 조회 중...")
try:
    resp = requests.get(f"{API_BASE}/contract-types", timeout=15)
    resp.raise_for_status()
    contract_types = resp.json().get("rows", [])
except Exception as e:
    print(f"  ❌ API 연결 실패: {e}"); sys.exit(1)

target_type = next((t for t in contract_types if t["name"] == TARGET_TYPE), None)
if not target_type:
    print(f"  ❌ '{TARGET_TYPE}' 유형 없음. 사용 가능: {[t['name'] for t in contract_types]}")
    sys.exit(1)

rules = target_type.get("rules", [])
pos_salary   = {r["position"]: int(r.get("basic",    0)) for r in rules if r.get("position")}
pos_activity = {r["position"]: int(r.get("activity", 0)) for r in rules if r.get("position")}
print(f"  ✅ 직급별 연봉:   {json.dumps(pos_salary,   ensure_ascii=False)}")
print(f"  ✅ 직급별 활동비: {json.dumps(pos_activity, ensure_ascii=False)}")

# ─────────────────────────────────────────────
# 2단계: 임용계약 전체 삭제
# ─────────────────────────────────────────────
print("\n[ 2단계 ] 기존 임용계약 전체 삭제 중...")
try:
    resp = requests.delete(f"{API_BASE}/contracts/appointments/clear", timeout=15)
    resp.raise_for_status()
    deleted = resp.json().get("deleted", 0)
    print(f"  ✅ {deleted}건 삭제 완료")
except Exception as e:
    print(f"  ❌ 삭제 실패: {e}"); sys.exit(1)

# ─────────────────────────────────────────────
# 3단계: Excel 읽기
# ─────────────────────────────────────────────
print(f"\n[ 3단계 ] Excel 읽기: '{SHEET_NAME}' 시트")
try:
    wb = openpyxl.load_workbook(EXCEL_PATH, read_only=True, data_only=True)
    ws = wb[SHEET_NAME]
    all_rows = list(ws.iter_rows(values_only=True))
    wb.close()
except Exception as e:
    print(f"  ❌ Excel 읽기 실패: {e}"); sys.exit(1)

data_rows = [r for r in all_rows[2:] if r[2] is not None]
print(f"  ✅ 데이터 {len(data_rows)}건 확인")

# ─────────────────────────────────────────────
# 4단계: 일괄 등록
# ─────────────────────────────────────────────
print(f"\n[ 4단계 ] 일괄 등록 시작")

def fmt_date(d):
    if isinstance(d, datetime):
        return d.strftime("%Y-%m-%d")
    if d is not None:
        s = str(d).strip()
        if len(s) == 10 and s[4] == "-":
            return s
        return None
    return None

success, errors = 0, []

for i, row in enumerate(data_rows, start=1):
    추천지점  = row[0]
    직급      = row[1]
    계약자명  = row[2]
    업무개시일 = row[3]
    급여일    = row[4]
    신고개시일 = row[5]
    계약종료일 = row[6]
    계약일    = row[7]
    주민번호  = row[8]
    전화번호  = row[9]
    은행명    = row[10]
    계좌번호  = row[11]
    예금주    = row[12]
    계약서번호 = row[13]

    salary   = pos_salary.get(직급,   0)
    activity = pos_activity.get(직급, 0)
    if salary == 0:
        print(f"  ⚠️  [{i:02d}] {계약자명}: 직급 '{직급}' 연봉 미정의 → 0원")

    # 날짜 유효성 검증
    c_date = fmt_date(계약일)
    if not c_date:
        errors.append(f"{계약자명} (#{i}): 계약일 오류 → 원본값: {계약일!r}")
        print(f"  ❌ [{i:02d}] {계약자명}: 계약일 오류 ({계약일!r}) → 건너뜀")
        continue

    body = {
        "contractNo":                   str(계약서번호) if 계약서번호 else None,
        "type":                         TARGET_TYPE,
        "name":                         계약자명,
        "ref":                          str(추천지점) if 추천지점 else "",
        "contractDate":                 c_date,
        "payoutDate":                   fmt_date(급여일),
        "endDate":                      fmt_date(계약종료일),
        "depositAmountValue":           salary,
        "allowanceAmountValue":         activity,
        "bankName":                     str(은행명) if 은행명 else "",
        "accountNo":                    str(계좌번호) if 계좌번호 else "",
        "accountHolder":                str(예금주) if 예금주 else "",
        "residentRegistrationNumber":   str(주민번호) if 주민번호 else "",
        "phone":                        str(전화번호) if 전화번호 else "",
        "isAppointment":                True,
        "insuranceType":                "사업소득",
        "workStartDate":                fmt_date(업무개시일),
        "reportStartDate":              fmt_date(신고개시일),
        "position":                     str(직급) if 직급 else "",
    }

    try:
        resp = requests.post(f"{API_BASE}/contracts", json=body, timeout=15)
        data = resp.json()
        if resp.status_code == 200 and data.get("ok"):
            print(f"  ✅ [{i:02d}] {계약자명} ({직급}) 연봉 {salary:,}원 / 활동비 {activity:,}원 → {data.get('contractNo','')}")
            success += 1
        else:
            msg = data.get("message", resp.text)
            print(f"  ❌ [{i:02d}] {계약자명}: {msg}")
            errors.append(f"{계약자명}: {msg}")
    except Exception as e:
        print(f"  ❌ [{i:02d}] {계약자명}: 요청 실패 - {e}")
        errors.append(f"{계약자명}: {e}")

# ─────────────────────────────────────────────
# 결과 요약
# ─────────────────────────────────────────────
print(f"""
═══════════════════════════════════════
  Import 완료
  ✅ 성공: {success}건
  ❌ 실패: {len(errors)}건
═══════════════════════════════════════""")
if errors:
    print("  실패 목록:")
    for e in errors:
        print(f"    - {e}")
