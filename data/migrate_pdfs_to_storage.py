# -*- coding: utf-8 -*-
"""
기존 functions/data/ 폴더의 PDF를 Firebase Storage로 마이그레이션
실행: py data/migrate_pdfs_to_storage.py
"""

import sys
import os
import subprocess
import requests

sys.stdout.reconfigure(encoding="utf-8")

API_BASE    = "https://api-wj5zu6alya-du.a.run.app"
BUCKET_NAME = "contractmanager-pdf-storage"
DATA_ROOT   = "c:/ProjectCode/contractmanager/functions/data"

# ─────────────────────────────────────────────
# 1단계: 계약 목록 조회 (계약자명 → id 매핑)
# ─────────────────────────────────────────────
print("[ 1단계 ] 계약 목록 조회 중...")
resp = requests.get(f"{API_BASE}/contracts", timeout=30)
resp.raise_for_status()
contracts = resp.json().get("rows", [])
print(f"  ✅ {len(contracts)}건 조회")

name_map: dict[str, list[dict]] = {}
for c in contracts:
    name = (c.get("name") or "").strip()
    if name:
        name_map.setdefault(name, []).append(c)

# ─────────────────────────────────────────────
# 2단계: PDF 탐색 → gcloud storage cp → DB 업데이트
# ─────────────────────────────────────────────
print("\n[ 2단계 ] PDF 업로드 시작...")
success, skipped, errors = 0, 0, []

for dirpath, _, filenames in os.walk(DATA_ROOT):
    for fname in filenames:
        if not fname.lower().endswith(".pdf"):
            continue

        fpath = os.path.join(dirpath, fname).replace("\\", "/")
        stem = os.path.splitext(fname)[0]
        parts = stem.split("_")
        candidate_name = parts[-1] if parts else ""

        matched = name_map.get(candidate_name, [])
        if not matched:
            print(f"  ⚠️  매칭 실패: {fname}")
            skipped += 1
            continue

        for contract in matched:
            cid = contract["id"]
            storage_path = f"contracts/{cid}/{fname}"
            gcs_uri = f"gs://{BUCKET_NAME}/{storage_path}"

            # gcloud storage cp 로 업로드
            result = subprocess.run(
                f'gcloud storage cp "{fpath}" "{gcs_uri}"',
                capture_output=True, text=True, shell=True
            )
            if result.returncode != 0:
                # 이미 존재하면 건너뜀
                if "already exists" in result.stderr or result.returncode == 0:
                    print(f"  ⏭  이미 존재: {storage_path}")
                    skipped += 1
                    continue
                print(f"  ❌ 업로드 실패: {fname} - {result.stderr.strip()}")
                errors.append(f"{fname}: {result.stderr.strip()}")
                continue

            # DB 업데이트
            try:
                upd = requests.patch(
                    f"{API_BASE}/contracts/{cid}/pdf-path",
                    json={"pdfStoragePath": storage_path},
                    timeout=15
                )
                if upd.ok:
                    print(f"  ✅ {fname} → {storage_path}")
                    success += 1
                else:
                    print(f"  ❌ DB 업데이트 실패: {cid} / {upd.text}")
                    errors.append(f"{fname}: DB 오류 {upd.text}")
            except Exception as e:
                print(f"  ❌ DB 오류: {fname} - {e}")
                errors.append(f"{fname}: {e}")

print(f"""
═══════════════════════════════════════
  마이그레이션 완료
  ✅ 성공: {success}건
  ⏭  건너뜀: {skipped}건
  ❌ 실패: {len(errors)}건
═══════════════════════════════════════""")
if errors:
    print("  실패 목록:")
    for e in errors:
        print(f"    - {e}")
