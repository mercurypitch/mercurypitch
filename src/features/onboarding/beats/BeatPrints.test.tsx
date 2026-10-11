// ============================================================
// The prints: a returning singer's takes, and a fresh one (owner decision V12)
// ============================================================
//
// "Make another voiceprint" is back beside "See my map". The line above
// the cards used to send a one-take singer to the Voice Mirror for a
// second take, which is now the button under it, so the line says what a
// second take is for instead. The flow around this beat (where each
// button lands, what it counts) is tested in FirstLight.test.tsx.

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { VoiceprintRecord } from '@/db/services/voiceprint-service'

// jsdom cannot draw the share card; the beat shows its placeholder.
vi.mock('@/features/mirror/voiceprint-share', () => ({
  renderVoiceprintCard: (): Promise<HTMLCanvasElement | null> =>
    Promise.resolve(null),
}))

import { BeatPrints } from './BeatPrints'

afterEach(cleanup)

/** Fixture take: fake values. */
function take(id: string, takenAt: string): VoiceprintRecord {
  return {
    id,
    takenAt,
    twin: null,
    source: 'mirror',
    summary: { lowMidi: 43, highMidi: 72, semitones: 29 },
  } as VoiceprintRecord
}

function renderPrints(records: VoiceprintRecord[]) {
  const onAnother = vi.fn<() => void>()
  render(() => (
    <BeatPrints
      records={records}
      onContinue={() => {}}
      onAnother={onAnother}
      onExplore={() => {}}
    />
  ))
  return onAnother
}

const sub = (): string =>
  document.querySelector('[data-beat="prints"] h1 + p')?.textContent ?? ''

describe('the prints for a returning singer', () => {
  it('says what a second take is for, without repeating the button under it', () => {
    // Arrange
    renderPrints([take('one', '2026-10-10T10:00:00.000Z')])

    // Act
    const line = sub()

    // Assert
    expect(line).toBe(
      'This is your only take so far. With a second one beside it, you can watch your voice change.',
    )
    expect(line).not.toMatch(/another|Voice Mirror/i)
    // The app keeping a take has no speaker: never "we" (owner, 11 Oct).
    expect(line).not.toMatch(/\bwe\b/i)
  })

  it('offers "Make another voiceprint" once, second to the Map', () => {
    // Arrange
    const onAnother = renderPrints([
      take('newer', '2026-10-10T10:00:00.000Z'),
      take('older', '2026-09-01T10:00:00.000Z'),
    ])
    const labels = screen
      .getAllByRole('button')
      .map((button) => button.textContent?.trim())

    // Act
    fireEvent.click(
      screen.getByRole('button', { name: 'Make another voiceprint' }),
    )

    // Assert
    expect(labels).toEqual([
      'See my map',
      'Make another voiceprint',
      'Explore your voice constellation',
    ])
    expect(onAnother).toHaveBeenCalledOnce()
  })
})
