// ============================================================
// Lesson 9 steps tests — Step 3's climb and leaps, and Step 4's five, in time
// ============================================================
//
// Steps 3 and 4 on the page's own markup and deck, through the kit's own
// runs on fake timers, hearing every voice the page starts and when (a spy
// on the kit's `Sound.voice`), with Merc and Tavi's renderer left out.
// The climb sounds do, mi, so and the top do, 1.0 s each, lighting each
// rung as it sounds, and clears the line a leap left; each leap over the
// climb sounds do then its rung, draws its arc from do's slot over the
// slots between as the second note starts, and says what it skips
// (WEB-SPEC, Toys 1). Step 4's five leaps come in the syllabus's order,
// 0.6 s apart (FACTS 36, 93): each arc draws as its second note starts,
// numbered 1 to 5, the status line naming that leap then and not before;
// the play lasts 12.4 s, or 24.8 s with Slow (Tests 4). A Four words play
// over the climb stops it, and Climb stops a word (Tests 14). The kit's
// browser doubles hold reduced motion on, so a rung lights and an arc
// draws whole at once, and the chart can be read at any moment.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import type * as MercDuo from '@/features/lessons/kit/merc-duo'
import type { Voice } from '@/features/lessons/kit/sound'
import { Sound } from '@/features/lessons/kit/sound'
import { VoiceChoice } from '@/features/lessons/kit/voice-choice'
import { overLine } from './lines'
import { el, mountSteps, settle, soundOn } from './page-dom.test-fixtures'
import type { SoundNote } from './sounds'
import { climbNotes, fiveLeapsNotes, leapNotes, OVER_LEAPS } from './sounds'
import type { Steps } from './steps'
import { initWords } from './words'

vi.mock('@/features/lessons/kit/merc-duo', async (actual) => ({
  ...(await actual<typeof MercDuo>()),
  mercSing: vi.fn(),
}))

/** A voice the page started: its MIDI note, and when, seconds since the last press. */
interface Heard {
  readonly midi: number
  readonly at: number
}

let heard: Heard[]
// which of `heard` have been stopped, by index
let cut: number[]
let steps: Steps
// when the last play was pressed, ms on the test's clock
let pressedAt = 0

/** The voices `notes` should start: each note's MIDI note and onset, to the clock's millisecond. */
const onsets = (notes: readonly SoundNote[]): Heard[] =>
  notes.map((n) => ({ midi: n.midi, at: Math.round(n.t * 1000) / 1000 }))

/** Sound on, every voice heard, the clock at 0; the page on step `n`. */
function open(n: number): void {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'], now: 0 })
  soundOn()
  heard = []
  cut = []
  // a play left sounding by the test before is stopped by this test's
  // first press (the page's one sound outlives a test): its voices report
  // to that test's lists, never to this one's
  const [mine, stopped] = [heard, cut]
  vi.spyOn(Sound, 'voice').mockImplementation((freq: number) => {
    const i = mine.length
    mine.push({
      midi: Math.round(69 + 12 * Math.log2(freq / 440)),
      at: (Date.now() - pressedAt) / 1000,
    })
    const voice: Voice = {
      alive: true,
      setFreq: () => undefined,
      setGain: () => undefined,
      stop: () => {
        stopped.push(i)
      },
    }
    return voice
  })
  const deck = mountSteps()
  deck.show(n)
  steps = deck
}

const press = (id: string): void => {
  pressedAt = Date.now()
  el(`#toyLadder [data-ladder-play="${id}"]`).click()
}
const status = (): string => el('[data-ladder-status]').textContent ?? ''
const sounding = (id: string): boolean =>
  el(`#toyLadder [data-ladder-play="${id}"]`).classList.contains('is-on')

/** Each rung's glow now, low to high. */
const glows = (): number[] =>
  (steps.ladder.chart.scene.rungs ?? []).map((r) => r.glow ?? 0)

/** How far each arc is drawn now. */
const drawn = (): number[] =>
  (steps.ladder.chart.scene.arcs ?? []).map((a) => a.drawn ?? 1)

/** Runs the clock `ms` on, and lets the promises the page awaits settle. */
async function run(ms: number): Promise<void> {
  vi.advanceTimersByTime(ms)
  await settle()
}

beforeEach(() => {
  localStorage.clear()
  VoiceChoice.set('lower')
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  window.location.hash = ''
  document.body.textContent = ''
})

describe("Lesson 9's Step 3", () => {
  it('climbs do, mi, so and the top do, 1.0 s each, lighting each rung as it sounds, and clears the line a leap left', async () => {
    // Arrange: Leap to so heard to its end, its line still showing
    open(3)
    press('to-so')
    await run(2000)
    const left = status()
    heard.splice(0)

    // Act: the climb, the chart read as each note starts
    press('climb')
    const lit: number[][] = []
    for (let i = 0; i < 4; i++) {
      await run(i === 0 ? 0 : 1000)
      lit.push(glows())
    }
    await run(1000)

    // Assert
    expect(left).toBe('Do to so: a perfect fifth, 7 semitones, over mi.')
    expect(status()).toBe('')
    expect(heard).toEqual(onsets(climbNotes(50)))
    expect(heard.map((h) => h.midi)).toEqual([50, 54, 57, 62])
    expect(lit).toEqual([
      [1, 0, 0, 0],
      [0, 1, 0, 0],
      [0, 0, 1, 0],
      [0, 0, 0, 1],
    ])
    expect(glows()).toEqual([0, 0, 0, 0])
    expect(sounding('climb')).toBe(false)
  })

  // each leap: its button, which of the two, the slot it lands on, that rung in cents from do, its line
  it.each([
    ['to-so', 0, 2, 700, 'Do to so: a perfect fifth, 7 semitones, over mi.'],
    [
      'to-top',
      1,
      3,
      1200,
      'Do to the top do: an octave, 12 semitones, over mi and so.',
    ],
  ] as const)(
    'plays %s as do then its rung, its arc drawn from do over the slots between as the second note starts, and says what it skips',
    async (id, k, slot, cents, line) => {
      // Arrange
      open(3)
      const places = steps.ladder.view.places

      // Act: the first note, then the second
      press(id)
      await run(999)
      const before = drawn()
      await run(1)
      const arc = steps.ladder.chart.scene.arcs?.[0]

      // Assert
      expect(status()).toBe(line)
      expect(line).toBe(overLine(OVER_LEAPS[k]))
      expect(heard).toEqual(onsets(leapNotes(50, OVER_LEAPS[k])))
      expect(before).toEqual([0])
      expect(drawn()).toEqual([1])
      expect(arc?.from).toEqual({ t: places[0].to, c: 0 })
      expect(arc?.to).toEqual({ t: places[slot].from, c: cents })
      // every slot between lies under the arc
      for (const p of places.slice(1, slot)) {
        expect(p.from).toBeGreaterThan(arc?.from.t ?? Infinity)
        expect(p.to).toBeLessThan(arc?.to.t ?? -Infinity)
      }
    },
  )

  it('climbs at half speed with Slow, each note 2.0 s, at the same pitches', async () => {
    // Arrange
    open(3)
    el('[data-ladder-slow]').click()

    // Act
    press('climb')
    await run(7999)
    const still = sounding('climb')
    await run(1)

    // Assert
    expect(heard).toEqual(onsets(climbNotes(50, 2)))
    expect(heard.map((h) => h.at)).toEqual([0, 2, 4, 6])
    expect(heard.map((h) => h.midi)).toEqual([50, 54, 57, 62])
    expect(still).toBe(true)
    expect(sounding('climb')).toBe(false)
  })
})

describe("Lesson 9's Step 4", () => {
  it.each([
    ['lower', 50],
    ['higher', 62],
  ] as const)(
    "plays the five leaps for the %s voice in the syllabus's order, mi to so, do to mi, do to so, so to the top do, do to the top do, 0.6 s apart",
    async (voice, d) => {
      // Arrange
      VoiceChoice.set(voice)
      open(4)

      // Act
      press('five')
      await run(12400)

      // Assert
      expect(heard).toEqual(onsets(fiveLeapsNotes(d)))
      expect(heard.map((h) => h.midi - d)).toEqual([
        4, 7, 0, 4, 0, 7, 7, 12, 0, 12,
      ])
      expect(heard.map((h) => h.at)).toEqual([
        0, 1, 2.6, 3.6, 5.2, 6.2, 7.8, 8.8, 10.4, 11.4,
      ])
    },
  )

  it('draws each arc as its second note starts, numbered 1 to 5 in its own column, and names that leap then and not before', async () => {
    // Arrange
    open(4)

    // Act: the chart and the line just before each leap's second note, and as it starts
    press('five')
    const said: string[] = []
    const shown: number[][] = []
    let now = 0
    for (let k = 0; k < 5; k++) {
      const second = (k * 2.6 + 1) * 1000
      await run(second - 1 - now)
      said.push(status())
      shown.push(drawn())
      await run(1)
      said.push(status())
      shown.push(drawn())
      now = second
    }
    const arcs = (steps.ladder.chart.scene.arcs ?? []).map((a) => [
      a.from.c,
      a.to.c,
      a.digit,
    ])

    // Assert
    expect(said).toEqual([
      '',
      '1 of 5: mi to so, a minor third, 3 semitones',
      '1 of 5: mi to so, a minor third, 3 semitones',
      '2 of 5: do to mi, a major third, 4 semitones',
      '2 of 5: do to mi, a major third, 4 semitones',
      '3 of 5: do to so, a perfect fifth, 7 semitones',
      '3 of 5: do to so, a perfect fifth, 7 semitones',
      '4 of 5: so to the top do, a perfect fourth, 5 semitones',
      '4 of 5: so to the top do, a perfect fourth, 5 semitones',
      '5 of 5: do to the top do, an octave, 12 semitones',
    ])
    expect(shown).toEqual([
      [0, 0, 0, 0, 0],
      [1, 0, 0, 0, 0],
      [1, 0, 0, 0, 0],
      [1, 1, 0, 0, 0],
      [1, 1, 0, 0, 0],
      [1, 1, 1, 0, 0],
      [1, 1, 1, 0, 0],
      [1, 1, 1, 1, 0],
      [1, 1, 1, 1, 0],
      [1, 1, 1, 1, 1],
    ])
    expect(arcs).toEqual([
      [400, 700, 1],
      [0, 400, 2],
      [0, 700, 3],
      [700, 1200, 4],
      [0, 1200, 5],
    ])
  })

  it.each([
    [false, 12400, 11.4],
    [true, 24800, 22.8],
  ])(
    'sounds for exactly its length, Slow pressed %s: %d ms, its last note at %d s',
    async (slow, ms, last) => {
      // Arrange
      open(4)
      if (slow) el('[data-ladder-slow]').click()

      // Act
      press('five')
      await run(ms - 1)
      const still = sounding('five')
      await run(1)

      // Assert
      expect(still).toBe(true)
      expect(sounding('five')).toBe(false)
      expect(heard).toHaveLength(10)
      expect(heard[heard.length - 1].at).toBeCloseTo(last, 9)
      expect(drawn()).toEqual([1, 1, 1, 1, 1])
    },
  )

  it("starts again with an empty line when pressed again, the last leap's line cleared", async () => {
    // Arrange: the five heard to their end
    open(4)
    press('five')
    await run(12400)
    const left = status()

    // Act
    press('five')
    await run(0)

    // Assert
    expect(left).toBe('5 of 5: do to the top do, an octave, 12 semitones')
    expect(status()).toBe('')
    expect(drawn()).toEqual([0, 0, 0, 0, 0])
  })
})

describe("Lesson 9's one sound at a time, over Step 3's climb", () => {
  it('stops the climb when a Four words play starts over it, and a press of Climb stops the word', async () => {
    // Arrange: the climb on its second note
    open(3)
    initWords()
    press('climb')
    await run(1100)

    // Act: the four words' Leap, heard to its end; then Climb over Arpeggio
    pressedAt = Date.now()
    el('[data-word-play="leap"]').click()
    await run(2500)
    const afterLeap = { heard: heard.length, cut: [...cut] }
    el('[data-word-play="arpeggio"]').click()
    await run(100)
    press('climb')
    await run(5000)

    // Assert: the climb's do and mi, mi cut short and so never started; the
    // word's do and so whole; the arpeggio's do cut, and the climb's four
    // whole (a run's stop reaches every voice it started, do's long over)
    expect(afterLeap.heard).toBe(4)
    expect(afterLeap.cut).toContain(1)
    expect(heard.slice(0, 4).map((h) => h.midi)).toEqual([50, 54, 50, 57])
    expect(heard.slice(5).map((h) => h.midi)).toEqual([50, 54, 57, 62])
    expect(cut).toContain(4)
    expect(cut.filter((i) => i >= 2 && i !== 4)).toEqual([])
    expect(sounding('climb')).toBe(false)
  })
})
