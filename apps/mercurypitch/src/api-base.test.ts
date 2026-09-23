// ============================================================
// Which db-worker a build compiles in
// ============================================================
//
// The native bundle shipped with no worker at all, so sign-in on the phone
// failed with "VITE_API_BASE_URL is not configured". The fix has two halves
// that must not drift: the dev worker is the default, and production is a
// switch in the PROCESS environment that nothing in a file can flip.

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
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

describe('the API base a native build compiles in', () => {
  it('is the dev worker out of the committed .env', () => {
    const files = readEnvFiles(APP_DIR, 'production') as Record<string, string>
    const api = resolve(files, {})
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
    writeFileSync(join(dir, '.env'), '# a comment\nA=1\nB=1\nC=1\nD=1\n')
    writeFileSync(join(dir, '.env.local'), 'B=2\nC=2\nD=2\n')
    writeFileSync(join(dir, '.env.production'), "C='3'\nD=3\n")
    writeFileSync(join(dir, '.env.production.local'), 'D="4"\n')
    expect(readEnvFiles(dir, 'production')).toEqual({
      A: '1',
      B: '2',
      C: '3',
      D: '4',
    })
    // A file for another mode is not read.
    expect(readEnvFiles(dir, 'development')).toEqual({
      A: '1',
      B: '2',
      C: '2',
      D: '2',
    })
  })
})
