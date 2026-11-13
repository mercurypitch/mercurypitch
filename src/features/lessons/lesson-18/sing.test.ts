// ============================================================
// Lesson 18 Sing it tests — the card on the page's own markup
// ============================================================
//
// With the beat clock a recorder, the microphone's hold and the take's
// module fakes the test drives, and the browser's clock a fake one
// (WEB-SPEC, Toys 5; FACTS 49 to 60): the comfort check first; the
// learner's staff, tune 1 in the bass with its breath mark, the house, the
// count-in strip and the names off; Start opens the microphone, then do in
// Merc's "ooh" lighting only the house's note, the count-in with its line,
// and the take opening half a beat before bar 1, on bar 1 as the beat
// clock times it; the cursor's line once bar 1 starts; Merc and Tavi
// listening and nothing else on the page playing during the take; the
// lines and the pitch line half a second after it, never during it; tune
// 2, Stop here and Play Merc's tunes; no voice, sound off, a start cut by
// sound off, a take abandoned; and with no microphone both tunes, each
// with its own Play the start.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import type * as BeatClockModule from '@/features/lessons/kit/beat-clock'
import { VisitEnding } from '@/features/lessons/kit/comfort'
import type * as MercDuo from '@/features/lessons/kit/merc-duo'
import { hz } from '@/features/lessons/kit/notes'
import { Sound } from '@/features/lessons/kit/sound'
import type * as SoundAheadModule from '@/features/lessons/kit/sound-ahead'
import type * as TakeKit from '@/features/lessons/kit/take-in-time'
import type { PitchLine, TakeContext, TakeEnd, } from '@/features/lessons/kit/take-in-time'
import { OPEN_BEATS } from '@/features/lessons/kit/take-in-time'
import { VoiceChoice } from '@/features/lessons/kit/voice-choice'
import type * as WoodblockModule from '@/features/lessons/kit/woodblock'
import { drive, el, loadPage, resetRuns, runs, settle, soundOn, words, } from './page-dom.test-fixtures'
import { AFTER_SEC, initSing } from './sing'
import { STATUS } from './sing-flow'

vi.mock('@/features/lessons/kit/beat-clock', async (actual) => ({
  ...(await actual<typeof BeatClockModule>()),
  BeatClock: (await import('./page-dom.test-fixtures')).FakeBeatClock,
}))
/** What the page booked: each note's frequency and voice. */
const booked = vi.hoisted(() => ({
  notes: [] as { freq: number; kind: string | undefined }[],
}))
vi.mock('@/features/lessons/kit/sound-ahead', async (actual) => ({
  ...(await actual<typeof SoundAheadModule>()),
  bookNote: (freq: number, o: { kind?: string }) => {
    booked.notes.push({ freq, kind: o.kind })
    return null
  },
}))
vi.mock('@/features/lessons/kit/woodblock', async (actual) => ({
  ...(await actual<typeof WoodblockModule>()),
  bookWood: () => undefined,
}))

/** The microphone the test grants or refuses, and how often it was let go. */
const mic = vi.hoisted(() => ({ ok: true, opened: 0, released: 0 }))
vi.mock('@/features/lessons/kit/mic-hold', () => ({
  MicHold: class {
    mod = {}
    listener = {}
    async open(): Promise<boolean> {
      mic.opened++
      return mic.ok
    }
    release(): void {
      mic.released++
    }
  },
}))

/** Merc's and Tavi's turns to listen, and back, in order. */
const listens = vi.hoisted(() => [] as (readonly [string, boolean])[])
vi.mock('@/features/lessons/kit/merc-duo', async (actual) => ({
  ...(await actual<typeof MercDuo>()),
  mercListen: (which: string, on: boolean) => listens.push([which, on]),
}))

/** The takes the page ran, how the test ends each, and the pitch lines it drew. */
let takes: TakeContext[] = []
let ends: ((e: TakeEnd) => void)[] = []
let drawn: { notes: readonly number[]; labels: readonly string[] }[] = []
const loadTake = async (): Promise<typeof TakeKit> =>
  ({
    OPEN_BEATS,
    runTake: (c: TakeContext) => {
      takes.push(c)
      return new Promise<TakeEnd>((r) => ends.push(r))
    },
    drawPitchLine: (
      _root: HTMLElement,
      _pitch: PitchLine,
      notes: readonly number[],
      labels: readonly string[],
    ) => drawn.push({ notes, labels }),
  }) as unknown as typeof TakeKit

/** A take's pitch line, as the take's module would hand it over. */
const PITCH: PitchLine = {
  seconds: 8.75,
  rungs: [{ c: 0, from: 0.5, to: 1.42 }],
  line: [{ t: 0.5, c: 0 }],
  octaves: 0,
}

beforeEach(() => {
  // a browser with Web Audio: the take's path, not the no-microphone one
  ;(window as { AudioContext?: unknown }).AudioContext = vi.fn()
  vi.useFakeTimers()
  localStorage.clear()
  resetRuns()
  soundOn()
  vi.spyOn(Sound, 'context').mockReturnValue(null)
  mic.ok = true
  mic.opened = 0
  mic.released = 0
  takes = []
  ends = []
  drawn = []
  listens.length = 0
  booked.notes.length = 0
  VoiceChoice.set('lower')
  loadPage()
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  delete (window as { AudioContext?: unknown }).AudioContext
  document.body.textContent = ''
})

const status = () => words(el('#singStatus'))
const shown = (sel: string): boolean => !el(sel).hidden
const press = (sel: string): void => el<HTMLButtonElement>(sel).click()
const staff = (n = 1) => el(`[data-sing-viz="${n}"]`)
/** The notes lit as sounding on a staff, by place. */
const lit = (n = 1): number[] =>
  Array.from(staff(n).querySelectorAll('.rb-sym')).flatMap((g, i) =>
    g.classList.contains('is-sounding') ? [i] : [],
  )
/** The last run's frame, as the clock draws it. */
const frame = (bar: number, beat: number, beats: number): void =>
  runs[runs.length - 1].o.onFrame?.({ bar, beat, beats })
const G3 = 55
const A3 = 57
const B3 = 59
const D4 = 62

/** Comfortable, then Start: the microphone opened and the start under way. */
async function toStart(): Promise<void> {
  press('[data-comfort="sing"]')
  press('[data-sing="start"]')
  await settle()
}

/** From Start to bar 1: do and the count-in, the take open half a beat before bar 1, then bar 1. */
async function toTake(): Promise<void> {
  await toStart()
  drive(4)
  frame(0, 3, 3.5)
  frame(1, 0, 4)
}

/** The bars heard to their end, then the open take ending with `lines`, or with no voice when there are none, and the half second after it. */
async function endTake(lines: readonly string[]): Promise<void> {
  runs.at(-1)?.end(true)
  await settle()
  const voiced = lines.length > 0
  ends.at(-1)?.({ kind: 'read', voiced, lines, pitch: voiced ? PITCH : null })
  await settle()
  vi.advanceTimersByTime(AFTER_SEC * 1000)
  await settle()
}

describe('before a take', () => {
  it('opens on the comfort check, every visit', () => {
    // Act
    initSing({ loadTake })

    // Assert: state 1
    expect(shown('[data-panel="comfort"]')).toBe(true)
    expect(shown('[data-panel="prepare"]')).toBe(false)
    expect(status()).toBe(STATUS.comfort)
  })

  it('draws tune 1 on the bass staff for the lower voice, with its breath mark, the house, the count-in strip and the names off', () => {
    // Arrange
    initSing({ loadTake })

    // Act
    press('[data-comfort="sing"]')

    // Assert: state 4 (FACTS 50)
    expect(shown('[data-panel="prepare"]')).toBe(true)
    expect(staff().getAttribute('aria-label')).toBe(
      'Bass staff, two bars of 4/4: G, A, B, D, then D, B and a long G, with a breath mark at the bar line',
    )
    expect(staff().querySelectorAll('.rb-sym')).toHaveLength(7)
    expect(staff().querySelectorAll('[data-mark="breath"]')).toHaveLength(1)
    expect(staff().querySelectorAll('.rd-house')).toHaveLength(1)
    expect(staff().querySelectorAll('.rd-dot')).toHaveLength(4)
    expect(staff().querySelectorAll('.rd-syl')).toHaveLength(0)
    expect(staff().querySelectorAll('.rd-cursor')).toHaveLength(0)
    expect(shown('[data-sing-names]')).toBe(true)
    expect(shown('[data-sing="start"]')).toBe(true)
    expect(shown('#singStaff2')).toBe(false)
    expect(status()).toBe(STATUS.turn)
  })

  it('writes each note’s syllable while Names is on, and takes them away again', () => {
    // Arrange
    initSing({ loadTake })
    press('[data-comfort="sing"]')

    // Act
    press('[data-sing-names] [data-names="on"]')
    const on = Array.from(staff().querySelectorAll('.rd-syl'), (t) => words(t))
    press('[data-sing-names] [data-names="off"]')

    // Assert
    expect(on).toEqual(['do', 're', 'mi', 'so', 'so', 'mi', 'do'])
    expect(staff().querySelectorAll('.rd-syl')).toHaveLength(0)
    expect(
      el('[data-sing-names] [data-names="off"]').getAttribute('aria-pressed'),
    ).toBe('true')
  })

  it('asks nothing of the microphone with sound off, and says so beside Start', async () => {
    // Arrange
    vi.spyOn(Sound, 'canPlay').mockReturnValue(false)
    initSing({ loadTake })

    // Act
    await toStart()

    // Assert: state 5
    expect([mic.opened, runs.length]).toEqual([0, 0])
    expect(words(el('#startHint'))).toBe(
      'Sound is off, so nothing played. Turn sound on to hear the start, then press Start.',
    )
  })
})

describe('the start and the take', () => {
  it('opens the microphone, then sings do in Merc’s ooh, lighting only the house’s note, then counts in with its line', async () => {
    // Arrange
    initSing({ loadTake })

    // Act
    await toStart()
    const before = status()
    runs[0].o.onHit?.({ k: 'do' }, { bar: 0, beat: 0, beats: -1.4 })
    const onDo = lit()
    drive(1)

    // Assert: state 5 (FACTS 49)
    expect(mic.opened).toBe(1)
    expect(booked.notes).toEqual([{ freq: hz(G3), kind: 'merc' }])
    expect(onDo).toEqual([0])
    expect(before).toBe(STATUS.turn)
    expect(status()).toBe('Counting in: one bar.')
    expect(lit()).toEqual([])
    expect(staff().querySelectorAll('.rd-dot.is-lit')).toHaveLength(1)
  })

  it('opens the take half a beat before bar 1, on bar 1 as the beat clock times it, then asks for the tune in time', async () => {
    // Arrange
    initSing({ loadTake })
    await toStart()
    drive(4)

    // Act
    frame(0, 3, 3.4)
    const early = takes.length
    frame(0, 3, 3.5)
    const statusAtOpen = status()
    frame(1, 0, 4)

    // Assert: state 6 (FACTS 82); the recorder times beat n at n s
    expect(early).toBe(0)
    expect(takes).toHaveLength(1)
    expect(takes[0].bar1).toBe(4000)
    expect(takes[0].bpm).toBe(60)
    expect(takes[0].notes.map((n) => [n.midi, n.beat, n.beats])).toEqual([
      [G3, 0, 1],
      [A3, 1, 1],
      [B3, 2, 1],
      [D4, 3, 1],
      [D4, 4, 1],
      [B3, 5, 1],
      [G3, 6, 2],
    ])
    expect(takes[0].labels).toEqual(['Do', 'Re', 'Mi', 'So', 'So', 'Mi', 'Do'])
    expect(statusAtOpen).toBe('Counting in: one bar.')
    expect(status()).toBe('Your turn: sing in time with the cursor.')
    expect(staff().querySelectorAll('.rd-cursor')).toHaveLength(1)
  })

  it('lets nothing else on the page play from Start to the take’s end, and turns Merc and Tavi to listen while the take runs', async () => {
    // Arrange
    initSing({ loadTake })
    const word = el<HTMLButtonElement>('[data-word-play="slur"]')
    const heard: string[] = []
    word.addEventListener('click', () => heard.push('word'))

    // Act
    await toStart()
    const counting = [[...listens], word.disabled]
    drive(4)
    frame(0, 3, 3.5)
    frame(1, 0, 4)
    const during = [[...listens], word.disabled]
    word.disabled = false
    word.click()
    await endTake(['Do · Right in the middle: on the written note.'])
    word.click()

    // Assert (WEB-SPEC, Audio, the sound rules 4)
    expect(counting).toEqual([[], true])
    expect(during).toEqual([
      [
        ['blue', true],
        ['orange', true],
      ],
      true,
    ])
    expect(listens.slice(2)).toEqual([
      ['blue', false],
      ['orange', false],
    ])
    expect(word.disabled).toBe(false)
    expect(heard).toEqual(['word'])
  })

  it('draws the lines and the pitch line half a second after the take, never during it, and asks how it felt', async () => {
    // Arrange
    initSing({ loadTake })
    await toTake()
    runs.at(-1)?.end(true)
    await settle()

    // Act
    const during = shown('#singLive')
    ends[0]({
      kind: 'read',
      voiced: true,
      lines: ['Do · In the band: 20 cents above the written note.'],
      pitch: PITCH,
    })
    await settle()
    const soon = [drawn.length, shown('[data-panel="feel"]')]
    vi.advanceTimersByTime(AFTER_SEC * 1000)
    await settle()

    // Assert: states 7 and 8
    expect(during).toBe(false)
    expect(soon).toEqual([0, false])
    expect(drawn).toEqual([
      {
        notes: [G3, A3, B3, D4, D4, B3, G3],
        labels: ['Do', 'Re', 'Mi', 'So', 'So', 'Mi', 'Do'],
      },
    ])
    expect(
      Array.from(document.querySelectorAll('[data-readings] li'), (li) =>
        words(li),
      ),
    ).toEqual(['Do · In the band: 20 cents above the written note.'])
    expect(shown('#singLive')).toBe(true)
    expect(shown('[data-panel="feel"]')).toBe(true)
    expect(mic.released).toBe(1)
    expect(status()).toBe(STATUS.feel)
  })

  it('says it did not hear a start, with Start again and no question, after a take with no voice', async () => {
    // Arrange
    initSing({ loadTake })
    await toTake()

    // Act
    await endTake([])

    // Assert: FACTS 57
    expect(shown('[data-after="silent"]')).toBe(true)
    expect(shown('[data-after-cue]')).toBe(true)
    expect(shown('[data-sing="again"]')).toBe(true)
    expect(shown('[data-panel="feel"]')).toBe(false)
    expect(shown('#singLive')).toBe(false)
  })

  it('ends the start with no take counted when the sound turns off in the count-in', async () => {
    // Arrange
    const subs: ((s: string) => void)[] = []
    vi.spyOn(Sound, 'subscribe').mockImplementation((fn) => {
      subs.push(fn as (s: string) => void)
      return () => undefined
    })
    initSing({ loadTake })
    const word = el<HTMLButtonElement>('[data-word-play="slur"]')
    await toStart()
    drive(1)
    const held = word.disabled

    // Act
    for (const fn of subs) fn('off')
    await settle()

    // Assert: the page's plays given back
    expect(runs[0].stopped).toBe(true)
    expect(takes).toHaveLength(0)
    expect(mic.released).toBe(1)
    expect([held, word.disabled]).toEqual([true, false])
    expect(shown('[data-sing="start"]')).toBe(true)
    expect(status()).toBe(STATUS.turn)
  })

  it('counts a take abandoned when the page is hidden, and offers the same tune again', async () => {
    // Arrange
    initSing({ loadTake })
    await toTake()

    // Act
    Object.defineProperty(document, 'hidden', {
      value: true,
      configurable: true,
    })
    document.dispatchEvent(new Event('visibilitychange'))
    const cancelled = takes[0].cancelled()
    ends[0]({ kind: 'left' })
    await settle()
    Object.defineProperty(document, 'hidden', {
      value: false,
      configurable: true,
    })

    // Assert
    expect(cancelled).toBe(true)
    expect(runs[0].stopped).toBe(true)
    expect(status()).toBe(STATUS.left)
    expect(shown('[data-sing="again"]')).toBe(true)
  })
})

describe('after the first tune', () => {
  it('offers tune 2 after Easy, and reads do do mi mi, so do from the staff', async () => {
    // Arrange
    initSing({ loadTake })
    await toTake()
    await endTake(['Do · Right in the middle: on the written note.'])

    // Act
    press('[data-feel="easy"]')
    const offered = [
      shown('[data-after="next"]'),
      shown('[data-sing="tune-2"]'),
      shown('[data-sing="stop"]'),
      shown('[data-sing="merc"]'),
    ]
    press('[data-sing="tune-2"]')
    await settle()
    drive(4)
    frame(0, 3, 3.5)

    // Assert (FACTS 50, 56)
    expect(offered).toEqual([true, true, true, false])
    expect(staff().getAttribute('aria-label')).toBe(
      'Bass staff, two bars of 4/4: G, G, B, B, then a long D and a long G, with a breath mark at the bar line',
    )
    expect(takes[1].labels).toEqual(['Do', 'Do', 'Mi', 'Mi', 'So', 'Do'])
  })

  it('ends the singing at Stop here, and Play Merc’s tunes sings both on the one staff, keeping the practice card', async () => {
    // Arrange
    initSing({ loadTake })
    await toTake()
    await endTake(['Do · Right in the middle: on the written note.'])
    press('[data-feel="workable"]')

    // Act
    press('[data-sing="stop"]')
    booked.notes.length = 0
    press('[data-sing="merc"]')
    drive()

    // Assert (FACTS 56, 59): do, then tune 1's seven and tune 2's six
    expect(shown('[data-sing="tune-2"]')).toBe(false)
    expect(booked.notes).toHaveLength(14)
    expect(new Set(booked.notes.map((n) => n.kind))).toEqual(new Set(['merc']))
    expect(staff().getAttribute('aria-label')).toContain('G, G, B, B')
    expect(VisitEnding.ending).toBe('practise')
    expect(status()).toBe(STATUS.stopped)
  })

  it('takes the pitch line and the lines away after Uncomfortable, with the doctor lines and the rest card', async () => {
    // Arrange
    initSing({ loadTake })
    await toTake()
    await endTake(['Do · Right in the middle: on the written note.'])

    // Act
    press('[data-feel="uncomfortable"]')

    // Assert (REQ-GVC-023)
    expect(shown('#singLive')).toBe(false)
    expect(shown('[data-after="enough"]')).toBe(true)
    expect(shown('[data-after-doctor]')).toBe(true)
    expect(shown('[data-sing="merc"]')).toBe(true)
    expect(VisitEnding.ending).toBe('rest')
  })
})

describe('listening, and no microphone', () => {
  it('stands the one who sings beside the staff: Tavi for the higher voice, on the treble staff', () => {
    // Arrange
    VoiceChoice.set('higher')

    // Act
    initSing({ loadTake })
    press('[data-comfort="sing"]')

    // Assert
    expect(el<HTMLImageElement>('.sing-merc').alt).toBe(
      'Tavi, who sings the start for the higher voice',
    )
    expect(staff().getAttribute('aria-label')).toMatch(/^Treble staff/)
  })

  it('draws both tunes when the microphone is refused, each with its own Play the start, which sings do and counts in, then crosses its bars in silence', async () => {
    // Arrange
    mic.ok = false
    initSing({ loadTake })

    // Act
    await toStart()
    const both = [
      shown('#singStaff2'),
      shown('[data-sing="play-start"][data-tune="1"]'),
      shown('[data-sing="play-start"][data-tune="2"]'),
      shown('[data-nomic]'),
      shown('[data-sing="merc"]'),
      shown('[data-sing="start"]'),
    ]
    booked.notes.length = 0
    press('[data-sing="play-start"][data-tune="2"]')
    drive()

    // Assert: state 9 (FACTS 58)
    expect(both).toEqual([true, true, true, true, true, false])
    expect(staff(2).getAttribute('aria-label')).toContain('G, G, B, B')
    expect(booked.notes).toEqual([{ freq: hz(G3), kind: 'merc' }])
    expect(runs.at(-1)?.o.bar(2)?.beats).toBe(4)
    expect(status()).toBe(STATUS.nomic)
    expect(VisitEnding.ending).toBe('practise')
  })

  it('plays Merc’s tunes at once for Just listen today, with the rest card and no Start', () => {
    // Arrange
    initSing({ loadTake })

    // Act
    press('[data-comfort="listen"]')

    // Assert: state 3
    expect(shown('[data-panel="listen"]')).toBe(true)
    expect(shown('[data-sing="merc"]')).toBe(true)
    expect(shown('[data-sing="start"]')).toBe(false)
    expect(VisitEnding.ending).toBe('rest')
  })
})
