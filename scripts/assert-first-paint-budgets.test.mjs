// First-paint budget tests build a tiny dist on disk and weigh it.
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { documentScriptUrls, documentStylesheetUrls, FIRST_PAINT_BUDGETS_KB, FIRST_PAINT_CSS_BUDGETS_KB, firstPaintOf, judgeFirstPaint, measureFirstPaint, staticImportSpecifiers, } from './assert-first-paint-budgets.mjs'

const KB = 1024

/** A dist with the files given, each padded to the size asked for. */
function distWith(t, files) {
  const dist = mkdtempSync(join(tmpdir(), 'first-paint-budgets-test-'))
  t.after(() => rmSync(dist, { recursive: true, force: true }))
  mkdirSync(join(dist, 'assets'))
  for (const [name, { source = '', bytes }] of Object.entries(files)) {
    const padding =
      bytes === undefined ? '' : ' '.repeat(Math.max(0, bytes - source.length))
    writeFileSync(join(dist, name), source + padding)
  }
  return dist
}

const page = (...scripts) =>
  `<html><head>${scripts
    .map((src) => `<script type="module" crossorigin src="${src}"></script>`)
    .join('')}</head></html>`

test('reads the scripts a document asks for, and nothing else in it', () => {
  assert.deepEqual(
    documentScriptUrls(
      `${page('/assets/a.js', '/assets/b.js')}<link rel="stylesheet" href="/assets/a.css"><link rel="modulepreload" href="/assets/c.js">`,
    ),
    ['/assets/a.js', '/assets/b.js', '/assets/c.js'],
  )
})

test('a dynamic import is not a static edge', () => {
  assert.deepEqual(
    staticImportSpecifiers(
      'import{a}from"./a.js";import"./side.js";export{b}from"./b.js";const later=()=>import("./lazy.js")',
    ),
    ['./a.js', './b.js', './side.js'],
  )
})

test('weighs the static closure once, and leaves intent-loaded code out', async (t) => {
  const dist = distWith(t, {
    'room.html': { source: page('/assets/entry.js', '/assets/shared.js') },
    'assets/entry.js': {
      source:
        'import"./shared.js";import{x}from"./leaf.js";const later=()=>import("./lazy.js")',
      bytes: 10 * KB,
    },
    'assets/shared.js': { source: 'import"./leaf.js"', bytes: 4 * KB },
    'assets/leaf.js': { bytes: 2 * KB },
    'assets/lazy.js': { bytes: 900 * KB },
  })

  const result = await firstPaintOf(join(dist, 'room.html'), dist)

  assert.equal(result.bytes, 16 * KB)
  assert.deepEqual(
    result.chunks.map((chunk) => chunk.file),
    ['assets/entry.js', 'assets/shared.js', 'assets/leaf.js'],
  )
})

test('a document that runs no script is not weighed', async (t) => {
  const dist = distWith(t, {
    '404.html': { source: '<html><body>Nothing here.</body></html>' },
    'room.html': { source: page('/assets/entry.js') },
    'assets/entry.js': { bytes: KB },
  })

  const measured = await measureFirstPaint(dist)

  assert.deepEqual([...measured.keys()], ['room.html'])
})

test('refuses an import that leaves the build', async (t) => {
  const dist = distWith(t, {
    'room.html': { source: page('/assets/entry.js') },
    'assets/entry.js': { source: 'import"../../outside.js"' },
  })

  await assert.rejects(
    firstPaintOf(join(dist, 'room.html'), dist),
    /escaped dist/,
  )
})

const weighed = (bytes, files = ['assets/entry.js']) => ({
  bytes,
  chunks: files.map((file, index) => ({
    file,
    bytes: index === 0 ? bytes : 0,
  })),
})

test('passes a page inside its budget', () => {
  assert.deepEqual(
    judgeFirstPaint(
      new Map([['room.html', weighed(300 * KB)]]),
      { 'room.html': 300 },
      {},
    ),
    [],
  )
})

test('fails a page over its budget, and names what is heavy in it', () => {
  const problems = judgeFirstPaint(
    new Map([
      [
        'room.html',
        weighed(3100 * KB, ['assets/advanced-abc.js', 'assets/entry.js']),
      ],
    ]),
    { 'room.html': 430 },
    {},
  )

  assert.equal(problems.length, 1)
  assert.match(problems[0], /room\.html downloads 3100 KB/)
  assert.match(problems[0], /budget is 430 KB/)
  assert.match(problems[0], /3100 KB {2}assets\/advanced-abc\.js/)
})

test('fails a page nobody has weighed yet', () => {
  const problems = judgeFirstPaint(
    new Map([['new-room.html', weighed(200 * KB)]]),
    {},
    {},
  )

  assert.equal(problems.length, 1)
  assert.match(problems[0], /new-room\.html has no first-paint budget/)
  assert.match(problems[0], /200 KB/)
})

test('fails a budget for a page the build no longer emits', () => {
  const problems = judgeFirstPaint(new Map(), { 'gone.html': 100 }, {})

  assert.equal(problems.length, 1)
  assert.match(problems[0], /gone\.html, which this build did not emit/)
})

test('every ceiling in the table is a whole number of KB, for a document', () => {
  const entries = Object.entries(FIRST_PAINT_BUDGETS_KB)
  assert.ok(entries.length > 0)
  for (const [name, budget] of entries) {
    assert.match(name, /^[a-z0-9-]+\.html$/)
    assert.ok(Number.isInteger(budget) && budget > 0, `${name}: ${budget}`)
  }
})

// ── The stylesheet half ──────────────────────────────────────────────

const styled = (css, cssFiles = ['assets/main.css']) => ({
  bytes: KB,
  chunks: [{ file: 'assets/entry.js', bytes: KB }],
  cssBytes: css,
  stylesheets: cssFiles.map((file, index) => ({
    file,
    bytes: index === 0 ? css : 0,
  })),
})

test('reads only the stylesheets a document blocks on', () => {
  assert.deepEqual(
    documentStylesheetUrls(
      '<link rel="stylesheet" href="/assets/a.css">' +
        '<link rel="stylesheet" crossorigin href="/assets/b.css">' +
        '<link href="/assets/c.css" rel="stylesheet">' +
        '<link rel="preload" as="style" href="/assets/preloaded.css">' +
        '<link rel="prefetch" href="/assets/prefetched.css">' +
        '<link rel="modulepreload" href="/assets/entry.js">' +
        '<link rel="stylesheet" href="/assets/a.css">',
    ),
    ['/assets/a.css', '/assets/b.css', '/assets/c.css'],
  )
})

test('weighs the stylesheets a document links, heaviest first', async (t) => {
  const dist = distWith(t, {
    'room.html': {
      source:
        page('/assets/entry.js') +
        '<link rel="stylesheet" href="/assets/small.css">' +
        '<link rel="stylesheet" href="/assets/global.css">' +
        '<link rel="preload" as="style" href="/assets/not-blocking.css">',
    },
    'assets/entry.js': { bytes: KB },
    'assets/small.css': { bytes: 3 * KB },
    'assets/global.css': { bytes: 80 * KB },
    'assets/not-blocking.css': { bytes: 500 * KB },
  })

  const result = await firstPaintOf(join(dist, 'room.html'), dist)

  assert.equal(result.cssBytes, 83 * KB)
  assert.deepEqual(
    result.stylesheets.map((sheet) => sheet.file),
    ['assets/global.css', 'assets/small.css'],
  )
  // The script half is unchanged by any of it.
  assert.equal(result.bytes, KB)
})

test('passes a page inside its CSS budget', () => {
  assert.deepEqual(
    judgeFirstPaint(
      new Map([['room.html', styled(80 * KB)]]),
      { 'room.html': 1 },
      { 'room.html': 90 },
    ),
    [],
  )
})

test('fails a page over its CSS budget, and names the heavy sheet', () => {
  const problems = judgeFirstPaint(
    new Map([
      [
        'room.html',
        styled(900 * KB, ['assets/index-global.css', 'assets/room.css']),
      ],
    ]),
    { 'room.html': 1 },
    { 'room.html': 40 },
  )

  assert.equal(problems.length, 1)
  assert.match(problems[0], /room\.html blocks first paint on 900 KB of CSS/)
  assert.match(problems[0], /budget is 40 KB/)
  assert.match(problems[0], /900 KB {2}assets\/index-global\.css/)
})

test('fails a page that links CSS nobody has weighed', () => {
  const problems = judgeFirstPaint(
    new Map([['new-room.html', styled(26 * KB)]]),
    { 'new-room.html': 1 },
    {},
  )

  assert.equal(problems.length, 1)
  assert.match(problems[0], /new-room\.html has no first-paint CSS budget/)
  assert.match(problems[0], /26 KB of render-blocking CSS/)
})

test('a page that links no stylesheet needs no CSS budget', () => {
  assert.deepEqual(
    judgeFirstPaint(
      new Map([['room.html', styled(0, [])]]),
      { 'room.html': 1 },
      {},
    ),
    [],
  )
})

test('a measurement taken without cssBytes is left alone', () => {
  assert.deepEqual(
    judgeFirstPaint(
      new Map([['room.html', weighed(300 * KB)]]),
      { 'room.html': 300 },
      {},
    ),
    [],
  )
})

test('fails a CSS budget for a page the build no longer emits', () => {
  const problems = judgeFirstPaint(new Map(), {}, { 'gone.html': 100 })

  assert.equal(problems.length, 1)
  assert.match(
    problems[0],
    /FIRST_PAINT_CSS_BUDGETS_KB lists gone\.html, which this build did not emit/,
  )
})

test('every CSS ceiling is a whole number of KB, for a document', () => {
  const entries = Object.entries(FIRST_PAINT_CSS_BUDGETS_KB)
  assert.ok(entries.length > 0)
  for (const [name, budget] of entries) {
    assert.match(name, /^[a-z0-9-]+\.html$/)
    assert.ok(Number.isInteger(budget) && budget > 0, `${name}: ${budget}`)
  }
})

test('every page with a JS ceiling has a CSS ceiling', () => {
  // Both tables describe the same set of documents. A page added to one and
  // not the other is how a gate half-covers a surface.
  assert.deepEqual(
    Object.keys(FIRST_PAINT_CSS_BUDGETS_KB).sort(),
    Object.keys(FIRST_PAINT_BUDGETS_KB).sort(),
  )
})
