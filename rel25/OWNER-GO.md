**0.9.25 is a go. Tag main `b803c7d43`.**

0.9.25 is the two coach fixes from your 0.9.24 walk:
- **Play the note** stays where you tapped it. Its line now comes under the button.
- **The first-time mic offer** no longer covers Merc's tour. It waits until he's done, and one already showing goes away when he starts.

Everything else since v0.9.24 is in the native test builds or CI only, so the web app gets nothing else. Dev has run this exact commit since 22:19 UTC.

**Release checks on `b803c7d43`:**
- #1248 merged by rebase. Main's tree is byte-for-byte the head that passed CI on the PR.
- CHANGELOG.md and package.json both say 0.9.25. The entry has 2 bullets averaging 175 characters and is dated 2026-10-28.
- No v0.9.25 tag exists yet, locally or on GitHub.
- Guided tours (Release Tours run 18) on this commit: 144 steps on desktop and 127 on a phone, each with a visible spotlight and none breaking a rule. The 4 steps that need a cloud board were skipped, as always.
- Main's own runs on this commit: PR Gate (all 73 jobs), the dev deploy, both mobile build runs and the games build. All green.
- No database migration, no new secret or setting, and no landing release needed first.

Nothing in this release needs a manual test from you. Tests cover both fixes: Play the note is checked at 320 and 1440 px, and the mic offer has unit tests that fail without the fix.

**Tag commands, for him:**

```
git fetch origin --tags --prune
git checkout main
git pull --ff-only origin main
git status --porcelain                 # must print nothing
git rev-parse HEAD                     # must print b803c7d4357f0693e8517cd27e8f9651186d0bb4
git tag -l v0.9.25                     # must print nothing
git ls-remote --tags origin v0.9.25    # must print nothing
git tag -a v0.9.25 -m "Release v0.9.25: Play the note stays put, and the mic offer waits for Merc"
git push origin v0.9.25
```

If `rev-parse` prints anything else, main has moved, so stop and tell me. The notes are dated 28 Oct. If the tag goes out after midnight UTC, the date is a day early, which only shows in the app's changelog, so I'd leave it. The push starts the production deploy and a second tours walk. I'll watch both and report once.
