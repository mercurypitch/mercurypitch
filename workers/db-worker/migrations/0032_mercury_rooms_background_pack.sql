-- 0032_mercury_rooms_background_pack.sql — Mercury Rooms supporter art pack.
--
-- Two supporter rooms per surface, and the first supporter art Guitar Night
-- has ever had: its rooms only joined the shared catalog in 0031, so until
-- now a guitar identity could not be stored here at all.
--
-- Seed stable identities and the automatic supporter assignments only. An
-- identity is not runtime-visible until Studio publishes a complete revision,
-- so applying this before the art is uploaded adds nothing to the picker.

INSERT OR IGNORE INTO premiumBackgroundAssets
  (id, surface, title, description, status, activeRevisionId, createdAt,
   updatedAt, retiredAt)
VALUES
  ('karaoke-floating-orb', 'karaoke', 'Floating Orb',
   'A slow-turning orb of light over a dark room.',
   'active', NULL, '2026-08-19T00:00:00.000Z',
   '2026-08-19T00:00:00.000Z', NULL),
  ('karaoke-nordic-amphitheatre', 'karaoke', 'Nordic Amphitheatre',
   'Pale stone tiers under an open northern sky.',
   'active', NULL, '2026-08-19T00:00:00.000Z',
   '2026-08-19T00:00:00.000Z', NULL),
  ('jam-skyline-penthouse', 'jam', 'Skyline Penthouse',
   'Glass, city lights, and room to spread out.',
   'active', NULL, '2026-08-19T00:00:00.000Z',
   '2026-08-19T00:00:00.000Z', NULL),
  ('jam-nordic-wood', 'jam', 'Nordic Wood',
   'Bright timber and daylight, built for a full band.',
   'active', NULL, '2026-08-19T00:00:00.000Z',
   '2026-08-19T00:00:00.000Z', NULL),
  ('piano-manor-library', 'piano', 'Manor Library',
   'Shelves to the ceiling and one lamp lit.',
   'active', NULL, '2026-08-19T00:00:00.000Z',
   '2026-08-19T00:00:00.000Z', NULL),
  ('piano-parisian-salon', 'piano', 'Parisian Salon',
   'Tall windows, gilt mouldings, afternoon light.',
   'active', NULL, '2026-08-19T00:00:00.000Z',
   '2026-08-19T00:00:00.000Z', NULL),
  ('guitar-british-rock', 'guitar', 'British Rock',
   'Stacked cabs in a low, dark rehearsal room.',
   'active', NULL, '2026-08-19T00:00:00.000Z',
   '2026-08-19T00:00:00.000Z', NULL),
  ('guitar-venice-beach', 'guitar', 'Venice Beach',
   'Sun, salt air and an open garage door.',
   'active', NULL, '2026-08-19T00:00:00.000Z',
   '2026-08-19T00:00:00.000Z', NULL);

-- INSERT OR IGNORE preserves any intentional revocation if this migration is
-- replayed in a persistent preview database.
INSERT OR IGNORE INTO premiumSupporterGroupPerks
  (groupId, backgroundId, assignedAt, revokedAt)
SELECT g.id, a.id, '2026-08-19T00:00:00.000Z', NULL
  FROM premiumSupporterGroups g
  JOIN premiumBackgroundAssets a
    ON a.id IN (
      'karaoke-floating-orb',
      'karaoke-nordic-amphitheatre',
      'jam-skyline-penthouse',
      'jam-nordic-wood',
      'piano-manor-library',
      'piano-parisian-salon',
      'guitar-british-rock',
      'guitar-venice-beach'
    )
 WHERE g.slug = 'active-supporters'
   AND g.kind = 'automatic'
   AND g.deletedAt IS NULL;
