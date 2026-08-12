-- 0025_song_manifests.sql — what songs a person HAS, without any audio.
--
-- The library is the karaoke UVR sessions: separated songs with their
-- stems, lyrics and analysis. All of that is device-local by design and
-- stays that way — uploaded audio is user-supplied copyrighted material
-- and never rests on our servers (docs/plans/device-sync.md, Context).
--
-- What can travel is the LIST. Title, duration, which stems exist and how
-- big they are: kilobytes per song, no audio, no copyright exposure. With
-- it, signing in on a phone shows the whole library — every song listed,
-- greyed out until its audio arrives by some transport that is not this
-- table. Without it there is nothing to show and nothing for a transport
-- to diff against.
--
-- Keyed by fileHash, not by session id. The hash is the same song on every
-- device (it is the SHA-256 of the original file, already computed on
-- separation); a session id is one device's record of having separated it,
-- and two devices that separated the same file would otherwise appear to
-- own two different songs.

CREATE TABLE IF NOT EXISTS songManifests (
  id TEXT PRIMARY KEY,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  userId TEXT NOT NULL,
  -- SHA-256 of the original file: the song's identity across devices.
  fileHash TEXT NOT NULL,
  -- What the library shows. Today that is the uploaded file's name.
  title TEXT NOT NULL,
  durationSec REAL,
  -- The quality the AUDIO was last shared at, so a device holding a
  -- reduced copy can say so rather than letting a singer conclude the
  -- separation is broken: 'lossless' | 'portable-192' | 'portable-128'.
  -- A song separated on a device is lossless there by definition.
  quality TEXT NOT NULL DEFAULT 'lossless',
  -- JSON Record<stem, { bytes?: number }> — which stems exist and their
  -- size, so a phone can show what a download would cost before starting.
  stemsJson TEXT,
  -- Whether words exist for it, so the list can say "has lyrics" without
  -- carrying them.
  hasLyrics INTEGER NOT NULL DEFAULT 0
);

-- One row per song per person. A re-publish of the same song updates in
-- place instead of accumulating a row per separation.
CREATE UNIQUE INDEX IF NOT EXISTS idx_songManifests_user_hash
  ON songManifests (userId, fileHash);

CREATE INDEX IF NOT EXISTS idx_songManifests_user_updated
  ON songManifests (userId, updatedAt);
