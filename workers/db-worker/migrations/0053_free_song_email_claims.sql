-- The native app's free song, once a month per confirmed email address
-- (src/free-song-email.ts). A claim on the month's free song is a ledger
-- row, and deleting an account deletes its ledger rows (USER_OWNED_TABLES in
-- auth.ts). So a claim also writes a row here, in the same batch: the month,
-- and a code of the account's confirmed email, HMAC-SHA256 keyed with the
-- Worker secret FREE_SONG_EMAIL_SECRET. A row holds no email and no account
-- id, so it stays when the account goes: an email with a row for the month
-- gets no free song that month on an account that made no claim of its own.
-- It is pseudonymous, not anonymous: with the secret, the Worker can code a
-- known address and find its row.
--
-- A row is kept for its month: the cron deletes the rows of earlier months.
--
-- Nothing is back-filled: the code needs the secret, which SQL does not
-- have. A claim made before this table existed, or while the secret is
-- unset, has no row, so the month it falls in stays bounded per account.
--
-- Purely additive: the shared preview database carries other branches'
-- migrations, and one new table changes nothing they wrote.
CREATE TABLE IF NOT EXISTS freeSongEmailClaims (
  month TEXT NOT NULL,
  emailHash TEXT NOT NULL,
  PRIMARY KEY (month, emailHash)
);
