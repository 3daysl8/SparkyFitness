-- Calendar / Daily Agenda — per-user subscriptions to external iCal (.ics)
-- feeds (Google/Apple/Outlook), rendered as a Day/Week agenda on the Home
-- dashboard. RLS: owner-only (Tier 1), matching Focus's precedent for
-- personal schedule data — no family/caregiver sharing.
-- Policy lives in db/rls_policies.sql (create_owner_policy) and is
-- reapplied on every startup.

CREATE TABLE calendar_feeds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public."user"(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    ics_url TEXT NOT NULL,
    color VARCHAR(20),
    is_enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_calendar_feeds_user_id ON calendar_feeds(user_id);

-- Reuses the shared updated_at trigger function created by the Focus
-- migration (20260912120000_add_focus_schema.sql); CREATE OR REPLACE there
-- makes it safe to rely on without redefining it here.
CREATE TRIGGER set_timestamp BEFORE UPDATE ON calendar_feeds
FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
