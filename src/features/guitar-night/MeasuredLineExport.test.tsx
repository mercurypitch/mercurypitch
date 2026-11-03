import { cleanup, fireEvent, render, screen, waitFor, } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { TranscribedNote } from '@/lib/transcription/stem-transcription'
import { MeasuredLineExport } from './MeasuredLineExport'
import { measuredReferenceFromTranscription } from './reference-port'

const downloadRecordingScore = vi.hoisted(() =>
  vi.fn<(...args: unknown[]) => Promise<void>>(),
)
vi.mock('@/lib/guitar/recording-export', () => ({ downloadRecordingScore }))

function note(
  midi: number,
  startSeconds: number,
  durationSeconds: number,
): TranscribedNote {
  return { midi, noteName: '', startSeconds, durationSeconds, confidence: 0.9 }
}

function bassLine(notes: TranscribedNote[]) {
  return measuredReferenceFromTranscription({
    sessionId: 'song',
    stemKind: 'bass',
    stemLabel: 'Bass',
    transcription: { notes, coverage: 0.8, analysedSeconds: 4 },
  })
}

beforeEach(() => {
  downloadRecordingScore.mockReset()
  downloadRecordingScore.mockResolvedValue(undefined)
})
afterEach(cleanup)

describe('MeasuredLineExport', () => {
  it('offers the line as MIDI and as Guitar Pro', () => {
    render(() => (
      <MeasuredLineExport
        reference={bassLine([note(28, 0, 0.5), note(33, 1, 0.5)])}
        songTitle="Nothing in the Dark"
      />
    ))

    const group = screen.getByRole('group', { name: 'Save the bass line as' })
    expect(group).toHaveAttribute('data-note-count', '2')
    const midi = screen.getByRole('button', {
      name: 'Save the bass line as MIDI',
    })
    const guitarPro = screen.getByRole('button', {
      name: 'Save the bass line as Guitar Pro',
    })
    expect(midi).toBeEnabled()
    expect(midi).toHaveAttribute('title', 'Export MIDI')
    expect(guitarPro).toBeEnabled()
    expect(guitarPro).toHaveAttribute('title', 'Export Guitar Pro 7')
  })

  it('saves the notes on the stage, named after the song', async () => {
    render(() => (
      <MeasuredLineExport
        reference={bassLine([note(28, 0, 0.5), note(33, 1, 0.5)])}
        songTitle="Nothing in the Dark.mp3"
      />
    ))

    fireEvent.click(
      screen.getByRole('button', { name: 'Save the bass line as Guitar Pro' }),
    )

    await waitFor(() => expect(downloadRecordingScore).toHaveBeenCalledTimes(1))
    const [score, format] = downloadRecordingScore.mock.calls[0]
    expect(format).toBe('gp')
    expect(score).toMatchObject({
      title: 'Nothing in the Dark Bass line',
      instrument: 'bass',
    })
    expect(
      (score as { notes: { midi: number }[] }).notes.map((each) => each.midi),
    ).toEqual([28, 33])
  })

  it('shows nothing for a line with no note on the neck', () => {
    render(() => (
      <MeasuredLineExport
        reference={bassLine([note(88, 0, 0.5)])}
        songTitle="Song"
      />
    ))

    expect(screen.queryByRole('group')).toBeNull()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('says why a file could not be written, and keeps the other format', async () => {
    downloadRecordingScore.mockRejectedValueOnce(
      new Error(
        'Some note attacks are too close for thirty-second-note notation.',
      ),
    )
    render(() => (
      <MeasuredLineExport
        reference={bassLine([note(28, 0, 0.5)])}
        songTitle="Song"
      />
    ))

    fireEvent.click(
      screen.getByRole('button', { name: 'Save the bass line as Guitar Pro' }),
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Some note attacks are too close for thirty-second-note notation.',
    )
    const midi = screen.getByRole('button', {
      name: 'Save the bass line as MIDI',
    })
    expect(midi).toBeEnabled()
    fireEvent.click(midi)
    await waitFor(() => expect(downloadRecordingScore).toHaveBeenCalledTimes(2))
    expect(screen.queryByRole('alert')).toBeNull()
    expect(downloadRecordingScore).toHaveBeenLastCalledWith(
      expect.objectContaining({ title: 'Song Bass line' }),
      'mid',
      expect.any(HTMLElement),
    )
  })

  it('keeps a format the line breaks unavailable, with the reason', () => {
    // The recorder's limit: no score past five minutes and one second.
    render(() => (
      <MeasuredLineExport
        reference={bassLine([note(28, 0, 0.5), note(33, 400, 0.5)])}
        songTitle="Song"
      />
    ))

    for (const name of [
      'Save the bass line as MIDI',
      'Save the bass line as Guitar Pro',
    ]) {
      const button = screen.getByRole('button', { name })
      expect(button).toBeDisabled()
      expect(button).toHaveAttribute(
        'title',
        'This melody exceeds the five-minute recording limit.',
      )
    }
  })
})
