// ============================================================
// Lesson 12 cold open tests — the four chords, two tunes, and a reveal that waits for both
// ============================================================
//
// WEB-SPEC, Tests 6, on the page's own markup, its runs recorded
// (kit/run-recorder.test-fixtures.ts) and Merc and Tavi's renderer left
// out: Play the four chords plays before a choice, draws no walk and
// never reveals; the tunes wait for a choice; the reveal waits until both
// tunes have been heard with sound on, so `revealOn` and `revealAfter:
// 'all'` go to the predict together; a tune stopped before its end, by a
// bead tap, another sound on the page, a stop, a step change of the deck
// or the hero off screen for 600 ms, counts as not heard, reveals nothing
// and leaves the hint as it was; the guess lines and the four hints are
// LESSON.md's (lines.test.ts holds them to it); after a choice the four
// chords heard show the next hint, and with sound off before a choice they
// show the sound-off hint, the lock hint back once heard with sound on.
// Both Mercs listen while the four chords sound; Merc sings each of a
// tune's notes while Tavi listens; Tavi celebrates once, at the reveal.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { scrollOutOfView } from '@/features/lessons/kit/browser-doubles.test-fixtures'
import { AWAY_MS } from '@/features/lessons/kit/leave'
import type * as MercDuo from '@/features/lessons/kit/merc-duo'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type * as PredictModule from '@/features/lessons/kit/predict'
import type { PredictOptions } from '@/features/lessons/kit/predict'
import type * as RunModule from '@/features/lessons/kit/run'
import { live, resetRuns, runs, } from '@/features/lessons/kit/run-recorder.test-fixtures'
import { Sound } from '@/features/lessons/kit/sound'
import type { ColdOpen } from './cold-open'
import { initColdOpen, REVEAL_ON } from './cold-open'
import type { ColdChoice } from './lines'
import { COLD_PREDICT, fourChordsLine } from './lines'
import { LOOP_DEGREES, tuneOf } from './music'
import { el, loadPage, settle, soundOn } from './page-dom.test-fixtures'
import { loop, tune } from './sounds'

const duo = vi.hoisted(() => ({
  listen: vi.fn(),
  sing: vi.fn(),
  celebrate: vi.fn(),
}))

/** Every option the page hands the kit's predict. */
const predicts = vi.hoisted(() => [] as PredictOptions[])

vi.mock('@/features/lessons/kit/run', async (actual) => ({
  ...(await actual<typeof RunModule>()),
  ...(await import('@/features/lessons/kit/run-recorder.test-fixtures'))
    .recordedRuns,
}))

vi.mock('@/features/lessons/kit/merc-duo', async (actual) => ({
  ...(await actual<typeof MercDuo>()),
  mercsReady: Promise.resolve(),
  mercListen: duo.listen,
  mercSing: duo.sing,
  mercCelebrate: duo.celebrate,
}))

vi.mock('@/features/lessons/kit/predict', async (actual) => {
  const kit = await actual<typeof PredictModule>()
  return {
    ...kit,
    mountPredict: (root: HTMLElement, o: PredictOptions) => {
      predicts.push(o)
      return kit.mountPredict(root, o)
    },
  }
})

const reveal = (): HTMLElement => el('#predict .reveal')
const hint = (): string => (el('#predict .lock-hint').textContent ?? '').trim()
const said = (): string => el('#heroSpiral [data-rooms-said]').textContent ?? ''
const playBtn = (what: string): HTMLButtonElement =>
  el<HTMLButtonElement>(`.hero-plays [data-play="${what}"]`)
const play = (what: string): void => playBtn(what).click()
const choose = (what: ColdChoice): void =>
  el(`#predict [data-choice="${what}"]`).click()

/** Starts every note of every run still going, as the kit's timers would. */
function startNotes(): void {
  for (const r of live()) r.notes.forEach((_, i) => r.note(i))
}

/** Every run still going ends, heard to its end or cut short, as the kit's would. */
async function hear(heard = true): Promise<void> {
  startNotes()
  live().forEach((r) => r.end(heard))
  await settle()
}

/** Plays one of the hero's three and hears it to its end. */
async function hearPlay(what: string): Promise<void> {
  play(what)
  await settle()
  await hear()
}

/** The deck's step changes, as the page's deck tells its subscribers. */
const stepChanges: ((step: number) => void)[] = []
const deck = {
  subscribe: (fn: (step: number) => void): (() => void) => {
    stepChanges.push(fn)
    return () => undefined
  },
}

let cold: ColdOpen

beforeEach(() => {
  localStorage.clear()
  resetRuns()
  predicts.length = 0
  stepChanges.length = 0
  soundOn()
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] })
  loadPage()
  cold = initColdOpen(deck)
})

afterEach(() => {
  NowPlaying.claim(() => undefined)
  vi.useRealTimers()
  vi.restoreAllMocks()
  duo.listen.mockReset()
  duo.sing.mockReset()
  duo.celebrate.mockReset()
  document.body.textContent = ''
})

describe("Lesson 12's cold open: the hero's ring", () => {
  it('looks down on C4’s ring, held still, its five black keys lit, the four rooms faint and unlabelled', () => {
    // Assert: WEB-SPEC, Toys 2
    expect(cold.rooms.spiral.top).toBe(1)
    expect([...cold.rooms.spiral.lit].sort((a, b) => a - b)).toEqual([
      61, 63, 66, 68, 70,
    ])
    expect(cold.rooms.drawn).toEqual(LOOP_DEGREES)
    expect(cold.rooms.state()).toMatchObject({
      label: 'none',
      lit: null,
      walk: null,
    })
  })

  it('brings Merc and Tavi in once they are ready', async () => {
    // Act
    await settle()

    // Assert
    expect(el('#duo').classList.contains('pending')).toBe(false)
  })
})

describe("Lesson 12's cold open: the predict (Tests 6)", () => {
  it('plays the four chords before any choice, in the soft tone, says them, draws no walk and reveals nothing', async () => {
    // Act
    play('loop-c')
    await settle()
    const playing = { said: said(), lit: cold.rooms.lit }
    await hear()

    // Assert
    expect(runs.map((r) => r.notes)).toEqual([loop('C')])
    expect(runs[0].o).toMatchObject({ audible: true, kind: 'soft' })
    expect(playing.said).toBe(fourChordsLine('C'))
    expect(cold.rooms.state().walk).toBe(null)
    expect(reveal().hidden).toBe(true)
    expect(hint()).toBe(COLD_PREDICT.lock)
  })

  it('lights each room while its chord sounds: I, V, vi, IV', async () => {
    // Arrange
    play('loop-c')
    await settle()

    // Act
    const lit: (number | null)[] = []
    runs[0].notes.forEach((_, i) => {
      runs[0].note(i)
      if (i % 3 === 2) lit.push(cold.rooms.lit)
    })

    // Assert: FACTS 68
    expect(lit).toEqual(LOOP_DEGREES)
  })

  it('keeps both tunes locked until a choice, and locks the choice on its first press', () => {
    // Arrange
    const locked = REVEAL_ON.map((w) => playBtn(w).disabled)

    // Act
    choose('most')
    choose('hardly')

    // Assert
    expect(locked).toEqual([true, true])
    expect(REVEAL_ON.map((w) => playBtn(w).disabled)).toEqual([false, false])
    expect(el('[data-choice="most"]').getAttribute('aria-pressed')).toBe('true')
    expect(el('[data-choice="hardly"]').getAttribute('aria-pressed')).toBe(
      'false',
    )
    expect(hint()).toBe(COLD_PREDICT.hints.chosen)
  })

  it('plays each tune over the loop as one run, its walk drawn and its count said at its end', async () => {
    // Arrange
    choose('most')

    // Act
    play('tune-1')
    await settle()
    const walking = cold.rooms.state().walk
    await hear()
    const one = said()
    await hearPlay('tune-2')

    // Assert: FACTS 35 and 36
    expect(runs.map((r) => r.notes)).toEqual([
      tune('tune-1', 'C'),
      tune('tune-2', 'C'),
    ])
    expect(walking).toMatchObject({ id: 'tune-1', key: 'C', by: 1 })
    expect(one).toBe('On a corner: 11 of 15.')
    expect(said()).toBe('On a corner: 10 of 12.')
  })

  it('waits until both tunes have been heard with sound on, then says the choice; the four chords never reveal', async () => {
    // Arrange
    choose('hardly')

    // Act
    await hearPlay('tune-1')
    const afterOne = { hidden: reveal().hidden, hint: hint() }
    await hearPlay('loop-c')
    const afterChords = reveal().hidden
    await hearPlay('tune-2')

    // Assert
    expect(afterOne).toEqual({
      hidden: true,
      hint: COLD_PREDICT.hints.next,
    })
    expect(afterChords).toBe(true)
    expect(reveal().hidden).toBe(false)
    expect(el('#predict .reveal .mono').textContent).toBe(
      'You said: hardly any',
    )
    expect(hint()).toBe(COLD_PREDICT.hints.again)
    expect(duo.celebrate).toHaveBeenCalledTimes(1)
    expect(duo.celebrate).toHaveBeenCalledWith('orange', 1600)
  })

  it('says "You said: most of them" for most, and passes revealOn and revealAfter together', async () => {
    // Arrange
    choose('most')

    // Act
    await hearPlay('tune-2')
    await hearPlay('tune-1')

    // Assert
    expect(predicts[0]).toMatchObject({
      revealOn: ['tune-1', 'tune-2'],
      revealAfter: 'all',
      hints: COLD_PREDICT.hints,
    })
    expect(el('#predict .reveal .mono').textContent).toBe(
      'You said: most of them',
    )
  })

  it('shows the next hint for the four chords heard after a choice, before either tune', async () => {
    // Arrange
    choose('most')

    // Act
    await hearPlay('loop-c')

    // Assert: Edge cases
    expect(hint()).toBe(COLD_PREDICT.hints.next)
  })

  it('shows the sound-off hint for the four chords kept silent before a choice, and the lock hint once heard', async () => {
    // Arrange
    const canPlay = vi.spyOn(Sound, 'canPlay').mockReturnValue(false)
    const state = vi.spyOn(Sound, 'state', 'get').mockReturnValue('off')

    // Act
    await hearPlay('loop-c')
    const silent = { hint: hint(), audible: runs[0].o.audible }
    canPlay.mockReturnValue(true)
    state.mockReturnValue('on')
    await hearPlay('loop-c')

    // Assert: Edge cases
    expect(silent).toEqual({
      hint: COLD_PREDICT.hints.silent,
      audible: false,
    })
    expect(hint()).toBe(COLD_PREDICT.lock)
    expect(REVEAL_ON.map((w) => playBtn(w).disabled)).toEqual([true, true])
  })

  it('waits with sound off: both tunes play their visuals in silence and nothing reveals', async () => {
    // Arrange
    vi.spyOn(Sound, 'canPlay').mockReturnValue(false)
    vi.spyOn(Sound, 'state', 'get').mockReturnValue('off')
    choose('most')

    // Act
    play('tune-1')
    await settle()
    const walk = cold.rooms.state().walk
    await hear()
    await hearPlay('tune-2')

    // Assert
    expect(runs.map((r) => r.o.audible)).toEqual([false, false])
    expect(walk?.id).toBe('tune-1')
    expect(hint()).toBe(COLD_PREDICT.hints.silent)
    expect(reveal().hidden).toBe(true)
  })

  it.each([
    [
      'a tap on a bead of the ring',
      (): void => {
        el('#heroSpiral canvas').dispatchEvent(
          new KeyboardEvent('keydown', { key: 'Enter' }),
        )
      },
    ],
    [
      'another sound on the page',
      (): void => {
        NowPlaying.claim(() => undefined)
      },
    ],
    [
      'a stop or a hidden page, as the kit ends the run unheard',
      (): void => {
        live().forEach((r) => r.end(false))
      },
    ],
    [
      'a step change of the deck',
      (): void => {
        stepChanges.forEach((fn) => fn(3))
      },
    ],
    [
      'the hero off screen for 600 ms',
      (): void => {
        scrollOutOfView(el('#heroStage'))
        vi.advanceTimersByTime(AWAY_MS)
      },
    ],
  ])(
    'never counts a tune cut short by %s: it reveals nothing and the hint stays',
    async (_, cutShort) => {
      // Arrange
      choose('most')
      await hearPlay('tune-1')
      play('tune-2')
      await settle()
      const playing = live()

      // Act
      cutShort()
      await settle()
      const cut = {
        stopped: playing.every((r) => r.stopped),
        hidden: reveal().hidden,
        hint: hint(),
        stoppedAt: cold.rooms.state().walk?.stoppedAt ?? null,
      }
      await hearPlay('tune-2')

      // Assert: the cut tune keeps the hint and its walk where it reached; heard out, it reveals
      expect(cut).toMatchObject({
        stopped: true,
        hidden: true,
        hint: COLD_PREDICT.hints.next,
      })
      expect(cut.stoppedAt).not.toBe(null)
      expect(reveal().hidden).toBe(false)
    },
  )

  it('ignores another of the three while one plays, so the predict’s own plays never cut each other short', async () => {
    // Arrange
    choose('most')
    play('tune-1')
    await settle()

    // Act
    play('tune-2')
    play('loop-c')
    await settle()

    // Assert: kit/predict.ts `busy`
    expect(runs).toHaveLength(1)
    expect(runs[0].stopped).toBe(false)
  })

  it('never mentions right or wrong, in its hints or its guess lines', () => {
    // Arrange
    const lines = [
      ...Object.values(COLD_PREDICT.hints),
      ...Object.values(COLD_PREDICT.guess),
    ]

    // Assert
    for (const line of lines) expect(line).not.toMatch(/right|wrong|correct/i)
  })
})

describe("Lesson 12's cold open: Merc and Tavi", () => {
  it('turns both to listen while the four chords sound, and back once they end; neither sings', async () => {
    // Act
    play('loop-c')
    await settle()
    const listening = duo.listen.mock.calls.slice()
    await hear()

    // Assert
    expect(listening).toEqual([
      ['blue', true],
      ['orange', true],
    ])
    expect(duo.listen.mock.calls.slice(2)).toEqual([
      ['blue', false],
      ['orange', false],
    ])
    expect(duo.sing).not.toHaveBeenCalled()
  })

  it("has Merc sing each of a tune's notes as it starts while Tavi listens", async () => {
    // Arrange
    choose('most')
    const notes = tuneOf('tune-1', 'C')

    // Act
    play('tune-1')
    await settle()
    startNotes()

    // Assert
    expect(duo.listen.mock.calls).toEqual([['orange', true]])
    expect(
      duo.sing.mock.calls.filter((c) => c[2] === true).map((c) => c[1]),
    ).toEqual(notes.map((n) => n.midi))
  })

  it('quiets Merc at once when a tune is cut short', async () => {
    // Arrange
    choose('most')
    play('tune-2')
    await settle()
    runs[0].note(0)
    runs[0].note(1)
    runs[0].note(2)
    runs[0].note(3)

    // Act
    NowPlaying.claim(() => undefined)
    await settle()

    // Assert: G4, tune 2's first note, the last Merc sang
    expect(duo.sing).toHaveBeenLastCalledWith('blue', 67, false)
    expect(duo.listen).toHaveBeenLastCalledWith('orange', false)
  })
})
