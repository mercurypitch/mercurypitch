#!/usr/bin/env node
// ============================================================
// Code metrics harness — every claim in docs/agent/CODE-HEALTH.md
// is produced by this script, so the report cannot quietly rot.
// ============================================================
//
// Usage:
//   node scripts/code-metrics.mjs              # human-readable table
//   node scripts/code-metrics.mjs --json       # machine-readable
//   node scripts/code-metrics.mjs --check      # exit 1 if a metric regressed
//   node scripts/code-metrics.mjs --update     # rewrite the baseline
//
// The --check mode is a RATCHET, not an absolute gate. Absolute thresholds on
// a 250k-LOC codebase either sit so far above reality that they never fire, or
// so far below it that the build is red forever and people learn to ignore it.
// A ratchet asks one question instead: is this worse than the last agreed
// baseline? That question has a useful answer on day one.
//
// Metrics that need a heavy external tool (eslint with the audit config,
// dependency-cruiser, jscpd, type-coverage) are collected only when that tool
// is present; they are reported as "skipped" otherwise so a contributor
// without the optional devDependencies still gets the cheap metrics.

import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const BASELINE_PATH = join(ROOT, 'docs/agent/code-metrics.baseline.json')

const args = process.argv.slice(2)
const asJson = args.includes('--json')
const checkMode = args.includes('--check')
const updateMode = args.includes('--update')

// ------------------------------------------------------------
// Source inventory
// ------------------------------------------------------------

const SOURCE_ROOTS = ['src', 'workers', 'packages', 'apps']
const SKIP_DIRS = new Set(['node_modules', 'dist', 'coverage', '.git', 'build', '.wrangler'])

/** Every TS/TSX file under the source roots, repo-relative. */
function collectSourceFiles() {
  const out = []

  function walk(dir) {
    let entries
    try {
      entries = readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      if (SKIP_DIRS.has(entry.name)) continue
      const full = join(dir, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith('.d.ts')) {
        out.push(relative(ROOT, full))
      }
    }
  }

  for (const root of SOURCE_ROOTS) walk(join(ROOT, root))
  return out.sort()
}

const isTest = (f) => /\.(test|spec)\.tsx?$/.test(f) || f.startsWith('src/e2e/')

/** Which architectural layer a file belongs to, for per-layer reporting. */
function layerOf(file) {
  if (isTest(file)) return 'test'
  if (file.startsWith('src/lib/')) return 'lib'
  if (file.startsWith('src/features/')) return 'features'
  if (file.startsWith('src/components/')) return 'components'
  if (file.startsWith('src/stores/')) return 'stores'
  if (file.startsWith('src/db/')) return 'db'
  if (file.startsWith('src/pages/')) return 'pages'
  if (file.startsWith('workers/')) return 'workers'
  if (file.startsWith('packages/') || file.startsWith('apps/')) return 'beside-cue'
  return 'other'
}

// ------------------------------------------------------------
// Cheap metrics — no external tooling, always available
// ------------------------------------------------------------

function fileSizeMetrics(files) {
  const rows = []
  for (const f of files) {
    const lines = readFileSync(join(ROOT, f), 'utf8').split('\n').length
    rows.push({ file: f, lines, layer: layerOf(f) })
  }
  const prod = rows.filter((r) => r.layer !== 'test')
  const sorted = [...prod].sort((a, b) => b.lines - a.lines)
  const total = prod.reduce((n, r) => n + r.lines, 0)

  const byLayer = {}
  for (const r of rows) {
    const l = (byLayer[r.layer] ??= { files: 0, lines: 0, over800: 0, over1500: 0 })
    l.files += 1
    l.lines += r.lines
    if (r.lines > 800) l.over800 += 1
    if (r.lines > 1500) l.over1500 += 1
  }

  return {
    productionFiles: prod.length,
    productionLines: total,
    testFiles: rows.length - prod.length,
    testLines: rows.filter((r) => r.layer === 'test').reduce((n, r) => n + r.lines, 0),
    filesOver500: prod.filter((r) => r.lines > 500).length,
    filesOver800: prod.filter((r) => r.lines > 800).length,
    filesOver1500: prod.filter((r) => r.lines > 1500).length,
    largest: sorted.slice(0, 25).map((r) => ({ file: r.file, lines: r.lines })),
    byLayer,
  }
}

/**
 * Count regex hits across a file set, so every count in the report is
 * re-derivable. Comment lines are skipped: prose like "any gap here is a bug"
 * matches the `any` patterns and would inflate the type-discipline numbers.
 */
const COMMENT_LINE = /^\s*(\/\/|\/\*|\*)/

function countPattern(files, regex) {
  let n = 0
  const hits = []
  for (const f of files) {
    const src = readFileSync(join(ROOT, f), 'utf8')
    const lines = src.split('\n')
    for (let i = 0; i < lines.length; i++) {
      if (COMMENT_LINE.test(lines[i])) continue
      const m = lines[i].match(regex)
      if (m) {
        n += m.length
        if (hits.length < 40) hits.push(`${f}:${i + 1}`)
      }
    }
  }
  return { count: n, sample: hits }
}

function escapeHatchMetrics(files) {
  const prod = files.filter((f) => !isTest(f))
  return {
    explicitAny: countPattern(prod, /\bas any\b|:\s*any\b|<any>/g).count,
    tsIgnore: countPattern(files, /@ts-(ignore|nocheck)/g).count,
    tsExpectError: countPattern(files, /@ts-expect-error/g).count,
    nonNullAssertions: countPattern(prod, /\w!\./g).count,
    eslintDisable: countPattern(prod, /eslint-disable/g).count,
    todoComments: countPattern(prod, /\b(TODO|FIXME|HACK|XXX)\b/g).count,
  }
}

/**
 * Layer-boundary violations, derived from import specifiers.
 *
 * This duplicates a subset of what dependency-cruiser checks, deliberately:
 * dependency-cruiser is an optional devDependency, and the layering numbers are
 * the headline architecture metric. They must be available with zero install.
 */
const LAYER_RULES = [
  { name: 'lib-no-features', from: 'src/lib/', to: /(^|\/)features\// },
  { name: 'lib-no-components', from: 'src/lib/', to: /(^|\/)components\// },
  { name: 'lib-no-stores', from: 'src/lib/', to: /(^|\/)stores\// },
  { name: 'components-no-features', from: 'src/components/', to: /(^|\/)features\// },
  { name: 'stores-no-features', from: 'src/stores/', to: /(^|\/)features\// },
  { name: 'stores-no-components', from: 'src/stores/', to: /(^|\/)components\// },
  { name: 'db-no-ui', from: 'src/db/', to: /(^|\/)(features|components|pages)\// },
]

const IMPORT_RE = /(?:^|\n)\s*(?:import|export)\s[^;\n]*?from\s+['"]([^'"]+)['"]/g

function layeringMetrics(files) {
  const result = {}
  const detail = {}
  for (const rule of LAYER_RULES) {
    result[rule.name] = 0
    detail[rule.name] = []
  }

  for (const f of files) {
    if (isTest(f)) continue
    const src = readFileSync(join(ROOT, f), 'utf8')
    const specifiers = [...src.matchAll(IMPORT_RE)].map((m) => m[1])
    for (const rule of LAYER_RULES) {
      if (!f.startsWith(rule.from)) continue
      for (const spec of specifiers) {
        // Only relative and @/-aliased specifiers address our own layers.
        if (!spec.startsWith('.') && !spec.startsWith('@/')) continue
        if (rule.to.test(spec)) {
          result[rule.name] += 1
          if (detail[rule.name].length < 30) detail[rule.name].push(`${f} -> ${spec}`)
        }
      }
    }
  }

  // Feature-to-feature coupling: a feature importing a sibling feature.
  let crossFeature = 0
  const crossFeatureDetail = []
  for (const f of files) {
    if (isTest(f) || !f.startsWith('src/features/')) continue
    const own = f.split('/')[2]
    const src = readFileSync(join(ROOT, f), 'utf8')
    for (const m of src.matchAll(IMPORT_RE)) {
      const spec = m[1]
      const hit = /(?:^|\/)features\/([^/'"]+)/.exec(spec)
      if (hit && hit[1] !== own) {
        crossFeature += 1
        if (crossFeatureDetail.length < 30) crossFeatureDetail.push(`${f} -> ${spec}`)
      }
    }
  }

  return {
    violations: result,
    totalErrors: Object.values(result).reduce((a, b) => a + b, 0),
    crossFeatureImports: crossFeature,
    detail: { ...detail, crossFeature: crossFeatureDetail },
  }
}

/**
 * Test-shape metrics. Answers the question "are these real tests?" with numbers
 * rather than opinion: a test whose every matcher is a presence or truthiness
 * check would still pass if the feature under it were gutted.
 */
const WEAK_MATCHERS = new Set(['toBeInTheDocument', 'toBeVisible', 'toBeTruthy', 'toBeDefined'])
const MATCHER_RE =
  /\.(toBeInTheDocument|toBeVisible|toBeTruthy|toBeDefined|toBe|toEqual|toStrictEqual|toBeCloseTo|toHaveBeenCalled\w*|toHaveTextContent|toHaveAttribute|toContain\w*|toMatch\w*|toThrow\w*|toBeNull|toBeGreaterThan\w*|toBeLessThan\w*|toHaveLength|toBeFalsy|toBeUndefined|toHaveProperty|toSatisfy)\b/g

function testShapeMetrics(files) {
  const testFiles = files.filter((f) => /\.(test)\.tsx?$/.test(f))
  let blocks = 0
  let presenceOnly = 0
  let noAssertion = 0
  const presenceByFile = {}

  for (const f of testFiles) {
    const src = readFileSync(join(ROOT, f), 'utf8')
    const chunks = src.split(/\n\s*(?:it|test)(?:\.\w+)?\(/).slice(1)
    for (const chunk of chunks) {
      blocks += 1
      if (!chunk.includes('expect(')) {
        noAssertion += 1
        continue
      }
      const matchers = [...chunk.matchAll(MATCHER_RE)].map((m) => m[1])
      if (matchers.length > 0 && matchers.every((m) => WEAK_MATCHERS.has(m))) {
        presenceOnly += 1
        presenceByFile[f] = (presenceByFile[f] ?? 0) + 1
      }
    }
  }

  const e2eFiles = files.filter((f) => f.startsWith('src/e2e/') && f.endsWith('.spec.ts'))
  let hardWaits = 0
  let e2eNoAssertion = 0
  for (const f of e2eFiles) {
    const src = readFileSync(join(ROOT, f), 'utf8')
    hardWaits += (src.match(/waitForTimeout/g) ?? []).length
    if (!src.includes('expect(')) e2eNoAssertion += 1
  }

  // Assertions that cannot fail. A Playwright locator count is a non-negative
  // integer by construction, so asserting it is >= 0 tests nothing at all —
  // the test passes whether or not the element exists.
  const alwaysTrue = []
  for (const f of [...testFiles, ...e2eFiles]) {
    const lines = readFileSync(join(ROOT, f), 'utf8').split('\n')
    for (let i = 0; i < lines.length; i++) {
      const m = /expect\(\s*([A-Za-z_$][\w$.?[\]]*)\s*\)\.toBeGreaterThanOrEqual\(\s*0\s*\)/.exec(
        lines[i],
      )
      if (m == null) continue
      const root = m[1].split('.')[0]
      const prior = lines.slice(Math.max(0, i - 25), i).join('\n')
      if (new RegExp(`\\b${root}\\s*=[^\\n]*\\.count\\(\\)`).test(prior)) {
        alwaysTrue.push(`${f}:${i + 1}`)
      }
    }
  }

  return {
    unitTestFiles: testFiles.length,
    testBlocks: blocks,
    presenceOnlyBlocks: presenceOnly,
    presenceOnlyPct: blocks ? +((presenceOnly / blocks) * 100).toFixed(2) : 0,
    blocksWithoutAssertion: noAssertion,
    e2eSpecFiles: e2eFiles.length,
    e2eHardWaits: hardWaits,
    e2eSpecsWithoutAssertion: e2eNoAssertion,
    alwaysTrueAssertions: alwaysTrue.length,
    alwaysTrueSites: alwaysTrue.slice(0, 20),
    worstPresenceOnly: Object.entries(presenceByFile)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([file, count]) => ({ file, count })),
  }
}

// ------------------------------------------------------------
// Optional metrics — require a tool that may not be installed
// ------------------------------------------------------------

function tryRun(cmd, cmdArgs, opts = {}) {
  try {
    return execFileSync(cmd, cmdArgs, {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 256 * 1024 * 1024,
      ...opts,
    })
  } catch (error) {
    // Lint-style tools exit non-zero when they find something; that output is
    // still the result we want.
    if (error.stdout != null && error.stdout !== '') return error.stdout
    return null
  }
}

function hasLocalBin(name) {
  return existsSync(join(ROOT, 'node_modules/.bin', name))
}

/** Cognitive and cyclomatic complexity, via the existing audit ESLint config. */
function complexityMetrics() {
  if (!existsSync(join(ROOT, 'eslint.audit.config.js')) || !hasLocalBin('eslint')) {
    return { skipped: 'eslint.audit.config.js or eslint not available' }
  }

  const raw = tryRun(join(ROOT, 'node_modules/.bin/eslint'), [
    '-c',
    'eslint.audit.config.js',
    '--format',
    'json',
    'src',
    'workers',
  ])
  if (raw == null) return { skipped: 'audit lint run produced no output' }

  let results
  try {
    results = JSON.parse(raw)
  } catch {
    return { skipped: 'audit lint output was not JSON' }
  }

  const cognitive = []
  const byRule = {}
  for (const file of results) {
    for (const msg of file.messages) {
      const rule = msg.ruleId ?? '(none)'
      byRule[rule] = (byRule[rule] ?? 0) + 1
      if (rule === 'sonarjs/cognitive-complexity') {
        const m = /from (\d+) to/.exec(msg.message)
        cognitive.push({
          value: m ? Number(m[1]) : 0,
          location: `${relative(ROOT, file.filePath)}:${msg.line}`,
        })
      }
    }
  }
  cognitive.sort((a, b) => b.value - a.value)

  const bucket = (min, max) => cognitive.filter((c) => c.value >= min && c.value <= max).length
  return {
    totalAuditWarnings: Object.values(byRule).reduce((a, b) => a + b, 0),
    functionsOverCognitive15: cognitive.length,
    cognitiveOver100: bucket(100, Infinity),
    cognitiveOver50: bucket(50, Infinity),
    cognitiveOver30: bucket(30, Infinity),
    worstCognitive: cognitive.slice(0, 20),
    topRules: Object.entries(byRule)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([rule, count]) => ({ rule, count })),
  }
}

/** Import cycles, via dependency-cruiser when installed. */
function cycleMetrics() {
  if (!hasLocalBin('depcruise')) return { skipped: 'dependency-cruiser not installed' }
  const raw = tryRun(join(ROOT, 'node_modules/.bin/depcruise'), [
    '--config',
    '.dependency-cruiser.cjs',
    '--output-type',
    'json',
    'src',
  ])
  if (raw == null) return { skipped: 'depcruise produced no output' }
  try {
    const parsed = JSON.parse(raw)
    const violations = parsed.summary.violations ?? []
    const byRule = {}
    for (const v of violations) byRule[v.rule.name] = (byRule[v.rule.name] ?? 0) + 1
    return {
      modules: parsed.modules.length,
      errors: parsed.summary.error,
      warnings: parsed.summary.warn,
      circular: byRule['no-circular'] ?? 0,
      byRule,
    }
  } catch {
    return { skipped: 'depcruise output was not JSON' }
  }
}

/** Copy-paste duplication, via jscpd when installed. */
function duplicationMetrics() {
  if (!hasLocalBin('jscpd')) return { skipped: 'jscpd not installed' }
  const out = join(ROOT, 'node_modules/.cache/jscpd-metrics')
  tryRun(join(ROOT, 'node_modules/.bin/jscpd'), [
    'src',
    'workers',
    '--min-tokens',
    '70',
    '--reporters',
    'json',
    '--output',
    out,
    '--format',
    'typescript,tsx',
    '--ignore',
    '**/*.test.ts,**/*.test.tsx,**/*.spec.ts',
    '--silent',
  ])
  const report = join(out, 'jscpd-report.json')
  if (!existsSync(report)) return { skipped: 'jscpd report not produced' }
  try {
    const { statistics } = JSON.parse(readFileSync(report, 'utf8'))
    return {
      clones: statistics.total.clones,
      duplicatedLinePct: +statistics.total.percentage.toFixed(2),
      duplicatedTokenPct: +statistics.total.percentageTokens.toFixed(2),
    }
  } catch {
    return { skipped: 'jscpd report was not readable' }
  }
}

// ------------------------------------------------------------
// Report
// ------------------------------------------------------------

const files = collectSourceFiles()
const metrics = {
  generatedFrom: 'scripts/code-metrics.mjs',
  size: fileSizeMetrics(files),
  escapeHatches: escapeHatchMetrics(files),
  layering: layeringMetrics(files),
  tests: testShapeMetrics(files),
  complexity: complexityMetrics(),
  cycles: cycleMetrics(),
  duplication: duplicationMetrics(),
}

// The ratchet compares only scalars that should never grow. Everything else in
// the JSON is context for a human reading the report.
const RATCHET_KEYS = [
  ['size.filesOver800', (m) => m.size.filesOver800],
  ['size.filesOver1500', (m) => m.size.filesOver1500],
  ['escapeHatches.explicitAny', (m) => m.escapeHatches.explicitAny],
  ['escapeHatches.tsIgnore', (m) => m.escapeHatches.tsIgnore],
  ['layering.totalErrors', (m) => m.layering.totalErrors],
  ['layering.crossFeatureImports', (m) => m.layering.crossFeatureImports],
  ['tests.presenceOnlyBlocks', (m) => m.tests.presenceOnlyBlocks],
  ['tests.blocksWithoutAssertion', (m) => m.tests.blocksWithoutAssertion],
  ['tests.e2eHardWaits', (m) => m.tests.e2eHardWaits],
  ['tests.e2eSpecsWithoutAssertion', (m) => m.tests.e2eSpecsWithoutAssertion],
  ['tests.alwaysTrueAssertions', (m) => m.tests.alwaysTrueAssertions],
  ['complexity.functionsOverCognitive15', (m) => m.complexity.functionsOverCognitive15],
  ['complexity.cognitiveOver50', (m) => m.complexity.cognitiveOver50],
  ['cycles.errors', (m) => m.cycles.errors],
  ['cycles.circular', (m) => m.cycles.circular],
]

function currentRatchet() {
  const out = {}
  for (const [key, read] of RATCHET_KEYS) {
    const value = read(metrics)
    if (typeof value === 'number') out[key] = value
  }
  return out
}

if (updateMode) {
  writeFileSync(BASELINE_PATH, `${JSON.stringify(currentRatchet(), null, 2)}\n`)
  console.info(`Baseline written to ${relative(ROOT, BASELINE_PATH)}`)
  process.exit(0)
}

if (asJson) {
  console.log(JSON.stringify(metrics, null, 2))
  process.exit(0)
}

if (checkMode) {
  if (!existsSync(BASELINE_PATH)) {
    console.error(`No baseline at ${relative(ROOT, BASELINE_PATH)} — run with --update first.`)
    process.exit(1)
  }
  const baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'))
  const current = currentRatchet()
  const regressions = []
  const improvements = []
  for (const [key, value] of Object.entries(current)) {
    const was = baseline[key]
    if (was == null) continue
    if (value > was) regressions.push(`${key}: ${was} -> ${value} (+${value - was})`)
    else if (value < was) improvements.push(`${key}: ${was} -> ${value} (-${was - value})`)
  }
  for (const line of improvements) console.info(`improved  ${line}`)
  if (regressions.length > 0) {
    console.error('\nCode health regressed against the baseline:\n')
    for (const line of regressions) console.error(`  ${line}`)
    console.error(
      '\nFix the regression, or if the growth is deliberate and justified, ' +
        'run `node scripts/code-metrics.mjs --update` and explain it in the commit message.',
    )
    process.exit(1)
  }
  console.info(`\nNo regressions against ${relative(ROOT, BASELINE_PATH)}.`)
  if (improvements.length > 0) {
    console.info('Run --update to lock in the improvements above.')
  }
  process.exit(0)
}

// Default: human-readable summary.
const { size, escapeHatches, layering, tests, complexity, cycles, duplication } = metrics
const row = (label, value) => console.info(`  ${label.padEnd(38)} ${value}`)

console.info('\nMercuryPitch code metrics\n' + '='.repeat(60))

console.info('\nSIZE')
row('production files (ts/tsx)', size.productionFiles)
row('production lines', size.productionLines.toLocaleString())
row('test files', size.testFiles)
row('test lines', size.testLines.toLocaleString())
row('files over 500 lines', size.filesOver500)
row('files over 800 lines', size.filesOver800)
row('files over 1500 lines', size.filesOver1500)

console.info('\nTYPE DISCIPLINE')
row('explicit any (production)', escapeHatches.explicitAny)
row('@ts-ignore / @ts-nocheck', escapeHatches.tsIgnore)
row('@ts-expect-error', escapeHatches.tsExpectError)
row('non-null assertions', escapeHatches.nonNullAssertions)
row('eslint-disable directives', escapeHatches.eslintDisable)
row('TODO/FIXME/HACK/XXX', escapeHatches.todoComments)

console.info('\nLAYERING (an architecture rule broken is an error)')
for (const [name, count] of Object.entries(layering.violations)) row(name, count)
row('TOTAL layering errors', layering.totalErrors)
row('cross-feature imports (warn)', layering.crossFeatureImports)

console.info('\nTESTS')
row('unit test files', tests.unitTestFiles)
row('test blocks', tests.testBlocks)
row('presence-only blocks', `${tests.presenceOnlyBlocks} (${tests.presenceOnlyPct}%)`)
row('blocks with no assertion', tests.blocksWithoutAssertion)
row('e2e spec files', tests.e2eSpecFiles)
row('e2e hard waits (waitForTimeout)', tests.e2eHardWaits)
row('e2e specs with no assertion', tests.e2eSpecsWithoutAssertion)
row('assertions that cannot fail', tests.alwaysTrueAssertions)

console.info('\nCOMPLEXITY')
if (complexity.skipped != null) row('skipped', complexity.skipped)
else {
  row('audit warnings (all rules)', complexity.totalAuditWarnings)
  row('functions over cognitive 15', complexity.functionsOverCognitive15)
  row('  of those, over 30', complexity.cognitiveOver30)
  row('  of those, over 50', complexity.cognitiveOver50)
  row('  of those, over 100', complexity.cognitiveOver100)
}

console.info('\nCYCLES')
if (cycles.skipped != null) row('skipped', cycles.skipped)
else {
  row('modules cruised', cycles.modules)
  row('import cycles', cycles.circular)
  row('rule errors', cycles.errors)
  row('rule warnings', cycles.warnings)
}

console.info('\nDUPLICATION')
if (duplication.skipped != null) row('skipped', duplication.skipped)
else {
  row('clones', duplication.clones)
  row('duplicated lines %', duplication.duplicatedLinePct)
  row('duplicated tokens %', duplication.duplicatedTokenPct)
}

console.info('\nLARGEST PRODUCTION FILES')
for (const f of size.largest.slice(0, 12)) row(f.file, f.lines)

console.info('\nRun with --json for the full record, --check to ratchet against the baseline.\n')
