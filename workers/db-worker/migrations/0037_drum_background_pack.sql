-- 0034_drum_background_pack.sql — Drum Night supporter room pack.
--
-- Seed stable identities and the automatic supporter assignments only. An
-- identity is not runtime-visible until Studio publishes a complete revision,
-- so applying the migration before protected art is uploaded cannot expose a
-- partial room.

INSERT OR IGNORE INTO premiumBackgroundAssets
  (id, surface, title, description, status, activeRevisionId, createdAt,
   updatedAt, retiredAt)
VALUES
  ('drum-blue-hour-live-room', 'drum', 'Blue Hour Live Room',
   'Deep blue windows and warm practicals around a spacious tracking floor.',
   'active', NULL, '2026-08-21T00:00:00.000Z',
   '2026-08-21T00:00:00.000Z', NULL),
  ('drum-bronze-soundstage', 'drum', 'Bronze Soundstage',
   'Smoked bronze walls and focused light in a cinematic drum room.',
   'active', NULL, '2026-08-21T00:00:00.000Z',
   '2026-08-21T00:00:00.000Z', NULL),
  ('drum-rain-glass-studio', 'drum', 'Rain Glass Studio',
   'Rain-patterned glass and amber light around a focused studio floor.',
   'active', NULL, '2026-08-21T00:00:00.000Z',
   '2026-08-21T00:00:00.000Z', NULL),
  ('drum-walnut-live-room', 'drum', 'Walnut Live Room',
   'Walnut diffusion panels and classic recording-studio warmth.',
   'active', NULL, '2026-08-21T00:00:00.000Z',
   '2026-08-21T00:00:00.000Z', NULL),
  ('drum-sunrise-pavilion', 'drum', 'Sunrise Pavilion',
   'Soft morning light across an open modern recording pavilion.',
   'active', NULL, '2026-08-21T00:00:00.000Z',
   '2026-08-21T00:00:00.000Z', NULL);

-- INSERT OR IGNORE preserves any intentional revocation if this migration is
-- replayed in a persistent preview database.
INSERT OR IGNORE INTO premiumSupporterGroupPerks
  (groupId, backgroundId, assignedAt, revokedAt)
SELECT g.id, a.id, '2026-08-21T00:00:00.000Z', NULL
  FROM premiumSupporterGroups g
  JOIN premiumBackgroundAssets a
    ON a.id IN (
      'drum-blue-hour-live-room',
      'drum-bronze-soundstage',
      'drum-rain-glass-studio',
      'drum-walnut-live-room',
      'drum-sunrise-pavilion'
    )
 WHERE g.slug = 'active-supporters'
   AND g.kind = 'automatic'
   AND g.deletedAt IS NULL
   AND a.surface = 'drum';
