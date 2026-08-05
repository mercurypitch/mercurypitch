// ============================================================
// Background surface controller — one resolved image for every Karaoke/Jam view
// ============================================================
//
// A controller owns the selected private object URL and exposes stable CSS
// variables to every renderer. Global Karaoke and Jam controllers are
// reference-counted so desktop, standalone and portalled Zen views share the
// same decoded URL instead of fetching and flashing independently.

import type { Accessor, JSX } from 'solid-js'
import { createComputed, createMemo, createRoot, createSignal, onCleanup, onMount, } from 'solid-js'
import type { PremiumBackgroundCatalogState, PremiumBackgroundCatalogStore, } from '@/stores/background-store'
import { premiumBackgroundCatalogState, premiumBackgroundCatalogStore, } from '@/stores/background-store'
import type { BackgroundSelectionStorage } from './background-access'
import { persistBackgroundId, readPersistedBackgroundId, } from './background-access'
import type { BackgroundDefinition, BackgroundId, BackgroundSurface, PublicBackgroundSource, } from './background-catalog'
import { defaultBackground, getBackgroundDefinition, listBackgrounds, } from './background-catalog'
import type { PremiumBackgroundAsset, ProtectedBackgroundRequest, } from './background-runtime'
import { BackgroundRequestError, loadProtectedBackgroundObjectUrl, } from './background-runtime'

export type RuntimeBackgroundAccess = 'free' | 'unlocked' | 'locked'

export interface RuntimeBackgroundOption {
  id: BackgroundId
  surface: BackgroundSurface
  label: string
  description: string
  edition: BackgroundDefinition['edition']
  focalPoint: BackgroundDefinition['focalPoint']
  access: RuntimeBackgroundAccess
  publicUrl: string | null
  premiumAsset: PremiumBackgroundAsset | null
}

export interface ResolvedBackground {
  id: BackgroundId
  url: string
  focalPoint: BackgroundDefinition['focalPoint']
  source: 'public' | 'protected'
  version: number | null
}

export type BackgroundCssVariables = JSX.CSSProperties & {
  '--mp-stage-image': string
  '--mp-stage-position-x': string
  '--mp-stage-position-y': string
  '--mp-stage-position': string
}

export interface BackgroundSurfaceController {
  surface: BackgroundSurface
  requestedId: Accessor<BackgroundId>
  resolved: Accessor<ResolvedBackground>
  resolvedStyle: Accessor<BackgroundCssVariables>
  options: Accessor<readonly RuntimeBackgroundOption[]>
  loading: Accessor<boolean>
  error: Accessor<string | null>
  select: (id: BackgroundId) => boolean
  refresh: () => Promise<void>
  retain: () => () => void
  dispose: () => void
}

export interface BackgroundSurfaceControllerOptions {
  catalogStore?: PremiumBackgroundCatalogStore
  storage?: BackgroundSelectionStorage | null
  pixelRatio?: () => number
  loadProtected?: (
    asset: PremiumBackgroundAsset,
    request?: ProtectedBackgroundRequest,
  ) => Promise<string>
  revokeObjectURL?: (url: string) => void
}

function publicBackgroundUrl(
  source: PublicBackgroundSource,
  pixelRatio: number,
): string {
  return pixelRatio >= 1.5 && source.landscape2x !== undefined
    ? source.landscape2x
    : source.landscape
}

function isPublicFreeBackground(
  background: BackgroundDefinition,
): background is BackgroundDefinition & {
  assetSource: PublicBackgroundSource
} {
  return (
    background.access.kind === 'free' &&
    background.assetSource.kind === 'public'
  )
}

function descriptionFor(background: BackgroundDefinition): string {
  switch (background.edition) {
    case 'core':
      return 'Included stage'
    case 'golden-hour':
      return 'Warm spotlight and gilded atmosphere'
    case 'aurora':
      return 'Northern light colour and open air'
    case 'neon-velvet':
      return 'Deep velvet, electric edge lighting'
    case 'midnight-rain':
      return 'After-dark reflections and cinematic rain'
    case 'mercury-archive':
      return 'A Mercury Edition from the private archive'
  }
}

export function listRuntimeBackgrounds(
  surface: BackgroundSurface,
  state: PremiumBackgroundCatalogState = premiumBackgroundCatalogState(),
  pixelRatio: number = typeof window === 'undefined'
    ? 1
    : window.devicePixelRatio,
): readonly RuntimeBackgroundOption[] {
  const free = listBackgrounds(surface)
    .filter(isPublicFreeBackground)
    .map((background) => ({
      id: background.id,
      surface,
      label: background.label,
      description: descriptionFor(background),
      edition: background.edition,
      focalPoint: background.focalPoint,
      access: 'free' as const,
      publicUrl: publicBackgroundUrl(background.assetSource, pixelRatio),
      premiumAsset: null,
    }))

  const unlocked = new Set(state.unlockedIds)
  const premium = state.assets
    .filter((asset) => asset.surface === surface)
    .map((asset): RuntimeBackgroundOption | null => {
      const background = getBackgroundDefinition(asset.id)
      if (background === null || background.surface !== surface) return null
      return {
        id: asset.id,
        surface,
        label: asset.title,
        description:
          asset.description !== ''
            ? asset.description
            : descriptionFor(background),
        edition: background.edition,
        focalPoint: background.focalPoint,
        access: unlocked.has(asset.id) ? 'unlocked' : 'locked',
        publicUrl: null,
        premiumAsset: asset,
      }
    })
    .filter(
      (background): background is RuntimeBackgroundOption =>
        background !== null,
    )

  return [...free, ...premium]
}

export function runtimeBackgroundById(
  surface: BackgroundSurface,
  id: unknown,
  state: PremiumBackgroundCatalogState = premiumBackgroundCatalogState(),
): RuntimeBackgroundOption | null {
  return (
    listRuntimeBackgrounds(surface, state).find(
      (background) => background.id === id,
    ) ?? null
  )
}

function freeResolved(
  surface: BackgroundSurface,
  pixelRatio: number,
): ResolvedBackground {
  const background = defaultBackground(surface)
  if (background.assetSource.kind !== 'public') {
    throw new Error(`The ${surface} fallback must be public.`)
  }
  return {
    id: background.id,
    url: publicBackgroundUrl(background.assetSource, pixelRatio),
    focalPoint: background.focalPoint,
    source: 'public',
    version: null,
  }
}

function cssVariables(background: ResolvedBackground): BackgroundCssVariables {
  const x = `${Math.round(background.focalPoint.x * 10000) / 100}%`
  const y = `${Math.round(background.focalPoint.y * 10000) / 100}%`
  return {
    '--mp-stage-image': `url(${JSON.stringify(background.url)})`,
    '--mp-stage-position-x': x,
    '--mp-stage-position-y': y,
    '--mp-stage-position': `${x} ${y}`,
  }
}

function isAuthorizationFailure(status: number): boolean {
  return status === 401 || status === 403 || status === 404 || status === 410
}

export function createBackgroundSurfaceController(
  surface: BackgroundSurface,
  options: BackgroundSurfaceControllerOptions = {},
): BackgroundSurfaceController {
  return createRoot((disposeRoot) => {
    const catalogStore = options.catalogStore ?? premiumBackgroundCatalogStore
    const pixelRatio =
      options.pixelRatio ??
      (() => (typeof window === 'undefined' ? 1 : window.devicePixelRatio))
    const loadProtected =
      options.loadProtected ?? loadProtectedBackgroundObjectUrl
    const revokeObjectURL =
      options.revokeObjectURL ?? ((url: string) => URL.revokeObjectURL(url))
    const stored = readPersistedBackgroundId(surface, options.storage)
    const fallback = freeResolved(surface, pixelRatio())
    const [requestedId, setRequestedId] = createSignal<BackgroundId>(
      stored ?? fallback.id,
    )
    const [resolved, setResolved] = createSignal<ResolvedBackground>(fallback)
    let currentResolved = fallback
    const [loading, setLoading] = createSignal(false)
    const [error, setError] = createSignal<string | null>(null)
    const [active, setActive] = createSignal(false)

    let retainCount = 0
    let releaseCatalog: (() => void) | null = null
    let loadGeneration = 0
    let activeLoad: AbortController | null = null

    const optionsList = createMemo(() =>
      listRuntimeBackgrounds(surface, catalogStore.state(), pixelRatio()),
    )

    const releaseResolvedUrl = (background: ResolvedBackground) => {
      if (background.source === 'protected') revokeObjectURL(background.url)
    }

    const swapResolved = (next: ResolvedBackground) => {
      const previous = currentResolved
      currentResolved = next
      setResolved(next)
      if (previous.source === 'protected' && previous.url !== next.url) {
        releaseResolvedUrl(previous)
      }
    }

    const useFallback = () => {
      activeLoad?.abort()
      activeLoad = null
      loadGeneration += 1
      setLoading(false)
      const next = freeResolved(surface, pixelRatio())
      if (
        currentResolved.id !== next.id ||
        currentResolved.url !== next.url ||
        currentResolved.source !== 'public'
      ) {
        swapResolved(next)
      }
    }

    createComputed(() => {
      const id = requestedId()
      if (!active()) {
        useFallback()
        return
      }

      const choice = optionsList().find((option) => option.id === id)
      if (choice === undefined || choice.access === 'locked') {
        setError(choice?.access === 'locked' ? 'This stage is locked.' : null)
        useFallback()
        return
      }
      if (choice.access === 'free' && choice.publicUrl !== null) {
        activeLoad?.abort()
        activeLoad = null
        loadGeneration += 1
        setLoading(false)
        setError(null)
        const current = currentResolved
        if (current.id !== choice.id || current.url !== choice.publicUrl) {
          swapResolved({
            id: choice.id,
            url: choice.publicUrl,
            focalPoint: choice.focalPoint,
            source: 'public',
            version: null,
          })
        }
        return
      }

      const asset = choice.premiumAsset
      if (asset === null) {
        useFallback()
        return
      }
      const current = currentResolved
      if (
        current.id === asset.id &&
        current.source === 'protected' &&
        current.version === asset.activeVersion
      ) {
        setLoading(false)
        setError(null)
        return
      }

      activeLoad?.abort()
      const request = new AbortController()
      activeLoad = request
      const generation = ++loadGeneration
      setLoading(true)
      setError(null)
      void loadProtected(asset, {
        variant: 'landscape-2k',
        version: asset.activeVersion,
        signal: request.signal,
      })
        .then((url) => {
          if (
            request.signal.aborted ||
            generation !== loadGeneration ||
            retainCount === 0
          ) {
            revokeObjectURL(url)
            return
          }
          swapResolved({
            id: asset.id,
            url,
            focalPoint: choice.focalPoint,
            source: 'protected',
            version: asset.activeVersion,
          })
          activeLoad = null
          setLoading(false)
          setError(null)
        })
        .catch((loadError: unknown) => {
          if (request.signal.aborted || generation !== loadGeneration) return
          activeLoad = null
          setLoading(false)
          if (
            loadError instanceof BackgroundRequestError &&
            isAuthorizationFailure(loadError.status)
          ) {
            catalogStore.invalidate(asset.id, loadError.status)
          }
          setError(
            loadError instanceof BackgroundRequestError
              ? loadError.message
              : 'That stage image could not be opened.',
          )
          useFallback()
        })
    })

    const select = (id: BackgroundId): boolean => {
      const choice = optionsList().find((option) => option.id === id)
      if (choice === undefined || choice.access === 'locked') return false
      setRequestedId(id)
      persistBackgroundId(surface, id, options.storage)
      return true
    }

    const retain = () => {
      retainCount += 1
      if (retainCount === 1) {
        releaseCatalog = catalogStore.retain()
        setActive(true)
      }
      let released = false
      return () => {
        if (released) return
        released = true
        retainCount = Math.max(0, retainCount - 1)
        if (retainCount !== 0) return
        setActive(false)
        releaseCatalog?.()
        releaseCatalog = null
      }
    }

    const resolvedStyle = createMemo(() => cssVariables(resolved()))

    return {
      surface,
      requestedId,
      resolved,
      resolvedStyle,
      options: optionsList,
      loading,
      error,
      select,
      refresh: catalogStore.refresh,
      retain,
      dispose: () => {
        retainCount = 0
        releaseCatalog?.()
        releaseCatalog = null
        activeLoad?.abort()
        activeLoad = null
        releaseResolvedUrl(currentResolved)
        disposeRoot()
      },
    }
  })
}

const SURFACE_CONTROLLERS = {
  karaoke: createBackgroundSurfaceController('karaoke'),
  jam: createBackgroundSurfaceController('jam'),
} as const satisfies Record<BackgroundSurface, BackgroundSurfaceController>

export function backgroundSurfaceController(
  surface: BackgroundSurface,
): BackgroundSurfaceController {
  return SURFACE_CONTROLLERS[surface]
}

/** Retain the shared controller for exactly the lifetime of a Solid surface. */
export function useBackgroundSurfaceController(
  surface: BackgroundSurface,
): BackgroundSurfaceController {
  const controller = backgroundSurfaceController(surface)
  onMount(() => {
    const release = controller.retain()
    onCleanup(release)
  })
  return controller
}
