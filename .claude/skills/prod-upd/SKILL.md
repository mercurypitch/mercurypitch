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

4. **Create the annotated tag** on `main`'s latest commit:
   - `git tag -a vX.Y.Z -m "Release vX.Y.Z"`
     (Use the changelog entry's one-line theme in the message if there's a tidy
     one, e.g. `-m "Release vX.Y.Z — guided tours & mic insights"`.)

5. **Push the tag** (this triggers the prod deploy):
   - `git push origin vX.Y.Z`

6. **Report.**
   - State the tag, the commit SHA it points at, and the deploy run that started
     (`gh run list -L 3` or the Actions URL) so the user can watch it.
   - If a DB migration is pending for this release (check project memory, e.g.
     the prod-db-migration note), surface it now — a tag deploy ships code, not
     schema.

## Notes

- Author/commit identity and "never force-push" rules from project memory still
  apply. Annotated tag only; no `-f`, no re-tagging.
- `main` must contain the release commit before running this. If `main` is
  behind or the version/changelog weren't bumped, do that first (or via the
  release PR), then run `/prod-upd`.
