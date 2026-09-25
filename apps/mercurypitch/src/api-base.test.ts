// ============================================================
// Which db-worker a build compiles in
// ============================================================
//
// The native bundle shipped with no worker at all, so sign-in on the phone
// failed with "VITE_API_BASE_URL is not configured". The fix has two halves
// that must not drift: the dev worker is the default, and production is a
// switch in the PROCESS environment that nothing in a file can flip.

import { copyFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
// @ts-expect-error -- a plain .mjs module with no types, shared with a Vite
// config and with a bare-node script that runs before any install.
import { API_BASES, readEnvFiles, resolveApiBase } from '../api-base.mjs'

interface Resolved {
  base: string
  target: string
  source: string
}

const resolve = (
  files: Record<string, string>,
  env: Record<string, string>,
): Resolved => resolveApiBase(files, env) as Resolved

const APP_DIR = fileURLToPath(new URL('..', import.meta.url))

// What this suite's config hands every app test, read before any case
// touches it: no API base, as in the root config. The committed .env names
// the live dev worker, and a test that reached getDb() would talk to it.
const SUITE_BASE = process.env.VITE_API_BASE_URL

describe('the app suite', () => {
  it('runs with no API base, whatever the committed .env names', () => {
    expect(SUITE_BASE).toBe('')
  })
})

// Vite lets a VITE_ variable in the process win over the files, and this
// suite's config sets VITE_API_BASE_URL to '' (as the root's does): a case
// about what the FILES say takes it out of the process while it reads them.
let saved: string | undefined
beforeEach(() => {
  saved = process.env.VITE_API_BASE_URL
  delete process.env.VITE_API_BASE_URL
})
afterEach(() => {
  if (saved === undefined) delete process.env.VITE_API_BASE_URL
  else process.env.VITE_API_BASE_URL = saved
})

describe('the API base a native build compiles in', () => {
  it('is the dev worker out of the committed .env', () => {
    // Only the committed file: a developer's gitignored .env.local (which
    // .env.example tells them to create) is not what this promises.
    const dir = mkdtempSync(join(tmpdir(), 'mp-committed-'))
    try {
      copyFileSync(join(APP_DIR, '.env'), join(dir, '.env'))
      const files = readEnvFiles(dir, 'production') as Record<string, string>
      const api = resolve(files, {})
      expect(api.base).toBe(API_BASES.dev)
      expect(api.target).toBe('dev')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('takes the dev worker with a trailing slash as the dev worker', () => {
    const api = resolve({ VITE_API_BASE_URL: `${API_BASES.dev}/` }, {})
    expect(api.base).toBe(API_BASES.dev)
    expect(api.target).toBe('dev')
  })

  it('is production only when the process asks for it', () => {
    const api = resolve(
      { VITE_API_BASE_URL: API_BASES.dev },
      {
        MERCURYPITCH_API_TARGET: 'production',
      },
    )
    expect(api.base).toBe('https://api.mercurypitch.com')
    expect(api.source).toContain('MERCURYPITCH_API_TARGET=production')
  })

  it('never reads the switch out of an env file', () => {
    // A stray `.env.local` with the switch in it must not turn every build
    // on that machine into a production build.
    const api = resolve(
      {
        VITE_API_BASE_URL: API_BASES.dev,
        MERCURYPITCH_API_TARGET: 'production',
      },
      {},
    )
    expect(api.base).toBe(API_BASES.dev)
  })

  it('refuses the production URL typed in without the switch', () => {
    expect(() =>
      resolve({ VITE_API_BASE_URL: 'https://api.mercurypitch.com/' }, {}),
    ).toThrow(/only through that switch/u)
    expect(() =>
      resolve({}, { VITE_API_BASE_URL: 'https://api.mercurypitch.com' }),
    ).toThrow(/MERCURYPITCH_API_TARGET=production/u)
  })

  it('lets a local worker override the default, and dev override that', () => {
    const local = resolve({ VITE_API_BASE_URL: 'http://localhost:8788' }, {})
    expect(local.base).toBe('http://localhost:8788')
    expect(local.target).toBe('configured')

    const forced = resolve(
      { VITE_API_BASE_URL: 'http://localhost:8788' },
      { MERCURYPITCH_API_TARGET: 'dev' },
    )
    expect(forced.base).toBe(API_BASES.dev)
  })

  it('rejects a switch it does not know', () => {
    expect(() => resolve({}, { MERCURYPITCH_API_TARGET: 'prod' })).toThrow(
      /takes "dev" or "production"/u,
    )
  })

  it('says so when nothing names a worker at all', () => {
    const api = resolve({}, {})
    expect(api.base).toBe('')
    expect(api.source).toMatch(/nothing/u)
  })
})

describe('the env files, in the order Vite reads them', () => {
  let dir = ''
  afterEach(() => {
    if (dir !== '') rmSync(dir, { recursive: true, force: true })
    dir = ''
  })

  it('lets each later file win over the one before it', () => {
    dir = mkdtempSync(join(tmpdir(), 'mp-env-'))
    writeFileSync(
      join(dir, '.env'),
      '# a comment\nVITE_A=1\nVITE_B=1\nVITE_C=1\nVITE_D=1\n',
    )
    writeFileSync(join(dir, '.env.local'), 'VITE_B=2\nVITE_C=2\nVITE_D=2\n')
    writeFileSync(join(dir, '.env.production'), "VITE_C='3'\nVITE_D=3\n")
    writeFileSync(join(dir, '.env.production.local'), 'VITE_D="4"\n')
    expect(readEnvFiles(dir, 'production')).toMatchObject({
      VITE_A: '1',
      VITE_B: '2',
      VITE_C: '3',
      VITE_D: '4',
    })
    // A file for another mode is not read.
    expect(readEnvFiles(dir, 'development')).toMatchObject({
      VITE_A: '1',
      VITE_B: '2',
      VITE_C: '2',
      VITE_D: '2',
    })
  })

  // Each of these once shipped a base Vite would have read differently: the
  // build and the check agreed with each other and not with the file.
  const base = (text: string): string => {
    dir = mkdtempSync(join(tmpdir(), 'mp-env-'))
    writeFileSync(join(dir, '.env'), text)
    return resolve(
      readEnvFiles(dir, 'production') as Record<string, string>,
      {},
    ).base
  }

  it('drops an inline comment', () => {
    expect(base(`VITE_API_BASE_URL=${API_BASES.dev} # the dev worker\n`)).toBe(
      API_BASES.dev,
    )
  })

  it('reads a line with an export prefix', () => {
    expect(base(`export VITE_API_BASE_URL=${API_BASES.dev}\n`)).toBe(
      API_BASES.dev,
    )
  })

  it('unquotes a quoted value', () => {
    expect(base(`VITE_API_BASE_URL="${API_BASES.dev}"\n`)).toBe(API_BASES.dev)
    expect(base(`VITE_API_BASE_URL='${API_BASES.dev}'\n`)).toBe(API_BASES.dev)
  })

  it('expands a ${VAR} reference', () => {
    expect(
      base(
        'VITE_WORKER_HOST=api-dev.mercurypitch.com\nVITE_API_BASE_URL=https://${VITE_WORKER_HOST}\n',
      ),
    ).toBe(API_BASES.dev)
  })
})
