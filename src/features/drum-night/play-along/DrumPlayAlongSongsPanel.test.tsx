// Drum play-along Songs panel tests cover score-only imports, saved-mix truth, and separation recovery controls.
// ============================================================

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PlayAlongBackingSource, PlayAlongSongSummary, } from '@/features/play-along/song-port'
import type { PlayAlongBandPreparationState } from '@/features/play-along/useBandPreparationController'
import type { CloudSplitBlocker } from '@/lib/uvr-cloud-preflight'
import type { DrumPlayAlongSongsPanelProps } from './DrumPlayAlongSongsPanel'
import { DrumPlayAlongSongsPanel } from './DrumPlayAlongSongsPanel'

afterEach(cleanup)

const SONGS: readonly PlayAlongSongSummary[] = [
  {
    sessionId: 'session-night-drive',
    title: 'Night Drive',
    createdAt: Date.parse('2026-08-24T09:00:00.000Z'),
  },
  {
    sessionId: 'session-quiet-room',
    title: 'Quiet Room',
    createdAt: Date.parse('2026-08-23T09:00:00.000Z'),
  },
]

function twoStemLease(
  source: 'device' | 'demo' = 'device',
): PlayAlongBackingSource<'drums'> {
  return {
    sessionId: 'session-night-drive',
    title: 'Night Drive',
    source,
    stemKinds: ['vocal', 'instrumental'],
    plannedMix: {
      kind: 'mixed-instrumental',
      audible: ['vocal', 'instrumental'],
      muted: [],
    },
    durationSeconds: 184,
    load: vi.fn(async () => ({ ok: false, code: 'aborted' }) as const),
    release: vi.fn(),
  }
}

function fullPartsLease(): PlayAlongBackingSource<'drums'> {
  return {
    sessionId: 'session-night-drive',
    title: 'Night Drive',
    source: 'device',
    stemKinds: ['vocal', 'drums', 'bass', 'guitar', 'piano', 'other'],
    plannedMix: {
      kind: 'parts',
      audible: ['vocal', 'drums', 'bass', 'guitar', 'piano', 'other'],
      muted: [],
    },
    durationSeconds: 184,
    load: vi.fn(async () => ({ ok: false, code: 'aborted' }) as const),
    release: vi.fn(),
  }
}

function panelProps(
  overrides: Partial<DrumPlayAlongSongsPanelProps> = {},
): DrumPlayAlongSongsPanelProps {
  return {
    libraryState: 'ready',
    selectionState: { kind: 'idle' },
    songs: SONGS,
    preparationState: { kind: 'idle' },
    onFile: vi.fn(),
    onFilesRejected: vi.fn(),
    onSelectSession: vi.fn(),
    onClearSession: vi.fn(),
    onRetryLibrary: vi.fn(),
    onRetrySession: vi.fn(),
    onSeparateDrums: vi.fn(),
    onCancelSeparation: vi.fn(),
    onRetrySeparation: vi.fn(),
    onDismissSeparation: vi.fn(),
    ...overrides,
  }
}

function mountPanel(overrides: Partial<DrumPlayAlongSongsPanelProps> = {}) {
  const props = panelProps(overrides)
  const mounted = render(() => <DrumPlayAlongSongsPanel {...props} />)
  return { props, ...mounted }
}

describe('DrumPlayAlongSongsPanel', () => {
  it('accepts authored MIDI and Guitar Pro files without offering raw audio', () => {
    const onFile = vi.fn()
    const onFilesRejected = vi.fn()
    mountPanel({ onFile, onFilesRejected })
    const input = screen.getByTestId('drum-play-along-file-drop-input')

    expect(input).toHaveAttribute(
      'accept',
      '.gp,.gp3,.gp4,.gp5,.gpx,.mid,.midi',
    )
    expect(screen.getByText('MIDI · GP · GP3 · GP4 · GP5 · GPX')).toBeVisible()

    const midi = new File(['score'], 'night-drive.mid', {
      type: 'audio/midi',
    })
    fireEvent.change(input, { target: { files: [midi] } })
    expect(onFile).toHaveBeenCalledWith(midi)

    const audio = new File(['audio'], 'night-drive.wav', {
      type: 'audio/wav',
    })
    fireEvent.drop(screen.getByTestId('drum-play-along-file-drop'), {
      dataTransfer: { files: [audio], types: ['Files'] },
    } as unknown as DragEvent)
    expect(onFilesRejected).toHaveBeenCalledWith([audio])
    expect(onFile).toHaveBeenCalledTimes(1)
  })

  it('shows durable two-stem truth and offers explicit drum separation', () => {
    const onSeparateDrums = vi.fn()
    const onClearSession = vi.fn()
    mountPanel({
      selectionState: { kind: 'ready', lease: twoStemLease() },
      onSeparateDrums,
      onClearSession,
    })

    expect(screen.getByText('Backing with drums inside')).toBeVisible()
    expect(
      screen.getByText(/source drums are still inside this two-stem mix/i),
    ).toBeVisible()
    expect(
      screen.getByRole('button', { name: /Night Drive.*Selected/i }),
    ).toHaveAttribute('aria-current', 'true')

    fireEvent.click(screen.getByRole('button', { name: 'Separate drums' }))
    expect(onSeparateDrums).toHaveBeenCalledWith('session-night-drive')

    fireEvent.click(
      screen.getByRole('button', { name: 'Clear Night Drive backing' }),
    )
    expect(onClearSession).toHaveBeenCalledOnce()
  })

  it('states the Drum full-parts default as source drums and backing on', () => {
    mountPanel({
      selectionState: { kind: 'ready', lease: fullPartsLease() },
      selectedSessionAccessory: <span>Mix controls slot</span>,
    })

    expect(screen.getByText('Full mix ready')).toBeVisible()
    expect(screen.getByText('Source drums on')).toBeVisible()
    expect(screen.getByText('Backing on')).toBeVisible()
    expect(screen.getByText(/full saved mix starts together/i)).toBeVisible()
    expect(screen.getByText('Mix controls slot')).toBeVisible()
    expect(
      screen.queryByRole('button', { name: 'Separate drums' }),
    ).not.toBeInTheDocument()
  })

  it('keeps the saved catalog lazy and exposes its retry action', () => {
    const onRetryLibrary = vi.fn()
    mountPanel({
      libraryState: 'idle',
      songs: [],
      onRetryLibrary,
      localArrangement: <strong>Loaded score: Pocket Study</strong>,
    })

    expect(
      screen.getByText('Saved songs stay asleep until needed'),
    ).toBeVisible()
    expect(screen.getByText('Loaded score: Pocket Study')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Load saved songs' }))
    expect(onRetryLibrary).toHaveBeenCalledOnce()
  })

  it('provides cancellable progress plus actionable blocker and error recovery', () => {
    const onCancelSeparation = vi.fn()
    const preparing: PlayAlongBandPreparationState = {
      kind: 'preparing',
      sessionId: 'session-night-drive',
      phase: 'processing',
      progress: 46,
      detail: null,
    }
    const progressView = mountPanel({
      selectionState: { kind: 'ready', lease: twoStemLease() },
      preparationState: preparing,
      onCancelSeparation,
    })

    expect(
      screen.getByText('Separating drums from the band · 46%'),
    ).toBeVisible()
    expect(screen.getByRole('progressbar')).toHaveAttribute('value', '46')
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancelSeparation).toHaveBeenCalledOnce()
    progressView.unmount()

    const blocker: CloudSplitBlocker = {
      reason: 'signed-out',
      message: 'Sign in before separating the band.',
      cta: { label: 'Open Account', section: 'account' },
    }
    const onResolveBlocker = vi.fn()
    const blockedView = mountPanel({
      preparationState: {
        kind: 'blocked',
        sessionId: 'session-night-drive',
        blocker,
      },
      onResolveBlocker,
    })

    expect(
      screen.getByText('No job started and no credits were used.'),
    ).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Open Account' }))
    expect(onResolveBlocker).toHaveBeenCalledWith(blocker)
    blockedView.unmount()

    const onRetrySeparation = vi.fn()
    const onDismissSeparation = vi.fn()
    mountPanel({
      preparationState: {
        kind: 'error',
        sessionId: 'session-night-drive',
        message: 'The cloud job was interrupted.',
      },
      onRetrySeparation,
      onDismissSeparation,
    })

    expect(
      screen.getByText('Your original two-stem mix is still ready.'),
    ).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(onRetrySeparation).toHaveBeenCalledWith('session-night-drive')
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(onDismissSeparation).toHaveBeenCalledOnce()
  })
})
