// ============================================================
// Exercise example audio — provisional review and trim behaviour
// ============================================================

import { cleanup, fireEvent, render, screen, waitFor, } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PendingExerciseExampleAudio } from '@/features/admin/exercises/ExerciseExampleAudio'
import { ExerciseAudioReview } from '@/features/admin/exercises/ExerciseExampleAudio'

const pendingTake = (): PendingExerciseExampleAudio => {
  const samples = new Float32Array(20_000)
  for (let index = 0; index < samples.length; index += 1) {
    samples[index] = Math.sin(index / 12) * 0.7
  }

  return {
    file: new File(['take'], 'coach-take.webm', { type: 'audio/webm' }),
    buffer: {
      duration: 20,
      length: samples.length,
      numberOfChannels: 1,
      sampleRate: 1_000,
      getChannelData: () => samples,
    } as unknown as AudioBuffer,
    durationMs: 20_000,
    clipStartMs: 0,
    clipEndMs: 15_000,
    origin: 'recording',
  }
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('ExerciseAudioReview', () => {
  it('moves both trim boundaries and previews only the selected region', async () => {
    const play = vi
      .spyOn(HTMLMediaElement.prototype, 'play')
      .mockResolvedValue()
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
    const [pending, setPending] = createSignal(pendingTake())

    render(() => (
      <ExerciseAudioReview
        pending={pending()}
        disabled={false}
        transcriptReady={true}
        onDiscard={vi.fn()}
        onRecordAgain={vi.fn()}
        onSelectionChange={(clipStartMs, clipEndMs) => {
          setPending((current) => ({
            ...current,
            clipStartMs,
            clipEndMs,
          }))
        }}
        onUse={vi.fn()}
      />
    ))

    expect(
      screen.getByRole('button', { name: 'Use 15-second clip' }),
    ).toBeVisible()

    fireEvent.input(screen.getByLabelText('Clip end'), {
      target: { value: '12000' },
    })
    expect(screen.getByLabelText('Clip end')).toHaveValue('12000')
    expect(
      screen.getByRole('button', { name: 'Use 12-second clip' }),
    ).toBeVisible()

    fireEvent.input(screen.getByLabelText('Clip start'), {
      target: { value: '3000' },
    })
    expect(screen.getByLabelText('Clip start')).toHaveValue('3000')
    expect(
      screen.getByRole('button', { name: 'Use 9-second clip' }),
    ).toBeVisible()

    fireEvent.click(
      screen.getByRole('button', { name: 'Preview selected clip' }),
    )
    await waitFor(() => expect(play).toHaveBeenCalledTimes(1))
    expect(screen.getByRole('button', { name: 'Pause preview' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Record again' })).toBeVisible()
  })
})
