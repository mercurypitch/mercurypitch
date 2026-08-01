# Legacy pre-migration scripts

These `migrate-*.sql` files predate the tracked migration chain in
`workers/db-worker/migrations/` and are kept as **one-time prerequisites for
databases created before that chain existed**.

`0001_baseline.sql` bootstraps a fresh database with every column already in
place, but its `CREATE TABLE IF NOT EXISTS` statements are no-ops against an
existing table — they cannot add a column to a deployed database that missed
one of these hand migrations. `0002_sessionRecords_source.sql` additionally
*requires* `sessionRecords.weeklyChallengeId` to exist (its backfill reads
it), which only `migrate-sessionRecords-add-weeklyChallengeId.sql` adds on an
old database.

Before the FIRST `wrangler d1 migrations apply` against a pre-chain deployed
database (dev or prod):

1. Check the live shape (read-only):

       wrangler d1 execute <DB_NAME> --remote \
         --command "PRAGMA table_info(users); PRAGMA table_info(userProfiles); PRAGMA table_info(sessionRecords);"

2. For every column below that is missing, run the matching script with
   `wrangler d1 execute <DB_NAME> --remote --file=scripts/<file>`:

   | Script | Adds |
   |---|---|
   | migrate-users-add-tokenVersion.sql | users.tokenVersion |
   | migrate-users-add-stripeCustomerId.sql | users.stripeCustomerId |
   | migrate-users-add-lastActiveAt.sql | users.lastActiveAt |
   | migrate-userProfiles-add-streak-freeze.sql | userProfiles streak/freeze columns |
   | migrate-sessionRecords-add-weeklyChallengeId.sql | sessionRecords.weeklyChallengeId |
   | migrate-add-emailVerifications.sql | emailVerifications table |

3. Confirm none of the *chain-owned* columns exist yet
   (`sessionRecords.source`, `userProfiles.leaderboardOptIn` /
   `friendCode` / `currentLeagueId`, `leaguePointEvents.sourceId`): if one
   was added by hand during development, the corresponding `ALTER` in the
   chain will fail with `duplicate column name`. Recovery: mark that file as
   applied by inserting its name into `d1_migrations`, or restore via
   `wrangler d1 time-travel`.

Fresh databases never need any of this — the chain alone is complete.
