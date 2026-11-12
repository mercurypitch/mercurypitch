// First-paint budgets: what each emitted document makes a browser download
// before it can run.
// ============================================================
//
// Run after a build:
//   node scripts/assert-first-paint-budgets.mjs [dist]            fail on a breach
//   node scripts/assert-first-paint-budgets.mjs [dist] --report   print the table
//
// A standalone page is only standalone if its static graph is. One shared
// helper placed in a heavy chunk is enough to make a 300 KB page download the
// whole app, and nothing about the page looks different: it still renders,
// its tests still pass, it is just slow on a phone. Piano Night and Drum
// Night have audits that name what must not be in their graph. This one does
// not name anything. It weighs every document the build emits, so the next
// regression fails the build whichever page it lands on -- including a page
// nobody has written an audit for yet.
//
// The number is the uncompressed size of every JavaScript file reachable
// from the document through its own <script> tags and then STATIC import
// edges only. Dynamic imports are deliberately outside it: intent-loaded
// code is supposed to be there, and is not first-paint work.
//
// Stylesheets are weighed separately, against their own table. A render-
// blocking <link rel="stylesheet"> stops the first paint just as a script
// does, and this build emits one 871 KB sheet that five documents link --
// the global stylesheets imported from src/index.tsx, which #379 tracks. A
// JS-only budget could not see it grow, and could not see it land on a page
// that has no business paying for it. Two tables rather than one sum,
// because the diagnosis differs: a JS breach means an import dragged a
// feature in, a CSS breach means a global sheet grew or reached a page it
// should not have.
//
// A third list is not about weight. Some modules are small enough to hide
// under any page's ceiling and are still meant to load only on demand: the
// key-change engine is 111 KB that a song played in its own key never needs,
// and the lessons' team notes are nearly 3 KB that no learner ever reads.
// Each first-paint chunk's source map says what it was built from, and a
// module on that list fails the build on whichever page it lands.

import { readdir, readFile, stat } from 'node:fs/promises'
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(SCRIPT_DIR, '..')

/**
 * Ceilings, in KB of uncompressed JavaScript, per emitted document.
 *
 * Set from a measured build with about a quarter of headroom, so ordinary
 * growth does not trip them and a swallowed feature (hundreds of KB to
 * several MB, every time it has happened) cannot fit under them.
 *
 * A breach means one of two things. The page really grew: raise its number
 * here, in the same change, and say why in the commit. Or something dragged
 * a feature into its graph: the report names the heaviest chunks, and the
 * fix is in the import, not in this table.
 */
export const FIRST_PAINT_BUDGETS_KB = {
  // The rooms that were built to stand alone. Measured 298 and 505.
  'piano-night.html': 375,
  'drum-night.html': 640,

  // The Cast receiver, the stage on a Cast device: the stage's renderer and
  // the receiver, nothing of the app. Measured 40 on 2026-11-06. Google's
  // Web Receiver SDK, which it also loads, comes from gstatic and is not
  // weighed here.
  'cast-receiver.html': 50,

  // The Voice Mirror and the three pages that open it. Measured 344 -- and
  // 3149 before the broad manualChunks rules were deleted, which is the
  // regression this table exists to catch. Grown with the rooms since, to
  // 440,444 B on 2026-11-07, when the voice-type and singer-match doors and
  // the questions kept in the room (#1379) took it 124 B past 430: real
  // pages, so 440, still far under any swallowed feature.
  'mirror.html': 440,
  'vocal-range-test.html': 440,
  'voice-type-test.html': 440,
  'which-singer-has-my-vocal-range.html': 440,

  // Measured 331 (was 3050).
  'glass.html': 420,

  // The 3D museum campaign is a separate entry from the legacy glass page.
  // Measured 1159 KB including Three.js; unrelated rooms must not inherit it.
  'glass-game.html': 1450,

  // Karaoke Night and its three other doors. Measured 352 (was 3063), and
  // 361 for all four on 2026-10-19.
  'karaoke-night.html': 440,
  'karaoke.html': 440,
  'vocal-remover.html': 440,
  'karaoke-app.html': 440,

  // Measured 1432 (was 3822). Most of it is the room itself.
  'guitar-night.html': 1800,

  // Find Your Pitch, Lesson 1: the lesson's own module, the shared lesson
  // kit and Vite's helper. Measured on 2026-10-20: 114 once the Series
  // blueprint left the page, 125 with the masthead's lesson menu that every
  // lesson page carries (kit/lesson-menu.ts, about 10 KB), the budget a
  // quarter over that as Lessons 2 to 5 were set, and 127 with the Wrap's
  // next-lesson card (kit/next-card.ts). Merc's renderer arrives through a
  // dynamic import, so the page stays this light only while that boundary
  // holds.
  'learn/01.html': 155,
  // Lesson 2, "Twelve notes": its own module on the same kit. Measured 146
  // with the lesson menu and the next-lesson card (131 before them); the
  // renderer is the same dynamic import as Lesson 1's.
  // Raised to 168 for the seasons: 168,139 bytes on main before them,
  // 171,657 with them, against 171,008 at 167. None of it is Season 2's data, which
  // loads only when the explorer's Season 2 tab opens (the forbidden list
  // below): it is the kit's code for seasons, the explorer's tabs and its
  // column of the season before, a close per season that follows the
  // visit's ending, and the masthead's season from the lesson, on every
  // lesson page.
  // Raised to 169 for Lesson 14's page: 171,335 bytes on main before it,
  // 172,282 with it, against 172,032 at 168. About 500 of the 947 are on
  // every lesson page: the kit's noise, which now hands back a voice a page
  // can stop like any other (kit/sound.ts), and Lesson 14's season entry,
  // with its page and minutes, and its drafts line. The rest is the slide
  // guide's breath mark, drawn now by kit/breath-mark.ts, which every
  // figure with a breath shares, and the modules Lesson 2 shares with
  // Lesson 14 regrouped into chunks of their own.
  // Raised to 170 for Lesson 17's page shell: 172,820 bytes on main before
  // it, 173,376 with it, against 173,056 at 169. 237 of the 556 are on
  // every lesson page: Lesson 17's tease and its alternative
  // (kit/lesson-copy.ts, 158) and its drafts line (79). The other 319 are
  // the kit's predict, quiz and glyphs (kit/predict.ts, quiz.ts, glyphs.ts)
  // in a chunk of their own again, with its preload and imports, since the
  // shell loads none of them (353), less 34 of the minifier's renaming. The
  // chunk goes once Lesson 17's cold open and quizzes load them, and 169
  // can be tried then.
  // Raised to 171 for Lesson 23's page: 173,849 bytes on main before it,
  // 174,275 with it, against 174,080 at 170. The 426 are what every lesson
  // page carries for it: Lessons 23's and 24's teases and their
  // alternatives (kit/lesson-copy.ts, 353) and Lesson 23's drafts line (73).
  // Merc's vibrato option (kit/sound.ts, Lesson 22's) adds 397 to every
  // lesson page: 174,705 bytes before it, 175,102 with it, 2 under 171.
  // Lesson 22's steps took 76 back, the bundler's renaming in the kit's
  // chunk this page shares: 175,026, 78 under.
  // Raised to 172 for Lesson 24's page shell: 175,026 bytes on main before
  // it, 175,533 with it, against 175,104 at 171. 318 of the 507 are on
  // every lesson page: Lesson 25's tease and its alternative
  // (kit/lesson-copy.ts, 174) and Lesson 24's drafts line (144). The other
  // 189 are the bundler cutting the kit's shared code differently around a
  // shell that loads the reveal but not the predict, as Lesson 22's shell
  // did: bytes no module owns (141), a chunk's overhead (44) and the
  // predict's code moved into the reveal's chunk (6), less 2 of the
  // minifier's renaming. Lesson 24's steps and cold open, loading the
  // predict, took 43 of them back: 175,490, still 386 over 171.
  // Raised to 173 for Lesson 3's film: 175,978 bytes in build:e2e on main
  // before it, 176,322 with it, against 176,128 at 172. All 344 are on
  // every lesson page: Lesson 3's sources in kit/films.ts (139) and its
  // film, running time and poster figure in kit/season.ts (205).
  // Lesson 21's page shell added 496 bytes on main before the film (175,978
  // to 176,474). 311 of them are on every lesson page: Lesson 21's tease
  // and its alternative (kit/lesson-copy.ts, 188) and its drafts line
  // (123). The other 185 are the bundler cutting the kit's shared code
  // differently around a shell that loads the reveal but not the predict,
  // as Lesson 24's shell did; they come back once Lesson 21's cold open
  // loads the predict. 173 holds the film and the shell.
  // Raised to 174 for Lesson 20's page shell: 176,901 bytes before it,
  // 177,178 with it, against 177,152 at 173. About 90 of the 277 are on
  // every lesson page: Lesson 20's drafts line (kit/drafts.ts). The rest
  // are the bundler cutting the kit's shared code differently around a
  // shell that loads the reveal but not the predict, as Lesson 18's shell
  // did; 173 can be tried again once Lesson 20's cold open loads the
  // predict.
  // Back to 173 with Lesson 20's cold open, which loads the predict:
  // 177,002 bytes in build:e2e.
  'learn/02.html': 173,

  // Lesson 3, released on the owner's word on 7 November 2026 and built in
  // every mode like the rest: the site worker decides where it is live
  // (src/lesson-gate.ts). Measured 117 with the lesson menu and the
  // next-lesson card (100 before them), and 124 once the page read the state
  // it was served with (kit/page-state.ts, about 3 on every lesson page). The
  // listener, the pitch detector and Voice Mirror's scorer arrive
  // through a dynamic import when Sing it's Start is pressed, and the band
  // edges sit in their own leaf chunk, so the page stays this light only
  // while both boundaries hold. Raised to 126 when the console gained
  // Lesson 11's alternative hook: 127,944 bytes on main before it, 128,192
  // with it, against 128,000 at 125. Every lesson page carried the season's
  // copy, each alternative's text and its console note included. Raised to
  // 127 for Lesson 7's page: 128,708 bytes on main before it, 129,140 with
  // it, against 129,024 at 126. All 432 bytes are Lesson 7's: its season
  // entry and drafts line (122, on every lesson page), the "ng" and
  // lip-trill hook in kit/sound.ts (36), and the two modules it shares with
  // this page, Lesson 3's questions and the warm-up's contour, each now a
  // chunk of its own (274). The console's notes and the signatures have
  // since left every lesson page for kit/team-notes.ts. Raised to 128 for
  // the release review's fixes: 129,702 bytes on this branch before them,
  // 130,362 with them, against 130,048 at 127. All 660 bytes are the kit's,
  // and Lesson 4 gains the same: the status line's words read from a copy
  // and emptied once spoken, and the toast's, deck's and explorer's fixes.
  // Raised to 129 for the handoff's follow-ups: 129,977 bytes on main before
  // them, 131,255 with them, against 131,072 at 128. 1,090 of the 1,278 are
  // the kit's, on every lesson page: the frame loop, the explorer and Sing
  // it's ring resting when nothing moves (kit/frame-loop.ts 432, explorer.ts
  // 351, sing.ts 85), the sound gate keeping its height (page-chrome.ts,
  // 116) and the sound-off lines (sound.ts, 104), 2 more the minifier's
  // renaming. The other 188 are this page's: Sing it's fixes for a take cut
  // short by leaving (lesson-03/sing.ts, 153), the rest card's
  // (kit/comfort.ts, 25) and renaming.
  // Raised to 130 for the lesson answer events (#1193): 131,785 bytes on main
  // before them, 132,272 with them, against 132,096 at 129. 447 of the 487
  // are the kit's, on every lesson page: the quiz's first-answer check and
  // the import that loads the answer beacon on a first answer (kit/quiz.ts,
  // 183), and that import's preload list (264). The other 40 are this
  // page's: the listener's preload list names the consent regions, which
  // have a chunk of their own so that the beacon does not bring pitch-core
  // (vite.config.ts).
  // Raised to 131 for Lesson 9's page shell: 132,918 bytes on its branch
  // before it, 133,324 with it, against 133,120 at 130. 86 of the 406 are
  // Lesson 9's season entry and drafts line, on every lesson page. The
  // other 320 were the kit's predict, quiz and hero sky (kit/predict.ts,
  // quiz.ts, hero-sky.ts) in a chunk of their own, which went once Lesson
  // 9's cold open and quizzes loaded them; yet 133,409 bytes still need
  // 131. Lesson 9 loads only some of the modules this page shares, so each
  // group splits, with a preload and imports of its own: the voice choice
  // leaves the comfort check's chunk (kit/voice-choice.ts, comfort.ts),
  // the band chart leaves the folds' (kit/band-chart.ts, folds.ts), and
  // Merc and Tavi's two images, which Lessons 1 to 8 import and Lesson 9
  // does not, keep a chunk of their own. Each merges again once Lesson 9
  // loads the rest, and 130 can be tried then.
  // Raised to 132 for Lesson 12's page shell: 133,947 bytes on its branch
  // before it, 134,468 with it, against 134,144 at 131. 219 of the 521 are
  // Lesson 12's season entry, with its page, minutes and practice link, and
  // its drafts line, on every lesson page. The other 302 are the kit's
  // predict, quiz and hero sky (kit/predict.ts, quiz.ts, hero-sky.ts) in a
  // chunk of their own again, with its preload and imports, since Lesson
  // 12's shell loads none of them, as Lesson 10's did. Once its cold open
  // and quizzes load them (the hero sky through kit/still-sky.ts), the chunk
  // goes, to about 134,166 bytes: 22 over 131, so 131 comes back only once
  // 22 more are found.
  // Raised to 133 for Lesson 13's page shell: 134,988 bytes before it,
  // 135,251 with it, against 135,168 at 132. The 263 are Lesson 13's season
  // entry, with its page, minutes and Voice Mirror link, and its drafts
  // line, on every lesson page, in the chunks Lesson 3 loads them in.
  // Lesson 11's page shell adds its own entry, with its page, minutes and
  // practice link, and its drafts line: 235 bytes more, which 133 holds.
  // Raised to 137 for the seasons: 135,744 bytes on main before them, 139,262
  // with them (136 would leave 2 bytes). None of it is Season 2's data, which
  // loads only when the explorer's Season 2 tab opens (the forbidden list
  // below): it is the kit's code for seasons, the explorer's tabs and its
  // column of the season before, a close per season that follows the
  // visit's ending, and the masthead's season from the lesson, on every
  // lesson page.
  // Raised to 138 for Lesson 17's page shell: 140,004 bytes on main before
  // it, 140,563 with it, against 140,288 at 137. 237 of the 559 are Lesson
  // 17's tease, its alternative and its drafts line, on every lesson page,
  // as on Lesson 2; the other 322 are the kit's predict, quiz and glyphs in
  // a chunk of their own again (356), less 34 of the minifier's renaming,
  // and 137 can be tried once Lesson 17 loads them.
  // Raised to 139 for Lesson 19's steps: 141,228 bytes before them, 141,376
  // with them, against 141,312 at 138. All 148 are the bundler's: Lesson 19
  // loads the kit's voice choice without the sung part's comfort check, so
  // the voice choice moves to a chunk of its own, and every lesson page that
  // loads both carries its glue (the other voice lessons rose by as much).
  // Raised to 140 for Merc's vibrato option (kit/sound.ts), Lesson 22's:
  // 142,032 bytes before it, 142,429 with it, against 142,336 at 139. All
  // 397 are on every lesson page: a voice's vibrato from a rate, an extent
  // and a grow-in, or none for a straight note, and the setter that glides
  // a sounding one to a new rate and extent.
  // Raised to 158 for Lesson 3's film, which plays under Watch as Lessons 2
  // and 4's do: 143,319 bytes in build:e2e before it, 160,998 with it,
  // 16,639 of them the film's two chunks, kit/episode.ts (4,994) and
  // lesson-03/film.ts with its chapters and captions (11,645).
  // Lesson 21's page shell added 499 bytes on main before the film (143,319
  // to 143,818): 311 of them Lesson 21's tease, its alternative and its
  // drafts line, on every lesson page, as on Lesson 2; the other 188 are the
  // bundler's, as on Lesson 2, and come back with Lesson 21's cold open.
  // 158 holds the film and the shell.
  // Raised to 159 for Lesson 20's page shell, as on Lesson 2: 161,537
  // bytes before it, 161,817 with it, against 161,792 at 158; 158 can be
  // tried again once Lesson 20's cold open loads the predict.
  // Back to 158 with Lesson 20's cold open, which loads the predict:
  // 161,638 bytes in build:e2e.
  'learn/03.html': 158,
  // Lesson 5, a draft (src/features/lessons/kit/drafts.ts), built in every
  // mode as Lesson 3 is. Measured 122
  // with the lesson menu and the next-lesson card (109 before them), and 129
  // with the page state.
  // The listener and the hold reader arrive when Sing it's Start is pressed,
  // the reader for the hold demo's readouts once Step 5 comes near: Voice
  // Mirror's scorer stays off first paint only while both imports stay
  // dynamic. The same headroom as Lessons 1 to 3, a quarter over.
  // Raised to 137 for the films' watch pages: 139,050 bytes on main before
  // them, 139,547 with them, against 139,264 at 136. None of it is new code
  // on the page: the watch pages share the kit's episode, toast and films
  // modules with the lessons, so Rollup gives those chunks of their own,
  // each with its imports, on every lesson page.
  // Raised to 138 when its hold flow and hold run moved into the kit for
  // Lesson 13: 139,547 bytes before, 140,785 after, against 140,288 at 137.
  // The 1,238 are the kit's plan for the holds' lengths, the Listen phase a
  // page passes in, and Lesson 5's plan over them.
  // Raised to 142 for the seasons: 141,020 bytes on main before them,
  // 144,538 with them, against 144,384 at 141. None of it is Season 2's data, which
  // loads only when the explorer's Season 2 tab opens (the forbidden list
  // below): it is the kit's code for seasons, the explorer's tabs and its
  // column of the season before, a close per season that follows the
  // visit's ending, and the masthead's season from the lesson, on every
  // lesson page.
  // Raised to 143 for Lesson 15's page: 145,177 bytes on main before it,
  // 145,530 with it, against 145,408 at 142. Rollup's are 5; the other 348
  // are on every lesson page: Lesson 16's tease and its alternative in the
  // lesson copy (137), Lesson 15's drafts line (73), the page state's
  // carrySeason, which Lesson 15's page is the first to call (75), and its
  // rule for a link into a season the page does not carry (63).
  // Raised to 144 for Lesson 19's page shell: 146,228 bytes on main before
  // it, 146,757 with it, against 146,432 at 143. 333 of the 529 are on
  // every lesson page: Lesson 19's tease and Lesson 20's, each with its
  // alternative (kit/lesson-copy.ts, 298), and Lesson 19's drafts line
  // (35). The other 196 are the kit's predict, quiz and glyphs in a chunk
  // of their own again, with its preload and imports, since the shell
  // loads none of them, as on Lesson 17's; they go once Lesson 19's cold
  // open and quizzes load them, but the 333 alone leave no room at 143.
  // Raised to 145 for Lesson 22's page shell: 147,131 bytes on main before
  // it, 147,565 with it, against 147,456 at 144. 238 of the 434 are on every
  // lesson page: Lesson 22's tease and its alternative (kit/lesson-copy.ts,
  // 179) and its drafts line (59). The other 196 are the bundler cutting the
  // kit's shared code differently around a shell that loads the reveal but
  // not the predict, as on Lessons 19's and 23's: bytes no module owns
  // (139), a chunk's overhead (44) and the predict's code moved into the
  // reveal's chunk (10), with 3 of the minifier's renaming. 144 can be tried
  // again once Lesson 22's cold open loads the predict.
  // Raised to 147 for Lesson 22's Sing it: 148,317 bytes before it, 149,581
  // with it, against 149,504 at 146. 122 of the 1,264 are the kit's
  // checkpoint, its hooks for a page's part in a take (kit/hold-sing.ts, 99)
  // and the band chart's painter passed to its view (23). The rest is the
  // bundler cutting the checkpoint's parts, which Lesson 22 now shares, out
  // of Lesson 5's chunk into chunks of their own, each with its imports:
  // bytes no module owns (1,150) and a chunk's overhead (47), with 55 fewer
  // of the minifier's renaming in Lesson 5's own modules.
  // Raised to 148 for Lesson 24's Sing it: 150,274 bytes before it, 150,563
  // with it, against 150,528 at 147. All 289 are the kit's hold flow and
  // hold run, which Lesson 5 shares: a set's mark and its rules
  // (kit/hold-flow.ts, 275) and the drone a hold keeps under its take
  // (kit/hold-run.ts, 14), shaken out until a page sang sets.
  // Raised to 149 for Lesson 16's page shell: 151,506 bytes on main before
  // it, 151,807 with it, against 151,552 at 148. 116 of the 301 are on
  // every lesson page: Lesson 16's drafts line (kit/drafts.ts). The other
  // 185 are the bundler cutting the kit's shared code differently around a
  // shell that loads the reveal but not the predict, as on Lessons 21's and
  // 22's; they come back once Lesson 16's cold open loads the predict, but
  // the 116 alone leave no room at 148.
  'learn/05.html': 149,

  // Lesson 4, "The major scale and home": its own module on the same kit,
  // the staircase drawn on canvas. Measured 114 with the lesson menu and the
  // next-lesson card (101 before them); the renderer is the same dynamic
  // import as Lesson 1's. Raised to 126 when Lesson 3's hook from 20
  // October stayed in the console as an alternative: 127,974 bytes on main
  // before it, 128,220 with it, against 128,000 at 125. It carries the
  // season's copy as Lesson 3 does. Raised to 128 for the handoff's
  // follow-ups: 128,332 bytes on main before them, 130,176 with them, against
  // 129,024 at 126. The kit's 1,090 reach it as they reach Lesson 3; Move do
  // and Merc's sing-along, kit parts now, come in chunks of their own, 672
  // bytes there and 241 fewer in the page's module; and the slide guide's
  // rest adds 323 (kit/slide-guide.ts). Raised to 129 for the lesson answer
  // events (#1193): 130,767 bytes on main before them, 131,214 with them,
  // against 131,072 at 128. All 447 are the kit's, as on Lesson 3.
  // Raised to 130 for Lesson 10's page: 131,823 bytes on main before it,
  // 132,369 with its chord beads, cold open and quizzes, against 132,096 at
  // 129. 216 of the 546 are Lesson 10's season entry and drafts line, on
  // every lesson page. The other 330 are modules Lesson 4 now shares with
  // Lesson 10 (the major scale's degrees, the names store and its modes,
  // and the spiral's keys), regrouped into chunks of their own, each with
  // its imports. The kit's predict, quiz and hero sky are in the chunk
  // every lesson page shares again, as on main.
  // Raised to 131 for the films' watch pages: 133,056 bytes on main before
  // them, 133,496 with them, against 133,120 at 130. The 440 are the
  // episode, toast and films modules in chunks of their own, as on Lesson 5.
  // Raised to 135 for the seasons: 134,054 bytes on main before them,
  // 137,572 with them, against 137,216 at 134. None of it is Season 2's data, which
  // loads only when the explorer's Season 2 tab opens (the forbidden list
  // below): it is the kit's code for seasons, the explorer's tabs and its
  // column of the season before, a close per season that follows the
  // visit's ending, and the masthead's season from the lesson, on every
  // lesson page.
  // Raised to 136 for Lesson 15's page: 138,203 bytes on main before it,
  // 139,101 with it, against 138,240 at 135. 348 of the 898 are the four on
  // every lesson page, as on Lesson 5. 183 are Lesson 2's quiz pair, which
  // can now let go of its button when a newer sound cuts it, on every page
  // that has the pair. The other 367 are Rollup's: the key strip, which
  // Lesson 15's staff toy shares, moves out of the page's module, and the
  // major scale out of Move do's chunk, since Lesson 15 loads Move do alone,
  // each into a chunk of its own.
  // Raised to 137 for Lesson 17's page shell: 139,104 bytes on main before
  // it, 139,669 with it, against 139,264 at 136. 237 of the 565 are Lesson
  // 17's tease, its alternative and its drafts line, on every lesson page,
  // as on Lesson 2; the other 328 are the kit's predict, quiz and glyphs in
  // a chunk of their own again (362), less 34 of the minifier's renaming,
  // and 136 can be tried once Lesson 17 loads them.
  // Raised to 138 for Lesson 19's page shell: 139,811 bytes on main before
  // it, 140,341 with it, against 140,288 at 137. 333 of the 530 are Lesson
  // 19's and Lesson 20's teases with their alternatives and Lesson 19's
  // drafts line, on every lesson page, as on Lesson 5; the other 197 are the
  // kit's predict, quiz and glyphs in a chunk of their own again, and 137
  // can be tried once Lesson 19 loads them.
  // Raised to 139 for Merc's vibrato option (kit/sound.ts), Lesson 22's:
  // 141,005 bytes before it, 141,402 with it, against 141,312 at 138, the
  // same 397 as on Lesson 3.
  // Raised to 155 for Lesson 4's film, which plays under Watch as Lesson 2's
  // does: 157,694 bytes in build:e2e with it, 15,086 of them the film's two
  // chunks, kit/episode.ts (4,994) and lesson-04/film.ts with its chapters
  // and captions (10,092).
  // Raised to 156 as the kit's staircase draws only while something it shows
  // moves and takes new starts (Lesson 21's, on G2 or G4): 158,596 bytes
  // before, 159,274 with it (stairs-core.ts), against 158,720 at 155.
  // Raised to 157 as Lesson 21's steps take the kit's staircase too: the
  // bundler moves it out of Lesson 4's own chunk into one the two pages
  // share (14,203 bytes), and the imports between them cost 611 bytes:
  // 159,267 before, 159,878 with them, against 159,744 at 156.
  // Raised to 158 for Lesson 18's page shell: 160,536 bytes before it,
  // 160,840 with it, against 160,768 at 157. 117 of the 304 are on every
  // lesson page: Lesson 18's drafts line (kit/drafts.ts). The other 187 are
  // the bundler cutting the kit's shared code differently around a shell
  // that loads the reveal but not the predict, as Lesson 16's shell did.
  // With Lesson 18's cold open on the predict it is 160,785, still 17
  // bytes over 157, so 158 stays.
  // Raised to 159 for the staircase's other scales (Lesson 20's pentatonic,
  // kit/stairs-scales.ts): 161,072 bytes before them, 162,409 with them,
  // against 161,792 at 158. The page draws its staircase at first paint, so
  // it carries the degrees, the spelling and both names' drawing.
  'learn/04.html': 159,
  // Lesson 6, "Intervals: the distance between notes", a draft too, built
  // in every mode as Lesson 3 is: its own module on the kit, with the tune
  // line and the ear game it brings. Measured 125 with the lesson menu and
  // the next-lesson card, and 128 with the page state; the budget is a
  // quarter over the first. Sing it opens no microphone, so the only
  // dynamic import is Merc's renderer, as on Lesson 1. A build of this page
  // alone weighs it about 8 lighter, so weigh a new page in build:e2e,
  // where this check runs.
  'learn/06.html': 156,
  // Lesson 7, "Slides, sirens and your range", a draft too, built in every
  // mode as Lesson 3 is: its own module on the kit, with the range chart it
  // brings. Measured 129 in build:e2e, with the page state; the budget is a
  // quarter over. The listener, the pitch detector and the siren's reader
  // arrive through a dynamic import when Sing it's Start is pressed, as on
  // Lesson 3, so the page stays this light only while that boundary holds.
  'learn/07.html': 161,
  // Lesson 8, "Beat, tempo and the backbeat", a draft too, built in every
  // mode as Lesson 3 is: its own module on the kit, with the beat clock, the
  // beat machine and the tap pad, which only it imports. Measured 145 in
  // build:e2e (148,050 bytes); the budget is a quarter over that. Sing it
  // opens no microphone, so the only dynamic import is Merc's renderer, as
  // on Lesson 1.
  'learn/08.html': 181,
  // Lesson 9, "Landing a leap", a draft too, built in every mode as Lesson
  // 3 is: its own module on the kit, with the ladder chart, the folds strip,
  // the landing and free play. Measured 151 in build:e2e (153,922 bytes); the
  // budget is a quarter over that. The listener, the pitch detector and the
  // ladder's reader arrive through a dynamic import when Sing it's Start is
  // pressed, as on Lessons 3 and 7, so the page stays this light only while
  // that boundary holds.
  'learn/09.html': 188,
  // Lesson 10, "Major and minor", a draft too, built in every mode as
  // Lesson 3 is: its own module on the kit, with the chord beads, the
  // hero's spiral seen from above, the ear game, the slide guide and free
  // play. Measured 169 in build:e2e (172,612 bytes); the budget is a
  // quarter over that. Sing it opens no microphone, so the only dynamic
  // imports are the four Lesson 1 makes too: Merc's renderer, the welcome
  // tour, the quizzes' answers sent anonymously and the way back to the
  // plan (kit/tour.ts, telemetry.ts and plan-back.ts).
  'learn/10.html': 211,
  // Lesson 11, "Registers and the break", a draft too, built in every mode
  // as Lesson 3 is: its own module on the kit, with the range chart in Merc's
  // two gears, the cold open's sirens, the four words, the steps' five
  // states, Sing it and free play. Its page shell weighed 74,137 bytes; the
  // whole page 134 in build:e2e (137,304 bytes), of which 15,655 are the
  // chunk it shares with Lesson 7 (the range chart, the siren flow, the
  // "ng" and Lesson 7's quiz questions); the budget is a quarter over. The
  // listener, the pitch detector and the take arrive through a dynamic
  // import when Sing it's Start is pressed, as on Lessons 3, 7 and 9, so
  // the page stays this light only while that boundary holds.
  'learn/11.html': 167,
  // Lesson 12, "Chords and the four-chord song", a draft too, built in
  // every mode as Lesson 3 is: its own module on the kit, with the ring of
  // rooms (the kit's spiral seen from above, with its keys), its plays,
  // the tune toy and its walk, the cold open on the hero's ring with the
  // kit's predict, the recall with Lesson 10's questions and quiz plays,
  // the four words, Sing it on the kit's comfort check, voice choice,
  // slide guide and breathing ring, and free play. Measured 163 in
  // build:e2e (166,064 bytes); the budget is a quarter over that. Sing it
  // opens no microphone, so nothing of the listener comes in.
  'learn/12.html': 203,
  // Lesson 13, "Resonance and vowels", a draft too, built in every mode as
  // Lesson 3 is: its own module on the kit, with the vowel model, the
  // spectrum strip under the band chart, the vowel voice, the cold open's
  // predict, the four words, the steps, the quizzes, Sing it on the kit's
  // hold run, and free play. Measured 128 in build:e2e (130,947 bytes); the
  // budget is a quarter over that. The listener, the pitch detector and the
  // hold reader arrive through a dynamic import when Sing it's Start is
  // pressed, as on Lessons 3, 5 and 9, so the page stays this light only
  // while that boundary holds.
  'learn/13.html': 160,
  // Lesson 14, "Phrasing: sing a whole song", a draft too, built in every
  // mode as Lesson 3 is: the kit's deck, switches, masthead, explorer and
  // the season's close, the song line on the band chart, the cold open,
  // the steps, the four words, the quizzes, Sing it's card and flow, and
  // the Wrap, 141,597 bytes in build:e2e; a quarter over. Sing it's take,
  // the listener and the recorder load only from its Start, and Merc and
  // Tavi's renderer after first paint, as on every lesson page.
  'learn/14.html': 173,
  // Lesson 15, "The staff: where notes sit", Season 2's first page and a
  // draft, built in every mode as Lesson 3 is: its own module on the kit,
  // carrying Season 2's map (kit/season-2.ts) as a Season 2 page must, with
  // the steps' staff toy (kit/staff.ts, its drawing, places and glyphs, and
  // the key strip), the cold open's pitch line and fold on the kit's
  // predict, the recall's Lesson 2 questions and pair and the quick check
  // on the kit's quiz, the four words' figures and plays, Sing it on the
  // kit's sing flow, comfort check and voice choice, and the Wrap's free
  // play and tease still, 146,372 bytes in build:e2e; a quarter over. Sing
  // it opens no microphone, so nothing of the listener comes in.
  'learn/15.html': 179,
  // Lesson 16, "Sing what you see", a Season 2 page and a draft, built in
  // every mode as Lesson 3 is: its own module on the kit, carrying Season
  // 2's map (kit/season-2.ts) as a Season 2 page must; its shell and its
  // steps, the staircase that turns into the staff and the staff toy, the
  // cold open's two tries on the kit's predict, the recall's Lesson 9 and
  // 15 questions, imported with the questions theirs import, and the quick
  // check on the kit's quiz, the three words' figures and plays, and Sing
  // it on its flow, with the comfort check, the voice choice, the
  // feelings and the still of the one who sings, its take's reader and
  // pitch line loaded with the first Start and every other play held while
  // a take runs, and the Wrap's free play, the tease still drawn after
  // first paint: 191,543 bytes in build:e2e; a quarter over.
  'learn/16.html': 234,
  // Lesson 17, "How long is a note?", a Season 2 page and a draft, built in
  // every mode as Lesson 3 is: its own module on the kit, carrying Season
  // 2's map (kit/season-2.ts) as a Season 2 page must, with the steps'
  // rhythm bar on the beat clock (kit/rhythm-bar.ts, its drawing, model,
  // words and stopwatch strip, and the staff's places and glyphs), Step 5's
  // lift, the cold open's compact pads, metronome and predict, the four
  // words, the Wrap's comfort check and tease still, and the explorer's
  // figure (kit/season-2-figures.ts): 145,795 bytes in build:e2e; a quarter
  // over. The recall and quick check, the checkpoint (take, pad, clap, sung
  // bars) and free play load after first paint.
  'learn/17.html': 178,
  // Lesson 18, "Read and sing a whole line", a Season 2 page and a draft,
  // built in every mode as Lesson 3 is: its own module on the kit, carrying
  // Season 2's map (kit/season-2.ts) as a Season 2 page must; its shell and
  // its steps, the reading staff on the kit's rhythm bar with its marks
  // (kit/read-marks.ts) and the tap pad, the cold open's read on the kit's
  // predict, the four words, and Sing it on its flow, with the comfort
  // check, the voice choice and the feelings, every other play held from
  // Start, and the Wrap's practice card and tease still: 191,171 bytes in
  // build:e2e; a quarter over. The recall and quick check, the take's
  // reader and pitch line (loaded with the first Start) and free play load
  // after first paint.
  'learn/18.html': 234,
  // Lesson 19, "Threes, offbeats and syncopation", a Season 2 page and a
  // draft, built in every mode as Lesson 3 is: its own module on the kit,
  // carrying Season 2's map (kit/season-2.ts) as a Season 2 page must, with
  // the steps' rhythm bar on the beat clock (kit/rhythm-bar.ts, its drawing,
  // model and words), the app's drum voices (src/lib/drum-voices.ts) and
  // Subdivide's bars (src/lib/ear/metre.ts), the cold open's six pads, its
  // predict and Merc's hop, the four words, and the explorer's six pads with
  // Season 2's data (kit/season-2-figures.ts): 152,871 bytes in build:e2e; a
  // quarter over. The recall and quick check, the take (its judge and the
  // tap pad) and free play load after first paint.
  'learn/19.html': 187,
  // Lesson 20, "Runs and the pentatonic scale", a Season 2 page and a draft,
  // built in every mode as Lesson 3 is: its own module on the kit, carrying
  // Season 2's map (kit/season-2.ts) as a Season 2 page must; its shell
  // and the steps' two toys, the staircase and the run with its staff;
  // the cold open's run and predict, the four words' figures, Sing it's
  // card on the run chart (kit/ladder-sing.ts, kit/ladder-guide.ts) and
  // free play's import: 196,214 bytes in build:e2e; a quarter over. The
  // recall and quick check, the take with its listener, and free play load
  // after first paint.
  'learn/20.html': 240,
  // Lesson 21, "Keys and the circle of fifths", a Season 2 page and a
  // draft, built in every mode as Lesson 3 is: its own module on the kit,
  // carrying Season 2's map (kit/season-2.ts) as a Season 2 page must, with
  // the steps' four toys (the kit's staircase, moved from Lesson 4, the
  // staff toy with its key signatures, kit/staff-key.ts, the circle of
  // fifths with its house and walk, kit/circle.ts, and Find do on the staff
  // toy), the cold open's ring, keyboard and small staircases on the kit's
  // predict, the recall's questions from Lessons 6 and 15, with the slot
  // that plays Lesson 15's three notes, and the quick check on the kit's
  // quiz, the four words on the kit's words strip, Sing it on the kit's
  // sing flow, comfort check, voice choice and count-in, and free play on
  // the circle: 197,624 bytes in build:e2e; a quarter over. Sing it opens
  // no microphone, so nothing of the listener comes in.
  'learn/21.html': 242,
  // Lesson 22, "Vibrato", a Season 2 page and a draft, built in every mode
  // as Lesson 3 is: its own module on the kit, carrying Season 2's map
  // (kit/season-2.ts) as a Season 2 page must, with Merc's vibrato option in
  // the kit's sound (kit/sound.ts, 397), the cold open (Merc's wave across
  // the hero's band chart, its predict and its sky), the steps' band chart
  // in its four states (lesson-22/vib-toy.ts on the kit's band chart, its
  // wave painter and level strip, the kit's runs and Step 3's predict), the
  // app's ribbon in a chunk of its own after first paint, the recall and
  // quick check on the kit's quiz (Lessons 5 and 14's question modules
  // whole, as the recall asks their own objects), the four words' band
  // charts on the kit's words strip, Sing it on the kit's held-note
  // checkpoint (kit/hold-sing.ts, its view, the hold flow and the hold run,
  // which it shares with Lesson 5), comfort check, voice choice and warm-up,
  // with the page's part in a take (lesson-22/sing.ts), and the Wrap's
  // practise card and free play, the steps' band chart again
  // (lesson-22/wrap.ts); the centre-line reader and the listener load after
  // Start: 155,899 bytes in build:e2e; a quarter over.
  'learn/22.html': 191,
  // Lesson 23, "Perfect, major, minor and the tritone", a Season 2 page and
  // a draft, built in every mode as Lesson 3 is: its own module on the kit,
  // carrying Season 2's map (kit/season-2.ts) as a Season 2 page must, with
  // the staff toy's interval state (kit/staff-interval.ts, its drawing and
  // kit/intervals.ts) on the steps' stage and in free play, the cold open's
  // pitch line on the kit's predict, the recall's Lesson 6 questions and
  // their plays and the quick check on the kit's quiz, loaded with the page
  // as Lesson 15's are, so the guide's sheet stays in the quizzes' shared
  // chunk (MISTAKES.md), the four words on Lesson 1's strip, and Sing it on
  // the kit's sing flow, comfort check and voice choice, with its listening
  // pair: 173,868 bytes in build:e2e; a quarter over. Sing it opens no
  // microphone, so nothing of the listener comes in.
  'learn/23.html': 213,
  // Lesson 24, "Harmony against a drone", a Season 2 page and a draft,
  // built in every mode as Lesson 3 is: its own module on the kit, carrying
  // Season 2's map (kit/season-2.ts) as a Season 2 page must, with the
  // steps' drone chart (kit/band-chart.ts with kit/band-chart-drone.ts, its
  // brightness from kit/drone-beats.ts), the cold open's on the same chart,
  // both predicts on the kit's, the recall and the quick check on the
  // kit's quiz, with Lesson 10's and Lesson 23's questions, the words'
  // pictures, two on the same chart, Sing it on the kit's hold flow,
  // comfort check, voice choice, headphones check and ring, and free play:
  // 178,425 bytes in build:e2e; a quarter over. The quiet check and the
  // listener load on Start, so nothing of the pitch code comes in.
  'learn/24.html': 218,

  // A lesson film's watch page (learn/NN/watch.html): createEpisode, the
  // film's chapters and captions, and Vite's helper. Measured 17 and 18 on
  // 2026-11-01; the film itself is the markup's, so a quarter over holds.
  // Lesson 4's, with longer captions, measured 20 (19,972 bytes) on
  // 2026-11-07, and Lesson 3's, with longer ones still, 22 (21,664 bytes)
  // the same day.
  'learn/01/watch.html': 24,
  'learn/02/watch.html': 24,
  'learn/03/watch.html': 27,
  'learn/04/watch.html': 25,

  // The main app, and the crawlable doors that are the main app. Measured
  // 4669. It is eager by design today, so this is a ceiling on growth rather
  // than a claim that the number is good.
  'index.html': 5400,
  'jam.html': 5400,
  'jam-rooms.html': 5400,
  'ear-lab.html': 5400,
  'pitch-training.html': 5400,
  // Studio boots this same app shell; CI measured 4219 KB on 2026-10-26.
  'studio-night.html': 5400,
}

/**
 * Ceilings, in KB of uncompressed render-blocking CSS, per emitted document.
 *
 * Same rule as the table above -- a measured build plus about a quarter --
 * with a 40 KB floor, so the small standalone pages are not tripped by
 * ordinary growth while still failing loudly if the 871 KB global sheet ever
 * reaches one. Measured values are in the comments.
 *
 * `404.html` is absent on purpose: it links the error scene's sheet but runs
 * no script, and `measureFirstPaint` only weighs documents that run one.
 */
export const FIRST_PAINT_CSS_BUDGETS_KB = {
  // The Cast receiver. Measured 1: its own sheet, which lays the canvas over
  // the whole screen on the stage's ground. The floor.
  'cast-receiver.html': 40,

  // The Voice Mirror and its three doors, and the glass room. Measured 26,
  // 26, 26, 26 and 24 -- nearly all of it one page-scoped sheet.
  'mirror.html': 40,
  'vocal-range-test.html': 40,
  'voice-type-test.html': 40,
  'which-singer-has-my-vocal-range.html': 40,
  'glass.html': 40,

  // The separate 3D museum campaign. Measured 46 across its page-scoped
  // sheet, the entry prelude and vendor CSS.
  'glass-game.html': 60,

  // Karaoke Night and its three other doors. Measured 67, and 64 for all
  // four on 2026-10-19.
  'karaoke-night.html': 90,
  'karaoke.html': 90,
  'vocal-remover.html': 90,
  'karaoke-app.html': 90,

  // The night rooms. Measured 74, 98 and 316; the room's own sheet is 48,
  // 82 and 262 KB of that, which is where any reduction has to come from.
  'piano-night.html': 95,
  'drum-night.html': 125,
  'guitar-night.html': 400,

  // Lesson 1. Measured 64 on 2026-10-20 (69 until the Series blueprint and
  // its rules left the page): the kit's sheets and its own (51), and the
  // shared Inter and Outfit @font-face rules (12).
  'learn/01.html': 80,
  // Lesson 2. Measured 75: the kit's sheets, its own and the slide guide's.
  'learn/02.html': 95,

  // Lesson 3 (released, as above). Measured 77: the kit's sheets, the voice
  // lessons' sheet and its own, and the shared Inter and Outfit @font-face
  // rules.
  'learn/03.html': 96,
  // Lesson 5 (a draft, as above). Measured 77: the kit's sheets, the voice
  // lessons' sheet and its own, and the shared Inter and Outfit @font-face
  // rules.
  'learn/05.html': 96,

  // Lesson 4. Measured 73: the kit's sheets (with the slide guide's and the
  // parts Lessons 2 and 4 share), its own, and the shared Inter and Outfit
  // @font-face rules.
  'learn/04.html': 92,
  // Lesson 6 (a draft, as above). Measured 87: the kit's sheets (with the
  // slide guide's, the voice lessons', the shared parts, the tune line's
  // and the ear game's), its own, and the shared Inter and Outfit
  // @font-face rules. A build of this page alone weighs it at 80.
  'learn/06.html': 109,
  // Lesson 7 (a draft, as above). Measured 85 in build:e2e: the kit's sheets
  // (with the voice lessons', the shared parts and the range chart's), its
  // own, and the shared Inter and Outfit @font-face rules; a quarter over.
  'learn/07.html': 106,
  // Lesson 8 (a draft, as above). Measured 93 in build:e2e: the kit's
  // sheets (with the beat machine's), its own, and the shared Inter and
  // Outfit @font-face rules; the budget is a quarter over that.
  'learn/08.html': 116,
  // Lesson 9 (a draft, as above). Measured 87 in build:e2e (88,410 bytes):
  // the kit's sheets (with the voice lessons' and the shared parts), its
  // own, and the shared Inter and Outfit @font-face rules; a quarter over.
  'learn/09.html': 108,
  // Lesson 10 (a draft, as above). Measured 89 in build:e2e (90,214
  // bytes): the kit's sheets (with the slide guide's, the voice lessons',
  // the ear game's and the shared parts), its own, and the shared Inter and
  // Outfit @font-face rules; a quarter over.
  'learn/10.html': 111,
  // Lesson 11 (a draft, as above). Measured 89 in build:e2e (90,622
  // bytes): the kit's sheets (with the voice lessons', the range chart's,
  // inlined into its own by @import, and the shared parts), its own, and
  // the shared Inter and Outfit @font-face rules; a quarter over.
  'learn/11.html': 111,
  // Lesson 12 (a draft, as above). Measured 88 in build:e2e (89,362
  // bytes): the kit's sheets (with the slide guide's, the voice lessons'
  // and the shared parts, in their shared chunks as Lesson 10's are), its
  // own, with free play's and the tease still's rules, and the shared
  // Inter and Outfit @font-face rules; a quarter over.
  'learn/12.html': 110,
  // Lesson 13 (a draft, as above). Measured 86 in build:e2e (87,615
  // bytes): the kit's sheets (with the voice lessons' and the shared
  // parts), its own, and the shared Inter and Outfit @font-face rules; a
  // quarter over.
  'learn/13.html': 107,
  // Lesson 14 (a draft, as above): 87,943 bytes in build:e2e, the kit's
  // sheets (the voice lessons' in the comfort chunk, as on Lessons 3, 5 to
  // 11 and 13, and the shared parts), its own, and the shared Inter and
  // Outfit @font-face rules; a quarter over.
  'learn/14.html': 108,
  // Lesson 15 (a draft, as above): 90,657 bytes in build:e2e, the kit's
  // sheets (the guide's and the voice lessons' in the chunks the quizzes and
  // Sing it share, the staff toy's inlined into its own by @import, and the
  // shared parts), its own, and the shared Inter and Outfit @font-face
  // rules; a quarter over.
  'learn/15.html': 111,
  // Lesson 16 (a draft, as above), its shell, its steps, Sing it and the
  // Wrap: 94,076 bytes in build:e2e, the kit's sheets (the shared parts)
  // with the voice lessons' (lesson-voice.css: the comfort check, the voice
  // choice, the briefing and the feelings), its own with the staff toy's
  // and the staircase's taken in by @import, and the shared Inter and
  // Outfit @font-face rules; a quarter over.
  'learn/16.html': 115,
  // Lesson 17 (a draft, as above), with its steps, its cold open, its four
  // words and the Wrap: 94,962 bytes in build:e2e, the kit's sheets
  // (the voice lessons' in the chunk it shares with them, the guide's, the
  // rhythm bar's and the tap pad's inlined into its own by @import, and the
  // shared parts), its own, and the shared Inter and Outfit @font-face
  // rules; a quarter over.
  'learn/17.html': 116,
  // Lesson 18 (a draft, as above), its shell, its steps, Sing it and the
  // Wrap: 95,710 bytes in build:e2e, the kit's sheets (the shared parts)
  // with the voice lessons' (lesson-voice.css: the comfort check, the voice
  // choice, the briefing and the feelings), its own with the rhythm bar's
  // and the tap pad's taken in by @import, and the shared Inter and Outfit
  // @font-face rules; a quarter over.
  'learn/18.html': 117,
  // Lesson 19 (a draft, as above), with its steps, its cold open, its four
  // words, the take and the Wrap: 86,737 bytes in build:e2e, the kit's
  // sheets (the rhythm bar's and the tap pad's inlined into its own by
  // @import, and the shared parts), its own, and the shared Inter and Outfit
  // @font-face rules; a quarter over.
  'learn/19.html': 106,
  // Lesson 20 (a draft, as above): 94,173 bytes in build:e2e, the kit's
  // sheets (the shared parts and the comfort check's), its own with the
  // staircase's, the staff toy's and the voice lessons' taken in, and the
  // shared Inter and Outfit @font-face rules; a quarter over.
  'learn/20.html': 115,
  // Lesson 21 (a draft, as above): 95,757 bytes in build:e2e, the kit's
  // sheets (the guide's and the voice lessons' in the chunks the quizzes and
  // Sing it share, the staff toy's, the staircase's and the circle's
  // inlined into its own by @import, and the shared parts), its own, and the
  // shared Inter and Outfit @font-face rules; a quarter over.
  'learn/21.html': 117,
  // Lesson 22 (a draft, as above), with its steps, its cold open, its two
  // quizzes, its four words, Sing it and the Wrap: 89,928 bytes in
  // build:e2e, the kit's sheets (the voice lessons' in the chunk Sing it
  // shares with them, and the shared parts), its own, and the shared Inter
  // and Outfit @font-face rules; a quarter over.
  'learn/22.html': 110,
  // Lesson 23 (a draft, as above): 92,408 bytes in build:e2e, the kit's
  // sheets (the guide's and the voice lessons' in the chunks the quizzes and
  // Sing it share, the staff toy's and its interval state's inlined into its
  // own by @import, and the shared parts), its own, and the shared Inter and
  // Outfit @font-face rules; a quarter over.
  'learn/23.html': 113,
  // Lesson 24 (a draft, as above): 89,637 bytes in build:e2e, the kit's
  // sheets (the guide's and the voice lessons' in the chunks the recall's
  // questions and Sing it share, and the shared parts), its own, and the
  // shared Inter and Outfit @font-face rules; a quarter over.
  'learn/24.html': 110,

  // A lesson film's watch page: one sheet, kit/lesson-watch.css, which
  // inlines the lessons' fonts, base and sections. Measured 36, a quarter
  // over.
  'learn/01/watch.html': 45,
  'learn/02/watch.html': 45,
  'learn/03/watch.html': 45,
  'learn/04/watch.html': 45,

  // The main app and the crawlable doors that are the main app. Measured
  // 1009, of which 871 is the single `index` sheet that src/index.tsx
  // builds by importing uvr.css, vocal-analysis.css, exercises.css and
  // app.css globally. A ceiling on growth, not a claim the number is good:
  // splitting it is #379.
  'index.html': 1260,
  'jam.html': 1260,
  'jam-rooms.html': 1260,
  'ear-lab.html': 1260,
  'pitch-training.html': 1260,
  // Studio's integrated entry links the same shell CSS; CI measured 1066 KB.
  'studio-night.html': 1260,
}

/**
 * Modules no document may download before its first paint, at any size.
 *
 * Each is reached only through `await import(...)`, so a static path to one
 * from any document is a regression: a manualChunks rule that files it under
 * a chunk with static importers erases the dynamic boundary without any
 * change to the source, and a static import from a page's own graph does it
 * in plain sight. Matched against the `sources` of every first-paint chunk's
 * source map. A rule's `remedy`, when it has one, replaces the default
 * advice, for a module that a chunk of its own would not keep off a page,
 * and its `documents`, when it has them, are the only documents it holds.
 */
export const FIRST_PAINT_FORBIDDEN_SOURCES = [
  {
    // Signalsmith Stretch, the key and speed shifter. `pitch-shift-node.ts`
    // imports it when a song first plays off its own key or speed; the
    // worklet half is a separate `?worker&url` asset outside every graph.
    // A manualChunks rule has dragged it onto first paint before.
    label: 'the key-change engine',
    pattern: /(?:^|\/)node_modules\/signalsmith-stretch\//,
  },
  {
    // The lessons kit's team-notes.ts, the team's words about the season:
    // each lesson's signature image and why each hook or tease variant
    // exists. Only the admin console imports it, and the app reaches the
    // console through App.tsx's lazy AdminContentStudio, so no document
    // paints with it. Every lesson page imports season.ts and lesson-copy.ts,
    // which held these strings until they moved out to spare the lesson
    // pages' ceilings; an import of the notes from either, or from anything
    // else a page loads, fails here.
    label: "the lessons' team notes",
    pattern: /(?:^|\/)src\/features\/lessons\/kit\/team-notes\.ts$/,
    // A static import from the kit makes even a chunk of its own a static
    // dependency of every lesson page, so the default advice would not help.
    remedy:
      "Only the admin console may import it: find the static import that pulls it in, from season.ts, lesson-copy.ts or the page's own module, and take it out.",
  },
  {
    // Season 2's map, kit/season-2.ts: its lessons, topics, edges and close.
    // A Season 1 page's explorer loads it on demand, when its Season 2 tab
    // opens, so no Season 1 page paints with it, and the seasons' aggregate
    // (kit/seasons.ts) is for the hub, the worker and the console only. A
    // Season 2 page carries it, so the rule holds Season 1's documents,
    // Lessons 1 to 14 and their watch pages, alone (`documents`).
    label: "Season 2's lesson data",
    pattern: /(?:^|\/)src\/features\/lessons\/kit\/(?:season-2|seasons)\.ts$/,
    documents: /^learn\/(?:0\d|1[0-4])(?:\.html|\/)/,
    remedy:
      "A Season 1 page may load it only when its explorer's Season 2 tab opens: find the static import of season-2.ts or seasons.ts that pulls it in and take it out.",
  },
]

/** What a forbidden module's breach says to do, unless its rule says otherwise. */
const ON_DEMAND_REMEDY =
  'It must load only on demand; give it a chunk of its own in vite.config.ts manualChunks, or find the static import that pulls it in.'

const KB = 1024

function normalizePath(path) {
  return path.replaceAll('\\', '/')
}

/** Every emitted script a document asks for by itself. */
export function documentScriptUrls(html) {
  const urls = new Set()
  const pattern = /(?:src|href)=["'](\/assets\/[^"']+\.js)["']/g
  let match = pattern.exec(html)
  while (match !== null) {
    urls.add(match[1])
    match = pattern.exec(html)
  }
  return [...urls]
}

/**
 * Every stylesheet a document blocks its first paint on.
 *
 * Only `rel="stylesheet"`. A `preload` or `prefetch` names the same file
 * without blocking on it, and the attribute order inside the tag is Vite's
 * business, so each <link> is read whole rather than matched positionally.
 */
export function documentStylesheetUrls(html) {
  const urls = new Set()
  const linkPattern = /<link\b[^>]*>/gi
  let match = linkPattern.exec(html)
  while (match !== null) {
    const tag = match[0]
    if (/\brel=["']stylesheet["']/i.test(tag)) {
      const href = /\bhref=["'](\/assets\/[^"']+\.css)["']/i.exec(tag)
      if (href !== null) urls.add(href[1])
    }
    match = linkPattern.exec(html)
  }
  return [...urls]
}

/** Static ESM edges of an emitted chunk. `import(...)` is not one. */
export function staticImportSpecifiers(source) {
  const specifiers = new Set()
  const fromPattern =
    /\b(?:import|export)\s*[^"'();]*?\bfrom\s*["']([^"']+)["']/g
  const sideEffectPattern = /\bimport\s*["']([^"']+)["']/g

  for (const pattern of [fromPattern, sideEffectPattern]) {
    let match = pattern.exec(source)
    while (match !== null) {
      specifiers.add(match[1])
      match = pattern.exec(source)
    }
  }

  return [...specifiers]
}

function assertInsideDist(path, distDir) {
  const rel = relative(distDir, path)
  if (rel === '' || (!rel.startsWith(`..${sep}`) && rel !== '..')) return
  throw new Error(`Static import escaped dist: ${normalizePath(path)}`)
}

function resolveSpecifier(specifier, importer, distDir) {
  if (specifier.startsWith('/')) {
    const path = resolve(distDir, `.${specifier}`)
    assertInsideDist(path, distDir)
    return path
  }
  if (!specifier.startsWith('.')) return null
  const path = resolve(dirname(importer), specifier)
  assertInsideDist(path, distDir)
  return path
}

function sourceMapSpecifier(source) {
  const matches = [...source.matchAll(/sourceMappingURL=([^\s]+)/g)]
  return matches.at(-1)?.[1] ?? null
}

/**
 * What a chunk was built from, by its source map, or null when it names no
 * map. A null is not a pass: `judgeFirstPaint` cannot clear such a chunk.
 */
async function chunkSources(chunkPath, source, distDir) {
  const specifier = sourceMapSpecifier(source)
  if (specifier === null || specifier.startsWith('data:')) return null
  const mapPath = resolve(dirname(chunkPath), specifier)
  assertInsideDist(mapPath, distDir)
  const map = JSON.parse(await readFile(mapPath, 'utf8'))
  if (!Array.isArray(map.sources)) return null
  return map.sources
    .filter((entry) => typeof entry === 'string')
    .map(normalizePath)
}

/** The static chunk closure of one document, heaviest chunk first. */
export async function firstPaintOf(documentPath, distDir) {
  const html = await readFile(documentPath, 'utf8')
  const queue = documentScriptUrls(html).map((url) =>
    resolveSpecifier(url, documentPath, distDir),
  )
  const sizes = new Map()
  const sourcesByChunk = new Map()

  while (queue.length > 0) {
    const chunkPath = queue.shift()
    if (chunkPath === undefined || chunkPath === null) continue
    if (sizes.has(chunkPath)) continue
    sizes.set(chunkPath, (await stat(chunkPath)).size)

    const source = await readFile(chunkPath, 'utf8')
    sourcesByChunk.set(
      chunkPath,
      await chunkSources(chunkPath, source, distDir),
    )
    for (const specifier of staticImportSpecifiers(source)) {
      const dependency = resolveSpecifier(specifier, chunkPath, distDir)
      if (dependency !== null && !sizes.has(dependency)) queue.push(dependency)
    }
  }

  const chunks = [...sizes]
    .map(([path, bytes]) => ({
      file: normalizePath(relative(distDir, path)),
      bytes,
      sources: sourcesByChunk.get(path) ?? null,
    }))
    .sort((a, b) => b.bytes - a.bytes)

  // No closure to walk here: Vite inlines @import at build time, so what the
  // document links is what the browser fetches.
  const stylesheets = []
  for (const url of documentStylesheetUrls(html)) {
    const sheetPath = resolveSpecifier(url, documentPath, distDir)
    if (sheetPath === null) continue
    stylesheets.push({
      file: normalizePath(relative(distDir, sheetPath)),
      bytes: (await stat(sheetPath)).size,
    })
  }
  stylesheets.sort((a, b) => b.bytes - a.bytes)

  return {
    chunks,
    bytes: chunks.reduce((total, chunk) => total + chunk.bytes, 0),
    stylesheets,
    cssBytes: stylesheets.reduce((total, sheet) => total + sheet.bytes, 0),
  }
}

/**
 * Every document the build emits that runs any JavaScript, keyed by its path
 * in dist ('mirror.html', 'learn/01.html'). Documents below the root count:
 * a page is not exempt for living in a folder. Only `assets/` is skipped,
 * since everything in it is something a document loads.
 */
export async function measureFirstPaint(distDirectory = 'dist') {
  const distDir = isAbsolute(distDirectory)
    ? resolve(distDirectory)
    : resolve(REPO_ROOT, distDirectory)
  const documents = (await readdir(distDir, { recursive: true }))
    .map(normalizePath)
    .filter((name) => name.endsWith('.html') && !name.startsWith('assets/'))
    .sort()

  const measured = new Map()
  for (const name of documents) {
    const result = await firstPaintOf(resolve(distDir, name), distDir)
    // A document with no script of its own (the 404 page) paints without any.
    if (result.chunks.length > 0) measured.set(name, result)
  }
  return measured
}

/**
 * Hold a measurement against the table.
 *
 * Three ways to fail, all of them loud: over the ceiling; a document with no
 * ceiling (a new page must not arrive unweighed); a ceiling for a document
 * the build no longer emits (a table that has drifted protects nothing).
 */
export function judgeFirstPaint(
  measured,
  budgets = FIRST_PAINT_BUDGETS_KB,
  cssBudgets = FIRST_PAINT_CSS_BUDGETS_KB,
  forbidden = FIRST_PAINT_FORBIDDEN_SOURCES,
) {
  const problems = []

  // The on-demand half. A chunk measured without `sources` predates this
  // check and is left alone; a chunk whose map is missing cannot be cleared.
  for (const [name, result] of measured) {
    for (const chunk of result.chunks) {
      if (chunk.sources === undefined) continue
      if (chunk.sources === null) {
        if (forbidden.length > 0) {
          problems.push(
            `${name}: cannot check its first paint for on-demand modules, because ${chunk.file} has no source map.`,
          )
        }
        continue
      }
      for (const rule of forbidden) {
        if (rule.documents !== undefined && !rule.documents.test(name)) continue
        const hit = chunk.sources.find((source) => rule.pattern.test(source))
        if (hit === undefined) continue
        problems.push(
          `${name} downloads ${rule.label} before first paint: ${hit} rides ${chunk.file}. ${rule.remedy ?? ON_DEMAND_REMEDY}`,
        )
      }
    }
  }

  for (const [name, result] of measured) {
    const budget = budgets[name]
    if (budget === undefined) {
      problems.push(
        `${name} has no first-paint budget. It weighs ${Math.ceil(result.bytes / KB)} KB; add it to FIRST_PAINT_BUDGETS_KB.`,
      )
      continue
    }
    if (result.bytes <= budget * KB) continue
    const heaviest = result.chunks
      .slice(0, 5)
      .map((chunk) => `    ${Math.ceil(chunk.bytes / KB)} KB  ${chunk.file}`)
      .join('\n')
    problems.push(
      `${name} downloads ${Math.ceil(result.bytes / KB)} KB of JavaScript before first paint; its budget is ${budget} KB (${result.chunks.length} static chunks). Heaviest:\n${heaviest}`,
    )
  }

  for (const name of Object.keys(budgets)) {
    if (!measured.has(name)) {
      problems.push(
        `FIRST_PAINT_BUDGETS_KB lists ${name}, which this build did not emit. Remove it, or find out why the page is gone.`,
      )
    }
  }

  // The stylesheet half. A measurement with no `cssBytes` predates this check
  // and is left alone; a document that links no stylesheet needs no ceiling,
  // and will be asked for one the moment it links its first.
  const cssWeighed = new Set()
  for (const [name, result] of measured) {
    if (result.cssBytes === undefined || result.cssBytes === 0) continue
    cssWeighed.add(name)
    const cssBudget = cssBudgets[name]
    if (cssBudget === undefined) {
      problems.push(
        `${name} has no first-paint CSS budget. It links ${Math.ceil(result.cssBytes / KB)} KB of render-blocking CSS; add it to FIRST_PAINT_CSS_BUDGETS_KB.`,
      )
      continue
    }
    if (result.cssBytes <= cssBudget * KB) continue
    const heaviest = (result.stylesheets ?? [])
      .slice(0, 5)
      .map((sheet) => `    ${Math.ceil(sheet.bytes / KB)} KB  ${sheet.file}`)
      .join('\n')
    problems.push(
      `${name} blocks first paint on ${Math.ceil(result.cssBytes / KB)} KB of CSS; its budget is ${cssBudget} KB (${result.stylesheets?.length ?? 0} stylesheets). Heaviest:\n${heaviest}`,
    )
  }

  // Two ways a CSS ceiling goes stale, and both are worth a word: the page is
  // gone, or the page is still here and its stylesheet is not. Without the
  // second case a document could keep its JavaScript, drop every stylesheet,
  // and leave a ceiling behind that no longer describes anything — the JS half
  // above catches its own version of this, so this half should too.
  for (const name of Object.keys(cssBudgets)) {
    if (!measured.has(name)) {
      problems.push(
        `FIRST_PAINT_CSS_BUDGETS_KB lists ${name}, which this build did not emit. Remove it, or find out why the page is gone.`,
      )
    } else if (!cssWeighed.has(name)) {
      problems.push(
        `FIRST_PAINT_CSS_BUDGETS_KB lists ${name}, which this build emitted no render-blocking CSS for. Remove it, or find out why the stylesheet is gone.`,
      )
    }
  }

  return problems
}

export function firstPaintReport(
  measured,
  budgets = FIRST_PAINT_BUDGETS_KB,
  cssBudgets = FIRST_PAINT_CSS_BUDGETS_KB,
) {
  const rows = [...measured].map(([name, result]) => {
    const budget = budgets[name]
    const cssBudget = cssBudgets[name]
    return [
      name,
      `${Math.ceil(result.bytes / KB)} KB js`,
      `${result.chunks.length} chunks`,
      budget === undefined ? 'no budget' : `budget ${budget} KB`,
      `${Math.ceil((result.cssBytes ?? 0) / KB)} KB css`,
      `${result.stylesheets?.length ?? 0} sheets`,
      cssBudget === undefined ? 'no budget' : `budget ${cssBudget} KB`,
    ]
  })
  const widths = [0, 1, 2, 3, 4, 5, 6].map((column) =>
    Math.max(...rows.map((row) => row[column].length)),
  )
  return rows
    .map((row) =>
      row
        .map((cell, column) =>
          column === 0
            ? cell.padEnd(widths[column])
            : cell.padStart(widths[column]),
        )
        .join('  '),
    )
    .join('\n')
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : ''
if (invokedPath === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2)
  const report = args.includes('--report')
  const distDirectory = args.find((arg) => !arg.startsWith('--')) ?? 'dist'
  try {
    const measured = await measureFirstPaint(distDirectory)
    if (report) {
      console.log(firstPaintReport(measured))
    } else {
      const problems = judgeFirstPaint(measured)
      if (problems.length > 0) {
        throw new Error(
          `First-paint budgets failed:\n${problems.map((problem) => `- ${problem}`).join('\n')}`,
        )
      }
      const js = [...measured.values()].reduce((t, r) => t + r.bytes, 0)
      const css = [...measured.values()].reduce(
        (t, r) => t + (r.cssBytes ?? 0),
        0,
      )
      console.log(
        `First-paint budgets passed: ${measured.size} documents weighed, ` +
          `${Math.ceil(js / KB)} KB of JavaScript and ${Math.ceil(css / KB)} KB of CSS across them.`,
      )
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}
