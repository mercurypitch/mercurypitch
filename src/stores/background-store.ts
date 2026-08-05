// ============================================================
// Premium background store — account-safe shipped catalog and access evidence
// ============================================================
//
// Access is memory-only and server-evidenced. Authentication changes clear it
// synchronously before a new request starts; visibility, expiry and a bounded
// timer refresh it so revocation does not require a page reload.

import type { Accessor } from 'solid-js'
import { createComputed, createRoot, createSignal } from 'solid-js'
import { authVersion } from '@/db/services/user-service'
import type { BackgroundPerkId } from '@/lib/backgrounds/background-catalog'
import type { PremiumBackgroundAsset, PremiumBackgroundCatalogResponse, } from '@/lib/backgrounds/background-runtime'
import { BackgroundRequestError, fetchPremiumBackgroundCatalog, } from '@/lib/backgrounds/background-runtime'

const REFRESH_INTERVAL_MS = 5 * 60 * 1000
const VISIBLE_STALE_MS = 60 * 1000
const EXPIRY_SKEW_MS = 1000
const MIN_REFRESH_DELAY_MS = 1000

export interface PremiumBackgroundCatalogState {
  assets: readonly PremiumBackgroundAsset[]
  unlockedIds: readonly BackgroundPerkId[]
  authenticated: boolean
  activeSupporter: boolean
  accessExpiresAt: number | null
  loading: boolean
  ready: boolean
  lastCheckedAt: number | null
  error: string | null
  revision: number
}

const EMPTY_STATE: PremiumBackgroundCatalogState = {
  assets: [],
  unlockedIds: [],
  authenticated: false,
  activeSupporter: false,
  accessExpiresAt: null,
  loading: false,
  ready: false,
  lastCheckedAt: null,
  error: null,
  revision: 0,
}

export interface PremiumBackgroundCatalogStore {
  state: Accessor<PremiumBackgroundCatalogState>
  retain: () => () => void
  refresh: () => Promise<void>
  invalidate: (id?: BackgroundPerkId, status?: number) => void
  assetById: (id: BackgroundPerkId) => PremiumBackgroundAsset | null
  dispose: () => void
}

export interface PremiumBackgroundCatalogStoreOptions {
  authRevision?: Accessor<unknown>
  fetchCatalog?: (
    signal: AbortSignal,
  ) => Promise<PremiumBackgroundCatalogResponse | null>
  now?: () => number
  document?: Document
  setTimer?: typeof setTimeout
  clearTimer?: typeof clearTimeout
}

function parseExpiry(value: string | null): number | null {
  if (value === null) return null
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : null
}

function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

export function createPremiumBackgroundCatalogStore(
  options: PremiumBackgroundCatalogStoreOptions = {},
): PremiumBackgroundCatalogStore {
  return createRoot((disposeRoot) => {
    const now = options.now ?? Date.now
    const fetchCatalog =
      options.fetchCatalog ??
      ((signal: AbortSignal) => fetchPremiumBackgroundCatalog({ signal }))
    const documentTarget =
      options.document ??
      (typeof document === 'undefined' ? undefined : document)
    const setTimer = options.setTimer ?? setTimeout
    const clearTimer = options.clearTimer ?? clearTimeout
    const [state, setState] =
      createSignal<PremiumBackgroundCatalogState>(EMPTY_STATE)

    let retainCount = 0
    let authEpoch = 0
    let refreshSerial = 0
    let activeRequest: AbortController | null = null
    let refreshTimer: ReturnType<typeof setTimeout> | null = null
    let lastAuthRevision = (options.authRevision ?? authVersion)()

    const cancelTimer = () => {
      if (refreshTimer !== null) {
        clearTimer(refreshTimer)
        refreshTimer = null
      }
    }

    const scheduleRefresh = () => {
      cancelTimer()
      if (retainCount === 0) return

      const current = state()
      const untilPeriodic = REFRESH_INTERVAL_MS
      const untilExpiry =
        current.accessExpiresAt === null
          ? untilPeriodic
          : Math.max(
              MIN_REFRESH_DELAY_MS,
              current.accessExpiresAt - now() + EXPIRY_SKEW_MS,
            )
      const delay = Math.min(untilPeriodic, untilExpiry)
      refreshTimer = setTimer(() => {
        refreshTimer = null
        void refresh()
      }, delay)
    }

    const clearAccess = (clearAssets: boolean) => {
      const previous = state()
      setState({
        ...EMPTY_STATE,
        assets: clearAssets ? [] : previous.assets,
        ready: previous.ready,
        revision: previous.revision + 1,
      })
    }

    const resetForAccountChange = () => {
      authEpoch += 1
      refreshSerial += 1
      activeRequest?.abort()
      activeRequest = null
      cancelTimer()
      clearAccess(true)
      if (retainCount > 0) queueMicrotask(() => void refresh())
    }

    createComputed(() => {
      const next = (options.authRevision ?? authVersion)()
      if (Object.is(next, lastAuthRevision)) return
      lastAuthRevision = next
      resetForAccountChange()
    })

    async function refresh(): Promise<void> {
      if (retainCount === 0) return
      const epoch = authEpoch
      const serial = ++refreshSerial
      activeRequest?.abort()
      const request = new AbortController()
      activeRequest = request
      setState((previous) => ({ ...previous, loading: true, error: null }))

      try {
        const result = await fetchCatalog(request.signal)
        if (
          request.signal.aborted ||
          epoch !== authEpoch ||
          serial !== refreshSerial
        ) {
          return
        }
        const checkedAt = now()
        if (result === null) {
          const previous = state()
          setState({
            ...previous,
            unlockedIds: [],
            authenticated: false,
            activeSupporter: false,
            accessExpiresAt: null,
            loading: false,
            ready: true,
            lastCheckedAt: checkedAt,
            error: 'Premium stages are unavailable offline.',
            revision: previous.revision + 1,
          })
        } else {
          const previous = state()
          setState({
            assets: result.assets,
            unlockedIds: result.access.backgroundIds,
            authenticated: result.access.authenticated,
            activeSupporter: result.access.activeSupporter,
            accessExpiresAt: parseExpiry(result.access.expiresAt),
            loading: false,
            ready: true,
            lastCheckedAt: checkedAt,
            error: null,
            revision: previous.revision + 1,
          })
        }
      } catch (error) {
        if (isAbort(error) || epoch !== authEpoch || serial !== refreshSerial) {
          return
        }
        const previous = state()
        setState({
          ...previous,
          unlockedIds: [],
          authenticated: false,
          activeSupporter: false,
          accessExpiresAt: null,
          loading: false,
          ready: true,
          lastCheckedAt: now(),
          error:
            error instanceof BackgroundRequestError
              ? error.message
              : 'Premium stages could not be checked.',
          revision: previous.revision + 1,
        })
      } finally {
        if (serial === refreshSerial) activeRequest = null
        scheduleRefresh()
      }
    }

    const handleVisibility = () => {
      if (documentTarget?.visibilityState !== 'visible') return
      const checkedAt = state().lastCheckedAt
      if (checkedAt === null || now() - checkedAt >= VISIBLE_STALE_MS) {
        void refresh()
      }
    }

    const retain = () => {
      retainCount += 1
      if (retainCount === 1) {
        documentTarget?.addEventListener('visibilitychange', handleVisibility)
        void refresh()
      }
      let released = false
      // The returned disposer is installed by the caller's Solid lifecycle;
      // it is deliberately not a reactive computation of its own.
      // eslint-disable-next-line solid/reactivity
      return () => {
        if (released) return
        released = true
        retainCount = Math.max(0, retainCount - 1)
        if (retainCount !== 0) return
        documentTarget?.removeEventListener(
          'visibilitychange',
          handleVisibility,
        )
        cancelTimer()
        refreshSerial += 1
        activeRequest?.abort()
        activeRequest = null
      }
    }

    const invalidate = (id?: BackgroundPerkId, status?: number) => {
      refreshSerial += 1
      activeRequest?.abort()
      activeRequest = null
      const previous = state()
      const removeAsset = id !== undefined && (status === 404 || status === 410)
      const clearAll = id === undefined || status === 401
      setState({
        ...previous,
        assets: removeAsset
          ? previous.assets.filter((asset) => asset.id !== id)
          : previous.assets,
        unlockedIds: clearAll
          ? []
          : previous.unlockedIds.filter((unlockedId) => unlockedId !== id),
        authenticated: clearAll ? false : previous.authenticated,
        activeSupporter: clearAll ? false : previous.activeSupporter,
        accessExpiresAt: clearAll ? null : previous.accessExpiresAt,
        loading: false,
        error: 'Stage access changed. Choose another backdrop.',
        revision: previous.revision + 1,
      })
      scheduleRefresh()
    }

    return {
      state,
      retain,
      refresh,
      invalidate,
      assetById: (id) =>
        state().assets.find((asset) => asset.id === id) ?? null,
      dispose: () => {
        retainCount = 0
        documentTarget?.removeEventListener(
          'visibilitychange',
          handleVisibility,
        )
        cancelTimer()
        activeRequest?.abort()
        disposeRoot()
      },
    }
  })
}

export const premiumBackgroundCatalogStore =
  createPremiumBackgroundCatalogStore()
export const premiumBackgroundCatalogState = premiumBackgroundCatalogStore.state

export function retainPremiumBackgroundCatalog(): () => void {
  return premiumBackgroundCatalogStore.retain()
}

export function refreshPremiumBackgroundCatalog(): Promise<void> {
  return premiumBackgroundCatalogStore.refresh()
}

export function invalidatePremiumBackgroundAccess(
  id?: BackgroundPerkId,
  status?: number,
): void {
  premiumBackgroundCatalogStore.invalidate(id, status)
}
