// ============================================================
// Lesson 10 cold open tests — the predict, its two moves, heard means finished
// ============================================================
//
// WEB-SPEC, Tests 4, on the page's own markup, its runs recorded
// (kit/run-recorder.test-fixtures.ts) and Merc and Tavi's renderer left
// out: Play the chord plays before a choice and never reveals; the moves
// wait for a choice; the reveal waits until both moves have been heard
// with sound on, so `revealOn` and `revealAfter: 'all'` go to the predict
// together; a move stopped before its end, by a bead tap, another sound, a
// stop or a hidden page, counts as not heard and reveals nothing; the
// guess lines and the four hints are LESSON.md's (lines.ts, whose test
// holds them to it). Until the reveal nothing on the figure is gold, even
// once mi's move has landed on E flat 4; the three halos light alike while
// a play sounds, timed from the same start as the bead's slide, so the
// light follows the glide (hero-marks.ts). Both Mercs listen while a play
// sounds, and Tavi celebrates once, at the reveal.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import type * as MercDuo from '@/features/lessons/kit/merc-duo'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type * as PredictModule from '@/features/lessons/kit/predict'
import type { PredictOptions } from '@/features/lessons/kit/predict'
import type * as RunModule from '@/features/lessons/kit/run'
import { live, resetRuns, runs, } from '@/features/lessons/kit/run-recorder.test-fixtures'
import { Sound } from '@/features/lessons/kit/sound'
import type { ColdOpen } from './cold-open'
import { initColdOpen, LANDS_SEC, REVEAL_ON } from './cold-open'
import { COLD_PREDICT, heroChordLine, heroMoveLine } from './lines'
import { el, loadPage, settle, soundOn } from './page-dom.test-fixtures'
import type { MoveId } from './sounds'
import { CHORD_C, MOVE_SEC, moveSound } from './sounds'

const duo = vi.hoisted(() => ({
  listen: vi.fn(),
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
const said = (): string => el('[data-hero-said]').textContent ?? ''
const playBtn = (what: string): HTMLButtonElement =>
  el<HTMLButtonElement>(`.hero-plays [data-play="${what}"]`)
const play = (what: string): void => playBtn(what).click()
const choose = (what: MoveId): void =>
  el(`#predict [data-choice="${what}"]`).click()

/** Every run still going ends, heard to its end or cut short, as the kit's would. */
async function hear(heard = true): Promise<void> {
  live().forEach((r) => r.end(heard))
  await settle()
}

/** Plays a move and hears it to its end. */
async function move(id: MoveId, heard = true): Promise<void> {
  play(`move-${id}`)
  await hear(heard)
}

let cold: ColdOpen

beforeEach(() => {
  localStorage.clear()
  resetRuns()
  predicts.length = 0
  soundOn()
  loadPage()
  cold = initColdOpen()
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  duo.listen.mockReset()
  duo.celebrate.mockReset()
  document.body.textContent = ''
})

describe("Lesson 10's cold open: the spiral", () => {
  it('looks down on C4’s ring from its first frame, held still, its five black keys lit so each is named', () => {
    // Assert: WEB-SPEC, Toys 2
    expect(cold.spiral.top).toBe(1)
    expect([...cold.spiral.lit].sort((a, b) => a - b)).toEqual([
      61, 63, 66, 68, 70,
    ])
  })

  it('brings Merc and Tavi in once they are ready', async () => {
    // Act
    await settle()

    // Assert
    expect(el('#duo').classList.contains('pending')).toBe(false)
  })
})

describe("Lesson 10's cold open: the predict (Tests 4)", () => {
  it('plays the chord before any choice, in the soft tone, says it, and reveals nothing', async () => {
    // Act
    play('chord-c')
    await hear()

    // Assert
    expect(runs.map((r) => r.notes)).toEqual([CHORD_C])
    expect(runs[0].o).toMatchObject({ audible: true, kind: 'soft' })
    expect(said()).toBe(heroChordLine())
    expect(reveal().hidden).toBe(true)
    expect(hint()).toBe(COLD_PREDICT.lock)
  })

  it('keeps the two moves locked until a choice, and locks the choice on its first press', () => {
    // Act
    play('move-mi')
    play('move-so')
    const before = runs.length
    choose('so')
    choose('mi')

    // Assert
    expect(before).toBe(0)
    expect(
      ['mi', 'so'].map((c) =>
        el(`#predict [data-choice="${c}"]`).getAttribute('aria-pressed'),
      ),
    ).toEqual(['false', 'true'])
    expect(REVEAL_ON.map((p) => playBtn(p).disabled)).toEqual([false, false])
    expect(hint()).toBe(COLD_PREDICT.hints.chosen)
  })

  it('plays each move as the two held notes and the moving line, one run, in the soft tone', async () => {
    // Arrange
    choose('mi')

    // Act
    play('move-mi')

    // Assert: FACTS 73, through sounds.ts
    const m = moveSound('mi')
    expect(runs.map((r) => r.kind)).toEqual(['notes', 'line'])
    expect(runs[0].notes).toEqual(m.held)
    expect(runs[1].points).toEqual(m.line)
    expect(runs.map((r) => r.o.kind)).toEqual(['soft', 'soft'])
    expect(runs[1].o.gain).toBe(m.gain)
  })

  it('waits until both moves have been heard with sound on, then says the choice; the chord never reveals', async () => {
    // Arrange
    choose('so')

    // Act
    play('chord-c')
    await hear()
    const afterChord = { hidden: reveal().hidden, hint: hint() }
    await move('mi')
    const afterMi = { hidden: reveal().hidden, hint: hint() }
    play('chord-c')
    await hear()
    const afterBoth = reveal().hidden
    await move('so')

    // Assert
    expect(afterChord).toEqual({
      hidden: true,
      hint: COLD_PREDICT.hints.next,
    })
    expect(afterMi).toEqual({ hidden: true, hint: COLD_PREDICT.hints.next })
    expect(afterBoth).toBe(true)
    expect(reveal().hidden).toBe(false)
    expect(el('#predict .reveal .mono').textContent).toBe(COLD_PREDICT.guess.so)
    expect(hint()).toBe(COLD_PREDICT.hints.again)
    expect(duo.celebrate.mock.calls).toEqual([['orange', 1600]])
  })

  it('says "You said: mi" for mi, and passes revealOn and revealAfter together', async () => {
    // Arrange
    choose('mi')

    // Act
    await move('so')
    await move('mi')

    // Assert
    expect(el('#predict .reveal .mono').textContent).toBe(COLD_PREDICT.guess.mi)
    expect(predicts).toHaveLength(1)
    expect(predicts[0]).toMatchObject({
      revealOn: ['move-mi', 'move-so'],
      revealAfter: 'all',
    })
  })

  it('shows why nothing was heard with sound off, and the reveal waits', async () => {
    // Arrange
    vi.spyOn(Sound, 'canPlay').mockReturnValue(false)
    vi.spyOn(Sound, 'state', 'get').mockReturnValue('off')
    choose('mi')

    // Act
    await move('mi')
    await move('so')

    // Assert
    expect(runs.map((r) => r.o.audible)).toEqual([false, false, false, false])
    expect(hint()).toBe(COLD_PREDICT.hints.silent)
    expect(reveal().hidden).toBe(true)
  })

  it.each([
    [
      'a tap on a bead of the spiral',
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
  ])(
    'never counts a move cut short by %s: it resolves false and reveals nothing',
    async (_, cutShort) => {
      // Arrange
      choose('mi')
      await move('mi')
      play('move-so')
      const moving = live()

      // Act
      cutShort()
      await settle()
      const cut = {
        stopped: moving.every((r) => r.stopped),
        hidden: reveal().hidden,
        hint: hint(),
        move: cold.marks().move,
      }
      await move('so')

      // Assert: the cut move leaves the hint and the slide home; run out, it reveals
      expect(cut).toEqual({
        stopped: true,
        hidden: true,
        hint: COLD_PREDICT.hints.next,
        move: null,
      })
      expect(reveal().hidden).toBe(false)
    },
  )

  it('never mentions right or wrong, in its hints or its guess lines', () => {
    // Arrange
    const words = [
      ...Object.values(COLD_PREDICT.hints),
      ...Object.values(COLD_PREDICT.guess),
    ]

    // Assert
    expect(words.filter((w) => /\b(right|wrong)\b/i.test(w))).toEqual([])
  })
})

describe("Lesson 10's cold open: the marks, until the reveal", () => {
  it('shows nothing gold through mi’s move, landed on E flat 4 and home, until so’s is heard too', async () => {
    // Arrange
    choose('mi')

    // Act: mi's move to its end, and back home
    play('move-mi')
    const during = cold.marks()
    await hear()
    const landed = cold.marks()
    await move('so')

    // Assert: the gold waits for the reveal (hero-marks.ts draws gold only from it)
    expect([during.revealedAt, landed.revealedAt]).toEqual([null, null])
    expect(landed.move?.id).toBe('mi')
    expect(cold.marks().revealedAt).not.toBeNull()
  })

  it('times the halos’ light and the bead’s slide from the same start, so the light follows the glide', () => {
    // Arrange
    choose('mi')

    // Act
    play('move-mi')
    const m = cold.marks()

    // Assert: lit for the move's 3.1 s from the moment its slide starts
    expect(m.move?.id).toBe('mi')
    expect(m.sounding?.from).toBe(m.move?.at)
    expect((m.sounding?.to ?? 0) - (m.sounding?.from ?? 0)).toBeCloseTo(
      MOVE_SEC * 1000,
      6,
    )
  })

  it('lights the halos for the chord’s 1.6 s, with no slide, and fades them where a play is cut short', async () => {
    // Act
    play('chord-c')
    const chord = cold.marks()
    NowPlaying.claim(() => undefined)
    await settle()
    const cut = cold.marks()

    // Assert
    expect(chord.move).toBeNull()
    // a difference of two clock readings: equal to within float rounding
    expect((chord.sounding?.to ?? 0) - (chord.sounding?.from ?? 0)).toBeCloseTo(
      1600,
      6,
    )
    expect(cut.sounding?.to).toBeLessThan(chord.sounding?.to ?? 0)
  })
})

describe("Lesson 10's cold open: the live line and the Mercs", () => {
  it('says the move as it lands, at the glide’s end, and not before', () => {
    // Arrange
    vi.useFakeTimers()
    choose('so')

    // Act
    play('move-so')
    vi.advanceTimersByTime(LANDS_SEC * 1000 - 1)
    const early = said()
    vi.advanceTimersByTime(1)

    // Assert
    expect(early).toBe('')
    expect(said()).toBe(heroMoveLine('so'))
  })

  it('says no move once it is cut short before it lands', async () => {
    // Arrange
    vi.useFakeTimers()
    choose('mi')
    play('move-mi')

    // Act
    NowPlaying.claim(() => undefined)
    await settle()
    vi.advanceTimersByTime(MOVE_SEC * 1000)

    // Assert
    expect(said()).toBe('')
  })

  it('turns both Mercs to listen while a play sounds, and back once it ends; neither sings', async () => {
    // Act
    play('chord-c')
    const playing = duo.listen.mock.calls.slice()
    await hear()

    // Assert
    expect(playing).toEqual([
      ['blue', true],
      ['orange', true],
    ])
    expect(duo.listen.mock.calls.slice(2)).toEqual([
      ['blue', false],
      ['orange', false],
    ])
  })

  it('claims the page’s one sound for each play, and lets it go at the end', async () => {
    // Arrange
    let stopped = 0
    NowPlaying.claim(() => {
      stopped += 1
    })

    // Act
    play('chord-c')
    await hear()
    NowPlaying.claim(() => undefined)

    // Assert: the sound before it stopped, and the ended chord is not stopped again
    expect(stopped).toBe(1)
    expect(runs[0].stopped).toBe(false)
  })
})
