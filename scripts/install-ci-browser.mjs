// CI browser installation — isolate OS dependencies from unrelated runner feeds.
// Playwright's apt-get update otherwise fails on third-party repositories that
// do not provide any browser dependencies (for example a Microsoft feed 403).

import { spawnSync } from 'node:child_process'
import { chmodSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync, } from 'node:fs'
import { createRequire } from 'node:module'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const require = createRequire(import.meta.url)

export function installCiBrowser(
  browser,
  {
    ubuntuSources = '/etc/apt/sources.list.d/ubuntu.sources',
    ubuntuMirrors = '/etc/apt/apt-mirrors.txt',
    // The APT sandbox must traverse every ancestor. RUNNER_TEMP and TMPDIR
    // can point inside private runner directories, even if our child is 0755.
    temporaryRoot = '/tmp',
    // Where apt keeps the packages it downloads, so CI can carry them from
    // run to run in the Actions cache (.github/actions/install-browser).
    // After the install it holds only the package versions now installed.
    // Unset, apt keeps them in its own archive and they end with the job.
    aptArchives = process.env.CI_APT_ARCHIVES ?? '',
    run = spawnSync,
  } = {},
) {
  if (!['chromium', 'webkit'].includes(browser)) {
    throw new Error('Specify chromium or webkit for CI browser installation')
  }
  // apt.conf holds the folder as a quoted string: plain names only, absolute,
  // with no . or .. segment.
  if (aptArchives !== '' && !/^(?:\/[\w-][\w.-]*)+$/.test(aptArchives)) {
    throw new Error('CI_APT_ARCHIVES must be an absolute path of plain names')
  }
  const cli = require.resolve('@playwright/test/cli')
  const directory = mkdtempSync(join(temporaryRoot, 'playwright-apt-'))
  try {
    // Keep suites, components and Signed-By. Change only the known failing
    // Azure HTTP route, never the runner's global files or package trust.
    const sources = join(directory, 'ubuntu.sources')
    const original = readFileSync(ubuntuSources, 'utf8')
    const rewritten = original.replace(/^URIs:([^\r\n]*)/gm, (field) =>
      field
        .replace(
          /(?<=\s)mirror\+file:\/etc\/apt\/apt-mirrors\.txt(?=\s|$)/g,
          () => {
            const mirrors = readFileSync(ubuntuMirrors, 'utf8')
            if (
              !/^https:\/\/(archive|security)\.ubuntu\.com\/ubuntu\/?(?:\s|$)/m.test(
                mirrors,
              )
            ) {
              throw new Error(
                'Ubuntu mirror list has no official HTTPS fallback',
              )
            }
            const filtered = mirrors
              .split('\n')
              .filter(
                (line) =>
                  !/^http:\/\/azure\.archive\.ubuntu\.com\/ubuntu\/?(?:\s|$)/.test(
                    line,
                  ),
              )
              .join('\n')
            const mirrorPath = join(directory, 'apt-mirrors.txt')
            writeFileSync(mirrorPath, filtered, { mode: 0o644 })
            // APT reads file mirrors as _apt. These files contain no secrets.
            chmodSync(mirrorPath, 0o644)
            chmodSync(directory, 0o755)
            return `mirror+${pathToFileURL(mirrorPath).href}`
          },
        )
        .replace(
          /(?<=\s)http:\/\/azure\.archive\.ubuntu\.com\/ubuntu\/?(?=\s|$)/g,
          'https://archive.ubuntu.com/ubuntu/',
        ),
    )
    writeFileSync(sources, rewritten)
    let archives = ''
    if (aptArchives !== '') {
      // This user owns the folder and opens it to the _apt sandbox, which
      // writes the downloads: apt makes its own partial/ inside and hands it
      // to _apt. Keep it under the system /tmp, like the mirror list above.
      // apt takes a package already in the folder on its size alone, without
      // its hash, so the folder is only as trusted as what fills it.
      mkdirSync(aptArchives, { recursive: true })
      chmodSync(aptArchives, 0o755)
      archives =
        `Dir::Cache::Archives ${JSON.stringify(`${aptArchives}/`)};\n` +
        'APT::Keep-Downloaded-Packages "true";\n'
    }
    const config = join(directory, 'apt.conf')
    writeFileSync(
      config,
      `Dir::Etc::sourcelist ${JSON.stringify(sources)};\nDir::Etc::sourceparts "-";\n` +
        'Acquire::http::Timeout "15";\nAcquire::https::Timeout "15";\n' +
        'APT::Update::Error-Mode "any";\n' +
        archives,
    )
    // Set APT_CONFIG after sudo: sudo may discard a caller's environment.
    // Only dependency installation runs as root; browser cache stays user-owned.
    checkedRun(run, 'sudo', [
      '-n',
      // Root-owned timeout terminates the whole dependency process group,
      // including apt descendants; timing out the outer sudo is insufficient.
      // Ten minutes, and no retry: on 18 Nov 2026 a slow mirror needed more
      // than five for Chromium's 32.1 MB. Past ten, wait for the mirror.
      '/usr/bin/timeout',
      '--signal=TERM',
      '--kill-after=15s',
      '600s',
      'env',
      `APT_CONFIG=${config}`,
      process.execPath,
      cli,
      'install-deps',
      browser,
    ])
    if (aptArchives !== '') pruneArchives(run, aptArchives)
    checkedRun(run, process.execPath, [cli, 'install', browser])
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
}

// apt never empties the folder it is given, and each cache entry seeds the
// next, so every superseded package would ride along for good. Keep the
// versions dpkg now has installed: the ones a later run can reuse. The folder
// belongs to this user, so it may remove the root-owned files apt left there.
// Pruning only trims the cache: if dpkg-query fails, the folder stays as it is.
function pruneArchives(run, aptArchives) {
  const query = run(
    'dpkg-query',
    ['-W', '-f=${Package}\t${Version}\t${Architecture}\t${db:Status-Status}\n'],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] },
  )
  if (query.error || query.status !== 0) {
    console.warn(
      '::warning::dpkg-query failed, so the apt cache folder was not pruned',
    )
    return
  }
  const installed = new Set(
    query.stdout
      .split('\n')
      .filter((line) => line.endsWith('\tinstalled'))
      .map((line) => line.split('\t').slice(0, 3).join('\t')),
  )
  const removed = []
  let kept = 0
  for (const name of readdirSync(aptArchives).sort()) {
    if (!name.endsWith('.deb')) continue
    if (installed.has(debIdentity(name))) {
      kept += 1
    } else {
      rmSync(join(aptArchives, name), { force: true })
      removed.push(name)
    }
  }
  console.log(
    `apt cache folder: kept ${kept} installed packages, removed ${removed.length}` +
      (removed.length > 0 ? `: ${removed.join(' ')}` : ''),
  )
}

// apt names a package file <package>_<version>_<architecture>.deb and writes
// an epoch's colon as %3a: x11-common_1%3a7.7+23ubuntu3_all.deb. A name that
// does not parse matches nothing installed, so it is removed.
function debIdentity(name) {
  const fields = name.slice(0, -'.deb'.length).split('_')
  if (fields.length !== 3) return ''
  try {
    return fields.map((field) => decodeURIComponent(field)).join('\t')
  } catch {
    return ''
  }
}

function checkedRun(run, command, args) {
  const result = run(command, args, { stdio: 'inherit' })
  if (result.error) throw result.error
  if (result.status !== 0) {
    throw new Error(
      `Browser setup failed: ${command} exited with ${result.status ?? result.signal}`,
    )
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  installCiBrowser(process.argv[2])
}
