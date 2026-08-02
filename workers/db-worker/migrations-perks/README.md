# migrations-perks — APPLIED BY HAND, not by CI

This chain belongs to the shared `mercurypitch-perks` database. **Nothing
applies it automatically.** `deploy-db.yml` runs

```
wrangler d1 migrations apply ${{ env.DB_NAME }} --remote --env <env>
```

which names the *main* database only. Adding a file here and merging will
deploy a worker that expects a schema the database does not have.

That is worth stating loudly because it is exactly the failure the tracked
migrations system was introduced to end: `deploy-db.yml`'s own header
describes the era when schema changes "silently did nothing" and every
change had to be remembered and run by hand. For this one database, that
era is still on.

## Applying a new migration

```bash
cd workers/db-worker
pnpm exec wrangler d1 migrations apply mercurypitch-perks --remote
```

One command, no `--env`: dev and prod share this database, so it has one
schema and is migrated once. `wrangler` records applied files in
`d1_migrations`, so re-running is safe.

Verify afterwards:

```bash
pnpm exec wrangler d1 execute mercurypitch-perks --remote \
  --command "SELECT name FROM sqlite_master WHERE type='table'"
```

## Why it is not wired into CI

Applying this chain from a pipeline means a **dev** deploy writes schema to
a database **prod** reads — the two share one D1 by design, so there is no
dev-only copy to practise on. That crosses the project's "never touch
prod" line, so it stays a deliberate manual step rather than something a
merge does on your behalf. Automate it only alongside a decision about
which pipeline owns this database.

## Current state

`0001_perkGrants.sql` is applied. Confirm before assuming:

```bash
pnpm exec wrangler d1 execute mercurypitch-perks --remote \
  --command "SELECT * FROM d1_migrations"
```
