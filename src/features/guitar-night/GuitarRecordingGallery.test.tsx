// The melody gallery is passive, bounded and honest about missing or interrupted evidence.
import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { GuitarRecording } from '@/lib/guitar/recording-types'
import { GuitarRecordingGallery } from './GuitarRecordingGallery'

const preview = vi.hoisted(() => vi.fn())
vi.mock('@/db/services/guitar-recording-service', () => ({
  createGuitarRecordingStore: () => ({ preview }),
}))
const row = (index: number): GuitarRecording =>
  ({
    id: `take-${index}`,
    title: `My riff ${index}`,
    state: 'kept',
    takeId: `audio-${index}`,
    createdAt: '2026-09-07T10:00:00Z',
    updatedAt: '2026-09-07T10:00:00Z',
    frames: 480000,
    sampleRate: 48000,
    inputKind: 'interface',
    backing: null,
    interruption: null,
  }) as GuitarRecording
beforeEach(() => {
  preview.mockReset().mockResolvedValue({
    noteCount: 3,
    lowestMidi: 40,
    highestMidi: 52,
    marks: [{ x: 4, y: 10, width: 1 }],
  })
})
afterEach(cleanup)
describe('My melodies gallery', () => {
  it('does no preview work while closed and loads only the visible page', async () => {
    const [open, setOpen] = createSignal(false)
    const review = vi.fn()
    render(() => (
      <GuitarRecordingGallery
        isOpen={open()}
        rows={Array.from({ length: 12 }, (_, i) => row(i))}
        onClose={() => setOpen(false)}
        onReview={review}
      />
    ))
    expect(preview).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    setOpen(true)
    expect(
      await screen.findAllByRole('img', { name: 'Captured melody, 3 notes' }),
    ).toHaveLength(8)
    expect(preview).toHaveBeenCalledTimes(8)
    expect(screen.getAllByText('E2–E3')).toHaveLength(8)
    fireEvent.click(screen.getByRole('button', { name: 'Show more melodies' }))
    expect(
      await screen.findAllByRole('img', { name: 'Captured melody, 3 notes' }),
    ).toHaveLength(12)
    fireEvent.click(screen.getByRole('button', { name: 'Review My riff 11' }))
    expect(review).toHaveBeenCalledWith('take-11')
  })
  it('offers retry without inventing note counts and retains recovery/removed-audio states', async () => {
    preview
      .mockRejectedValueOnce(new Error('Offline storage read failed'))
      .mockResolvedValueOnce(null)
    render(() => (
      <GuitarRecordingGallery
        isOpen
        rows={[
          { ...row(0), takeId: null },
          { ...row(1), state: 'capturing' },
        ]}
        onClose={vi.fn()}
        onReview={vi.fn()}
      />
    ))
    expect(await screen.findByText('Note preview unavailable.')).toBeVisible()
    expect(
      screen.getByText('Audio removed; your note evidence is still here.'),
    ).toBeVisible()
    expect(
      screen.getByRole('button', { name: 'Recover My riff 1' }),
    ).toBeEnabled()
    expect(
      screen.getByText('Review this draft to recover its notes.'),
    ).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Retry preview' }))
    expect(
      await screen.findByRole('img', { name: 'Captured melody, 3 notes' }),
    ).toBeVisible()
  })
  it('offers a clear empty-state return without starting input or playback', () => {
    const close = vi.fn()
    render(() => (
      <GuitarRecordingGallery
        isOpen
        rows={[]}
        onClose={close}
        onReview={vi.fn()}
      />
    ))
    expect(screen.getByText('Your next melody belongs here.')).toBeVisible()
    fireEvent.click(
      screen.getByRole('button', { name: 'Back to the recorder' }),
    )
    expect(close).toHaveBeenCalledOnce()
    expect(preview).not.toHaveBeenCalled()
  })
  it('removes only a confirmed tile and leaves capturing rows recoverable', async () => {
    const remove = vi.fn().mockResolvedValue(undefined)
    render(() => (
      <GuitarRecordingGallery
        isOpen
        rows={[row(0), { ...row(1), state: 'capturing' }]}
        onClose={vi.fn()}
        onReview={vi.fn()}
        onRemove={remove}
      />
    ))
    expect(
      screen.getByRole('button', { name: 'Remove My riff 1' }),
    ).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Remove My riff 0' }))
    expect(screen.getByRole('alertdialog')).toHaveTextContent('My riff 0')
    expect(screen.getByRole('alertdialog')).toHaveTextContent(
      'all practice revisions',
    )
    expect(remove).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Remove melody' }))
    await Promise.resolve()
    expect(remove).toHaveBeenCalledExactlyOnceWith('take-0')
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })
})
