import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Env } from './auth'
import { handleAuth } from './auth'

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

    throw new Error(`Unexpected first() SQL: ${this.sql}`)
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
      })
      return { success: true }
    }

    if (this.sql.startsWith("UPDATE users SET authProvider = 'password'")) {
      const [email, passwordHash, updatedAt, id] = this.values
      Object.assign(this.db.user(String(id)), {
        authProvider: 'password',
        email: String(email),
        passwordHash: String(passwordHash),
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

    throw new Error(`Unexpected run() SQL: ${this.sql}`)
  }
}

class AuthDatabase {
  readonly users = new Map<string, UserRecord>()

  prepare(sql: string): AuthStatement {
    return new AuthStatement(this, sql.replace(/\s+/g, ' ').trim())
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
    })
  }

  user(id: string): UserRecord {
    const user = this.users.get(id)
    if (!user) throw new Error(`Missing test user: ${id}`)
    return user
  }
}

const FRESH_DEVICE_ID = '00000000-0000-4000-8000-000000000001'
const ANONYMOUS_DEVICE_ID = '00000000-0000-4000-8000-000000000002'

function makeEnv(db: AuthDatabase): Env {
  return {
    DB: db as unknown as D1Database,
    JWT_SECRET: 'test-jwt-secret',
    GOOGLE_CLIENT_ID: 'test-google-client',
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
