// CI browser installer regressions — preserve signed sources and setup failures.
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync, } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
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
          assert.deepEqual(args.slice(0, 6), [
            '-n',
            '/usr/bin/timeout',
            '--signal=TERM',
            '--kill-after=15s',
            '600s',
            'env',
          ])
          assert.ok(args[6].startsWith('APT_CONFIG='))
          configPath = args[6].slice('APT_CONFIG='.length)
          const config = readFileSync(configPath, 'utf8')
          const match = config.match(
            /^Dir::Etc::sourcelist ("[^"\n]+");\nDir::Etc::sourceparts "-";\n/,
          )
          assert.ok(
            match,
            'only a temporary source list and disabled extra sourceparts',
          )
          const sourcePath = JSON.parse(match[1])
          assert.notEqual(sourcePath, f.ubuntuSources)
          assert.equal(
            readFileSync(sourcePath, 'utf8'),
            officialSources.replaceAll(
              'http://azure.archive.ubuntu.com/ubuntu/',
              'https://archive.ubuntu.com/ubuntu/',
            ),
          )
          assert.match(config, /Acquire::http::Timeout "15";/)
          assert.match(config, /Acquire::https::Timeout "15";/)
          assert.match(config, /APT::Update::Error-Mode "any";/)
          assert.doesNotMatch(
            config,
            /Retries|AllowUnauthenticated|AllowInsecure|Check-Valid-Until/,
          )
          assert.deepEqual(args.slice(7, 8), [process.execPath])
          assert.deepEqual(args.slice(-2), ['install-deps', browser])
          assert.ok(
            existsSync(args[8]),
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
    assert.deepEqual(calls[1].args, [calls[0].args[8], 'install', browser])
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
  { status: 124 },
  { status: 137 },
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

test('runner mirror list remains sandbox-readable with a restrictive umask and retains HTTPS fallbacks', (t) => {
  const f = fixture(t)
  const original = officialSources.replaceAll(
    'http://azure.archive.ubuntu.com/ubuntu/',
    'mirror+file:/etc/apt/apt-mirrors.txt',
  )
  writeFileSync(f.ubuntuSources, original)
  const ubuntuMirrors = join(f.root, 'runner-mirrors.txt')
  const mirrorText =
    '# Runner mirrors\nhttp://azure.archive.ubuntu.com/ubuntu\tpriority:1\nhttps://archive.ubuntu.com/ubuntu\tpriority:2\nhttps://security.ubuntu.com/ubuntu\tpriority:3\n'
  writeFileSync(ubuntuMirrors, mirrorText)
  const previousUmask = process.umask(0o077)
  t.after(() => process.umask(previousUmask))
  let calls = 0
  installCiBrowser('chromium', {
    ubuntuSources: f.ubuntuSources,
    ubuntuMirrors,
    temporaryRoot: f.root,
    run(command, args) {
      calls += 1
      if (command !== 'sudo') return { status: 0 }
      const config = readFileSync(args[6].slice('APT_CONFIG='.length), 'utf8')
      const sourcePath = JSON.parse(
        config.match(/^Dir::Etc::sourcelist (.+);$/m)[1],
      )
      const sources = readFileSync(sourcePath, 'utf8')
      const uris = sources.match(/^URIs: (.+)$/gm)
      assert.equal(uris.length, 2)
      assert.equal(uris[0], uris[1])
      const uri = uris[0].slice('URIs: '.length)
      assert.ok(uri.startsWith('mirror+file:'))
      const copiedMirror = fileURLToPath(uri.slice('mirror+'.length))
      assert.notEqual(copiedMirror, ubuntuMirrors)
      assert.equal(
        readFileSync(copiedMirror, 'utf8'),
        mirrorText.replace(
          'http://azure.archive.ubuntu.com/ubuntu\tpriority:1\n',
          '',
        ),
      )
      assert.equal(
        sources.replaceAll(uri, 'mirror+file:/etc/apt/apt-mirrors.txt'),
        original,
      )
      assert.equal(statSync(copiedMirror).mode & 0o777, 0o644)
      assert.equal(statSync(join(copiedMirror, '..')).mode & 0o777, 0o755)
      return { status: 0 }
    },
  })
  assert.equal(calls, 2, 'one dependency attempt, then one browser download')
  assert.equal(readFileSync(f.ubuntuSources, 'utf8'), original)
  assert.equal(readFileSync(ubuntuMirrors, 'utf8'), mirrorText)
  assert.deepEqual(readdirSync(f.root).sort(), [
    'microsoft-prod.list',
    'runner-mirrors.txt',
    'ubuntu.sources',
  ])
})

test('sandbox mirror ignores private runner and system temporary roots', (t) => {
  const f = fixture(t)
  writeFileSync(
    f.ubuntuSources,
    officialSources.replaceAll(
      'http://azure.archive.ubuntu.com/ubuntu/',
      'mirror+file:/etc/apt/apt-mirrors.txt',
    ),
  )
  const ubuntuMirrors = join(f.root, 'runner-mirrors.txt')
  writeFileSync(ubuntuMirrors, 'https://archive.ubuntu.com/ubuntu\n')
  const previous = {
    RUNNER_TEMP: process.env.RUNNER_TEMP,
    TMPDIR: process.env.TMPDIR,
  }
  t.after(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  })
  process.env.RUNNER_TEMP = f.root
  process.env.TMPDIR = f.root
  const parentMode = statSync(f.root).mode & 0o777
  let mirrorPath
  installCiBrowser('chromium', {
    ubuntuSources: f.ubuntuSources,
    ubuntuMirrors,
    run(command, args) {
      if (command !== 'sudo') return { status: 0 }
      const config = readFileSync(args[6].slice('APT_CONFIG='.length), 'utf8')
      const sourcePath = JSON.parse(
        config.match(/^Dir::Etc::sourcelist (.+);$/m)[1],
      )
      const sources = readFileSync(sourcePath, 'utf8')
      mirrorPath = fileURLToPath(sources.match(/^URIs: mirror\+(.+)$/m)[1])
      assert.match(
        mirrorPath,
        /^\/tmp\/playwright-apt-[^/]+\/apt-mirrors\.txt$/,
      )
      assert.equal(statSync(join(mirrorPath, '..')).mode & 0o777, 0o755)
      assert.equal(statSync(mirrorPath).mode & 0o777, 0o644)
      return { status: 0 }
    },
  })
  assert.equal(
    statSync(f.root).mode & 0o777,
    parentMode,
    'never change runner ancestor permissions',
  )
  assert.equal(
    existsSync(mirrorPath),
    false,
    'owned public config is removed after use',
  )
})

for (const contents of [
  null,
  'http://azure.archive.ubuntu.com/ubuntu\tpriority:1\n',
  'https://archive.ubuntu.com.evil/ubuntu\n',
]) {
  test(`missing or unrecognized official mirror fallback fails closed: ${contents}`, (t) => {
    const f = fixture(t)
    writeFileSync(
      f.ubuntuSources,
      officialSources.replaceAll(
        'http://azure.archive.ubuntu.com/ubuntu/',
        'mirror+file:/etc/apt/apt-mirrors.txt',
      ),
    )
    const ubuntuMirrors = join(f.root, 'runner-mirrors.txt')
    if (contents !== null) writeFileSync(ubuntuMirrors, contents)
    assert.throws(
      () =>
        installCiBrowser('chromium', {
          ubuntuSources: f.ubuntuSources,
          ubuntuMirrors,
          temporaryRoot: f.root,
          run() {
            assert.fail(
              'installation must not start without an official fallback',
            )
          },
        }),
      /ENOENT|no official HTTPS fallback/,
    )
    assert.equal(
      readdirSync(f.root).some((name) => name.startsWith('playwright-apt-')),
      false,
    )
  })
}

test('other source hosts are not rewritten or given different trust settings', (t) => {
  const f = fixture(t)
  const original = officialSources.replaceAll(
    'http://azure.archive.ubuntu.com/ubuntu/',
    'https://private.example/ubuntu/',
  )
  writeFileSync(f.ubuntuSources, original)
  installCiBrowser('webkit', {
    ubuntuSources: f.ubuntuSources,
    temporaryRoot: f.root,
    run(command, args) {
      if (command === 'sudo') {
        const config = readFileSync(args[6].slice('APT_CONFIG='.length), 'utf8')
        const sourcePath = JSON.parse(
          config.match(/^Dir::Etc::sourcelist (.+);$/m)[1],
        )
        assert.equal(readFileSync(sourcePath, 'utf8'), original)
      }
      return { status: 0 }
    },
  })
})

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

test('keeps downloaded packages in the cache folder, open to the apt sandbox, and leaves restored ones in place', (t) => {
  const f = fixture(t)
  const aptArchives = join(f.root, 'apt-archives')
  // A restore can leave the folder private; the installer opens it.
  mkdirSync(aptArchives, { mode: 0o700 })
  const restored = join(
    aptArchives,
    'fonts-unifont_1%3a15.1.01-1build1_all.deb',
  )
  writeFileSync(restored, 'restored package')
  const previousUmask = process.umask(0o077)
  t.after(() => process.umask(previousUmask))
  t.mock.method(console, 'log', () => {})
  let checked = false
  installCiBrowser('chromium', {
    ubuntuSources: f.ubuntuSources,
    temporaryRoot: f.root,
    aptArchives,
    run(command, args) {
      if (command === 'dpkg-query') {
        return {
          status: 0,
          stdout: 'fonts-unifont\t1:15.1.01-1build1\tall\tinstalled\n',
        }
      }
      if (command !== 'sudo') return { status: 0 }
      const config = readFileSync(args[6].slice('APT_CONFIG='.length), 'utf8')
      assert.match(
        config,
        /^Dir::Etc::sourcelist ("[^"\n]+");\nDir::Etc::sourceparts "-";\n/,
      )
      assert.ok(
        config.includes(
          `Dir::Cache::Archives ${JSON.stringify(`${aptArchives}/`)};\n`,
        ),
      )
      assert.match(config, /^APT::Keep-Downloaded-Packages "true";$/m)
      assert.equal(statSync(aptArchives).mode & 0o777, 0o755)
      checked = true
      return { status: 0 }
    },
  })
  assert.ok(checked)
  assert.equal(readFileSync(restored, 'utf8'), 'restored package')
  assert.deepEqual(readdirSync(f.root).sort(), [
    'apt-archives',
    'microsoft-prod.list',
    'ubuntu.sources',
  ])
})

test('without a cache folder apt keeps its own archive', (t) => {
  const f = fixture(t)
  let checked = false
  installCiBrowser('chromium', {
    ubuntuSources: f.ubuntuSources,
    temporaryRoot: f.root,
    aptArchives: '',
    run(command, args) {
      if (command !== 'sudo') return { status: 0 }
      const config = readFileSync(args[6].slice('APT_CONFIG='.length), 'utf8')
      assert.doesNotMatch(config, /Dir::Cache|Keep-Downloaded/)
      checked = true
      return { status: 0 }
    },
  })
  assert.ok(checked)
})

/** A cache folder as a restore and apt leave it, with apt's own entries. */
function archivesWith(f, names) {
  const aptArchives = join(f.root, 'apt-archives')
  mkdirSync(join(aptArchives, 'partial'), { recursive: true })
  writeFileSync(join(aptArchives, 'lock'), '')
  for (const name of names) writeFileSync(join(aptArchives, name), name)
  return aptArchives
}

test('after the install the cache folder keeps only the package versions dpkg has installed', (t) => {
  const f = fixture(t)
  const aptArchives = archivesWith(f, [
    'fonts-unifont_1%3a15.1.01-1build1_all.deb',
    'libnss3_2%3a3.98-1build1_amd64.deb',
    // Superseded by the version apt downloads below.
    'libgbm1_25.0.7-0ubuntu0.24.04.1_amd64.deb',
    // Removed from the system, its configuration left behind.
    'fonts-freefont-ttf_20211204+svn4273-2_all.deb',
    // The same version for another architecture.
    'libnss3_2%3a3.98-1build1_i386.deb',
    'not-a-package-name.deb',
  ])
  const log = t.mock.method(console, 'log', () => {})
  const calls = []
  installCiBrowser('chromium', {
    ubuntuSources: f.ubuntuSources,
    temporaryRoot: f.root,
    aptArchives,
    run(command, args, options) {
      calls.push(command)
      if (command === 'sudo') {
        writeFileSync(
          join(aptArchives, 'libgbm1_25.0.7-0ubuntu0.24.04.2_amd64.deb'),
          'downloaded',
        )
      }
      if (command !== 'dpkg-query') return { status: 0 }
      assert.deepEqual(args, [
        '-W',
        '-f=${Package}\t${Version}\t${Architecture}\t${db:Status-Status}\n',
      ])
      assert.equal(options.encoding, 'utf8')
      return {
        status: 0,
        stdout: [
          'fonts-freefont-ttf\t20211204+svn4273-2\tall\tconfig-files',
          'fonts-unifont\t1:15.1.01-1build1\tall\tinstalled',
          'libgbm1\t25.0.7-0ubuntu0.24.04.2\tamd64\tinstalled',
          'libnss3\t2:3.98-1build1\tamd64\tinstalled',
          '',
        ].join('\n'),
      }
    },
  })
  assert.deepEqual(
    calls,
    ['sudo', 'dpkg-query', process.execPath],
    'pruned between the dependency install and the browser download, without sudo',
  )
  assert.deepEqual(readdirSync(aptArchives).sort(), [
    'fonts-unifont_1%3a15.1.01-1build1_all.deb',
    'libgbm1_25.0.7-0ubuntu0.24.04.2_amd64.deb',
    'libnss3_2%3a3.98-1build1_amd64.deb',
    'lock',
    'partial',
  ])
  assert.deepEqual(log.mock.calls.at(-1).arguments, [
    'apt cache folder: kept 3 installed packages, removed 4: ' +
      'fonts-freefont-ttf_20211204+svn4273-2_all.deb ' +
      'libgbm1_25.0.7-0ubuntu0.24.04.1_amd64.deb ' +
      'libnss3_2%3a3.98-1build1_i386.deb not-a-package-name.deb',
  ])
})

for (const query of [
  { status: 2 },
  { error: new Error('spawn dpkg-query ENOENT') },
]) {
  test(`a failed dpkg-query leaves the cache folder as it was and still installs the browser: ${JSON.stringify(query)}`, (t) => {
    const f = fixture(t)
    const names = ['libgbm1_25.0.7-0ubuntu0.24.04.1_amd64.deb']
    const aptArchives = archivesWith(f, names)
    const warn = t.mock.method(console, 'warn', () => {})
    const calls = []
    installCiBrowser('chromium', {
      ubuntuSources: f.ubuntuSources,
      temporaryRoot: f.root,
      aptArchives,
      run(command) {
        calls.push(command)
        return command === 'dpkg-query' ? query : { status: 0 }
      },
    })
    assert.deepEqual(calls, ['sudo', 'dpkg-query', process.execPath])
    assert.deepEqual(readdirSync(aptArchives).sort(), [
      ...names,
      'lock',
      'partial',
    ])
    assert.equal(warn.mock.callCount(), 1)
  })
}

test('a failed dependency install prunes nothing', (t) => {
  const f = fixture(t)
  const names = ['libgbm1_25.0.7-0ubuntu0.24.04.1_amd64.deb']
  const aptArchives = archivesWith(f, names)
  const calls = []
  assert.throws(
    () =>
      installCiBrowser('chromium', {
        ubuntuSources: f.ubuntuSources,
        temporaryRoot: f.root,
        aptArchives,
        run(command) {
          calls.push(command)
          return { status: 124 }
        },
      }),
    /sudo exited with 124/,
  )
  assert.deepEqual(calls, ['sudo'])
  assert.deepEqual(readdirSync(aptArchives).sort(), [
    ...names,
    'lock',
    'partial',
  ])
})

for (const aptArchives of [
  'relative/apt',
  '/',
  '/tmp/apt/',
  '/tmp/../etc',
  '/tmp/./apt',
  '/tmp/a"b',
  '/tmp/a b',
  '/tmp/a\nb',
]) {
  test(`a cache folder apt.conf cannot hold is refused before anything starts: ${JSON.stringify(aptArchives)}`, (t) => {
    const f = fixture(t)
    assert.throws(
      () =>
        installCiBrowser('chromium', {
          ubuntuSources: f.ubuntuSources,
          temporaryRoot: f.root,
          aptArchives,
          run() {
            assert.fail('installation must not start')
          },
        }),
      /CI_APT_ARCHIVES must be an absolute path of plain names/,
    )
    assert.deepEqual(readdirSync(f.root).sort(), [
      'microsoft-prod.list',
      'ubuntu.sources',
    ])
  })
}
