// Recorder correction tests preserve Undo across disclosure and freeze edits during durable saves.
import { cleanup, fireEvent, render, screen, waitFor, } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { GuitarRecordingDraft } from '@/db/services/guitar-recording-service'
import { DEFAULT_GUITAR_TUNING } from '@/lib/guitar/instrument-tuning'
import { GuitarRecordingReview } from './GuitarRecordingReview'

const store = vi.hoisted(() => ({ saveCorrections: vi.fn() }))
vi.mock('@/db/services/guitar-recording-service', () => ({
  createGuitarRecordingStore: () => store,
}))

function renderReview() {
  const draft: GuitarRecordingDraft = {
    recording: {
      id: 'recording',
      version: 1,
      detectorVersion: 'test',
      title: 'Melody',
      createdAt: '',
      updatedAt: '',
      state: 'kept',
      sampleRate: 48000,
      inputChannel: 0,
      inputKind: 'interface',
      frames: 24000,
      chunks: 3,
      audioStartFrame: 100,
      clockAnomalies: 0,
      interruption: null,
      amp: null,
      backing: null,
      takeId: null,
      scoreId: null,
    },
    blob: null,
    peaks: [],
    notes: [
      {
        id: 'note',
        midi: 57,
        startFrame: 0,
        endFrame: 24000,
        clarity: 0.9,
        onset: 'attack',
      },
    ],
  }
  return render(() => (
    <GuitarRecordingReview
      draft={draft}
      open={true}
      tuning={DEFAULT_GUITAR_TUNING}
      onClose={vi.fn()}
      onDiscard={vi.fn()}
      onSaved={vi.fn()}
      onRemove={vi.fn()}
      onPractice={vi.fn()}
      onReplay={vi.fn()}
    />
  ))
}
afterEach(() => {
  cleanup()
  vi.resetAllMocks()
})

describe('recording corrections', () => {
  it('keeps Undo when corrections are collapsed and reopened', () => {
    renderReview()
    fireEvent.click(
      screen.getByRole('button', { name: 'Review and correct notes' }),
    )
    const pitch = screen.getByRole('spinbutton', { name: 'Pitch (MIDI)' })
    fireEvent.change(pitch, { target: { value: '58' } })
    fireEvent.click(
      screen.getByRole('button', { name: 'Hide note corrections' }),
    )
    expect(
      screen.queryByRole('spinbutton', { name: 'Pitch (MIDI)' }),
    ).toBeNull()
    fireEvent.click(
      screen.getByRole('button', { name: 'Review and correct notes' }),
    )
    expect(pitch).toHaveValue(58)
    fireEvent.click(screen.getByRole('button', { name: 'Undo correction' }))
    expect(pitch).toHaveValue(57)
  })

  it('disables the whole editor and its disclosure until the saved snapshot completes', async () => {
    let finish!: () => void
    store.saveCorrections.mockReturnValue(
      new Promise<void>((resolve) => {
        finish = resolve
      }),
    )
    renderReview()
    fireEvent.click(
      screen.getByRole('button', { name: 'Review and correct notes' }),
    )
    fireEvent.click(
      screen.getByRole('button', { name: 'Save note corrections' }),
    )
    expect(
      screen.getByRole('spinbutton', { name: 'Pitch (MIDI)' }),
    ).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Split note' })).toBeDisabled()
    expect(
      screen.getByRole('button', { name: 'Hide note corrections' }),
    ).toBeDisabled()
    finish()
    await waitFor(() =>
      expect(
        screen.getByRole('spinbutton', { name: 'Pitch (MIDI)' }),
      ).toBeEnabled(),
    )
    expect(
      screen.getByRole('button', { name: 'Hide note corrections' }),
    ).toBeEnabled()
  })
})
