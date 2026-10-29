// Browser suite collection — every spec loads in plain Node, so the suite lists.
//
// Playwright loads each spec, and every module a spec imports from src/, in
// plain Node: no Vite, so no `import.meta.env` and no `define`. One module on
// that path that reads the build's env at module scope throws while the suite
// is collected, and the run then reports 0 tests in 0 files and exits 1. That
// happened on PR #1219: src/features/tabs/constants.ts picked up an import of
// the experimental features store, which reads `import.meta.env` as it loads,
// and the showcase and plan specs reach constants.ts through
// showcase-stops.ts and build-plan.ts. All four browser shards went red after
// a full build each.
//
// This lists the suite without a browser or a build, in about five seconds,
// so the same mistake fails the script tests instead.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const PLAYWRIGHT_CLI = createRequire(import.meta.url).resolve(
  '@playwright/test/cli',
)

/** The browser suite counts well over a thousand tests; far fewer means whole files went missing. */
const FEWEST_TESTS = 1000

function listSuite() {
  try {
    const stdout = execFileSync(
      process.execPath,
      [PLAYWRIGHT_CLI, 'test', '--list', '--reporter=json'],
      {
        cwd: ROOT,
        encoding: 'utf8',
        maxBuffer: 256 * 1024 * 1024,
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    )
    return { report: JSON.parse(stdout), exitCode: 0 }
  } catch (error) {
    // A collection error exits 1 with the report, errors included, on stdout.
    if (typeof error.stdout !== 'string' || error.stdout === '') throw error
    return { report: JSON.parse(error.stdout), exitCode: error.status }
  }
}

function countTests(suites) {
  let count = 0
  for (const suite of suites ?? []) {
    for (const spec of suite.specs ?? []) count += spec.tests?.length ?? 0
    count += countTests(suite.suites)
  }
  return count
}

test('every browser spec loads in plain Node, so the whole suite lists', () => {
  const { report, exitCode } = listSuite()
  const errors = (report.errors ?? []).map(
    (error) => (error.message ?? String(error)).split('\n')[0],
  )

  assert.deepEqual(errors, [], 'a spec failed to load')
  assert.equal(exitCode, 0)
  const total = countTests(report.suites)
  assert.ok(
    total >= FEWEST_TESTS,
    `listed ${total} tests, expected at least ${FEWEST_TESTS}`,
  )
})
