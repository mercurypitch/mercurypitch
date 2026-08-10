// ============================================================
// Background surface controller — one resolved image for every performance view
// ============================================================
//
// A controller owns the selected private object URL and exposes stable CSS
// variables to every renderer. Global controllers are reference-counted so
// desktop, standalone and portalled views share one decoded URL instead of
// fetching and flashing independently.

import type { Accessor, JSX } from 'solid-js'
import { createComputed, createMemo, createRoot, createSignal, onCleanup, onMount, } from 'solid-js'
import type { BackgroundDefinition, BackgroundId, BackgroundPerkId, BackgroundSurface, BackgroundTreatment, PublicBackgroundSource, } from './background-catalog'
import { defaultBackground, getBackgroundDefinition, listBackgrounds, } from './background-catalog'
import type { PremiumBackgroundCatalogState, PremiumBackgroundCatalogStore, } from './background-catalog-store'
import { premiumBackgroundCatalogState, premiumBackgroundCatalogStore, } from './background-catalog-store'
import type { PremiumBackgroundAsset, PremiumBackgroundVariantName, ProtectedBackgroundRequest, } from './background-runtime'
import { BackgroundRequestError, loadProtectedBackgroundObjectUrl, } from './background-runtime'
import type { BackgroundSelectionStorage } from './background-selection'
import { persistBackgroundId, readPersistedBackgroundId, } from './background-selection'

export type RuntimeBackgroundAccess = 'free' | 'unlocked' | 'locked'

export interface RuntimeBackgroundOption {
  id: BackgroundId
  surface: BackgroundSurface
  label: string
  description: string
  edition: BackgroundDefinition['edition']
  focalPoint: BackgroundDefinition['focalPoint']
  treatment: BackgroundTreatment
  access: RuntimeBackgroundAccess
  publicUrl: string | null
  premiumAsset: PremiumBackgroundAsset | null
}

export interface ResolvedBackground {
  id: BackgroundId
  url: string
  focalPoint: BackgroundDefinition['focalPoint']
  treatment: BackgroundTreatment
  source: 'public' | 'protected'
  version: number | null
  variant: PremiumBackgroundVariantName | null
}

export type BackgroundOrientation = 'landscape' | 'portrait'

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
  invalidateAccess: (id: BackgroundPerkId, status?: number) => void
  retain: () => () => void
  dispose: () => void
}

export interface BackgroundSurfaceControllerOptions {
  catalogStore?: PremiumBackgroundCatalogStore
  storage?: BackgroundSelectionStorage | null
  pixelRatio?: () => number
  orientation?: () => BackgroundOrientation
  loadProtected?: (
    asset: PremiumBackgroundAsset,
    request?: ProtectedBackgroundRequest,
  ) => Promise<string>
  revokeObjectURL?: (url: string) => void
}

function publicBackgroundUrl(
  source: PublicBackgroundSource,
  pixelRatio: number,
  orientation: BackgroundOrientation,
): string {
  if (orientation === 'portrait' && source.portrait !== undefined) {
    return pixelRatio >= 1.5 && source.portrait2x !== undefined
      ? source.portrait2x
      : source.portrait
  }
  return pixelRatio >= 1.5 && source.landscape2x !== undefined
    ? source.landscape2x
    : source.landscape
}

function browserOrientation(): BackgroundOrientation {
  if (typeof window === 'undefined') return 'landscape'
  return window.innerHeight > window.innerWidth ? 'portrait' : 'landscape'
}

function premiumVariant(
  asset: PremiumBackgroundAsset,
  pixelRatio: number,
  orientation: BackgroundOrientation,
): PremiumBackgroundVariantName {
  const available = new Set(asset.variants.map((variant) => variant.name))
  const preferred: readonly PremiumBackgroundVariantName[] =
    orientation === 'portrait'
      ? ['portrait-2k', 'landscape-2k', 'landscape-4k']
      : pixelRatio >= 1.5
        ? ['landscape-4k', 'landscape-2k', 'portrait-2k']
        : ['landscape-2k', 'landscape-4k', 'portrait-2k']
  return (
    preferred.find((variant) => available.has(variant)) ??
    asset.variants[0].name
  )
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
  orientation: BackgroundOrientation = browserOrientation(),
): readonly RuntimeBackgroundOption[] {
  const free = listBackgrounds(surface)
    .filter(isPublicFreeBackground)
    .map((background) => ({
      id: background.id,
      surface,
      label: background.label,
      description: background.description ?? descriptionFor(background),
      edition: background.edition,
      focalPoint: background.focalPoint,
      treatment: background.treatment ?? 'dark',
      access: 'free' as const,
      publicUrl: publicBackgroundUrl(
        background.assetSource,
        pixelRatio,
        orientation,
      ),
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
        treatment: background.treatment ?? 'dark',
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
  orientation: BackgroundOrientation,
): ResolvedBackground {
  const background = defaultBackground(surface)
  if (background.assetSource.kind !== 'public') {
    throw new Error(`The ${surface} fallback must be public.`)
  }
  return {
    id: background.id,
    url: publicBackgroundUrl(background.assetSource, pixelRatio, orientation),
    focalPoint: background.focalPoint,
    treatment: background.treatment ?? 'dark',
    source: 'public',
    version: null,
    variant: null,
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
    const orientation = options.orientation ?? browserOrientation
    const loadProtected =
      options.loadProtected ?? loadProtectedBackgroundObjectUrl
    const revokeObjectURL =
      options.revokeObjectURL ?? ((url: string) => URL.revokeObjectURL(url))
    const stored = readPersistedBackgroundId(surface, options.storage)
    const fallback = freeResolved(surface, pixelRatio(), orientation())
    const [requestedId, setRequestedId] = createSignal<BackgroundId>(
      stored ?? fallback.id,
    )
    const [resolved, setResolved] = createSignal<ResolvedBackground>(fallback)
    let currentResolved = fallback
    const [loading, setLoading] = createSignal(false)
    const [error, setError] = createSignal<string | null>(null)
    const [active, setActive] = createSignal(false)
    const [viewportRevision, setViewportRevision] = createSignal(0)

    let retainCount = 0
    let releaseCatalog: (() => void) | null = null
    let loadGeneration = 0
    let activeLoad: AbortController | null = null
    let activeLoadTarget: {
      id: BackgroundPerkId
      version: number
      variant: PremiumBackgroundVariantName
    } | null = null

    const optionsList = createMemo(() => {
      viewportRevision()
      return listRuntimeBackgrounds(
        surface,
        catalogStore.state(),
        pixelRatio(),
        orientation(),
      )
    })

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
      activeLoadTarget = null
      loadGeneration += 1
      setLoading(false)
      const next = freeResolved(surface, pixelRatio(), orientation())
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
        setError(
          choice?.access === 'locked'
            ? `This ${surface === 'karaoke' ? 'stage' : 'room'} is locked.`
            : null,
        )
        useFallback()
        return
      }
      if (choice.access === 'free' && choice.publicUrl !== null) {
        activeLoad?.abort()
        activeLoad = null
        activeLoadTarget = null
        loadGeneration += 1
        setLoading(false)
        setError(null)
        const current = currentResolved
        if (current.id !== choice.id || current.url !== choice.publicUrl) {
          swapResolved({
            id: choice.id,
            url: choice.publicUrl,
            focalPoint: choice.focalPoint,
            treatment: choice.treatment,
            source: 'public',
            version: null,
            variant: null,
          })
        }
        return
      }

      const asset = choice.premiumAsset
      if (asset === null) {
        useFallback()
        return
      }
      const variant = premiumVariant(asset, pixelRatio(), orientation())
      const current = currentResolved
      if (
        current.id === asset.id &&
        current.source === 'protected' &&
        current.version === asset.activeVersion &&
        current.variant === variant
      ) {
        setLoading(false)
        setError(null)
        return
      }
      if (
        activeLoad !== null &&
        activeLoadTarget?.id === asset.id &&
        activeLoadTarget.version === asset.activeVersion &&
        activeLoadTarget.variant === variant
      ) {
        return
      }

      activeLoad?.abort()
      const request = new AbortController()
      activeLoad = request
      activeLoadTarget = {
        id: asset.id,
        version: asset.activeVersion,
        variant,
      }
      const generation = ++loadGeneration
      setLoading(true)
      setError(null)
      void loadProtected(asset, {
        variant,
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
            treatment: choice.treatment,
            source: 'protected',
            version: asset.activeVersion,
            variant,
          })
          activeLoad = null
          activeLoadTarget = null
          setLoading(false)
          setError(null)
        })
        .catch((loadError: unknown) => {
          if (request.signal.aborted || generation !== loadGeneration) return
          activeLoad = null
          activeLoadTarget = null
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
              : `That ${surface === 'karaoke' ? 'stage' : 'room'} image could not be opened.`,
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
        setViewportRevision((revision) => revision + 1)
        if (typeof window !== 'undefined') {
          window.addEventListener('resize', handleViewportChange)
        }
        setActive(true)
      }
      let released = false
      return () => {
        if (released) return
        released = true
        retainCount = Math.max(0, retainCount - 1)
        if (retainCount !== 0) return
        setActive(false)
        if (typeof window !== 'undefined') {
          window.removeEventListener('resize', handleViewportChange)
        }
        releaseCatalog?.()
        releaseCatalog = null
      }
    }

    const handleViewportChange = () => {
      setViewportRevision((revision) => revision + 1)
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
      invalidateAccess: catalogStore.invalidate,
      retain,
      dispose: () => {
        retainCount = 0
        releaseCatalog?.()
        releaseCatalog = null
        activeLoad?.abort()
        activeLoad = null
        activeLoadTarget = null
        if (typeof window !== 'undefined') {
          window.removeEventListener('resize', handleViewportChange)
        }
        releaseResolvedUrl(currentResolved)
        disposeRoot()
      },
    }
  })
}

const SURFACE_CONTROLLERS = {
  karaoke: createBackgroundSurfaceController('karaoke'),
  jam: createBackgroundSurfaceController('jam'),
  piano: createBackgroundSurfaceController('piano'),
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
