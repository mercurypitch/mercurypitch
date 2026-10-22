// CI browser installer regressions — preserve signed sources and setup failures.
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync, } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { installCiBrowser } from './install-ci-browser.mjs'

const officialSources = `Types: deb
URIs: http://azure.archive.ubuntu.com/ubuntu/
Suites: noble noble-updates noble-backports
Components: main restricted universe multiverse
Signed-By: /usr/share/keyrings/ubuntu-archive-keyring.gpg

Types: deb
URIs: http://azure.archive.ubuntu.com/ubuntu/
Suites: noble-security
Components: main restricted universe multiverse
Signed-By: /usr/share/keyrings/ubuntu-archive-keyring.gpg
`

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'browser-setup-test-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const ubuntuSources = join(root, 'ubuntu.sources')
  writeFileSync(ubuntuSources, officialSources)
  const unrelated = join(root, 'microsoft-prod.list')
  const unrelatedContents =
    'deb https://packages.microsoft.com/ubuntu/24.04/prod noble main\n'
  writeFileSync(unrelated, unrelatedContents)
  return { root, ubuntuSources, unrelated, unrelatedContents }
}

for (const browser of ['chromium', 'webkit']) {
  test(`${browser} excludes unrelated feeds and keeps the signed Ubuntu source intact`, (t) => {
    const f = fixture(t)
    const calls = []
    let configPath
    installCiBrowser(browser, {
      ubuntuSources: f.ubuntuSources,
      temporaryRoot: f.root,
      run(command, args, options) {
        calls.push({ command, args, options })
        if (command === 'sudo') {
          assert.deepEqual(args.slice(0, 2), ['-n', 'env'])
          assert.ok(args[2].startsWith('APT_CONFIG='))
          configPath = args[2].slice('APT_CONFIG='.length)
          const config = readFileSync(configPath, 'utf8')
          const match = config.match(
            /^Dir::Etc::sourcelist ("[^"\n]+");\nDir::Etc::sourceparts "-";\n$/,
          )
          assert.ok(
            match,
            'only a temporary source list and disabled extra sourceparts',
          )
          const sourcePath = JSON.parse(match[1])
          assert.notEqual(sourcePath, f.ubuntuSources)
          assert.equal(readFileSync(sourcePath, 'utf8'), officialSources)
          assert.deepEqual(args.slice(3, 4), [process.execPath])
          assert.deepEqual(args.slice(-2), ['install-deps', browser])
          assert.ok(
            existsSync(args[4]),
            'installed locked Playwright CLI is used',
          )
        }
        return { status: 0 }
      },
    })
    assert.equal(calls.length, 2)
    assert.equal(
      calls[1].command,
      process.execPath,
      'browser install never runs through sudo',
    )
    assert.deepEqual(calls[1].args, [calls[0].args[4], 'install', browser])
    assert.deepEqual(
      calls.map(({ options }) => options),
      [{ stdio: 'inherit' }, { stdio: 'inherit' }],
    )
    assert.equal(readFileSync(f.ubuntuSources, 'utf8'), officialSources)
    assert.equal(readFileSync(f.unrelated, 'utf8'), f.unrelatedContents)
    assert.equal(
      existsSync(configPath),
      false,
      'temporary config is removed after install',
    )
  })
}

for (const failure of [
  { status: 100 },
  { status: null, signal: 'SIGTERM' },
  { error: new Error('spawn failure') },
]) {
  test(`dependency failure propagates without a retry or browser install: ${JSON.stringify(failure)}`, (t) => {
    const f = fixture(t)
    let calls = 0
    assert.throws(() =>
      installCiBrowser('chromium', {
        ubuntuSources: f.ubuntuSources,
        temporaryRoot: f.root,
        run() {
          calls += 1
          return failure
        },
      }),
    )
    assert.equal(calls, 1)
    assert.deepEqual(readdirSync(f.root).sort(), [
      'microsoft-prod.list',
      'ubuntu.sources',
    ])
  })
}

test('browser download failure is not swallowed or retried', (t) => {
  const f = fixture(t)
  let calls = 0
  assert.throws(
    () =>
      installCiBrowser('webkit', {
        ubuntuSources: f.ubuntuSources,
        temporaryRoot: f.root,
        run() {
          calls += 1
          return { status: calls === 1 ? 0 : 1 }
        },
      }),
    /Browser setup failed/,
  )
  assert.equal(calls, 2)
  assert.deepEqual(readdirSync(f.root).sort(), [
    'microsoft-prod.list',
    'ubuntu.sources',
  ])
})

test('missing Ubuntu source fails closed without falling back to all runner feeds', (t) => {
  const f = fixture(t)
  rmSync(f.ubuntuSources)
  assert.throws(
    () =>
      installCiBrowser('chromium', {
        ubuntuSources: f.ubuntuSources,
        temporaryRoot: f.root,
        run() {
          assert.fail('installation must not start')
        },
      }),
    /ENOENT/,
  )
  assert.deepEqual(readdirSync(f.root), ['microsoft-prod.list'])
})

test('unsupported browser arguments are rejected before any process starts', (t) => {
  const f = fixture(t)
  for (const browser of [
    undefined,
    '--with-deps',
    'chromium webkit',
    'firefox',
  ]) {
    assert.throws(
      () =>
        installCiBrowser(browser, {
          ubuntuSources: f.ubuntuSources,
          temporaryRoot: f.root,
          run() {
            assert.fail('installation must not start')
          },
        }),
      /Specify chromium or webkit/,
    )
  }
})
