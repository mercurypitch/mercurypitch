#!/usr/bin/env node
/**
 * docs-sync — code-anchored documentation, in-repo.
 *
 * The idea: a doc page declares which source files it describes. We fingerprint
 * those sources and stamp the fingerprint into the doc's front matter. When the
 * sources change, the doc is flagged as drifted, and we can say precisely what
 * changed so an agent (or a human) can fix the page instead of guessing.
 *
 * Two fingerprints per doc, because they answer different questions:
 *
 *   content — sha256 over the raw bytes of every declared source file.
 *             Changed => something happened here.
 *   api     — sha256 over the *exported* surface only, extracted with the
 *             TypeScript compiler API. Changed => the contract this doc
 *             describes moved, so the prose is probably wrong now.
 *
 * That split is the whole trick. Naive drift detection flags every whitespace
 * change and teams learn to ignore it. Here an internal refactor is `minor`
 * (glance at it) while a signature change is `major` (the doc lies), so the
 * loud signal stays rare enough to be worth reading.
 *
 * Usage:
 *   node scripts/docs-sync.mjs <command> [options]
 *
 * Commands:
 *   status              Table of every tracked doc and its drift state
 *   check               CI gate: exit 1 when docs have drifted
 *   anchor [doc...]     Re-stamp anchors after updating docs (--all for every doc)
 *   plan                Work orders for drifted docs, ready to hand to an agent
 *   gaps                Source units with no doc, and tracked docs never anchored
 *   context             Regenerate the agent-facing manifest + lock file
 *
 * Options:
 *   --since <ref>       Only consider docs whose sources changed since <ref>
 *   --area <name>       Restrict to one area
 *   --strict            check: also fail on minor (implementation-only) drift
 *   --json              Machine-readable output
 *   --quiet             Suppress the human summary
 */

import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)))

// The TypeScript compiler is a devDependency here, but the tool must still work
// without it (fresh clone, no install) — we fall back to regex extraction and
// say so in the output rather than silently producing weaker fingerprints.
let ts = null
try {
  ts = (await import('typescript')).default
} catch {
  ts = null
}

// ── Config ─────────────────────────────────────────────────────

const CONFIG_PATH = join(ROOT, 'docs/docs-sync.config.json')

const DEFAULT_CONFIG = {
  docsGlobs: ['docs/**/*.md'],
  lockFile: 'docs/agents/docs-sync.lock.json',
  contextFile: 'docs/agents/context.json',
  coverage: { units: [], ignore: [] },
  commands: [],
  conventions: [],
}

function loadConfig() {
  if (!existsSync(CONFIG_PATH)) return { ...DEFAULT_CONFIG }
  const parsed = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'))
  return {
    ...DEFAULT_CONFIG,
    ...parsed,
    coverage: { ...DEFAULT_CONFIG.coverage, ...(parsed.coverage ?? {}) },
  }
}

const CONFIG = loadConfig()

// ── Small utilities ────────────────────────────────────────────

const sha = (input) => createHash('sha256').update(input).digest('hex')
const short = (hash) => (hash ? `sha256:${hash.slice(0, 16)}` : null)
const collapse = (text) => text.replace(/\s+/g, ' ').trim()
const escapeRe = (char) => char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const IGNORE_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', 'coverage', '.wrangler', '.vite',
  '.turbo', '.next', 'playwright-report', 'test-results', '.pnpm-store', 'venv',
])

let fileCache = null

/** Every tracked-ish file in the repo, as repo-relative posix paths. */
function allFiles() {
  if (fileCache) return fileCache
  const out = []
  const walk = (dir, prefix) => {
    let entries
    try {
      entries = readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      if (entry.name.startsWith('.') && entry.name !== '.github') continue
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name
      if (entry.isDirectory()) {
        if (IGNORE_DIRS.has(entry.name)) continue
        walk(join(dir, entry.name), rel)
      } else if (entry.isFile()) {
        out.push(rel)
      }
    }
  }
  walk(ROOT, '')
  out.sort()
  fileCache = out
  return out
}

/**
 * Glob to RegExp. Supports `**`, `*`, `?` and `{a,b}` — enough for source
 * declarations, and no dependency.
 */
function globToRegExp(glob) {
  let re = ''
  let i = 0
  while (i < glob.length) {
    const char = glob[i]
    if (char === '*') {
      if (glob[i + 1] === '*') {
        if (glob[i + 2] === '/') {
          re += '(?:[^/]*/)*' // `**/` also matches zero directories
          i += 3
          continue
        }
        re += '.*'
        i += 2
        continue
      }
      re += '[^/]*'
      i += 1
      continue
    }
    if (char === '?') {
      re += '[^/]'
      i += 1
      continue
    }
    if (char === '{') {
      const end = glob.indexOf('}', i)
      if (end !== -1) {
        const options = glob.slice(i + 1, end).split(',').map((o) => o.split('').map(escapeRe).join(''))
        re += `(?:${options.join('|')})`
        i = end + 1
        continue
      }
    }
    re += escapeRe(char)
    i += 1
  }
  return new RegExp(`^${re}$`)
}

/** A bare directory path means "everything under it". */
function expandPattern(pattern) {
  if (/[*?{]/.test(pattern)) return pattern
  const abs = join(ROOT, pattern)
  if (existsSync(abs) && statSync(abs).isDirectory()) {
    return `${pattern.replace(/\/$/, '')}/**/*`
  }
  return pattern
}

/**
 * Resolve source patterns to a concrete, sorted file list. `unmatched` is the
 * important half of the return value: a pattern that matches nothing means the
 * doc points at code that no longer exists.
 */
function resolveSources(patterns) {
  const files = allFiles()
  const includes = []
  const excludes = []
  for (const raw of patterns) {
    if (typeof raw !== 'string' || !raw.trim()) continue
    if (raw.startsWith('!')) {
      excludes.push(globToRegExp(expandPattern(raw.slice(1))))
    } else {
      includes.push({ pattern: raw, re: globToRegExp(expandPattern(raw)) })
    }
  }
  const matched = new Set()
  const unmatched = []
  for (const include of includes) {
    const hits = files.filter((f) => include.re.test(f))
    if (hits.length === 0) unmatched.push(include.pattern)
    for (const hit of hits) matched.add(hit)
  }
  const result = [...matched]
    .filter((f) => !excludes.some((re) => re.test(f)))
    .sort()
  return { files: result, unmatched }
}

// ── Exported-API extraction ────────────────────────────────────

const CODE_RE = /\.(ts|tsx|mts|cts|js|jsx|mjs|cjs)$/

function scriptKind(path) {
  if (path.endsWith('.tsx')) return ts.ScriptKind.TSX
  if (path.endsWith('.jsx')) return ts.ScriptKind.JSX
  if (/\.(js|mjs|cjs)$/.test(path)) return ts.ScriptKind.JS
  return ts.ScriptKind.TS
}

/**
 * Normalized signatures of everything a module exports, via the TS AST.
 *
 * Exported constant *values* are deliberately included: docs quote thresholds
 * ("warns after ~0.75s"), so a tuning change is exactly the kind of edit that
 * silently makes a page lie. Bodies are not included, so refactoring the
 * inside of a function is not an API change.
 */
function tsSignatures(path, text) {
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, scriptKind(path))
  const txt = (node) => (node ? collapse(node.getText(source)) : '')
  const isExported = (node) =>
    node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) ?? false
  const params = (node) => (node.parameters ?? []).map(txt).join(', ')
  const ret = (node) => (node.type ? `: ${txt(node.type)}` : '')
  const cap = (value) => (value.length > 240 ? `${value.slice(0, 240)}...` : value)

  const out = []
  for (const statement of source.statements) {
    if (ts.isExportDeclaration(statement)) {
      const names = statement.exportClause && ts.isNamedExports(statement.exportClause)
        ? statement.exportClause.elements.map((e) => txt(e)).sort().join(', ')
        : '*'
      const from = statement.moduleSpecifier ? ` from ${txt(statement.moduleSpecifier)}` : ''
      out.push(`re-export { ${names} }${from}`)
      continue
    }
    if (ts.isExportAssignment(statement)) {
      out.push(cap(`default = ${txt(statement.expression)}`))
      continue
    }
    if (!isExported(statement)) continue

    if (ts.isFunctionDeclaration(statement)) {
      out.push(`function ${txt(statement.name)}(${params(statement)})${ret(statement)}`)
    } else if (ts.isClassDeclaration(statement)) {
      const members = statement.members
        .filter((m) => !m.modifiers?.some((mod) => mod.kind === ts.SyntaxKind.PrivateKeyword))
        .map((m) => collapse(txt(m.name ?? m)).slice(0, 120))
        .sort()
      out.push(cap(`class ${txt(statement.name)} { ${members.join('; ')} }`))
    } else if (ts.isInterfaceDeclaration(statement)) {
      const members = statement.members.map(txt).sort()
      out.push(cap(`interface ${txt(statement.name)} { ${members.join(' ')} }`))
    } else if (ts.isTypeAliasDeclaration(statement)) {
      out.push(cap(`type ${txt(statement.name)} = ${txt(statement.type)}`))
    } else if (ts.isEnumDeclaration(statement)) {
      out.push(cap(`enum ${txt(statement.name)} { ${statement.members.map(txt).sort().join(', ')} }`))
    } else if (ts.isVariableStatement(statement)) {
      for (const decl of statement.declarationList.declarations) {
        const name = txt(decl.name)
        if (decl.type) {
          out.push(cap(`const ${name}: ${txt(decl.type)}`))
        } else if (decl.initializer && (ts.isArrowFunction(decl.initializer) || ts.isFunctionExpression(decl.initializer))) {
          out.push(`const ${name}(${params(decl.initializer)})${ret(decl.initializer)}`)
        } else if (decl.initializer && isLiteralish(decl.initializer)) {
          out.push(cap(`const ${name} = ${txt(decl.initializer)}`))
        } else {
          out.push(`const ${name}`)
        }
      }
    }
  }
  return out.sort()
}

function isLiteralish(node) {
  return (
    ts.isNumericLiteral(node) ||
    ts.isStringLiteral(node) ||
    ts.isNoSubstitutionTemplateLiteral(node) ||
    node.kind === ts.SyntaxKind.TrueKeyword ||
    node.kind === ts.SyntaxKind.FalseKeyword ||
    (ts.isPrefixUnaryExpression(node) && ts.isNumericLiteral(node.operand))
  )
}

/** Degraded extraction for when TypeScript is not installed. */
function regexSignatures(text) {
  const out = []
  const patterns = [
    /^export\s+(?:async\s+)?function\s+(\w+)/gm,
    /^export\s+(?:abstract\s+)?class\s+(\w+)/gm,
    /^export\s+interface\s+(\w+)/gm,
    /^export\s+type\s+(\w+)/gm,
    /^export\s+enum\s+(\w+)/gm,
    /^export\s+(?:const|let|var)\s+(\w+)/gm,
  ]
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) out.push(match[1])
  }
  return [...new Set(out)].sort()
}

function apiSignatures(path, text) {
  if (!CODE_RE.test(path)) return null
  try {
    return ts ? tsSignatures(path, text) : regexSignatures(text)
  } catch {
    return regexSignatures(text)
  }
}

// ── Fingerprinting ─────────────────────────────────────────────

function fingerprint(files) {
  const perFile = []
  for (const path of files) {
    let text
    try {
      text = readFileSync(join(ROOT, path), 'utf8').replace(/\r\n/g, '\n')
    } catch {
      continue
    }
    const symbols = apiSignatures(path, text)
    perFile.push({
      path,
      content: sha(text).slice(0, 16),
      api: symbols ? sha(symbols.join('\n')).slice(0, 16) : null,
      symbols,
    })
  }
  const contentHash = sha(perFile.map((f) => `${f.path}:${f.content}`).join('\n'))
  const apiParts = perFile.filter((f) => f.api !== null)
  const apiHash = apiParts.length > 0
    ? sha(apiParts.map((f) => `${f.path}:${f.api}`).join('\n'))
    : null
  return {
    content: short(contentHash),
    api: short(apiHash),
    files: perFile.length,
    perFile,
  }
}

// ── Front matter ───────────────────────────────────────────────

const FM_RE = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/

function parseScalar(raw) {
  let value = raw.trim()
  if (value.startsWith('#')) return ''
  const hash = value.indexOf(' #')
  if (hash !== -1) value = value.slice(0, hash).trim()
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1)
  }
  if (value.startsWith('[') && value.endsWith(']')) {
    const inner = value.slice(1, -1).trim()
    return inner ? inner.split(',').map((item) => parseScalar(item)) : []
  }
  if (value === 'true') return true
  if (value === 'false') return false
  if (/^-?\d{1,9}$/.test(value)) return Number(value)
  return value
}

/**
 * Deliberately a small subset of YAML: scalars, one level of nesting, and
 * lists of scalars. That is the whole doc schema, and a hand-rolled parser
 * beats a dependency for something every CI run and every agent has to load.
 */
function parseFrontMatter(text) {
  const data = {}
  const lines = text.split('\n')
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (!line.trim() || line.trimStart().startsWith('#')) {
      i += 1
      continue
    }
    const match = /^([A-Za-z0-9_-]+):[ \t]*(.*)$/.exec(line)
    if (!match) {
      i += 1
      continue
    }
    const [, key, rest] = match
    if (rest.trim()) {
      data[key] = parseScalar(rest)
      i += 1
      continue
    }
    const items = []
    const map = {}
    let sawList = false
    let sawMap = false
    let j = i + 1
    while (j < lines.length && /^\s+\S/.test(lines[j])) {
      const trimmed = lines[j].trim()
      if (trimmed.startsWith('- ')) {
        sawList = true
        items.push(parseScalar(trimmed.slice(2)))
      } else {
        const nested = /^([A-Za-z0-9_-]+):[ \t]*(.*)$/.exec(trimmed)
        if (nested) {
          sawMap = true
          map[nested[1]] = parseScalar(nested[2])
        }
      }
      j += 1
    }
    data[key] = sawList ? items : sawMap ? map : []
    i = j
  }
  return data
}

function renderAnchor(anchor) {
  const lines = ['anchor:']
  for (const [key, value] of Object.entries(anchor)) {
    if (value === null || value === undefined) continue
    lines.push(`  ${key}: ${value}`)
  }
  return lines
}

/**
 * Replace only the `anchor:` block, leaving every other front-matter line —
 * including comments and fields this tool does not know about — untouched.
 */
function patchAnchor(raw, anchor) {
  const match = FM_RE.exec(raw)
  if (!match) throw new Error('no front matter')
  const lines = match[1].split('\n')
  const block = renderAnchor(anchor)
  const start = lines.findIndex((line) => /^anchor:[ \t]*$/.test(line))
  if (start === -1) {
    lines.push(...block)
  } else {
    let end = start + 1
    while (end < lines.length && /^\s+\S/.test(lines[end])) end += 1
    lines.splice(start, end - start, ...block)
  }
  return `---\n${lines.join('\n')}\n---\n${raw.slice(match[0].length)}`
}

// ── Doc loading and drift evaluation ───────────────────────────

const STATE_ORDER = { broken: 0, major: 1, minor: 2, unanchored: 3, current: 4 }

function loadDocs() {
  const { files } = resolveSources(CONFIG.docsGlobs)
  const docs = []
  for (const path of files) {
    const raw = readFileSync(join(ROOT, path), 'utf8')
    const match = FM_RE.exec(raw)
    if (!match) continue
    const data = parseFrontMatter(match[1])
    const sources = Array.isArray(data.sources) ? data.sources : []
    if (sources.length === 0) continue // not opted in — plain prose doc
    docs.push({
      path,
      raw,
      data,
      id: data.doc_id || path,
      title: data.title || path,
      area: data.area || 'unassigned',
      status: data.status || 'current',
      sources,
      related: Array.isArray(data.related) ? data.related : [],
      anchor: data.anchor && typeof data.anchor === 'object' ? data.anchor : null,
    })
  }
  return docs.sort((a, b) => a.path.localeCompare(b.path))
}

function loadLock() {
  const path = join(ROOT, CONFIG.lockFile)
  if (!existsSync(path)) return {}
  try {
    return JSON.parse(readFileSync(path, 'utf8')).docs ?? {}
  } catch {
    return {}
  }
}

/** Symbol-level diff against the last anchored state, when the lock has it. */
function symbolDelta(doc, current, lock) {
  const previous = lock[doc.id]
  if (!previous?.files) return null
  const before = new Map(previous.files.map((f) => [f.path, f.symbols ?? []]))
  const after = new Map(current.perFile.map((f) => [f.path, f.symbols ?? []]))
  const added = []
  const removed = []
  const changedFiles = []
  for (const [path, symbols] of after) {
    const old = before.get(path)
    if (!old) {
      changedFiles.push(`${path} (new)`)
      for (const symbol of symbols ?? []) added.push(symbol)
      continue
    }
    const oldSet = new Set(old)
    const newSet = new Set(symbols ?? [])
    const gained = (symbols ?? []).filter((s) => !oldSet.has(s))
    const lost = old.filter((s) => !newSet.has(s))
    if (gained.length || lost.length) changedFiles.push(path)
    added.push(...gained)
    removed.push(...lost)
  }
  for (const [path, symbols] of before) {
    if (!after.has(path)) {
      changedFiles.push(`${path} (deleted)`)
      removed.push(...(symbols ?? []))
    }
  }
  return { added: added.sort(), removed: removed.sort(), changedFiles: [...new Set(changedFiles)].sort() }
}

function evaluate({ since = null, area = null } = {}) {
  const docs = loadDocs()
  const lock = loadLock()
  const touched = since ? changedSince(since) : null
  const results = []

  for (const doc of docs) {
    if (area && doc.area !== area) continue
    const { files, unmatched } = resolveSources(doc.sources)
    const current = fingerprint(files)

    let state
    if (unmatched.length > 0) {
      state = 'broken'
    } else if (!doc.anchor?.content) {
      state = 'unanchored'
    } else if (doc.anchor.content === current.content) {
      state = 'current'
    } else if (doc.anchor.api && current.api && doc.anchor.api === current.api) {
      state = 'minor'
    } else {
      state = 'major'
    }

    // With --since, a doc whose sources were untouched in this change set is
    // not this PR's problem: pre-existing drift shows in `status`, not the gate.
    const inScope = !touched || files.some((f) => touched.has(f))

    results.push({
      id: doc.id,
      path: doc.path,
      title: doc.title,
      area: doc.area,
      status: doc.status,
      state,
      inScope,
      sources: doc.sources,
      related: doc.related,
      files,
      unmatched,
      reviewed: doc.anchor?.reviewed ?? null,
      anchored: { content: doc.anchor?.content ?? null, api: doc.anchor?.api ?? null },
      current,
      delta: state === 'major' || state === 'minor' ? symbolDelta(doc, current, lock) : null,
    })
  }

  results.sort((a, b) => STATE_ORDER[a.state] - STATE_ORDER[b.state] || a.path.localeCompare(b.path))
  return results
}

function changedSince(ref) {
  try {
    const base = execFileSync('git', ['merge-base', ref, 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim()
    const out = execFileSync('git', ['diff', '--name-only', base], { cwd: ROOT, encoding: 'utf8' })
    return new Set(out.split('\n').filter(Boolean))
  } catch {
    warn(`could not diff against "${ref}" — falling back to checking every doc`)
    return null
  }
}

function headCommit() {
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim()
  } catch {
    return null
  }
}

// ── Output helpers ─────────────────────────────────────────────

let warnings = []
const warn = (message) => warnings.push(message)

function table(rows, headers) {
  const widths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => String(r[i] ?? '').length)),
  )
  const line = (cells) => cells.map((c, i) => String(c ?? '').padEnd(widths[i])).join('  ').trimEnd()
  return [line(headers), line(widths.map((w) => '-'.repeat(w))), ...rows.map(line)].join('\n')
}

const LABEL = {
  current: 'ok',
  minor: 'MINOR',
  major: 'MAJOR',
  broken: 'BROKEN',
  unanchored: 'NEW',
}

function summarize(results) {
  const counts = { current: 0, minor: 0, major: 0, broken: 0, unanchored: 0 }
  for (const r of results) counts[r.state] += 1
  return counts
}

// ── Commands ───────────────────────────────────────────────────

function cmdStatus(flags) {
  const results = evaluate({ since: flags.since, area: flags.area })
  if (flags.json) {
    print(JSON.stringify({ docs: results.map(stripHeavy), summary: summarize(results) }, null, 2))
    return 0
  }
  if (results.length === 0) {
    print('No tracked docs. Add a `sources:` list to a doc\'s front matter to track it.')
    return 0
  }
  const rows = results.map((r) => [
    LABEL[r.state],
    r.path,
    r.area,
    `${r.files.length} src`,
    r.reviewed ?? '-',
  ])
  print(table(rows, ['STATE', 'DOC', 'AREA', 'SOURCES', 'REVIEWED']))
  const counts = summarize(results)
  print('')
  print(
    `${results.length} tracked  |  ${counts.current} ok, ${counts.minor} minor, ` +
    `${counts.major} major, ${counts.broken} broken, ${counts.unanchored} new`,
  )
  if (counts.major || counts.broken) print('Run `pnpm docs:plan` for the work orders.')
  return 0
}

function cmdCheck(flags) {
  const results = evaluate({ since: flags.since, area: flags.area })
  const scoped = results.filter((r) => r.inScope)
  const failing = scoped.filter(
    (r) => r.state === 'major' || r.state === 'broken' || (flags.strict && r.state === 'minor'),
  )
  if (flags.json) {
    print(JSON.stringify({ ok: failing.length === 0, failing: failing.map(stripHeavy) }, null, 2))
    return failing.length === 0 ? 0 : 1
  }
  if (failing.length === 0) {
    const scope = flags.since ? ` (changed since ${flags.since})` : ''
    print(`docs-sync: ${scoped.length} tracked doc(s) in scope${scope}, no blocking drift.`)
    return 0
  }
  print(`docs-sync: ${failing.length} doc(s) out of sync with the code they describe.`)
  print('')
  for (const r of failing) {
    print(`  [${LABEL[r.state]}] ${r.path}`)
    if (r.state === 'broken') {
      for (const pattern of r.unmatched) print(`      declared source matches nothing: ${pattern}`)
    } else if (r.delta) {
      for (const file of r.delta.changedFiles.slice(0, 5)) print(`      changed: ${file}`)
      for (const symbol of r.delta.removed.slice(0, 3)) print(`      -  ${symbol}`)
      for (const symbol of r.delta.added.slice(0, 3)) print(`      +  ${symbol}`)
    }
  }
  print('')
  print('Update the docs, then re-stamp them with `pnpm docs:anchor <doc>`.')
  print('Run `pnpm docs:plan` to get the full work orders.')
  return 1
}

function cmdAnchor(flags, positional) {
  const results = evaluate({ area: flags.area })
  const targets = flags.all
    ? results
    : results.filter((r) => positional.some((p) => r.path === p || r.path.endsWith(`/${p}`) || r.id === p))

  if (targets.length === 0) {
    print('Nothing to anchor. Pass a doc path, or --all.')
    return positional.length > 0 ? 1 : 0
  }

  const commit = headCommit()
  const reviewed = new Date().toISOString().slice(0, 10)
  const lockDocs = loadLock()
  let stamped = 0

  for (const target of targets) {
    if (target.state === 'broken') {
      print(`  skip   ${target.path} — declared sources match nothing: ${target.unmatched.join(', ')}`)
      continue
    }
    const raw = readFileSync(join(ROOT, target.path), 'utf8')
    const patched = patchAnchor(raw, {
      content: target.current.content,
      api: target.current.api ?? 'none',
      files: target.current.files,
      reviewed,
      commit: commit ?? 'unknown',
    })
    if (patched !== raw) {
      writeFileSync(join(ROOT, target.path), patched)
      stamped += 1
      print(`  anchor ${target.path} (${target.current.files} sources)`)
    } else {
      print(`  ok     ${target.path}`)
    }
    lockDocs[target.id] = {
      path: target.path,
      content: target.current.content,
      api: target.current.api,
      files: target.current.perFile.map((f) => ({ path: f.path, content: f.content, api: f.api, symbols: f.symbols })),
    }
  }

  writeLock(lockDocs)
  writeContext()
  print('')
  print(`Anchored ${stamped} doc(s). Lock and agent context regenerated.`)
  return 0
}

function cmdPlan(flags) {
  const results = evaluate({ since: flags.since, area: flags.area })
  const work = results.filter((r) => r.state !== 'current' && r.inScope)
  if (flags.json) {
    print(JSON.stringify({ workOrders: work.map(stripHeavy) }, null, 2))
    return 0
  }
  if (work.length === 0) {
    print('# Docs work orders\n\nNothing to do — every tracked doc matches its sources.')
    return 0
  }
  const out = ['# Docs work orders', '']
  out.push(`${work.length} doc(s) need attention. Highest severity first.`, '')
  for (const r of work) {
    out.push(`## ${r.path} — ${LABEL[r.state]}`)
    out.push('')
    out.push(`- Area: ${r.area}`)
    out.push(`- Sources: ${r.sources.join(', ')}`)
    if (r.reviewed) out.push(`- Last reviewed: ${r.reviewed}`)
    if (r.state === 'broken') {
      out.push(`- Declared sources matching nothing: ${r.unmatched.join(', ')}`)
      out.push('')
      out.push('Fix: the code moved or was deleted. Update `sources:` to the new paths, or retire the doc.')
    } else if (r.state === 'unanchored') {
      out.push('')
      out.push('Fix: doc has never been anchored. Verify it against the sources, then anchor it.')
    } else {
      if (r.delta?.changedFiles.length) {
        out.push('- Changed files:')
        for (const file of r.delta.changedFiles) out.push(`  - ${file}`)
      }
      if (r.delta?.removed.length) {
        out.push('- Removed from the public surface:')
        for (const symbol of r.delta.removed) out.push(`  - ${symbol}`)
      }
      if (r.delta?.added.length) {
        out.push('- Added to the public surface:')
        for (const symbol of r.delta.added) out.push(`  - ${symbol}`)
      }
      out.push('')
      out.push(
        r.state === 'major'
          ? 'Fix: the exported surface moved, so this page is probably wrong. Read the changed files and rewrite the affected sections.'
          : 'Fix: implementation-only change. Confirm the page still reads true; usually no edit is needed.',
      )
    }
    out.push('')
    out.push(`Then: \`pnpm docs:anchor ${r.path}\``)
    out.push('')
  }
  print(out.join('\n'))
  return 0
}

function cmdGaps(flags) {
  const results = evaluate({ area: flags.area })
  const covered = new Set()
  for (const r of results) for (const file of r.files) covered.add(file)

  const ignore = (CONFIG.coverage.ignore ?? []).map((p) => globToRegExp(expandPattern(p)))
  const units = []
  for (const pattern of CONFIG.coverage.units ?? []) {
    // A unit pattern names a *bucket*, not a file: `src/features/*` is one row
    // per feature directory, with everything beneath it rolled up. So match the
    // pattern against each file's prefix at the pattern's own depth.
    const re = globToRegExp(pattern)
    const depth = pattern.split('/').length
    for (const file of allFiles()) {
      if (ignore.some((ig) => ig.test(file))) continue
      const segments = file.split('/')
      if (segments.length < depth) continue
      const unit = segments.slice(0, depth).join('/')
      if (!re.test(unit)) continue
      let entry = units.find((u) => u.unit === unit)
      if (!entry) {
        entry = { unit, files: 0, documented: 0 }
        units.push(entry)
      }
      entry.files += 1
      if (covered.has(file)) entry.documented += 1
    }
  }
  units.sort((a, b) => a.documented / a.files - b.documented / b.files || b.files - a.files)

  const uncovered = units.filter((u) => u.documented === 0)
  const partial = units.filter((u) => u.documented > 0 && u.documented < u.files)
  const neverAnchored = results.filter((r) => r.state === 'unanchored')

  if (flags.json) {
    print(JSON.stringify({ units, uncovered, partial, neverAnchored: neverAnchored.map(stripHeavy) }, null, 2))
    return 0
  }
  if (units.length === 0) {
    print('No coverage units configured. Add `coverage.units` to docs/docs-sync.config.json.')
    return 0
  }
  print(`Coverage: ${units.length - uncovered.length}/${units.length} units have at least one anchored doc.`)
  print('')
  if (uncovered.length > 0) {
    print('Undocumented units:')
    print(table(uncovered.map((u) => [u.unit, `${u.files} files`]), ['UNIT', 'SIZE']))
    print('')
  }
  if (partial.length > 0) {
    print('Partially documented units:')
    print(table(
      partial.map((u) => [u.unit, `${u.documented}/${u.files} files anchored`]),
      ['UNIT', 'COVERAGE'],
    ))
    print('')
  }
  if (neverAnchored.length > 0) {
    print('Tracked but never anchored:')
    for (const r of neverAnchored) print(`  ${r.path}`)
    print('')
  }
  return 0
}

function cmdContext(flags) {
  const context = writeContext()
  const lockDocs = loadLock()
  // Keep the lock in step with any doc whose anchor was hand-edited.
  writeLock(lockDocs)
  if (flags.json) {
    print(JSON.stringify(context, null, 2))
    return 0
  }
  print(`Wrote ${CONFIG.contextFile} (${context.docs.length} docs, ${context.drifted.length} drifted).`)
  return 0
}

// ── Generated artifacts ────────────────────────────────────────

function writeJson(relPath, value) {
  const abs = join(ROOT, relPath)
  mkdirSync(dirname(abs), { recursive: true })
  writeFileSync(abs, `${JSON.stringify(value, null, 2)}\n`)
}

function writeLock(docs) {
  writeJson(CONFIG.lockFile, {
    // Deliberately no timestamp: generated artifacts must be byte-stable so CI
    // can regenerate and diff them.
    version: 1,
    note: 'Generated by scripts/docs-sync.mjs. Do not edit by hand.',
    docs: Object.fromEntries(Object.entries(docs).sort(([a], [b]) => a.localeCompare(b))),
  })
}

/**
 * The agent-facing manifest — the local stand-in for Moxie's MCP payload. An
 * agent reads this one file to learn what is documented, what is known-stale,
 * which commands are verified, and where the gaps are.
 */
function writeContext() {
  const results = evaluate({})
  const areas = {}
  for (const r of results) {
    areas[r.area] ??= []
    areas[r.area].push(r.id)
  }
  const context = {
    version: 1,
    note: 'Generated by scripts/docs-sync.mjs (`pnpm docs:context`). Do not edit by hand.',
    readFirst: CONFIG.conventions,
    commands: CONFIG.commands,
    areas: Object.fromEntries(
      Object.entries(areas).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, v.sort()]),
    ),
    docs: results.map((r) => ({
      id: r.id,
      title: r.title,
      path: r.path,
      area: r.area,
      state: r.state,
      reviewed: r.reviewed,
      sources: r.sources,
      related: r.related,
    })),
    drifted: results
      .filter((r) => r.state === 'major' || r.state === 'minor' || r.state === 'broken')
      .map((r) => ({ id: r.id, path: r.path, state: r.state, changedFiles: r.delta?.changedFiles ?? r.unmatched })),
  }
  writeJson(CONFIG.contextFile, context)
  return context
}

function stripHeavy(result) {
  const { current, ...rest } = result
  return { ...rest, fingerprint: { content: current.content, api: current.api, files: current.files } }
}

// ── CLI ────────────────────────────────────────────────────────

const BOOLEAN_FLAGS = new Set(['json', 'all', 'strict', 'quiet', 'help'])

function parseArgs(args) {
  const flags = {}
  const positional = []
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (!arg.startsWith('--')) {
      positional.push(arg)
      continue
    }
    const eq = arg.indexOf('=')
    const key = eq === -1 ? arg.slice(2) : arg.slice(2, eq)
    if (eq !== -1) {
      flags[key] = arg.slice(eq + 1)
    } else if (BOOLEAN_FLAGS.has(key)) {
      flags[key] = true
    } else {
      flags[key] = args[++i] ?? ''
    }
  }
  return { flags, positional }
}

const buffered = []
const print = (line) => buffered.push(line)

const COMMANDS = {
  status: cmdStatus,
  check: cmdCheck,
  anchor: cmdAnchor,
  plan: cmdPlan,
  gaps: cmdGaps,
  context: cmdContext,
}

function main() {
  const [command = 'status', ...rest] = process.argv.slice(2)
  const { flags, positional } = parseArgs(rest)

  if (flags.help || command === 'help' || command === '--help') {
    process.stdout.write(`${readFileSync(fileURLToPath(import.meta.url), 'utf8').split('*/')[0].replace(/^#!.*\n/, '').replace(/^\/\*\*\n/, '').replace(/^ \* ?/gm, '')}\n`)
    return 0
  }

  const handler = COMMANDS[command]
  if (!handler) {
    process.stderr.write(`docs-sync: unknown command "${command}". Try: ${Object.keys(COMMANDS).join(', ')}\n`)
    return 2
  }

  if (!ts) warn('typescript not installed — API fingerprints are regex-derived and less precise')

  const code = handler(flags, positional)
  if (!flags.quiet) {
    for (const message of warnings) process.stderr.write(`docs-sync: warning: ${message}\n`)
  }
  process.stdout.write(`${buffered.join('\n')}\n`)
  return code
}

process.exitCode = main()
