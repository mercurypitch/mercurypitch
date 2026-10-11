// ============================================================
// The exercise picker: one card per exercise, the last one marked
// ============================================================
//
// A card's third line reads stored signals (the demo flag, the note Long
// note opens on, its best there), each read once per module graph. Every
// case seeds storage and loads the picker fresh.

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

interface Seed {
  last?: string
  /** The note Long note opens on, as MIDI. */
  note?: number
  /** The best on that note, in seconds held in the band. */
  best?: number
  demoSeen?: boolean
  /** The level every premium exercise is at. */
  level?: string
}

beforeEach(() => {
  localStorage.clear()
  vi.resetModules()
})

afterEach(() => {
  cleanup()
})

async function openPicker(seed: Seed = {}) {
  if (seed.last !== undefined) {
    localStorage.setItem('mp_last_exercise', seed.last)
  }
  if (seed.note !== undefined) {
    localStorage.setItem(
      'pitchperfect_long_note_lantern_note',
      JSON.stringify(seed.note),
    )
  }
  if (seed.note !== undefined && seed.best !== undefined) {
    localStorage.setItem(
      'pitchperfect_long_note_lantern_bests',
      JSON.stringify({
        [seed.note]: { inBandSeconds: seed.best, steadiness: 80, at: 1 },
      }),
    )
  }
  if (seed.demoSeen !== undefined) {
    localStorage.setItem(
      'mp_long_note_demo_seen',
      JSON.stringify(seed.demoSeen),
    )
  }
  if (seed.level !== undefined) {
    localStorage.setItem('pitchperfect_premium_exercise_level', seed.level)
  }
  const { ExercisePicker } = await import('./ExercisePicker')
  const { EXERCISE_CATALOGUE } = await import('./catalogue')
  const calls: string[] = []
  const close = vi.fn(() => calls.push('close'))
  const onPick = vi.fn((id: string) => calls.push(`pick ${id}`))
  render(() => <ExercisePicker isOpen close={close} onPick={onPick} />)
  return { close, onPick, calls, catalogue: EXERCISE_CATALOGUE }
}

const cards = (): HTMLElement[] => screen.getAllByTestId('sing-exercise-card')

const meta = (): string | null =>
  screen.queryByTestId('sing-exercise-meta')?.textContent ?? null

const level = (): string | null =>
  screen.queryByTestId('sing-exercise-level')?.textContent ?? null

describe('the cards', () => {
  it('lists one card per catalogue entry, in catalogue order', async () => {
    const { catalogue } = await openPicker()

    expect(cards().map((card) => card.dataset.exercise)).toEqual(
      catalogue.map((exercise) => exercise.id),
    )
  })

  it('names the exercise and says what it is', async () => {
    await openPicker({ demoSeen: true })

    expect(cards()[0]?.textContent).toBe(
      'Long noteBeginnerHold one note and fill the lantern with light.',
    )
  })

  it('is headed "Exercises", as a sheet of that name', async () => {
    await openPicker()

    expect(screen.getByRole('dialog').getAttribute('aria-label')).toBe(
      'Exercises',
    )
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe(
      'Exercises',
    )
  })
})

describe("a card's third line", () => {
  it('says Merc sings it first exactly when the demo will play by itself', async () => {
    await openPicker()

    expect(meta()).toBe('Merc sings it first')
  })

  it('gives the best on the note Long note opens on once the demo is spent', async () => {
    await openPicker({ demoSeen: true, note: 57, best: 9.46 })

    expect(meta()).toBe('Best 9.4 s on A3')
  })

  it('gives the best, not the demo, once a note is remembered', async () => {
    await openPicker({ note: 57, best: 12 })

    expect(meta()).toBe('Best 12.0 s on A3')
  })

  it('is left out with no demo to come and no best', async () => {
    await openPicker({ demoSeen: true, note: 57 })

    expect(meta()).toBeNull()
  })
})

describe("a card's level", () => {
  it('names the level the exercises are at: Beginner, to start', async () => {
    await openPicker()

    expect(level()).toBe('Beginner')
  })

  it('names the level the singer picked', async () => {
    await openPicker({ level: 'pro' })

    expect(level()).toBe('Pro')
  })
})

describe('the last exercise opened', () => {
  it('is marked current, where it already was', async () => {
    await openPicker({ last: 'long-note-lantern' })

    expect(cards().map((card) => card.getAttribute('aria-current'))).toEqual([
      'true',
    ])
  })

  it('marks nothing before the first open', async () => {
    await openPicker()

    expect(cards().map((card) => card.getAttribute('aria-current'))).toEqual([
      null,
    ])
  })
})

describe('taps', () => {
  it('closes the sheet, then hands the room the id, once', async () => {
    const { calls } = await openPicker()

    fireEvent.click(cards()[0] as HTMLElement)

    expect(calls).toEqual(['close', 'pick long-note-lantern'])
  })

  it('closes on the X and opens nothing', async () => {
    const { close, onPick } = await openPicker()

    fireEvent.click(screen.getByRole('button', { name: 'Close' }))

    expect(close).toHaveBeenCalledTimes(1)
    expect(onPick).not.toHaveBeenCalled()
  })
})
