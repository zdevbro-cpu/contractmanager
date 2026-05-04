# Firebase + Cloud SQL 초기 구축 절차

## 0) 현재 확인된 상태
- Firebase project: `contractmanager-32072`
- gcloud account: `zdevbro@gmail.com`
- blocker: `billing account is not in good standing` 로 Cloud SQL 인스턴스 생성 실패

## 1) 결제 상태 정상화 후 실행
```powershell
gcloud config set project contractmanager-32072
gcloud services enable sqladmin.googleapis.com --project contractmanager-32072
```

## 2) Cloud SQL 인스턴스 생성 (PostgreSQL 15, Seoul)
```powershell
gcloud sql instances create contractmanager-pg `
  --project=contractmanager-32072 `
  --database-version=POSTGRES_15 `
  --region=asia-northeast3 `
  --cpu=1 `
  --memory=3840MiB `
  --storage-size=20GB `
  --storage-type=SSD
```

## 3) DB / 사용자 생성
```powershell
gcloud sql databases create contractmanager `
  --instance=contractmanager-pg `
  --project=contractmanager-32072

gcloud sql users create app_user `
  --instance=contractmanager-pg `
  --password="<STRONG_PASSWORD>" `
  --project=contractmanager-32072
```

## 4) 스키마 적용
```powershell
gcloud sql connect contractmanager-pg --user=postgres --database=contractmanager --project=contractmanager-32072
```

접속 후:
```sql
\i database/schema.sql
```

## 5) 연결 정보 확인
```powershell
gcloud sql instances describe contractmanager-pg --project=contractmanager-32072
```

다음 항목 확보:
- `connectionName`
- `ipAddresses`

## 6) Firebase/Functions 환경 변수 설정(예시)
- `DB_HOST`
- `DB_PORT=5432`
- `DB_NAME=contractmanager`
- `DB_USER=app_user`
- `DB_PASSWORD=<STRONG_PASSWORD>`
- (Cloud Functions 2nd gen 사용 시) `INSTANCE_CONNECTION_NAME=<project:region:instance>`

## 7) 보안 권장
- 운영 전 공인 IP 제한 또는 Private IP 전환
- DB 비밀번호 Secret Manager로 이동
- 최소권한 계정 분리 (`app_user`, `readonly_user`)

