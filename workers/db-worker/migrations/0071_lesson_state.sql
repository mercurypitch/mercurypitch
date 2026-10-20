-- 0071_lesson_state.sql: what the admin console overrides, lesson by lesson.
--
-- A Find Your Pitch lesson is published in code (drafts.ts) and goes out
-- with a release. These rows let the Content Studio override that at
-- runtime, per lesson: whether the lesson is published, and which of its
-- hook and tease wordings it shows. The contract every side reads is
-- src/lib/lesson-state.ts; the routes are lesson-state-routes.ts.
--
-- A NULL field is the code's default. A row whose fields are all NULL is
-- deleted rather than kept, so only a lesson with an override has a row.
-- `hook` and `tease` hold variant ids, which the worker checks against
-- VARIANT_ID. There is no CHECK for them here: SQLite changes a CHECK only
-- by rebuilding the table, and the contract may widen the rule.
--
-- `updated_by` and `changed_by` name the Cloudflare Access identity behind a
-- change (a sign-in email, or a service token's name), and are NULL when the
-- shared admin key made it. Nothing here names a learner's account, so
-- account deletion has nothing to remove.
--
-- Purely additive: two new tables, and nothing that exists is touched.
CREATE TABLE IF NOT EXISTS lesson_state (
  lesson INTEGER PRIMARY KEY CHECK (lesson BETWEEN 0 AND 99),
  published INTEGER NULL CHECK (published IN (0, 1)),
  hook TEXT NULL,
  tease TEXT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT NULL
);

-- One row for each field a save changed, written in the same batch as the
-- change and never edited: who published what, and when. `old_value` and
-- `new_value` are NULL for the code's default; `published` is logged as
-- 'true' or 'false', and a hook or tease as its variant id.
CREATE TABLE IF NOT EXISTS lesson_state_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lesson INTEGER NOT NULL,
  field TEXT NOT NULL,
  old_value TEXT NULL,
  new_value TEXT NULL,
  changed_at TEXT NOT NULL,
  changed_by TEXT NULL
);

-- The Content Studio's history line reads one lesson's latest changes.
CREATE INDEX IF NOT EXISTS idx_lesson_state_log_lesson
  ON lesson_state_log(lesson, id);
