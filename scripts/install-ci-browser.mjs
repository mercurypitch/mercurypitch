// CI browser installation — isolate OS dependencies from unrelated runner feeds.
// Playwright's apt-get update otherwise fails on third-party repositories that
// do not provide any browser dependencies (for example a Microsoft feed 403).

import { spawnSync } from 'node:child_process'
import { copyFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const require = createRequire(import.meta.url)

export function installCiBrowser(
  browser,
  {
    ubuntuSources = '/etc/apt/sources.list.d/ubuntu.sources',
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
    // Copy the runner's Ubuntu deb822 source verbatim, including Signed-By.
    // Missing/changed runner layout must fail rather than silently enable
    // arbitrary feeds or relax package authentication.
    const sources = join(directory, 'ubuntu.sources')
    copyFileSync(ubuntuSources, sources)
    const config = join(directory, 'apt.conf')
    writeFileSync(
      config,
      `Dir::Etc::sourcelist ${JSON.stringify(sources)};\nDir::Etc::sourceparts "-";\n`,
    )
    // Set APT_CONFIG after sudo: sudo may discard a caller's environment.
    // Only dependency installation runs as root; browser cache stays user-owned.
    checkedRun(run, 'sudo', [
      '-n',
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
