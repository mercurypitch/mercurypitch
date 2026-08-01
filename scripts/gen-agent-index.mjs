#!/usr/bin/env node
// ============================================================
// Agent index generator
// ============================================================
//
// Builds the mechanical half of docs/agent/INDEX.md straight from the
// filesystem, so the map an agent reads can never drift from the code it
// describes. Module blurbs are harvested from each file's leading comment
// block -- the docs live next to the code and are updated by whoever edits it.
//
// Hand-written prose (gotchas, "start here" pointers, invariants) lives
// OUTSIDE the generated markers and is preserved verbatim across runs.
//
//   node scripts/gen-agent-index.mjs           # rewrite the generated blocks
//   node scripts/gen-agent-index.mjs --check   # CI: fail if stale
//
// ============================================================

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join, relative, basename, extname, dirname } from 'node:path'

const ROOT = process.cwd()
const OUT = join(ROOT, 'docs/agent/INDEX.md')
const OUT_DIR = dirname(OUT)
const CHECK = process.argv.includes('--check')

const CODE_EXT = new Set(['.ts', '.tsx'])
const SKIP_DIR = new Set(['node_modules', 'dist', '__tests__'])
/**
 * Dot-directories are tool state and build caches -- .wrangler, .vite, .git.
 * They are gitignored, so they exist on a developer's machine and not on CI,
 * and counting them makes the index depend on whose machine generated it:
 * `.wrangler/tmp/**\/middleware-loader.entry.ts` alone moved db-worker from
 * 8.1k to 8.3k and failed docs:index:check on a tree that was locally clean.
 * No source lives under a dot-directory, so skip the lot.
 */
const skipDir = (name) => SKIP_DIR.has(name) || name.startsWith('.')
const isTest = (p) => /\.(test|spec)\.[tj]sx?$/.test(p) || p.includes('/e2e/')

/** Every code file under `dir`, recursively, excluding tests and build output. */
function walk(dir, acc = []) {
  if (!existsSync(dir)) return acc
  for (const name of readdirSync(dir)) {
    if (skipDir(name)) continue
    const full = join(dir, name)
    const st = statSync(full)
    if (st.isDirectory()) walk(full, acc)
    else if (CODE_EXT.has(extname(name)) && !isTest(full)) acc.push(full)
  }
  return acc
}

const loc = (file) => readFileSync(file, 'utf8').split('\n').length

/**
 * Pull the first meaningful sentence out of a file's leading comment block.
 * Handles `//`, `/* *\/` and the repo's `// ===` banner style. Returns '' when
 * the file has no header comment -- an empty blurb is an honest signal that the
 * file needs one, not something to paper over with a guess.
 */
function blurb(file) {
  const src = readFileSync(file, 'utf8')
  return leadingComment(src) || jsdocAboveExport(src)
}

/** A `/** ... *\/` block sitting directly above the first export. */
function jsdocAboveExport(src) {
  const m = src.match(
    /\/\*\*([\s\S]*?)\*\/\s*\n\s*export\s+(?:default\s+)?(?:async\s+)?(?:function|const|class|interface|type)\b/,
  )
  if (!m) return ''
  const text = m[1]
    .split('\n')
    .map((l) => l.replace(/^\s*\*?\s?/, '').trim())
    .filter((l) => l && !l.startsWith('@'))
    .join(' ')
    .replace(/\s+/g, ' ')
  return cap(text)
}

function cap(text) {
  if (!text) return ''
  const m = text.match(/^(.{0,140}?[.。])(\s|$)/)
  if (m) return m[1].trim()
  return text.length > 140 ? `${text.slice(0, 137).trim()}...` : text.trim()
}

/** The banner/comment block at the very top of the file, before any code. */
function leadingComment(src) {
  const lines = src.split('\n')
  const out = []
  for (const raw of lines.slice(0, 40)) {
    const line = raw.trim()
    if (!line) {
      if (out.length) break
      continue
    }
    if (line.startsWith('//') || line.startsWith('/*') || line.startsWith('*')) {
      const text = line
        .replace(/^\/\*+|^\*+\/?|^\/\/+/g, '')
        .replace(/[=─—-]{4,}/g, '')
        .trim()
      if (text) out.push(text)
      continue
    }
    break
  }
  if (!out.length) return ''
  // First line is usually "Name — what it is"; keep through the first sentence,
  // capped so one chatty header can't dominate the table.
  return cap(out.join(' ').replace(/\s+/g, ' '))
}

/** Best entry point for a module dir: index, an App/View/Panel, else biggest. */
function entryOf(files, dirName) {
  // `stem-mixer` -> `StemMixer`, so useStemMixerController can be recognised as
  // *this* module's controller rather than just any controller.
  const pascal = dirName.replace(/(^|-)([a-z])/g, (_, __, c) => c.toUpperCase())
  const score = (f) => {
    const b = basename(f)
    if (/^index\.tsx?$/.test(b)) return 6
    if (new RegExp(`^${dirName}`, 'i').test(b)) return 5
    if (new RegExp(`^use${pascal}[A-Za-z]*\\.tsx?$`).test(b)) return 4
    if (/(App|View|Page|Runtime)\.tsx?$/.test(b)) return 3
    if (/^use[A-Z].*Controller\.tsx?$/.test(b)) return 2
    return 1
  }
  // Name breaks the final tie: readdirSync order differs between machines,
  // so without it a score-and-LOC tie picks a different entry point here
  // than on CI, and docs:index:check fails on a tree that is locally clean.
  return [...files].sort(
    (a, b) => score(b) - score(a) || loc(b) - loc(a) || a.localeCompare(b),
  )[0]
}

/** Repo-root-relative path -- what we *show*, because it is what you grep for. */
const rel = (f) => relative(ROOT, f)

/**
 * Link target relative to the index file's own directory. INDEX.md lives in
 * docs/agent/, so a repo-root path like `src/lib/x.ts` would resolve to
 * `docs/agent/src/lib/x.ts` and 404 in GitHub and most editors.
 */
const href = (relPath) => relative(OUT_DIR, join(ROOT, relPath))

/** Markdown link: readable root-relative text, correctly resolving target. */
const link = (text, relPath) => `[${text}](${href(relPath)})`

const fmtLoc = (n) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n))

/** Table of every subdirectory of `base` treated as a module. */
function dirTable(base, label) {
  const dir = join(ROOT, base)
  if (!existsSync(dir)) return ''
  const rows = readdirSync(dir)
    .filter((n) => !skipDir(n) && statSync(join(dir, n)).isDirectory())
    .map((name) => {
      const files = walk(join(dir, name))
      if (!files.length) return null
      const entry = entryOf(files, name)
      const total = files.reduce((s, f) => s + loc(f), 0)
      return { name, entry: rel(entry), loc: total, blurb: blurb(entry) }
    })
    .filter(Boolean)
    .sort((a, b) => b.loc - a.loc || a.name.localeCompare(b.name))

  if (!rows.length) return ''
  const body = rows
    .map((r) => `| \`${r.name}\` | ${link(basename(r.entry), r.entry)} | ${fmtLoc(r.loc)} | ${r.blurb || '_(no header comment)_'} |`)
    .join('\n')
  return `#### ${label}\n\n| Module | Entry point | LOC | What it is |\n|---|---|---|---|\n${body}\n`
}

/** Table of loose files directly inside `base` (no subdir grouping). */
function fileTable(base, label, { min = 0, limit = Infinity } = {}) {
  const dir = join(ROOT, base)
  if (!existsSync(dir)) return ''
  const rows = readdirSync(dir)
    .filter((n) => CODE_EXT.has(extname(n)) && !isTest(join(base, n)))
    .map((n) => {
      const full = join(dir, n)
      return { name: n, path: rel(full), loc: loc(full), blurb: blurb(full) }
    })
    .filter((r) => r.loc >= min)
    .sort((a, b) => b.loc - a.loc || a.name.localeCompare(b.name))
    .slice(0, limit)

  if (!rows.length) return ''
  const body = rows
    .map((r) => `| ${link(r.name, r.path)} | ${fmtLoc(r.loc)} | ${r.blurb || '_(no header comment)_'} |`)
    .join('\n')
  return `#### ${label}\n\n| File | LOC | What it is |\n|---|---|---|\n${body}\n`
}

/** Files big enough that reading them whole is a context-budget decision. */
function heavyFiles(threshold = 1200) {
  const files = [...walk(join(ROOT, 'src')), ...walk(join(ROOT, 'workers'))]
    .map((f) => ({ path: rel(f), loc: loc(f) }))
    .filter((r) => r.loc >= threshold)
    .sort((a, b) => b.loc - a.loc || a.path.localeCompare(b.path))
  if (!files.length) return ''
  const body = files.map((r) => `| ${link(r.path, r.path)} | ${fmtLoc(r.loc)} |`).join('\n')
  return [
    `Reading any of these end-to-end costs roughly ${fmtLoc(threshold)}+ lines of context.`,
    `Grep for the symbol and read the surrounding range instead.`,
    ``,
    `| File | LOC |`,
    `|---|---|`,
    body,
  ].join('\n')
}

function scriptTable() {
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
  const body = Object.entries(pkg.scripts ?? {})
    .map(([k, v]) => `| \`pnpm ${k}\` | \`${v}\` |`)
    .join('\n')
  return `| Script | Runs |\n|---|---|\n${body}`
}

const SECTIONS = {
  'module-map': [
    dirTable('src/features', 'Features (`src/features/`) — self-contained user-facing surfaces'),
    dirTable('src/lib', 'Library subsystems (`src/lib/<dir>/`) — algorithm packages'),
    fileTable('src/lib', 'Core library files (`src/lib/*.ts`, 400+ LOC)', { min: 400 }),
    fileTable('src/stores', 'Stores (`src/stores/`) — global reactive state'),
    fileTable('src/pages', 'Pages (`src/pages/`) — route-level shells'),
    dirTable('workers', 'Cloudflare Workers (`workers/`) — backend'),
  ]
    .filter(Boolean)
    .join('\n'),
  'heavy-files': heavyFiles(),
  scripts: scriptTable(),
}

// ── Splice generated blocks into the existing file, preserving prose ──
if (!existsSync(OUT)) {
  console.error(`${rel(OUT)} not found -- create it with the marker comments first.`)
  process.exit(1)
}

const before = readFileSync(OUT, 'utf8')
let after = before
for (const [key, content] of Object.entries(SECTIONS)) {
  const re = new RegExp(
    `(<!-- BEGIN:GENERATED ${key} -->\\n)[\\s\\S]*?(<!-- END:GENERATED ${key} -->)`,
  )
  if (!re.test(after)) {
    console.error(`Missing markers for section "${key}" in ${rel(OUT)}`)
    process.exit(1)
  }
  after = after.replace(re, `$1${content}\n$2`)
}

if (CHECK) {
  if (after !== before) {
    console.error(
      `${rel(OUT)} is stale. Run: node scripts/gen-agent-index.mjs`,
    )
    process.exit(1)
  }
  console.log(`${rel(OUT)} is up to date.`)
} else if (after !== before) {
  writeFileSync(OUT, after)
  console.log(`Updated ${rel(OUT)}`)
} else {
  console.log(`${rel(OUT)} already up to date.`)
}
