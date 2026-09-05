-- The three podium badges, as rows every database gets.
--
-- closeWeekly grants "First Voice", "Second Voice" and "Third Voice" by NAME
-- when a Legend challenge shuts, and a database without those rows reports
-- no-definition per place and grants nothing -- by design, so a close can
-- never fail. Until now the rows only existed where somebody had run the
-- seed script by hand (pnpm db:seed, upsert by name). A release step that
-- lives in one person's memory is not a release step, so the rows ride
-- along with the schema: "wrangler d1 migrations apply" carries them to
-- local, dev and prod exactly once.
--
-- WHERE NOT EXISTS on the name, not INSERT OR IGNORE: name has no unique
-- constraint, and a database that WAS seeded keeps its own ids -- userBadges
-- rows point at them. The values mirror src/db/seed-data.json; keep the two
-- in step.

INSERT INTO badgeDefinitions
  (id, createdAt, updatedAt, name, description, icon, tier, category,
   unlockCondition, sortOrder)
SELECT 'db1a1563-6a1b-4667-930d-d87d5c15c12f', '2026-09-05T00:00:00.000Z',
       '2026-09-05T00:00:00.000Z', 'First Voice',
       'Finish first on a Legend challenge board', 'firstvoice', 'gold',
       'legend', 'Place first when a Legend challenge closes', 17
WHERE NOT EXISTS (SELECT 1 FROM badgeDefinitions WHERE name = 'First Voice');

INSERT INTO badgeDefinitions
  (id, createdAt, updatedAt, name, description, icon, tier, category,
   unlockCondition, sortOrder)
SELECT '3036af65-df7b-4c86-b1b4-9e099ee9eae2', '2026-09-05T00:00:00.000Z',
       '2026-09-05T00:00:00.000Z', 'Second Voice',
       'Finish second on a Legend challenge board', 'secondvoice', 'silver',
       'legend', 'Place second when a Legend challenge closes', 18
WHERE NOT EXISTS (SELECT 1 FROM badgeDefinitions WHERE name = 'Second Voice');

INSERT INTO badgeDefinitions
  (id, createdAt, updatedAt, name, description, icon, tier, category,
   unlockCondition, sortOrder)
SELECT 'f5fab5f7-5566-49cf-a787-1b5ec8ba0402', '2026-09-05T00:00:00.000Z',
       '2026-09-05T00:00:00.000Z', 'Third Voice',
       'Finish third on a Legend challenge board', 'thirdvoice', 'bronze',
       'legend', 'Place third when a Legend challenge closes', 19
WHERE NOT EXISTS (SELECT 1 FROM badgeDefinitions WHERE name = 'Third Voice');
