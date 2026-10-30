// The lfs-pull action (.github/actions/lfs-pull) is how CI takes the
// Glassworks assets out of Git LFS. LFS bandwidth is billed by the byte, and a
// PR Gate run used to pull the 301 MB set 64 times; through the action a run
// asks LFS only for the objects the Actions cache lacks. These tests hold what
// keeps that true: lfs-set.sh keys an entry on the set's objects and prunes a
// store down to them, the action restores under the prefix that key carries,
// and no workflow downloads from LFS around the action.

import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync, } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { parse } from 'yaml'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const ACTION = '.github/actions/lfs-pull'
const SET_SCRIPT = join(ROOT, ACTION, 'lfs-set.sh')
const INCLUDE =
  'apps/beside-cue/public/games/**,apps/beside-cue/public/models/**'
const REAL_GIT = spawnSync('bash', ['-c', 'command -v git'], {
  encoding: 'utf8',
}).stdout.trim()

/** A 64-hex object id of one repeated character, so tests can say a, b, c. */
const oid = (c) => c.repeat(64)
const game = (name) => `apps/beside-cue/public/games/${name}`

// Stands in for git: answers `lfs ls-files` from a list and records how it
// was asked. Everything else (hash-object) goes to the real git.
const FAKE_GIT = `#!/usr/bin/env bash
if [[ "\${1:-} \${2:-}" == "lfs ls-files" ]]; then
  printf '%s\\n' "$*" >> "$FAKE_GIT_CALLS"
  cat "$FAKE_LFS_FILES"
  exit 0
fi
exec "$REAL_GIT" "$@"
`

const objectPath = (dir, id) =>
  join(dir, '.git/lfs/objects', id.slice(0, 2), id.slice(2, 4), id)

/**
 * Runs lfs-set.sh in a scratch directory whose git lfs lists `files`
 * ([id, path] pairs) and whose store holds the `stored` object ids.
 */
function runSet(mode, files, { stored = [] } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'lfs-set-'))
  try {
    mkdirSync(join(dir, 'bin'))
    writeFileSync(join(dir, 'bin/git'), FAKE_GIT, { mode: 0o755 })
    writeFileSync(
      join(dir, 'lfs-files.txt'),
      files.map(([id, path]) => `${id} - ${path}\n`).join(''),
    )
    for (const id of stored) {
      mkdirSync(join(objectPath(dir, id), '..'), { recursive: true })
      writeFileSync(objectPath(dir, id), id)
    }
    const run = spawnSync('bash', [SET_SCRIPT, mode], {
      cwd: dir,
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: `${join(dir, 'bin')}:${process.env.PATH}`,
        LFS_INCLUDE: INCLUDE,
        REAL_GIT,
        FAKE_LFS_FILES: join(dir, 'lfs-files.txt'),
        FAKE_GIT_CALLS: join(dir, 'calls.txt'),
      },
    })
    const callsFile = join(dir, 'calls.txt')
    return {
      ...run,
      calls: existsSync(callsFile) ? readFileSync(callsFile, 'utf8') : '',
      left: stored.filter((id) => existsSync(objectPath(dir, id))),
    }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

const keyOf = (ids) =>
  runSet(
    'key',
    ids.map((id, i) => [oid(id), game(`${i}.glb`)]),
  ).stdout

test('key: the same objects give the same key, whatever their paths and order', () => {
  const first = runSet('key', [
    [oid('a'), game('one.glb')],
    [oid('b'), game('two.glb')],
  ])
  const moved = runSet('key', [
    [oid('b'), 'apps/beside-cue/public/models/renamed.onnx'],
    [oid('a'), game('one.glb')],
    [oid('a'), game('copy-of-one.glb')],
  ])
  assert.equal(first.status, 0, first.stderr)
  assert.match(first.stdout, /^lfs-pull-v1-[0-9a-f]{40,64}\n$/)
  assert.equal(moved.stdout, first.stdout)
})

test('key: a changed, added or removed object changes the key', () => {
  const keys = [
    keyOf(['a', 'b']),
    keyOf(['a', 'c']),
    keyOf(['a', 'b', 'c']),
    keyOf(['a']),
  ]
  assert.equal(new Set(keys).size, keys.length)
})

test('key: asks git lfs for the include list, excluding nothing', () => {
  const run = runSet('key', [[oid('a'), game('one.glb')]])
  assert.equal(
    run.calls,
    `lfs ls-files --long --include=${INCLUDE} --exclude=\n`,
  )
})

test('key: refuses a set that matches no LFS file, naming the list', () => {
  const run = runSet('key', [])
  assert.equal(run.status, 1)
  assert.equal(run.stdout, '')
  assert.match(run.stderr, /no LFS files match apps\/beside-cue\/public\/games/)
})

test('prune: keeps the set and deletes what an older set left behind', () => {
  const run = runSet(
    'prune',
    [
      [oid('a'), game('one.glb')],
      [oid('b'), game('two.glb')],
    ],
    { stored: [oid('a'), oid('b'), oid('c')] },
  )
  assert.equal(run.status, 0, run.stderr)
  assert.deepEqual(run.left, [oid('a'), oid('b')])
})

test('refuses a mode it does not know, before asking git anything', () => {
  const run = runSet('fetch', [[oid('a'), game('one.glb')]])
  assert.equal(run.status, 2)
  assert.equal(run.calls, '')
})

const readYaml = (path) => parse(readFileSync(join(ROOT, path), 'utf8'))

/** Every workflow and composite action in the repository. */
function ciFiles() {
  const workflows = readdirSync(join(ROOT, '.github/workflows'))
    .filter((name) => /\.ya?ml$/.test(name))
    .map((name) => `.github/workflows/${name}`)
  const actions = readdirSync(join(ROOT, '.github/actions'))
    .map((name) => `.github/actions/${name}/action.yml`)
    .filter((path) => existsSync(join(ROOT, path)))
  return [...workflows, ...actions]
}

/** [job id, step] for every step a workflow or composite action runs. */
function stepsOf(path) {
  const doc = readYaml(path)
  if (doc.runs) return (doc.runs.steps ?? []).map((step) => ['action', step])
  return Object.entries(doc.jobs ?? {}).flatMap(([id, job]) =>
    (job.steps ?? []).map((step) => [id, step]),
  )
}

test('every LFS download in CI goes through the action', () => {
  const around = []
  let hydrates = 0
  for (const path of ciFiles()) {
    if (path === `${ACTION}/action.yml`) continue
    for (const [job, step] of stepsOf(path)) {
      const where = `${path} ${job}: ${step.name ?? step.uses ?? step.run}`
      if (/\bgit[ -]lfs\s+(pull|fetch|checkout|smudge)\b/.test(step.run ?? ''))
        around.push(where)
      if (/^actions\/checkout@/.test(step.uses ?? '') && step.with?.lfs)
        around.push(where)
      if (/^Hydrate\b/.test(step.name ?? '')) {
        hydrates += 1
        assert.equal(step.uses, `./${ACTION}`, where)
      }
    }
  }
  assert.deepEqual(around, [])
  assert.ok(hydrates > 0, 'no step named Hydrate was found')
})

test('PR Gate fills the cache once, in scope, before the jobs that pull', () => {
  const { jobs } = readYaml('.github/workflows/pr-gate.yml')
  const pulls = (job) =>
    (job.steps ?? []).filter((step) => step.uses === `./${ACTION}`)
  const [warm, ...more] = pulls(jobs.scope)
  assert.equal(warm?.with?.['warm-only'], 'true')
  assert.equal(more.length, 0)
  const pullers = Object.entries(jobs).filter(
    ([id, job]) => id !== 'scope' && pulls(job).length > 0,
  )
  assert.ok(pullers.length > 0)
  for (const [id, job] of pullers) {
    assert.ok([job.needs].flat().includes('scope'), `${id} must need scope`)
    for (const step of pulls(job))
      assert.notEqual(step.with?.['warm-only'], 'true', id)
  }
})

test('the action restores under the key prefix and saves only after a miss', () => {
  const steps = readYaml(`${ACTION}/action.yml`).runs.steps
  const restore = steps.find((step) => step.id === 'restore')
  assert.ok(
    keyOf(['a']).startsWith(restore.with['restore-keys']),
    'restore-keys must be a prefix of the key lfs-set.sh prints',
  )
  const save = steps.find((step) =>
    /^actions\/cache\/save@/.test(step.uses ?? ''),
  )
  assert.equal(save['continue-on-error'], true)
  assert.match(save.if, /steps\.restore\.outputs\.cache-hit != 'true'/)
  const cachePaths = steps
    .filter((step) => /^actions\/cache\//.test(step.uses ?? ''))
    .map((step) => step.with.path)
  assert.deepEqual([...new Set(cachePaths)], ['.git/lfs/objects'])
})
