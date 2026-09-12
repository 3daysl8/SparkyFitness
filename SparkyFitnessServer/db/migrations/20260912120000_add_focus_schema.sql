-- Focus & Motivation hub — daily/weekly/long-term intentions across
-- user-defined life domains (health, work, relationships, ...), with
-- optional numeric/boolean targets and free-text check-in reflections.
-- RLS: all three tables are Tier 1 (owner-only) — no family/caregiver
-- sharing, matching the Cycle & Pregnancy hub's precedent for personal
-- reflection data. Policies live in db/rls_policies.sql (create_owner_policy)
-- and are reapplied on every startup.

-- Ensure the shared updated_at trigger exists (idempotent).
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- 1. focus_domains — user-defined life areas (health/work/relationship/...).
-- ---------------------------------------------------------------------------
CREATE TABLE focus_domains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public."user"(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    color VARCHAR(20),
    icon VARCHAR(50),
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_user_focus_domain_name UNIQUE (user_id, name)
);
CREATE INDEX idx_focus_domains_user_id ON focus_domains(user_id);
CREATE TRIGGER set_timestamp BEFORE UPDATE ON focus_domains
FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

-- ---------------------------------------------------------------------------
-- 2. focuses — one row per focus, at any tier (daily/weekly/long_term).
--    A daily focus's period_date is the specific date; a weekly focus's
--    period_date is that week's start date; a long_term focus leaves it NULL
--    (open-ended/standing). parent_focus_id lets a daily focus point at the
--    weekly focus it serves, and that at a long-term one, forming a chain.
-- ---------------------------------------------------------------------------
CREATE TABLE focuses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public."user"(id) ON DELETE CASCADE,
    domain_id UUID REFERENCES focus_domains(id) ON DELETE SET NULL,
    timeframe VARCHAR(20) NOT NULL,              -- daily|weekly|long_term
    statement TEXT NOT NULL,
    target_type VARCHAR(20) NOT NULL DEFAULT 'none', -- none|numeric|boolean
    target_value NUMERIC,
    unit VARCHAR(30),
    parent_focus_id UUID REFERENCES focuses(id) ON DELETE SET NULL,
    period_date DATE,
    status VARCHAR(20) NOT NULL DEFAULT 'active', -- active|completed|archived
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_focuses_user_id ON focuses(user_id);
CREATE INDEX idx_focuses_user_timeframe ON focuses(user_id, timeframe, status);
CREATE INDEX idx_focuses_user_period ON focuses(user_id, period_date);
CREATE INDEX idx_focuses_parent ON focuses(parent_focus_id);
CREATE TRIGGER set_timestamp BEFORE UPDATE ON focuses
FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

-- ---------------------------------------------------------------------------
-- 3. focus_checkins — reflection/progress entries against a focus. A daily
--    focus typically gets one end-of-day entry; weekly/long-term ones
--    accumulate several over their period.
-- ---------------------------------------------------------------------------
CREATE TABLE focus_checkins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public."user"(id) ON DELETE CASCADE,
    focus_id UUID NOT NULL REFERENCES focuses(id) ON DELETE CASCADE,
    checkin_date DATE NOT NULL,
    progress_value NUMERIC,
    completed BOOLEAN,
    reflection_note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_user_focus_checkin_day UNIQUE (user_id, focus_id, checkin_date)
);
CREATE INDEX idx_focus_checkins_user_id ON focus_checkins(user_id);
CREATE INDEX idx_focus_checkins_focus_id ON focus_checkins(focus_id);
CREATE INDEX idx_focus_checkins_user_date ON focus_checkins(user_id, checkin_date);
CREATE TRIGGER set_timestamp BEFORE UPDATE ON focus_checkins
FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

-- ---------------------------------------------------------------------------
-- 4. Row-Level Security.
--   RLS is NOT defined here. Per project convention, applied in
--   db/rls_policies.sql (reapplied on every startup). All three tables use
--   create_owner_policy(...) => Tier 1, owner-only.
-- ---------------------------------------------------------------------------
