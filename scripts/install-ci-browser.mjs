// CI browser installation — isolate OS dependencies from unrelated runner feeds.
// Playwright's apt-get update otherwise fails on third-party repositories that
// do not provide any browser dependencies (for example a Microsoft feed 403).

import { spawnSync } from 'node:child_process'
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync, } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const require = createRequire(import.meta.url)

export function installCiBrowser(
  browser,
  {
    ubuntuSources = '/etc/apt/sources.list.d/ubuntu.sources',
    ubuntuMirrors = '/etc/apt/apt-mirrors.txt',
    temporaryRoot = process.env.RUNNER_TEMP || tmpdir(),
    run = spawnSync,
  } = {},
) {
  if (!['chromium', 'webkit'].includes(browser)) {
    throw new Error('Specify chromium or webkit for CI browser installation')
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
    const config = join(directory, 'apt.conf')
    writeFileSync(
      config,
      `Dir::Etc::sourcelist ${JSON.stringify(sources)};\nDir::Etc::sourceparts "-";\n` +
        'Acquire::http::Timeout "15";\nAcquire::https::Timeout "15";\n' +
        'APT::Update::Error-Mode "any";\n',
    )
    // Set APT_CONFIG after sudo: sudo may discard a caller's environment.
    // Only dependency installation runs as root; browser cache stays user-owned.
    checkedRun(run, 'sudo', [
      '-n',
      // Root-owned timeout terminates the whole dependency process group,
      // including apt descendants; timing out the outer sudo is insufficient.
      '/usr/bin/timeout',
      '--signal=TERM',
      '--kill-after=15s',
      '300s',
      'env',
      `APT_CONFIG=${config}`,
      process.execPath,
      cli,
      'install-deps',
      browser,
    ])
    checkedRun(run, process.execPath, [cli, 'install', browser])
  } finally {
    rmSync(directory, { recursive: true, force: true })
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
