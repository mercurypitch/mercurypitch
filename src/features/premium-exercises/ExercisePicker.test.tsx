// ============================================================
// The exercise picker: one card per exercise, the last one marked
// ============================================================
//
// A card's third line reads stored signals (the demo flag, the note Long
// note opens on, its best there, Echo's and Ng slides' bests at the
// level), each read once per module graph. Every case seeds storage and loads the picker fresh.

import { cleanup, fireEvent, render, screen, within, } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { OWNER_ROUTINE } from '@/features/warm-up/warm-up-plan'
import { localDayString } from '@/lib/local-day'
import type { ExerciseLevel } from '@/stores/exercise-level'

interface Seed {
  last?: string
  /** The note Long note opens on, as MIDI. */
  note?: number
  /** The best on that note, in seconds held in the band. */
  best?: number
  /** Every demo seen, unless Echo's, Ng slides' or Lip roll's is set apart. */
  demoSeen?: boolean
  echoDemoSeen?: boolean
  ngDemoSeen?: boolean
  lipDemoSeen?: boolean
  /** The level every premium exercise is at. */
  level?: ExerciseLevel
  /** Echo's best at the Singer level: notes landed of notes asked. */
  echoBest?: readonly [number, number]
  /** Ng slides' best at the Singer level: the bridge lit, per cent. */
  ngBest?: number
  /** Today's warm-up reached its end with a stop finished. */
  warmedUp?: boolean
  /** The days warmed up, synced: this device's or another's. */
  warmUpDays?: readonly string[]
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
  if ((seed.lipDemoSeen ?? seed.demoSeen) === true) {
    localStorage.setItem('mp_lip_demo_seen', 'true')
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
  if (seed.warmedUp === true) {
    localStorage.setItem(
      'mp_warm_up_today',
      JSON.stringify({
        date: localDayString(),
        plan: OWNER_ROUTINE,
        marks: [
          { state: 'done', line: '86% lit' },
          { state: 'done', line: '92% lit' },
          { state: 'done', line: '12.6 s' },
          { state: 'done', line: '8 of 9 on pitch' },
          { state: 'waiting' },
        ],
        settledNote: null,
        warmedUp: true,
        lastActiveAt: 1,
      }),
    )
  }
  if (seed.warmUpDays !== undefined) {
    localStorage.setItem(
      'pitchperfect_warm_up_days',
      JSON.stringify(seed.warmUpDays),
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
    expect(card('lip-roll-bay').textContent).toBe(
      'Lip rollSingerBuzz your lips over three waves and light the bay.',
    )
    expect(card('ng-slides-bridge').textContent).toBe(
      'Ng slidesSingerHum five slides up a fifth and back, and light the bridge.',
    )
    expect(card('warm-up-path').textContent).toBe(
      'Warm-upSingerFour stops, about three minutes, then a song.',
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

describe('the headings', () => {
  const groups = (): HTMLElement[] =>
    screen.getAllByTestId('sing-exercise-group')

  const idsUnder = (group: HTMLElement): (string | undefined)[] =>
    within(group)
      .getAllByTestId('sing-exercise-card')
      .map((one) => one.dataset.exercise)

  it('heads the cards Pitch, then Warm-ups, then Ear, under the sheet title', async () => {
    await openPicker()

    expect(
      screen
        .getAllByRole('heading', { level: 3 })
        .map((heading) => heading.textContent),
    ).toEqual(['Pitch', 'Warm-ups', 'Ear'])
  })

  it('puts the pitch rooms under Pitch, the warm-ups under Warm-ups and the Ear rooms under Ear', async () => {
    await openPicker()

    expect(groups().map((group) => group.dataset.group)).toEqual([
      'pitch',
      'warm-ups',
      'ear',
    ])
    expect(groups().map(idsUnder)).toEqual([
      ['long-note-lantern', 'echo-stars'],
      ['warm-up-path', 'lip-roll-bay', 'ng-slides-bridge'],
      ['home-note-lighthouse', 'first-note-stage', 'leap-cliffs'],
    ])
  })

  it('names each list by its heading, for a screen reader', async () => {
    await openPicker()

    const pitch = screen.getByRole('list', { name: 'Pitch' })
    const warmUps = screen.getByRole('list', { name: 'Warm-ups' })

    expect(within(pitch).getAllByRole('button')).toHaveLength(2)
    expect(within(warmUps).getAllByRole('button')).toHaveLength(3)
  })

  it('keeps the last exercise marked under its own heading', async () => {
    await openPicker({ last: 'lip-roll-bay' })

    const [pitch, warmUps] = groups()
    const marked = (group: HTMLElement | undefined): (string | null)[] =>
      within(group as HTMLElement)
        .getAllByTestId('sing-exercise-card')
        .map((one) => one.getAttribute('aria-current'))

    expect([marked(pitch), marked(warmUps)]).toEqual([
      [null, null],
      [null, 'true', null],
    ])
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

  it('says "Warmed up today" on the Warm-up once today counts, and nothing before', async () => {
    await openPicker()
    expect(meta('warm-up-path')).toBeNull()

    cleanup()
    vi.resetModules()
    localStorage.clear()
    await openPicker({ warmedUp: true })
    expect(meta('warm-up-path')).toBe('Warmed up today')
  })

  it("draws this week's dots on the Warm-up once a day of the week is warmed up", async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    // Wednesday 21 Oct 2026.
    vi.setSystemTime(new Date(2026, 9, 21, 9, 0))
    const drawn = (): string[] =>
      [
        ...(within(card('warm-up-path')).queryByTestId('sing-exercise-week')
          ?.children ?? []),
      ].map((dot) => {
        const el = dot as HTMLElement
        return `${el.dataset.warmed === 'true' ? 'x' : '.'}${el.dataset.today === undefined ? '' : 'o'}`
      })
    try {
      // Only last week (Sunday 18 Oct): no dots yet.
      await openPicker({ warmUpDays: ['2026-10-18'] })
      expect(meta('warm-up-path')).toBeNull()

      // Monday this week, on another device: the dots, today ringed.
      cleanup()
      vi.resetModules()
      localStorage.clear()
      await openPicker({ warmUpDays: ['2026-10-19'] })
      expect(meta('warm-up-path')).toBe('')
      expect(drawn()).toEqual(['x', '.', '.o', '.', '.', '.', '.'])

      // Warmed up today too: the words and the dots.
      cleanup()
      vi.resetModules()
      localStorage.clear()
      await openPicker({ warmUpDays: ['2026-10-19'], warmedUp: true })
      expect(meta('warm-up-path')).toBe('Warmed up today')
      expect(drawn()).toEqual(['x', '.', 'xo', '.', '.', '.', '.'])
      expect(
        within(card('warm-up-path'))
          .getByRole('img')
          .getAttribute('aria-label'),
      ).toBe('Warmed up this week: Monday and today')
    } finally {
      vi.useRealTimers()
    }
  })

  it('says Merc sings Lip roll first until its demo is seen, before its first best', async () => {
    await openPicker()
    expect(meta('lip-roll-bay')).toBe('Merc sings it first')

    cleanup()
    vi.resetModules()
    localStorage.clear()
    await openPicker({ lipDemoSeen: true })
    expect(meta('lip-roll-bay')).toBeNull()
  })
})

describe("a card's level", () => {
  it('names the level the exercises are at: Singer, the accuracy tier it starts at', async () => {
    await openPicker()

    expect(levels()).toEqual([
      'Singer',
      'Singer',
      'Singer',
      'Singer',
      'Singer',
      'Singer',
      'Singer',
      'Singer',
    ])
  })

  it('names the level the singer picked', async () => {
    await openPicker({ level: 'professional' })

    expect(levels()).toEqual([
      'Professional',
      'Professional',
      'Professional',
      'Professional',
      'Professional',
      'Professional',
      'Professional',
      'Professional',
    ])
  })
})

describe('the last exercise opened', () => {
  it('is marked current, where it already was', async () => {
    await openPicker({ last: 'long-note-lantern' })

    expect(cards().map((one) => one.getAttribute('aria-current'))).toEqual([
      'true',
      null,
      null,
      null,
      null,
      null,
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
      null,
      null,
      null,
      null,
      null,
    ])
  })

  it('marks Lip roll when it was the last one opened', async () => {
    await openPicker({ last: 'lip-roll-bay' })

    expect(cards().map((one) => one.getAttribute('aria-current'))).toEqual([
      null,
      null,
      null,
      'true',
      null,
      null,
      null,
      null,
    ])
  })

  it('marks the Warm-up when it was the last one opened', async () => {
    await openPicker({ last: 'warm-up-path' })

    expect(cards().map((one) => one.getAttribute('aria-current'))).toEqual([
      null,
      null,
      'true',
      null,
      null,
      null,
      null,
      null,
    ])
  })

  it('marks Ng slides when it was the last one opened', async () => {
    await openPicker({ last: 'ng-slides-bridge' })

    expect(cards().map((one) => one.getAttribute('aria-current'))).toEqual([
      null,
      null,
      null,
      null,
      'true',
      null,
      null,
      null,
    ])
  })

  it('marks nothing before the first open', async () => {
    await openPicker()

    expect(cards().map((one) => one.getAttribute('aria-current'))).toEqual([
      null,
      null,
      null,
      null,
      null,
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

describe('the Legend', () => {
  const WORDS = {
    title: 'The Evening Bell',
    when: 'Ends in 3 days',
    line: 'Everyone sings the same notes, as written.',
    best: 'Your best 74%',
  }

  /** The picker with the shell's Legend, and whether it can open one. */
  async function openWithLegend(
    legend: typeof WORDS | null,
    opens: boolean,
  ): Promise<{ calls: string[] }> {
    const { ExercisePicker } = await import('./ExercisePicker')
    const calls: string[] = []
    render(() => (
      <ExercisePicker
        isOpen
        close={() => calls.push('close')}
        onPick={(id) => calls.push(`pick ${id}`)}
        legend={legend}
        onLegend={opens ? () => calls.push('legend') : undefined}
      />
    ))
    return { calls }
  }

  it('sits over the exercises under its own heading, in the shell’s words', async () => {
    await openWithLegend(WORDS, true)

    const groups = screen.getAllByTestId('sing-exercise-group')
    expect(groups[0]?.getAttribute('data-group')).toBe('legend')
    const legend = screen.getByTestId('sing-legend-card')
    expect(legend.textContent).toContain('The Evening Bell')
    expect(legend.textContent).toContain('Ends in 3 days')
    expect(legend.textContent).toContain('Your best 74%')
  })

  it('closes the sheet, then opens the Legend, once', async () => {
    const { calls } = await openWithLegend(WORDS, true)

    fireEvent.click(screen.getByTestId('sing-legend-card'))

    expect(calls).toEqual(['close', 'legend'])
  })

  it('draws no card while none is open', async () => {
    await openWithLegend(null, true)

    expect(screen.queryByTestId('sing-legend-card')).toBeNull()
  })

  it('draws no card on a build that cannot open one', async () => {
    await openWithLegend(WORDS, false)

    expect(screen.queryByTestId('sing-legend-card')).toBeNull()
  })
})
