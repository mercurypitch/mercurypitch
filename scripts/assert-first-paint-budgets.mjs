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

  // The Voice Mirror and the three pages that open it. Measured 344 -- and
  // 3149 before the broad manualChunks rules were deleted, which is the
  // regression this table exists to catch.
  'mirror.html': 430,
  'vocal-range-test.html': 430,
  'voice-type-test.html': 430,
  'which-singer-has-my-vocal-range.html': 430,

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
  'learn/02.html': 165,

  // Lesson 3, a draft lesson (src/features/lessons/kit/drafts.ts), built in
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
  'learn/03.html': 131,
  // Lesson 5, a draft too, built in every mode as Lesson 3 is. Measured 122
  // with the lesson menu and the next-lesson card (109 before them), and 129
  // with the page state.
  // The listener and the hold reader arrive when Sing it's Start is pressed,
  // the reader for the hold demo's readouts once Step 5 comes near: Voice
  // Mirror's scorer stays off first paint only while both imports stay
  // dynamic. The same headroom as Lessons 1 to 3, a quarter over.
  'learn/05.html': 136,

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
  'learn/04.html': 129,
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

  // The main app, and the crawlable doors that are the main app. Measured
  // 4669. It is eager by design today, so this is a ceiling on growth rather
  // than a claim that the number is good.
  'index.html': 5400,
  'jam.html': 5400,
  'jam-rooms.html': 5400,
  'ear-lab.html': 5400,
  'pitch-training.html': 5400,
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

  // Lesson 3 (a draft, as above). Measured 77: the kit's sheets, the voice
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
 * advice, for a module that a chunk of its own would not keep off a page.
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
