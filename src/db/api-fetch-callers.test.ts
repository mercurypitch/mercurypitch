// ============================================================
// Every call to the Mercury Pitch servers goes through fetchWithDeadline
// ============================================================
//
// A request made with fetch() itself has no deadline, and does not know that
// the API was just found out of reach. On a network that held requests to the
// API host, each such call waited out the hold, a minute and more, and Home's
// Legend card sat on "loading" for all of it (28 Nov 2026).
//
// So this reads the source. A module that names one of our servers (the API
// base, requireBaseUrl, the site worker's origin, or a path under /api/) may
// not call fetch() or open an XMLHttpRequest itself, except where it is
// listed below, with why. The counts are exact, so an entry that no longer
// applies fails too.

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = process.cwd()
const SCANNED = ['src', 'apps/mercurypitch/src']

/** What naming one of our servers looks like. */
const NAMES_A_SERVER =
  /\bAPI_BASE_URL\b|\brequireBaseUrl\b|VITE_API_BASE_URL|\bUVR_ORIGIN\b|['"`]\/api\//

/** A request made directly: fetch( on its own, or an XMLHttpRequest. */
const DIRECT_REQUEST = /(?<![\w.$])fetch\(|\bnew XMLHttpRequest\(/g

/**
 * Code that runs in the site worker (src/worker.ts and what it imports), not
 * in the page. Its calls go from Cloudflare to the API, not over the
 * singer's network, so neither the deadline nor the page's gate is theirs.
 */
const RUNS_IN_THE_SITE_WORKER = new Set([
  'src/worker.ts',
  'src/lesson-gate.ts',
  'src/og-card-handler.ts',
  'src/share-handler.ts',
  'src/uvr-container.ts',
  'src/lib/runpod.ts',
  'src/lib/runpod-bridge.ts',
  'src/lib/runpod-stem-storage.ts',
  'src/lib/uvr-metering.ts',
])

/** Direct requests that stay, by module, with the reason. */
const ALLOWED: Record<string, { requests: number; why: string }> = {
  'src/features/karaoke-night/demo-song.ts': {
    requests: 2,
    why: "the bundled /karaoke-demo-song.json and a song's lyrics file: static files, not the API",
  },
  'src/features/admin/demo-song-admin-service.ts': {
    requests: 1,
    why: 'the bundled /karaoke-demo-song.json, a static file',
  },
  'src/stores/experimental-features-store.ts': {
    requests: 1,
    why:
      'the startup read of the switches, which ends by its own AbortController at 30 s and is made once, before any ' +
      'other call could have closed the gate. src/tests/setup-common.ts imports this store, so importing the helper ' +
      "here would load it into every test file ahead of that file's own mocks",
  },
  'src/features/lessons/kit/telemetry.ts': {
    requests: 1,
    why:
      "a lesson page's anonymous answer beacon. The page loads it with no solid-js on purpose (see its header), " +
      'and the helper brings the notification store; nothing waits on it, and a lesson page makes no other call ' +
      'to the API for a window to save',
  },
  'src/lib/uvr-api.ts': {
    requests: 1,
    why: 'the upload that reports its progress, an XMLHttpRequest, which carries the same deadline as xhr.timeout',
  },
}

function sourceFiles(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) {
      if (['e2e', 'e2e-cloud', 'tests', '__tests__'].includes(name)) continue
      out.push(...sourceFiles(path))
    } else if (/\.(ts|tsx)$/.test(name) && !/\.(test|spec)\.tsx?$/.test(name)) {
      out.push(path)
    }
  }
  return out
}

/** The module's code, without the lines that are only comments. */
function code(path: string): string {
  return readFileSync(path, 'utf8')
    .split('\n')
    .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
    .join('\n')
}

/** Every module that names a server and makes requests directly, and how many. */
function directRequests(): Record<string, number> {
  const found: Record<string, number> = {}
  for (const root of SCANNED) {
    for (const path of sourceFiles(resolve(ROOT, root))) {
      const file = relative(ROOT, path)
      if (RUNS_IN_THE_SITE_WORKER.has(file)) continue
      const text = code(path)
      if (!NAMES_A_SERVER.test(text)) continue
      const requests = text.match(DIRECT_REQUEST)?.length ?? 0
      if (requests > 0) found[file] = requests
    }
  }
  return found
}

describe('calls to our servers', () => {
  it('go through fetchWithDeadline, but for the ones listed with a reason', () => {
    const allowed = Object.fromEntries(
      Object.entries(ALLOWED).map(([file, entry]) => [file, entry.requests]),
    )

    expect(directRequests()).toEqual(allowed)
  })

  it('leave out of the scan only modules that exist', () => {
    const missing = [
      ...RUNS_IN_THE_SITE_WORKER,
      ...Object.keys(ALLOWED),
    ].filter((file) => {
      try {
        return !statSync(resolve(ROOT, file)).isFile()
      } catch {
        return true
      }
    })

    expect(missing).toEqual([])
  })
})
