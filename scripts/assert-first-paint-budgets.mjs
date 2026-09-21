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

  // Karaoke Night and its two other doors. Measured 352 (was 3063).
  'karaoke-night.html': 440,
  'karaoke.html': 440,
  'vocal-remover.html': 440,

  // Measured 1432 (was 3822). Most of it is the room itself.
  'guitar-night.html': 1800,

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
 * `404.html` is absent on purpose: it links the 3 KB prelude but runs no
 * script, and `measureFirstPaint` only weighs documents that run one.
 */
export const FIRST_PAINT_CSS_BUDGETS_KB = {
  // The Voice Mirror and its three doors, and the glass room. Measured 26,
  // 26, 26, 26 and 24 -- nearly all of it one page-scoped sheet.
  'mirror.html': 40,
  'vocal-range-test.html': 40,
  'voice-type-test.html': 40,
  'which-singer-has-my-vocal-range.html': 40,
  'glass.html': 40,

  // Karaoke Night and its two other doors. Measured 67.
  'karaoke-night.html': 90,
  'karaoke.html': 90,
  'vocal-remover.html': 90,

  // The night rooms. Measured 74, 98 and 316; the room's own sheet is 48,
  // 82 and 262 KB of that, which is where any reduction has to come from.
  'piano-night.html': 95,
  'drum-night.html': 125,
  'guitar-night.html': 400,

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

/** The static chunk closure of one document, heaviest chunk first. */
export async function firstPaintOf(documentPath, distDir) {
  const html = await readFile(documentPath, 'utf8')
  const queue = documentScriptUrls(html).map((url) =>
    resolveSpecifier(url, documentPath, distDir),
  )
  const sizes = new Map()

  while (queue.length > 0) {
    const chunkPath = queue.shift()
    if (chunkPath === undefined || chunkPath === null) continue
    if (sizes.has(chunkPath)) continue
    sizes.set(chunkPath, (await stat(chunkPath)).size)

    const source = await readFile(chunkPath, 'utf8')
    for (const specifier of staticImportSpecifiers(source)) {
      const dependency = resolveSpecifier(specifier, chunkPath, distDir)
      if (dependency !== null && !sizes.has(dependency)) queue.push(dependency)
    }
  }

  const chunks = [...sizes]
    .map(([path, bytes]) => ({
      file: normalizePath(relative(distDir, path)),
      bytes,
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

/** Every document at the root of the build that runs any JavaScript. */
export async function measureFirstPaint(distDirectory = 'dist') {
  const distDir = isAbsolute(distDirectory)
    ? resolve(distDirectory)
    : resolve(REPO_ROOT, distDirectory)
  const documents = (await readdir(distDir))
    .filter((name) => name.endsWith('.html'))
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
) {
  const problems = []

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
  for (const [name, result] of measured) {
    if (result.cssBytes === undefined || result.cssBytes === 0) continue
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

  for (const name of Object.keys(cssBudgets)) {
    if (!measured.has(name)) {
      problems.push(
        `FIRST_PAINT_CSS_BUDGETS_KB lists ${name}, which this build did not emit. Remove it, or find out why the page is gone.`,
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
