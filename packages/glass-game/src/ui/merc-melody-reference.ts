// Merc melody reference — play an exact recorded variant or the compiled guide without changing capture timing.

import { readGlassAssetBlob } from '../asset-response'
import type { MercEncoreAvailability, MercEncoreVariant, } from '../content/encore-examples'
import { mercEncoreAvailability } from '../content/encore-examples'
import type { GlassMelodyId } from '../content/melodies'
import type { CompiledMelody } from '../core/melody-contour'
import type { MelodyReferencePlayer } from '../core/melody-reference'
import type { MusicalMemoryPlayback } from '../core/musical-memory'
import type { GlassGameHost } from '../host'

const MAXIMUM_EXAMPLE_BYTES = 1_000_000
const PROGRESS_INTERVAL_MS = 50
const QUIET_TAIL_MS = 300

type FetchAsset = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>

export interface MercMelodyReferenceFactory {
  availability(contour: CompiledMelody): MercEncoreAvailability
  create(contour: CompiledMelody): MelodyReferencePlayer
  dispose(): void
}

export interface MercMelodyReferenceFactoryOptions {
  fetchAsset?: FetchAsset
  now?: () => number
  onGuideFallback?(availability: MercEncoreAvailability): void
}

export async function loadMercMelodyExample(
  assetUrl: (id: string) => string,
  variant: MercEncoreVariant,
  signal: AbortSignal,
  fetchAsset: FetchAsset = fetch,
): Promise<Blob> {
  const url = assetUrl(variant.assetId)
  const response = await fetchAsset(url, { signal })
  const audio = await readGlassAssetBlob(url, response)
  if (audio.size > MAXIMUM_EXAMPLE_BYTES)
    throw new Error('Merc melody example exceeds its delivery budget.')
  return audio
}

function recordedVariantMatches(
  contour: CompiledMelody,
  variant: MercEncoreVariant,
): boolean {
  return (
    contour.id === variant.melodyId &&
    contour.version === variant.melodyVersion &&
    contour.rootMidi + contour.transposeSemitones === variant.rootMidi &&
    contour.pace === variant.pace
  )
}

function createRecordedReference(
  playback: MusicalMemoryPlayback,
  loadAudio: (signal: AbortSignal) => Promise<Blob>,
  contour: CompiledMelody,
  now: () => number,
): MelodyReferencePlayer {
  const abort = new AbortController()
  let played = false
  let stopped = false
  let finished = false
  let progressTimer: ReturnType<typeof setInterval> | undefined
  let resolveEnded!: () => void
  let resolveStopped!: () => void
  const ended = new Promise<void>((resolve) => {
    resolveEnded = resolve
  })
  const stoppedSignal = new Promise<void>((resolve) => {
    resolveStopped = resolve
  })

  const stop = (): void => {
    if (stopped || finished) return
    stopped = true
    abort.abort()
    clearInterval(progressTimer)
    resolveStopped()
    void playback.stop()
  }

  return {
    async play(onProgress) {
      if (played) throw new Error('A melody reference can only play once.')
      played = true
      let playbackEnded = false
      const started = await playback.play(loadAudio(abort.signal), () => {
        playbackEnded = true
        resolveEnded()
      })
      if (!started || stopped)
        throw new Error('The recorded melody reference could not start.')

      const startedAt = now()
      onProgress?.(0)
      progressTimer = setInterval(() => {
        onProgress?.(
          Math.min(
            contour.durationSeconds,
            Math.max(0, (now() - startedAt) / 1000),
          ),
        )
      }, PROGRESS_INTERVAL_MS)
      const outcome = await Promise.race([
        (playbackEnded ? Promise.resolve() : ended).then(
          () => 'ended' as const,
        ),
        stoppedSignal.then(() => 'stopped' as const),
      ])
      clearInterval(progressTimer)
      if (outcome === 'stopped')
        throw new Error('The recorded melody reference was stopped.')
      onProgress?.(contour.durationSeconds)

      const tail = await Promise.race([
        new Promise<'quiet'>((resolve) => {
          setTimeout(() => resolve('quiet'), QUIET_TAIL_MS)
        }),
        stoppedSignal.then(() => 'stopped' as const),
      ])
      if (tail === 'stopped')
        throw new Error('The recorded melody reference was stopped.')
      finished = true
    },
    stop,
    dispose() {
      stop()
      playback.dispose()
    },
  }
}

function createFallbackReference(
  recorded: MelodyReferencePlayer,
  createGuide: () => MelodyReferencePlayer,
  onFallback: () => void,
): MelodyReferencePlayer {
  let guide: MelodyReferencePlayer | undefined
  let stopped = false
  return {
    async play(onProgress) {
      try {
        await recorded.play(onProgress)
        return
      } catch (cause) {
        recorded.dispose()
        if (stopped) throw cause
      }
      onFallback()
      guide = createGuide()
      await guide.play(onProgress)
    },
    stop() {
      stopped = true
      recorded.stop()
      guide?.stop()
    },
    dispose() {
      stopped = true
      recorded.dispose()
      guide?.dispose()
    },
  }
}

export function createMercMelodyReferenceFactory(
  host: Pick<
    GlassGameHost,
    'assetUrl' | 'createMelodyReference' | 'createMemoryPlayback'
  >,
  options: MercMelodyReferenceFactoryOptions = {},
): MercMelodyReferenceFactory {
  const fetchAsset = options.fetchAsset ?? fetch
  const now = options.now ?? (() => performance.now())
  const players = new Set<MelodyReferencePlayer>()
  const audio = new Map<string, Blob>()
  let disposed = false

  const track = (player: MelodyReferencePlayer): MelodyReferencePlayer => {
    let released = false
    const tracked: MelodyReferencePlayer = {
      play: (onProgress) => player.play(onProgress),
      stop: () => player.stop(),
      dispose() {
        if (released) return
        released = true
        players.delete(tracked)
        player.dispose()
      },
    }
    players.add(tracked)
    return tracked
  }

  const availability = (contour: CompiledMelody): MercEncoreAvailability =>
    mercEncoreAvailability(contour.id as GlassMelodyId, contour)

  const create = (contour: CompiledMelody): MelodyReferencePlayer => {
    if (disposed) throw new Error('Merc melody references are disposed.')
    const available = availability(contour)
    const createGuide = (): MelodyReferencePlayer => {
      const guide = host.createMelodyReference?.(contour)
      if (guide === undefined)
        throw new Error('The exact melody guide is unavailable.')
      return track(guide)
    }
    if (available.kind !== 'voice' || host.createMemoryPlayback === undefined) {
      options.onGuideFallback?.(available)
      return createGuide()
    }
    if (!recordedVariantMatches(contour, available.variant))
      throw new Error('The recorded melody does not match this contour.')

    const playback = host.createMemoryPlayback()
    const recorded = createRecordedReference(
      playback,
      async (signal) => {
        const cached = audio.get(available.variant.assetId)
        if (cached !== undefined) return cached
        const loaded = await loadMercMelodyExample(
          host.assetUrl,
          available.variant,
          signal,
          fetchAsset,
        )
        audio.set(available.variant.assetId, loaded)
        return loaded
      },
      contour,
      now,
    )
    const player = createFallbackReference(recorded, createGuide, () =>
      options.onGuideFallback?.({
        kind: 'guide',
        phrase: available.phrase,
        reason: 'unverified-voice',
      }),
    )
    return track(player)
  }

  return {
    availability,
    create,
    dispose() {
      if (disposed) return
      disposed = true
      for (const player of [...players]) player.dispose()
      players.clear()
      audio.clear()
    },
  }
}
