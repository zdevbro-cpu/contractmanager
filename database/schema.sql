-- Contract Manager base schema for Cloud SQL PostgreSQL
-- Apply after creating DB: contractmanager

create table if not exists import_batches (
  id bigserial primary key,
  source_file_name text not null,
  status text not null default 'PENDING',
  total_rows integer not null default 0,
  matched_rows integer not null default 0,
  review_rows integer not null default 0,
  failed_rows integer not null default 0,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists contracts (
  id bigserial primary key,
  contract_no text unique,
  contract_name text not null,
  contractor_name text not null,
  first_allowance_date date not null,
  contract_date date,
  contract_end_date date,
  deposit_amount numeric(15,0),
  work_days text,
  work_allowance numeric(15,0),
  payment_method text,
  bank_name text,
  account_no text,
  account_holder text,
  resident_registration_number text,
  phone text,
  referrer_name text,
  remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists contract_documents (
  id bigserial primary key,
  contract_id bigint not null references contracts(id) on delete cascade,
  file_type text not null default 'CONTRACT_PDF',
  original_file_name text not null,
  storage_path text not null,
  file_hash text,
  match_key text,
  matched_by text,
  matched_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists import_issues (
  id bigserial primary key,
  batch_id bigint not null references import_batches(id) on delete cascade,
  row_no integer,
  issue_code text not null,
  issue_reason text not null,
  payload jsonb,
  created_at timestamptz not null default now()
);

create table if not exists staging_contract_rows (
  id bigserial primary key,
  batch_id bigint not null references import_batches(id) on delete cascade,
  row_no integer not null,
  contract_no text,
  contract_name text,
  contractor_name text,
  first_allowance_date date,
  match_key text,
  match_status text not null default 'PENDING',
  matched_pdf_file text,
  error_code text,
  error_reason text,
  raw_payload jsonb,
  created_at timestamptz not null default now()
);

create table if not exists referrers (
  id bigserial primary key,
  name text not null,
  org text not null,
  phone text not null,
  title text not null default '사원',
  status text not null default '활성',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_contracts_match_basis
  on contracts (contract_name, first_allowance_date, contractor_name);

create index if not exists idx_contract_documents_match_key
  on contract_documents (match_key);

create index if not exists idx_staging_batch_status
  on staging_contract_rows (batch_id, match_status);

