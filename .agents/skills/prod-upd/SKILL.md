---
name: prod-upd
description: Push the current main branch to production. Reads the latest version from CHANGELOG.md, creates an annotated vX.Y.Z git tag on main's latest commit, and pushes the tag to trigger the automatic production deploy. Use when the user wants to release/deploy/ship to prod (e.g. "/prod-upd", "push to prod", "cut the release").
---

# /prod-upd — push to production

Cuts a production release by tagging `main`'s latest commit. Pushing a
`vX.Y.Z` tag is what triggers the automatic prod deploy (GitHub Actions). This
skill **only pushes a tag** — it never pushes commits, force-pushes, or moves an
existing tag.

Work through the steps in order. If any check fails, **stop and report** instead
of pushing — a bad tag is a prod deploy.

## Steps

1. **Sync `main`.**
   - `git fetch origin --tags --prune`
   - `git checkout main`
   - `git pull --ff-only origin main`
   - Confirm the working tree is clean: `git status --porcelain` must be empty.
     If it isn't, stop and report (don't tag a dirty tree).
   - Confirm local `main` == `origin/main` (the release commit must already be on
     `main` — merge the release PR first).

2. **Read the version** from the newest `CHANGELOG.md` entry.
   - The newest entry is the **first** `## [X.Y.Z] - YYYY-MM-DD` heading in the
     file. Extract `X.Y.Z`; the tag is `vX.Y.Z`.
   - Sanity check: `X.Y.Z` should equal the `"version"` in `package.json`. If
     they differ, **stop and ask** which is correct — do not guess.

3. **Guard against re-tagging.**
   - `git tag -l vX.Y.Z` and `git ls-remote --tags origin vX.Y.Z`.
   - If the tag already exists (locally or remotely), **stop and report**: the
     release is already cut. Bump the version + changelog first.

3b. **Walk the guided tours** (release gate — per AGENTS.md this full walk
runs at release time, not per PR):

- Run the `/tour-check` skill (`pnpm run build:tours`, serve `dist` on
  :3005, then `pnpm run test:tours` and `MOBILE=1 pnpm run test:tours`).
  It must be `build:tours`, never a plain `pnpm run build` — that one bakes
  in `api.mercurypitch.com` and every walk creates junk anonymous users in
  the prod database.
- Compare misses against the known pre-existing list; any NEW `MISS`
  is a release blocker — **stop and report** instead of tagging.

4. **Create the annotated tag** on `main`'s latest commit:
   - `git tag -a vX.Y.Z -m "Release vX.Y.Z"`
     (Use the changelog entry's one-line theme in the message if there's a tidy
     one, e.g. `-m "Release vX.Y.Z — guided tours & mic insights"`.)

5. **Push the tag** (this triggers the prod deploy):
   - `git push origin vX.Y.Z`

6. **Put the Google OAuth secret** — the one manual step the tag cannot do.

   `workers/db-worker/wrangler.jsonc` carries the verified-branding
   `GOOGLE_CLIENT_ID` in the prod vars, and it only reaches the running Worker
   on a deploy. The id and the secret work only as a pair, so prod's Google
   sign-in is down for the gap between the two halves landing — keep the gap
   short by putting the secret the moment the deploy job finishes, not before
   it starts:
   - Watch the **Prod Jam + DB migrations + worker** job
     (`gh run watch --exit-status`). Wait for it to succeed.
   - Then, from the Proton Pass item `mp-oauth-client-secret` (the same secret
     every environment uses):

     ```sh
     pnpm exec wrangler secret put GOOGLE_CLIENT_SECRET \
       --config workers/db-worker/wrangler.jsonc --env prod
     ```

   - Verify: sign in with Google on prod. A mismatched pair fails at Google's
     consent screen with `invalid_client`, so this is visible immediately.

   Do **not** run the put before pushing the tag. That breaks the pair the
   other way round — new secret against the still-deployed old id — for the
   whole build, which is several minutes rather than one.

7. **Check the app moved.** The Worker registers with `updateViaCache: 'none'`
   and Cloudflare serves `/sw.js` as `max-age=0, must-revalidate`, so a client
   revalidates the worker script on the next navigation or tab focus rather
   than waiting out the browser's 24-hour ceiling. To see the new build
   yourself right away: open prod, and the reload prompt appears once the new
   worker has installed — accept it. If it does not appear, the page is already
   on the new build (the worker answers a build-id handshake and adopts a
   same-commit worker silently). DevTools > Application > Service Workers >
   Update forces the check.

8. **Report.**
   - State the tag, the commit SHA it points at, and the deploy run that started
     (`gh run list -L 3` or the Actions URL) so the user can watch it.
   - Say which migrations the deploy applied. This read-only query answers it,
     before and after:

     ```sh
     pnpm exec wrangler d1 execute mercurypitch-db --remote \
       --config workers/db-worker/wrangler.jsonc --env prod \
       --command "SELECT name FROM d1_migrations ORDER BY id DESC LIMIT 5"
     ```

## Notes

- Author/commit identity and "never force-push" rules from project memory still
  apply. Annotated tag only; no `-f`, no re-tagging.
- `main` must contain the release commit before running this. If `main` is
  behind or the version/changelog weren't bumped, do that first (or via the
  release PR), then run `/prod-upd`.
