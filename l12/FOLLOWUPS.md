- L12-C2 review (25 Oct): AdminLessonsPage.publish.test.tsx renders the whole page under Vitest's 5 s default and runs near it (builder's note): under TESTING.md's 3x floor. Give it an explicit timeout with its reason, as the order test does, or cut its cost.
- L12-C2 owner questions, for its PR: "Use default" publishes without asking; Lesson 3's recall of Lesson 2 and Lesson 8's of Lesson 6 are outside PREREQ.
- Rooms review (25 Oct), for the page task: a second key switch while a turn runs jumps. Ignore switch taps while a turn runs, or pass the turn's starting place into the next turn.
- Rooms review (25 Oct), for the page head task: the spec's share-card alt at WEB-SPEC :918-920 is stale. Use the real heads: "The title card: Find Your Pitch, Lesson 12, Chords and the four-chord song, above four chord shapes on a ring of twelve notes, between Merc and Tavi."
- Rooms review (25 Oct), for the page task: the roots line and the moves readout are the page's (PLAN :927, Step 4: Play the loop and Play the roots, with the moves readout and Slow, in l12/rooms.ts and main.ts); the painter draws neither.
- Rooms review (25 Oct), for the page's screenshots: check the corner count's place under the ring at the compact sizes.

## From the sing-layout review (25 Oct)
- The Sing it flow's AFTER and HINT lines sit in lesson-12/sing-flow.ts, not lines.ts (Lesson 10 keeps AFTER in lines.ts): move at page time if wanted.
- Compact layout at 844 x 390: chips 440 px, buttons get 330 px beside them; the page checks its step buttons fit.
- Tab order: spec says buttons, switches, chips; the layout draws chips first. The page decides.
- Higher voice chords at the loop's own pitch: FACTS 73 says nothing about the octave; confirm with the spec owner or the coach.

## From page run 2's review (28 Oct)
- In G, the halo and the room lines round F♯'s corner cross the kit's "F♯" name beside its bead (page-2/step2-G-390x844.png). Legible; a painter change: a plate under a corner's name, or the edges stopping short of it. Run 3, with the tune toy.
- The names switch shows on Step 3 only, and its choice holds on Steps 1, 2, 4 and 5 (spec; Lesson 10 the same). If the owner or the coach finds Do-re-mi stuck on Step 4 with no switch, show it on Steps 3 and 4 (data-part "3 4") and re-measure the stage fit.
- page-dom fixtures: the Step 3 tab-order spec reads the slide button by its text; its accessible name is now pinned in the slide test.
