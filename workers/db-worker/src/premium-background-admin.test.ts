// ============================================================
// Premium Background Studio — validation and admin boundary tests
// ============================================================

import { describe, expect, it } from 'vitest'
import type { Env } from './auth'
import type { PremiumBackgroundAdminContext } from './premium-background-admin'
import { handlePremiumBackgroundAdminRequest, inspectWebP, } from './premium-background-admin'

function writeAscii(bytes: Uint8Array, offset: number, value: string): void {
  for (let index = 0; index < value.length; index += 1) {
    bytes[offset + index] = value.charCodeAt(index)
  }
}

function writeLittleEndian32(
  bytes: Uint8Array,
  offset: number,
  value: number,
): void {
  bytes[offset] = value & 0xff
  bytes[offset + 1] = (value >>> 8) & 0xff
  bytes[offset + 2] = (value >>> 16) & 0xff
  bytes[offset + 3] = (value >>> 24) & 0xff
}

function writeLittleEndian24(
  bytes: Uint8Array,
  offset: number,
  value: number,
): void {
  bytes[offset] = value & 0xff
  bytes[offset + 1] = (value >>> 8) & 0xff
  bytes[offset + 2] = (value >>> 16) & 0xff
}

function vp8x(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(30)
  writeAscii(bytes, 0, 'RIFF')
  writeLittleEndian32(bytes, 4, bytes.byteLength - 8)
  writeAscii(bytes, 8, 'WEBP')
  writeAscii(bytes, 12, 'VP8X')
  writeLittleEndian32(bytes, 16, 10)
  writeLittleEndian24(bytes, 24, width - 1)
  writeLittleEndian24(bytes, 27, height - 1)
  return bytes
}

function respond(body: object | null, init: ResponseInit = {}): Response {
  return new Response(body === null ? null : JSON.stringify(body), {
    ...init,
    headers: {
      'Cache-Control': 'private, no-store',
      'Content-Type': 'application/json',
      ...init.headers,
    },
  })
}

function adminContext(): PremiumBackgroundAdminContext {
  return {
    admin: true,
    auditActor: { actorId: null, actorType: 'admin-key' },
    corsHeaders: { 'Access-Control-Allow-Origin': '*' },
    respond,
  }
}

describe('inspectWebP', () => {
  it('reads bounded dimensions from a structurally valid VP8X file', () => {
    expect(inspectWebP(vp8x(2048, 1152))).toEqual({
      height: 1152,
      width: 2048,
    })
  })

  it('rejects a mismatched RIFF length and unsupported signature', () => {
    const wrongLength = vp8x(2048, 1152)
    writeLittleEndian32(wrongLength, 4, 1)
    const wrongSignature = vp8x(2048, 1152)
    writeAscii(wrongSignature, 8, 'NOPE')

    expect(inspectWebP(wrongLength)).toBeNull()
    expect(inspectWebP(wrongSignature)).toBeNull()
  })

  it('rejects dimensions above the Studio safety bound', () => {
    expect(inspectWebP(vp8x(8193, 1152))).toBeNull()
    expect(inspectWebP(vp8x(2048, 8193))).toBeNull()
  })
})

describe('Premium Background Studio admin boundary', () => {
  it('rejects every owned route before consulting D1 or R2 when admin proof is absent', async () => {
    const touched = () => {
      throw new Error('An unauthorized request touched a binding')
    }
    const env = {
      DB: { prepare: touched },
      PREMIUM_BACKGROUNDS_BUCKET: { get: touched },
    } as unknown as Env
    const context: PremiumBackgroundAdminContext = {
      admin: false,
      auditActor: { actorId: null, actorType: 'admin-key' },
      corsHeaders: { 'Access-Control-Allow-Origin': '*' },
      respond,
    }
    const request = new Request(
      'https://api.test/api/admin/premium-backgrounds',
    )

    const response = await handlePremiumBackgroundAdminRequest(
      request,
      env,
      new URL(request.url),
      context,
    )

    expect(response?.status).toBe(403)
    expect(await response?.json()).toEqual({ error: 'Admin key required' })
  })

  it('rejects an asset surface mutation before consulting D1', async () => {
    const touched = () => {
      throw new Error('An immutable surface mutation touched D1')
    }
    const env = { DB: { prepare: touched } } as unknown as Env
    const request = new Request(
      'https://api.test/api/admin/premium-backgrounds/piano-aurora-loft',
      {
        body: JSON.stringify({ surface: 'jam', title: 'Wrong room' }),
        headers: { 'Content-Type': 'application/json' },
        method: 'PATCH',
      },
    )

    const response = await handlePremiumBackgroundAdminRequest(
      request,
      env,
      new URL(request.url),
      adminContext(),
    )

    expect(response?.status).toBe(400)
    expect(await response?.json()).toEqual({
      error: 'Background surface is immutable',
    })
  })

  it('does not delete R2 when a draft-variant delete loses a publish race', async () => {
    const deletedKeys: string[] = []
    class Statement {
      constructor(readonly sql: string) {}
      bind(): Statement {
        return this
      }
      async first<T>(): Promise<T | null> {
        if (this.sql.includes('SELECT a.activeRevisionId')) {
          return {
            activeRevisionId: 'published-revision',
            id: 'draft-revision',
            lifecycle: 'draft',
            surface: 'jam',
            version: 2,
          } as T
        }
        if (this.sql.includes('SELECT * FROM premiumBackgroundVariants')) {
          return {
            byteSize: 30,
            createdAt: '2026-08-05T00:00:00.000Z',
            etag: 'etag',
            height: 1152,
            id: 'variant-id',
            objectKey: 'private/draft.webp',
            revisionId: 'draft-revision',
            sha256: 'sha256',
            updatedAt: '2026-08-05T00:00:00.000Z',
            variant: 'landscape-2k',
            width: 2048,
          } as T
        }
        throw new Error(`Unhandled first: ${this.sql}`)
      }
    }
    const db = {
      prepare: (sql: string) => new Statement(sql.replace(/\s+/g, ' ').trim()),
      batch: async (statements: Statement[]) =>
        statements.map(() => ({ meta: { changes: 0 }, results: [] })),
    }
    const env = {
      DB: db,
      PREMIUM_BACKGROUNDS_BUCKET: {
        delete: async (key: string) => {
          deletedKeys.push(key)
        },
      },
    } as unknown as Env
    const request = new Request(
      'https://api.test/api/admin/premium-backgrounds/golden-stage/revisions/draft-revision/variants/landscape-2k',
      { method: 'DELETE' },
    )

    const response = await handlePremiumBackgroundAdminRequest(
      request,
      env,
      new URL(request.url),
      adminContext(),
    )

    expect(response?.status).toBe(409)
    expect(deletedKeys).toEqual([])
  })

  it('rolls back a draft upload without a false audit when publish wins after R2 put', async () => {
    const batchedSql: string[] = []
    const deletedKeys: string[] = []
    const uploadedKeys: string[] = []
    class Statement {
      constructor(readonly sql: string) {}
      bind(): Statement {
        return this
      }
      async first<T>(): Promise<T | null> {
        if (this.sql.startsWith('SELECT a.activeRevisionId')) {
          return {
            activeRevisionId: 'published-revision',
            id: 'draft-revision',
            lifecycle: 'draft',
            surface: 'piano',
            version: 2,
          } as T
        }
        if (
          this.sql.startsWith('SELECT id FROM premiumBackgroundVariants') ||
          this.sql.startsWith('SELECT * FROM premiumBackgroundVariants')
        ) {
          return null
        }
        throw new Error(`Unhandled first: ${this.sql}`)
      }
    }
    const db = {
      prepare: (sql: string) => new Statement(sql.replace(/\s+/g, ' ').trim()),
      batch: async (statements: Statement[]) => {
        batchedSql.push(...statements.map((statement) => statement.sql))
        return statements.map(() => ({ meta: { changes: 0 }, results: [] }))
      },
    }
    const bucket = {
      delete: async (key: string) => {
        deletedKeys.push(key)
      },
      put: async (key: string) => {
        uploadedKeys.push(key)
        return { httpEtag: 'etag' }
      },
    }
    const env = {
      DB: db,
      PREMIUM_BACKGROUNDS_BUCKET: bucket,
    } as unknown as Env
    const request = new Request(
      'https://api.test/api/admin/premium-backgrounds/piano-aurora-loft/revisions/draft-revision/variants/landscape-2k/content',
      {
        body: vp8x(2048, 1152),
        headers: { 'Content-Type': 'image/webp' },
        method: 'PUT',
      },
    )

    const response = await handlePremiumBackgroundAdminRequest(
      request,
      env,
      new URL(request.url),
      adminContext(),
    )

    expect(response?.status).toBe(409)
    expect(uploadedKeys).toHaveLength(1)
    expect(uploadedKeys[0]).toMatch(
      /^backgrounds\/v2\/piano\/piano-aurora-loft\/v2\/landscape-2k\/[0-9a-f-]+\.webp$/,
    )
    expect(deletedKeys).toEqual(uploadedKeys)
    expect(batchedSql[1]).toContain('WHERE changes() = 1')
  })

  it('rejects a stored cross-surface Piano draft before touching R2', async () => {
    let bucketTouched = false
    class Statement {
      constructor(readonly sql: string) {}
      bind(): Statement {
        return this
      }
      async first<T>(): Promise<T | null> {
        if (this.sql.startsWith('SELECT a.activeRevisionId')) {
          return {
            activeRevisionId: null,
            id: 'draft-revision',
            lifecycle: 'draft',
            surface: 'jam',
            version: 1,
          } as T
        }
        throw new Error(`Unhandled first: ${this.sql}`)
      }
    }
    const env = {
      DB: {
        prepare: (sql: string) =>
          new Statement(sql.replace(/\s+/g, ' ').trim()),
      },
      PREMIUM_BACKGROUNDS_BUCKET: {
        put: async () => {
          bucketTouched = true
          return null
        },
      },
    } as unknown as Env
    const request = new Request(
      'https://api.test/api/admin/premium-backgrounds/piano-aurora-loft/revisions/draft-revision/variants/landscape-2k/content',
      {
        body: vp8x(2048, 1152),
        headers: { 'Content-Type': 'image/webp' },
        method: 'PUT',
      },
    )

    const response = await handlePremiumBackgroundAdminRequest(
      request,
      env,
      new URL(request.url),
      adminContext(),
    )

    expect(response?.status).toBe(404)
    expect(bucketTouched).toBe(false)
  })

  it('fails a publish that loses a retirement race and gates every transition on active state', async () => {
    const batchedSql: string[] = []
    class Statement {
      constructor(readonly sql: string) {}
      bind(): Statement {
        return this
      }
      async first<T>(): Promise<T | null> {
        if (this.sql.startsWith('SELECT a.*, r.version')) {
          return {
            activeRevisionId: 'published-revision',
            createdAt: '2026-08-05T00:00:00.000Z',
            description: '',
            id: 'golden-stage',
            lifecycle: 'draft',
            retiredAt: null,
            status: 'active',
            surface: 'jam',
            title: 'Golden Stage',
            updatedAt: '2026-08-05T00:00:00.000Z',
            version: 2,
          } as T
        }
        if (this.sql.startsWith('SELECT r.*, a.status AS assetStatus')) {
          return {
            assetStatus: 'retired',
            backgroundId: 'golden-stage',
            createdAt: '2026-08-05T00:00:00.000Z',
            id: 'draft-revision',
            lifecycle: 'draft',
            publishedAt: null,
            selectedRevisionId: 'published-revision',
            supersededAt: null,
            updatedAt: '2026-08-05T00:00:00.000Z',
            version: 2,
          } as T
        }
        throw new Error(`Unhandled first: ${this.sql}`)
      }
      async all<T>(): Promise<{ results: T[] }> {
        if (!this.sql.startsWith('SELECT * FROM premiumBackgroundVariants')) {
          throw new Error(`Unhandled all: ${this.sql}`)
        }
        return {
          results: ['landscape-2k', 'landscape-4k', 'portrait-2k'].map(
            (variant) => ({ variant }),
          ) as T[],
        }
      }
    }
    const db = {
      prepare: (sql: string) => new Statement(sql.replace(/\s+/g, ' ').trim()),
      batch: async (statements: Statement[]) => {
        batchedSql.push(...statements.map((statement) => statement.sql))
        return statements.map(() => ({ meta: { changes: 0 }, results: [] }))
      },
    }
    const env = { DB: db } as unknown as Env
    const request = new Request(
      'https://api.test/api/admin/premium-backgrounds/golden-stage/revisions/draft-revision/publish',
      { method: 'POST' },
    )

    const response = await handlePremiumBackgroundAdminRequest(
      request,
      env,
      new URL(request.url),
      adminContext(),
    )

    expect(response?.status).toBe(409)
    const transitions = batchedSql.filter((sql) =>
      sql.startsWith('UPDATE premiumBackground'),
    )
    expect(transitions).toHaveLength(4)
    expect(transitions.every((sql) => sql.includes("status = 'active'"))).toBe(
      true,
    )
  })

  it('does not soft-delete a group when an active reference appears after the precheck', async () => {
    const batchedSql: string[] = []
    class Statement {
      constructor(readonly sql: string) {}
      bind(): Statement {
        return this
      }
      async first<T>(): Promise<T | null> {
        if (this.sql.startsWith('SELECT * FROM premiumSupporterGroups')) {
          return {
            active: 1,
            createdAt: '2026-08-05T00:00:00.000Z',
            deletedAt: null,
            description: '',
            id: 'group-1',
            kind: 'manual',
            name: 'Group',
            slug: 'group',
            updatedAt: '2026-08-05T00:00:00.000Z',
          } as T
        }
        if (this.sql.startsWith('SELECT (SELECT COUNT(*)')) {
          return {
            activeFeatures: 0,
            activeMembers: 0,
            activePerks: 0,
          } as T
        }
        throw new Error(`Unhandled first: ${this.sql}`)
      }
    }
    const db = {
      prepare: (sql: string) => new Statement(sql.replace(/\s+/g, ' ').trim()),
      batch: async (statements: Statement[]) => {
        batchedSql.push(...statements.map((statement) => statement.sql))
        return statements.map(() => ({ meta: { changes: 0 }, results: [] }))
      },
    }
    const env = { DB: db } as unknown as Env
    const request = new Request(
      'https://api.test/api/admin/supporter-groups/group-1',
      { method: 'DELETE' },
    )

    const response = await handlePremiumBackgroundAdminRequest(
      request,
      env,
      new URL(request.url),
      adminContext(),
    )

    expect(response?.status).toBe(409)
    expect(batchedSql[0]).toContain(
      'NOT EXISTS ( SELECT 1 FROM premiumSupporterGroupMembers',
    )
    expect(batchedSql[0]).toContain(
      'NOT EXISTS ( SELECT 1 FROM premiumSupporterGroupPerks',
    )
    expect(batchedSql[0]).toContain(
      'NOT EXISTS ( SELECT 1 FROM premiumSupporterGroupFeatures',
    )
  })

  it('assigns a catalogued feature through a guarded, audited admin mutation', async () => {
    const batchedSql: string[] = []
    class Statement {
      constructor(readonly sql: string) {}
      bind(): Statement {
        return this
      }
      async first<T>(): Promise<T | null> {
        if (this.sql.startsWith('SELECT id FROM premiumSupporterGroups')) {
          return { id: 'group-1' } as T
        }
        throw new Error(`Unhandled first: ${this.sql}`)
      }
    }
    const db = {
      prepare: (sql: string) => new Statement(sql.replace(/\s+/g, ' ').trim()),
      batch: async (statements: Statement[]) => {
        batchedSql.push(...statements.map((statement) => statement.sql))
        return statements.map(() => ({ meta: { changes: 1 }, results: [] }))
      },
    }
    const env = { DB: db } as unknown as Env
    const request = new Request(
      'https://api.test/api/admin/supporter-groups/group-1/features/lab-access',
      { method: 'POST' },
    )

    const response = await handlePremiumBackgroundAdminRequest(
      request,
      env,
      new URL(request.url),
      adminContext(),
    )

    expect(response?.status).toBe(200)
    expect(await response?.json()).toEqual({
      feature: {
        assignedAt: expect.any(String),
        featureId: 'lab-access',
        revokedAt: null,
      },
    })
    expect(batchedSql[0]).toContain('INSERT INTO premiumSupporterGroupFeatures')
    expect(batchedSql[0]).toContain('deletedAt IS NULL')
    expect(batchedSql[1]).toContain('INSERT INTO premiumPerkAudit')
    expect(batchedSql[1]).toContain('WHERE changes() = 1')
  })

  it('rejects unknown supporter features before consulting D1', async () => {
    const touched = () => {
      throw new Error('An unknown feature touched D1')
    }
    const env = { DB: { prepare: touched } } as unknown as Env
    const request = new Request(
      'https://api.test/api/admin/supporter-groups/group-1/features/all-access',
      { method: 'POST' },
    )

    const response = await handlePremiumBackgroundAdminRequest(
      request,
      env,
      new URL(request.url),
      adminContext(),
    )

    expect(response?.status).toBe(404)
    expect(await response?.json()).toEqual({
      error: 'Group feature not found',
    })
  })

  it('fails member and perk grants when their group is deleted before the guarded upsert', async () => {
    const batchedSql: string[] = []
    class Statement {
      constructor(readonly sql: string) {}
      bind(): Statement {
        return this
      }
      async first<T>(): Promise<T | null> {
        if (this.sql.includes('FROM premiumSupporterGroups')) {
          return {
            active: 1,
            createdAt: '2026-08-05T00:00:00.000Z',
            deletedAt: null,
            description: '',
            id: 'group-1',
            kind: 'manual',
            name: 'Group',
            slug: 'group',
            updatedAt: '2026-08-05T00:00:00.000Z',
          } as T
        }
        if (this.sql.startsWith('SELECT id FROM users')) {
          return { id: 'user-1' } as T
        }
        if (
          this.sql.startsWith('SELECT id, surface FROM premiumBackgroundAssets')
        ) {
          return { id: 'golden-stage', surface: 'jam' } as T
        }
        throw new Error(`Unhandled first: ${this.sql}`)
      }
    }
    const db = {
      prepare: (sql: string) => new Statement(sql.replace(/\s+/g, ' ').trim()),
      batch: async (statements: Statement[]) => {
        batchedSql.push(...statements.map((statement) => statement.sql))
        return statements.map(() => ({ meta: { changes: 0 }, results: [] }))
      },
    }
    const env = { DB: db } as unknown as Env
    const memberRequest = new Request(
      'https://api.test/api/admin/supporter-groups/group-1/members',
      {
        body: JSON.stringify({ email: 'member@example.test' }),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      },
    )
    const perkRequest = new Request(
      'https://api.test/api/admin/supporter-groups/group-1/perks/golden-stage',
      { method: 'POST' },
    )

    const memberResponse = await handlePremiumBackgroundAdminRequest(
      memberRequest,
      env,
      new URL(memberRequest.url),
      adminContext(),
    )
    const perkResponse = await handlePremiumBackgroundAdminRequest(
      perkRequest,
      env,
      new URL(perkRequest.url),
      adminContext(),
    )

    expect(memberResponse?.status).toBe(409)
    expect(perkResponse?.status).toBe(409)
    const grants = batchedSql.filter((sql) => sql.startsWith('INSERT INTO'))
    expect(grants).toHaveLength(4)
    expect(grants[0]).toContain("kind = 'manual' AND deletedAt IS NULL")
    expect(grants[2]).toContain('deletedAt IS NULL')
    expect(grants[1]).toContain('WHERE changes() = 1')
    expect(grants[3]).toContain('WHERE changes() = 1')
  })

  it('returns the stored revocation time when a capability revoke loses a race', async () => {
    const batchedSql: string[] = []
    const storedRevokedAt = '2026-08-05T10:15:00.000Z'
    class Statement {
      constructor(readonly sql: string) {}
      bind(): Statement {
        return this
      }
      async first<T>(): Promise<T | null> {
        if (this.sql.startsWith('SELECT id, revokedAt')) {
          return { id: 'capability-1', revokedAt: null } as T
        }
        if (this.sql.startsWith('SELECT revokedAt')) {
          return { revokedAt: storedRevokedAt } as T
        }
        throw new Error(`Unhandled first: ${this.sql}`)
      }
    }
    const db = {
      prepare: (sql: string) => new Statement(sql.replace(/\s+/g, ' ').trim()),
      batch: async (statements: Statement[]) => {
        batchedSql.push(...statements.map((statement) => statement.sql))
        return statements.map(() => ({ meta: { changes: 0 }, results: [] }))
      },
    }
    const env = { DB: db } as unknown as Env
    const request = new Request(
      'https://api.test/api/admin/premium-background-capabilities/capability-1/revoke',
      { method: 'POST' },
    )

    const response = await handlePremiumBackgroundAdminRequest(
      request,
      env,
      new URL(request.url),
      adminContext(),
    )

    expect(response?.status).toBe(200)
    expect(await response?.json()).toEqual({
      ok: true,
      revokedAt: storedRevokedAt,
    })
    expect(batchedSql[0]).toContain('AND revokedAt IS NULL')
    expect(batchedSql[1]).toContain('WHERE changes() = 1')
  })
})
