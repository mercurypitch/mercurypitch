// ============================================================
// Lesson 19 tap take tests — each tune's beat, with the click and then without it
// ============================================================
//
// On the page's own markup, with the beat clock the kit's recorder and the
// pad, the claps, the notes and the bus recorded (WEB-SPEC, Toys 7; FACTS
// 31, 36, 37): the figure the second time through's beats from the start,
// 6/8's eight pads, nothing lit; either Start runs a 0.6 s lead, a bar
// counted in, the tune with the click on every beat and the tune again
// with the click stopped, then 0.35 s, the tune on the stored voice's
// clef; each bar's status as it begins, and nothing lit on the figure; the
// 3/4 Start redraws the figure as twelve pads; each tap a clap at once,
// and none outside a take; the judge's line and a tick where each tap fell
// once the take ends; the same Start stopping its take and the other
// starting its own; Stop or another sound ending it with no line; sound
// off and no Web Audio; and the card left for 600 ms.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import type * as BeatClockModule from '@/features/lessons/kit/beat-clock'
import { drive, finish, resetRuns, runs, } from '@/features/lessons/kit/beat-clock-recorder.test-fixtures'
import { scrollIntoViewAgain, scrollOutOfView, } from '@/features/lessons/kit/browser-doubles.test-fixtures'
import { AWAY_MS } from '@/features/lessons/kit/leave'
import { hz } from '@/features/lessons/kit/notes'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import { WOOD_LEVEL } from '@/features/lessons/kit/rhythm-bar'
import { heldSeconds } from '@/features/lessons/kit/rhythm-model'
import { Sound } from '@/features/lessons/kit/sound'
import type * as SoundAheadModule from '@/features/lessons/kit/sound-ahead'
import { midiOf } from '@/features/lessons/kit/staff-places'
import type * as TapPadModule from '@/features/lessons/kit/tap-pad'
import { VoiceChoice } from '@/features/lessons/kit/voice-choice'
import type * as WoodblockModule from '@/features/lessons/kit/woodblock'
import type * as DrumVoicesModule from '@/lib/drum-voices'
import { el, loadPage, settle, soundOn, words } from './page-dom.test-fixtures'
import { SIX_BPM, tuneNotes } from './rhythm-views'
import { barStatus, CLAP_LEVEL, initTake, TAKE_LEAD, TAKE_STATUS, TAKE_TAIL, takeBars, } from './take'
import { FRAMES, LINES } from './take-judge'

/** What the take did: its knocks, its claps, its notes, the pad's handler and the bus its claps go on. */
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
  BeatClock: (
    await import('@/features/lessons/kit/beat-clock-recorder.test-fixtures')
  ).FakeBeatClock,
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
  return initTake(el('#tapCard'))
}

const start = (key: '6-8' | '3-4') =>
  el<HTMLButtonElement>(`[data-take-start="${key}"]`)
const label = (key: '6-8' | '3-4') =>
  words(start(key).querySelector('[data-label]'))
const status = () => words(el('#takeStatus'))
const fig = () => el('[data-take-strip]')
const shown = (sel: string) => fig().querySelectorAll(sel).length

/** Taps on every beat of both times through, `late` ms after each (beat 0 at page time 0, as the recorder maps it). */
function tapClean(key: '6-8' | '3-4', late = 100): void {
  const f = FRAMES[key]
  for (
    let b = f.shape.pulseFrom;
    b < f.shape.judgedFrom + f.shape.onsets.length;
    b++
  )
    rec.tap?.(b * f.beatMs + late)
}

describe('the take, before a Start', () => {
  it("draws the 6/8 tune's beats from the start, four bars of two pads over the strip, nothing written or lit, with the ready line", () => {
    // Act
    mounted()

    // Assert (WEB-SPEC, Toys 7)
    expect(shown('.rb-pad')).toBe(8)
    expect(
      Array.from(fig().querySelectorAll('.rb-pad-n'), (n) => n.textContent),
    ).toEqual(['1', '2', '1', '2', '1', '2', '1', '2'])
    expect(shown('.rb-cell')).toBe(8)
    expect(shown('.rb-sym')).toBe(0)
    expect(shown('.rb-read:not(.is-hidden)')).toBe(0)
    expect(shown('.rb-pad.is-now')).toBe(0)
    expect(status()).toBe(TAKE_STATUS.ready)
  })
})

describe('the take', () => {
  it('runs a 0.6 s lead, a bar counted in, the 6/8 tune with the click on its two beats, then again with the click stopped, then 0.35 s', () => {
    // Arrange
    mounted()

    // Act
    start('6-8').click()
    const run = runs[0]
    const shape = Array.from({ length: 10 }, (_, i) => run.o.bar(i)?.beats)
    const focused = document.activeElement === el('[data-take-pad]')
    drive()

    // Assert (FACTS 36): nine bars of three quarters at 90, 18 s, with the lead and tail 18.95 s
    expect([run.o.lead, run.o.tail, run.o.bpm()]).toEqual([
      TAKE_LEAD,
      TAKE_TAIL,
      SIX_BPM,
    ])
    expect(shape).toEqual([3, 3, 3, 3, 3, 3, 3, 3, 3, undefined])
    expect(TAKE_LEAD + (9 * 3 * 60) / SIX_BPM + TAKE_TAIL).toBeCloseTo(18.95, 6)
    // the count-in and the first time through: a knock on each dotted quarter, beat 1 higher
    expect(rec.wood.map((a) => a[2])).toEqual(
      Array.from({ length: 10 }, (_, b) => b % 2 === 0),
    )
    expect(rec.wood.every((a) => a[3] === WOOD_LEVEL)).toBe(true)
    // the tune twice: fifteen notes each time
    expect(rec.notes).toHaveLength(30)
    expect([label('6-8'), focused]).toEqual(['Stop', true])
  })

  it("plays the 3/4 tune with the click on its three beats, and the tune on the stored voice's clef, each note its own pitch for its length", async () => {
    // Arrange
    vi.spyOn(VoiceChoice, 'voice', 'get').mockReturnValue('higher')
    mounted()

    // Act
    start('3-4').click()
    await finish()

    // Assert (FACTS 30, 36): three knocks to the count-in and to each bar of the first time through
    expect(rec.wood.map((a) => a[2])).toEqual(
      Array.from({ length: 15 }, (_, b) => b % 3 === 0),
    )
    const treble = tuneNotes('3-4', 'treble').map((n) => hz(midiOf(n)))
    expect(rec.notes.map((a) => a[0])).toEqual([...treble, ...treble])
    expect(
      rec.notes.slice(0, 4).map((a) => (a[1] as { dur: number }).dur),
    ).toEqual([
      heldSeconds(1, SIX_BPM),
      heldSeconds(1, SIX_BPM),
      heldSeconds(1, SIX_BPM),
      heldSeconds(2, SIX_BPM),
    ])
    expect(shown('.rb-pad')).toBe(12)
  })

  it("takes the lower voice's bass clef, from C3, when none is stored", () => {
    // Act
    const bars = takeBars('6-8', 'bass')
    const first = bars[1].hits.find((h) => h.data.k === 'note')

    // Assert (FACTS 10, 61)
    expect(first?.data).toEqual({
      k: 'note',
      freq: hz(midiOf({ letter: 'C', alter: 0, octave: 3 })),
      beats: 0.5,
    })
    expect(bars[5].hits.some((h) => h.data.k === 'click')).toBe(false)
  })

  it('says each bar as it begins, the first time through with the click and the second on your own, and lights nothing', () => {
    // Arrange
    mounted()
    start('6-8').click()

    // Act: a bar is three of the clock's beats
    const said: string[] = []
    const lit: number[] = []
    for (let b = 0; b < 9; b++) {
      drive(1)
      said.push(status())
      lit.push(shown('.rb-pad.is-now'))
      drive(2)
    }

    // Assert (FACTS 37)
    expect(said).toEqual([
      'Counting in: one bar.',
      'Tap with the click: bar 1 of 4',
      'Tap with the click: bar 2 of 4',
      'Tap with the click: bar 3 of 4',
      'Tap with the click: bar 4 of 4',
      'Now on your own: bar 1 of 4',
      'Now on your own: bar 2 of 4',
      'Now on your own: bar 3 of 4',
      'Now on your own: bar 4 of 4',
    ])
    expect(lit).toEqual(Array(9).fill(0))
    expect([barStatus(0), barStatus(4), barStatus(5)]).toEqual([
      TAKE_STATUS.countIn,
      'Tap with the click: bar 4 of 4',
      'Now on your own: bar 1 of 4',
    ])
  })

  it('claps each tap at once while the take runs, and takes no tap outside it', async () => {
    // Arrange
    mounted()
    rec.tap?.(100)

    // Act
    start('6-8').click()
    rec.tap?.(2100)
    await finish()
    rec.tap?.(30000)

    // Assert (FACTS 31): at the bus's now, on the bus, at 0.7
    expect(CLAP_LEVEL).toBe(0.7)
    expect(rec.claps).toEqual([
      ['clap', rec.bus?.context, 5, 0.7, rec.bus?.node],
    ])
  })

  it("reads the taps once the take ends: the judge's line and a gold tick where each tap fell", async () => {
    // Arrange
    mounted()
    start('3-4').click()

    // Act
    tapClean('3-4')
    await finish()

    // Assert (FACTS 34, 35)
    expect(status()).toBe(LINES.all(12))
    expect(shown('.rb-tick')).toBe(12)
    expect(shown('.rb-tick.is-met')).toBe(12)
    expect(label('3-4')).toBe('Start: the 3/4 tune')
    expect(rec.closed).toBe(1)
  })

  it('draws an unmet tap in ink, and none for a take it could not line up', async () => {
    // Arrange
    mounted()
    start('6-8').click()
    tapClean('6-8')
    rec.tap?.(10500 + 100)
    await finish()
    const between = [shown('.rb-tick'), shown('.rb-tick.is-met'), status()]

    // Act: again, with no taps while the click played
    start('6-8').click()
    const cleared = shown('.rb-tick')
    for (let b = 10; b < 18; b++) rec.tap?.(b * 1000 + 100)
    await finish()

    // Assert: a new take clears the last one's ticks at once
    expect(cleared).toBe(0)
    expect(between).toEqual([
      9,
      8,
      'Beats with a tap: 8 of 8. One tap fell between the beats.',
    ])
    expect(status()).toBe(LINES.notLined)
    expect(shown('.rb-tick')).toBe(0)
  })

  it('stops on its own Start, which says so, and on another sound, with no line', async () => {
    // Arrange
    mounted()
    start('6-8').click()
    tapClean('6-8')
    drive(6)

    // Act
    start('6-8').click()
    await settle()
    const stopped = [
      runs[0].stopped,
      status(),
      shown('.rb-tick'),
      rec.closed,
      label('6-8'),
      runs.length,
    ]
    start('6-8').click()
    NowPlaying.claim(() => undefined)
    await settle()

    // Assert
    expect(stopped).toEqual([
      true,
      TAKE_STATUS.stopped,
      0,
      1,
      'Start: the 6/8 tune',
      1,
    ])
    expect(runs[1].stopped).toBe(true)
    expect(status()).toBe(TAKE_STATUS.stopped)
  })

  it('stops a take on the other Start and starts its own, the figure redrawn for its tune', async () => {
    // Arrange
    mounted()
    start('6-8').click()
    drive(6)

    // Act
    start('3-4').click()
    await settle()

    // Assert: the take stopped is not the new one's to end
    expect(runs.map((r) => r.stopped)).toEqual([true, false])
    expect([label('6-8'), label('3-4')]).toEqual([
      'Start: the 6/8 tune',
      'Stop',
    ])
    expect(status()).toBe(TAKE_STATUS.countIn)
    expect(shown('.rb-pad')).toBe(12)
  })

  it("won't start with sound off, and says why", () => {
    // Arrange
    vi.spyOn(Sound, 'canPlay').mockReturnValue(false)
    mounted()

    // Act
    start('3-4').click()

    // Assert (WEB-SPEC, Toys 7): the kit's toast for a play that needs sound
    expect(Sound.canPlay).toHaveBeenCalledWith({ needsSound: true })
    expect(runs).toHaveLength(0)
    expect(status()).toBe(TAKE_STATUS.soundOff)
  })

  it('marks both Starts unusable in a browser with no Web Audio, and says why', () => {
    // Act: no AudioContext stubbed
    initTake(el('#tapCard'))
    start('6-8').click()

    // Assert
    expect(
      [start('6-8'), start('3-4')].map((b) => b.getAttribute('aria-disabled')),
    ).toEqual(['true', 'true'])
    expect(status()).toBe(TAKE_STATUS.noAudio)
    expect(runs).toHaveLength(0)
  })
})

describe('leaving the card', () => {
  it('ends a take once the card has been off screen for 600 ms', async () => {
    // Arrange
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    mounted()
    const card = el('#tapCard')
    start('6-8').click()
    drive(6)

    // Act
    scrollOutOfView(card)
    await vi.advanceTimersByTimeAsync(AWAY_MS - 1)
    const early = runs[0].stopped
    await vi.advanceTimersByTimeAsync(1)
    scrollIntoViewAgain(card)

    // Assert (WEB-SPEC, Edge cases)
    expect(early).toBe(false)
    expect([runs[0].stopped, status()]).toEqual([true, TAKE_STATUS.stopped])
  })
})
