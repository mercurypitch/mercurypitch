import { describe, expect, it } from 'vitest'
import type { Env } from './auth'
import worker from './index'
import { handleUserSuspension } from './moderation'

interface UserState {
  suspendedAt: string | null
  suspensionReason: string | null
  tokenVersion: number
  updatedAt: string
}

interface ModerationEvent {
  userId: string
  action: 'suspend' | 'restore'
  reason: string
}

class ModerationStatement {
  private values: unknown[] = []

  constructor(
    private readonly db: ModerationDatabase,
    readonly sql: string,
  ) {}

  bind(...values: unknown[]): ModerationStatement {
    this.values = values
    return this
  }

  async first<T>(): Promise<T | null> {
    if (this.sql.startsWith('SELECT suspendedAt, suspensionReason')) {
      const user = this.db.users.get(String(this.values[0]))
      if (!user) return null
      return {
        suspendedAt: user.suspendedAt,
        suspensionReason: user.suspensionReason,
      } as T
    }
    throw new Error(`Unexpected first SQL: ${this.sql}`)
  }

  execute(): { meta: { changes: number } } {
    if (this.sql.startsWith('INSERT INTO userModerationEvents')) {
      const [, , userId, action, reason] = this.values
      const user = this.db.users.get(String(userId))
      const expectedSuspended = this.sql.includes('suspendedAt IS NOT NULL')
      if (user && (user.suspendedAt !== null) === expectedSuspended) {
        this.db.events.push({
          userId: String(userId),
          action: action as 'suspend' | 'restore',
          reason: String(reason),
        })
        return { meta: { changes: 1 } }
      }
      return { meta: { changes: 0 } }
    }

    if (this.sql.startsWith('UPDATE users SET suspendedAt = ?')) {
      const [suspendedAt, reason, updatedAt, userId] = this.values
      const user = this.db.users.get(String(userId))
      if (!user || user.suspendedAt !== null) return { meta: { changes: 0 } }
      Object.assign(user, {
        suspendedAt: String(suspendedAt),
        suspensionReason: String(reason),
        updatedAt: String(updatedAt),
        tokenVersion: user.tokenVersion + 1,
      })
      return { meta: { changes: 1 } }
    }

    if (this.sql.startsWith('UPDATE users SET suspendedAt = NULL')) {
      const [updatedAt, userId] = this.values
      const user = this.db.users.get(String(userId))
      if (!user || user.suspendedAt === null) return { meta: { changes: 0 } }
      Object.assign(user, {
        suspendedAt: null,
        suspensionReason: null,
        updatedAt: String(updatedAt),
      })
      return { meta: { changes: 1 } }
    }

    throw new Error(`Unexpected batch SQL: ${this.sql}`)
  }
}

class ModerationDatabase {
  readonly users = new Map<string, UserState>()
  readonly events: ModerationEvent[] = []

  prepare(sql: string): ModerationStatement {
    return new ModerationStatement(this, sql.replace(/\s+/g, ' ').trim())
  }

  async batch(
    statements: ModerationStatement[],
  ): Promise<Array<{ meta: { changes: number } }>> {
    return statements.map((statement) => statement.execute())
  }
}

const USER_ID = '00000000-0000-4000-8000-000000000042'

function envWithUser(): { env: Env; db: ModerationDatabase } {
  const db = new ModerationDatabase()
  db.users.set(USER_ID, {
    suspendedAt: null,
    suspensionReason: null,
    tokenVersion: 1,
    updatedAt: '2026-01-01T00:00:00.000Z',
  })
  return { env: { DB: db as unknown as D1Database }, db }
}

function request(body: unknown): Request {
  return new Request('https://api.test/api/admin/user-suspension', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function respond(body: object | null, init?: ResponseInit): Response {
  return new Response(body == null ? null : JSON.stringify(body), init)
}

describe('account moderation', () => {
  it('requires the admin gate before reading a target user', async () => {
    const { env } = envWithUser()
    const response = await handleUserSuspension(
      request({ userId: USER_ID, suspended: true, reason: 'Abuse review' }),
      env,
      respond,
      false,
    )
    expect(response.status).toBe(403)
  })

  it('is wired through the admin-only worker route', async () => {
    const { env, db } = envWithUser()
    env.ADMIN_KEY = 'test-admin-key'
    const response = await worker.fetch(
      new Request('https://api.test/api/admin/user-suspension', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Key': 'test-admin-key',
        },
        body: JSON.stringify({
          userId: USER_ID,
          suspended: true,
          reason: 'Automated abuse review',
        }),
      }),
      env,
      {} as ExecutionContext,
    )

    expect(response.status).toBe(200)
    expect(db.users.get(USER_ID)?.suspendedAt).not.toBeNull()
  })

  it('awaits strict Cloudflare Access authorization before the admin route', async () => {
    const { env, db } = envWithUser()
    env.ADMIN_KEY = 'test-admin-key'
    env.ACCESS_TEAM_DOMAIN = 'example-team.cloudflareaccess.com'
    env.ACCESS_AUD = 'suspension-admin-audience'
    env.ACCESS_STRICT = '1'

    const response = await worker.fetch(
      new Request('https://api.test/api/admin/user-suspension', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Key': 'test-admin-key',
        },
        body: JSON.stringify({
          userId: USER_ID,
          suspended: true,
          reason: 'Automated abuse review',
        }),
      }),
      env,
      {} as ExecutionContext,
    )

    expect(response.status).toBe(403)
    expect(db.users.get(USER_ID)?.suspendedAt).toBeNull()
    expect(db.events).toHaveLength(0)
  })

  it('rejects malformed targets and weak audit reasons', async () => {
    const { env } = envWithUser()
    const badUser = await handleUserSuspension(
      request({ userId: 'not-a-uuid', suspended: true, reason: 'Abuse review' }),
      env,
      respond,
      true,
    )
    expect(badUser.status).toBe(400)

    const badReason = await handleUserSuspension(
      request({ userId: USER_ID, suspended: true, reason: 'short' }),
      env,
      respond,
      true,
    )
    expect(badReason.status).toBe(400)

    for (const body of [
      { userId: USER_ID, reason: 'Automated abuse review' },
      {
        userId: USER_ID,
        suspended: 'yes',
        reason: 'Automated abuse review',
      },
      { userId: USER_ID, suspended: true },
      { userId: USER_ID, suspended: true, reason: 42 },
      { userId: USER_ID, suspended: true, reason: 'valid reason\nforged' },
      { userId: USER_ID, suspended: true, reason: 'x'.repeat(281) },
    ]) {
      const response = await handleUserSuspension(
        request(body),
        env,
        respond,
        true,
      )
      expect(response.status).toBe(400)
    }
  })

  it('rejects non-POST requests and malformed JSON', async () => {
    const { env } = envWithUser()
    const wrongMethod = await handleUserSuspension(
      new Request('https://api.test/api/admin/user-suspension'),
      env,
      respond,
      true,
    )
    expect(wrongMethod.status).toBe(405)

    const malformed = await handleUserSuspension(
      new Request('https://api.test/api/admin/user-suspension', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{',
      }),
      env,
      respond,
      true,
    )
    expect(malformed.status).toBe(400)
  })

  it('suspends once, revokes tokens, and appends one audit event', async () => {
    const { env, db } = envWithUser()
    const body = {
      userId: USER_ID,
      suspended: true,
      reason: 'Automated abuse review',
    }
    const first = await handleUserSuspension(request(body), env, respond, true)
    await expect(first.json()).resolves.toMatchObject({
      suspended: true,
      suspensionReason: body.reason,
      changed: true,
    })
    expect(db.users.get(USER_ID)?.tokenVersion).toBe(2)
    expect(db.events).toEqual([
      { userId: USER_ID, action: 'suspend', reason: body.reason },
    ])

    const second = await handleUserSuspension(request(body), env, respond, true)
    await expect(second.json()).resolves.toMatchObject({ changed: false })
    expect(db.users.get(USER_ID)?.tokenVersion).toBe(2)
    expect(db.events).toHaveLength(1)
  })

  it('restores access without reviving a revoked token', async () => {
    const { env, db } = envWithUser()
    await handleUserSuspension(
      request({
        userId: USER_ID,
        suspended: true,
        reason: 'Automated abuse review',
      }),
      env,
      respond,
      true,
    )
    const response = await handleUserSuspension(
      request({
        userId: USER_ID,
        suspended: false,
        reason: 'Manual appeal accepted',
      }),
      env,
      respond,
      true,
    )
    await expect(response.json()).resolves.toMatchObject({
      suspended: false,
      suspendedAt: null,
      suspensionReason: null,
      changed: true,
    })
    expect(db.users.get(USER_ID)?.tokenVersion).toBe(2)
    expect(db.events.map((event) => event.action)).toEqual([
      'suspend',
      'restore',
    ])

    const idempotent = await handleUserSuspension(
      request({
        userId: USER_ID,
        suspended: false,
        reason: 'Manual appeal accepted',
      }),
      env,
      respond,
      true,
    )
    await expect(idempotent.json()).resolves.toMatchObject({ changed: false })
    expect(db.events.map((event) => event.action)).toEqual([
      'suspend',
      'restore',
    ])
  })

  it('returns not found without creating an audit event', async () => {
    const { env, db } = envWithUser()
    const response = await handleUserSuspension(
      request({
        userId: '00000000-0000-4000-8000-000000000099',
        suspended: true,
        reason: 'Automated abuse review',
      }),
      env,
      respond,
      true,
    )
    expect(response.status).toBe(404)
    expect(db.events).toHaveLength(0)
  })
})
