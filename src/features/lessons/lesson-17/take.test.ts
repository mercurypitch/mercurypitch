// ============================================================
// Lesson 17 tap take tests — the two written bars, tapped over the click
// ============================================================
//
// On the page's own markup, with the beat clock a recorder and the pad,
// the claps and the bus recorded (WEB-SPEC, Toys 7, part 1; FACTS 36, 69):
// the bars drawn from the start, their strip empty; Start runs a 0.6 s
// lead, a bar counted in, two bars of every beat and the two written bars
// on the woodblock alone, then 0.35 s; each bar's status as it begins,
// each pad lit in the beat bars and each note as its start passes; each
// tap a clap at once, and none outside a take; the judge's line and a
// tick where each tap fell once the take ends, with Again and Hear the
// bars offered; Stop, or another sound, ending it with no line; sound off
// and no Web Audio; and Hear the bars after a bar counted in, the ticks
// left in place.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as BeatClockModule from '@/features/lessons/kit/beat-clock'
import { scrollIntoViewAgain, scrollOutOfView, } from '@/features/lessons/kit/browser-doubles.test-fixtures'
import { AWAY_MS } from '@/features/lessons/kit/leave'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import { WOOD_LEVEL } from '@/features/lessons/kit/rhythm-bar'
import { Sound } from '@/features/lessons/kit/sound'
import type * as SoundAheadModule from '@/features/lessons/kit/sound-ahead'
import type * as TapPadModule from '@/features/lessons/kit/tap-pad'
import type * as WoodblockModule from '@/features/lessons/kit/woodblock'
import type * as DrumVoicesModule from '@/lib/drum-voices'
import { drive, el, finish, loadPage, resetRuns, runs, settle, soundOn, words, } from './page-dom.test-fixtures'
import { CLAP_LEVEL, initTake, TAKE_LEAD, TAKE_STATUS, TAKE_TAIL } from './take'
import { LINES, TAKE_ONSETS } from './take-judge'

/** What the take did: its knocks, its claps, the pad's handler and the bus its claps go on. */
const rec = vi.hoisted(() => ({
  wood: [] as unknown[][],
  claps: [] as unknown[][],
  notes: [] as unknown[][],
  tap: null as ((at: number) => void) | null,
  bus: null as { context: object; node: object } | null,
  closed: 0,
}))

vi.mock('@/features/lessons/kit/beat-clock', async (actual) => ({
  ...(await actual<typeof BeatClockModule>()),
  BeatClock: (await import('./page-dom.test-fixtures')).FakeBeatClock,
}))
vi.mock('@/features/lessons/kit/woodblock', async (actual) => ({
  ...(await actual<typeof WoodblockModule>()),
  bookWood: (...a: unknown[]) => {
    rec.wood.push(a)
  },
}))
vi.mock('@/features/lessons/kit/sound-ahead', async (actual) => ({
  ...(await actual<typeof SoundAheadModule>()),
  bookNote: (...a: unknown[]) => {
    rec.notes.push(a)
    return null
  },
  openBus: () => {
    const bus = {
      context: { currentTime: 5 },
      node: {},
      open: true,
      close: () => {
        rec.closed += 1
      },
    }
    rec.bus = bus
    return bus
  },
}))
vi.mock('@/features/lessons/kit/tap-pad', async (actual) => ({
  ...(await actual<typeof TapPadModule>()),
  bindTapPad: (_pad: HTMLButtonElement, onTap: (at: number) => void) => {
    rec.tap = onTap
  },
}))
vi.mock('@/lib/drum-voices', async (actual) => ({
  ...(await actual<typeof DrumVoicesModule>()),
  triggerDrumVoice: (...a: unknown[]) => {
    rec.claps.push(a)
  },
}))

beforeEach(() => {
  rec.wood.length = 0
  rec.claps.length = 0
  rec.notes.length = 0
  rec.tap = null
  rec.bus = null
  rec.closed = 0
  resetRuns()
  soundOn()
  loadPage()
})

afterEach(() => {
  // a take left running stops here, not in the next test
  NowPlaying.claim(() => undefined)
  vi.useRealTimers()
  vi.restoreAllMocks()
  // jsdom has no AudioContext: leave none behind, without unstubbing the
  // browser doubles' globals as `vi.unstubAllGlobals` would
  vi.stubGlobal('AudioContext', undefined)
  document.body.textContent = ''
})

/** The take on the page's card, in a browser with Web Audio. */
function mounted(): ReturnType<typeof initTake> {
  vi.stubGlobal('AudioContext', vi.fn())
  return initTake(el('#singCard'))
}

const start = () => el<HTMLButtonElement>('[data-take-start]')
const status = () => words(el('#takeStatus'))
const fig = () => el('[data-take-bars]')
const shown = (sel: string) => fig().querySelectorAll(sel).length
const padLit = (): number[] =>
  Array.from(fig().querySelectorAll('.rb-pad.is-now'), (g) =>
    Number(g.getAttribute('data-beat')),
  )
const sounding = (): number[] =>
  Array.from(fig().querySelectorAll('.rb-sym.is-sounding'), (g) =>
    Number(g.getAttribute('data-i')),
  )

/** Taps on every beat of the beat bars and on every written note, `late` ms after each (beat 0 at page time 0). */
function tapClean(late = 100): void {
  for (let b = 4; b <= 11; b++) rec.tap?.(b * 1000 + late)
  for (const at of TAKE_ONSETS) rec.tap?.((12 + at) * 1000 + late)
}

describe('the take, before Start', () => {
  it('draws the two written bars from the start, their strip empty, with the ready line and nothing else offered', () => {
    // Act
    mounted()

    // Assert (WEB-SPEC, Toys 7)
    expect(shown('.rb-sym:not(.is-hidden)')).toBe(9)
    expect(shown('.rb-barline:not(.is-hidden)')).toBe(2)
    expect(shown('.rb-read:not(.is-hidden)')).toBe(0)
    expect(shown('.rb-pad')).toBe(8)
    expect(status()).toBe(TAKE_STATUS.ready)
    expect(el('[data-take-again]').hidden).toBe(true)
    expect(el('[data-take-hear]').hidden).toBe(true)
  })
})

describe('the take', () => {
  it('runs a 0.6 s lead, a bar counted in, two bars of every beat and the two written bars on the click alone, then 0.35 s', () => {
    // Arrange
    mounted()

    // Act
    start().click()
    const run = runs[0]
    const shape = Array.from({ length: 6 }, (_, i) => run.o.bar(i)?.beats)
    const label = words(el('[data-take-start] [data-label]'))
    const focused = document.activeElement === el('[data-take-pad]')
    drive()

    // Assert (FACTS 36): 20 beats at 60 BPM
    expect([run.o.lead, run.o.tail, run.o.bpm()]).toEqual([
      TAKE_LEAD,
      TAKE_TAIL,
      60,
    ])
    expect(shape).toEqual([4, 4, 4, 4, 4, undefined])
    expect(rec.wood).toHaveLength(20)
    expect(rec.wood.map((a) => a[2])).toEqual(
      Array.from({ length: 20 }, (_, b) => b % 4 === 0),
    )
    expect(rec.wood.every((a) => a[3] === WOOD_LEVEL)).toBe(true)
    expect(rec.notes).toHaveLength(0)
    expect([label, focused]).toEqual(['Stop', true])
  })

  it('says each bar as it begins, lights each pad in the beat bars, then each note as its start passes', () => {
    // Arrange
    mounted()
    start().click()

    // Act
    drive(1)
    const countIn = status()
    drive(4)
    const pulse = [status(), padLit()]
    drive(4)
    const second = [status(), padLit()]
    drive(4)
    const written = [status(), padLit(), sounding()]
    drive(4)
    const bar2 = [status(), padLit(), sounding()]

    // Assert (WEB-SPEC, Toys 7)
    expect(countIn).toBe(TAKE_STATUS.countIn)
    expect(pulse).toEqual(['Tap every beat: bar 1 of 2', [0]])
    expect(second).toEqual(['Tap every beat: bar 2 of 2', [4]])
    expect(written).toEqual(['Now the written bars: bar 1 of 2', [0], [0]])
    // the second written bar's first beat: both its eighths have started
    expect(bar2).toEqual(['Now the written bars: bar 2 of 2', [4], [4]])
  })

  it('claps each tap at once while the take runs, and takes no tap outside it', async () => {
    // Arrange
    mounted()
    rec.tap?.(100)

    // Act
    start().click()
    rec.tap?.(4100)
    await finish()
    rec.tap?.(30000)

    // Assert (FACTS 69): at the bus's now, on the bus
    expect(rec.claps).toEqual([
      ['clap', rec.bus?.context, 5, CLAP_LEVEL, rec.bus?.node],
    ])
  })

  it("reads the taps once the take ends: the judge's line, a tick where each tap fell, and Again and Hear the bars offered", async () => {
    // Arrange
    mounted()
    start().click()

    // Act
    tapClean()
    await finish()

    // Assert (FACTS 34, 35)
    expect(status()).toBe(LINES.all)
    expect(shown('.rb-tick')).toBe(9)
    expect(shown('.rb-tick.is-met')).toBe(9)
    expect(el('[data-take-again]').hidden).toBe(false)
    expect(el('[data-take-hear]').hidden).toBe(false)
    expect(words(el('[data-take-start] [data-label]'))).toBe(
      'Start: tap the rhythm',
    )
    expect(padLit()).toEqual([])
    expect(rec.closed).toBe(1)
  })

  it('draws an unmet tap in ink, and none for a take it could not line up', async () => {
    // Arrange
    mounted()
    start().click()
    tapClean()
    rec.tap?.(13500 + 100)
    await finish()
    const between = [shown('.rb-tick'), shown('.rb-tick.is-met')]

    // Act: Again, with no beat taps at all
    el<HTMLButtonElement>('[data-take-again]').click()
    for (const at of TAKE_ONSETS) rec.tap?.((12 + at) * 1000 + 100)
    await finish()

    // Assert
    expect(between).toEqual([10, 9])
    expect(status()).toBe(LINES.notLined)
    expect(shown('.rb-tick')).toBe(0)
  })

  it('ends with no line when stopped, by Stop or by another sound, its lights out and its bus closed', async () => {
    // Arrange: into the written bars
    mounted()
    start().click()
    tapClean()
    drive(13)
    const lit = [padLit(), sounding()]

    // Act
    start().click()
    await settle()
    const stopped = [
      runs[0].stopped,
      status(),
      shown('.rb-tick'),
      padLit(),
      sounding(),
      rec.closed,
      words(el('[data-take-start] [data-label]')),
    ]
    start().click()
    NowPlaying.claim(() => undefined)
    await settle()

    // Assert
    expect(lit).toEqual([[0], [0]])
    expect(stopped).toEqual([
      true,
      TAKE_STATUS.stopped,
      0,
      [],
      [],
      1,
      'Start: tap the rhythm',
    ])
    expect(runs[1].stopped).toBe(true)
    expect(status()).toBe(TAKE_STATUS.stopped)
    expect(el('[data-take-hear]').hidden).toBe(true)
  })

  it('starts afresh on Again, a take running included', async () => {
    // Arrange: a take heard to its end, then another begun
    mounted()
    start().click()
    await finish()
    start().click()
    drive(6)

    // Act
    el<HTMLButtonElement>('[data-take-again]').click()
    await settle()

    // Assert: the take stopped is not the new one's to end
    expect(runs.map((r) => r.stopped)).toEqual([false, true, false])
    expect(status()).toBe(TAKE_STATUS.countIn)
    expect(words(el('[data-take-start] [data-label]'))).toBe('Stop')
  })

  it("won't start with sound off, and says why", () => {
    // Arrange
    vi.spyOn(Sound, 'canPlay').mockReturnValue(false)
    mounted()

    // Act
    start().click()

    // Assert (WEB-SPEC, Toys 7, "Sound off"): the kit's toast for a play that needs sound
    expect(Sound.canPlay).toHaveBeenCalledWith({ needsSound: true })
    expect(runs).toHaveLength(0)
    expect(status()).toBe(TAKE_STATUS.soundOff)
  })

  it('marks Start unusable in a browser with no Web Audio, and says why', () => {
    // Act: no AudioContext stubbed
    initTake(el('#singCard'))
    start().click()

    // Assert
    expect(start().getAttribute('aria-disabled')).toBe('true')
    expect(status()).toBe(TAKE_STATUS.noAudio)
    expect(runs).toHaveLength(0)
  })
})

describe('Hear the bars', () => {
  it('plays the two bars on the voice after a bar counted in, each cell read as it ends, the ticks left in place', async () => {
    // Arrange: a take heard to its end
    mounted()
    start().click()
    tapClean()
    await finish()

    // Act
    el<HTMLButtonElement>('[data-take-hear]').click()
    const run = runs[1]
    const first = run.o.bar(0)
    const label = words(el('[data-take-hear] [data-label]'))
    await finish()

    // Assert (WEB-SPEC, Toys 7): 4 s counted in, then 8 s
    expect(first?.beats).toBe(4)
    expect(
      first?.hits.every((h) => (h.data as { k: string }).k === 'click'),
    ).toBe(true)
    expect(rec.notes).toHaveLength(9)
    expect(label).toBe('Stop')
    expect(shown('.rb-read:not(.is-hidden)')).toBeGreaterThan(0)
    expect(shown('.rb-tick')).toBe(9)
    expect(words(el('[data-take-hear] [data-label]'))).toBe('Hear the bars')
  })

  it('stops on a second press, plays on a third at once, and gives way to a new take', async () => {
    // Arrange
    mounted()
    start().click()
    tapClean()
    await finish()
    const hear = el<HTMLButtonElement>('[data-take-hear]')
    hear.click()

    // Act: pressed again, and again at once
    hear.click()
    hear.click()
    await settle()
    const again = [
      runs[1].stopped,
      runs[2].stopped,
      words(el('[data-take-hear] [data-label]')),
    ]
    start().click()
    await settle()

    // Assert
    expect(again).toEqual([true, false, 'Stop'])
    expect(runs[2].stopped).toBe(true)
    expect(runs).toHaveLength(4)
    expect(shown('.rb-tick')).toBe(0)
    expect(words(el('[data-take-hear] [data-label]'))).toBe('Hear the bars')
  })

  it('ends a take running, which says it stopped', async () => {
    // Arrange: a take heard to its end, then another begun
    mounted()
    start().click()
    await finish()
    start().click()
    drive(6)

    // Act
    el<HTMLButtonElement>('[data-take-hear]').click()
    await settle()

    // Assert
    expect(runs.map((r) => r.stopped)).toEqual([false, true, false])
    expect(status()).toBe(TAKE_STATUS.stopped)
    expect(words(el('[data-take-start] [data-label]'))).toBe(
      'Start: tap the rhythm',
    )
    expect(words(el('[data-take-hear] [data-label]'))).toBe('Stop')
  })
})

describe('leaving the card', () => {
  it('ends a take, or Hear the bars, once the card has been off screen for 600 ms', async () => {
    // Arrange
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    mounted()
    const card = el('#singCard')
    start().click()
    drive(6)

    // Act: a take, then the bars heard
    scrollOutOfView(card)
    await vi.advanceTimersByTimeAsync(AWAY_MS - 1)
    const early = runs[0].stopped
    await vi.advanceTimersByTimeAsync(1)
    const take = [runs[0].stopped, status()]
    scrollIntoViewAgain(card)
    start().click()
    await finish()
    el<HTMLButtonElement>('[data-take-hear]').click()
    scrollOutOfView(card)
    await vi.advanceTimersByTimeAsync(AWAY_MS)

    // Assert (WEB-SPEC, Toys 7, "Stopping")
    expect(early).toBe(false)
    expect(take).toEqual([true, TAKE_STATUS.stopped])
    expect(runs[2].stopped).toBe(true)
    expect(words(el('[data-take-hear] [data-label]'))).toBe('Hear the bars')
  })
})
