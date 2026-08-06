// ============================================================
// Supporter feature access — authority and fail-closed boundary tests
// ============================================================

import { describe, expect, it } from 'vitest'
import type { Env } from './auth'
import { resolveSupporterFeatureAccess } from './supporter-feature-access'

interface Fixture {
  automatic?: string[]
  email?: string | null
  emailVerified?: number
  entitlement?: { expiresAt: string | null } | null
  manual?: string[]
}

function environment(fixture: Fixture): {
  env: Env
  groupQueries: string[]
} {
  const groupQueries: string[] = []

  class Statement {
    readonly bindings: unknown[]

    constructor(
      readonly sql: string,
      bindings: unknown[] = [],
    ) {
      this.bindings = bindings
    }

    bind(...bindings: unknown[]): Statement {
      return new Statement(this.sql, bindings)
    }

    async first<T>(): Promise<T | null> {
      if (this.sql.includes('FROM users WHERE id')) {
        return {
          email: fixture.email ?? null,
          emailVerified: fixture.emailVerified ?? 0,
        } as T
      }
      if (this.sql.includes('FROM entitlements')) {
        return (fixture.entitlement ?? null) as T | null
      }
      throw new Error(`Unhandled first query: ${this.sql}`)
    }
  }

  const db = {
    prepare: (sql: string) => new Statement(sql.replace(/\s+/g, ' ').trim()),
    batch: async (statements: Statement[]) => {
      groupQueries.push(...statements.map((statement) => statement.sql))
      return statements.map((statement) => ({
        meta: {},
        results: (statement.sql.includes("g.slug = 'active-supporters'")
          ? (fixture.automatic ?? [])
          : (fixture.manual ?? [])
        ).map((featureId) => ({ featureId })),
        success: true,
      }))
    },
  }

  return { env: { DB: db } as unknown as Env, groupQueries }
}

describe('resolveSupporterFeatureAccess', () => {
  it('combines active-supporter and verified manual grants through the strict catalog', async () => {
    const fixture = environment({
      automatic: ['lab-access', 'unknown-feature'],
      email: '  Singer@Example.COM ',
      emailVerified: 1,
      entitlement: { expiresAt: null },
      manual: ['lab-access'],
    })

    await expect(
      resolveSupporterFeatureAccess(
        fixture.env,
        'user-1',
        Date.parse('2026-08-06T00:00:00.000Z'),
      ),
    ).resolves.toEqual(['lab-access'])
    expect(fixture.groupQueries).toHaveLength(2)
  })

  it('does not consult manual groups for an unverified email', async () => {
    const fixture = environment({
      email: 'singer@example.com',
      emailVerified: 0,
      entitlement: null,
      manual: ['lab-access'],
    })

    await expect(
      resolveSupporterFeatureAccess(fixture.env, 'user-1'),
    ).resolves.toEqual([])
    expect(fixture.groupQueries).toEqual([])
  })

  it('fails closed for expired, malformed and abbreviated supporter expiry values', async () => {
    for (const expiresAt of [
      '2026-01-01T00:00:00.000Z',
      'not-a-date',
      '2099',
    ]) {
      const fixture = environment({
        automatic: ['lab-access'],
        entitlement: { expiresAt },
      })

      await expect(
        resolveSupporterFeatureAccess(
          fixture.env,
          'user-1',
          Date.parse('2026-08-06T00:00:00.000Z'),
        ),
      ).resolves.toEqual([])
      expect(fixture.groupQueries).toEqual([])
    }
  })
})
