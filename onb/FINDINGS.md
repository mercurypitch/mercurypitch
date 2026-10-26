# Onboarding and lesson-linking findings (25 Oct, main cddefd571, local dev, fenced)

Walks: onb/walk.cjs (full track, synthetic 220 Hz voice) -> onb/shots/, onb/walk2.cjs (no voiceprint, Show me around, lessons) -> onb/shots2/. Logs: walk.log, walk2.log. Only request that left 127.0.0.1: one GET to an r2.dev media host, aborted.

## Onboarding
1. Show me around (plan's primary button) starts the Start-here tab's page tour; TAB_SINGING has none (PAGE_TOURS, src/stores/app-store.ts:2025). Singers who skip the voiceprint get Start here = Sing -> lands on #/singing, no tour (shots2/04).
2. Failed range read counts as narrow range: pickFirstStop (src/features/onboarding/first-stop.ts) sends semitones < 12 to RANGE_STOP, incl. 0; the twin withholds the twin for the same read (singerForRange null, BeatTwin.tsx:43-66) and says "couldn't get a clean read". Plan then says "There's more voice up there than you're using" + "Your voiceprint" chip; Keep asks to keep "A3 to A3"; twin offers "Share now". (shots/11, 12, 17). Only tested with a steady synthetic tone.
3. Plan's biggest button is Show me around, not the recommended first stop (shots/17, shots2/02).
4. With a voiceprint, the Start-here reason drops the how: "You said telling if you're getting better is the hard part" with no answer (shots/17); without one it answers ("Every take lands in Progress, so you can watch the line move", shots2/02).
5. The Map omits the lessons (rooms: Ascent, Practice, Exercises, Karaoke, Jam, Analysis; also Challenges, Guitar, Piano, Voice Mirror) (shots/19, walk.log).
6. Full track ~14 screens, ~3 min to the app. Read #1134's funnel before cutting; Keep is the likely cut.
7. Learn card's cover crops the title to "at is a no" (shots2/03). Lesson 1's "?" sits on the "Sound" chip at 390 px (shots2/05).
8. Home's Lessons pill is a button, not a link; opens /learn/01 for everyone (W-01).

## Linking
1. Lesson pages never link /learn/: rendered L1 links = /mirror?lesson=01, /learn/02 (next card), /#/plan, /, legal (walk2.log). BreadcrumbList names the hub; no visible link.
2. L1 -> L2 exists only after script (next card); learn/01.html has no static /learn/02 or /learn/ link. Non-rendering crawlers (Bing partly, GPTBot, ClaudeBot, Perplexity) miss it. Use data-if-live for static prev/next + breadcrumb.
3. Rooms link every released lesson in the nav (tools/lesson-links.ts, navLinksFor); SEARCH.md 8's contextual per-room links still [next].
4. Hub links every lesson (built by tools/learn-hub.ts); fine.
