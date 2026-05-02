# 계약관리 시스템 Implementation Plan

문서버전: v1.0  
작성일: 2026-05-02  
대상 시스템: 계약관리 시스템  
기술스택: Vite / Tailwind CSS / TypeScript / Firebase Auth / Firebase Hosting / Firebase Storage / Cloud SQL PostgreSQL

---

## 1. 시스템 개요

본 시스템은 계약서를 단순히 PDF 파일로 보관하는 수준을 넘어, 계약 등록, 추천인 관리, 계약서 및 입금표 PDF 보관, 계좌실명조회, 수당 자동계산, 지급목록 출력, 계약변경 이력관리, 감사로그까지 통합 관리하는 계약운영 시스템을 목표로 한다.

주요 목적은 다음과 같다.

1. 계약서를 시스템으로 등록하고 체계적으로 보관한다.
2. 추천인과 계약자를 연결하여 추천인별 계약현황과 수당현황을 관리한다.
3. 계약종류를 추가할 수 있는 구조로 설계하여 향후 다양한 계약유형을 수용한다.
4. 계약서 템플릿 PDF와 실제 계약서 PDF, 입금표 PDF를 계약번호 기준으로 관리한다.
5. 계약일자 기준으로 계약종료일을 자동 산정한다.
6. 계약상태, 근무여부, 보증금액 등을 기준으로 수당을 자동계산한다.
7. 일별, 주별, 월별 수당지급 목록을 출력한다.
8. 계좌정보 변경, 양도/양수, 증액, 계약해지 등 계약변경 이력을 남긴다.
9. 주민번호, 계좌번호 등 개인정보는 암호화 및 마스킹을 전제로 관리한다.
10. 계약변경, 지급목록 출력, 파일 다운로드 등 주요 행위는 감사로그에 저장한다.

---

## 2. 구현 범위

### 2.1 1차 MVP 범위

1차 MVP는 실제 업무에서 바로 사용할 수 있는 최소 기능을 구현한다.

- Firebase Auth 로그인
- 사용자 권한 구분
- 추천인 등록, 조회, 수정
- 계약종류 등록, 조회, 수정
- 계약 등록, 조회, 상세보기
- 계약번호 자동생성
- 계약종료일 자동계산
- 보증금액, 근무여부, 계약상태 기준 수당 자동계산
- 계약서 PDF 업로드
- 입금표 PDF 업로드
- 계약 상세 화면
- 계약변경 이력 수동 등록
- 월별 수당지급 목록
- 합계금액 표시
- 엑셀 다운로드
- 기본 감사로그 저장

### 2.2 2차 운영기능 범위

- 실제 계좌실명조회 API 연계
- 지급예정, 지급확정, 지급완료 프로세스
- 계약변경 승인/반려 프로세스
- 계좌정보 변경 처리
- 양도/양수 처리
- 증액 처리
- 계약해지 처리
- 개인정보 마스킹 강화
- 권한별 화면 제어
- 파일 다운로드 이력 저장
- 지급목록 출력 이력 저장

### 2.3 3차 고도화 범위

- 계약서 자동생성
- 전자서명 연계
- 대량 계약 업로드
- 대량 지급파일 생성
- 추천인별 성과 대시보드
- 계약만료 예정 알림
- 계약 이상징후 탐지
- 회계시스템 연계
- 대량이체 파일 생성 또는 지급대행 API 연계

---

## 3. 추가 기능 제안

### 3.1 계약번호 자동생성

계약자는 동명이인이 있을 수 있고 계약종류도 여러 개가 될 수 있으므로 계약번호는 반드시 자동생성해야 한다.

권장 형식:

```text
계약종류코드-연도-일련번호
```

예시:

```text
STORE-2026-000001
SALES-2026-000001
MEMBER-2026-000001
```

계약번호는 계약서, 입금표, 계약변경, 수당지급, 감사로그를 연결하는 기준값으로 사용한다.

---

### 3.2 계약상태 관리

계약은 등록 후 여러 상태로 변경된다. 계약상태를 별도로 관리해야 지급대상 산정, 계약해지, 만료관리 등이 가능하다.

권장 상태값:

| 상태 | 설명 |
|---|---|
| 작성중 | 계약정보 입력 중 |
| 계약완료 | 계약서 등록 완료 |
| 보증금입금대기 | 입금표 미등록 또는 입금 미확인 |
| 정상운영 | 계약 및 입금 확인 완료 |
| 변경진행중 | 계약변경 요청 진행 중 |
| 해지요청 | 계약해지 요청 등록 |
| 해지완료 | 계약해지 완료 |
| 만료예정 | 계약종료일 임박 |
| 만료 | 계약기간 종료 |

---

### 3.3 권한관리

본 시스템에는 주민번호, 계좌번호, 연락처 등 민감정보가 포함되므로 권한관리가 필요하다.

권장 권한:

| 권한 | 주요 기능 |
|---|---|
| 시스템관리자 | 사용자, 권한, 계약종류, 템플릿, 수당규칙 관리 |
| 계약관리자 | 계약 등록, 수정, 변경요청 검토, 계약해지 처리 |
| 회계담당자 | 수당지급 목록 조회, 지급확정, 지급완료 처리 |
| 추천인 | 본인 관련 계약자 및 수당현황 조회 |
| 조회전용 | 계약정보 조회만 가능 |

권한별 개인정보 노출 수준도 다르게 처리한다.

예시:

| 권한 | 주민번호 | 계좌번호 |
|---|---|---|
| 시스템관리자 | 전체 또는 권한 승인 후 표시 | 전체 또는 권한 승인 후 표시 |
| 계약관리자 | 마스킹 표시 | 마스킹 표시 |
| 회계담당자 | 마스킹 또는 지급 시 전체 표시 | 지급 시 전체 표시 |
| 추천인 | 미표시 | 미표시 |
| 조회전용 | 미표시 | 미표시 |

---

### 3.4 계약종류별 설정 관리

계약종류를 추가 가능한 구조로 만들려면 계약종류별 기본 설정을 별도 테이블로 관리해야 한다.

관리항목:

- 계약종류 코드
- 계약종류명
- 기본 계약기간
- 계약종료일 자동계산 기준
- 보증금 사용 여부
- 근무여부 사용 여부
- 수당계산 규칙
- 필수 첨부파일
- 계약서 템플릿 PDF
- 활성/비활성 여부

예시:

| 계약종류 | 기본기간 | 보증금 | 수당계산 | 필수파일 |
|---|---:|---|---|---|
| 점주계약 | 12개월 | 사용 | 보증금/근무여부 기준 | 계약서, 입금표 |
| 영업위탁계약 | 6개월 | 미사용 | 근무여부 기준 | 계약서 |
| 관리회원계약 | 12개월 | 사용 | 월정액 기준 | 계약서, 신청서 |

---

### 3.5 수당 자동계산 규칙 관리

수당계산은 하드코딩하지 않고 규칙화해야 한다.

초기 MVP에서는 단순 규칙으로 구현한다.

기본 규칙 예시:

```text
계약상태가 정상운영이고
근무여부가 Y이면
계약종류별 기본수당 또는 입력수당을 지급대상으로 산정한다.

계약상태가 해지완료, 만료, 작성중이면 지급대상에서 제외한다.
계좌실명조회 상태가 불일치 또는 조회실패이면 지급보류로 표시한다.
```

고도화 시 조건식 기반으로 확장한다.

예시:

| 조건 | 수당 |
|---|---:|
| 보증금 100만원 이상 + 근무중 | 100,000 |
| 보증금 200만원 이상 + 근무중 | 200,000 |
| 근무여부 N | 0 |
| 계약해지 | 지급제외 |

---

### 3.6 지급관리 기능

수당지급 목록은 조회만으로 끝나면 안 되고 확정 기능이 필요하다.

지급상태:

| 상태 | 설명 |
|---|---|
| 지급예정 | 자동 산정된 지급대상 |
| 검토중 | 담당자 확인 중 |
| 지급확정 | 지급목록 확정 |
| 지급완료 | 실제 지급 완료 |
| 지급보류 | 계좌오류 또는 계약문제로 보류 |
| 지급취소 | 지급대상에서 제외 |

지급 프로세스:

```text
수당 자동계산
→ 지급예정 목록 생성
→ 담당자 검토
→ 지급확정
→ 지급완료
→ 지급이력 보관
```

중요 원칙:

- 지급확정 후에는 계약정보가 변경되어도 과거 지급내역이 바뀌면 안 된다.
- 지급확정 시점의 계약자명, 은행명, 계좌번호, 금액을 스냅샷으로 저장한다.

---

### 3.7 계좌실명조회 기능

계좌실명조회 버튼은 향후 금융 API 또는 지급대행 API와 연계한다.

처리 흐름:

```text
은행명, 계좌번호, 예금주명 입력
→ 계좌실명조회 버튼 클릭
→ API 요청
→ 결과 수신
→ 일치/불일치/조회실패 상태 저장
→ 조회일시, 조회자, 응답메시지 저장
```

결과 상태:

| 상태 | 설명 |
|---|---|
| 미조회 | 아직 조회하지 않음 |
| 일치 | 예금주명이 일치함 |
| 불일치 | 예금주명이 일치하지 않음 |
| 조회실패 | API 오류 또는 은행응답 실패 |
| 재확인필요 | 담당자 재확인 필요 |

MVP에서는 실제 API 없이 수동검증 상태를 저장할 수 있도록 만든다. 단, API 함수 인터페이스는 미리 준비한다.

---

### 3.8 계약변경 승인 프로세스

계약정보는 직접 덮어쓰지 않고 변경요청 방식으로 관리한다.

변경유형:

| 변경유형 | 설명 |
|---|---|
| 계좌정보변경 | 은행명, 계좌번호, 예금주 변경 |
| 양도/양수 | 기존 계약자에서 신규 계약자로 계약 이전 |
| 증액 | 보증금 또는 계약금 증액 |
| 계약해지 | 해지일, 해지사유, 환불여부 기록 |
| 연락처변경 | 계약자 연락처 변경 |
| 추천인변경 | 추천인 오류 수정 또는 변경 |

처리 흐름:

```text
변경요청 등록
→ 변경 전/후 값 저장
→ 증빙자료 첨부
→ 관리자 검토
→ 승인 또는 반려
→ 승인 시 계약정보 반영
→ 계약변경 히스토리 자동 기록
```

---

### 3.9 파일관리 기능

Firebase Storage에 파일을 저장하고 Cloud SQL에는 파일 메타데이터를 저장한다.

관리 파일 종류:

- 계약서 PDF
- 계약서 템플릿 PDF
- 입금표 PDF
- 계좌변경 신청서
- 양도/양수 확인서
- 증액 관련 증빙
- 계약해지 신청서
- 신분증 사본
- 기타 증빙자료

Storage 저장경로 예시:

```text
/templates/{contractTypeId}/template.pdf
/contracts/{contractId}/contract.pdf
/contracts/{contractId}/receipts/{receiptId}.pdf
/contracts/{contractId}/changes/{changeRequestId}/evidence.pdf
/contracts/{contractId}/etc/{fileId}.pdf
```

파일 다운로드, 삭제, 교체는 감사로그에 저장한다.

---

### 3.10 개인정보 보호 및 감사로그

필수 보안 기능:

- 주민번호 암호화 저장
- 계좌번호 암호화 저장
- 화면 기본 마스킹
- 권한자만 전체정보 조회
- 엑셀 다운로드 권한 제한
- 파일 다운로드 이력 저장
- 계약변경 이력 저장
- 로그인 이력 저장
- 계좌실명조회 이력 저장
- 지급목록 출력 이력 저장

마스킹 예시:

```text
주민번호: 801010-1******
전화번호: 010-****-1234
계좌번호: 123-****-7890
```

---

## 4. 추천 메뉴 구조

```text
대시보드
 ├─ 전체 계약 건수
 ├─ 정상계약 건수
 ├─ 만료예정 계약
 ├─ 해지계약
 ├─ 이번 주 지급예정 금액
 ├─ 계좌검증 오류 건수
 └─ 최근 계약변경 요청

추천인 관리
 ├─ 추천인 목록
 ├─ 추천인 등록
 ├─ 추천인별 계약자
 └─ 추천인별 수당현황

계약 관리
 ├─ 계약 목록
 ├─ 계약 등록
 ├─ 계약 상세
 ├─ 계약서 등록
 ├─ 입금표 등록
 ├─ 계약변경 요청
 └─ 계약변경 히스토리

수당 관리
 ├─ 일별 지급목록
 ├─ 주별 지급목록
 ├─ 월별 지급목록
 ├─ 지급확정
 ├─ 지급완료
 └─ 엑셀/PDF 출력

계좌 검증
 ├─ 미검증 계좌
 ├─ 검증성공 계좌
 ├─ 검증오류 계좌
 └─ 재검증 대상

시스템 관리
 ├─ 사용자 관리
 ├─ 권한 관리
 ├─ 계약종류 관리
 ├─ 계약서 템플릿 관리
 ├─ 수당계산 규칙 관리
 ├─ 공통코드 관리
 └─ 감사로그
```

---

## 5. 주요 화면 설계

### 5.1 로그인 화면

입력항목:

- 이메일
- 비밀번호

기능:

- 로그인
- 비밀번호 재설정
- 로그인 실패 메시지 표시
- Firebase Auth 인증 처리

---

### 5.2 대시보드 화면

표시항목:

- 전체 계약 건수
- 정상운영 계약 건수
- 보증금입금대기 계약 건수
- 만료예정 계약 건수
- 해지완료 계약 건수
- 이번 달 지급예정 금액
- 계좌검증 오류 건수
- 최근 계약변경 요청 목록
- 최근 등록 계약 목록

---

### 5.3 추천인 등록 화면

입력항목:

- 이름
- 소속
- 전화번호
- 직급
- 상태
- 메모

목록 표시항목:

- 추천인명
- 소속
- 직급
- 전화번호
- 등록계약 수
- 지급수당 합계
- 상태
- 등록일

---

### 5.4 계약종류 관리 화면

입력항목:

- 계약종류 코드
- 계약종류명
- 기본 계약기간
- 보증금 사용 여부
- 근무여부 사용 여부
- 수당계산 규칙
- 계약서 템플릿 PDF
- 필수 첨부파일
- 활성/비활성 여부

---

### 5.5 계약 등록 화면

입력항목:

- 계약종류
- 추천인
- 계약자명
- 계약일자
- 계약종료일
- 보증금액
- 근무여부
- 수당
- 주민번호
- 연락처
- 은행명
- 계좌번호
- 예금주명
- 계좌실명조회 버튼
- 계약서 PDF 등록
- 입금표 PDF 등록
- 메모

자동처리:

- 계약번호 자동생성
- 계약종료일 자동계산
- 수당 자동계산
- 계좌검증 상태 저장
- 계약상태 자동부여

---

### 5.6 계약 목록 화면

필터:

- 계약종류
- 계약상태
- 추천인
- 계약자명
- 계약일자 기간
- 계약종료일 기간
- 근무여부
- 계좌검증 상태

목록 표시항목:

- 계약번호
- 계약종류
- 계약자명
- 추천인
- 계약일자
- 계약종료일
- 보증금액
- 수당
- 계약상태
- 계좌검증 상태

---

### 5.7 계약 상세 화면

탭 구조:

```text
기본정보
첨부파일
수당정보
계좌정보
변경이력
메모/활동로그
```

기본정보:

- 계약번호
- 계약종류
- 계약자명
- 추천인
- 계약일자
- 계약종료일
- 보증금액
- 근무여부
- 계약상태
- 메모

첨부파일:

- 계약서 PDF
- 입금표 PDF
- 변경증빙 파일
- 기타 파일

수당정보:

- 기본 수당
- 계산 수당
- 지급예정 내역
- 지급확정 내역
- 지급완료 내역

계좌정보:

- 은행명
- 계좌번호
- 예금주명
- 계좌검증 상태
- 최근 검증일시

변경이력:

- 변경일시
- 변경유형
- 변경 전 값
- 변경 후 값
- 요청자
- 승인자
- 상태
- 첨부파일

---

### 5.8 수당 지급목록 화면

필터:

- 지급기준일
- 일별/주별/월별
- 추천인
- 계약종류
- 계약상태
- 근무여부
- 계좌검증 상태

목록 표시항목:

- 계약자명
- 추천인
- 은행명
- 계좌번호
- 예금주명
- 지급금액
- 계좌검증상태
- 계약상태
- 지급상태

하단 표시:

- 총 지급건수
- 합계금액
- 엑셀 다운로드
- PDF 출력
- 지급확정 버튼
- 지급완료 처리 버튼

---

### 5.9 계약변경 요청 화면

입력항목:

- 계약번호
- 계약자명
- 변경유형
- 변경사유
- 변경 전 정보
- 변경 후 정보
- 증빙자료
- 메모

기능:

- 변경요청 등록
- 승인
- 반려
- 승인 시 계약정보 반영
- 변경이력 자동 저장

---

## 6. 데이터베이스 설계 초안

### 6.1 users

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY,
    firebase_uid VARCHAR(128) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    role VARCHAR(50) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

---

### 6.2 referrers

```sql
CREATE TABLE referrers (
    id UUID PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    organization VARCHAR(100),
    phone VARCHAR(50),
    position VARCHAR(100),
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    memo TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

---

### 6.3 contract_types

```sql
CREATE TABLE contract_types (
    id UUID PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    default_period_months INTEGER NOT NULL DEFAULT 12,
    deposit_required BOOLEAN NOT NULL DEFAULT FALSE,
    working_status_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    allowance_rule_id UUID,
    template_file_path TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

---

### 6.4 contracts

```sql
CREATE TABLE contracts (
    id UUID PRIMARY KEY,
    contract_no VARCHAR(50) UNIQUE NOT NULL,
    contract_type_id UUID NOT NULL REFERENCES contract_types(id),
    referrer_id UUID REFERENCES referrers(id),
    contractor_name VARCHAR(100) NOT NULL,
    contract_date DATE NOT NULL,
    contract_end_date DATE NOT NULL,
    deposit_amount NUMERIC(15, 2) DEFAULT 0,
    working_status VARCHAR(30) DEFAULT 'WORKING',
    allowance_amount NUMERIC(15, 2) DEFAULT 0,
    resident_no_encrypted TEXT,
    phone VARCHAR(50),
    bank_name VARCHAR(100),
    account_no_encrypted TEXT,
    account_no_last4 VARCHAR(10),
    account_holder VARCHAR(100),
    account_verification_status VARCHAR(30) DEFAULT 'NOT_CHECKED',
    contract_status VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
    memo TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

---

### 6.5 contract_files

```sql
CREATE TABLE contract_files (
    id UUID PRIMARY KEY,
    contract_id UUID REFERENCES contracts(id),
    file_type VARCHAR(50) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    storage_path TEXT NOT NULL,
    uploaded_by UUID REFERENCES users(id),
    uploaded_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

file_type 예시:

```text
CONTRACT_PDF
RECEIPT_PDF
CHANGE_EVIDENCE
TERMINATION_DOC
ETC
```

---

### 6.6 contract_change_requests

```sql
CREATE TABLE contract_change_requests (
    id UUID PRIMARY KEY,
    contract_id UUID NOT NULL REFERENCES contracts(id),
    change_type VARCHAR(50) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'REQUESTED',
    requested_by UUID REFERENCES users(id),
    approved_by UUID REFERENCES users(id),
    requested_at TIMESTAMP NOT NULL DEFAULT NOW(),
    approved_at TIMESTAMP,
    reason TEXT,
    memo TEXT
);
```

change_type 예시:

```text
ACCOUNT_CHANGE
TRANSFER
INCREASE
TERMINATION
PHONE_CHANGE
REFERRER_CHANGE
```

---

### 6.7 contract_change_details

```sql
CREATE TABLE contract_change_details (
    id UUID PRIMARY KEY,
    change_request_id UUID NOT NULL REFERENCES contract_change_requests(id),
    field_name VARCHAR(100) NOT NULL,
    old_value TEXT,
    new_value TEXT
);
```

---

### 6.8 allowance_payments

```sql
CREATE TABLE allowance_payments (
    id UUID PRIMARY KEY,
    contract_id UUID NOT NULL REFERENCES contracts(id),
    payment_period_type VARCHAR(20) NOT NULL,
    payment_base_date DATE NOT NULL,
    payment_amount NUMERIC(15, 2) NOT NULL,
    payment_status VARCHAR(30) NOT NULL DEFAULT 'SCHEDULED',
    snapshot_contractor_name VARCHAR(100),
    snapshot_bank_name VARCHAR(100),
    snapshot_account_no_encrypted TEXT,
    snapshot_account_holder VARCHAR(100),
    confirmed_by UUID REFERENCES users(id),
    paid_by UUID REFERENCES users(id),
    confirmed_at TIMESTAMP,
    paid_at TIMESTAMP,
    memo TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

---

### 6.9 account_verification_logs

```sql
CREATE TABLE account_verification_logs (
    id UUID PRIMARY KEY,
    contract_id UUID NOT NULL REFERENCES contracts(id),
    bank_name VARCHAR(100) NOT NULL,
    account_no_masked VARCHAR(100) NOT NULL,
    account_holder VARCHAR(100) NOT NULL,
    result_status VARCHAR(30) NOT NULL,
    response_message TEXT,
    requested_by UUID REFERENCES users(id),
    requested_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

---

### 6.10 audit_logs

```sql
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    action_type VARCHAR(100) NOT NULL,
    target_type VARCHAR(100) NOT NULL,
    target_id UUID,
    description TEXT,
    ip_address VARCHAR(100),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

---

## 7. API 설계 초안

### 7.1 인증

```text
POST /api/auth/session-check
```

용도:

- Firebase Auth 토큰 검증
- 사용자 권한 확인
- 시스템 접근 가능 여부 확인

---

### 7.2 추천인 API

```text
GET    /api/referrers
POST   /api/referrers
GET    /api/referrers/:id
PATCH  /api/referrers/:id
DELETE /api/referrers/:id
```

---

### 7.3 계약종류 API

```text
GET    /api/contract-types
POST   /api/contract-types
GET    /api/contract-types/:id
PATCH  /api/contract-types/:id
```

---

### 7.4 계약 API

```text
GET    /api/contracts
POST   /api/contracts
GET    /api/contracts/:id
PATCH  /api/contracts/:id
POST   /api/contracts/:id/files
GET    /api/contracts/:id/history
```

---

### 7.5 계좌실명조회 API

```text
POST /api/contracts/:id/verify-account
```

요청 예시:

```json
{
  "bankName": "국민은행",
  "accountNo": "1234567890",
  "accountHolder": "홍길동"
}
```

응답 예시:

```json
{
  "result": "MATCHED",
  "message": "예금주명이 일치합니다."
}
```

---

### 7.6 계약변경 API

```text
POST  /api/contracts/:id/change-requests
GET   /api/contracts/:id/change-requests
GET   /api/change-requests/:id
PATCH /api/change-requests/:id/approve
PATCH /api/change-requests/:id/reject
```

---

### 7.7 수당지급 API

```text
GET   /api/allowances/daily
GET   /api/allowances/weekly
GET   /api/allowances/monthly
POST  /api/allowances/confirm
POST  /api/allowances/mark-paid
GET   /api/allowances/export-excel
```

---

### 7.8 감사로그 API

```text
GET /api/audit-logs
```

필터:

- 사용자
- 작업유형
- 대상유형
- 기간
- 키워드

---

## 8. 개발 폴더 구조 제안

```text
contract-manager/
├─ apps/
│  └─ web/
│     ├─ src/
│     │  ├─ app/
│     │  ├─ pages/
│     │  │  ├─ LoginPage.tsx
│     │  │  ├─ DashboardPage.tsx
│     │  │  ├─ ReferrerListPage.tsx
│     │  │  ├─ ReferrerFormPage.tsx
│     │  │  ├─ ContractTypePage.tsx
│     │  │  ├─ ContractListPage.tsx
│     │  │  ├─ ContractFormPage.tsx
│     │  │  ├─ ContractDetailPage.tsx
│     │  │  ├─ AllowancePage.tsx
│     │  │  ├─ AccountVerificationPage.tsx
│     │  │  └─ SettingsPage.tsx
│     │  ├─ components/
│     │  ├─ features/
│     │  │  ├─ auth/
│     │  │  ├─ referrers/
│     │  │  ├─ contractTypes/
│     │  │  ├─ contracts/
│     │  │  ├─ allowances/
│     │  │  ├─ files/
│     │  │  ├─ accountVerification/
│     │  │  └─ settings/
│     │  ├─ lib/
│     │  ├─ services/
│     │  └─ types/
│     └─ package.json
│
├─ functions/
│  ├─ src/
│  │  ├─ auth/
│  │  ├─ contracts/
│  │  ├─ contractTypes/
│  │  ├─ referrers/
│  │  ├─ allowances/
│  │  ├─ accountVerification/
│  │  ├─ files/
│  │  └─ audit/
│  └─ package.json
│
├─ database/
│  ├─ migrations/
│  ├─ seeds/
│  └─ schema.sql
│
├─ docs/
│  ├─ 00_INDEX.md
│  ├─ 01_SRS_계약관리시스템.md
│  ├─ 02_FRD_기능요구사항.md
│  ├─ 03_DB_SCHEMA.md
│  ├─ 04_API_SPEC.md
│  ├─ 05_UI_SCREEN_SPEC.md
│  └─ 06_SECURITY_POLICY.md
│
└─ README.md
```

---

## 9. 화면 개발 순서

개발 순서는 데이터 의존성을 기준으로 정한다.

1. 로그인 화면
2. 기본 레이아웃 및 사이드 메뉴
3. 대시보드
4. 추천인 목록/등록
5. 계약종류 관리
6. 계약 목록
7. 계약 등록
8. 계약 상세
9. 파일 업로드
10. 수당 지급목록
11. 계약변경 요청/이력
12. 계좌검증
13. 시스템관리
14. 감사로그

이 순서가 좋은 이유는 계약 등록 화면에서 추천인, 계약종류, 파일등록, 수당계산을 모두 참조하기 때문이다.

---

## 10. 구현 단계별 계획

### Phase 1. 프로젝트 기본 구축

목표:

- 프로젝트를 실행 가능한 상태로 구성한다.
- Firebase Auth, Hosting, Cloud Functions, Cloud SQL 연결의 기본 골격을 만든다.

작업내용:

1. Vite + React + TypeScript 프로젝트 생성
2. Tailwind CSS 설정
3. Firebase 프로젝트 연결
4. Firebase Auth 설정
5. Firebase Hosting 설정
6. Firebase Storage 설정
7. Cloud Functions TypeScript 프로젝트 구성
8. Cloud SQL PostgreSQL 연결 설정
9. 공통 API 응답 포맷 정의
10. 환경변수 관리 구성

산출물:

- 실행 가능한 웹앱
- 로그인 가능한 기본 구조
- API 호출 가능한 백엔드 구조
- DB 연결 확인

---

### Phase 2. 인증 및 권한관리

목표:

- Firebase Auth 로그인과 시스템 사용자 권한을 연결한다.

작업내용:

1. 로그인 화면 구현
2. Firebase Auth 로그인 처리
3. users 테이블 생성
4. Firebase UID와 users 테이블 매핑
5. 권한별 메뉴 표시
6. 인증 토큰 검증 미들웨어 구현
7. 권한 검증 미들웨어 구현

산출물:

- 로그인/로그아웃 기능
- 권한별 접근제어 기본 구조

---

### Phase 3. 추천인 관리

목표:

- 추천인 등록 및 계약 등록 시 드롭다운 선택이 가능하도록 한다.

작업내용:

1. referrers 테이블 생성
2. 추천인 등록 API 구현
3. 추천인 목록 API 구현
4. 추천인 수정 API 구현
5. 추천인 등록 화면 구현
6. 추천인 목록 화면 구현
7. 추천인 검색/필터 구현
8. 계약 등록 화면에서 추천인 드롭다운 연동

산출물:

- 추천인 등록/조회/수정 기능
- 계약 등록 시 추천인 선택 기능

---

### Phase 4. 계약종류 관리

목표:

- 계약종류를 추가 가능한 구조로 만든다.

작업내용:

1. contract_types 테이블 생성
2. 계약종류 등록 API 구현
3. 계약종류 목록 API 구현
4. 계약종류 수정 API 구현
5. 계약서 템플릿 PDF 업로드 기능 구현
6. 계약종류 관리 화면 구현
7. 계약종류별 기본 계약기간 설정
8. 계약종류별 수당계산 기준 저장

산출물:

- 계약종류 관리 기능
- 계약서 템플릿 PDF 관리 기능

---

### Phase 5. 계약 등록 및 상세관리

목표:

- 계약 기본정보를 등록하고 상세조회할 수 있게 한다.

작업내용:

1. contracts 테이블 생성
2. 계약번호 자동생성 로직 구현
3. 계약종료일 자동계산 로직 구현
4. 수당 기본 자동계산 로직 구현
5. 계약 등록 API 구현
6. 계약 목록 API 구현
7. 계약 상세 API 구현
8. 계약 등록 화면 구현
9. 계약 목록 화면 구현
10. 계약 상세 화면 구현
11. 계약상태 관리 구현
12. 주민번호/계좌번호 암호화 저장 구조 구현
13. 화면 마스킹 처리 구현

산출물:

- 계약 등록/조회/상세관리 기능
- 계약번호 자동생성
- 계약종료일 자동계산
- 수당 자동계산 기본 구현

---

### Phase 6. 파일 업로드 관리

목표:

- 계약서 PDF, 입금표 PDF, 변경증빙 파일을 계약번호 기준으로 관리한다.

작업내용:

1. contract_files 테이블 생성
2. Firebase Storage 업로드 기능 구현
3. 계약서 PDF 업로드 기능 구현
4. 입금표 PDF 업로드 기능 구현
5. 파일 메타데이터 저장
6. 계약 상세 화면 내 첨부파일 탭 구현
7. 파일 다운로드 기능 구현
8. 파일 다운로드 감사로그 저장

산출물:

- 계약서 PDF 등록
- 입금표 PDF 등록
- 계약별 파일관리 기능

---

### Phase 7. 수당 지급관리

목표:

- 일/주/월 수당지급 목록과 합계금액을 확인할 수 있게 한다.

작업내용:

1. allowance_payments 테이블 생성
2. 지급대상 산정 로직 구현
3. 일별 지급목록 API 구현
4. 주별 지급목록 API 구현
5. 월별 지급목록 API 구현
6. 합계금액 계산 구현
7. 간단정보 출력 구현
8. 전체정보 출력 구현
9. 엑셀 다운로드 구현
10. 지급확정 처리 구현
11. 지급완료 처리 구현
12. 지급확정 시점 스냅샷 저장

산출물:

- 일/주/월 지급목록
- 합계금액
- 엑셀 다운로드
- 지급확정/지급완료 관리

---

### Phase 8. 계약변경 관리

목표:

- 계좌정보변경, 양도/양수, 증액, 계약해지 이력을 관리한다.

작업내용:

1. contract_change_requests 테이블 생성
2. contract_change_details 테이블 생성
3. 계약변경 요청 API 구현
4. 계약변경 승인 API 구현
5. 계약변경 반려 API 구현
6. 변경 전/후 값 저장 로직 구현
7. 계약정보 반영 로직 구현
8. 계약변경 요청 화면 구현
9. 계약변경 히스토리 화면 구현
10. 변경증빙 파일 업로드 연동

산출물:

- 계약변경 요청/승인/반려
- 변경 전/후 이력 저장
- 계약변경 히스토리 조회

---

### Phase 9. 계좌실명조회

목표:

- 계좌정보 검증 기능을 구현한다.

작업내용:

1. account_verification_logs 테이블 생성
2. 계좌실명조회 버튼 UI 구현
3. 계좌실명조회 API 인터페이스 구현
4. MVP 단계에서는 수동검증 결과 저장 기능 구현
5. 실제 API 연계 시 외부 API 호출 모듈 구현
6. 검증결과 저장
7. 검증이력 조회 화면 구현
8. 지급목록에서 계좌검증 오류 표시

산출물:

- 계좌검증 상태 관리
- 계좌검증 이력
- 지급보류 처리 기준

---

### Phase 10. 감사로그 및 보안 강화

목표:

- 주요 행위에 대한 이력을 남기고 개인정보 보호 수준을 높인다.

작업내용:

1. audit_logs 테이블 생성
2. 계약 등록/수정 로그 저장
3. 계약변경 승인/반려 로그 저장
4. 파일 업로드/다운로드 로그 저장
5. 지급목록 출력 로그 저장
6. 계좌실명조회 로그 저장
7. 개인정보 조회 로그 저장
8. 권한별 마스킹 처리 강화
9. 엑셀 다운로드 권한 제한
10. 감사로그 조회 화면 구현

산출물:

- 감사로그 관리
- 개인정보 보호 처리
- 운영상 분쟁 대응 가능 구조

---

## 11. 구현 시 주의사항

### 11.1 주민번호 저장

주민번호는 전체 저장을 최소화해야 한다. 저장이 필요한 경우 반드시 암호화한다.

권장 방식:

```text
화면 표시: 801010-1******
DB 저장: 암호화
검색용 값: 생년월일 또는 별도 해시값
다운로드: 권한자만 전체 출력
```

---

### 11.2 계좌번호 저장

계좌번호도 암호화 대상이다.

권장 컬럼:

```text
account_no_encrypted
account_no_last4
account_no_masked
```

화면에는 기본적으로 마스킹된 계좌번호를 표시한다.

---

### 11.3 계약정보 직접수정 제한

계약정보는 가능한 직접 수정하지 않는다. 특히 아래 항목은 변경요청을 통해 처리한다.

- 계좌정보
- 계약자명
- 주민번호
- 양도/양수
- 보증금 증액
- 계약해지
- 추천인 변경

---

### 11.4 지급내역 스냅샷

수당지급은 계약정보와 분리하여 확정 시점 정보를 저장해야 한다.

이유:

- 계약정보가 변경되어도 과거 지급내역이 바뀌면 안 된다.
- 지급 당시의 은행명, 계좌번호, 예금주명, 지급금액을 증빙해야 한다.
- 회계자료로 활용할 수 있어야 한다.

---

### 11.5 PDF 파일관리

PDF 파일은 DB에 직접 저장하지 않고 Firebase Storage에 저장한다. DB에는 파일명, 파일유형, 저장경로, 업로드자, 업로드일시만 저장한다.

---

### 11.6 계약해지 처리

계약해지는 삭제가 아니라 상태변경이다.

계약해지 시 저장할 항목:

- 해지요청일
- 해지승인일
- 해지적용일
- 해지사유
- 환불여부
- 환불금액
- 해지증빙 파일
- 처리자

---

## 12. 최종 아키텍처

```text
Frontend
- Vite
- React
- TypeScript
- Tailwind CSS

Authentication
- Firebase Auth

Hosting
- Firebase Hosting

Backend
- Firebase Cloud Functions
- TypeScript

Database
- Google Cloud SQL PostgreSQL

File Storage
- Firebase Storage

External Integration
- 계좌실명조회 API
- 추후 전자서명 API
- 추후 지급/이체 API
```

데이터 흐름:

```text
사용자 로그인
→ Firebase Auth 인증
→ React 화면 접근
→ Cloud Functions API 호출
→ Firebase 토큰 검증
→ 사용자 권한 검증
→ Cloud SQL 저장/조회
→ PDF 파일은 Firebase Storage 저장
→ 주요 작업은 Audit Log 저장
```

---

## 13. 로드맵 요약

### 13.1 Phase 1: 기본 계약관리 구축

- 로그인
- 사용자 권한
- 추천인 관리
- 계약종류 관리
- 계약 등록
- 계약 목록
- 계약 상세
- PDF 업로드

산출물:

```text
기본 사용 가능한 계약관리 시스템
```

---

### 13.2 Phase 2: 수당/지급관리 구축

- 수당 자동계산
- 일/주/월 지급목록
- 합계금액
- 간단정보/전체정보 출력
- 엑셀 다운로드
- 지급확정
- 지급완료

산출물:

```text
회계담당자가 지급목록을 바로 사용할 수 있는 시스템
```

---

### 13.3 Phase 3: 계약변경/히스토리 구축

- 계좌정보변경
- 양도/양수
- 증액
- 계약해지
- 변경 전/후 이력
- 승인/반려
- 증빙자료 첨부

산출물:

```text
분쟁 대응 가능한 계약변경 관리체계
```

---

### 13.4 Phase 4: 계좌검증/보안 강화

- 계좌실명조회 API 연계
- 개인정보 암호화
- 개인정보 마스킹
- 감사로그
- 다운로드 이력
- 권한별 조회 제한

산출물:

```text
실제 운영 가능한 보안 수준의 계약관리 시스템
```

---

### 13.5 Phase 5: 고도화

- 계약서 자동생성
- 전자서명 연계
- 대량 업로드
- 대량 지급파일 생성
- 알림 기능
- 추천인별 성과 대시보드

산출물:

```text
계약운영 자동화 플랫폼
```

---

## 14. 구현 우선순위 체크리스트

### 최우선

- [ ] Firebase Auth 로그인
- [ ] 사용자 권한
- [ ] 추천인 관리
- [ ] 계약종류 관리
- [ ] 계약 등록
- [ ] 계약번호 자동생성
- [ ] 계약종료일 자동계산
- [ ] 계약서 PDF 업로드
- [ ] 입금표 PDF 업로드
- [ ] 계약 목록/상세

### 중요

- [ ] 수당 자동계산
- [ ] 월별 지급목록
- [ ] 일별 지급목록
- [ ] 주별 지급목록
- [ ] 합계금액
- [ ] 엑셀 다운로드
- [ ] 계약변경 이력

### 운영 안정화

- [ ] 지급확정
- [ ] 지급완료
- [ ] 계좌실명조회
- [ ] 계약해지
- [ ] 양도/양수
- [ ] 증액
- [ ] 감사로그
- [ ] 개인정보 마스킹

### 고도화

- [ ] 계약서 자동생성
- [ ] 전자서명 연계
- [ ] 대량계약 업로드
- [ ] 대량지급 파일 생성
- [ ] 알림 기능
- [ ] 추천인별 성과 대시보드

---

## 15. 결론

본 계약관리 시스템은 다음 5가지를 핵심 원칙으로 구현한다.

1. 계약종류는 확장 가능한 구조로 설계한다.
2. 계약정보는 직접 수정하지 않고 변경이력 중심으로 관리한다.
3. 수당지급은 계산값과 확정값을 분리한다.
4. 주민번호와 계좌번호는 암호화 및 마스킹을 전제로 한다.
5. PDF 파일은 계약번호 기준으로 체계적으로 저장한다.

1차 개발에서는 계약등록, PDF보관, 수당목록, 변경이력을 우선 구현하고, 2차에서 계좌검증, 지급확정, 권한/보안을 강화하며, 3차에서 자동계약서, 전자서명, 대량지급까지 확장하는 방식이 가장 현실적이다.
