-- ============================================================================
-- Migration: 152_fix_notifications_timestamp_timezone
-- Description: Change notifications.created_at and read_at from
--              TIMESTAMP (without timezone) to TIMESTAMPTZ so that
--              Supabase / PostgREST returns values with an explicit UTC
--              offset ("+00:00").  Without this, JavaScript running in a
--              UTC+8 (PH) browser interprets the bare string as local time,
--              making every notification appear ~8 hours older than it is.
-- ============================================================================

ALTER TABLE notifications
  ALTER COLUMN created_at TYPE TIMESTAMPTZ
    USING created_at AT TIME ZONE 'UTC';

ALTER TABLE notifications
  ALTER COLUMN read_at TYPE TIMESTAMPTZ
    USING read_at AT TIME ZONE 'UTC';
