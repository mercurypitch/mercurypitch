0.9.22 is ready for your privacy check and the tag. Main is at a6f839e14, the release commit. Nothing has merged after it, and there is no v0.9.22 tag yet.

**What merged**

| PR | What it does |
| --- | --- |
| #1216 | Links between the lessons, in the HTML the server sends. Each lesson page has a trail back to the season page and links to the lessons before and after it. The room pages name their lesson. |
| #1217 | The onboarding fixes, with nothing removed. Start here is now the main button; Show me around, See every room and Not now are all still there. A range read that wasn't clean is no longer treated as a narrow range. Home's Lessons link opens the lesson the visitor is on. See every room shows a Lessons door and a Lessons card. Your tablet problem is fixed: the lesson picture shows in full, and the plan uses the tablet's full width. |
| #1218 | The release notes and the version number. The CHANGELOG entry is 33 bullets. The dev changelog is updated, the version is 0.9.22, and the lesson dates are 2026-10-26. |

**What I checked**

Every check below ran on exactly the code that will be tagged.

- **Automated checks on the release PR:** 85 of 86 passed, including PR Gate. The 86th is the production deploy, which is always skipped on PRs.
- **Release steps 1 to 4:** all pass.
  - Main matches the code I tested.
  - CHANGELOG and package.json both say 0.9.22.
  - There is no v0.9.22 tag yet.
  - The guided tours run on main passed: 144 desktop steps and 127 phone steps, 0 missed.
- **Browser walk with sound:** 78 checks, 0 failed. It covered:
  - First Light, with a held tone and with a sung sweep
  - the plan at six screen widths
  - Keep
  - the Map's Lessons door and card
  - Home's Lessons link
  - Lessons 1 and 2, including their tours, the tones, and both films with captions
  - the season page
- **Layout sweep:** 108 screens (phone and desktop, light and dark mode), 0 failures. It raised 72 warnings, all in code that hasn't changed since 0.9.21.

**For you to do before the tag**

1. **Privacy:**
   - There's one new tracking event name, onboarding_map_door_lessons. It's sent the same way as the other Map doors' events.
   - The privacy notice on the landing site needs to cover the survey answers (#1190) and the lesson quiz answers (#1193).
2. **Two wording decisions:**
   - The Siren bullet in the release notes.
   - The feedback form's "No account needed." The form also spells the name "Mercury Pitch" as two words.
3. **Films:** check that both films play on dev.
4. **Dates:** they're set to 2026-10-26. If the tag slips a day, tell me first and I'll move them.

Then tag main a6f839e14 as v0.9.22 and push the tag. Release steps 5 to 7 are yours.

**Worth knowing**

- **Show me around and the Singing tour:** Singing's tour lives in the Guide's Singing section, not with the other page tours. So when Start here is Singing, Show me around opens the page without starting a tour. It's a small fix, and I've listed it in the test doc for 0.9.23 if you agree.
- **#1215:** another agent's fix for native karaoke. It isn't in 0.9.22 unless it merges before the tag, and then it needs its release notes first.
- **#1203:** Merc leading the tours. It needs a rebase onto the new plan buttons from #1217.
- **#1135:** replaced by #1218. You can close it.
- **Lesson header logo:** on narrow phones and medium widths, it gives way to the "?" button (#1216). Reverting that is one CSS rule if you want the logo back.
- **Small fixes for 0.9.23:**
  - After a range read that wasn't clean, Keep still says "Your voiceprint and range, saved".
  - The fifth Map door wraps onto a new line on phones.
  - Lessons 6 and 7 (still drafts) each have a small layout fault. I'll fix both before you publish them.
- **Publishing from the console:** a lesson you publish there doesn't become Home's Lessons target until a release includes it.

**After your tag**

1. I watch the tag's deploy and tours runs and tell you when they're green.
2. I merge the waiting PRs in this order: #1198, #1199, #1207, #1208, #1206, #1205, #1212, #1213 (once you OK its release note), #1214.
3. I run the next Lesson 9 page step.
4. I start the 0.9.23 value work: the weekly Check-up offered with an account, and the then-and-now card.

The test doc has these results in a new "Checked before the tag" section: https://claude.ai/artifact/UWLsxnKVK9B2n4r2bJ9a9U
