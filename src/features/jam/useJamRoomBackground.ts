// ============================================================
// Jam room background controller — shared host selection and protected bytes
// ============================================================
//
// A Jam background is room state, not a personal preference. Free selections
// resolve immediately; premium bytes arrive either through the host's account
// or the short-lived room capability that host shares over WebRTC. New images
// decode before replacing the current one so a refresh never flashes blank.

import type { Accessor, JSX } from 'solid-js'
import { createComputed, createMemo, createSignal, onCleanup, onMount, untrack, } from 'solid-js'
import { deterministicFreeJamBackground } from '@/lib/backgrounds/background-access'
import type { PublicBackgroundSource } from '@/lib/backgrounds/background-catalog'
import { defaultBackground } from '@/lib/backgrounds/background-catalog'
import { BackgroundRequestError, loadProtectedBackgroundObjectUrl, } from '@/lib/backgrounds/background-runtime'
import type { ResolvedBackground } from '@/lib/backgrounds/background-surface'
import { runtimeBackgroundById } from '@/lib/backgrounds/background-surface'
import { jamCapabilityExpiryMs, mayRenderJamPremiumBackground, } from '@/lib/jam/background-session'
import { invalidatePremiumBackgroundAccess, premiumBackgroundCatalogState, retainPremiumBackgroundCatalog, } from '@/stores/background-store'
import { jamIsHost, jamRoomBackground, jamRoomBackgroundCapability, jamRoomId, } from '@/stores/jam-store'

export type JamRoomBackgroundStyle = JSX.CSSProperties & {
  '--mp-stage-image': string
  '--mp-stage-position': string
}

export interface JamRoomBackgroundController {
  resolved: Accessor<ResolvedBackground>
  style: Accessor<JamRoomBackgroundStyle>
  loading: Accessor<boolean>
  error: Accessor<string | null>
}

function publicUrl(source: PublicBackgroundSource): string {
  return typeof window !== 'undefined' &&
    window.devicePixelRatio >= 1.5 &&
    source.landscape2x !== undefined
    ? source.landscape2x
    : source.landscape
}

function resolveFreeFallback(useRoomHash: boolean): ResolvedBackground {
  const definition = useRoomHash
    ? deterministicFreeJamBackground(jamRoomId())
    : defaultBackground('jam')
  if (definition.assetSource.kind !== 'public') {
    throw new Error('The Jam fallback background must be public.')
  }
  return {
    id: definition.id,
    url: publicUrl(definition.assetSource),
    focalPoint: definition.focalPoint,
    source: 'public',
    version: null,
  }
}

function isAuthorizationFailure(error: BackgroundRequestError): boolean {
  return [401, 403, 404, 410].includes(error.status)
}

/** Retained for the lifetime of JamPage. */
export function useJamRoomBackground(): JamRoomBackgroundController {
  const initial = resolveFreeFallback(true)
  const [resolved, setResolved] = createSignal(initial)
  const [loading, setLoading] = createSignal(false)
  const [error, setError] = createSignal<string | null>(null)

  let generation = 0
  let request: AbortController | null = null
  let expiryTimer: ReturnType<typeof setTimeout> | null = null

  const clearExpiryTimer = () => {
    if (expiryTimer === null) return
    clearTimeout(expiryTimer)
    expiryTimer = null
  }

  const swap = (next: ResolvedBackground) => {
    const previous = resolved()
    setResolved(next)
    if (previous.source === 'protected' && previous.url !== next.url) {
      URL.revokeObjectURL(previous.url)
    }
  }

  const fallback = (useRoomHash: boolean) => {
    request?.abort()
    request = null
    generation += 1
    setLoading(false)
    const next = resolveFreeFallback(useRoomHash)
    const current = resolved()
    if (
      current.id !== next.id ||
      current.url !== next.url ||
      current.source !== next.source
    ) {
      swap(next)
    }
  }

  onMount(() => {
    const releaseCatalog = retainPremiumBackgroundCatalog()
    onCleanup(releaseCatalog)
  })

  createComputed(() => {
    const catalogState = premiumBackgroundCatalogState()
    const selected = jamRoomBackground()
    const capability = jamRoomBackgroundCapability()
    const host = jamIsHost()
    clearExpiryTimer()

    if (selected === null) {
      setError(null)
      fallback(true)
      return
    }

    const option = runtimeBackgroundById(
      'jam',
      selected.backgroundId,
      catalogState,
    )
    if (option === null) {
      setError('This room stage is no longer available.')
      fallback(false)
      return
    }

    if (option.publicUrl !== null) {
      request?.abort()
      request = null
      generation += 1
      setLoading(false)
      setError(null)
      const current = resolved()
      if (current.id !== option.id || current.url !== option.publicUrl) {
        swap({
          id: option.id,
          url: option.publicUrl,
          focalPoint: option.focalPoint,
          source: 'public',
          version: null,
        })
      }
      return
    }

    const asset = option.premiumAsset
    const guestCapability =
      !host && capability?.backgroundId === option.id ? capability : null
    if (
      asset === null ||
      !mayRenderJamPremiumBackground({
        access: option.access,
        hasGuestCapability: guestCapability !== null,
        isHost: host,
      })
    ) {
      setError(
        host && option.access !== 'unlocked'
          ? 'This room stage is no longer unlocked.'
          : null,
      )
      fallback(false)
      return
    }

    if (guestCapability !== null) {
      const expiresAt = jamCapabilityExpiryMs(guestCapability)
      if (expiresAt === null || expiresAt <= Date.now()) {
        setError(
          'The room stage pass expired. Waiting for the host to refresh it.',
        )
        fallback(false)
        return
      }
      expiryTimer = setTimeout(() => {
        expiryTimer = null
        setError(
          'The room stage pass expired. Waiting for the host to refresh it.',
        )
        fallback(false)
      }, expiresAt - Date.now())
    }

    const version = guestCapability?.version ?? asset.activeVersion
    const backgroundId = asset.id
    const focalPoint = option.focalPoint
    const invalidateForHost = host
    const current = resolved()
    if (
      current.id === asset.id &&
      current.source === 'protected' &&
      current.version === version
    ) {
      setLoading(false)
      setError(null)
      return
    }

    request?.abort()
    const nextRequest = new AbortController()
    request = nextRequest
    const currentGeneration = ++generation
    setLoading(true)
    setError(null)
    void loadProtectedBackgroundObjectUrl(asset, {
      variant: 'landscape-2k',
      version,
      ...(guestCapability === null
        ? {}
        : {
            capability: guestCapability.token,
            roomId: jamRoomId() ?? undefined,
          }),
      signal: nextRequest.signal,
    })
      .then((url) =>
        untrack(() => {
          if (nextRequest.signal.aborted || currentGeneration !== generation) {
            URL.revokeObjectURL(url)
            return
          }
          request = null
          swap({
            id: backgroundId,
            url,
            focalPoint,
            source: 'protected',
            version,
          })
          setLoading(false)
          setError(null)
        }),
      )
      .catch((loadError: unknown) =>
        untrack(() => {
          if (nextRequest.signal.aborted || currentGeneration !== generation) {
            return
          }
          request = null
          setLoading(false)
          if (
            loadError instanceof BackgroundRequestError &&
            isAuthorizationFailure(loadError)
          ) {
            if (
              invalidateForHost ||
              loadError.status === 404 ||
              loadError.status === 410
            ) {
              invalidatePremiumBackgroundAccess(backgroundId, loadError.status)
            }
          }
          setError(
            loadError instanceof BackgroundRequestError
              ? loadError.message
              : 'The room stage could not be opened.',
          )
          fallback(false)
        }),
      )
  })

  const style = createMemo<JamRoomBackgroundStyle>(() => {
    const current = resolved()
    const x = `${Math.round(current.focalPoint.x * 10000) / 100}%`
    const y = `${Math.round(current.focalPoint.y * 10000) / 100}%`
    return {
      '--mp-stage-image': `url(${JSON.stringify(current.url)})`,
      '--mp-stage-position': `${x} ${y}`,
    }
  })

  onCleanup(() => {
    clearExpiryTimer()
    request?.abort()
    const current = resolved()
    if (current.source === 'protected') URL.revokeObjectURL(current.url)
  })

  return {
    resolved,
    style,
    loading,
    error,
  }
}
