-- 0024_piano_background_pack.sql — expanded Piano supporter art pack.
--
-- Seed stable identities and the automatic supporter assignments only. An
-- identity is not runtime-visible until Studio publishes a complete revision.

INSERT OR IGNORE INTO premiumBackgroundAssets
  (id, surface, title, description, status, activeRevisionId, createdAt,
   updatedAt, retiredAt)
VALUES
  ('piano-rain-glasshouse', 'piano', 'Rain Glasshouse',
   'A glass-walled piano room suspended inside the evening rain.',
   'active', NULL, '2026-08-10T00:00:00.000Z',
   '2026-08-10T00:00:00.000Z', NULL),
  ('piano-alpine-observatory', 'piano', 'Alpine Observatory',
   'A high-altitude observatory under the last blue light.',
   'active', NULL, '2026-08-10T00:00:00.000Z',
   '2026-08-10T00:00:00.000Z', NULL),
  ('piano-cedar-listening-room', 'piano', 'Cedar Listening Room',
   'Dark cedar, paper light, and a room tuned for close listening.',
   'active', NULL, '2026-08-10T00:00:00.000Z',
   '2026-08-10T00:00:00.000Z', NULL),
  ('piano-desert-modern-salon', 'piano', 'Desert Modern Salon',
   'Warm stone, desert dusk, and a spacious modern recital salon.',
   'active', NULL, '2026-08-10T00:00:00.000Z',
   '2026-08-10T00:00:00.000Z', NULL),
  ('piano-moonlit-gallery', 'piano', 'Moonlit Gallery',
   'A silver-blue gallery prepared for a private midnight recital.',
   'active', NULL, '2026-08-10T00:00:00.000Z',
   '2026-08-10T00:00:00.000Z', NULL),
  ('piano-coastal-fog-pavilion', 'piano', 'Coastal Fog Pavilion',
   'A quiet coastal pavilion opening into soft morning fog.',
   'active', NULL, '2026-08-10T00:00:00.000Z',
   '2026-08-10T00:00:00.000Z', NULL);

-- INSERT OR IGNORE preserves any intentional revocation if this migration is
-- replayed in a persistent preview database.
INSERT OR IGNORE INTO premiumSupporterGroupPerks
  (groupId, backgroundId, assignedAt, revokedAt)
SELECT g.id, a.id, '2026-08-10T00:00:00.000Z', NULL
  FROM premiumSupporterGroups g
  JOIN premiumBackgroundAssets a
    ON a.id IN (
      'piano-rain-glasshouse',
      'piano-alpine-observatory',
      'piano-cedar-listening-room',
      'piano-desert-modern-salon',
      'piano-moonlit-gallery',
      'piano-coastal-fog-pavilion'
    )
 WHERE g.slug = 'active-supporters'
   AND g.kind = 'automatic'
   AND g.deletedAt IS NULL
   AND a.surface = 'piano';
