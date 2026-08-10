// ============================================================
// Premium background delivery — authorization and object-key boundaries
// ============================================================
//
// These fakes reject unfamiliar SQL and record every bucket read. That makes
// the security assertions explicit: invalid identities and paths must fail
// before R2 is touched, while either server-held grant type may authorize the
// one allowlisted object key.

import { describe, expect, it } from 'vitest'
import type { BackgroundPerkId } from '../../../src/lib/backgrounds/background-catalog'
import { BACKGROUND_PERK_IDS, getBackgroundDefinition, } from '../../../src/lib/backgrounds/background-catalog'
import type { AuthUser, Env } from './auth'
import { BACKGROUND_CAPABILITY_TTL_SECONDS, mintBackgroundCapability, } from './background-capabilities'
import { isJamPremiumBackgroundId } from './premium-background-catalog'
import { handlePremiumBackgroundRequest } from './premium-backgrounds'

const CORS = { 'Access-Control-Allow-Origin': '*' }
const ALICE: AuthUser = { userId: 'alice', provider: 'password' }
const CAPABILITY_SECRET = 'test-only-capability-secret-with-more-than-32-bytes'
const OWNER_TOKEN = '00000000-0000-4000-8000-000000000001'
const ROOM_ID = 'ABCDEFGH'
const workerCrypto = Reflect.get(globalThis, 'crypto') as Crypto

class MainStatement {
  private values: unknown[] = []

  constructor(
    private readonly db: FakeMainDb,
    private readonly sql: string,
  ) {}

  bind(...values: unknown[]): MainStatement {
    this.values = values
    return this
  }

  async first<T>(): Promise<T | null> {
    this.db.reads += 1
    if (this.sql.startsWith('INSERT INTO auth_ratelimit')) {
      const key = `${String(this.values[0])}:${String(this.values[1])}`
      const count = (this.db.rateLimitCounts.get(key) ?? 0) + 1
      this.db.rateLimitCounts.set(key, count)
      return {
        count,
        windowStart: Number(this.values[2]),
      } as T
    }
    if (
      this.sql.includes('SELECT expiresAt FROM entitlements') ||
      (this.sql.startsWith('SELECT expiresAt') &&
        this.sql.includes('FROM entitlements'))
    ) {
      const userId = String(this.values[0])
      const expiresAt = this.db.supporterExpiry.get(userId)
      return (expiresAt === undefined ? null : { expiresAt }) as T | null
    }
    if (
      this.sql === 'SELECT email, emailVerified FROM users WHERE id = ?' ||
      this.sql.startsWith(
        'SELECT email, emailVerified FROM users WHERE id = ?1',
      )
    ) {
      return (this.db.users.get(String(this.values[0])) ?? null) as T | null
    }
    if (
      this.sql.startsWith(
        'SELECT a.id, a.surface, a.title, a.description, a.activeRevisionId, r.version FROM premiumBackgroundAssets',
      )
    ) {
      const id = String(this.values[0])
      const requestedVersion = this.values[1]
      const asset = this.db.assets.get(id)
      if (
        asset === undefined ||
        asset.status !== 'active' ||
        (requestedVersion !== null && requestedVersion !== asset.version)
      ) {
        return null
      }
      return {
        activeRevisionId: asset.revisionId,
        description: `${asset.id} description`,
        id: asset.id,
        surface: asset.surface,
        title: asset.id,
        version: asset.version,
      } as T
    }
    if (
      this.sql.startsWith(
        'SELECT revisionId, variant, objectKey, width, height, byteSize, sha256 FROM premiumBackgroundVariants',
      )
    ) {
      const revisionId = String(this.values[0])
      const variant = String(this.values[1])
      const asset = [...this.db.assets.values()].find(
        (candidate) => candidate.revisionId === revisionId,
      )
      if (asset === undefined) return null
      const stored = asset.variants.get(variant)
      return (stored ?? null) as T | null
    }
    if (
      this.sql.startsWith(
        'SELECT id, backgroundId, revisionId, version, roomId, issuerUserId, issuedAt, expiresAt, revokedAt FROM premiumBackgroundCapabilities',
      )
    ) {
      return (this.db.capabilities.get(String(this.values[0])) ??
        null) as T | null
    }
    throw new Error(`FakeMainDb: unhandled first() — ${this.sql}`)
  }

  async all<T>(): Promise<{ results: T[] }> {
    this.db.reads += 1
    if (
      this.sql.startsWith(
        'SELECT a.id, a.surface, a.title, a.description, a.activeRevisionId, r.version FROM premiumBackgroundAssets',
      )
    ) {
      return {
        results: [...this.db.assets.values()]
          .filter((asset) => asset.status === 'active')
          .map((asset) => ({
            activeRevisionId: asset.revisionId,
            description: `${asset.id} description`,
            id: asset.id,
            surface: asset.surface,
            title: asset.id,
            version: asset.version,
          })) as T[],
      }
    }
    if (
      this.sql.startsWith(
        'SELECT a.id AS backgroundId, a.activeRevisionId AS revisionId, r.version, v.variant, v.objectKey',
      )
    ) {
      return {
        results: [...this.db.assets.values()]
          .filter((asset) => asset.status === 'active')
          .flatMap((asset) =>
            [...asset.variants.values()].map((variant) => ({
              ...variant,
              backgroundId: asset.id,
              version: asset.version,
            })),
          ) as T[],
      }
    }
    if (this.sql.includes("g.slug = 'active-supporters'")) {
      return {
        results: BACKGROUND_PERK_IDS.map((backgroundId) => ({
          backgroundId,
        })) as T[],
      }
    }
    if (this.sql.includes('FROM premiumSupporterGroupMembers m')) {
      const grants = this.db.manualGrants.get(String(this.values[0])) ?? []
      return {
        results: grants.map((backgroundId) => ({ backgroundId })) as T[],
      }
    }
    throw new Error(`FakeMainDb: unhandled all() — ${this.sql}`)
  }

  async run(): Promise<{ meta: { changes: number }; results: unknown[] }> {
    this.db.writes += 1
    if (this.sql.startsWith('DELETE FROM premiumBackgroundCapabilities')) {
      const cutoff = String(this.values[0])
      let changes = 0
      for (const [id, capability] of this.db.capabilities) {
        if (capability.expiresAt <= cutoff && changes < 200) {
          this.db.capabilities.delete(id)
          changes += 1
        }
      }
      return { meta: { changes }, results: [] }
    }
    if (this.sql.startsWith('INSERT INTO premiumBackgroundCapabilities')) {
      this.db.capabilities.set(String(this.values[0]), {
        backgroundId: String(this.values[1]),
        expiresAt: String(this.values[7]),
        id: String(this.values[0]),
        issuedAt: String(this.values[6]),
        issuerUserId: String(this.values[5]),
        revisionId: String(this.values[2]),
        revokedAt: null,
        roomId: String(this.values[4]),
        version: Number(this.values[3]),
      })
      return { meta: { changes: 1 }, results: [] }
    }
    if (this.sql.startsWith('INSERT INTO premiumPerkAudit')) {
      return { meta: { changes: 1 }, results: [] }
    }
    throw new Error(`FakeMainDb: unhandled run() — ${this.sql}`)
  }

  get normalizedSql(): string {
    return this.sql
  }
}

interface FakeVariant {
  byteSize: number
  height: number
  objectKey: string
  revisionId: string
  sha256: string
  variant: string
  width: number
}

interface FakeAsset {
  id: string
  revisionId: string
  status: 'active' | 'retired'
  surface: 'jam' | 'karaoke' | 'piano'
  variants: Map<string, FakeVariant>
  version: number
}

interface FakeCapabilityRow {
  backgroundId: string
  expiresAt: string
  id: string
  issuedAt: string
  issuerUserId: string
  revisionId: string
  revokedAt: string | null
  roomId: string
  version: number
}

class FakeMainDb {
  readonly assets = new Map<string, FakeAsset>()
  readonly capabilities = new Map<string, FakeCapabilityRow>()
  readonly manualGrants = new Map<string, string[]>()
  readonly rateLimitCounts = new Map<string, number>()
  readonly supporterExpiry = new Map<string, string | null>()
  readonly users = new Map<
    string,
    { email: string | null; emailVerified: number }
  >()
  reads = 0
  writes = 0

  prepare(sql: string): MainStatement {
    return new MainStatement(this, sql.replace(/\s+/g, ' ').trim())
  }

  async batch<T>(
    statements: MainStatement[],
  ): Promise<Array<{ results: T[] }>> {
    const results: Array<{ results: T[] }> = []
    for (const statement of statements) {
      if (statement.normalizedSql.startsWith('SELECT')) {
        results.push(await statement.all<T>())
      } else {
        await statement.run()
        results.push({ results: [] })
      }
    }
    return results
  }
}

class PerksStatement {
  private values: unknown[] = []

  constructor(
    private readonly db: FakePerksDb,
    private readonly sql: string,
  ) {}

  bind(...values: unknown[]): PerksStatement {
    this.values = values
    return this
  }

  async all<T>(): Promise<{ results: T[] }> {
    this.db.reads += 1
    if (
      this.sql !==
      'SELECT perkId FROM perkGrants WHERE email = ?1 AND revokedAt IS NULL'
    ) {
      throw new Error(`FakePerksDb: unhandled all() — ${this.sql}`)
    }
    const grants = this.db.grants.get(String(this.values[0])) ?? []
    return { results: grants.map((perkId) => ({ perkId })) as T[] }
  }
}

class FakePerksDb {
  readonly grants = new Map<string, string[]>()
  reads = 0

  prepare(sql: string): PerksStatement {
    return new PerksStatement(this, sql.replace(/\s+/g, ' ').trim())
  }
}

class FakeObjectMap extends Map<string, Uint8Array> {
  constructor(private readonly main: FakeMainDb) {
    super()
  }

  override set(key: string, value: Uint8Array): this {
    for (const asset of this.main.assets.values()) {
      for (const variant of asset.variants.values()) {
        if (variant.objectKey === key) variant.byteSize = value.byteLength
      }
    }
    return super.set(key, value)
  }
}

class FakeBucket {
  readonly reads: string[] = []
  readonly objects: FakeObjectMap

  constructor(main: FakeMainDb) {
    this.objects = new FakeObjectMap(main)
  }

  async get(key: string): Promise<R2ObjectBody | null> {
    this.reads.push(key)
    const bytes = this.objects.get(key)
    if (bytes === undefined) return null
    return {
      body: new Response(bytes).body,
      httpEtag: '"asset-etag"',
      size: bytes.byteLength,
      uploaded: new Date('2026-08-01T12:00:00.000Z'),
    } as unknown as R2ObjectBody
  }
}

interface JamCall {
  ownerToken: string
  roomId: string
}

class FakeJamWorker {
  readonly calls: JamCall[] = []
  verified = true

  async verifyHost(roomId: string, ownerToken: string): Promise<boolean> {
    this.calls.push({ ownerToken, roomId })
    return this.verified
  }
}

interface Fixture {
  bucket: FakeBucket
  env: Env
  jam: FakeJamWorker
  main: FakeMainDb
  perks: FakePerksDb
}

function fixture(): Fixture {
  const main = new FakeMainDb()
  const perks = new FakePerksDb()
  for (const id of BACKGROUND_PERK_IDS) {
    const definition = getBackgroundDefinition(id)!
    const revisionId = `revision-${id}`
    const variants = new Map<string, FakeVariant>()
    for (const variant of ['landscape-2k', 'landscape-4k', 'portrait-2k']) {
      variants.set(variant, {
        byteSize: 1,
        height: variant === 'portrait-2k' ? 2000 : 1125,
        objectKey: `backgrounds/v1/${definition.surface}/${id}/${variant}.webp`,
        revisionId,
        sha256: 'test-sha256',
        variant,
        width: variant === 'portrait-2k' ? 1125 : 2000,
      })
    }
    main.assets.set(id, {
      id,
      revisionId,
      status: 'active',
      surface: definition.surface,
      variants,
      version: 1,
    })
  }
  const bucket = new FakeBucket(main)
  const jam = new FakeJamWorker()
  main.users.set('alice', {
    email: 'alice@example.test',
    emailVerified: 1,
  })
  return {
    bucket,
    env: {
      BACKGROUND_CAPABILITY_SECRET: CAPABILITY_SECRET,
      DB: main as unknown as D1Database,
      JAM_WORKER: jam,
      PERKS_DB: perks as unknown as D1Database,
      PREMIUM_BACKGROUNDS_BUCKET: bucket as unknown as R2Bucket,
    } as Env,
    jam,
    main,
    perks,
  }
}

async function issueCapability(
  f: Fixture,
  backgroundId: BackgroundPerkId = 'golden-stage',
  roomId = ROOM_ID,
  nowMs = Date.now(),
) {
  const asset = f.main.assets.get(backgroundId)
  if (asset === undefined) throw new Error('Missing fake background asset')
  const capabilityId = workerCrypto.randomUUID()
  const capability = await mintBackgroundCapability(
    {
      backgroundId,
      capabilityId,
      roomId,
      version: asset.version,
    },
    CAPABILITY_SECRET,
    nowMs,
  )
  f.main.capabilities.set(capabilityId, {
    backgroundId,
    expiresAt: capability.expiresAt,
    id: capabilityId,
    issuedAt: new Date(Math.floor(nowMs / 1000) * 1000).toISOString(),
    issuerUserId: ALICE.userId,
    revisionId: asset.revisionId,
    revokedAt: null,
    roomId,
    version: asset.version,
  })
  f.main.supporterExpiry.set(ALICE.userId, '2099-01-01T00:00:00.000Z')
  return capability
}

async function call(
  env: Env,
  path: string,
  auth: AuthUser | null,
  method = 'GET',
  init: { body?: object; headers?: Record<string, string> } = {},
): Promise<Response> {
  const request = new Request(`https://api.test${path}`, {
    method,
    headers: {
      ...(init.body === undefined
        ? {}
        : { 'Content-Type': 'application/json' }),
      ...init.headers,
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  })
  return callRequest(env, request, auth)
}

async function callRequest(
  env: Env,
  request: Request,
  auth: AuthUser | null,
): Promise<Response> {
  const response = await handlePremiumBackgroundRequest(
    request,
    env,
    new URL(request.url),
    auth,
    CORS,
  )
  if (response === null) throw new Error('Expected premium route to be handled')
  return response
}

function chunkedRequest(
  path: string,
  chunks: readonly string[],
  contentLength?: string,
): { cancelled: () => boolean; request: Request } {
  const encoder = new TextEncoder()
  let cancelled = false
  let index = 0
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (index === chunks.length) {
        controller.close()
        return
      }
      controller.enqueue(encoder.encode(chunks[index]))
      index += 1
    },
    cancel() {
      cancelled = true
    },
  })
  const headers = new Headers({ 'Content-Type': 'application/json' })
  if (contentLength !== undefined) headers.set('Content-Length', contentLength)
  const request = new Request(`https://api.test${path}`, {
    body,
    headers,
    method: 'POST',
    duplex: 'half',
  } as RequestInit)
  return { cancelled: () => cancelled, request }
}

describe('premium background catalog boundary', () => {
  it('matches the server Jam delegation boundary to client surface metadata', () => {
    for (const id of BACKGROUND_PERK_IDS) {
      const definition = getBackgroundDefinition(id)
      expect(definition).not.toBeNull()
      expect(isJamPremiumBackgroundId(id)).toBe(definition?.surface === 'jam')
    }
  })

  it('returns only shipped public metadata and never exposes private R2 keys', async () => {
    const f = fixture()
    f.main.assets.get('aurora-stage')!.status = 'retired'
    f.main.assets.get('golden-stage')!.variants.delete('portrait-2k')

    const response = await call(f.env, '/api/premium-backgrounds/catalog', null)

    expect(response.status).toBe(200)
    const result = (await response.json()) as {
      assets: Array<Record<string, unknown>>
    }
    expect(result.assets).toHaveLength(BACKGROUND_PERK_IDS.length - 2)
    expect(result.assets.some((asset) => asset.id === 'aurora-stage')).toBe(
      false,
    )
    expect(result.assets.some((asset) => asset.id === 'golden-stage')).toBe(
      false,
    )
    expect(JSON.stringify(result)).not.toContain('objectKey')
    expect(JSON.stringify(result)).not.toContain('backgrounds/v1/')
  })
})

describe('GET /api/premium-backgrounds/:id', () => {
  it('rejects an unauthenticated request before reading D1 or R2', async () => {
    const f = fixture()
    const response = await call(
      f.env,
      '/api/premium-backgrounds/golden-stage',
      null,
    )

    expect(response.status).toBe(401)
    expect(f.main.reads).toBe(0)
    expect(f.perks.reads).toBe(0)
    expect(f.bucket.reads).toEqual([])
  })

  it('rejects a signed-in user with neither an active supporter grant nor a perk', async () => {
    const f = fixture()
    const response = await call(
      f.env,
      '/api/premium-backgrounds/golden-stage',
      ALICE,
    )

    expect(response.status).toBe(403)
    expect(f.bucket.reads).toEqual([])
  })

  it('serves the allowlisted R2 object to an active supporter', async () => {
    const f = fixture()
    f.main.supporterExpiry.set('alice', '2099-01-01T00:00:00.000Z')
    const key = 'backgrounds/v1/karaoke/aurora-stage/landscape-4k.webp'
    f.bucket.objects.set(key, new TextEncoder().encode('private-webp'))

    const response = await call(
      f.env,
      '/api/premium-backgrounds/aurora-stage?variant=landscape-4k',
      ALICE,
    )

    expect(response.status).toBe(200)
    expect(await response.text()).toBe('private-webp')
    expect(f.bucket.reads).toEqual([key])
    expect(f.perks.reads).toBe(1)
    expect(response.headers.get('Content-Type')).toBe('image/webp')
    expect(response.headers.get('Cache-Control')).toBe('private, no-store')
    expect(response.headers.get('Vary')).toBe(
      'Authorization, Origin, X-Jam-Background-Capability, X-Jam-Room-Id',
    )
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff')
  })

  it('serves an exact published Piano revision to an active supporter', async () => {
    const f = fixture()
    f.main.supporterExpiry.set('alice', '2099-01-01T00:00:00.000Z')
    const key = 'backgrounds/v1/piano/piano-aurora-loft/portrait-2k.webp'
    f.bucket.objects.set(key, new TextEncoder().encode('piano-room-webp'))

    const response = await call(
      f.env,
      '/api/premium-backgrounds/piano-aurora-loft?variant=portrait-2k&version=1',
      ALICE,
    )

    expect(response.status).toBe(200)
    expect(await response.text()).toBe('piano-room-webp')
    expect(f.bucket.reads).toEqual([key])
    expect(response.headers.get('Cache-Control')).toBe('private, no-store')
  })

  it('fails closed when a stored Piano asset claims another surface', async () => {
    const f = fixture()
    f.main.supporterExpiry.set('alice', '2099-01-01T00:00:00.000Z')
    f.main.assets.get('piano-aurora-loft')!.surface = 'jam'

    const catalog = await call(f.env, '/api/premium-backgrounds/catalog', ALICE)
    const catalogJson = (await catalog.json()) as {
      assets: Array<{ id: string }>
    }
    const image = await call(
      f.env,
      '/api/premium-backgrounds/piano-aurora-loft?version=1',
      ALICE,
    )

    expect(
      catalogJson.assets.some((asset) => asset.id === 'piano-aurora-loft'),
    ).toBe(false)
    expect(image.status).toBe(404)
    expect(f.bucket.reads).toEqual([])
  })

  it('serves one background through its matching permanent perk grant', async () => {
    const f = fixture()
    f.perks.grants.set('alice@example.test', ['mercury-archive'])
    const key = 'backgrounds/v1/jam/mercury-archive/portrait-2k.webp'
    f.bucket.objects.set(key, new TextEncoder().encode('archive-webp'))

    const response = await call(
      f.env,
      '/api/premium-backgrounds/mercury-archive?variant=portrait-2k',
      ALICE,
    )

    expect(response.status).toBe(200)
    expect(await response.text()).toBe('archive-webp')
    expect(f.bucket.reads).toEqual([key])
  })

  it('serves one background through an active verified-email group grant', async () => {
    const f = fixture()
    f.main.manualGrants.set('alice@example.test', ['mercury-archive'])
    const key = 'backgrounds/v1/jam/mercury-archive/landscape-2k.webp'
    f.bucket.objects.set(key, new TextEncoder().encode('group-webp'))

    const response = await call(
      f.env,
      '/api/premium-backgrounds/mercury-archive',
      ALICE,
    )

    expect(response.status).toBe(200)
    expect(await response.text()).toBe('group-webp')
    expect(f.bucket.reads).toEqual([key])
  })

  it('does not let an unverified account claim an email-keyed perk', async () => {
    const f = fixture()
    f.main.users.set('alice', {
      email: 'alice@example.test',
      emailVerified: 0,
    })
    f.perks.grants.set('alice@example.test', ['mercury-archive'])

    const response = await call(
      f.env,
      '/api/premium-backgrounds/mercury-archive',
      ALICE,
    )

    expect(response.status).toBe(403)
    expect(f.perks.reads).toBe(0)
    expect(f.bucket.reads).toEqual([])
  })

  it('does not let one permanent perk grant unlock a different background', async () => {
    const f = fixture()
    f.perks.grants.set('alice@example.test', ['golden-stage'])

    const response = await call(
      f.env,
      '/api/premium-backgrounds/aurora-loft',
      ALICE,
    )

    expect(response.status).toBe(403)
    expect(f.bucket.reads).toEqual([])
  })

  it('treats an expired supporter entitlement as unauthorized', async () => {
    const f = fixture()
    f.main.supporterExpiry.set('alice', '2000-01-01T00:00:00.000Z')

    const response = await call(
      f.env,
      '/api/premium-backgrounds/aurora-loft',
      ALICE,
    )

    expect(response.status).toBe(403)
    expect(f.bucket.reads).toEqual([])
  })

  it.each(['not-a-date', '2099'])(
    'fails closed when a supporter expiry is malformed: %s',
    async (expiresAt) => {
      const f = fixture()
      f.main.supporterExpiry.set('alice', expiresAt)

      const response = await call(
        f.env,
        '/api/premium-backgrounds/aurora-loft',
        ALICE,
      )

      expect(response.status).toBe(403)
      expect(f.bucket.reads).toEqual([])
    },
  )

  it('rejects an unknown id before authorization or bucket access', async () => {
    const f = fixture()
    const response = await call(
      f.env,
      '/api/premium-backgrounds/not-a-background',
      ALICE,
    )

    expect(response.status).toBe(404)
    expect(f.main.reads).toBe(0)
    expect(f.bucket.reads).toEqual([])
  })

  it('rejects retired and stale revisions before reading R2', async () => {
    const f = fixture()
    f.main.supporterExpiry.set('alice', '2099-01-01T00:00:00.000Z')
    f.main.assets.get('golden-stage')!.status = 'retired'

    const retired = await call(
      f.env,
      '/api/premium-backgrounds/golden-stage?version=1',
      ALICE,
    )
    f.main.assets.get('golden-stage')!.status = 'active'
    f.main.assets.get('golden-stage')!.version = 2
    const stale = await call(
      f.env,
      '/api/premium-backgrounds/golden-stage?version=1',
      ALICE,
    )

    expect(retired.status).toBe(404)
    expect(stale.status).toBe(404)
    expect(f.bucket.reads).toEqual([])
  })

  it('rejects path and variant traversal without constructing an R2 key', async () => {
    const f = fixture()
    const pathResponse = await call(
      f.env,
      '/api/premium-backgrounds/golden-stage%2F..%2Fsecret',
      ALICE,
    )
    const variantResponse = await call(
      f.env,
      '/api/premium-backgrounds/golden-stage?variant=..%2Fsecret',
      ALICE,
    )

    expect(pathResponse.status).toBe(404)
    expect(variantResponse.status).toBe(404)
    expect(f.main.reads).toBe(0)
    expect(f.bucket.reads).toEqual([])
  })

  it('does not accept state-changing methods', async () => {
    const f = fixture()
    const response = await call(
      f.env,
      '/api/premium-backgrounds/golden-stage',
      ALICE,
      'POST',
    )

    expect(response.status).toBe(405)
    expect(response.headers.get('Allow')).toBe('GET, HEAD')
    expect(f.main.reads).toBe(0)
    expect(f.bucket.reads).toEqual([])
  })
})

describe('Jam Room premium background capabilities', () => {
  it('mints a short-lived capability only after entitlement and Jam host proof', async () => {
    const f = fixture()
    f.main.supporterExpiry.set('alice', '2099-01-01T00:00:00.000Z')
    f.main.capabilities.set('expired-record', {
      backgroundId: 'golden-stage',
      expiresAt: '2000-01-01T00:05:00.000Z',
      id: 'expired-record',
      issuedAt: '2000-01-01T00:00:00.000Z',
      issuerUserId: ALICE.userId,
      revisionId: 'revision-golden-stage',
      revokedAt: null,
      roomId: ROOM_ID,
      version: 1,
    })

    const response = await call(
      f.env,
      '/api/premium-backgrounds/golden-stage/capability',
      ALICE,
      'POST',
      { body: { ownerToken: OWNER_TOKEN, roomId: ROOM_ID } },
    )

    expect(response.status).toBe(200)
    const result = (await response.json()) as {
      backgroundId: string
      expiresAt: string
      roomId: string
      token: string
      version: number
    }
    expect(result.backgroundId).toBe('golden-stage')
    expect(result.roomId).toBe(ROOM_ID)
    expect(result.version).toBe(1)
    expect(result.token).toMatch(/^mpbg2\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/)
    const ttl = Date.parse(result.expiresAt) - Date.now()
    expect(ttl).toBeGreaterThan((BACKGROUND_CAPABILITY_TTL_SECONDS - 2) * 1000)
    expect(ttl).toBeLessThanOrEqual(BACKGROUND_CAPABILITY_TTL_SECONDS * 1000)
    expect(f.jam.calls).toEqual([
      {
        ownerToken: OWNER_TOKEN,
        roomId: ROOM_ID,
      },
    ])
    expect(f.main.capabilities.size).toBe(1)
    expect(f.main.capabilities.has('expired-record')).toBe(false)
    expect(f.main.writes).toBe(3)
  })

  it('rejects capability minting by a non-host', async () => {
    const f = fixture()
    f.main.supporterExpiry.set('alice', '2099-01-01T00:00:00.000Z')
    f.jam.verified = false

    const response = await call(
      f.env,
      '/api/premium-backgrounds/golden-stage/capability',
      ALICE,
      'POST',
      { body: { ownerToken: OWNER_TOKEN, roomId: ROOM_ID } },
    )

    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({ error: 'Host proof rejected' })
    expect(f.jam.calls).toHaveLength(1)
  })

  it('rejects an oversized chunked proof with no content length', async () => {
    const f = fixture()
    f.main.supporterExpiry.set('alice', '2099-01-01T00:00:00.000Z')
    const payload = JSON.stringify({
      ownerToken: OWNER_TOKEN,
      roomId: ROOM_ID,
    }).padEnd(700, ' ')
    const streamed = chunkedRequest(
      '/api/premium-backgrounds/golden-stage/capability',
      [payload.slice(0, 300), payload.slice(300, 513), payload.slice(513)],
    )

    expect(streamed.request.headers.get('Content-Length')).toBeNull()
    const response = await callRequest(f.env, streamed.request, ALICE)

    expect(response.status).toBe(400)
    expect(f.jam.calls).toEqual([])
  })

  it('bounds an oversized multibyte proof with an invalid content length', async () => {
    const f = fixture()
    f.main.supporterExpiry.set('alice', '2099-01-01T00:00:00.000Z')
    const payload = `"${'é'.repeat(350)}"`
    const streamed = chunkedRequest(
      '/api/premium-backgrounds/golden-stage/capability',
      [payload.slice(0, 200), payload.slice(200, 300), payload.slice(300)],
      'invalid',
    )

    expect(streamed.request.headers.get('Content-Length')).toBe('invalid')
    const response = await callRequest(f.env, streamed.request, ALICE)

    expect(response.status).toBe(400)
    expect(f.jam.calls).toEqual([])
  })

  it('rate-limits capability minting per authenticated user before further entitlement or Jam RPC work', async () => {
    const f = fixture()
    f.main.supporterExpiry.set('alice', '2099-01-01T00:00:00.000Z')
    const path = '/api/premium-backgrounds/golden-stage/capability'
    const init = { body: { ownerToken: OWNER_TOKEN, roomId: ROOM_ID } }

    for (let attempt = 0; attempt < 30; attempt++) {
      const response = await call(f.env, path, ALICE, 'POST', init)
      expect(response.status).toBe(200)
    }
    const entitlementReadsBeforeLimit = f.main.reads
    const limited = await call(f.env, path, ALICE, 'POST', init)

    expect(limited.status).toBe(429)
    expect(limited.headers.get('Retry-After')).toBe('60')
    expect(await limited.json()).toEqual({
      error: 'Too many requests. Retry after 60 seconds.',
    })
    expect(f.jam.calls).toHaveLength(30)
    // The rejected request performs only the atomic rate-limit check; it does
    // not repeat the entitlement query or cross-Worker owner proof.
    expect(f.main.reads).toBe(entitlementReadsBeforeLimit + 1)
  })

  it('rejects unauthenticated minting before D1 or the Jam Worker is touched', async () => {
    const f = fixture()

    const response = await call(
      f.env,
      '/api/premium-backgrounds/golden-stage/capability',
      null,
      'POST',
      { body: { ownerToken: OWNER_TOKEN, roomId: ROOM_ID } },
    )

    expect(response.status).toBe(401)
    expect(f.main.reads).toBe(0)
    expect(f.jam.calls).toEqual([])
  })

  it.each(['aurora-stage', 'piano-aurora-loft'] as const)(
    'does not delegate the non-Jam background %s into a Jam Room',
    async (backgroundId) => {
      const f = fixture()
      f.main.supporterExpiry.set('alice', '2099-01-01T00:00:00.000Z')

      const response = await call(
        f.env,
        `/api/premium-backgrounds/${backgroundId}/capability`,
        ALICE,
        'POST',
        { body: { ownerToken: OWNER_TOKEN, roomId: ROOM_ID } },
      )

      expect(response.status).toBe(404)
      expect(f.main.reads).toBe(0)
      expect(f.jam.calls).toEqual([])
    },
  )

  it('rejects a Piano capability scope before signing', async () => {
    await expect(
      mintBackgroundCapability(
        {
          backgroundId: 'piano-aurora-loft',
          capabilityId: workerCrypto.randomUUID(),
          roomId: ROOM_ID,
          version: 1,
        },
        CAPABILITY_SECRET,
      ),
    ).rejects.toThrow('Invalid background capability scope')
  })

  it('does not honor Jam guest credentials for a Piano background', async () => {
    const f = fixture()
    const capability = await issueCapability(f)

    const response = await call(
      f.env,
      '/api/premium-backgrounds/piano-aurora-loft?version=1',
      null,
      'GET',
      {
        headers: {
          'X-Jam-Background-Capability': capability.token,
          'X-Jam-Room-Id': ROOM_ID,
        },
      },
    )

    expect(response.status).toBe(403)
    expect(f.bucket.reads).toEqual([])
  })

  it('serves the selected Jam background to a guest with a matching capability', async () => {
    const f = fixture()
    const key = 'backgrounds/v1/jam/golden-stage/landscape-2k.webp'
    f.bucket.objects.set(key, new TextEncoder().encode('shared-room-webp'))
    const capability = await issueCapability(f)

    const response = await call(
      f.env,
      '/api/premium-backgrounds/golden-stage?version=1',
      null,
      'GET',
      {
        headers: {
          'X-Jam-Background-Capability': capability.token,
          'X-Jam-Room-Id': ROOM_ID,
        },
      },
    )

    expect(response.status).toBe(200)
    expect(await response.text()).toBe('shared-room-webp')
    expect(f.perks.reads).toBe(1)
    expect(f.bucket.reads).toEqual([key])
  })

  it('requires a guest to request the exact capability version', async () => {
    const f = fixture()
    const capability = await issueCapability(f)

    const response = await call(
      f.env,
      '/api/premium-backgrounds/golden-stage',
      null,
      'GET',
      {
        headers: {
          'X-Jam-Background-Capability': capability.token,
          'X-Jam-Room-Id': ROOM_ID,
        },
      },
    )

    expect(response.status).toBe(403)
    expect(f.main.reads).toBe(0)
    expect(f.bucket.reads).toEqual([])
  })

  it('rejects a revoked stored capability before reading R2', async () => {
    const f = fixture()
    const capability = await issueCapability(f)
    const row = [...f.main.capabilities.values()][0]!
    row.revokedAt = new Date().toISOString()

    const response = await call(
      f.env,
      '/api/premium-backgrounds/golden-stage?version=1',
      null,
      'GET',
      {
        headers: {
          'X-Jam-Background-Capability': capability.token,
          'X-Jam-Room-Id': ROOM_ID,
        },
      },
    )

    expect(response.status).toBe(403)
    expect(f.bucket.reads).toEqual([])
  })

  it('rechecks the capability issuer access before every R2 read', async () => {
    const f = fixture()
    const capability = await issueCapability(f)
    f.main.supporterExpiry.set(ALICE.userId, '2000-01-01T00:00:00.000Z')

    const response = await call(
      f.env,
      '/api/premium-backgrounds/golden-stage?version=1',
      null,
      'GET',
      {
        headers: {
          'X-Jam-Background-Capability': capability.token,
          'X-Jam-Room-Id': ROOM_ID,
        },
      },
    )

    expect(response.status).toBe(403)
    expect(f.bucket.reads).toEqual([])
  })

  it('rate-limits authenticated background reads by user before R2', async () => {
    const f = fixture()
    f.main.supporterExpiry.set('alice', '2099-01-01T00:00:00.000Z')
    const key = 'backgrounds/v1/jam/golden-stage/landscape-2k.webp'
    f.bucket.objects.set(key, new TextEncoder().encode('private-webp'))

    for (let attempt = 0; attempt < 120; attempt++) {
      const response = await call(
        f.env,
        '/api/premium-backgrounds/golden-stage',
        ALICE,
        'GET',
        {
          headers: {
            'CF-Connecting-IP': `203.0.113.${(attempt % 200) + 1}`,
          },
        },
      )
      expect(response.status).toBe(200)
    }

    const limited = await call(
      f.env,
      '/api/premium-backgrounds/golden-stage',
      ALICE,
      'GET',
      { headers: { 'CF-Connecting-IP': '198.51.100.1' } },
    )

    expect(limited.status).toBe(429)
    expect(limited.headers.get('Retry-After')).toBe('60')
    expect(f.bucket.reads).toHaveLength(120)
  })

  it('rate-limits guest capability reads by IP before R2', async () => {
    const f = fixture()
    const key = 'backgrounds/v1/jam/golden-stage/landscape-2k.webp'
    f.bucket.objects.set(key, new TextEncoder().encode('shared-room-webp'))
    const capability = await issueCapability(f)
    const headers = {
      'CF-Connecting-IP': '203.0.113.8',
      'X-Jam-Background-Capability': capability.token,
      'X-Jam-Room-Id': ROOM_ID,
    }

    for (let attempt = 0; attempt < 120; attempt++) {
      const response = await call(
        f.env,
        '/api/premium-backgrounds/golden-stage?version=1',
        null,
        'GET',
        { headers },
      )
      expect(response.status).toBe(200)
    }

    const limited = await call(
      f.env,
      '/api/premium-backgrounds/golden-stage?version=1',
      null,
      'GET',
      { headers },
    )

    expect(limited.status).toBe(429)
    expect(limited.headers.get('Retry-After')).toBe('60')
    expect(f.bucket.reads).toHaveLength(120)
  })

  it.each([
    ['another room', 'golden-stage', 'ABCDEFGJ', false],
    ['another background', 'aurora-loft', ROOM_ID, false],
    ['tampered token', 'golden-stage', ROOM_ID, true],
  ])(
    'rejects a capability scoped to %s before R2',
    async (_caseName, requestedId, requestedRoom, tamper) => {
      const f = fixture()
      const capability = await issueCapability(f)
      const tokenParts = capability.token.split('.')
      if (tamper) {
        tokenParts[2] = `${tokenParts[2].startsWith('A') ? 'B' : 'A'}${tokenParts[2].slice(1)}`
      }
      const token = tokenParts.join('.')

      const response = await call(
        f.env,
        `/api/premium-backgrounds/${requestedId}?version=1`,
        null,
        'GET',
        {
          headers: {
            'X-Jam-Background-Capability': token,
            'X-Jam-Room-Id': requestedRoom,
          },
        },
      )

      expect(response.status).toBe(403)
      expect(f.bucket.reads).toEqual([])
    },
  )

  it('rejects an expired room capability before R2', async () => {
    const f = fixture()
    const capability = await issueCapability(
      f,
      'golden-stage',
      ROOM_ID,
      Date.now() - (BACKGROUND_CAPABILITY_TTL_SECONDS + 1) * 1000,
    )

    const response = await call(
      f.env,
      '/api/premium-backgrounds/golden-stage?version=1',
      null,
      'GET',
      {
        headers: {
          'X-Jam-Background-Capability': capability.token,
          'X-Jam-Room-Id': ROOM_ID,
        },
      },
    )

    expect(response.status).toBe(403)
    expect(f.bucket.reads).toEqual([])
  })

  it('fails closed when the capability secret or Jam service binding is unavailable', async () => {
    const f = fixture()
    f.main.supporterExpiry.set('alice', '2099-01-01T00:00:00.000Z')
    delete f.env.BACKGROUND_CAPABILITY_SECRET

    const noSecret = await call(
      f.env,
      '/api/premium-backgrounds/golden-stage/capability',
      ALICE,
      'POST',
      { body: { ownerToken: OWNER_TOKEN, roomId: ROOM_ID } },
    )
    expect(noSecret.status).toBe(503)
    expect(f.jam.calls).toEqual([])

    f.env.BACKGROUND_CAPABILITY_SECRET = CAPABILITY_SECRET
    delete f.env.JAM_WORKER
    const noJamBinding = await call(
      f.env,
      '/api/premium-backgrounds/golden-stage/capability',
      ALICE,
      'POST',
      { body: { ownerToken: OWNER_TOKEN, roomId: ROOM_ID } },
    )
    expect(noJamBinding.status).toBe(503)
  })
})
