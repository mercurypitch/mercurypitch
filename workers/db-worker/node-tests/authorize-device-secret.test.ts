// @vitest-environment node
// ============================================================
// authorizeDeviceSecret — the one gate every takeover path goes through
// ============================================================
//
// The integration test proves the endpoints refuse a harvested id. This pins
// the decision itself, including the two cases that are only visible from
// here: what counts as a secret at all, and what a bind writes.
//
// A real (in-memory) SQLite stands in for D1, because binding is a write and
// asserting that a mock was called would prove nothing about whether the row
// changed. That is also why this lives in node-tests/ rather than beside the
// module: node:sqlite is not in the worker's own tsconfig lib, by design.

import { createHash } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { authorizeDeviceSecret } from '../src/auth'

const USER = '00000000-0000-4000-8000-0000000000e1'
const SECRET = 'zt4Vv9Qk2Lm7Xr0Bc5Nh8Jf3Wp6Ys1Ad4Ge7Ku0Mq2'
const OTHER = 'aa1Bb2Cc3Dd4Ee5Ff6Gg7Hh8Ii9Jj0Kk1Ll2Mm3Nn4'
/** Independently computed, so the digest is checked against node's SHA-256
 *  rather than against the implementation's own hasher agreeing with itself. */
const sha256 = (value: string): string =>
  createHash('sha256').update(value, 'utf8').digest('hex')
const SECRET_HASH = sha256(SECRET)

let sqlite: DatabaseSync
let db: D1Database

/** Enough of D1 for the one UPDATE this function runs. */
function d1(native: DatabaseSync): D1Database {
  return {
    prepare: (sql: string) => ({
      bind: (...values: unknown[]) => ({
        run: async () => ({
          success: true,
          meta: {
            changes: Number(
              native.prepare(sql).run(...(values as never[])).changes,
            ),
          },
        }),
      }),
    }),
  } as unknown as D1Database
}

function hashOf(id: string): string | null {
  return (
    sqlite
      .prepare('SELECT deviceSecretHash FROM users WHERE id = ?')
      .get(id) as { deviceSecretHash: string | null }
  ).deviceSecretHash
}

function seed(deviceSecretHash: string | null): void {
  sqlite
    .prepare('INSERT INTO users (id, deviceSecretHash) VALUES (?, ?)')
    .run(USER, deviceSecretHash)
}

/** The row shape the function reads, straight from the table. */
function row(): { id: string; deviceSecretHash: string | null } {
  return sqlite
    .prepare('SELECT id, deviceSecretHash FROM users WHERE id = ?')
    .get(USER) as { id: string; deviceSecretHash: string | null }
}

beforeEach(() => {
  sqlite = new DatabaseSync(':memory:')
  sqlite.exec(
    'CREATE TABLE users (id TEXT PRIMARY KEY, deviceSecretHash TEXT, updatedAt TEXT)',
  )
  db = d1(sqlite)
})

afterEach(() => {
  sqlite.close()
})

describe('an account that has bound a secret', () => {
  beforeEach(() => {
    seed(SECRET_HASH)
  })

  it('admits the secret it bound', async () => {
    expect(await authorizeDeviceSecret(db, row(), SECRET)).toBe(true)
    expect(hashOf(USER)).toBe(SECRET_HASH)
  })

  it('refuses a different secret, and does not rebind', async () => {
    expect(await authorizeDeviceSecret(db, row(), OTHER)).toBe(false)
    expect(hashOf(USER)).toBe(SECRET_HASH)
  })

  it('refuses a caller that presents none', async () => {
    // The old client build. Against a bound account that is either an
    // out-of-date app or the replay attack, and both must stop here.
    expect(await authorizeDeviceSecret(db, row(), undefined)).toBe(false)
    expect(await authorizeDeviceSecret(db, row(), '')).toBe(false)
    expect(hashOf(USER)).toBe(SECRET_HASH)
  })

  it('treats an empty stored hash as never bound', async () => {
    // Defensive: a '' would compare unequal to every real digest and lock the
    // account out of its own history for good.
    sqlite
      .prepare("UPDATE users SET deviceSecretHash = '' WHERE id = ?")
      .run(USER)

    expect(await authorizeDeviceSecret(db, row(), SECRET)).toBe(true)
    expect(hashOf(USER)).toBe('')
  })
})

describe('an account from before the secret existed', () => {
  beforeEach(() => {
    seed(null)
  })

  it('is admitted, and binds what it was shown', async () => {
    expect(await authorizeDeviceSecret(db, row(), SECRET)).toBe(true)

    // The stored value is the digest, not the secret — the row is readable by
    // anyone with database access, and a plaintext credential there would put
    // the takeover back exactly where it started.
    expect(hashOf(USER)).toBe(SECRET_HASH)
    expect(hashOf(USER)).not.toBe(SECRET)
    expect(await authorizeDeviceSecret(db, row(), OTHER)).toBe(false)
  })

  it('is admitted with nothing, and stays unbound', async () => {
    expect(await authorizeDeviceSecret(db, row(), undefined)).toBe(true)
    expect(hashOf(USER)).toBeNull()
  })

  it('does not bind something that cannot be a secret', async () => {
    // Binding junk would be worse than binding nothing: the account would be
    // locked to a value the real device does not hold and never will. These
    // are admitted (grandfathered) but leave the row open.
    for (const junk of [
      '',
      'short',
      'a'.repeat(21), // one below the floor
      'has spaces and is easily long enough to pass a length check',
      'punctuation!@#$%^&*()punctuation!@#$%^&*()',
      'x'.repeat(129), // one above the ceiling
    ]) {
      expect(await authorizeDeviceSecret(db, row(), junk)).toBe(true)
      expect(hashOf(USER)).toBeNull()
    }

    // The boundaries themselves are secrets, and do bind.
    expect(await authorizeDeviceSecret(db, row(), 'a'.repeat(22))).toBe(true)
    expect(hashOf(USER)).toBe(sha256('a'.repeat(22)))
  })

  it('binds only the row it was asked about', async () => {
    sqlite
      .prepare('INSERT INTO users (id, deviceSecretHash) VALUES (?, NULL)')
      .run('00000000-0000-4000-8000-0000000000e2')

    await authorizeDeviceSecret(db, row(), SECRET)

    expect(hashOf('00000000-0000-4000-8000-0000000000e2')).toBeNull()
  })

  it('does not overwrite a secret bound between the read and the write', async () => {
    // Two first sign-ins racing. The UPDATE carries `AND deviceSecretHash IS
    // NULL`, so the loser writes nothing rather than stealing the account from
    // the winner.
    const stale = row()
    sqlite
      .prepare('UPDATE users SET deviceSecretHash = ? WHERE id = ?')
      .run(SECRET_HASH, USER)

    await authorizeDeviceSecret(db, stale, OTHER)

    expect(hashOf(USER)).toBe(SECRET_HASH)
  })
})
