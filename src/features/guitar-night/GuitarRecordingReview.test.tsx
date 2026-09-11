// Recorder correction tests preserve Undo across disclosure and freeze edits during durable saves.
import { cleanup, fireEvent, render, screen, waitFor, } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { GuitarRecordingDraft } from '@/db/services/guitar-recording-service'
import { DEFAULT_GUITAR_ELECTRIC_AMP_PARAMETERS } from '@/lib/guitar/guitar-electric-amp'
import { DEFAULT_GUITAR_TUNING } from '@/lib/guitar/instrument-tuning'
import { createRecordingScore } from '@/lib/guitar/recording-score'
import { BASIC_PITCH } from '@/lib/transcription/basic-pitch-inference'
import { GuitarRecordingReview } from './GuitarRecordingReview'
import { useGuitarRecordingPlayback } from './useGuitarRecordingPlayback'

const store = vi.hoisted(() => ({
  saveCorrections: vi.fn(),
  accept: vi.fn(),
  download: vi.fn(),
  readRefinementState: vi.fn(),
}))

beforeEach(() => {
  // This component seam reflects its last completed save; real transaction and
  // cross-tab baseline behavior lives in the hook/service integration tests.
  store.readRefinementState.mockImplementation(async () => {
    const writes = [store.saveCorrections, store.accept]
      .flatMap((method) =>
        method.mock.calls.map((args, index) => ({
          score: args[0],
          order: method.mock.invocationCallOrder[index],
        })),
      )
      .sort((a, b) => b.order - a.order)
    return {
      editableScore: writes[0]?.score ?? null,
      acceptedScoreId: store.accept.mock.calls.at(-1)?.[0].id ?? null,
    }
  })
})
vi.mock('@/db/services/guitar-recording-service', () => ({
  createGuitarRecordingStore: () => store,
}))
vi.mock('@/lib/guitar/recording-export', () => ({
  downloadRecordingScore: store.download,
}))

function renderReview(
  outlier = false,
  options: {
    draft?: boolean
    onDiscard?: () => Promise<void>
    onClose?: () => void
    configureDraft?: (draft: GuitarRecordingDraft) => void
  } = {},
) {
  const draft: GuitarRecordingDraft = {
    recording: {
      id: 'recording',
      version: 1,
      detectorVersion: 'test',
      title: 'Melody',
      createdAt: '',
      updatedAt: '',
      state: options.draft === true ? 'draft' : 'kept',
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
    blob: options.draft === true ? new Blob(['audio']) : null,
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
  if (outlier)
    draft.notes.push({
      ...draft.notes[0],
      id: 'outlier',
      midi: 28,
      startFrame: 30000,
      endFrame: 40000,
    })
  options.configureDraft?.(draft)
  return render(() => {
    const playback = useGuitarRecordingPlayback({
      draft: () => draft,
      score: () => null,
      currentAmp: () => DEFAULT_GUITAR_ELECTRIC_AMP_PARAMETERS,
      blocked: () => false,
      activate: async () => null,
      beforePlay: vi.fn(),
    })
    return (
      <GuitarRecordingReview
        draft={draft}
        open={true}
        tuning={DEFAULT_GUITAR_TUNING}
        onClose={options.onClose ?? vi.fn()}
        onDiscard={options.onDiscard ?? vi.fn()}
        onSaved={vi.fn()}
        onRemove={vi.fn()}
        onPractice={vi.fn()}
        playback={playback}
      />
    )
  })
}
afterEach(() => {
  cleanup()
  vi.resetAllMocks()
})

describe('recording corrections', () => {
  it('reopens a renamed refined draft with its saved title and available undo, not the original recording title', () => {
    renderReview(false, {
      draft: true,
      configureDraft: (draft) => {
        const previous = createRecordingScore(
          draft.recording,
          draft.notes,
          DEFAULT_GUITAR_TUNING,
        )
        const applied = {
          ...previous,
          title: 'My renamed chord idea',
          refinement: {
            version: 1 as const,
            model: 'basic-pitch' as const,
            source: 'recorded-audio' as const,
            modelSha256: BASIC_PITCH.modelSha256,
            decoderVersion: BASIC_PITCH.decoderVersion,
            createdAt: '2026-09-08T10:00:00Z',
            confidenceByNoteId: { note: 0.85 },
          },
        }
        draft.editableScore = applied
        draft.refinementBackup = {
          version: 1,
          createdAt: '2026-09-08T10:00:00Z',
          previousScore: previous,
          appliedScore: applied,
          acceptedScoreId: null,
          frames: draft.recording.frames,
        }
      },
    })
    expect(screen.getByRole('textbox', { name: 'Take title' })).toHaveValue(
      'My renamed chord idea',
    )
    expect(
      screen.getByRole('button', { name: 'Restore previous notes' }),
    ).toBeEnabled()
    expect(store.saveCorrections).not.toHaveBeenCalled()
  })

  it('locks the unsaved review while discarding and restores it if deletion fails', async () => {
    let rejectDiscard!: (cause: Error) => void
    const onDiscard = vi.fn(
      () =>
        new Promise<void>((_, reject) => {
          rejectDiscard = reject
        }),
    )
    const onClose = vi.fn()
    renderReview(false, { draft: true, onDiscard, onClose })
    fireEvent.click(
      screen.getByRole('button', { name: 'Review and correct notes' }),
    )
    const pitch = screen.getByRole('spinbutton', { name: 'Pitch (MIDI)' })
    fireEvent.change(pitch, { target: { value: '58' } })
    const discard = screen.getByRole('button', { name: 'Discard recording' })
    fireEvent.click(discard)
    expect(discard).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Discarding…' })).toBeDisabled()
    expect(
      screen.getByRole('button', { name: 'Practice these notes' }),
    ).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Export MIDI' })).toBeDisabled()
    expect(pitch).toBeDisabled()
    expect(
      screen.getByRole('button', { name: 'Hide note corrections' }),
    ).toBeDisabled()
    fireEvent.click(discard)
    fireEvent.click(screen.getByRole('button', { name: 'Close Jam Doctor' }))
    expect(onDiscard).toHaveBeenCalledOnce()
    expect(onClose).not.toHaveBeenCalled()
    expect(store.saveCorrections).not.toHaveBeenCalled()
    rejectDiscard(new Error('Could not remove local recording'))
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Could not remove local recording',
      ),
    )
    expect(discard).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Keep take' })).toBeEnabled()
    expect(pitch).toBeEnabled()
    expect(pitch).toHaveValue(58)
  })

  it('offers retained notes without audio and explains the selected playback tone', () => {
    renderReview()
    fireEvent.click(screen.getByRole('button', { name: 'Playback source' }))
    expect(screen.getByTestId('overflow-recording-source')).toBeDisabled()
    expect(screen.getByTestId('overflow-notes-source')).toBeEnabled()
    expect(
      screen.getByRole('button', { name: 'Play take playback' }),
    ).toBeDisabled()
    fireEvent.click(screen.getByTestId('overflow-notes-source'))
    expect(
      screen.getByRole('button', { name: 'Play take playback' }),
    ).toBeEnabled()
    expect(
      screen.getByRole('button', { name: 'Playback source' }),
    ).toHaveTextContent('Notes')
    expect(
      screen.getByRole('button', { name: 'Play take playback' }),
    ).toBeEnabled()
    const tone = screen.getByRole('button', { name: 'Playback tone' })
    expect(tone).toHaveTextContent('Current')
    fireEvent.click(tone)
    expect(screen.getByTestId('overflow-saved-amp')).toBeDisabled()
    fireEvent.click(screen.getByTestId('overflow-clean'))
    expect(tone).toHaveTextContent('Clean')
    fireEvent.click(screen.getByText('App amp bypassed · clean playback'))
    expect(
      screen.getByText(/Bypass removes the app’s processing/),
    ).toBeVisible()
    expect(store.accept).not.toHaveBeenCalled()
    expect(store.saveCorrections).not.toHaveBeenCalled()
  })
  it('saves and exports out-of-neck MIDI without accepting an invalid guitar target', async () => {
    renderReview(true)
    fireEvent.click(screen.getByRole('button', { name: 'Export MIDI' }))
    await waitFor(() => expect(store.download).toHaveBeenCalledOnce())
    expect(store.accept).not.toHaveBeenCalled()
    expect(store.saveCorrections).toHaveBeenCalledWith(
      expect.objectContaining({
        notes: expect.arrayContaining([
          expect.objectContaining({ midi: 28, string: null }),
        ]),
      }),
    )
    expect(store.download.mock.calls[0][0].notes).toHaveLength(2)
    expect(store.download.mock.calls[0][1]).toBe('mid')
    expect(
      screen.getByRole('button', { name: 'Practice these notes' }),
    ).toBeDisabled()
  })
  it('explains notation rounding before GP export and keeps the accepted practice timing', async () => {
    renderReview()
    const gp = screen.getByRole('button', { name: 'Export Guitar Pro' })
    expect(gp).toHaveAccessibleDescription(
      /Guitar Pro rounds timing to thirty-second notes/,
    )
    fireEvent.click(gp)
    await waitFor(() => expect(store.download).toHaveBeenCalledOnce())
    expect(store.accept).toHaveBeenCalledOnce()
    expect(store.accept.mock.calls[0][0].notes[0]).toMatchObject({
      midi: 57,
      startBeat: 0,
      endBeat: 1,
    })
    expect(store.download.mock.calls[0][0]).toEqual(
      store.accept.mock.calls[0][0],
    )
    expect(store.download.mock.calls[0][1]).toBe('gp')
    expect(
      screen.getByText(/Saved audio and practice timing are unchanged/),
    ).toBeVisible()
  })
  it('offers MIDI and an undoable path to practice when only one note has impossible fingering', () => {
    renderReview(true)
    expect(
      screen.getByRole('button', { name: 'Practice these notes' }),
    ).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Export MIDI' })).toBeEnabled()
    expect(
      screen.getByRole('button', { name: 'Export Guitar Pro' }),
    ).toBeDisabled()
    fireEvent.click(
      screen.getByRole('button', { name: 'Review 1 problem note' }),
    )
    expect(
      screen.getByRole('spinbutton', { name: 'Pitch (MIDI)' }),
    ).toHaveValue(28)
    fireEvent.click(
      screen.getByRole('button', { name: 'Exclude 1 problem note' }),
    )
    expect(
      screen.getByRole('button', { name: 'Practice these notes' }),
    ).toBeEnabled()
    expect(
      screen.getByRole('button', { name: 'Export Guitar Pro' }),
    ).toBeEnabled()
    fireEvent.click(screen.getByRole('button', { name: 'Undo correction' }))
    expect(
      screen.getByRole('button', { name: 'Practice these notes' }),
    ).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Export MIDI' })).toBeEnabled()
  })
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
