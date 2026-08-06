import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Env } from './auth'
import { getAuth, handleAuth } from './auth'
import { AccountSuspendedError } from './moderation'
import { resolvePremiumBackgroundAccess } from './premium-background-access'

interface UserRecord {
  id: string
  createdAt: string
  updatedAt: string
  authProvider: string
  providerId: string | null
  email: string | null
  emailVerified: number
  passwordHash: string | null
  lastLoginAt: string | null
  lastActiveAt: string | null
  tokenVersion: number
  suspendedAt: string | null
  suspensionReason: string | null
}

interface PremiumGroupMemberRecord {
  email: string
  groupId: string
  grantedAt: string
  note: string | null
  revokedAt: string | null
}

interface PremiumAuditRecord {
  actorId: string | null
  actorType: 'access' | 'admin-key' | 'system' | 'user'
  details: Record<string, unknown>
  entityId: string
  entityType: string
}

class AuthStatement {
  private values: unknown[] = []

  constructor(
    private readonly db: AuthDatabase,
    private readonly sql: string,
  ) {}

  bind(...values: unknown[]): AuthStatement {
    this.values = values
    return this
  }

  async first<T>(): Promise<T | null> {
    if (this.sql.startsWith('INSERT INTO auth_ratelimit')) {
      return {
        count: 1,
        windowStart: Date.now(),
      } as T
    }

    if (this.sql === 'SELECT * FROM users WHERE id = ?') {
      return (this.db.users.get(String(this.values[0])) ?? null) as T | null
    }

    if (
      this.sql ===
      'SELECT tokenVersion, lastActiveAt, suspendedAt FROM users WHERE id = ?'
    ) {
      const user = this.db.users.get(String(this.values[0]))
      if (!user) return null
      return {
        tokenVersion: user.tokenVersion,
        lastActiveAt: user.lastActiveAt,
        suspendedAt: user.suspendedAt,
      } as T
    }

    if (this.sql === 'SELECT * FROM userProfiles WHERE id = ?') {
      return (this.db.profiles.get(String(this.values[0])) ?? null) as T | null
    }

    if (this.sql === 'SELECT * FROM users WHERE email = ?') {
      const email = String(this.values[0])
      return ([...this.db.users.values()].find(
        (user) => user.email === email,
      ) ?? null) as T | null
    }

    if (this.sql === 'SELECT * FROM users WHERE providerId = ?') {
      const providerId = String(this.values[0])
      return ([...this.db.users.values()].find(
        (user) => user.providerId === providerId,
      ) ?? null) as T | null
    }

    if (this.sql === 'SELECT email, emailVerified FROM users WHERE id = ?') {
      const user = this.db.users.get(String(this.values[0]))
      if (!user) return null
      return {
        email: user.email,
        emailVerified: user.emailVerified,
      } as T
    }

    if (
      this.sql ===
      'SELECT email, emailVerified FROM users WHERE id = ?1 LIMIT 1'
    ) {
      const user = this.db.users.get(String(this.values[0]))
      if (!user) return null
      return {
        email: user.email,
        emailVerified: user.emailVerified,
      } as T
    }

    if (
      this.sql ===
      "SELECT expiresAt FROM entitlements WHERE userId = ?1 AND feature = 'supporter' LIMIT 1"
    ) {
      return null
    }

    throw new Error(`Unexpected first() SQL: ${this.sql}`)
  }

  async all<T>(): Promise<{ results: T[] }> {
    if (this.sql.includes('FROM premiumSupporterGroupMembers m')) {
      const email = String(this.values[0]).toLowerCase()
      const backgroundIds = [...this.db.premiumGroupMembers.values()]
        .filter(
          (member) =>
            member.email.toLowerCase() === email && member.revokedAt === null,
        )
        .flatMap(
          (member) => this.db.premiumGroupPerks.get(member.groupId) ?? [],
        )
      return {
        results: backgroundIds.map((backgroundId) => ({ backgroundId })) as T[],
      }
    }

    throw new Error(`Unexpected all() SQL: ${this.sql}`)
  }

  async run(): Promise<{ success: true }> {
    if (this.sql.startsWith('INSERT INTO users ')) {
      const [
        id,
        createdAt,
        updatedAt,
        authProvider,
        providerId,
        email,
        emailVerified,
        passwordHash,
        lastLoginAt,
      ] = this.values
      this.db.users.set(String(id), {
        id: String(id),
        createdAt: String(createdAt),
        updatedAt: String(updatedAt),
        authProvider: String(authProvider),
        providerId: providerId == null ? null : String(providerId),
        email: email == null ? null : String(email),
        emailVerified: Number(emailVerified),
        passwordHash: passwordHash == null ? null : String(passwordHash),
        lastLoginAt: lastLoginAt == null ? null : String(lastLoginAt),
        lastActiveAt: null,
        tokenVersion: 1,
        suspendedAt: null,
        suspensionReason: null,
      })
      return { success: true }
    }

    if (this.sql.startsWith("UPDATE users SET authProvider = 'password'")) {
      const [email, passwordHash, updatedAt, id] = this.values
      Object.assign(this.db.user(String(id)), {
        authProvider: 'password',
        email: String(email),
        passwordHash: String(passwordHash),
        tokenVersion: this.db.user(String(id)).tokenVersion + 1,
        updatedAt: String(updatedAt),
      })
      return { success: true }
    }

    if (this.sql.startsWith("UPDATE users SET authProvider = 'google'")) {
      const [providerId, email, emailVerified, updatedAt, id] = this.values
      Object.assign(this.db.user(String(id)), {
        authProvider: 'google',
        providerId: String(providerId),
        email: email == null ? null : String(email),
        emailVerified: Number(emailVerified),
        tokenVersion: this.db.user(String(id)).tokenVersion + 1,
        updatedAt: String(updatedAt),
      })
      return { success: true }
    }

    if (this.sql.startsWith('UPDATE users SET lastLoginAt = ?')) {
      const [lastLoginAt, updatedAt, id] = this.values
      Object.assign(this.db.user(String(id)), {
        lastLoginAt: String(lastLoginAt),
        updatedAt: String(updatedAt),
      })
      return { success: true }
    }

    if (this.sql.startsWith('INSERT OR IGNORE INTO userProfiles')) {
      return { success: true }
    }

    if (
      this.sql ===
      'DELETE FROM premiumSupporterGroupMembers WHERE email = ?1 COLLATE NOCASE'
    ) {
      const email = String(this.values[0]).toLowerCase()
      for (const [key, member] of this.db.premiumGroupMembers) {
        if (member.email.toLowerCase() === email) {
          this.db.premiumGroupMembers.delete(key)
        }
      }
      return { success: true }
    }

    if (
      this.sql ===
      "DELETE FROM premiumPerkAudit WHERE actorType = 'user' AND actorId = ?1"
    ) {
      const userId = String(this.values[0])
      for (let index = this.db.premiumAudit.length - 1; index >= 0; index--) {
        const audit = this.db.premiumAudit[index]
        if (audit?.actorType === 'user' && audit.actorId === userId) {
          this.db.premiumAudit.splice(index, 1)
        }
      }
      return { success: true }
    }

    if (
      this.sql ===
      'UPDATE premiumPerkAudit SET actorId = NULL WHERE actorId = ?1'
    ) {
      const userId = String(this.values[0])
      for (const audit of this.db.premiumAudit) {
        if (audit.actorId === userId) audit.actorId = null
      }
      return { success: true }
    }

    if (this.sql.startsWith('UPDATE premiumPerkAudit SET actorId = CASE')) {
      const email = String(this.values[0]).toLowerCase()
      for (const audit of this.db.premiumAudit) {
        if (audit.actorId?.toLowerCase() === email) audit.actorId = null
        if (
          audit.entityType === 'supporter-group-member' &&
          String(audit.details.email ?? '').toLowerCase() === email
        ) {
          const groupId =
            typeof audit.details.groupId === 'string'
              ? audit.details.groupId
              : 'supporter-group-member'
          audit.entityId = `${groupId}:[erased]`
          delete audit.details.email
        }
      }
      return { success: true }
    }

    if (this.sql.startsWith('DELETE FROM ')) {
      const id = String(this.values[0])
      if (this.sql === 'DELETE FROM userProfiles WHERE id = ?') {
        this.db.profiles.delete(id)
      } else if (this.sql === 'DELETE FROM users WHERE id = ?') {
        this.db.users.delete(id)
      }
      return { success: true }
    }

    throw new Error(`Unexpected run() SQL: ${this.sql}`)
  }

  get normalizedSql(): string {
    return this.sql
  }
}

class AuthDatabase {
  readonly users = new Map<string, UserRecord>()
  // Raw rows, exactly as D1 returns them - booleans stay 0/1 on purpose so
  // the /me normalization regression below tests the real shape.
  readonly profiles = new Map<string, Record<string, unknown>>()
  readonly premiumAudit: PremiumAuditRecord[] = []
  readonly premiumGroupMembers = new Map<string, PremiumGroupMemberRecord>()
  readonly premiumGroupPerks = new Map<string, string[]>()
  failProviderLookup = false

  prepare(sql: string): AuthStatement {
    const normalized = sql.replace(/\s+/g, ' ').trim()
    if (
      this.failProviderLookup &&
      normalized === 'SELECT * FROM users WHERE providerId = ?'
    ) {
      throw new Error('provider lookup unavailable')
    }
    return new AuthStatement(this, normalized)
  }

  async batch(statements: AuthStatement[]): Promise<unknown[]> {
    return Promise.all(
      statements.map((statement) =>
        statement.normalizedSql.startsWith('SELECT')
          ? statement.all()
          : statement.run(),
      ),
    )
  }

  seedAnonymous(id: string): void {
    const now = new Date().toISOString()
    this.users.set(id, {
      id,
      createdAt: now,
      updatedAt: now,
      authProvider: 'anonymous',
      providerId: null,
      email: null,
      emailVerified: 0,
      passwordHash: null,
      lastLoginAt: now,
      lastActiveAt: null,
      tokenVersion: 1,
      suspendedAt: null,
      suspensionReason: null,
    })
  }

  user(id: string): UserRecord {
    const user = this.users.get(id)
    if (!user) throw new Error(`Missing test user: ${id}`)
    return user
  }
}

class PerksStatement {
  private values: unknown[] = []

  constructor(
    private readonly db: PerksDatabase,
    private readonly sql: string,
  ) {}

  bind(...values: unknown[]): PerksStatement {
    this.values = values
    return this
  }

  async run(): Promise<{ success: true }> {
    if (this.sql !== 'DELETE FROM perkGrants WHERE email = ?1') {
      throw new Error(`Unexpected perks run() SQL: ${this.sql}`)
    }
    if (this.db.failDeletes) throw new Error('shared perks unavailable')
    this.db.deletedEmails.push(String(this.values[0]))
    return { success: true }
  }

  async all<T>(): Promise<{ results: T[] }> {
    if (
      this.sql !==
      'SELECT perkId FROM perkGrants WHERE email = ?1 AND revokedAt IS NULL'
    ) {
      throw new Error(`Unexpected perks all() SQL: ${this.sql}`)
    }
    return { results: [] }
  }
}

class PerksDatabase {
  readonly deletedEmails: string[] = []
  failDeletes = false

  prepare(sql: string): PerksStatement {
    return new PerksStatement(this, sql.replace(/\s+/g, ' ').trim())
  }
}

const FRESH_DEVICE_ID = '00000000-0000-4000-8000-000000000001'
const ANONYMOUS_DEVICE_ID = '00000000-0000-4000-8000-000000000002'

function makeEnv(db: AuthDatabase, perks?: PerksDatabase): Env {
  return {
    DB: db as unknown as D1Database,
    JWT_SECRET: 'test-jwt-secret',
    GOOGLE_CLIENT_ID: 'test-google-client',
    ...(perks === undefined
      ? {}
      : { PERKS_DB: perks as unknown as D1Database }),
  }
}

function respond(body: object | null, init?: ResponseInit): Response {
  return new Response(body == null ? null : JSON.stringify(body), {
    ...init,
    headers:
      body == null ? init?.headers : { 'Content-Type': 'application/json' },
  })
}

async function postAuth(
  route: 'register' | 'google',
  body: Record<string, unknown>,
  env: Env,
): Promise<Record<string, unknown>> {
  const response = await handleAuth(
    new Request(`https://api.test/api/auth/${route}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    env,
    `/api/auth/${route}`,
    respond,
  )
  if (response == null) throw new Error('Auth route was not handled')
  expect(response.status).toBe(200)
  return (await response.json()) as Record<string, unknown>
}

async function postAnonymous(
  deviceId: string,
  env: Env,
): Promise<Record<string, unknown>> {
  const response = await handleAuth(
    new Request('https://api.test/api/auth/anonymous', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId }),
    }),
    env,
    '/api/auth/anonymous',
    respond,
  )
  if (response == null) throw new Error('Anonymous route was not handled')
  expect(response.status).toBe(200)
  return (await response.json()) as Record<string, unknown>
}

async function authMeStatus(token: unknown, env: Env): Promise<number> {
  const response = await handleAuth(
    new Request('https://api.test/api/auth/me', {
      headers: { Authorization: `Bearer ${String(token)}` },
    }),
    env,
    '/api/auth/me',
    respond,
  )
  if (response == null) throw new Error('Me route was not handled')
  return response.status
}

function stubGoogleClaims(sub: string): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            aud: 'test-google-client',
            sub,
            email: `${sub}@example.com`,
            email_verified: 'true',
            name: 'Test Singer',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
    ),
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('suspended account authentication', () => {
  it('rejects a previously issued bearer with a structured suspension error', async () => {
    const db = new AuthDatabase()
    const env = makeEnv(db)
    const auth = await postAuth(
      'register',
      { email: 'suspended@example.com', password: 'secret123' },
      env,
    )
    db.user(String(auth.userId)).suspendedAt = new Date().toISOString()

    await expect(
      getAuth(
        new Request('https://api.test/api/auth/me', {
          headers: { Authorization: `Bearer ${String(auth.token)}` },
        }),
        env,
      ),
    ).rejects.toBeInstanceOf(AccountSuspendedError)
  })

  it('does not issue a new anonymous session for a suspended device id', async () => {
    const db = new AuthDatabase()
    db.seedAnonymous(ANONYMOUS_DEVICE_ID)
    db.user(ANONYMOUS_DEVICE_ID).suspendedAt = new Date().toISOString()
    const env = makeEnv(db)

    await expect(
      handleAuth(
        new Request('https://api.test/api/auth/anonymous', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ deviceId: ANONYMOUS_DEVICE_ID }),
        }),
        env,
        '/api/auth/anonymous',
        respond,
      ),
    ).rejects.toBeInstanceOf(AccountSuspendedError)
  })

  it('does not issue a password session for a suspended account', async () => {
    const db = new AuthDatabase()
    const env = makeEnv(db)
    const auth = await postAuth(
      'register',
      { email: 'login-suspended@example.com', password: 'secret123' },
      env,
    )
    db.user(String(auth.userId)).suspendedAt = new Date().toISOString()

    await expect(
      handleAuth(
        new Request('https://api.test/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'login-suspended@example.com',
            password: 'secret123',
          }),
        }),
        env,
        '/api/auth/login',
        respond,
      ),
    ).rejects.toBeInstanceOf(AccountSuspendedError)
  })

  it('does not upgrade a suspended anonymous identity during registration', async () => {
    const db = new AuthDatabase()
    db.seedAnonymous(ANONYMOUS_DEVICE_ID)
    db.user(ANONYMOUS_DEVICE_ID).suspendedAt = new Date().toISOString()
    const env = makeEnv(db)

    await expect(
      handleAuth(
        new Request('https://api.test/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'upgrade-suspended@example.com',
            password: 'secret123',
            deviceId: ANONYMOUS_DEVICE_ID,
          }),
        }),
        env,
        '/api/auth/register',
        respond,
      ),
    ).rejects.toBeInstanceOf(AccountSuspendedError)
    expect(db.user(ANONYMOUS_DEVICE_ID).authProvider).toBe('anonymous')
  })

  it('does not return or upgrade suspended identities through Google', async () => {
    const db = new AuthDatabase()
    const env = makeEnv(db)
    stubGoogleClaims('suspended-google')
    const auth = await postAuth('google', { idToken: 'first' }, env)
    db.user(String(auth.userId)).suspendedAt = new Date().toISOString()

    await expect(
      handleAuth(
        new Request('https://api.test/api/auth/google', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken: 'second' }),
        }),
        env,
        '/api/auth/google',
        respond,
      ),
    ).rejects.toBeInstanceOf(AccountSuspendedError)

    db.seedAnonymous(ANONYMOUS_DEVICE_ID)
    db.user(ANONYMOUS_DEVICE_ID).suspendedAt = new Date().toISOString()
    stubGoogleClaims('suspended-google-upgrade')
    await expect(
      handleAuth(
        new Request('https://api.test/api/auth/google', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            idToken: 'third',
            deviceId: ANONYMOUS_DEVICE_ID,
          }),
        }),
        env,
        '/api/auth/google',
        respond,
      ),
    ).rejects.toBeInstanceOf(AccountSuspendedError)
  })

  it('does not auto-link Google to a suspended password account', async () => {
    const db = new AuthDatabase()
    const env = makeEnv(db)
    const auth = await postAuth(
      'register',
      { email: 'suspended-google-autolink@example.com', password: 'secret123' },
      env,
    )
    db.user(String(auth.userId)).suspendedAt = new Date().toISOString()
    stubGoogleClaims('suspended-google-autolink')

    await expect(
      handleAuth(
        new Request('https://api.test/api/auth/google', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken: 'google-id-token' }),
        }),
        env,
        '/api/auth/google',
        respond,
      ),
    ).rejects.toBeInstanceOf(AccountSuspendedError)
    expect(db.user(String(auth.userId)).providerId).toBeNull()
  })

  it('returns the suspension code through the Google redirect flow', async () => {
    const db = new AuthDatabase()
    const env = makeEnv(db)
    stubGoogleClaims('suspended-google-redirect')
    const auth = await postAuth('google', { idToken: 'first' }, env)
    db.user(String(auth.userId)).suspendedAt = new Date().toISOString()
    env.GOOGLE_CLIENT_SECRET = 'test-google-secret'
    env.APP_ORIGINS = 'https://app.test'

    const start = await handleAuth(
      new Request(
        'https://api.test/api/auth/google/start' +
          '?returnTo=https%3A%2F%2Fapp.test%2Faccount',
      ),
      env,
      '/api/auth/google/start',
      respond,
    )
    expect(start?.status).toBe(302)
    const state = new URL(start!.headers.get('Location') as string).searchParams.get(
      'state',
    )
    expect(state).not.toBeNull()

    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ id_token: 'redirect-id-token' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              aud: 'test-google-client',
              sub: 'suspended-google-redirect',
              email: 'suspended-google-redirect@example.com',
              email_verified: 'true',
              name: 'Suspended Singer',
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
        ),
    )

    const callback = await handleAuth(
      new Request(
        `https://api.test/api/auth/google/callback?code=valid&state=${encodeURIComponent(state as string)}`,
      ),
      env,
      '/api/auth/google/callback',
      respond,
    )
    expect(callback?.status).toBe(302)
    expect(callback?.headers.get('Location')).toBe(
      'https://app.test/account#gauth_error=account_suspended',
    )
  })

  it('still issues a session through a successful Google redirect', async () => {
    const db = new AuthDatabase()
    const env = makeEnv(db)
    env.GOOGLE_CLIENT_SECRET = 'test-google-secret'
    env.APP_ORIGINS = 'https://app.test'
    const start = await handleAuth(
      new Request(
        'https://api.test/api/auth/google/start' +
          '?returnTo=https%3A%2F%2Fapp.test%2Faccount',
      ),
      env,
      '/api/auth/google/start',
      respond,
    )
    const state = new URL(start!.headers.get('Location') as string).searchParams.get(
      'state',
    ) as string
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ id_token: 'redirect-id-token' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              aud: 'test-google-client',
              sub: 'fresh-google-redirect',
              email: 'fresh-google-redirect@example.com',
              email_verified: 'true',
              name: 'Fresh Singer',
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
        ),
    )

    const callback = await handleAuth(
      new Request(
        `https://api.test/api/auth/google/callback?code=valid&state=${encodeURIComponent(state)}`,
      ),
      env,
      '/api/auth/google/callback',
      respond,
    )
    expect(callback?.status).toBe(302)
    expect(callback?.headers.get('Location')).toMatch(
      /^https:\/\/app\.test\/account#gauth=.+&gauth_new=1$/,
    )
  })

  it('does not disguise an unexpected Google callback failure as suspension', async () => {
    const db = new AuthDatabase()
    const env = makeEnv(db)
    env.GOOGLE_CLIENT_SECRET = 'test-google-secret'
    env.APP_ORIGINS = 'https://app.test'
    const start = await handleAuth(
      new Request(
        'https://api.test/api/auth/google/start' +
          '?returnTo=https%3A%2F%2Fapp.test%2Faccount',
      ),
      env,
      '/api/auth/google/start',
      respond,
    )
    const state = new URL(start!.headers.get('Location') as string).searchParams.get(
      'state',
    ) as string
    db.failProviderLookup = true
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ id_token: 'redirect-id-token' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              aud: 'test-google-client',
              sub: 'failing-google-redirect',
              email_verified: 'true',
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
        ),
    )

    await expect(
      handleAuth(
        new Request(
          `https://api.test/api/auth/google/callback?code=valid&state=${encodeURIComponent(state)}`,
        ),
        env,
        '/api/auth/google/callback',
        respond,
      ),
    ).rejects.toThrow('provider lookup unavailable')
  })
})

describe('db-worker account creation classification', () => {
  it('REQ-SFA-001 reports fresh password registration as new', async () => {
    const db = new AuthDatabase()

    const auth = await postAuth(
      'register',
      {
        email: 'fresh-password@example.com',
        password: 'secret123',
        deviceId: FRESH_DEVICE_ID,
      },
      makeEnv(db),
    )

    expect(auth).toMatchObject({
      isNew: true,
      user: { authProvider: 'password' },
    })
  })

  it('REQ-SFA-001 reports password registration over anonymous as new', async () => {
    const db = new AuthDatabase()
    db.seedAnonymous(ANONYMOUS_DEVICE_ID)

    const auth = await postAuth(
      'register',
      {
        email: 'upgraded-password@example.com',
        password: 'secret123',
        deviceId: ANONYMOUS_DEVICE_ID,
      },
      makeEnv(db),
    )

    expect(auth).toMatchObject({
      isNew: true,
      user: { id: ANONYMOUS_DEVICE_ID, authProvider: 'password' },
    })
  })

  it('REQ-SFA-002 reports a fresh Google account as new', async () => {
    const db = new AuthDatabase()
    stubGoogleClaims('fresh-google')

    const auth = await postAuth(
      'google',
      { idToken: 'fresh-token', deviceId: FRESH_DEVICE_ID },
      makeEnv(db),
    )

    expect(auth).toMatchObject({
      isNew: true,
      user: { authProvider: 'google' },
    })
  })

  it('REQ-SFA-002 reports Google registration over anonymous as new', async () => {
    const db = new AuthDatabase()
    db.seedAnonymous(ANONYMOUS_DEVICE_ID)
    stubGoogleClaims('upgraded-google')

    const auth = await postAuth(
      'google',
      { idToken: 'upgraded-token', deviceId: ANONYMOUS_DEVICE_ID },
      makeEnv(db),
    )

    expect(auth).toMatchObject({
      isNew: true,
      user: { id: ANONYMOUS_DEVICE_ID, authProvider: 'google' },
    })
  })
})

describe('anonymous upgrade session revocation', () => {
  it('rejects the pre-upgrade anonymous JWT after password registration', async () => {
    const db = new AuthDatabase()
    const env = makeEnv(db)
    const anonymous = await postAnonymous(ANONYMOUS_DEVICE_ID, env)

    const upgraded = await postAuth(
      'register',
      {
        email: 'upgraded-password@example.com',
        password: 'Sing1ngPass',
        deviceId: ANONYMOUS_DEVICE_ID,
      },
      env,
    )

    expect(await authMeStatus(anonymous.token, env)).toBe(401)
    expect(await authMeStatus(upgraded.token, env)).toBe(200)
  })

  it('rejects the pre-upgrade anonymous JWT after Google registration', async () => {
    const db = new AuthDatabase()
    const env = makeEnv(db)
    const anonymous = await postAnonymous(ANONYMOUS_DEVICE_ID, env)
    stubGoogleClaims('upgraded-google-session')

    const upgraded = await postAuth(
      'google',
      { idToken: 'upgraded-token', deviceId: ANONYMOUS_DEVICE_ID },
      env,
    )

    expect(await authMeStatus(anonymous.token, env)).toBe(401)
    expect(await authMeStatus(upgraded.token, env)).toBe(200)
  })
})

describe('GET /api/auth/me profile shape', () => {
  it('returns leaderboardOptIn as a real boolean, not SQLite 0/1', async () => {
    const db = new AuthDatabase()
    const auth = await postAuth(
      'register',
      {
        email: 'optin@example.com',
        password: 'Sing1ngPass',
        deviceId: FRESH_DEVICE_ID,
      },
      makeEnv(db),
    )
    const userId = String((auth.user as Record<string, unknown>).id)
    // Raw row, as D1 stores it: the opt-in column is the integer 1.
    db.profiles.set(userId, {
      id: userId,
      displayName: 'Opt In',
      leaderboardOptIn: 1,
    })

    const response = await handleAuth(
      new Request('https://api.test/api/auth/me', {
        headers: { Authorization: `Bearer ${String(auth.token)}` },
      }),
      makeEnv(db),
      '/api/auth/me',
      respond,
    )
    expect(response?.status).toBe(200)
    const body = (await response!.json()) as {
      profile: { leaderboardOptIn: unknown }
    }
    // The account UI checks `=== true`; an unconverted 1 rendered the
    // consent checkbox unchecked forever, and clicking an unchecked box
    // re-opts in - so opting OUT from the UI was impossible.
    expect(body.profile.leaderboardOptIn).toBe(true)
  })
})

describe('DELETE /api/auth/me shared perk ownership', () => {
  async function registerAndDelete(emailVerified: number): Promise<string[]> {
    const db = new AuthDatabase()
    const perks = new PerksDatabase()
    const env = makeEnv(db, perks)
    const auth = await postAuth(
      'register',
      {
        email: 'donor@example.com',
        password: 'Sing1ngPass',
        deviceId: FRESH_DEVICE_ID,
      },
      env,
    )
    const userId = String((auth.user as Record<string, unknown>).id)
    db.user(userId).emailVerified = emailVerified

    const response = await handleAuth(
      new Request('https://api.test/api/auth/me', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${String(auth.token)}` },
      }),
      env,
      '/api/auth/me',
      respond,
    )

    expect(response?.status).toBe(200)
    expect(db.users.has(userId)).toBe(false)
    return perks.deletedEmails
  }

  it('does not purge an email-keyed grant for an unverified account', async () => {
    expect(await registerAndDelete(0)).toEqual([])
  })

  it('purges an email-keyed grant after mailbox ownership is verified', async () => {
    expect(await registerAndDelete(1)).toEqual(['donor@example.com'])
  })

  it('erases manual membership and personal audit email before same-email re-registration', async () => {
    const db = new AuthDatabase()
    const perks = new PerksDatabase()
    const env = makeEnv(db, perks)
    const first = await postAuth(
      'register',
      {
        email: 'donor@example.com',
        password: 'Sing1ngPass',
        deviceId: FRESH_DEVICE_ID,
      },
      env,
    )
    const firstUserId = String((first.user as Record<string, unknown>).id)
    db.user(firstUserId).emailVerified = 1
    db.premiumGroupMembers.set('early-supporters:donor@example.com', {
      email: 'donor@example.com',
      grantedAt: '2026-08-01T00:00:00.000Z',
      groupId: 'early-supporters',
      note: 'Launch donor',
      revokedAt: null,
    })
    db.premiumGroupPerks.set('early-supporters', ['golden-stage'])
    db.premiumAudit.push({
      actorId: 'donor@example.com',
      actorType: 'access',
      details: {
        email: 'donor@example.com',
        groupId: 'early-supporters',
      },
      entityId: 'early-supporters:donor@example.com',
      entityType: 'supporter-group-member',
    })
    db.premiumAudit.push({
      actorId: firstUserId,
      actorType: 'user',
      details: {
        backgroundId: 'golden-stage',
        expiresAt: '2026-08-01T00:05:00.000Z',
        roomId: 'private-room-id',
        version: 1,
      },
      entityId: 'capability-id',
      entityType: 'background-capability',
    })

    await expect(
      resolvePremiumBackgroundAccess(env, firstUserId),
    ).resolves.toMatchObject({ backgroundIds: ['golden-stage'] })

    const deletion = await handleAuth(
      new Request('https://api.test/api/auth/me', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${String(first.token)}` },
      }),
      env,
      '/api/auth/me',
      respond,
    )

    expect(deletion?.status).toBe(200)
    expect(db.premiumGroupMembers.size).toBe(0)
    expect(db.premiumAudit).toEqual([
      {
        actorId: null,
        actorType: 'access',
        details: { groupId: 'early-supporters' },
        entityId: 'early-supporters:[erased]',
        entityType: 'supporter-group-member',
      },
    ])

    const second = await postAuth(
      'register',
      {
        email: 'donor@example.com',
        password: 'Sing1ngPass',
        deviceId: '00000000-0000-4000-8000-000000000003',
      },
      env,
    )
    const secondUserId = String((second.user as Record<string, unknown>).id)
    expect(secondUserId).not.toBe(firstUserId)
    db.user(secondUserId).emailVerified = 1

    await expect(
      resolvePremiumBackgroundAccess(env, secondUserId),
    ).resolves.toMatchObject({ backgroundIds: [] })
  })

  it('keeps the account retryable when the shared perks binding is unavailable', async () => {
    const db = new AuthDatabase()
    const env = makeEnv(db)
    const auth = await postAuth(
      'register',
      {
        email: 'donor@example.com',
        password: 'Sing1ngPass',
        deviceId: FRESH_DEVICE_ID,
      },
      env,
    )
    const userId = String((auth.user as Record<string, unknown>).id)
    db.user(userId).emailVerified = 1

    const response = await handleAuth(
      new Request('https://api.test/api/auth/me', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${String(auth.token)}` },
      }),
      env,
      '/api/auth/me',
      respond,
    )

    expect(response?.status).toBe(503)
    expect(db.users.has(userId)).toBe(true)
  })

  it('keeps the account retryable when the shared perks purge fails', async () => {
    const db = new AuthDatabase()
    const perks = new PerksDatabase()
    perks.failDeletes = true
    const env = makeEnv(db, perks)
    const auth = await postAuth(
      'register',
      {
        email: 'donor@example.com',
        password: 'Sing1ngPass',
        deviceId: FRESH_DEVICE_ID,
      },
      env,
    )
    const userId = String((auth.user as Record<string, unknown>).id)
    db.user(userId).emailVerified = 1

    const response = await handleAuth(
      new Request('https://api.test/api/auth/me', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${String(auth.token)}` },
      }),
      env,
      '/api/auth/me',
      respond,
    )

    expect(response?.status).toBe(503)
    expect(db.users.has(userId)).toBe(true)
  })
})
