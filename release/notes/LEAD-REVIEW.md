# Lead review of the 0.9.22 drafts (25 Oct, about 22:15 UTC)

Read in full: CHANGELOG-entry.md, PR-BODY.md, dev-changelog-entry.md (header,
release steps, found-while-preparing, every per-PR section), REACH.md (header,
reach counts, rows for the PRs in two groups). The v1 copies are the writer's.

Verified in code on cddefd571: 8 and 13 minutes (learn/01:344, learn/02:350);
5:35 and 7:19; no microphone on Lessons 1 and 2 (no getUserMedia in lesson-01,
lesson-02, kit); the plan for a week (PLAN_CARD_DAYS 7); five tour steps
(TOUR_STEPS); "Start lesson", "Continue: step N", "Read again"; "Back to your
plan"; Guide opens the plan (PlanLayer.tsx:6); one takeover per visit
(opening-takeover.ts); "Keep going" and "Yes, skip"; Learn back in the sidebar
(0b28df251; v0.9.21 had it in Home's header); LIVE_MERC_WAIT_MS 10 s; what
telemetry.ts sends and its consent rule; after mp-v0.8.42 only #1209, #1201,
#1211 and #1210 merged.

Fixed:
- CHANGELOG: `*What is a note?*` would print its asterisks (the modal renders
  only `_italic_`): now `_..._`. "Nothing listens and nothing is scored" was
  wrong (the quick check shows "N of 4"): now "No microphone needed." The
  Learn bullet said "away from Home's Lessons link": now "back in the sidebar
  ... Home's header has Lessons in its place". The counting bullet named only
  quick checks; Lesson 2's "Recall from Lesson 1" sends too: now "Lesson
  questions ... each quick-check and recall question".
  Stats after: 32 bullets, average 159, longest 313; no line over 78, no em
  dash.
- PR-BODY: the `curl -I https://media.mercurypitch.com/...` check is a
  production request: replaced by the owner's dev pass (dev loads the same
  files, kit/films.ts). "Check production as built" is the owner's. #1147 and
  #1151 sit under admin only, #1150 under the web.
- dev-changelog: the same two production items; "The lead merged it" is now
  "It merged on the owner's go".

Release day: bin/cut.py <worktree> <day> applies everything (both entries,
package.json, datePublished and the head comment on learn/01 and learn/02, the
three sitemap dates); dry run on copies of cddefd571 matched each edit once.
launch-entry-seo.test.ts rejects a sitemap date more than a day past CI's
UTC day, so the date is set on the tag day, not before.

Still for the owner: feedback wording (and "Mercury Pitch" in that line);
the Siren bullet; Home's Lessons link to Lesson 1 or the hub; that the privacy
notice covers #1190's answers and #1193's lesson answers (Cloudflare's logs 7
days, D1 recovery 30), and #1190's ask for a consent legal review; #1134's
funnel on Guitar Night's first paint.
