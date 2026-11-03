-- 0073_sing_rooms_background_pack.sql — the Sing room's supporter covers.
--
-- 0044 let a `sing` identity exist; this seeds the three supporter covers of
-- the Sing room: Echo Cistern, Snowfall Pavilion, Ghost Light Stage. The free
-- covers (Retro Analog Studio, Rehearsal Attic, Choir Room) ship from
-- `public/sing/` and never appear here.
--
-- Identities and the automatic supporter assignment only, as in 0035 and
-- 0037. An identity is not runtime-visible until Studio publishes a complete
-- revision, so applying this before the art is uploaded adds nothing to the
-- picker.

INSERT OR IGNORE INTO premiumBackgroundAssets
  (id, surface, title, description, status, activeRevisionId, createdAt,
   updatedAt, retiredAt)
VALUES
  ('sing-echo-cistern', 'sing', 'Echo Cistern',
   'Brick vaults over still water, one lantern on the walk.',
   'active', NULL, '2026-11-03T00:00:00.000Z',
   '2026-11-03T00:00:00.000Z', NULL),
  ('sing-snowfall-pavilion', 'sing', 'Snowfall Pavilion',
   'A glass room in snowy pines at blue hour, a lantern lit.',
   'active', NULL, '2026-11-03T00:00:00.000Z',
   '2026-11-03T00:00:00.000Z', NULL),
  ('sing-ghost-light-stage', 'sing', 'Ghost Light Stage',
   'An empty stage after the show, one bare bulb burning.',
   'active', NULL, '2026-11-03T00:00:00.000Z',
   '2026-11-03T00:00:00.000Z', NULL);

-- INSERT OR IGNORE preserves any intentional revocation if this migration is
-- replayed in a persistent preview database.
INSERT OR IGNORE INTO premiumSupporterGroupPerks
  (groupId, backgroundId, assignedAt, revokedAt)
SELECT g.id, a.id, '2026-11-03T00:00:00.000Z', NULL
  FROM premiumSupporterGroups g
  JOIN premiumBackgroundAssets a
    ON a.id IN (
      'sing-echo-cistern',
      'sing-snowfall-pavilion',
      'sing-ghost-light-stage'
    )
 WHERE g.slug = 'active-supporters'
   AND g.kind = 'automatic'
   AND g.deletedAt IS NULL
   AND a.surface = 'sing';
