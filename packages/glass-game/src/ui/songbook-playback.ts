// Songbook playback — one lazy audition at a time, cancelled on navigation or backgrounding.
import { fetchAssetBytes } from '@irchiinnuss/mobile-runtime/asset-fetch'
import { reportAudioAssetFailure } from '../browser/audio-asset-failure'
import type { MusicalMemoryPlayback } from '../core/musical-memory'

export interface SongbookPlaybackState {
  assetId: string | null
  phase: 'idle' | 'loading' | 'playing' | 'error'
}

export function createSongbookPlayback(options: {
  player: MusicalMemoryPlayback
  assetUrl(id: string): string
  onChange(state: SongbookPlaybackState): void
  load?(url: string, signal: AbortSignal): Promise<Blob>
}) {
  let generation = 0
  let disposed = false
  let pending: AbortController | undefined
  const load =
    options.load ??
    (async (url, signal) => {
      const bytes = await fetchAssetBytes(url, { signal })
      if (bytes.byteLength > 1_000_000)
        throw new Error('Song exceeds its delivery budget.')
      return new Blob([bytes], { type: 'audio/mpeg' })
    })

  function stop(): void {
    generation++
    pending?.abort()
    pending = undefined
    void options.player.stop()
    if (!disposed) options.onChange({ assetId: null, phase: 'idle' })
  }
  return {
    play(assetId: string): void {
      if (disposed) return
      pending?.abort()
      const run = ++generation
      const abort = new AbortController()
      pending = abort
      options.onChange({ assetId, phase: 'loading' })
      // Invoke play in the click gesture: it unlocks device audio before awaiting bytes.
      let ended = false
      let outcome: boolean | undefined
      const audio = Promise.resolve().then(() =>
        load(options.assetUrl(assetId), abort.signal),
      )
      void options.player
        .play(audio, () => {
          if (run !== generation || disposed) return
          ended = true
          if (outcome === true) {
            pending = undefined
            options.onChange({ assetId: null, phase: 'idle' })
          }
        })
        .then(
          (started) => {
            if (run !== generation || disposed) return
            outcome = started
            if (!started) {
              abort.abort()
              reportAudioAssetFailure(
                'songbook',
                new Error('The audition could not start.'),
              )
            }
            pending = undefined
            options.onChange(
              started && ended
                ? { assetId: null, phase: 'idle' }
                : { assetId, phase: started ? 'playing' : 'error' },
            )
          },
          (error: unknown) => {
            if (run === generation && !disposed) {
              outcome = false
              abort.abort()
              reportAudioAssetFailure('songbook', error)
              pending = undefined
              options.onChange({ assetId, phase: 'error' })
            }
          },
        )
    },
    stop,
    dispose(): void {
      disposed = true
      stop()
      options.player.dispose()
    },
  }
}
