// ============================================================
// Voice Media Progress tests — native playback terminal-state fallback
// ============================================================

import { cleanup, render, screen } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { VoiceTakeRecord } from '@/db/entities'
import type { MediaFrameScheduler, MediaProgressClock, } from '@/lib/media-progress-loop'
import { createVoiceMediaProgressLoop } from './voice-media-progress'
import { VoicePlaybackTransport } from './VoicePlaybackTransport'

const TAKE: VoiceTakeRecord = {
  id: 'native-take',
  createdAt: '2026-08-28T08:00:00.000Z',
  updatedAt: '2026-08-28T08:00:00.000Z',
  capturedAt: '2026-08-28T08:00:00.000Z',
  source: 'freeform',
  comparisonKey: 'thread-1',
  contextVersion: 1,
  durationMs: 10_000,
  mimeType: 'audio/mp4',
  sizeBytes: 12_000,
  peaks: [0.1, 0.6, 0.3],
  title: 'Native take',
  favorite: false,
  contextJson: '{}',
}

function createScheduler(): MediaFrameScheduler & { runNext: () => void } {
  let nextId = 0
  const callbacks = new Map<number, FrameRequestCallback>()
  return {
    request: (callback) => {
      const id = ++nextId
      callbacks.set(id, callback)
      return id
    },
    cancel: (id) => {
      callbacks.delete(id)
    },
    runNext: () => {
      const entry = callbacks.entries().next().value as
        | [number, FrameRequestCallback]
        | undefined
      if (entry === undefined) return
      callbacks.delete(entry[0])
      entry[1](0)
    },
  }
}

describe('voice native-media progress', () => {
  afterEach(() => cleanup())

  it('returns to Play at duration even when WebKit has not set ended', () => {
    const [playing, setPlaying] = createSignal(true)
    const [progress, setProgress] = createSignal(0)
    const scheduler = createScheduler()
    const onTerminal = vi.fn(() => {
      media.paused = true
      setPlaying(false)
      setProgress(1)
    })
    const loop = createVoiceMediaProgressLoop(
      setProgress,
      onTerminal,
      scheduler,
    )
    const media: MediaProgressClock = {
      currentTime: 0,
      duration: 10,
      paused: false,
      ended: false,
    }
    render(() => (
      <VoicePlaybackTransport
        take={TAKE}
        activeId={TAKE.id}
        progress={progress()}
        playing={playing()}
        eyebrow="Selected take"
        onPlay={vi.fn()}
        onSeek={vi.fn()}
      />
    ))
    loop.start(media)

    media.currentTime = 10
    scheduler.runNext()

    expect(media.ended).toBe(false)
    expect(onTerminal).toHaveBeenCalledOnce()
    expect(
      screen.getByRole('button', { name: 'Play Native take' }),
    ).toBeInTheDocument()
    expect(
      (
        screen.getByRole('slider', {
          name: 'Seek Native take',
        }) as HTMLInputElement
      ).value,
    ).toBe('1000')
  })
})
