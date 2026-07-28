-- 1인 사업자 세금 계산 기능의 기반 스키마.
-- 이 마이그레이션은 스키마와 시드 데이터만 추가한다 — 실제 계산 화면은 이후 작업.

-- ── 사용자 과세 유형 설정 ────────────────────────────────────
-- business_type/has_yellow_umbrella는 지금 UI에서 아직 입력받지 않는 향후 확장용 컬럼
CREATE TABLE user_tax_settings (
  user_id TEXT PRIMARY KEY,
  tax_type TEXT NOT NULL CHECK (tax_type IN ('general','simplified','freelance_3_3')),
  business_type TEXT,
  -- 간이과세자 업종별 부가가치율(%, 예: 20 = 20%). 국세청 고시표를 임의로 채우지
  -- 말 것 — tax_type='simplified' 선택 시 사용자가 본인 업종 부가율을 직접 입력.
  -- 모르면 NULL로 두고 "정확한 값은 홈택스에서 확인 후 입력" 안내(임의 추정치 금지)
  simplified_vat_rate REAL,
  has_yellow_umbrella INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

-- ── 세율/누진공제 (매년 바뀌므로 코드가 아닌 이 테이블에서 조회) ──────────
-- 매년 5월 국세청 고시 확인 후 새 연도 row 추가. 기존 연도 row는 절대 수정하지
-- 말 것(과거 귀속연도 재계산 방지). UNIQUE(year, min_amount) + INSERT OR IGNORE로
-- schema.sql 재실행 시에도 중복 시드가 쌓이지 않게 함
CREATE TABLE tax_brackets_config (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  year INTEGER NOT NULL,
  min_amount INTEGER NOT NULL,
  max_amount INTEGER,              -- NULL = 상한 없음(최고 구간)
  rate REAL NOT NULL,
  deduction INTEGER NOT NULL,      -- 누진공제액
  local_tax_rate REAL NOT NULL DEFAULT 0.1,
  UNIQUE(year, min_amount)
);

-- 2026년 귀속 8단계 기준 시드 데이터
INSERT OR IGNORE INTO tax_brackets_config (year, min_amount, max_amount, rate, deduction) VALUES
  (2026, 0, 14000000, 0.06, 0),
  (2026, 14000000, 50000000, 0.15, 1260000),
  (2026, 50000000, 88000000, 0.24, 5760000),
  (2026, 88000000, 150000000, 0.35, 15440000),
  (2026, 150000000, 300000000, 0.38, 19940000),
  (2026, 300000000, 500000000, 0.40, 25940000),
  (2026, 500000000, 1000000000, 0.42, 35940000),
  (2026, 1000000000, NULL, 0.45, 65940000);

-- ── 지출 분류에 종합소득세 경비 인정 여부 ────────────────────────
-- 기본값 1(경비 포함) — 대부분의 지출 분류는 경비로 인정되므로 opt-out 방식
ALTER TABLE categories ADD COLUMN is_tax_deductible INTEGER NOT NULL DEFAULT 1;

-- ── 거래별 "거래처 접대성 지출" 여부 — 부가세 매입세액공제 판별용 ─────────
-- is_tax_deductible과 별개 개념: 접대비는 종소세 경비는 되지만 부가세 매입세액공제는 안 됨
ALTER TABLE transactions ADD COLUMN is_entertainment INTEGER NOT NULL DEFAULT 0;

-- ── 카드에 사업용 여부 ─────────────────────────────────────
ALTER TABLE cards ADD COLUMN is_business INTEGER NOT NULL DEFAULT 0;
