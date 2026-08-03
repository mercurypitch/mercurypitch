-- 0012_achievement_category.sql — which shelf an achievement sits on.
--
-- The set was thirteen flat entries, so a singer on day one and a singer
-- on month six read the same undifferentiated list, and most of it was
-- unreachable for either of them. Grouping them into a first-week band, a
-- keep-going band and a long-haul band is what makes the list a path:
-- there is always one within reach, and the far ones stay visible as
-- something to aim at.
--
-- Named `category` to match badgeDefinitions, and NOT `group` — the
-- preview-definition generator emits unquoted column lists, where GROUP is
-- a syntax error rather than a column.
--
-- Values: 'beginnings' | 'building' | 'mastery'. Text rather than an
-- enum/lookup for the same reason userActivity.kind is: a new band is a
-- seed edit, not a migration.
--
-- Defaulted to 'beginnings' so rows seeded before this column keep working
-- and land somewhere sensible; the seeder overwrites every one of them on
-- its next pass.

ALTER TABLE achievements ADD COLUMN category TEXT NOT NULL DEFAULT 'beginnings';

CREATE INDEX IF NOT EXISTS idx_achievements_category
  ON achievements(category, sortOrder);
