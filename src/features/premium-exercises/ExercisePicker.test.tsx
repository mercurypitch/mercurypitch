// ============================================================
// The exercise picker: one card per exercise, the last one marked
// ============================================================
//
// A card's third line reads stored signals (the demo flag, the note Long
// note opens on, its best there, Echo's and Ng slides' bests at the
// level), each read once per module graph. Every case seeds storage and loads the picker fresh.

import { cleanup, fireEvent, render, screen, within, } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ExerciseLevel } from '@/stores/exercise-level'

interface Seed {
  last?: string
  /** The note Long note opens on, as MIDI. */
  note?: number
  /** The best on that note, in seconds held in the band. */
  best?: number
  /** Every demo seen, unless Echo's or Ng slides' is set apart. */
  demoSeen?: boolean
  echoDemoSeen?: boolean
  ngDemoSeen?: boolean
  /** The level every premium exercise is at. */
  level?: ExerciseLevel
  /** Echo's best at the Singer level: notes landed of notes asked. */
  echoBest?: readonly [number, number]
  /** Ng slides' best at the Singer level: the bridge lit, per cent. */
  ngBest?: number
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
  if ((seed.echoDemoSeen ?? seed.demoSeen) === true) {
    localStorage.setItem('mp_echo_demo_seen', 'true')
  }
  if ((seed.ngDemoSeen ?? seed.demoSeen) === true) {
    localStorage.setItem('mp_ng_demo_seen', 'true')
  }
  if (seed.echoBest !== undefined) {
    const [landed, notes] = seed.echoBest
    localStorage.setItem(
      'pitchperfect_echo_stars_bests',
      JSON.stringify({ singer: { landed, notes, accuracy: 80, at: 1 } }),
    )
  }
  if (seed.ngBest !== undefined) {
    localStorage.setItem(
      'pitchperfect_ng_slides_bests',
      JSON.stringify({
        singer: { lit: seed.ngBest, arches: 4, jumps: 0, at: 1 },
      }),
    )
  }
  if (seed.level !== undefined) {
    const { setExerciseLevel } = await import('@/stores/exercise-level')
    setExerciseLevel(seed.level)
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

const card = (id: string): HTMLElement => {
  const found = cards().find((one) => one.dataset.exercise === id)
  if (found === undefined) throw new Error(`no card for ${id}`)
  return found
}

const meta = (id = 'long-note-lantern'): string | null =>
  within(card(id)).queryByTestId('sing-exercise-meta')?.textContent ?? null

const levels = (): (string | null)[] =>
  cards().map(
    (one) =>
      within(one).queryByTestId('sing-exercise-level')?.textContent ?? null,
  )

describe('the cards', () => {
  it('lists one card per catalogue entry, in catalogue order', async () => {
    const { catalogue } = await openPicker()

    expect(cards().map((card) => card.dataset.exercise)).toEqual(
      catalogue.map((exercise) => exercise.id),
    )
  })

  it('names the exercise and says what it is', async () => {
    await openPicker({ demoSeen: true })

    expect(card('long-note-lantern').textContent).toBe(
      'Long noteSingerHold one note and fill the lantern with light.',
    )
    expect(card('echo-stars').textContent).toBe(
      'EchoSingerMerc sings a phrase. Sing it back and light the stars.',
    )
    expect(card('ng-slides-bridge').textContent).toBe(
      'Ng slidesSingerHum five slides up a fifth and back, and light the bridge.',
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

  it("gives Echo's best at the card's level, with no note: it belongs to the level", async () => {
    await openPicker({ echoBest: [18, 20] })

    expect(meta('echo-stars')).toBe('Best 18 of 20')
  })

  it('says Merc sings Echo first until its demo is seen, before its first best', async () => {
    await openPicker()

    expect(meta('echo-stars')).toBe('Merc sings it first')
  })

  it('is left out for Echo with its demo seen and no best yet', async () => {
    await openPicker({ echoDemoSeen: true })

    expect(meta('echo-stars')).toBeNull()
  })

  it("gives Echo's best, not its demo, once a run is kept", async () => {
    await openPicker({ echoDemoSeen: false, echoBest: [18, 20] })

    expect(meta('echo-stars')).toBe('Best 18 of 20')
  })

  it("gives Ng slides' best at the card's level, not its demo, once a run is kept", async () => {
    await openPicker({ ngBest: 94 })

    expect(meta('ng-slides-bridge')).toBe('Best 94% lit')
  })

  it('says Merc sings Ng slides first until its demo is seen, before its first best', async () => {
    await openPicker()
    expect(meta('ng-slides-bridge')).toBe('Merc sings it first')

    cleanup()
    vi.resetModules()
    localStorage.clear()
    await openPicker({ ngDemoSeen: true })
    expect(meta('ng-slides-bridge')).toBeNull()
  })
})

describe("a card's level", () => {
  it('names the level the exercises are at: Singer, the accuracy tier it starts at', async () => {
    await openPicker()

    expect(levels()).toEqual(['Singer', 'Singer', 'Singer'])
  })

  it('names the level the singer picked', async () => {
    await openPicker({ level: 'professional' })

    expect(levels()).toEqual(['Professional', 'Professional', 'Professional'])
  })
})

describe('the last exercise opened', () => {
  it('is marked current, where it already was', async () => {
    await openPicker({ last: 'long-note-lantern' })

    expect(cards().map((one) => one.getAttribute('aria-current'))).toEqual([
      'true',
      null,
      null,
    ])
  })

  it('marks Echo when it was the last one opened', async () => {
    await openPicker({ last: 'echo-stars' })

    expect(cards().map((one) => one.getAttribute('aria-current'))).toEqual([
      null,
      'true',
      null,
    ])
  })

  it('marks Ng slides when it was the last one opened', async () => {
    await openPicker({ last: 'ng-slides-bridge' })

    expect(cards().map((one) => one.getAttribute('aria-current'))).toEqual([
      null,
      null,
      'true',
    ])
  })

  it('marks nothing before the first open', async () => {
    await openPicker()

    expect(cards().map((one) => one.getAttribute('aria-current'))).toEqual([
      null,
      null,
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

  it("hands the room Echo's id for its card", async () => {
    const { calls } = await openPicker()

    fireEvent.click(card('echo-stars'))

    expect(calls).toEqual(['close', 'pick echo-stars'])
  })

  it('closes on the X and opens nothing', async () => {
    const { close, onPick } = await openPicker()

    fireEvent.click(screen.getByRole('button', { name: 'Close' }))

    expect(close).toHaveBeenCalledTimes(1)
    expect(onPick).not.toHaveBeenCalled()
  })
})
