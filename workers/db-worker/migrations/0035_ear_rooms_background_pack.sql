-- 0035_ear_rooms_background_pack.sql — the Ear Lab's supporter rooms.
--
-- 0034 let an `ear` identity exist; this seeds the four rooms of the Ear
-- Lab's pack (ear-lab-polish-plan Phase 6): Transit Observatory, Bell Loft,
-- Planetarium, Anechoic Booth. The two free rooms (Regulator Room,
-- Glasshouse Bench) ship from `public/` and never appear here.
--
-- Identities and the automatic supporter assignment only, as in 0032 and
-- 0033. An identity is not runtime-visible until Studio publishes a complete
-- revision, so applying this before the art is uploaded adds nothing to the
-- picker.

INSERT OR IGNORE INTO premiumBackgroundAssets
  (id, surface, title, description, status, activeRevisionId, createdAt,
   updatedAt, retiredAt)
VALUES
  ('ear-transit-observatory', 'ear', 'Transit Observatory',
   'A dome slit open to a cobalt sky, Mercury low on the horizon.',
   'active', NULL, '2026-08-27T00:00:00.000Z',
   '2026-08-27T00:00:00.000Z', NULL),
  ('ear-bell-loft', 'ear', 'Bell Loft',
   'Bronze bells at dusk, light through timber louvres.',
   'active', NULL, '2026-08-27T00:00:00.000Z',
   '2026-08-27T00:00:00.000Z', NULL),
  ('ear-planetarium', 'ear', 'Planetarium',
   'A star projector under a ruled dome at blue hour.',
   'active', NULL, '2026-08-27T00:00:00.000Z',
   '2026-08-27T00:00:00.000Z', NULL),
  ('ear-anechoic-booth', 'ear', 'Anechoic Booth',
   'Wedge foam, one chair, a headphone stand in even light.',
   'active', NULL, '2026-08-27T00:00:00.000Z',
   '2026-08-27T00:00:00.000Z', NULL);

INSERT OR IGNORE INTO premiumSupporterGroupPerks
  (groupId, backgroundId, assignedAt, revokedAt)
SELECT g.id, a.id, '2026-08-27T00:00:00.000Z', NULL
  FROM premiumSupporterGroups g
  JOIN premiumBackgroundAssets a
    ON a.id IN (
      'ear-transit-observatory',
      'ear-bell-loft',
      'ear-planetarium',
      'ear-anechoic-booth'
    )
 WHERE g.slug = 'active-supporters'
   AND g.kind = 'automatic'
   AND g.deletedAt IS NULL;
