// ============================================================
// Voice Playback Transport tests — one stable control rail for every take view
// ============================================================

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { VoiceTakeRecord } from '@/db/entities'
import { VoicePlaybackTransport } from './VoicePlaybackTransport'

const TAKE: VoiceTakeRecord = {
  id: 'take-1',
  createdAt: '2026-08-04T08:00:00.000Z',
  updatedAt: '2026-08-04T08:00:00.000Z',
  capturedAt: '2026-08-04T08:00:00.000Z',
  source: 'freeform',
  comparisonKey: 'thread-1',
  contextVersion: 1,
  durationMs: 60_000,
  mimeType: 'audio/webm',
  sizeBytes: 12_000,
  peaks: [0.1, 0.6, 0.3],
  title: 'Morning vowels',
  favorite: false,
  contextJson: '{}',
}

describe('VoicePlaybackTransport', () => {
  afterEach(() => cleanup())

  it('keeps playback identity, time, and scrubbing in one control rail', () => {
    const onPlay = vi.fn<(takeId: string) => void>()
    const onSeek = vi.fn<(takeId: string, progress: number) => void>()

    render(() => (
      <VoicePlaybackTransport
        take={TAKE}
        activeId={TAKE.id}
        progress={0.5}
        playing={true}
        eyebrow="Later take"
        tone="later"
        onPlay={onPlay}
        onSeek={onSeek}
      />
    ))

    expect(screen.getByText('Later take')).toBeInTheDocument()
    expect(screen.getByText('Morning vowels')).toBeInTheDocument()
    expect(screen.getByText('0:30')).toBeInTheDocument()
    expect(screen.getByText('1:00')).toBeInTheDocument()

    fireEvent.click(
      screen.getByRole('button', { name: 'Pause Morning vowels' }),
    )
    fireEvent.input(
      screen.getByRole('slider', { name: 'Seek Morning vowels' }),
      {
        target: { value: '750' },
      },
    )

    expect(onPlay).toHaveBeenCalledWith(TAKE.id)
    expect(onSeek).toHaveBeenCalledWith(TAKE.id, 0.75)
  })

  it('leaves playback controls disabled until a take is selected', () => {
    render(() => (
      <VoicePlaybackTransport
        take={null}
        activeId={null}
        progress={0}
        playing={false}
        eyebrow="Selected take"
        onPlay={vi.fn()}
        onSeek={vi.fn()}
      />
    ))

    expect(
      screen.getByRole('button', { name: 'Play selected take' }),
    ).toBeDisabled()
    expect(
      screen.getByRole('slider', { name: 'Seek selected take' }),
    ).toBeDisabled()
  })
})
