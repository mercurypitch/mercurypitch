// ============================================================
// Lesson 16 Sing it tests — the card on the page's own markup
// ============================================================
//
// With the kit's runs a recorder, the microphone's hold and the take's
// module fakes the test drives, and the browser's clock a fake one: the
// comfort check first; the staff in the learner's clef; Start opens the
// microphone, then the start sings do and do, mi, so, mi, do, lighting
// only the written do's; 0.4 s later the first note lights and the take
// reads along the phrase while Merc and Tavi listen; the pitch line and
// its lines after it, never during it; the feeling question, phrase 2 with
// its Names switch, Stop here and Play Merc's phrases; the still of the one
// who sings; no microphone, no voice, sound off and leaving (WEB-SPEC,
// Toys 6; FACTS 42, 46, 49 to 51, 70).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import { VisitEnding } from '@/features/lessons/kit/comfort'
import type * as MercDuo from '@/features/lessons/kit/merc-duo'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type * as RunModule from '@/features/lessons/kit/run'
import { resetRuns, runs, } from '@/features/lessons/kit/run-recorder.test-fixtures'
import { Sound } from '@/features/lessons/kit/sound'
import { VoiceChoice } from '@/features/lessons/kit/voice-choice'
import { el, loadPage, settle, soundOn, words } from './page-dom.test-fixtures'
import { initSing, OPEN_SEC } from './sing'
import { STATUS } from './sing-flow'
import type * as TakeKit from './sing-take'
import type { PitchLine, TakeContext, TakeEnd } from './sing-take'

vi.mock('@/features/lessons/kit/run', async (actual) => ({
  ...(await actual<typeof RunModule>()),
  ...(await import('@/features/lessons/kit/run-recorder.test-fixtures'))
    .recordedRuns,
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
let drawn: {
  root: HTMLElement
  pitch: PitchLine
  notes: readonly number[]
  labels: readonly string[]
}[] = []
const loadTake = async (): Promise<typeof TakeKit> =>
  ({
    runTake: (c: TakeContext) => {
      takes.push(c)
      return new Promise<TakeEnd>((r) => ends.push(r))
    },
    drawPitchLine: (
      root: HTMLElement,
      pitch: PitchLine,
      notes: readonly number[],
      labels: readonly string[],
    ) => drawn.push({ root, pitch, notes, labels }),
  }) as unknown as typeof TakeKit

/** A take's pitch line, as the take's module would hand it over. */
const PITCH: PitchLine = {
  seconds: 3,
  rungs: [{ c: 0, from: 0, to: 3 }],
  line: [{ t: 0, c: 0 }],
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
const heads = () => Array.from(document.querySelectorAll('#singStaff .st-head'))
const litCols = (tone = 'is-amber') =>
  heads().flatMap((h, i) => (h.classList.contains(tone) ? [i] : []))

/** Comfortable, then Start, the start heard to its end and the take open. */
async function toTake(): Promise<void> {
  press('[data-sing="start"]')
  await settle()
  runs.at(-1)?.end(true)
  await settle()
  vi.advanceTimersByTime(OPEN_SEC * 1000)
  await settle()
  await settle()
}

/** The open take ends, read with `lines` and its pitch line, or with no voice when there are none. */
async function endTake(lines: readonly string[]): Promise<void> {
  const voiced = lines.length > 0
  ends.at(-1)?.({ kind: 'read', voiced, lines, pitch: voiced ? PITCH : null })
  await settle()
}

describe('before a take', () => {
  it('opens on the comfort check, every visit', () => {
    // Act
    initSing({ loadTake })

    // Assert: states 1
    expect(shown('[data-panel="comfort"]')).toBe(true)
    expect(shown('[data-panel="prepare"]')).toBe(false)
    expect(status()).toBe(STATUS.comfort)
  })

  it('draws the first phrase on the bass staff for the lower voice, with its syllables and the house', () => {
    // Arrange
    initSing({ loadTake })

    // Act
    press('[data-comfort="sing"]')

    // Assert: states 4
    expect(shown('[data-panel="prepare"]')).toBe(true)
    expect(heads()).toHaveLength(5)
    expect(document.querySelectorAll('#singStaff .st-home').length).toBe(1)
    expect(
      Array.from(el('#singStaff .st-syls').children, (t) => words(t)),
    ).toEqual(['do', 're', 'mi', 're', 'do'])
    expect(shown('[data-sing="start"]')).toBe(true)
    expect(shown('[data-sing-names]')).toBe(false)
    expect(status()).toBe(STATUS.turn)
  })

  it('asks nothing of the microphone with sound off, and says so beside Start', async () => {
    // Arrange
    vi.spyOn(Sound, 'canPlay').mockReturnValue(false)
    initSing({ loadTake })
    press('[data-comfort="sing"]')

    // Act
    press('[data-sing="start"]')
    await settle()

    // Assert: states 5
    expect([mic.opened, runs.length]).toEqual([0, 0])
    expect(words(el('#startHint'))).toBe(
      'Sound is off, so nothing played. Turn sound on to hear the start, then press Start.',
    )
  })
})

describe('the start and the take', () => {
  it('opens the microphone, then sings the start in Merc’s “ooh”, lighting only the written do’s', async () => {
    // Arrange
    initSing({ loadTake })
    press('[data-comfort="sing"]')

    // Act
    press('[data-sing="start"]')
    await settle()
    vi.advanceTimersByTime(100)
    const onDo = litCols()
    vi.advanceTimersByTime(1900)
    const onMi = litCols()

    // Assert: FACTS 42
    expect(mic.opened).toBe(1)
    expect(runs[0].notes.map((n) => [n.t, n.midi])).toEqual([
      [0, 55],
      [1.4, 55],
      [2, 59],
      [2.6, 62],
      [3.2, 59],
      [3.8, 55],
    ])
    expect(runs[0].o.kind).toBe('merc')
    expect([onDo, onMi]).toEqual([[0, 4], []])
  })

  it('lights the first note 0.4 s after the start and reads along the phrase', async () => {
    // Arrange
    initSing({ loadTake })
    press('[data-comfort="sing"]')

    // Act
    await toTake()

    // Assert: states 6
    expect(takes).toHaveLength(1)
    expect(takes[0].notes).toEqual([55, 57, 59, 57, 55])
    expect(takes[0].labels).toEqual(['Do', 'Re', 'Mi', 'Re', 'Do'])
    expect(status()).toBe("Your turn: start on do when you're ready.")
    expect(heads()[0].classList.contains('is-lit')).toBe(true)
  })

  it('writes one line a note after a take with voice, releases the microphone and asks how it felt', async () => {
    // Arrange
    initSing({ loadTake })
    press('[data-comfort="sing"]')
    await toTake()

    // Act
    await endTake([
      'Do · Right in the middle.',
      'Re · In the band: 20 cents below the written note.',
    ])

    // Assert: states 7 and 8
    expect(
      Array.from(document.querySelectorAll('[data-readings] li'), (li) =>
        words(li),
      ),
    ).toEqual([
      'Do · Right in the middle.',
      'Re · In the band: 20 cents below the written note.',
    ])
    expect(shown('[data-readings]')).toBe(true)
    expect(mic.released).toBe(1)
    expect(shown('[data-panel="feel"]')).toBe(true)
    expect(status()).toBe(STATUS.feel)
  })

  it('draws the pitch line over the phrase only once a take with voice ends, never during it', async () => {
    // Arrange
    initSing({ loadTake })
    press('[data-comfort="sing"]')
    await toTake()
    const during = [shown('#singLive'), drawn.length]

    // Act
    await endTake(['Do · Right in the middle.'])

    // Assert: states 6 and 7, test 16 (FACTS 46)
    expect(during).toEqual([false, 0])
    expect(shown('#singLive')).toBe(true)
    expect(drawn).toHaveLength(1)
    expect(drawn[0].root).toBe(el('#singChart'))
    expect(drawn[0].pitch).toBe(PITCH)
    expect(drawn[0].notes).toEqual([55, 57, 59, 57, 55])
    expect(drawn[0].labels).toEqual(['Do', 'Re', 'Mi', 'Re', 'Do'])
  })

  it('turns Merc and Tavi to listen while a take runs, and back after it', async () => {
    // Arrange
    initSing({ loadTake })
    press('[data-comfort="sing"]')

    // Act
    await toTake()
    const during = [...listens]
    await endTake(['Do · Right in the middle.'])

    // Assert: Merc and Tavi (WEB-SPEC)
    expect(during).toEqual([
      ['blue', true],
      ['orange', true],
    ])
    expect(listens.slice(during.length)).toEqual([
      ['blue', false],
      ['orange', false],
    ])
  })

  it('lets nothing else on the page play while a take runs, and gives its plays back after', async () => {
    // Arrange
    initSing({ loadTake })
    press('[data-comfort="sing"]')
    const word = el<HTMLButtonElement>('[data-word-play="sight"]')
    const other = el<HTMLButtonElement>('[data-word-play="triad"]')
    // a try locked until the predict's choice, as the markup has it
    const locked = el<HTMLButtonElement>('#heroPlay')
    const figure = el('#toyStaff [data-staff-viz]')
    const heard: string[] = []
    word.addEventListener('click', () => heard.push('word'))
    figure.addEventListener('pointerdown', () => heard.push('figure'))
    figure.addEventListener('keydown', (e) => heard.push(`key ${e.key}`))

    // Act: a play enabled since the take opened, a tap and a key on a figure
    await toTake()
    const during = [word.disabled, other.disabled]
    word.disabled = false
    word.click()
    figure.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    const key = (target: Element, name: string): boolean =>
      target.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: name,
          bubbles: true,
          cancelable: true,
        }),
      )
    // an arrow moves a figure, and falls; Tab only moves the focus on
    const keys = [key(figure, 'ArrowUp'), key(figure, 'Tab'), key(word, 'Tab')]
    await endTake(['Do · Right in the middle.'])
    word.click()
    figure.dispatchEvent(new Event('pointerdown', { bubbles: true }))

    // Assert: test 17
    expect(during).toEqual([true, true])
    expect(keys).toEqual([false, true, true])
    expect([word.disabled, other.disabled]).toEqual([false, false])
    expect(locked.disabled).toBe(true)
    expect(heard).toEqual(['key Tab', 'word', 'figure'])
  })

  it('stops a sound still going as the take opens', async () => {
    // Arrange: the start heard to its end, then another sound in the quiet before the take
    initSing({ loadTake })
    press('[data-comfort="sing"]')
    press('[data-sing="start"]')
    await settle()
    runs.at(-1)?.end(true)
    await settle()
    const stopped = vi.fn()
    NowPlaying.claim(stopped)

    // Act
    vi.advanceTimersByTime(OPEN_SEC * 1000)
    await settle()
    await settle()

    // Assert
    expect(takes).toHaveLength(1)
    expect(stopped).toHaveBeenCalledTimes(1)
  })

  it('says it did not hear a start, with Start again, after a take with no voice', async () => {
    // Arrange
    initSing({ loadTake })
    press('[data-comfort="sing"]')
    await toTake()

    // Act
    await endTake([])

    // Assert: FACTS 50
    expect(shown('[data-after="silent"]')).toBe(true)
    expect(shown('[data-after-cue]')).toBe(true)
    expect(shown('[data-sing="again"]')).toBe(true)
    expect(shown('[data-panel="feel"]')).toBe(false)
    expect(shown('#singLive')).toBe(false)
  })

  it('counts a take abandoned when the page is hidden', async () => {
    // Arrange
    initSing({ loadTake })
    press('[data-comfort="sing"]')
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

    // Assert
    expect(cancelled).toBe(true)
    expect(status()).toBe(STATUS.left)
    expect(shown('[data-sing="again"]')).toBe(true)
    Object.defineProperty(document, 'hidden', {
      value: false,
      configurable: true,
    })
  })

  it('ends the start with no take when another sound starts', async () => {
    // Arrange
    initSing({ loadTake })
    press('[data-comfort="sing"]')
    press('[data-sing="start"]')
    await settle()

    // Act
    NowPlaying.claim(() => undefined)
    await settle()

    // Assert
    expect(runs[0].stopped).toBe(true)
    expect(takes).toHaveLength(0)
    expect(mic.released).toBe(1)
    expect(shown('[data-sing="start"]')).toBe(true)
  })
})

describe('after the first phrase', () => {
  it('offers phrase 2 with its Names switch, and reads do, so, mi, re, do', async () => {
    // Arrange
    initSing({ loadTake })
    press('[data-comfort="sing"]')
    await toTake()
    await endTake(['Do · Right in the middle.'])

    // Act
    press('[data-feel="easy"]')
    const offered = [
      shown('[data-after="next"]'),
      shown('[data-sing="phrase-2"]'),
      shown('[data-sing="stop"]'),
      shown('[data-sing="merc"]'),
    ]
    await (async () => {
      press('[data-sing="phrase-2"]')
      await settle()
      runs.at(-1)?.end(true)
      await settle()
      vi.advanceTimersByTime(OPEN_SEC * 1000)
      await settle()
      await settle()
    })()

    // Assert
    expect(offered).toEqual([true, true, true, false])
    expect(takes[1].notes).toEqual([55, 62, 59, 57, 55])
    expect(shown('[data-sing-names]')).toBe(true)
    // the first phrase's pitch line goes while the second's take runs
    expect(shown('#singLive')).toBe(false)
  })

  it('takes the pitch line and the lines away after Uncomfortable', async () => {
    // Arrange
    initSing({ loadTake })
    press('[data-comfort="sing"]')
    await toTake()
    await endTake(['Do · Right in the middle.'])

    // Act
    press('[data-feel="uncomfortable"]')

    // Assert: state 8 (REQ-GVC-023)
    expect(shown('#singLive')).toBe(false)
    expect(shown('[data-sing="phrase-2"]')).toBe(false)
    expect(VisitEnding.ending).toBe('rest')
  })

  it('ends the singing at Stop here, and Play Merc’s phrases sings both, 12.0 s, keeping the practice card', async () => {
    // Arrange
    initSing({ loadTake })
    press('[data-comfort="sing"]')
    await toTake()
    await endTake(['Do · Right in the middle.'])
    press('[data-feel="workable"]')

    // Act
    press('[data-sing="stop"]')
    press('[data-sing="merc"]')

    // Assert: FACTS 49, 70
    expect(shown('[data-sing="phrase-2"]')).toBe(false)
    const merc = runs.at(-1)
    expect(merc?.notes).toHaveLength(16)
    expect(Math.max(...(merc?.notes ?? []).map((n) => n.t + n.dur))).toBe(12)
    expect(VisitEnding.ending).toBe('practise')
  })
})

describe('the still beside the staff', () => {
  it('stands the one who sings beside the staff: Tavi for a stored higher voice, then Merc once the lower is chosen', () => {
    // Arrange
    VoiceChoice.set('higher')
    initSing({ loadTake })
    press('[data-comfort="sing"]')
    const still = el<HTMLImageElement>('#singStaff .sing-merc')
    const higher = [still.getAttribute('src'), still.alt]

    // Act
    press('[data-voice="lower"]')

    // Assert: Merc and Tavi (WEB-SPEC)
    expect(higher[0]).toMatch(/merc-orange/)
    expect(higher[1]).toBe('Tavi, who sings the start for the higher voice')
    expect(still.getAttribute('src')).toMatch(/merc-blue/)
    expect(still.alt).toBe('Merc, who sings the start for the lower voice')
  })
})

describe('listening and no microphone', () => {
  it('takes the no-microphone path when the take’s module fails to load, and sings nothing', async () => {
    // Arrange
    initSing({ loadTake: () => Promise.reject(new Error('no chunk')) })
    press('[data-comfort="sing"]')

    // Act
    press('[data-sing="start"]')
    await settle()

    // Assert: state 9, the listener failed to load
    expect(shown('[data-nomic]')).toBe(true)
    expect(shown('[data-sing="play-start"]')).toBe(true)
    expect(shown('[data-sing="start"]')).toBe(false)
    expect(runs).toHaveLength(0)
    expect(mic.released).toBe(1)
  })

  it('offers Play the start and Play Merc’s phrases when the microphone is refused', async () => {
    // Arrange
    mic.ok = false
    initSing({ loadTake })
    press('[data-comfort="sing"]')

    // Act
    press('[data-sing="start"]')
    await settle()
    press('[data-sing="play-start"]')

    // Assert: states 9, FACTS 51
    expect(shown('[data-nomic]')).toBe(true)
    expect(shown('[data-sing="merc"]')).toBe(true)
    expect(shown('[data-sing="start"]')).toBe(false)
    expect(runs.at(-1)?.notes).toHaveLength(6)
    expect(VisitEnding.ending).toBe('practise')
  })

  it('plays Merc’s phrases at once for Just listen today, with the rest card and no Start', () => {
    // Arrange
    initSing({ loadTake })

    // Act
    press('[data-comfort="listen"]')

    // Assert: states 3, REQ-GVC-021
    expect(shown('[data-panel="listen"]')).toBe(true)
    expect(shown('[data-sing="merc"]')).toBe(true)
    expect(shown('[data-sing="start"]')).toBe(false)
    expect(VisitEnding.ending).toBe('rest')
  })
})
