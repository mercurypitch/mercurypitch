-- Migration: add streak forgiveness columns to userProfiles.
--
-- schema.sql declares `userProfiles` with `CREATE TABLE IF NOT EXISTS`, so on a
-- database that already had the table these new columns are never added by
-- re-running schema.sql. Without them the streak-freeze read/write path
-- (streak-service.ts) would reference columns that don't exist.
--
-- Columns (all additive, safe defaults so existing rows keep working):
--   longestStreak      — high-water mark for the streak card
--   streakFreezes      — unspent freezes; a 1-day gap consumes one vs resetting
--   lastFreezeUsedDate — YYYY-MM-DD of the last auto-consumed freeze
--   previousStreak     — streak value just before the most recent reset
--   streakResetDate    — YYYY-MM-DD the streak last reset (drives 72h repair)
--   lastRepairDate     — YYYY-MM-DD of the last repair (once-per-30-days gate)
--
-- Run ONCE per environment whose `userProfiles` table predates these columns:
--   wrangler d1 execute mercurypitch-db-dev --remote --file scripts/migrate-userProfiles-add-streak-freeze.sql
--   wrangler d1 execute mercurypitch-db     --remote --file scripts/migrate-userProfiles-add-streak-freeze.sql
--
-- NOTE: SQLite has no "ADD COLUMN IF NOT EXISTS"; each statement errors
-- (harmlessly) if the column already exists. Fresh databases get the columns
-- from schema.sql and do not need this migration.

ALTER TABLE userProfiles ADD COLUMN longestStreak INTEGER NOT NULL DEFAULT 0;
ALTER TABLE userProfiles ADD COLUMN streakFreezes INTEGER NOT NULL DEFAULT 0;
ALTER TABLE userProfiles ADD COLUMN lastFreezeUsedDate TEXT;
ALTER TABLE userProfiles ADD COLUMN previousStreak INTEGER NOT NULL DEFAULT 0;
ALTER TABLE userProfiles ADD COLUMN streakResetDate TEXT;
ALTER TABLE userProfiles ADD COLUMN lastRepairDate TEXT;
