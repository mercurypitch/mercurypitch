// What CI runs for each event, by maff's decision of 30 Oct 2026: a pull
// request runs a smoke tier, main runs the heavy suites, and the native apps
// reach TestFlight only from their release tags. A pull request with every
// surface in scope started 85 jobs, about 300 Linux and 33 macOS runner minutes
// (sample medians, 23 to 30 Oct 2026), and every merge that touched a Beside
// Cue path uploaded a TestFlight build nobody had asked for. These tests hold
// the tiers in place:
//
// - PR Gate's full browser suite and both Beside Cue browser suites never run
//   on a pull request, and still run on main and on a dispatch.
// - A pull request runs the @smoke browser set instead, built the way the full
//   suite is built, and the required `PR Gate` job waits for it.
// - No native workflow runs on a pull request, and no native app uploads to
//   TestFlight from main.
// - A pull request's scope is its own diff against current main: the first
//   parent of GitHub's test merge, not pull_request.base.sha, which can be
//   older than main (PR 1174 ran the adventure matrix for a skills change that
//   way).
//
// See docs/agent/TESTING.md, "E2E is expensive", for the trade-off.

import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync, } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { parse } from 'yaml'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const GATE = '.github/workflows/pr-gate.yml'
const BUILD = '.github/workflows/build.yml'
const CAPACITOR = '.github/workflows/capacitor-app.yml'
const MERCURYPITCH = '.github/workflows/mercurypitch-mobile.yml'
const BESIDE_CUE = '.github/workflows/beside-cue-mobile.yml'
const GAMES = '.github/workflows/beside-cue-games-native.yml'
const HEAVY = ['e2e', 'beside-cue-browser', 'beside-cue-adventure-browser']

const readYaml = (path) => parse(readFileSync(join(ROOT, path), 'utf8'))

const truthy = (value) =>
  value !== null &&
  value !== undefined &&
  value !== false &&
  value !== '' &&
  value !== 0

/**
 * Evaluates a GitHub Actions expression, an `if:` or a whole `${{ ... }}`,
 * against a context object. It covers what these conditions use: context
 * paths, string and boolean literals, ==, !=, !, && and || with parentheses.
 * Anything else, a function call included, throws rather than guessing.
 */
function evaluate(source, context) {
  const expression = source.trim().replace(/^\$\{\{([\s\S]*)\}\}$/, '$1')
  const tokens =
    expression.match(
      /'(?:[^']|'')*'|==|!=|&&|\|\||[!()]|[A-Za-z_][\w.-]*|\S/g,
    ) ?? []
  let at = 0
  const peek = () => tokens[at]
  const take = (want) => {
    const token = tokens[at++]
    if (want !== undefined && token !== want)
      throw new Error(`expected ${want} in "${source}", found ${token}`)
    return token
  }
  const primary = () => {
    const token = take()
    if (token === '(') {
      const value = or()
      take(')')
      return value
    }
    if (token === '!') return !truthy(primary())
    if (token?.startsWith("'")) return token.slice(1, -1).replaceAll("''", "'")
    if (token === 'true') return true
    if (token === 'false') return false
    if (token === 'null') return null
    if (/^[A-Za-z_]/.test(token ?? '') && peek() !== '(')
      return (
        token.split('.').reduce((value, key) => value?.[key], context) ?? null
      )
    throw new Error(`unsupported expression "${source}" at ${token}`)
  }
  // GitHub compares strings without regard to case.
  const equal = (left, right) =>
    typeof left === 'string' && typeof right === 'string'
      ? left.toLowerCase() === right.toLowerCase()
      : left === right
  const comparison = () => {
    let left = primary()
    while (peek() === '==' || peek() === '!=') {
      const operator = take()
      const same = equal(left, primary())
      left = operator === '==' ? same : !same
    }
    return left
  }
  const and = () => {
    let left = comparison()
    while (peek() === '&&') {
      take()
      const right = comparison()
      left = truthy(left) ? right : left
    }
    return left
  }
  const or = () => {
    let left = and()
    while (peek() === '||') {
      take()
      const right = and()
      left = truthy(left) ? left : right
    }
    return left
  }
  const value = or()
  if (at !== tokens.length)
    throw new Error(`unexpected ${tokens[at]} in "${source}"`)
  return value
}

const EVERY_SCOPE = {
  root: 'true',
  beside: 'true',
  db: 'true',
  jam: 'true',
  mercurypitch: 'true',
  install: 'true',
}
const NO_SCOPE = {
  root: 'false',
  beside: 'false',
  db: 'false',
  jam: 'false',
  mercurypitch: 'false',
  install: 'false',
}

/** The context a PR Gate job's `if:` sees for an event and a scope. */
const gateContext = (event, outputs = EVERY_SCOPE) => ({
  github: { event_name: event, ref_type: 'branch' },
  needs: { scope: { outputs } },
})

const runsOn = (job, context) =>
  job.if === undefined ? true : truthy(evaluate(job.if, context))

/** The workflow's triggers as an object, whichever form `on:` takes. */
function triggersOf(path) {
  const on = readYaml(path).on
  if (typeof on === 'string') return { [on]: null }
  if (Array.isArray(on))
    return Object.fromEntries(on.map((event) => [event, null]))
  return on ?? {}
}

const isBrowserRun = (step) => /\btest:e2e\b/.test(step.run ?? '')

test('the heavy PR Gate jobs never run on a pull request, and still run on main', () => {
  const { jobs } = readYaml(GATE)
  for (const id of HEAVY) {
    assert.ok(jobs[id], `${id} is gone from ${GATE}`)
    assert.equal(
      runsOn(jobs[id], gateContext('pull_request')),
      false,
      `${id} runs on a pull request`,
    )
    assert.equal(
      runsOn(jobs[id], gateContext('push')),
      true,
      `${id} no longer runs on a push to main`,
    )
    assert.equal(
      runsOn(jobs[id], gateContext('workflow_dispatch')),
      true,
      `${id} no longer runs on a dispatch`,
    )
  }
})

test('on main the browser tests run the whole suite', () => {
  const { jobs } = readYaml(GATE)
  const runs = jobs.e2e.steps.filter(isBrowserRun)
  assert.equal(runs.length, 1)
  assert.doesNotMatch(runs[0].run, /--grep\b/)
})

test('a pull request runs the @smoke set, built the way the full suite is built', () => {
  const { jobs } = readYaml(GATE)
  const smoke = jobs['e2e-smoke']
  assert.ok(smoke, `${GATE} has no e2e-smoke job`)

  assert.equal(runsOn(smoke, gateContext('pull_request')), true)
  assert.equal(
    runsOn(smoke, gateContext('pull_request', NO_SCOPE)),
    false,
    'e2e-smoke runs on a pull request that cannot affect MercuryPitch',
  )
  assert.equal(
    runsOn(smoke, gateContext('push')),
    false,
    'e2e-smoke runs on main',
  )
  assert.equal(runsOn(smoke, gateContext('workflow_dispatch')), false)

  const runs = smoke.steps.filter(isBrowserRun)
  assert.equal(runs.length, 1)
  assert.match(runs[0].run, /--grep @smoke(\s|$)/)
  const shards = smoke.strategy.matrix.shard.length
  assert.ok(
    runs[0].run.includes(`--shard=\${{ matrix.shard }}/${shards}`),
    `the smoke run must split over its ${shards} shards: ${runs[0].run}`,
  )

  // Everything e2e does before and after its test run, e2e-smoke does too:
  // the LFS hydrate, build:e2e with its bundle audits, the browser install.
  const shape = (step) => step.uses ?? step.run
  const own = smoke.steps.map(shape)
  for (const step of jobs.e2e.steps.filter((step) => !isBrowserRun(step)))
    assert.ok(
      own.includes(shape(step)),
      `e2e-smoke lacks e2e's step "${step.name ?? shape(step)}"`,
    )
  assert.ok(own.includes('./.github/actions/lfs-pull'))
  assert.ok(own.includes('pnpm run build:e2e'))

  assert.ok(
    [jobs.gate.needs].flat().includes('e2e-smoke'),
    'gate does not wait for e2e-smoke',
  )
})

test('PR Gate waits for every other job, and only for jobs that exist', () => {
  const { jobs } = readYaml(GATE)
  const needs = [jobs.gate.needs].flat()
  assert.deepEqual(
    needs.filter((id) => !(id in jobs)),
    [],
    'gate needs a job the workflow does not define',
  )
  assert.deepEqual(
    Object.keys(jobs).filter((id) => id !== 'gate' && !needs.includes(id)),
    [],
    'a job outside gate.needs can fail without failing the required check',
  )
  assert.equal(jobs.gate.if, 'always()')
})

test('PR Gate passes a job skipped by its event, and fails a failed or cancelled one', () => {
  const { jobs } = readYaml(GATE)
  const step = jobs.gate.steps.find((step) => step.run)
  assert.equal(step.env.RESULTS, "${{ join(needs.*.result, ' ') }}")
  const judge = (results) =>
    spawnSync('bash', ['-c', step.run], {
      encoding: 'utf8',
      env: { ...process.env, RESULTS: results },
    }).status
  assert.equal(judge('success skipped skipped success'), 0)
  assert.notEqual(judge('success failure skipped'), 0)
  assert.notEqual(judge('success cancelled'), 0)
})

test('no native workflow runs on a pull request', () => {
  for (const path of [MERCURYPITCH, BESIDE_CUE, GAMES]) {
    const triggers = triggersOf(path)
    for (const event of ['pull_request', 'pull_request_target'])
      assert.ok(!(event in triggers), `${path} runs on ${event}`)
  }
})

test('the mobile workflows still build on main, on their release tags and by hand', () => {
  for (const [path, tag] of [
    [MERCURYPITCH, 'mp-v*'],
    [BESIDE_CUE, 'bc-v*'],
  ]) {
    const triggers = triggersOf(path)
    assert.deepEqual(triggers.push?.branches, ['main'], path)
    assert.deepEqual(triggers.push?.tags, [tag], path)
    assert.ok('workflow_dispatch' in triggers, path)
  }
})

test('Beside Cue Games Native runs only when dispatched', () => {
  assert.deepEqual(Object.keys(triggersOf(GAMES)), ['workflow_dispatch'])
})

test('TestFlight uploads come only from release tags, for every native app', () => {
  const capacitor = readYaml(CAPACITOR)
  const input = capacitor.on.workflow_call.inputs['testflight-upload-from']
  assert.equal(input.default, 'tags', `${CAPACITOR} must default to tags`)
  const upload = capacitor.jobs['ios-testflight'].env.UPLOAD

  const callers = readdirSync(join(ROOT, '.github/workflows'))
    .filter((name) => /\.ya?ml$/.test(name))
    .map((name) => `.github/workflows/${name}`)
    .flatMap((path) =>
      Object.values(readYaml(path).jobs ?? {})
        .filter((job) => job.uses === `./${CAPACITOR}`)
        .map((job) => [path, job]),
    )
  assert.deepEqual(callers.map(([path]) => path).sort(), [
    BESIDE_CUE,
    MERCURYPITCH,
  ])

  for (const [path, job] of callers) {
    const from = job.with?.['testflight-upload-from'] ?? input.default
    const uploads = (event, refType) =>
      truthy(
        evaluate(upload, {
          github: { event_name: event, ref_type: refType },
          inputs: { 'testflight-upload-from': from },
        }),
      )
    assert.equal(
      uploads('push', 'branch'),
      false,
      `${path} uploads from a push to main`,
    )
    assert.equal(
      uploads('workflow_dispatch', 'branch'),
      false,
      `${path} uploads from a dispatch on a branch`,
    )
    assert.equal(
      uploads('pull_request', 'branch'),
      false,
      `${path} uploads from a pull request`,
    )
    assert.equal(
      uploads('push', 'tag'),
      true,
      `${path} no longer uploads from its release tag`,
    )
  }
})

// A scratch repository for the scope steps, with no global or system git
// configuration, hooks or signing.
const GIT_ENV = {
  GIT_AUTHOR_NAME: 'CI tiers test',
  GIT_AUTHOR_EMAIL: 'ci-tiers@example.invalid',
  GIT_COMMITTER_NAME: 'CI tiers test',
  GIT_COMMITTER_EMAIL: 'ci-tiers@example.invalid',
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_NOSYSTEM: '1',
}

function git(dir, ...args) {
  const run = spawnSync(
    'git',
    ['-c', 'commit.gpgsign=false', '-c', 'core.hooksPath=/dev/null', ...args],
    { cwd: dir, encoding: 'utf8', env: { ...process.env, ...GIT_ENV } },
  )
  assert.equal(run.status, 0, `git ${args.join(' ')}: ${run.stderr}`)
  return run.stdout.trim()
}

function commit(dir, files, message) {
  for (const [path, body] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true })
    writeFileSync(join(dir, path), body)
  }
  git(dir, 'add', '-A')
  git(dir, 'commit', '-q', '-m', message)
  return git(dir, 'rev-parse', 'HEAD')
}

const BASE_FILES = {
  'README.md': 'base\n',
  'src/app.ts': 'export {}\n',
  'apps/beside-cue/src/app.ts': 'export {}\n',
  '.github/workflows/pr-gate.yml': 'name: PR Gate\n',
}

// What main gained after the pull request branched. On PR 1174 it was a
// pr-gate.yml change and Glassworks commits, and they scoped a skills PR as
// every surface.
const MAIN_MOVES_ON = {
  '.github/workflows/pr-gate.yml': 'name: PR Gate\non: push\n',
  'src/app.ts': 'export const fromMain = 1\n',
  'apps/beside-cue/src/app.ts': 'export const fromMain = 1\n',
}

/**
 * Builds what actions/checkout gives a pull_request run: main moved on after
 * the branch was cut, and HEAD is GitHub's test merge of the pull request into
 * it, with main as the first parent. With `merged: false`, HEAD is the pull
 * request's own commit instead, which has no merge to read a base from.
 */
function pullRequestCheckout(dir, prChanges, { merged = true } = {}) {
  git(dir, 'init', '-q', '-b', 'main')
  const base = commit(dir, BASE_FILES, 'base')
  git(dir, 'checkout', '-q', '-b', 'feature')
  const head = commit(dir, prChanges, 'the pull request')
  if (!merged) return { base, sha: head }
  git(dir, 'checkout', '-q', 'main')
  const main = commit(dir, MAIN_MOVES_ON, 'main moves on')
  git(dir, 'merge', '-q', '--no-ff', '-m', 'test merge', 'feature')
  return { base, main, sha: git(dir, 'rev-parse', 'HEAD') }
}

/**
 * Runs one workflow step's script in `dir`, with its `env:` resolved from
 * `context`, and returns what it wrote to GITHUB_OUTPUT.
 */
function runStep(path, jobId, stepName, dir, context) {
  const step = readYaml(path).jobs[jobId].steps.find(
    (step) => step.name === stepName,
  )
  assert.ok(step, `${path} has no step "${stepName}" in ${jobId}`)
  const env = Object.fromEntries(
    Object.entries(step.env ?? {}).map(([name, value]) => {
      if (!/^\$\{\{[\s\S]*\}\}$/.test(String(value)))
        return [name, String(value)]
      return [name, String(evaluate(value, context) ?? '')]
    }),
  )
  const scratch = mkdtempSync(join(tmpdir(), 'ci-tiers-out-'))
  try {
    const output = join(scratch, 'output')
    writeFileSync(output, '')
    const run = spawnSync('bash', ['-c', step.run], {
      cwd: dir,
      encoding: 'utf8',
      env: {
        ...process.env,
        ...GIT_ENV,
        ...env,
        GITHUB_SHA: context.github.sha,
        GITHUB_OUTPUT: output,
        GITHUB_STEP_SUMMARY: join(scratch, 'summary'),
      },
    })
    assert.equal(run.status, 0, `${stepName}: ${run.stderr}`)
    return Object.fromEntries(
      readFileSync(output, 'utf8')
        .split('\n')
        .filter(Boolean)
        .map((line) => {
          const at = line.indexOf('=')
          return [line.slice(0, at), line.slice(at + 1)]
        }),
    )
  } finally {
    rmSync(scratch, { recursive: true, force: true })
  }
}

/** Runs both scope steps on a pull_request checkout of `prChanges`. */
function scopePullRequest(prChanges, options) {
  const dir = mkdtempSync(join(tmpdir(), 'ci-tiers-repo-'))
  try {
    const checkout = pullRequestCheckout(dir, prChanges, options)
    // pull_request.base.sha is the stale base, as it was on PR 1174.
    const context = {
      github: {
        event_name: 'pull_request',
        sha: checkout.sha,
        event: { pull_request: { base: { sha: checkout.base } } },
      },
    }
    return {
      ...checkout,
      gate: runStep(GATE, 'scope', 'Resolve validation scope', dir, context),
      preview: runStep(
        BUILD,
        'build-and-deploy',
        'Resolve preview scope',
        dir,
        context,
      ),
    }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

test('a pull request is scoped by its own changes, not by what main gained since it branched', () => {
  const { main, gate, preview } = scopePullRequest({
    'docs/guide.md': 'a guide\n',
  })
  assert.equal(
    gate.diff_base,
    main,
    'PR Gate must diff from the first parent of the test merge',
  )
  assert.deepEqual(
    [gate.root, gate.beside, gate.db, gate.jam, gate.mercurypitch],
    ['false', 'false', 'false', 'false', 'false'],
    "a docs-only pull request was scoped by main's own commits",
  )
  assert.equal(gate.install, 'false')
  assert.equal(
    preview.deploy,
    'false',
    'build.yml deployed a preview for a docs-only pull request',
  )
})

test("a pull request's own changes still set its scope", () => {
  const { main, gate, preview } = scopePullRequest({
    'src/feature.ts': 'export const mine = 1\n',
  })
  assert.equal(gate.diff_base, main)
  assert.deepEqual(
    [gate.root, gate.db, gate.mercurypitch, gate.beside],
    ['true', 'true', 'true', 'false'],
  )
  assert.equal(preview.deploy, 'true')
})

test('a checkout that is not a test merge is scoped as everything', () => {
  const { gate, preview } = scopePullRequest(
    { 'docs/guide.md': 'a guide\n' },
    { merged: false },
  )
  assert.equal(gate.diff_base, '')
  assert.deepEqual(
    [gate.root, gate.beside, gate.db, gate.jam, gate.mercurypitch],
    ['true', 'true', 'true', 'true', 'true'],
  )
  assert.equal(preview.deploy, 'true')
})

test('a push to main is still scoped from the commit before the push', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ci-tiers-repo-'))
  try {
    git(dir, 'init', '-q', '-b', 'main')
    const before = commit(dir, BASE_FILES, 'base')
    // Two commits in one push: the first parent of the tip alone would see
    // only the second.
    commit(
      dir,
      { 'apps/beside-cue/src/app.ts': 'export const pushed = 1\n' },
      'one',
    )
    const sha = commit(dir, { 'docs/guide.md': 'a guide\n' }, 'two')
    const gate = runStep(GATE, 'scope', 'Resolve validation scope', dir, {
      github: { event_name: 'push', sha, event: { before } },
    })
    assert.equal(gate.diff_base, before)
    assert.equal(gate.beside, 'true')
    assert.equal(gate.root, 'false')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
