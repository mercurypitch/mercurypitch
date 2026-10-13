// ============================================================
// Hybrid Adapter Tests — cloud/local entity routing
// ============================================================

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CLOUD_ENTITIES, HybridAdapter } from '@/db/adapters/hybrid-adapter'
import { ServerAdapter } from '@/db/adapters/server-adapter'
import type { DatabaseAdapter, DbEntity, QueryOptions, Repository, } from '@/db/types'

afterEach(() => vi.unstubAllGlobals())

function stubAdapter(): DatabaseAdapter & { seen: string[] } {
  const seen: string[] = []
  const adapter: DatabaseAdapter & { seen: string[] } = {
    seen,
    schemaVersion: 1,
    getRepository<T extends DbEntity>(entityName: string): Repository<T> {
      seen.push(entityName)
      return {} as Repository<T>
    },
    transaction: vi.fn(async (fn) => fn(adapter)),
    destroy: vi.fn(async () => undefined),
  }
  return adapter
}

describe('HybridAdapter', () => {
  it('routes cloud entities to the cloud adapter', () => {
    const cloud = stubAdapter()
    const local = stubAdapter()
    const hybrid = new HybridAdapter(cloud, local)

    for (const entity of CLOUD_ENTITIES) {
      hybrid.getRepository(entity)
    }
    expect(cloud.seen).toEqual([...CLOUD_ENTITIES])
    expect(local.seen).toEqual([])
  })

  it('routes karaoke/UVR and library entities to the local adapter', () => {
    const cloud = stubAdapter()
    const local = stubAdapter()
    const hybrid = new HybridAdapter(cloud, local)

    const localEntities = [
      'uvrSessions',
      'uvrStemBlobs',
      'uvrStemFingerprints',
      'uvrSessionLyrics',
      'offlinePitchAnalysis',
      'whisperTranscriptions',
      'sessionGroups',
      'melodyRecords',
      'sessionTemplates',
      'playlistRecords',
      'pianoProjects',
      'pianoProjectMigrations',
      'drumProjects',
      'drumTakeSummaries',
      // The worker's TABLES allowlist no longer exposes this entity (the
      // leaderboard is server-derived from sessionRecords) — it must stay
      // local-only or every access silently 404s against the cloud worker.
      'leaderboardEntries',
    ]
    for (const entity of localEntities) {
      hybrid.getRepository(entity)
    }
    expect(local.seen).toEqual(localEntities)
    expect(cloud.seen).toEqual([])
  })

  it('does not route leaderboardEntries to the cloud', () => {
    expect(CLOUD_ENTITIES.has('leaderboardEntries')).toBe(false)
  })

  it('keeps Piano projects and their migration markers device-local', () => {
    expect(CLOUD_ENTITIES.has('pianoProjects')).toBe(false)
    expect(CLOUD_ENTITIES.has('pianoProjectMigrations')).toBe(false)
  })

  it('keeps Drum projects and scalar take summaries device-local', () => {
    expect(CLOUD_ENTITIES.has('drumProjects')).toBe(false)
    expect(CLOUD_ENTITIES.has('drumTakeSummaries')).toBe(false)
  })

  it('delegates local-only transactions to the local adapter', async () => {
    const cloud = stubAdapter()
    const local = stubAdapter()
    const hybrid = new HybridAdapter(cloud, local)
    const operation = vi.fn(async () => 'saved')

    await expect(hybrid.transactionLocal(operation)).resolves.toBe('saved')
    expect(local.transaction).toHaveBeenCalledOnce()
    expect(cloud.transaction).not.toHaveBeenCalled()
    expect(operation).toHaveBeenCalledWith(local)
  })

  it('destroys both adapters', async () => {
    const cloud = stubAdapter()
    const local = stubAdapter()
    await new HybridAdapter(cloud, local).destroy()
    expect(cloud.destroy).toHaveBeenCalledOnce()
    expect(local.destroy).toHaveBeenCalledOnce()
  })

  it('closes whichever adapters have a connection to close', () => {
    // close() is optional on the contract — the server adapter holds
    // nothing open. The hybrid must close what is there and skip the rest,
    // because a missed close leaves the factory reset's deleteDatabase
    // waiting on the connection forever.
    const cloud = stubAdapter() // no close() — the server-adapter shape
    const local = stubAdapter()
    const localClose = vi.fn()
    local.close = localClose
    expect(() => {
      new HybridAdapter(cloud, local).close()
    }).not.toThrow()
    expect(localClose).toHaveBeenCalledOnce()
  })

  describe('signed-out guard for user-scoped entities', () => {
    function trackingAdapter(): DatabaseAdapter & { calls: string[] } {
      const calls: string[] = []
      const repo: Repository<DbEntity> = {
        findById: async (id) => {
          calls.push(`findById:${id}`)
          return { id, createdAt: '', updatedAt: '' }
        },
        findAll: async () => {
          calls.push('findAll')
          return [{ id: 'r1', createdAt: '', updatedAt: '' }]
        },
        count: async () => {
          calls.push('count')
          return 1
        },
        create: async (e) => {
          calls.push('create')
          return { ...e, id: 'new', createdAt: '', updatedAt: '' } as DbEntity
        },
        update: async (id) => {
          calls.push('update')
          return { id, createdAt: '', updatedAt: '' }
        },
        delete: async () => {
          calls.push('delete')
        },
      }
      const adapter: DatabaseAdapter & { calls: string[] } = {
        calls,
        schemaVersion: 1,
        getRepository: <T extends DbEntity>() => repo as Repository<T>,
        transaction: vi.fn(async (fn) => fn(adapter)),
        destroy: vi.fn(async () => undefined),
      }
      return adapter
    }

    it('resolves reads empty without network when signed out', async () => {
      const cloud = trackingAdapter()
      const hybrid = new HybridAdapter(cloud, stubAdapter(), () => false)
      const repo = hybrid.getRepository('challengeProgress')

      expect(await repo.findAll()).toEqual([])
      expect(await repo.findById('x')).toBeNull()
      expect(await repo.count()).toBe(0)
      expect(cloud.calls).toEqual([])
    })

    it('rejects writes without network when provisioning is refused', async () => {
      const cloud = trackingAdapter()
      const hybrid = new HybridAdapter(
        cloud,
        stubAdapter(),
        () => false,
        () => Promise.resolve(false),
      )
      const repo = hybrid.getRepository('sessionRecords')

      await expect(repo.create({})).rejects.toThrow(/Signed out/)
      await expect(repo.update('x', {})).rejects.toThrow(/Signed out/)
      await expect(repo.delete('x')).rejects.toThrow(/Signed out/)
      expect(cloud.calls).toEqual([])
    })

    // The regression this guards is the whole reason writes provision at all.
    // Startup stopped minting an identity eagerly this release (restoreAuth,
    // not ensureAuth), so a first-time visitor reaches their first write with
    // no token. The guard used to throw here, which meant the ServerAdapter's
    // `beforeWrite: requireAuth` hook — the only lazy mint point on the
    // practice path — could never run. `saveSessionRecord` swallows the throw,
    // so every session, streak and badge a new user earned was discarded in
    // silence, forever. Local mode never reproduces it: DexieAdapter is
    // unguarded, which is why the suite stayed green while prod would not have
    // saved a thing.
    it('provisions on a write instead of failing when never signed in', async () => {
      const cloud = trackingAdapter()
      let minted = 0
      let authed = false
      const hybrid = new HybridAdapter(
        cloud,
        stubAdapter(),
        () => authed,
        async () => {
          minted += 1
          authed = true
          return true
        },
      )
      const repo = hybrid.getRepository('sessionRecords')

      await repo.create({})
      expect(minted).toBe(1)
      expect(cloud.calls).toEqual(['create'])

      // Provisioned once, then it is a plain sync check — no second mint.
      await repo.update('x', {})
      expect(minted).toBe(1)
      expect(cloud.calls).toEqual(['create', 'update'])
    })

    it('does not pass an old operation through after provisioning changes accounts', async () => {
      const cloud = trackingAdapter()
      let identity = 'singer-a'
      let releaseProvisioning = (_allowed: boolean): void => undefined
      const hybrid = new HybridAdapter(
        cloud,
        stubAdapter(),
        () => false,
        () =>
          new Promise<boolean>((resolve) => {
            releaseProvisioning = resolve
          }),
        () => identity,
      )
      const repo = hybrid.getRepository('sessionRecords')

      const writing = repo.create({})
      identity = 'singer-b'
      releaseProvisioning(true)

      await expect(writing).rejects.toThrow(/write identity changed/)
      expect(cloud.calls).toEqual([])
    })

    it('never provisions on a read — browsing leaves no server-side row', async () => {
      const cloud = trackingAdapter()
      let minted = 0
      const hybrid = new HybridAdapter(
        cloud,
        stubAdapter(),
        () => false,
        async () => {
          minted += 1
          return true
        },
      )
      const repo = hybrid.getRepository('sessionRecords')

      expect(await repo.findAll()).toEqual([])
      expect(await repo.findById('x')).toBeNull()
      expect(await repo.count()).toBe(0)
      expect(minted).toBe(0)
      expect(cloud.calls).toEqual([])
    })

    it('passes through when signed in', async () => {
      const cloud = trackingAdapter()
      const hybrid = new HybridAdapter(cloud, stubAdapter(), () => true)
      const repo = hybrid.getRepository('challengeProgress')

      expect(await repo.findAll()).toHaveLength(1)
      await repo.create({})
      expect(cloud.calls).toEqual(['findAll', 'create'])
    })

    it('leaves public cloud entities unguarded when signed out', async () => {
      const cloud = trackingAdapter()
      const hybrid = new HybridAdapter(cloud, stubAdapter(), () => false)
      const repo = hybrid.getRepository('challengeDefinitions')

      expect(await repo.findAll()).toHaveLength(1)
      expect(cloud.calls).toEqual(['findAll'])
    })
  })
})

// ── Reading all of a singer's own rows ───────────────────────────
// The worker answers a list one page at a time. A read with no limit means
// every row (the Dexie half's answer), and the sync code depends on it: a
// library past one page re-created a song the account already had, the
// UNIQUE index refused, and the whole publish stopped.

describe('a user-scoped read with no limit', () => {
  function pagedCloud(
    total: number,
    failAtOffset?: number,
  ): DatabaseAdapter & { asked: Array<QueryOptions<DbEntity> | undefined> } {
    const asked: Array<QueryOptions<DbEntity> | undefined> = []
    const repo = {
      findAll: async (opts?: QueryOptions<DbEntity>) => {
        asked.push(opts)
        const offset = opts?.offset ?? 0
        if (offset === failAtOffset) throw new Error('page failed')
        const size = Math.max(0, Math.min(opts?.limit ?? 100, total - offset))
        return Array.from({ length: size }, (_, i) => ({
          id: `r${offset + i}`,
          createdAt: '',
          updatedAt: '',
        }))
      },
    } as unknown as Repository<DbEntity>
    const adapter: DatabaseAdapter & {
      asked: Array<QueryOptions<DbEntity> | undefined>
    } = {
      asked,
      schemaVersion: 1,
      getRepository: <T extends DbEntity>() => repo as Repository<T>,
      transaction: vi.fn(async (fn) => fn(adapter)),
      destroy: vi.fn(async () => undefined),
    }
    return adapter
  }

  it('reads every page until a short one', async () => {
    const cloud = pagedCloud(2005)
    const repo = new HybridAdapter(
      cloud,
      stubAdapter(),
      () => true,
    ).getRepository('songManifests')

    const rows = await repo.findAll({ where: { userId: 'me' } })

    expect(rows).toHaveLength(2005)
    expect(new Set(rows.map((r) => r.id)).size).toBe(2005)
    expect(cloud.asked.map((o) => [o?.limit, o?.offset])).toEqual([
      [1000, 0],
      [1000, 1000],
      [1000, 2000],
    ])
    expect(cloud.asked.every((opts) => opts?.where?.userId === 'me')).toBe(true)
  })

  it('continues from the requested offset and preserves sorting on each page', async () => {
    const cloud = pagedCloud(2020)
    const repo = new HybridAdapter(
      cloud,
      stubAdapter(),
      () => true,
    ).getRepository('songManifests')

    const rows = await repo.findAll({
      offset: 20,
      orderBy: 'createdAt',
      orderDir: 'desc',
    })

    expect(rows.map((row) => row.id)).toEqual(
      Array.from({ length: 2000 }, (_, index) => `r${index + 20}`),
    )
    // An exact multiple needs an empty terminal page; otherwise rows beyond
    // a full second page would silently disappear.
    expect(cloud.asked).toEqual(
      [20, 1020, 2020].map((offset) => ({
        offset,
        orderBy: 'createdAt',
        orderDir: 'desc',
        limit: 1000,
        throwOnError: true,
      })),
    )
  })

  it('asks once when the caller gave a limit', async () => {
    const cloud = pagedCloud(2005)
    const repo = new HybridAdapter(
      cloud,
      stubAdapter(),
      () => true,
    ).getRepository('sessionRecords')

    expect(await repo.findAll({ limit: 20, offset: 5 })).toHaveLength(20)
    expect(cloud.asked).toEqual([{ limit: 20, offset: 5 }])
  })

  it('answers nothing rather than part when a later page fails', async () => {
    const cloud = pagedCloud(2005, 1000)
    const repo = new HybridAdapter(
      cloud,
      stubAdapter(),
      () => true,
    ).getRepository('userSettings')

    // A partial list would read as "the account has nothing else".
    expect(await repo.findAll()).toEqual([])
    await expect(repo.findAll({ throwOnError: true })).rejects.toThrow(
      'page failed',
    )
  })

  it.each(['sharedMelodies', 'sharedSessions'])(
    'keeps public %s queries to one page while signed out',
    async (entity) => {
      const cloud = pagedCloud(2005)
      const repo = new HybridAdapter(
        cloud,
        stubAdapter(),
        () => false,
      ).getRepository(entity)

      expect(await repo.findAll({ where: { isPublic: true } })).toHaveLength(
        100,
      )
      expect(cloud.asked).toEqual([{ where: { isPublic: true } }])
    },
  )

  it.each([false, true])(
    'fails the whole HTTP read after a later page fails (strict=%s)',
    async (strict) => {
      const firstPage = Array.from({ length: 1000 }, (_, index) => ({
        id: `r${index}`,
      }))
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(new Response(JSON.stringify(firstPage)))
        .mockResolvedValueOnce(
          new Response('page unavailable', { status: 403 }),
        )
      vi.stubGlobal('fetch', fetchMock)
      const cloud = new ServerAdapter({ baseUrl: 'http://api.test' })
      const repo = new HybridAdapter(
        cloud,
        stubAdapter(),
        () => true,
      ).getRepository('songManifests')

      const reading = repo.findAll({ throwOnError: strict })
      if (strict) await expect(reading).rejects.toThrow(/403/)
      else expect(await reading).toEqual([])
      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(
        new URL(String(fetchMock.mock.calls[1]?.[0])).searchParams.get(
          'offset',
        ),
      ).toBe('1000')
    },
  )

  it.each([
    { change: 'switch', pageSize: 1000, strict: false },
    { change: 'sign out', pageSize: 1000, strict: false },
    { change: 'switch', pageSize: 1, strict: true },
    { change: 'sign out', pageSize: 1, strict: true },
  ])(
    'discards pending rows after $change (pageSize=$pageSize, strict=$strict)',
    async ({ change, pageSize, strict }) => {
      let identity = 'singer-a'
      let authed = true
      let releaseResponse: (response: Response) => void = () => undefined
      const fetchMock = vi
        .fn()
        .mockImplementationOnce(
          () =>
            new Promise<Response>((resolve) => {
              releaseResponse = resolve
            }),
        )
        .mockResolvedValue(
          new Response(JSON.stringify([{ id: 'singer-b-row' }])),
        )
      vi.stubGlobal('fetch', fetchMock)
      const cloud = new ServerAdapter({
        baseUrl: 'http://api.test',
        headers: () => ({ Authorization: `Bearer ${identity}` }),
        writeIdentity: () => identity,
      })
      const repo = new HybridAdapter(
        cloud,
        stubAdapter(),
        () => authed,
        async () => false,
        () => identity,
      ).getRepository('songManifests')

      const reading = repo.findAll({ throwOnError: strict })
      if (change === 'switch') identity = 'singer-b'
      else authed = false
      releaseResponse(
        new Response(
          JSON.stringify(
            Array.from({ length: pageSize }, (_, index) => ({
              id: `singer-a-${index}`,
            })),
          ),
        ),
      )

      await expect(reading).rejects.toThrow(/read identity changed/)
      // A new page must not dispatch with the next account's credentials.
      expect(fetchMock).toHaveBeenCalledOnce()
    },
  )
})

// ── Allowlist drift ──────────────────────────────────────────────
// The bug this guards against shipped silently and stayed hidden for
// weeks: `voiceprints` was exposed by the worker but missing from
// CLOUD_ENTITIES, so every cloud call fell through to a Dexie store that
// does not exist, threw, and was swallowed by a catch meant for network
// failures. The gallery kept rendering from localStorage, so nothing
// looked wrong — while dev D1 held zero rows.
//
// Reading the worker's own source keeps this honest: a future entity
// added on one side only fails here instead of in production.

describe('client/worker allowlist agreement', () => {
  const workerTables = (): Set<string> => {
    // The registry is a plain object literal; parse the top-level keys
    // rather than importing worker code into a browser-env test.
    const src = readFileSync(
      resolve(__dirname, '../../workers/db-worker/src/tables.ts'),
      'utf8',
    )
    const body = src.slice(src.indexOf('export const TABLES'))
    return new Set(
      [...body.matchAll(/^ {2}([a-zA-Z]+): \{/gm)].map((m) => m[1]!),
    )
  }

  it('every cloud entity is actually served by the worker', () => {
    const served = workerTables()
    expect(served.size).toBeGreaterThan(10) // the parse itself still works
    const unserved = [...CLOUD_ENTITIES].filter((e) => !served.has(e))
    expect(unserved).toEqual([])
  })

  it('keeps voiceprints routed to the cloud', () => {
    // Named explicitly: this is the entity the drift actually hit, and a
    // silent removal would look like a passing suite again.
    expect(CLOUD_ENTITIES.has('voiceprints')).toBe(true)
    expect(workerTables().has('voiceprints')).toBe(true)
  })
})
