// ============================================================
// sync-for-account: the plan sent to the account, for a singer who holds one
// ============================================================
//
// R84 and R85: the sync is fetched only once there is an account to send to,
// and that gate is written once. App calls it when a load or a sign-in asks
// for a sync, and the plan's screens call it when a plan is done. These cases
// run the gate (the sync behind it is faked here, and is plan-sync.test.ts's),
// and read the two callers' source, so neither grows a gate of its own.
//
// Whether the sync was loaded is seen by its factory: each case resets the
// module registry and registers the factory again before it imports the gate.

import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as AuthServiceModule from '@/db/services/auth-service'

const mocks = vi.hoisted(() => ({
  upgraded: vi.fn((): boolean => false),
  send: vi.fn(async (): Promise<void> => undefined),
  /** How many times plan-sync.ts was loaded since the registry was reset. */
  loads: 0,
  /** Makes plan-sync.ts fail to load, as a chunk that is gone does. */
  missing: false,
}))

vi.mock('@/db/services/auth-service', async (importOriginal) => ({
  ...(await importOriginal<typeof AuthServiceModule>()),
  hasUpgradedAccount: (): boolean => mocks.upgraded(),
}))

async function syncOfTheCase(): Promise<{
  syncPlanToAccount: () => Promise<void>
}> {
  mocks.loads += 1
  if (mocks.missing) {
    throw new Error('Failed to fetch dynamically imported module')
  }
  return { syncPlanToAccount: mocks.send }
}

/** The gate, from a fresh module registry. */
async function gate(): Promise<() => Promise<void>> {
  vi.resetModules()
  vi.doMock('./plan-sync', syncOfTheCase)
  mocks.loads = 0
  return (await import('./sync-for-account')).syncPlanForAccount
}

let warn = vi.spyOn(console, 'warn')

beforeEach(() => {
  warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  mocks.upgraded.mockReset()
  mocks.upgraded.mockReturnValue(false)
  mocks.send.mockReset()
  mocks.send.mockResolvedValue(undefined)
  mocks.missing = false
})

afterEach(() => {
  vi.doUnmock('./plan-sync')
  vi.restoreAllMocks()
})

describe('the plan, sent for a singer with an account', () => {
  it('loads nothing, and sends nothing, with no account', async () => {
    const sync = await gate()

    await sync()

    expect(mocks.upgraded).toHaveBeenCalledOnce()
    expect(mocks.loads).toBe(0)
    expect(mocks.send).not.toHaveBeenCalled()
    expect(warn).not.toHaveBeenCalled()
  })

  it('loads the sync and sends once with an account', async () => {
    mocks.upgraded.mockReturnValue(true)
    const sync = await gate()

    await sync()

    expect(mocks.loads).toBe(1)
    expect(mocks.send).toHaveBeenCalledOnce()
    expect(warn).not.toHaveBeenCalled()
  })

  it.each<[string, () => void]>([
    [
      'the account check throws',
      () => {
        mocks.upgraded.mockImplementation(() => {
          throw new Error('storage is gone')
        })
      },
    ],
    [
      'the sync cannot be loaded',
      () => {
        mocks.upgraded.mockReturnValue(true)
        mocks.missing = true
      },
    ],
    [
      'the sync rejects',
      () => {
        mocks.upgraded.mockReturnValue(true)
        mocks.send.mockRejectedValue(new Error('offline'))
      },
    ],
  ])(
    'costs one sync, said once, and never rejects, when %s',
    async (_, breakIt) => {
      breakIt()
      const sync = await gate()

      await expect(sync()).resolves.toBeUndefined()

      expect(warn).toHaveBeenCalledOnce()
      expect(warn).toHaveBeenCalledWith(
        '[plan-sync] The plan was not sent to the account:',
        expect.any(Error),
      )
    },
  )
})

// ── Who calls it ───────────────────────────────────────────────────────

/** Every source file under src, tests and fixtures left out. */
function sources(dir = 'src'): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return sources(path)
    return /\.tsx?$/u.test(entry.name) &&
      !/\.(test|spec|fixture)\.tsx?$/u.test(entry.name)
      ? [path]
      : []
  })
}

describe('the one gate', () => {
  it('is the only place in the app that asks for plan-sync', () => {
    const asking = sources().filter((file) =>
      /import\(\s*['"][^'"]*\/plan-sync['"]\s*\)/u.test(
        readFileSync(file, 'utf8'),
      ),
    )

    expect(asking).toEqual(['src/features/plan/sync-for-account.ts'])
  })

  it('is what App syncs with on the web, picked by the build before anything is imported', () => {
    const app = readFileSync('src/App.tsx', 'utf8')
    const start = app.indexOf('const syncPlan')
    const statement = app.slice(start, app.indexOf('\n\n', start))

    expect(statement.replace(/\s+/gu, ' ')).toBe(
      'const syncPlan: () => Promise<void> = IS_NATIVE_BUILD ? async () => undefined : syncPlanForAccount',
    )
  })

  it("is what a finished plan syncs with, and the plan's screens keep no gate of their own", () => {
    const controller = readFileSync(
      'src/features/plan/usePlanFlowController.ts',
      'utf8',
    )

    expect(controller).toMatch(/\bvoid syncPlanForAccount\(\)/u)
    expect(controller).not.toMatch(/hasUpgradedAccount/u)
  })
})
