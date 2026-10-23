// game_server.mjs — one Beside Cue dev server per port, and software-WebGL Chromium,
// shared by runtime_proof.mjs and bench_capture.mjs.

import { spawn } from 'node:child_process'
import { closeSync, existsSync, openSync, readFileSync, unlinkSync, writeSync, } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
export const REPO = resolve(HERE, '../../../..')
export const APP = join(REPO, 'apps/beside-cue')
const require = createRequire(join(APP, 'package.json'))
export const { chromium } = require('@playwright/test')

// One proof at a time on a port: a pipeline's proof, a probe batch and a critic's
// run all want it, and two dev servers on one port fail. Wait for the lock; a lock
// whose process has gone is stale.
export async function acquirePortLock(port) {
  const lock = join(tmpdir(), `glassworks-proof-${port}.lock`)
  for (;;) {
    try {
      const fd = openSync(lock, 'wx')
      writeSync(fd, String(process.pid))
      closeSync(fd)
      break
    } catch (error) {
      if (error.code !== 'EEXIST') throw error
    }
    const holder = Number(readFileSync(lock, 'utf8'))
    let alive = !(Number.isInteger(holder) && holder > 0) // being written: wait
    try {
      if (!alive) alive = process.kill(holder, 0)
    } catch {
      alive = false
    }
    if (!alive) {
      try {
        unlinkSync(lock)
      } catch {}
      continue
    }
    await sleep(5000)
  }
  return () => {
    try {
      if (Number(readFileSync(lock, 'utf8')) === process.pid) unlinkSync(lock)
    } catch {}
  }
}

/** The games-enabled dev server on 127.0.0.1:port. Stops with the process. */
export function startGameServer(port) {
  const server = spawn(
    process.execPath,
    [
      join(APP, 'node_modules/vite/bin/vite.js'),
      '--host',
      '127.0.0.1',
      '--port',
      String(port),
      '--strictPort',
    ],
    {
      cwd: APP,
      env: { ...process.env, VITE_BESIDE_CUE_GAMES: '1' },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  )
  let log = ''
  server.stdout.on('data', (chunk) => (log += chunk))
  server.stderr.on('data', (chunk) => (log += chunk))
  const base = `http://127.0.0.1:${port}`
  return {
    base,
    log: () => log,
    async waitUntilUp(path) {
      for (let i = 0; i < 120; i += 1) {
        try {
          const response = await fetch(`${base}${path}`)
          if (response.ok) return
        } catch {
          // not up yet
        }
        await sleep(1000)
      }
      throw new Error(`Vite did not start:\n${log.slice(-2000)}`)
    },
    stop: () => server.kill('SIGTERM'),
  }
}

/** Releases the lock and stops the server on exit and on Ctrl-C. */
export function cleanUpOnExit(release, server) {
  process.on('exit', () => {
    server.stop()
    release()
  })
  for (const signal of ['SIGINT', 'SIGTERM'])
    process.on(signal, () => process.exit(130))
}

// Cloud containers ship one preinstalled Chromium; prefer it over a download.
export function launchSoftwareChromium() {
  const preinstalled = process.env.PROOF_CHROMIUM ?? '/opt/pw-browsers/chromium'
  return chromium.launch({
    executablePath: existsSync(preinstalled) ? preinstalled : undefined,
    args: [
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
      '--ignore-gpu-blocklist',
    ],
  })
}
