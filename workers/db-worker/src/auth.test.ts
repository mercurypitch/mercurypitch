import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Env } from './auth'
import { getAuth, handleAuth } from './auth'
import { AccountSuspendedError } from './moderation'
import { resolvePremiumBackgroundAccess } from './premium-background-access'
import { TABLES } from './tables'

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

interface AuthSessionRecord {
  id: string
  userId: string
  provider: string | null
  userAgent: string | null
  ip: string | null
  createdAt: string
  lastSeenAt: string
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
      'SELECT tokenVersion, lastActiveAt, suspendedAt, email FROM users WHERE id = ?'
    ) {
      const user = this.db.users.get(String(this.values[0]))
      if (!user) return null
      return {
        tokenVersion: user.tokenVersion,
        lastActiveAt: user.lastActiveAt,
        suspendedAt: user.suspendedAt,
        email: user.email,
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

    if (this.sql === 'SELECT * FROM googleDriveTokens WHERE userId = ?') {
      return (this.db.driveTokens.get(String(this.values[0])) ??
        null) as T | null
    }

    if (
      this.sql === 'SELECT id FROM authSessions WHERE id = ? AND userId = ?'
    ) {
      const [id, userId] = this.values.map(String)
      const row = this.db.sessions.get(id)
      return (row && row.userId === userId ? { id: row.id } : null) as T | null
    }

    if (this.sql === 'SELECT * FROM deviceLinkCodes WHERE code = ?') {
      return (this.db.deviceLinks.get(String(this.values[0])) ??
        null) as T | null
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

    if (
      this.sql ===
      'SELECT id, provider, userAgent, ip, createdAt, lastSeenAt FROM authSessions WHERE userId = ? ORDER BY lastSeenAt DESC'
    ) {
      const userId = String(this.values[0])
      return {
        results: [...this.db.sessions.values()]
          .filter((row) => row.userId === userId)
          .sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt))
          .map((row) => ({ ...row })) as T[],
      }
    }

    throw new Error(`Unexpected all() SQL: ${this.sql}`)
  }

  // `meta.changes` matters for the device-link statements: they enforce
  // single use inside the UPDATE rather than checking and then writing, so
  // the row count IS the access-control answer and the fake has to report
  // it truthfully.
  async run(): Promise<{ success: true; meta: { changes: number } }> {
    if (this.sql === 'DELETE FROM deviceLinkCodes WHERE expiresAt <= ?') {
      const cutoff = Date.parse(String(this.values[0]))
      let changes = 0
      for (const [code, row] of this.db.deviceLinks) {
        if (Date.parse(row.expiresAt) <= cutoff) {
          this.db.deviceLinks.delete(code)
          changes += 1
        }
      }
      return { success: true, meta: { changes } }
    }

    if (this.sql.startsWith('INSERT INTO deviceLinkCodes')) {
      const [code, pollTokenHash, deviceLabel, createdAt, expiresAt] =
        this.values
      // WHERE NOT EXISTS — a code already in the table is not overwritten,
      // and the caller learns that from `changes` and mints another.
      if (this.db.deviceLinks.has(String(code))) {
        return { success: true, meta: { changes: 0 } }
      }
      this.db.deviceLinks.set(String(code), {
        code: String(code),
        pollTokenHash: String(pollTokenHash),
        deviceLabel: deviceLabel == null ? null : String(deviceLabel),
        userId: null,
        approvedAt: null,
        claimedAt: null,
        createdAt: String(createdAt),
        expiresAt: String(expiresAt),
      })
      return { success: true, meta: { changes: 1 } }
    }

    if (
      this.sql ===
      'UPDATE deviceLinkCodes SET userId = ?, approvedAt = ? WHERE code = ? AND approvedAt IS NULL AND claimedAt IS NULL'
    ) {
      const [userId, approvedAt, code] = this.values
      const row = this.db.deviceLinks.get(String(code))
      if (!row || row.approvedAt !== null || row.claimedAt !== null) {
        return { success: true, meta: { changes: 0 } }
      }
      row.userId = String(userId)
      row.approvedAt = String(approvedAt)
      return { success: true, meta: { changes: 1 } }
    }

    if (
      this.sql ===
      'UPDATE deviceLinkCodes SET claimedAt = ? WHERE code = ? AND claimedAt IS NULL'
    ) {
      const [claimedAt, code] = this.values
      const row = this.db.deviceLinks.get(String(code))
      if (!row || row.claimedAt !== null) {
        return { success: true, meta: { changes: 0 } }
      }
      row.claimedAt = String(claimedAt)
      return { success: true, meta: { changes: 1 } }
    }

    if (this.sql.startsWith('INSERT INTO authSessions')) {
      const [id, userId, provider, userAgent, ip] = this.values
      const now = new Date().toISOString()
      this.db.sessions.set(String(id), {
        id: String(id),
        userId: String(userId),
        provider: provider == null ? null : String(provider),
        userAgent: userAgent == null ? null : String(userAgent),
        ip: ip == null ? null : String(ip),
        createdAt: now,
        lastSeenAt: now,
      })
      return { success: true, meta: { changes: 1 } }
    }

    if (this.sql.startsWith('UPDATE authSessions SET lastSeenAt')) {
      // The real statement only writes once the row is already stale. The
      // fake reports the write truthfully but does not model the clock: no
      // test here turns on how often the column moves.
      const row = this.db.sessions.get(String(this.values[0]))
      if (!row) return { success: true, meta: { changes: 0 } }
      row.lastSeenAt = new Date().toISOString()
      return { success: true, meta: { changes: 1 } }
    }

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
      return { success: true, meta: { changes: 1 } }
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
      return { success: true, meta: { changes: 1 } }
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
      return { success: true, meta: { changes: 1 } }
    }

    if (this.sql.startsWith('UPDATE users SET lastLoginAt = ?')) {
      const [lastLoginAt, updatedAt, id] = this.values
      Object.assign(this.db.user(String(id)), {
        lastLoginAt: String(lastLoginAt),
        updatedAt: String(updatedAt),
      })
      return { success: true, meta: { changes: 1 } }
    }

    if (this.sql.startsWith('INSERT OR IGNORE INTO userProfiles')) {
      return { success: true, meta: { changes: 1 } }
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
      return { success: true, meta: { changes: 1 } }
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
      return { success: true, meta: { changes: 1 } }
    }

    if (
      this.sql ===
      'UPDATE premiumPerkAudit SET actorId = NULL WHERE actorId = ?1'
    ) {
      const userId = String(this.values[0])
      for (const audit of this.db.premiumAudit) {
        if (audit.actorId === userId) audit.actorId = null
      }
      return { success: true, meta: { changes: 1 } }
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
      return { success: true, meta: { changes: 1 } }
    }

    if (this.sql === 'DELETE FROM authSessions WHERE id = ? AND userId = ?') {
      const [id, userId] = this.values.map(String)
      const row = this.db.sessions.get(id)
      if (!row || row.userId !== userId) {
        return { success: true, meta: { changes: 0 } }
      }
      this.db.sessions.delete(id)
      return { success: true, meta: { changes: 1 } }
    }

    if (
      this.sql === 'DELETE FROM authSessions WHERE userId = ?' ||
      this.sql === 'DELETE FROM \"authSessions\" WHERE \"userId\" = ?'
    ) {
      const userId = String(this.values[0])
      let changes = 0
      for (const [id, row] of this.db.sessions) {
        if (row.userId === userId) {
          this.db.sessions.delete(id)
          changes += 1
        }
      }
      return { success: true, meta: { changes } }
    }

    if (this.sql === 'DELETE FROM authSessions WHERE userId = ? AND id != ?') {
      const [userId, keep] = this.values.map(String)
      let changes = 0
      for (const [id, row] of this.db.sessions) {
        if (row.userId === userId && id !== keep) {
          this.db.sessions.delete(id)
          changes += 1
        }
      }
      return { success: true, meta: { changes } }
    }

    if (this.sql.startsWith('DELETE FROM ')) {
      const id = String(this.values[0])
      if (this.sql === 'DELETE FROM userProfiles WHERE id = ?') {
        this.db.profiles.delete(id)
      } else if (this.sql === 'DELETE FROM users WHERE id = ?') {
        this.db.users.delete(id)
      } else if (
        this.sql === 'DELETE FROM googleDriveTokens WHERE userId = ?'
      ) {
        this.db.driveTokens.delete(id)
      }
      return { success: true, meta: { changes: 1 } }
    }

    if (this.sql.startsWith('INSERT INTO googleDriveTokens')) {
      const [userId, refreshToken, scope, email, createdAt, updatedAt] =
        this.values
      const existing = this.db.driveTokens.get(String(userId))
      this.db.driveTokens.set(String(userId), {
        userId: String(userId),
        refreshToken: String(refreshToken),
        scope: String(scope),
        email: email == null ? null : String(email),
        createdAt: existing?.createdAt ?? String(createdAt),
        updatedAt: String(updatedAt),
      })
      return { success: true, meta: { changes: 1 } }
    }
    throw new Error(`Unexpected run() SQL: ${this.sql}`)
  }

  get normalizedSql(): string {
    return this.sql
  }
}

interface DriveTokenRecord {
  userId: string
  refreshToken: string
  scope: string
  email: string | null
  createdAt: string
  updatedAt: string
}

interface DeviceLinkRecord {
  code: string
  pollTokenHash: string
  deviceLabel: string | null
  userId: string | null
  approvedAt: string | null
  claimedAt: string | null
  createdAt: string
  expiresAt: string
}

class AuthDatabase {
  readonly users = new Map<string, UserRecord>()
  readonly driveTokens = new Map<string, DriveTokenRecord>()
  readonly deviceLinks = new Map<string, DeviceLinkRecord>()
  readonly sessions = new Map<string, AuthSessionRecord>()
  // Raw rows, exactly as D1 returns them - booleans stay 0/1 on purpose so
  // the /me normalization regression below tests the real shape.
  readonly profiles = new Map<string, Record<string, unknown>>()
  readonly premiumAudit: PremiumAuditRecord[] = []
  readonly premiumGroupMembers = new Map<string, PremiumGroupMemberRecord>()
  readonly premiumGroupPerks = new Map<string, string[]>()
  /** Every statement this database was asked to build, normalized. */
  readonly preparedSql: string[] = []
  failProviderLookup = false

  prepare(sql: string): AuthStatement {
    const normalized = sql.replace(/\s+/g, ' ').trim()
    this.preparedSql.push(normalized)
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
    // Turnstile is disabled for a local origin and no configured secret,
    // which is what these tests are: the CAPTCHA has its own tests.
    ALLOWED_ORIGINS: 'http://localhost:5173',
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

/** Drive any auth route directly, without asserting a 200. */
async function callAuth(
  route: string,
  body: Record<string, unknown>,
  env: Env,
): Promise<Response> {
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
  return response
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

describe('malformed bearer tokens', () => {
  // This used to throw a DOMException out of getAuth, which runs on the
  // common path for every request — so one bad token turned EVERY endpoint
  // into a 500, /api/auth/me included. A client that had stored such a token
  // could never recover: the app treats 5xx as a server hiccup and keeps the
  // token, so the 401 that would clear it never arrived.
  it.each([
    ['non-base64 signature', 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.!'],
    [
      'length %% 4 === 1 signature',
      'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.abcde',
    ],
    ['non-base64 payload', 'eyJhbGciOiJIUzI1NiJ9.!!!.YWJj'],
    ['empty signature', 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.'],
    ['two segments', 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0'],
  ])('resolves null rather than throwing for a %s', async (_label, token) => {
    const env = makeEnv(new AuthDatabase())
    await expect(
      getAuth(
        new Request('https://api.test/api/auth/me', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        env,
      ),
    ).resolves.toBeNull()
  })
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
    const state = new URL(
      start!.headers.get('Location') as string,
    ).searchParams.get('state')
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

  // ── The state that ran out of time ──────────────────────────
  //
  // The state is a signed value with a ten-minute life, not a stored
  // record: walk away from Google's consent screen and finish it later and
  // the callback arrives with a state nothing can verify. That used to
  // render `{"error":"Invalid or expired state"}` as a page on the API
  // origin — the one failure in this handler that answered with a body
  // instead of sending the singer home (owner report, 2026-08-17).

  const expiredState = async (env: Env): Promise<string> => {
    const start = await handleAuth(
      new Request(
        'https://api.test/api/auth/google/start' +
          '?returnTo=https%3A%2F%2Fapp.test%2Faccount',
      ),
      env,
      '/api/auth/google/start',
      respond,
    )
    const state = new URL(
      start!.headers.get('Location') as string,
    ).searchParams.get('state') as string
    // Push the clock past the ten-minute TTL rather than hand-forging a
    // state: this is the real expiry path, signature and all.
    vi.setSystemTime(new Date(Date.now() + 11 * 60 * 1000))
    return state
  }

  it('sends an expired state home instead of rendering JSON at the API', async () => {
    const env = makeEnv(new AuthDatabase())
    env.GOOGLE_CLIENT_SECRET = 'test-google-secret'
    env.APP_ORIGINS = 'https://app.test'
    env.APP_FALLBACK_ORIGIN = 'https://dev.test'
    vi.useFakeTimers()
    try {
      const state = await expiredState(env)

      const callback = await handleAuth(
        new Request(
          `https://api.test/api/auth/google/callback?code=valid&state=${encodeURIComponent(state)}`,
        ),
        env,
        '/api/auth/google/callback',
        respond,
      )

      expect(callback?.status).toBe(302)
      // The environment's own app origin, never production from the dev
      // worker: the state that carried the return address is what failed.
      expect(callback?.headers.get('Location')).toBe(
        'https://dev.test/#gauth_error=expired_state',
      )
      expect(await callback!.text()).toBe('')
    } finally {
      vi.useRealTimers()
    }
  })

  it('rejects a mangled state as a redirect, not a 500', async () => {
    // The signature half was decoded outside the try, so a state that is not
    // valid base64url threw straight past the 400 into the 500 handler.
    const env = makeEnv(new AuthDatabase())
    env.GOOGLE_CLIENT_SECRET = 'test-google-secret'
    env.APP_FALLBACK_ORIGIN = 'https://dev.test'

    const callback = await handleAuth(
      new Request(
        'https://api.test/api/auth/google/callback?code=valid&state=body.!!!not-base64!!!',
      ),
      env,
      '/api/auth/google/callback',
      respond,
    )

    expect(callback?.status).toBe(302)
    expect(callback?.headers.get('Location')).toBe(
      'https://dev.test/#gauth_error=expired_state',
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
    const state = new URL(
      start!.headers.get('Location') as string,
    ).searchParams.get('state') as string
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
    const state = new URL(
      start!.headers.get('Location') as string,
    ).searchParams.get('state') as string
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

describe('anonymous provisioning needs a real deviceId', () => {
  // Minting a server-side UUID for a caller who sent none created a row that
  // nothing could ever sign back into — the junk-identity population. The
  // deviceId IS the identity, so a request without one is a bad request.
  async function anonymousStatus(
    body: unknown,
    db: AuthDatabase,
  ): Promise<number> {
    const response = await handleAuth(
      new Request('https://api.test/api/auth/anonymous', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
      makeEnv(db),
      '/api/auth/anonymous',
      respond,
    )
    if (response == null) throw new Error('Anonymous route was not handled')
    return response.status
  }

  it('400s a missing deviceId and creates nothing', async () => {
    const db = new AuthDatabase()

    expect(await anonymousStatus({}, db)).toBe(400)
    expect(db.users.size).toBe(0)
    expect(db.profiles.size).toBe(0)
  })

  it('400s a deviceId that is not a UUID', async () => {
    const db = new AuthDatabase()

    expect(await anonymousStatus({ deviceId: 'not-a-uuid' }, db)).toBe(400)
    expect(db.users.size).toBe(0)
  })

  it('still provisions once for a valid deviceId, idempotently', async () => {
    const db = new AuthDatabase()

    expect(await anonymousStatus({ deviceId: FRESH_DEVICE_ID }, db)).toBe(200)
    expect(await anonymousStatus({ deviceId: FRESH_DEVICE_ID }, db)).toBe(200)
    expect(db.users.size).toBe(1)
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

  // `publicUser` is a hand-written whitelist, which is the right shape but a
  // fragile one: the day somebody replaces it with `{ ...row }` to add a
  // field, the password hash and the revocation counter go out over the wire
  // with it, on every register, login and /me. Naming the forbidden keys
  // means that edit fails here instead of shipping.
  it.each(['register', 'me'] as const)(
    'never returns a credential or a revocation counter from %s',
    async (surface) => {
      const db = new AuthDatabase()
      const env = makeEnv(db)
      const auth = await postAuth(
        'register',
        {
          email: 'shape@example.com',
          password: 'Sing1ngPass',
          deviceId: FRESH_DEVICE_ID,
        },
        env,
      )

      let user = auth.user as Record<string, unknown>
      if (surface === 'me') {
        const response = await handleAuth(
          new Request('https://api.test/api/auth/me', {
            headers: { Authorization: `Bearer ${String(auth.token)}` },
          }),
          env,
          '/api/auth/me',
          respond,
        )
        user = ((await response!.json()) as { user: Record<string, unknown> })
          .user
      }

      // The stored hash is real, so an accidental spread would carry a value
      // here rather than an undefined that a weaker assertion would pass.
      expect(db.user(String(user.id)).passwordHash).toBeTruthy()
      for (const forbidden of ['passwordHash', 'tokenVersion', 'providerId']) {
        expect(user).not.toHaveProperty(forbidden)
      }
      expect(JSON.stringify(user)).not.toContain('pbkdf2')
    },
  )
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

  /**
   * The regression this pins: `songManifests` shipped in
   * `0025_song_manifests.sql` without being added to `USER_OWNED_TABLES`, and
   * it declares no foreign key, so nothing cascaded it either. A deleted
   * account's entire song library — titles, durations, stem sizes — stayed in
   * D1 forever under an id that belonged to nobody.
   *
   * Asserting against the table registry rather than a hand-written list is
   * the point: the next `access: 'user'` table cannot be forgotten, because
   * adding it to `tables.ts` without wiring erasure fails here.
   */
  it('erases every user-scoped table in the registry', async () => {
    const db = new AuthDatabase()
    const perks = new PerksDatabase()
    const env = makeEnv(db, perks)
    const auth = await postAuth(
      'register',
      {
        email: 'erasure@example.com',
        password: 'Sing1ngPass',
        deviceId: FRESH_DEVICE_ID,
      },
      env,
    )

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

    const deletions = db.preparedSql.filter((sql) => sql.startsWith('DELETE '))
    const userScoped = Object.entries(TABLES)
      .filter(([, def]) => def.access === 'user')
      .map(([table]) => table)

    const erased = (table: string): boolean =>
      deletions.some(
        (sql) =>
          sql.includes(`DELETE FROM "${table}"`) ||
          sql.includes(`DELETE FROM ${table} `),
      )

    expect(userScoped).toContain('songManifests')
    expect(userScoped.filter((table) => !erased(table))).toEqual([])

    // The registry above only sees SYNCED entities. Tables that are
    // deliberately worker-internal — an OAuth secret, a reset token — are
    // absent from tables.ts on purpose, which means no registry-driven check
    // can see them either, and the ONLY thing erasing them is a line in
    // USER_OWNED_TABLES. `googleDriveTokens` shipped without that line: a
    // deleted account kept a Google refresh token keyed to a user id that no
    // longer existed. Listing them here by hand is the point — a new
    // worker-internal user-keyed table has to be added to this list, and it
    // fails until it is also erased.
    const workerInternalUserKeyed = [
      'googleDriveTokens',
      'passwordResets',
      'emailVerifications',
    ]
    expect(workerInternalUserKeyed.filter((table) => !erased(table))).toEqual(
      [],
    )
  })

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

describe('Google Drive connect and tokens', () => {
  // The whole connect pass, exactly as the browser drives it: an
  // AUTHENTICATED start (the account has to be known before the browser
  // leaves, or the callback could only guess it from whichever Google
  // identity came back), Google bounces back with a code, the callback
  // exchanges it and keeps the refresh token — sealed, never as Google
  // issued it.
  async function connectDrive(overrides?: {
    scope?: string
    refreshToken?: string | null
  }): Promise<{
    db: AuthDatabase
    env: Env
    sessionToken: string
    location: string
    userId: string
  }> {
    const db = new AuthDatabase()
    const env = makeEnv(db)
    env.GOOGLE_CLIENT_SECRET = 'test-google-secret'
    env.APP_ORIGINS = 'https://app.test'

    // The account that wants a Drive: a plain password signup, not a
    // Google one, because that is the case the binding has to survive.
    const registered = await handleAuth(
      new Request('https://api.test/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'drive-owner@example.com',
          password: 'secret123',
        }),
      }),
      env,
      '/api/auth/register',
      respond,
    )
    const registeredBody = (await registered?.json()) as {
      token: string
      user: { id: string }
    }
    const sessionToken = registeredBody.token
    const userId = registeredBody.user.id

    const start = await handleAuth(
      new Request('https://api.test/api/auth/drive/start', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${sessionToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ returnTo: 'https://app.test/settings' }),
      }),
      env,
      '/api/auth/drive/start',
      respond,
    )
    expect(start?.status).toBe(200)
    const authUrl = new URL(((await start?.json()) as { url: string }).url)
    // The consent Google shows must actually ask for Drive, offline.
    expect(authUrl.searchParams.get('scope')).toContain(
      'https://www.googleapis.com/auth/drive.file',
    )
    expect(authUrl.searchParams.get('access_type')).toBe('offline')
    expect(authUrl.searchParams.get('prompt')).toContain('consent')
    const state = authUrl.searchParams.get('state') as string

    const grantedScope =
      overrides?.scope ??
      'openid email profile https://www.googleapis.com/auth/drive.file'
    const refreshToken =
      overrides?.refreshToken === undefined
        ? 'google-refresh-token'
        : overrides.refreshToken
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              id_token: 'drive-id-token',
              access_token: 'short-lived',
              scope: grantedScope,
              ...(refreshToken === null ? {} : { refresh_token: refreshToken }),
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              aud: 'test-google-client',
              sub: 'drive-user',
              email: 'drive-user@example.com',
              email_verified: 'true',
              name: 'Drive Singer',
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
    const location = callback!.headers.get('Location') as string
    return { db, env, sessionToken, location, userId }
  }

  it('keeps the refresh token from a drive-scoped redirect, sealed', async () => {
    const { db, location, userId } = await connectDrive()
    expect(location).toContain('#gdrive=1')
    const row = db.driveTokens.get(userId)
    expect(row).toBeDefined()
    // Sealed at rest: what the database holds must not be what Google
    // issued, or a leaked copy of the database IS Drive access.
    expect(row!.refreshToken).not.toBe('google-refresh-token')
    expect(row!.email).toBe('drive-user@example.com')
  })

  it('reports declined when the user unticks the Drive box', async () => {
    const { db, location, userId } = await connectDrive({
      scope: 'openid email profile',
    })
    expect(location).toContain('gdrive_error=declined')
    expect(db.driveTokens.get(userId)).toBeUndefined()
  })

  it('connecting a Drive never changes who you are signed in as', async () => {
    const { db, location, userId } = await connectDrive()

    // No session in the fragment: a connect pass is not a sign-in. Handing
    // one back is how picking a personal Gmail at the consent screen would
    // move somebody into a brand-new empty account and take their library,
    // credits and perks with it.
    expect(location).not.toContain('gauth=')
    expect(location).not.toContain('gauth_new=1')

    // And no account was minted for the Google identity that was picked.
    expect(
      [...db.users.values()].find((u) => u.providerId === 'drive-user'),
    ).toBeUndefined()

    // The grant belongs to the account that ASKED, whichever Google
    // account holds the Drive -- keeping songs in a different Google
    // account is the normal case, not a mistake to correct.
    expect(db.driveTokens.get(userId)).toBeDefined()
    expect(db.driveTokens.get(userId)!.email).toBe('drive-user@example.com')
  })

  it('refuses to start a Drive connect for nobody', async () => {
    const db = new AuthDatabase()
    const env = makeEnv(db)
    env.GOOGLE_CLIENT_SECRET = 'test-google-secret'
    env.APP_ORIGINS = 'https://app.test'

    const start = await handleAuth(
      new Request('https://api.test/api/auth/drive/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ returnTo: 'https://app.test/settings' }),
      }),
      env,
      '/api/auth/drive/start',
      respond,
    )
    expect(start?.status).toBe(401)
  })

  it('names a missing refresh token instead of pretending', async () => {
    const { location } = await connectDrive({ refreshToken: null })
    expect(location).toContain('gdrive_error=no_refresh_token')
  })

  it('answers status, mints access tokens, and disconnects', async () => {
    const { env, sessionToken, userId, db } = await connectDrive()

    const status = await handleAuth(
      new Request('https://api.test/api/auth/drive/status', {
        headers: { Authorization: `Bearer ${sessionToken}` },
      }),
      env,
      '/api/auth/drive/status',
      respond,
    )
    expect(status?.status).toBe(200)
    expect(await status?.json()).toEqual({
      connected: true,
      email: 'drive-user@example.com',
    })

    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({ access_token: 'fresh-token', expires_in: 3599 }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
      ),
    )
    const mint = await handleAuth(
      new Request('https://api.test/api/auth/drive/token', {
        method: 'POST',
        headers: { Authorization: `Bearer ${sessionToken}` },
      }),
      env,
      '/api/auth/drive/token',
      respond,
    )
    expect(mint?.status).toBe(200)
    expect(await mint?.json()).toEqual({
      accessToken: 'fresh-token',
      expiresIn: 3599,
    })
    // The refresh grant used the UNSEALED token.
    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>
    const body = fetchMock.mock.calls[0]?.[1]?.body as URLSearchParams
    expect(body.get('refresh_token')).toBe('google-refresh-token')

    const disconnect = await handleAuth(
      new Request('https://api.test/api/auth/drive', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${sessionToken}` },
      }),
      env,
      '/api/auth/drive',
      respond,
    )
    expect(disconnect?.status).toBe(200)
    expect(db.driveTokens.get(userId)).toBeUndefined()
  })

  it('drops the row and says reconnect when Google revokes the grant', async () => {
    const { env, sessionToken, userId, db } = await connectDrive()
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: 'invalid_grant' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          }),
      ),
    )
    const mint = await handleAuth(
      new Request('https://api.test/api/auth/drive/token', {
        method: 'POST',
        headers: { Authorization: `Bearer ${sessionToken}` },
      }),
      env,
      '/api/auth/drive/token',
      respond,
    )
    expect(mint?.status).toBe(410)
    expect(db.driveTokens.get(userId)).toBeUndefined()
  })

  it('a plain sign-in never asks Google for Drive', async () => {
    const db = new AuthDatabase()
    const env = makeEnv(db)
    env.GOOGLE_CLIENT_SECRET = 'test-google-secret'
    env.APP_ORIGINS = 'https://app.test'
    const start = await handleAuth(
      new Request(
        'https://api.test/api/auth/google/start' +
          '?returnTo=https%3A%2F%2Fapp.test%2F',
      ),
      env,
      '/api/auth/google/start',
      respond,
    )
    const authUrl = new URL(start!.headers.get('Location') as string)
    expect(authUrl.searchParams.get('scope')).toBe('openid email profile')
    expect(authUrl.searchParams.get('access_type')).toBeNull()
  })

  /**
   * Deleting the row is not the same as withdrawing consent. Google keeps a
   * grant until it is revoked, so an account that deleted itself would still
   * appear under the user's Google permissions -- and with our row gone,
   * nothing would be left to revoke it from. The token has to be spent on
   * its own revocation on the way out, which means the revoke must happen
   * BEFORE the erasure that USER_OWNED_TABLES performs.
   */
  it('hands the Drive grant back to Google when the account is deleted', async () => {
    const { db, env, sessionToken, userId } = await connectDrive()
    expect(db.driveTokens.get(userId)).toBeDefined()

    const calls: { url: string; token: string | null }[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL, init?: RequestInit) => {
        const body = String(init?.body ?? '')
        calls.push({
          url: String(input),
          token: new URLSearchParams(body).get('token'),
        })
        return new Response('{}', { status: 200 })
      }),
    )

    const response = await handleAuth(
      new Request('https://api.test/api/auth/me', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${String(sessionToken)}` },
      }),
      env,
      '/api/auth/me',
      respond,
    )
    expect(response?.status).toBe(200)

    const revoke = calls.find((call) =>
      call.url.startsWith('https://oauth2.googleapis.com/revoke'),
    )
    expect(revoke).toBeDefined()
    // The PLAINTEXT token, unsealed on the way out. Posting the sealed blob
    // would be a revoke request Google cannot act on -- it would return 200
    // and change nothing, which is the failure that looks like success.
    expect(revoke?.token).toBe('google-refresh-token')

    // And our copy is gone either way.
    expect(db.driveTokens.get(userId)).toBeUndefined()
  })

  it('still deletes the account when Google cannot be reached', async () => {
    // Revoking is a courtesy that must never hold somebody's erasure
    // hostage to a third party being up.
    const { db, env, sessionToken, userId } = await connectDrive()
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('network down'))),
    )

    const response = await handleAuth(
      new Request('https://api.test/api/auth/me', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${String(sessionToken)}` },
      }),
      env,
      '/api/auth/me',
      respond,
    )
    expect(response?.status).toBe(200)
    expect(db.driveTokens.get(userId)).toBeUndefined()
  })
})

// ── Device linking ───────────────────────────────────────────────────
//
// The property under test throughout is the split between the two
// secrets: the code is public the moment it is on a television screen,
// the poll token is not. Everything else here follows from that.

describe('signing a TV in by scanning it', () => {
  async function startLink(
    env: Env,
    deviceLabel = 'Living room TV',
  ): Promise<{ code: string; pollToken: string }> {
    const response = await handleAuth(
      new Request('https://api.test/api/auth/device/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceLabel }),
      }),
      env,
      '/api/auth/device/start',
      respond,
    )
    expect(response?.status).toBe(200)
    return (await response!.json()) as { code: string; pollToken: string }
  }

  function poll(
    env: Env,
    body: Record<string, unknown>,
  ): Promise<Response | null> {
    return handleAuth(
      new Request('https://api.test/api/auth/device/poll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
      env,
      '/api/auth/device/poll',
      respond,
    )
  }

  function approve(
    env: Env,
    token: string,
    code: string,
  ): Promise<Response | null> {
    return handleAuth(
      new Request('https://api.test/api/auth/device/approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ code }),
      }),
      env,
      '/api/auth/device/approve',
      respond,
    )
  }

  /** A signed-in phone, which is what does the approving. */
  async function phone(
    env: Env,
    email = 'tv-owner@example.com',
  ): Promise<{ token: string; userId: string }> {
    const registered = await postAuth(
      'register',
      { email, password: 'secret123' },
      env,
    )
    return {
      token: registered.token as string,
      userId: (registered.user as { id: string }).id,
    }
  }

  it('walks the whole flow: start, approve, collect a session', async () => {
    const db = new AuthDatabase()
    const env = makeEnv(db)
    const { code, pollToken } = await startLink(env)
    const owner = await phone(env)

    // Before approval the TV is told nothing at all.
    const pending = await poll(env, { code, pollToken })
    expect(await pending!.json()).toEqual({ status: 'pending' })

    expect((await approve(env, owner.token, code))?.status).toBe(200)

    const linked = await poll(env, { code, pollToken })
    const body = (await linked!.json()) as {
      status: string
      token: string
      user: { id: string }
    }
    expect(body.status).toBe('linked')
    expect(body.user.id).toBe(owner.userId)
    // The session must be a real one, not a shape that merely looks right.
    expect(await authMeStatus(body.token, env)).toBe(200)
  })

  it('will not hand a session to somebody who only read the code', async () => {
    const db = new AuthDatabase()
    const env = makeEnv(db)
    const { code, pollToken } = await startLink(env)
    const owner = await phone(env)
    await approve(env, owner.token, code)

    // The whole threat model: a person across the room, or a page that
    // scraped a screenshot. They have the code and nothing else.
    const stolen = await poll(env, { code, pollToken: 'not-the-real-token' })
    expect(await stolen!.json()).toEqual({ status: 'expired' })
    expect(db.deviceLinks.get(code)?.claimedAt).toBeNull()

    // And the device that actually asked still collects — a failed guess
    // must not consume the approval, or guessing becomes a denial of
    // service even though it is not a theft.
    const real = await poll(env, { code, pollToken })
    expect(((await real!.json()) as { status: string }).status).toBe('linked')
  })

  it('answers a wrong token exactly as it answers an unknown code', async () => {
    const db = new AuthDatabase()
    const env = makeEnv(db)
    const { code } = await startLink(env)
    const wrongToken = await poll(env, { code, pollToken: 'wrong' })
    const unknownCode = await poll(env, {
      code: 'ZZZZZZZZ',
      pollToken: 'wrong',
    })
    // Identical answers, so polling cannot be used to discover which codes
    // are live.
    expect(await wrongToken!.json()).toEqual(await unknownCode!.json())
  })

  it('requires somebody signed in to approve', async () => {
    const db = new AuthDatabase()
    const env = makeEnv(db)
    const { code } = await startLink(env)
    const anonymous = await handleAuth(
      new Request('https://api.test/api/auth/device/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      }),
      env,
      '/api/auth/device/approve',
      respond,
    )
    expect(anonymous?.status).toBe(401)
  })

  it('is single use — a photographed code cannot be redeemed twice', async () => {
    const db = new AuthDatabase()
    const env = makeEnv(db)
    const { code, pollToken } = await startLink(env)
    const owner = await phone(env)
    await approve(env, owner.token, code)

    const first = await poll(env, { code, pollToken })
    expect(((await first!.json()) as { status: string }).status).toBe('linked')

    const second = await poll(env, { code, pollToken })
    expect(await second!.json()).toEqual({ status: 'expired' })
  })

  it('refuses a second approval of the same code', async () => {
    const db = new AuthDatabase()
    const env = makeEnv(db)
    const { code } = await startLink(env)
    const first = await phone(env, 'first@example.com')
    const second = await phone(env, 'second@example.com')

    expect((await approve(env, first.token, code))?.status).toBe(200)
    // Somebody else scanning the same still-displayed code must not be able
    // to redirect the television to their account.
    const again = await approve(env, second.token, code)
    expect(again?.status).toBe(409)
    expect(db.deviceLinks.get(code)?.userId).toBe(first.userId)
  })

  it('expires, and says so to both sides', async () => {
    const db = new AuthDatabase()
    const env = makeEnv(db)
    const { code, pollToken } = await startLink(env)
    const owner = await phone(env)

    const row = db.deviceLinks.get(code)!
    row.expiresAt = new Date(Date.now() - 1000).toISOString()

    expect(await (await poll(env, { code, pollToken }))!.json()).toEqual({
      status: 'expired',
    })
    expect((await approve(env, owner.token, code))?.status).toBe(410)
  })

  it('sweeps expired rows when the next device asks', async () => {
    const db = new AuthDatabase()
    const env = makeEnv(db)
    const stale = await startLink(env)
    db.deviceLinks.get(stale.code)!.expiresAt = new Date(
      Date.now() - 1000,
    ).toISOString()

    await startLink(env)
    expect(db.deviceLinks.has(stale.code)).toBe(false)
  })

  it('never stores the poll token in the clear', async () => {
    const db = new AuthDatabase()
    const env = makeEnv(db)
    const { code, pollToken } = await startLink(env)
    const row = db.deviceLinks.get(code)!
    expect(row.pollTokenHash).not.toBe(pollToken)
    expect(JSON.stringify(row)).not.toContain(pollToken)
  })

  it('shows the phone what it is being asked to approve', async () => {
    const db = new AuthDatabase()
    const env = makeEnv(db)
    const { code } = await startLink(env, 'Philips 55PUS')
    const owner = await phone(env)

    const pending = await handleAuth(
      new Request(
        `https://api.test/api/auth/device/pending?code=${code.toLowerCase()}`,
        { headers: { Authorization: `Bearer ${owner.token}` } },
      ),
      env,
      '/api/auth/device/pending',
      respond,
    )
    // Lowercased on the way in: the code travels in a URL and through a QR
    // scanner, and neither is guaranteed to preserve case.
    expect(await pending!.json()).toEqual({
      status: 'pending',
      deviceLabel: 'Philips 55PUS',
    })
  })

  it('will not describe a pending link to a stranger', async () => {
    const db = new AuthDatabase()
    const env = makeEnv(db)
    const { code } = await startLink(env)
    const anonymous = await handleAuth(
      new Request(`https://api.test/api/auth/device/pending?code=${code}`),
      env,
      '/api/auth/device/pending',
      respond,
    )
    expect(anonymous?.status).toBe(401)
  })

  it('mints codes a person can read off a screen without ambiguity', async () => {
    const db = new AuthDatabase()
    const env = makeEnv(db)
    const codes: string[] = []
    for (let i = 0; i < 6; i += 1) codes.push((await startLink(env)).code)
    for (const code of codes) {
      expect(code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/)
    }
    // Distinct, which is the only useful thing a handful of samples can say
    // about randomness.
    expect(new Set(codes).size).toBe(codes.length)
  })

  it('refuses a poll with pieces missing', async () => {
    const db = new AuthDatabase()
    const env = makeEnv(db)
    expect((await poll(env, {}))?.status).toBe(400)
    expect((await poll(env, { code: 'ABCD2345' }))?.status).toBe(400)
  })
})

describe('device linking and anonymous identities', () => {
  it('refuses to link a TV to a device-scoped anonymous identity', async () => {
    const db = new AuthDatabase()
    const env = makeEnv(db)
    const start = await handleAuth(
      new Request('https://api.test/api/auth/device/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceLabel: 'TV' }),
      }),
      env,
      '/api/auth/device/start',
      respond,
    )
    const { code } = (await start!.json()) as { code: string }

    // A phone that has never made an account still holds a token — an
    // anonymous identity minted for its own storage. Linking a TV to that
    // forks a library rather than sharing one, and strands the TV in a
    // session nobody can sign back into.
    const anon = await postAnonymous(FRESH_DEVICE_ID, env)
    const approve = await handleAuth(
      new Request('https://api.test/api/auth/device/approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${String(anon.token)}`,
        },
        body: JSON.stringify({ code }),
      }),
      env,
      '/api/auth/device/approve',
      respond,
    )
    expect(approve?.status).toBe(401)
    expect(db.deviceLinks.get(code)?.userId).toBeNull()
  })
})

describe('device link codes are claimed, not merely random', () => {
  it('mints another code rather than colliding with a live one', async () => {
    const db = new AuthDatabase()
    const env = makeEnv(db)

    // Force the first draw to land on a code already in the table. The
    // alternative is a primary-key violation, which a television would
    // report as "could not reach MercuryPitch".
    const taken = await handleAuth(
      new Request('https://api.test/api/auth/device/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceLabel: 'First TV' }),
      }),
      env,
      '/api/auth/device/start',
      respond,
    )
    const first = (await taken!.json()) as { code: string }

    const values = [...first.code].map((c) =>
      'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'.indexOf(c),
    )
    let draw = 0
    const real = crypto.getRandomValues.bind(crypto)
    vi.spyOn(crypto, 'getRandomValues').mockImplementation((array) => {
      const bytes = array as Uint8Array
      // The 8-byte draw is the code; the 43-byte one is the poll token and
      // is left genuinely random.
      if (bytes.length === 8 && draw++ === 0) {
        bytes.set(values)
        return array
      }
      return real(array as Parameters<typeof real>[0])
    })

    const second = await handleAuth(
      new Request('https://api.test/api/auth/device/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceLabel: 'Second TV' }),
      }),
      env,
      '/api/auth/device/start',
      respond,
    )
    expect(second?.status).toBe(200)
    const body = (await second!.json()) as { code: string }
    expect(body.code).not.toBe(first.code)

    // And the first device's row is untouched — the second TV must not
    // have overwritten a link somebody is in the middle of approving.
    expect(db.deviceLinks.get(first.code)?.deviceLabel).toBe('First TV')
    expect(db.deviceLinks.size).toBe(2)
  })
})

describe('device links and account erasure', () => {
  it('erases a pending link when the account it names is deleted', async () => {
    const db = new AuthDatabase()
    const perks = new PerksDatabase()
    const env = makeEnv(db, perks)
    const auth = await postAuth(
      'register',
      { email: 'linker@example.com', password: 'Sing1ngPass' },
      env,
    )

    const start = await handleAuth(
      new Request('https://api.test/api/auth/device/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceLabel: 'TV' }),
      }),
      env,
      '/api/auth/device/start',
      respond,
    )
    const { code } = (await start!.json()) as { code: string }
    await handleAuth(
      new Request('https://api.test/api/auth/device/approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${String(auth.token)}`,
        },
        body: JSON.stringify({ code }),
      }),
      env,
      '/api/auth/device/approve',
      respond,
    )
    expect(db.deviceLinks.get(code)?.userId).toBeTruthy()

    await handleAuth(
      new Request('https://api.test/api/auth/me', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${String(auth.token)}` },
      }),
      env,
      '/api/auth/me',
      respond,
    )

    // The row is swept only when the NEXT device asks for a code, so with
    // nobody linking anything an erased account's id would otherwise sit
    // here indefinitely. Unusable is not the same as erased.
    expect(
      db.preparedSql.some((sql) =>
        sql.includes('DELETE FROM "deviceLinkCodes"'),
      ),
    ).toBe(true)
  })
})

describe('the Turnstile gate on the public auth routes', () => {
  /** A worker configured to enforce the CAPTCHA, on a deployed origin. */
  function guardedEnv(db: AuthDatabase): Env {
    return {
      ...makeEnv(db),
      TURNSTILE_SECRET: 'test-secret',
      ALLOWED_ORIGINS: 'https://mercurypitch.com',
    }
  }

  function cloudflareSays(success: boolean): void {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ success }))),
    )
  }

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  for (const route of ['register', 'login', 'forgot-password'] as const) {
    it(`turns away ${route} when the CAPTCHA does not check out`, async () => {
      cloudflareSays(false)
      const response = await callAuth(
        route,
        {
          email: 'someone@example.com',
          password: 'Sup3rSecret!x',
          displayName: 'Someone',
          cfTurnstileToken: 'a-token',
        },
        guardedEnv(new AuthDatabase()),
      )

      expect(response.status).toBe(400)
      expect((await response.json()) as { error: string }).toEqual({
        error: 'CAPTCHA verification failed. Please try again.',
      })
    })

    it(`turns away ${route} when no token is sent at all`, async () => {
      cloudflareSays(true)
      const response = await callAuth(
        route,
        {
          email: 'someone@example.com',
          password: 'Sup3rSecret!x',
          displayName: 'Someone',
        },
        guardedEnv(new AuthDatabase()),
      )
      expect(response.status).toBe(400)
    })
  }

  it('leaves the anonymous route open', async () => {
    // A deliberate decision, not an oversight. An anonymous identity is
    // minted on somebody's very first write — putting a CAPTCHA in front of
    // it would tax every first-time visitor to slow down a bot that has not
    // yet cost us anything. The rate limiter covers this route instead.
    cloudflareSays(false)
    const response = await callAuth(
      'anonymous',
      { deviceId: '3f1b9c22-7a44-4f0e-9a1e-2c6d8b5e4a10' },
      guardedEnv(new AuthDatabase()),
    )
    expect(response.status).toBe(200)
  })

  it('lets a good token through to the route itself', async () => {
    cloudflareSays(true)
    const response = await callAuth(
      'register',
      {
        email: 'checked@example.com',
        password: 'Sup3rSecret!x',
        displayName: 'Checked',
        cfTurnstileToken: 'a-good-token',
      },
      guardedEnv(new AuthDatabase()),
    )
    // The gate is transparent when it passes: whatever the route answers is
    // what the caller sees, and it is certainly not the CAPTCHA refusal.
    expect(response.status).not.toBe(400)
  })

  it('keeps preview registration usable without calling inherited Resend', async () => {
    cloudflareSays(true)
    const db = new AuthDatabase()
    const response = await callAuth(
      'register',
      {
        email: 'preview-register@example.com',
        password: 'Sup3rSecret!x',
        displayName: 'Preview Singer',
        cfTurnstileToken: 'always-pass-test-token',
      },
      {
        ...guardedEnv(db),
        PR_PREVIEW: 'true',
        RESEND_API_KEY: 'inherited-dev-resend-key',
      },
    )

    expect(response.status).toBe(200)
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(
      db.preparedSql.some((sql) => sql.includes('emailVerifications')),
    ).toBe(false)
  })

  it('truthfully refuses preview password-reset email without an account lookup or Resend call', async () => {
    cloudflareSays(true)
    const db = new AuthDatabase()
    const response = await callAuth(
      'forgot-password',
      {
        email: 'preview-reset@example.com',
        cfTurnstileToken: 'always-pass-test-token',
      },
      {
        ...guardedEnv(db),
        PR_PREVIEW: 'true',
        RESEND_API_KEY: 'inherited-dev-resend-key',
      },
    )

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toEqual({
      error: 'Email delivery is unavailable in this pull-request preview',
    })
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(
      db.preparedSql.some(
        (sql) => sql === 'SELECT * FROM users WHERE email = ?',
      ),
    ).toBe(false)
    expect(db.preparedSql.some((sql) => sql.includes('passwordResets'))).toBe(
      false,
    )
  })

  it('truthfully refuses preview verification resend without calling inherited Resend', async () => {
    cloudflareSays(true)
    const db = new AuthDatabase()
    const env: Env = {
      ...guardedEnv(db),
      PR_PREVIEW: 'true',
      RESEND_API_KEY: 'inherited-dev-resend-key',
    }
    const registered = await callAuth(
      'register',
      {
        email: 'preview-verify@example.com',
        password: 'Sup3rSecret!x',
        displayName: 'Preview Singer',
        cfTurnstileToken: 'always-pass-test-token',
      },
      env,
    )
    const token = String(
      ((await registered.json()) as Record<string, unknown>).token,
    )
    const response = await handleAuth(
      new Request('https://api.test/api/auth/resend-verification', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }),
      env,
      '/api/auth/resend-verification',
      respond,
    )
    if (response == null) throw new Error('Auth route was not handled')

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toEqual({
      error: 'Email delivery is unavailable in this pull-request preview',
    })
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(
      db.preparedSql.some((sql) => sql.includes('emailVerifications')),
    ).toBe(false)
  })
})
