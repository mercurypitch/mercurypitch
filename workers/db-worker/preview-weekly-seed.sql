-- PR-preview-only weekly challenge fixtures.
--
-- Keep one current challenge and one closed challenge available in the shared
-- preview database so challenge UI branches can be exercised without touching
-- the dev or production rotations. Stable ids preserve preview attempts across
-- rebuilds; each deployment moves the fixture windows to the current UTC week.

INSERT INTO weeklyChallenges (
  id,
  createdAt,
  updatedAt,
  slug,
  title,
  description,
  featType,
  voiceTypeSplit,
  difficulty,
  targetItems,
  targetScore,
  hearItUrl,
  startsAt,
  endsAt,
  rewardBadgeId,
  founderScore,
  founderTrace,
  evergreen,
  status,
  resultsJson
)
VALUES (
  'preview-weekly-vincero',
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
  'preview-nessun-dorma-money-note',
  'The Impossible Note: Vincerò',
  'Hold Puccini''s soaring B4 on “Vincerò” — the tenor money note. Match the rise and land it clean.',
  'money-note',
  NULL,
  'advanced',
  '[{"id":1,"note":{"midi":67,"name":"G","octave":4,"freq":391.99543598174927},"duration":1,"startBeat":0},{"id":2,"note":{"midi":69,"name":"A","octave":4,"freq":440},"duration":1,"startBeat":1},{"id":3,"note":{"midi":71,"name":"B","octave":4,"freq":493.8833012561241},"duration":1,"startBeat":2},{"id":4,"note":{"midi":71,"name":"B","octave":4,"freq":493.8833012561241},"duration":1,"startBeat":3},{"id":5,"note":{"midi":71,"name":"B","octave":4,"freq":493.8833012561241},"duration":1,"startBeat":4}]',
  70,
  'https://www.youtube.com/watch?v=cWc7vYjgnTs',
  strftime(
    '%Y-%m-%dT00:00:00.000Z',
    'now',
    '-' || ((CAST(strftime('%w', 'now') AS INTEGER) + 6) % 7 + 7) || ' days'
  ),
  strftime(
    '%Y-%m-%dT00:00:00.000Z',
    'now',
    '-' || ((CAST(strftime('%w', 'now') AS INTEGER) + 6) % 7) || ' days'
  ),
  NULL,
  NULL,
  NULL,
  1,
  'closed',
  NULL
)
ON CONFLICT(id) DO UPDATE SET
  updatedAt = excluded.updatedAt,
  title = excluded.title,
  description = excluded.description,
  featType = excluded.featType,
  difficulty = excluded.difficulty,
  targetItems = excluded.targetItems,
  targetScore = excluded.targetScore,
  hearItUrl = excluded.hearItUrl,
  startsAt = excluded.startsAt,
  endsAt = excluded.endsAt,
  evergreen = excluded.evergreen,
  status = excluded.status;

INSERT INTO weeklyChallenges (
  id,
  createdAt,
  updatedAt,
  slug,
  title,
  description,
  featType,
  voiceTypeSplit,
  difficulty,
  targetItems,
  targetScore,
  hearItUrl,
  startsAt,
  endsAt,
  rewardBadgeId,
  founderScore,
  founderTrace,
  evergreen,
  status,
  resultsJson
)
VALUES (
  'preview-weekly-steady-voice',
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
  'preview-steady-voice',
  'Steady Voice',
  'Keep the held note centred — smooth and even from start to finish.',
  'sustain',
  NULL,
  'beginner',
  '[{"id":1,"note":{"midi":60,"name":"C","octave":4,"freq":261.6255653005986},"duration":1,"startBeat":0},{"id":2,"note":{"midi":60,"name":"C","octave":4,"freq":261.6255653005986},"duration":1,"startBeat":1},{"id":3,"note":{"midi":60,"name":"C","octave":4,"freq":261.6255653005986},"duration":1,"startBeat":2},{"id":4,"note":{"midi":60,"name":"C","octave":4,"freq":261.6255653005986},"duration":1,"startBeat":3}]',
  55,
  NULL,
  strftime(
    '%Y-%m-%dT00:00:00.000Z',
    'now',
    '-' || ((CAST(strftime('%w', 'now') AS INTEGER) + 6) % 7) || ' days'
  ),
  strftime(
    '%Y-%m-%dT00:00:00.000Z',
    'now',
    '-' || ((CAST(strftime('%w', 'now') AS INTEGER) + 6) % 7) || ' days',
    '+7 days'
  ),
  NULL,
  NULL,
  NULL,
  1,
  'active',
  NULL
)
ON CONFLICT(id) DO UPDATE SET
  updatedAt = excluded.updatedAt,
  title = excluded.title,
  description = excluded.description,
  featType = excluded.featType,
  difficulty = excluded.difficulty,
  targetItems = excluded.targetItems,
  targetScore = excluded.targetScore,
  hearItUrl = excluded.hearItUrl,
  startsAt = excluded.startsAt,
  endsAt = excluded.endsAt,
  evergreen = excluded.evergreen,
  status = excluded.status;
