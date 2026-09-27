// Merc melody reference checks — recorded examples stay exact, cancellable and safely fall back to the guide.

import { afterEach, describe, expect, it, vi } from 'vitest'
import { glassMelody } from '../content/melodies'
import { compileMelody } from '../core/melody-contour'
import type { MelodyReferencePlayer } from '../core/melody-reference'
import type { MusicalMemoryPlayback } from '../core/musical-memory'
import { createMercMelodyReferenceFactory, loadMercMelodyExample, } from './merc-melody-reference'

class PlaybackFake implements MusicalMemoryPlayback {
  onEnded: (() => void) | undefined
  audio: Blob | Promise<Blob> | undefined
  start = true
  stop = vi.fn(async () => {})
  dispose = vi.fn()

  async play(
    audio: Blob | Promise<Blob>,
    onEnded?: () => void,
  ): Promise<boolean> {
    this.audio = audio
    this.onEnded = onEnded
    try {
      await audio
      return this.start
    } catch {
      return false
    }
  }
}

class ReferenceFake implements MelodyReferencePlayer {
  play = vi.fn(async (onProgress?: (seconds: number) => void) => {
    onProgress?.(4.8)
  })
  stop = vi.fn()
  dispose = vi.fn()
}

const contour = compileMelody(glassMelody('sunlit-steps'), {
  rootMidi: 58,
  pace: 1,
})

function response(blob: Blob, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    blob: async () => blob,
  } as Response
}

async function flush(): Promise<void> {
  for (let index = 0; index < 8; index++) await Promise.resolve()
}

afterEach(() => {
  vi.useRealTimers()
})

describe('Merc melody reference', () => {
  it('accepts readable bundled audio and rejects oversized examples', async () => {
    const variant = {
      melodyId: 'sunlit-steps' as const,
      words: 'Tiny sparks can glow',
      melodyVersion: 1,
      assetId: 'merc-example',
      assetPath: 'example.mp3',
      rootMidi: 58,
      pace: 1,
    }
    const signal = new AbortController().signal

    const bundled = await loadMercMelodyExample(
      () => 'capacitor://example.mp3',
      variant,
      signal,
      vi.fn(async () => response(new Blob(['audio']), 0)),
    )
    const oversized = loadMercMelodyExample(
      () => '/example.mp3',
      variant,
      signal,
      vi.fn(async () => response(new Blob([new Uint8Array(1_000_001)]))),
    )

    expect(bundled.size).toBe(5)
    await expect(oversized).rejects.toThrow('delivery budget')
  })

  it('plays the exact recorded variant through its quiet tail before resolving', async () => {
    vi.useFakeTimers()
    let now = 0
    const playback = new PlaybackFake()
    const guide = new ReferenceFake()
    const factory = createMercMelodyReferenceFactory(
      {
        assetUrl: (id) => `/assets/${id}.mp3`,
        createMemoryPlayback: () => playback,
        createMelodyReference: () => guide,
      },
      {
        now: () => now,
        fetchAsset: vi.fn(async () => response(new Blob(['voice']))),
      },
    )
    const progress: number[] = []
    const player = factory.create(contour)

    const playing = player.play((seconds) => progress.push(seconds))
    await flush()
    now = 1250
    await vi.advanceTimersByTimeAsync(50)
    playback.onEnded?.()
    await flush()

    expect(progress).toContain(1.25)
    expect(progress.at(-1)).toBe(contour.durationSeconds)
    let settled = false
    void playing.then(() => {
      settled = true
    })
    await vi.advanceTimersByTimeAsync(299)
    expect(settled).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    await expect(playing).resolves.toBeUndefined()
    expect(guide.play).not.toHaveBeenCalled()
    player.dispose()
    expect(playback.dispose).toHaveBeenCalledOnce()
    factory.dispose()
    expect(playback.dispose).toHaveBeenCalledOnce()
  })

  it('falls back to the exact synthesized contour when recorded audio cannot start', async () => {
    const playback = new PlaybackFake()
    playback.start = false
    const guide = new ReferenceFake()
    const fallback = vi.fn()
    const factory = createMercMelodyReferenceFactory(
      {
        assetUrl: (id) => `/assets/${id}.mp3`,
        createMemoryPlayback: () => playback,
        createMelodyReference: (compiled) => {
          expect(compiled).toBe(contour)
          return guide
        },
      },
      {
        fetchAsset: vi.fn(async () => response(new Blob(['voice']))),
        onGuideFallback: fallback,
      },
    )

    await expect(factory.create(contour).play()).resolves.toBeUndefined()

    expect(fallback).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'guide' }),
    )
    expect(guide.play).toHaveBeenCalledOnce()
    factory.dispose()
  })

  it('cancels an in-flight example without starting the fallback guide', async () => {
    const playback = new PlaybackFake()
    const guide = new ReferenceFake()
    let rejectFetch!: (cause: unknown) => void
    const fetchAsset = vi.fn(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          rejectFetch = reject
          init?.signal?.addEventListener('abort', () =>
            reject(new DOMException('Aborted', 'AbortError')),
          )
        }),
    )
    const factory = createMercMelodyReferenceFactory(
      {
        assetUrl: (id) => `/assets/${id}.mp3`,
        createMemoryPlayback: () => playback,
        createMelodyReference: () => guide,
      },
      { fetchAsset },
    )
    const player = factory.create(contour)

    const playing = player.play()
    await flush()
    player.stop()
    rejectFetch(new DOMException('Aborted', 'AbortError'))

    await expect(playing).rejects.toThrow('could not start')
    expect(playback.stop).toHaveBeenCalled()
    expect(guide.play).not.toHaveBeenCalled()
    factory.dispose()
  })
})
