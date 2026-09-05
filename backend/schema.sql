PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS dataset_meta (
  key TEXT PRIMARY KEY, value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS web_evidence (
  id TEXT PRIMARY KEY, url TEXT NOT NULL, sha256 TEXT NOT NULL CHECK(length(sha256)=64),
  record_json TEXT NOT NULL CHECK(json_valid(record_json))
);
CREATE TABLE IF NOT EXISTS faculties (
  id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS departments (
  id TEXT PRIMARY KEY, faculty_id TEXT NOT NULL REFERENCES faculties(id), name TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS source_documents (
  id TEXT PRIMARY KEY, kind TEXT NOT NULL CHECK(kind IN ('handbook','hirameki')),
  entrance_year INTEGER NOT NULL CHECK(entrance_year BETWEEN 2021 AND 2100),
  faculty_name TEXT NOT NULL, label TEXT NOT NULL, url TEXT NOT NULL,
  local_path TEXT NOT NULL, sha256 TEXT NOT NULL CHECK(length(sha256)=64),
  page_count INTEGER NOT NULL CHECK(page_count>0), metadata_json TEXT NOT NULL CHECK(json_valid(metadata_json))
);
CREATE TABLE IF NOT EXISTS source_pages (
  source_id TEXT NOT NULL REFERENCES source_documents(id) ON DELETE CASCADE,
  page_number INTEGER NOT NULL CHECK(page_number>0), text TEXT NOT NULL,
  topics_json TEXT NOT NULL CHECK(json_valid(topics_json)),
  PRIMARY KEY(source_id,page_number)
);
CREATE TABLE IF NOT EXISTS source_tables (
  source_id TEXT NOT NULL, page_number INTEGER NOT NULL, table_index INTEGER NOT NULL,
  rows_json TEXT NOT NULL CHECK(json_valid(rows_json)), bbox_json TEXT NOT NULL CHECK(json_valid(bbox_json)),
  PRIMARY KEY(source_id,page_number,table_index),
  FOREIGN KEY(source_id,page_number) REFERENCES source_pages(source_id,page_number) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS course_records (
  id TEXT PRIMARY KEY, source_id TEXT NOT NULL, page_number INTEGER NOT NULL,
  title TEXT NOT NULL CHECK(length(title)>0), credits REAL NOT NULL CHECK(credits>0 AND credits<=20),
  category TEXT NOT NULL, raw_required TEXT NOT NULL,
  verification_status TEXT NOT NULL CHECK(verification_status='extracted_reference'),
  record_json TEXT NOT NULL CHECK(json_valid(record_json)),
  FOREIGN KEY(source_id,page_number) REFERENCES source_pages(source_id,page_number) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS course_title_idx ON course_records(title);
CREATE INDEX IF NOT EXISTS course_source_page_idx ON course_records(source_id,page_number);
CREATE TABLE IF NOT EXISTS requirement_evidence (
  source_id TEXT NOT NULL, page_number INTEGER NOT NULL,
  requirement_kind TEXT NOT NULL CHECK(requirement_kind IN ('graduation','progression','registration','teacher','hirameki','tap')),
  verification_status TEXT NOT NULL DEFAULT 'source_reference',
  PRIMARY KEY(source_id,page_number,requirement_kind),
  FOREIGN KEY(source_id,page_number) REFERENCES source_pages(source_id,page_number) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS programs (
  id TEXT PRIMARY KEY, source_id TEXT NOT NULL REFERENCES source_documents(id),
  title TEXT NOT NULL, total_credits REAL NOT NULL CHECK(total_credits>0),
  record_json TEXT NOT NULL CHECK(json_valid(record_json))
);
CREATE TABLE IF NOT EXISTS program_groups (
  program_id TEXT NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  position INTEGER NOT NULL, name TEXT NOT NULL, required_credits REAL NOT NULL CHECK(required_credits>0),
  note TEXT, PRIMARY KEY(program_id,position)
);
CREATE TABLE IF NOT EXISTS program_courses (
  program_id TEXT NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  position INTEGER NOT NULL, title TEXT NOT NULL, credits REAL NOT NULL CHECK(credits>0),
  PRIMARY KEY(program_id,position)
);
CREATE TABLE IF NOT EXISTS student_profiles (
  id TEXT PRIMARY KEY, department_id TEXT NOT NULL REFERENCES departments(id),
  entrance_year INTEGER NOT NULL CHECK(entrance_year BETWEEN 2022 AND 2100),
  is_general INTEGER NOT NULL CHECK(is_general IN (0,1)),
  takes_teacher INTEGER NOT NULL CHECK(takes_teacher IN (0,1)),
  takes_hirameki INTEGER NOT NULL CHECK(takes_hirameki IN (0,1)),
  takes_tap INTEGER NOT NULL DEFAULT 0 CHECK(takes_tap IN (0,1)),
  individual_note TEXT NOT NULL DEFAULT '' CHECK(length(individual_note)<=1000),
  revision INTEGER NOT NULL DEFAULT 1 CHECK(revision>0), updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS cohort_datasets (
  department_id TEXT NOT NULL REFERENCES departments(id),
  entrance_year INTEGER NOT NULL CHECK(entrance_year BETWEEN 2022 AND 2100),
  status TEXT NOT NULL CHECK(status IN ('success','partial','unavailable')),
  course_count INTEGER NOT NULL CHECK(course_count>=0),
  payload_json TEXT NOT NULL CHECK(json_valid(payload_json)),
  PRIMARY KEY(department_id,entrance_year)
);
CREATE TABLE IF NOT EXISTS academic_calendars (
  academic_year INTEGER PRIMARY KEY,
  payload_json TEXT NOT NULL CHECK(json_valid(payload_json))
);
CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL, department_id TEXT NOT NULL REFERENCES departments(id),
  entrance_year INTEGER NOT NULL, created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS account_sessions (
  token_hash TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  csrf_token TEXT NOT NULL, expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS session_expiry_idx ON account_sessions(expires_at);
CREATE TABLE IF NOT EXISTS account_state (
  account_id TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  payload_json TEXT NOT NULL CHECK(json_valid(payload_json)), revision INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS auth_attempts (
  bucket TEXT PRIMARY KEY, attempts INTEGER NOT NULL, resets_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS admin_members (
  account_id TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  granted_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS usage_events (
  id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  event_name TEXT NOT NULL CHECK(event_name IN ('home','timetable','grades','handbooks','settings','requirements')),
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS usage_date_idx ON usage_events(created_at,account_id);
CREATE TABLE IF NOT EXISTS support_tickets (
  id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  subject TEXT NOT NULL CHECK(length(subject) BETWEEN 1 AND 120),
  status TEXT NOT NULL CHECK(status IN ('open','answered','closed')),
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS tickets_owner_idx ON support_tickets(account_id,updated_at);
CREATE TABLE IF NOT EXISTS support_messages (
  id TEXT PRIMARY KEY, ticket_id TEXT NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  author_id TEXT NOT NULL REFERENCES accounts(id), is_admin INTEGER NOT NULL CHECK(is_admin IN (0,1)),
  body TEXT NOT NULL CHECK(length(body) BETWEEN 1 AND 5000), created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS support_message_ticket_idx ON support_messages(ticket_id,created_at);
CREATE TABLE IF NOT EXISTS offering_sources (
  id TEXT PRIMARY KEY, academic_year INTEGER NOT NULL, metadata_json TEXT NOT NULL CHECK(json_valid(metadata_json)), payload_json TEXT NOT NULL CHECK(json_valid(payload_json))
);
CREATE TABLE IF NOT EXISTS offering_occurrences (
  id TEXT PRIMARY KEY, academic_year INTEGER NOT NULL, source_id TEXT NOT NULL REFERENCES offering_sources(id), page INTEGER NOT NULL,
  lecture_code TEXT NOT NULL, is_canonical INTEGER NOT NULL, payload_json TEXT NOT NULL CHECK(json_valid(payload_json))
);
CREATE INDEX IF NOT EXISTS offering_code_idx ON offering_occurrences(academic_year,lecture_code);
CREATE TABLE IF NOT EXISTS scheduled_offerings (
  id TEXT PRIMARY KEY, academic_year INTEGER NOT NULL, lecture_code TEXT NOT NULL, payload_json TEXT NOT NULL CHECK(json_valid(payload_json)), UNIQUE(academic_year,lecture_code)
);
CREATE TABLE IF NOT EXISTS offering_imports(academic_year INTEGER PRIMARY KEY,payload_json TEXT NOT NULL CHECK(json_valid(payload_json)));
PRAGMA user_version = 4;
