// ============================================================
// Lesson 9 cold open tests — the predict, its paths, heard means finished
// ============================================================
//
// WEB-SPEC, Tests 10 and 15, on the page's own markup, its runs recorded
// (kit/run-recorder.test-fixtures.ts) and Merc and Tavi's renderer left
// out: Play Merc's leap plays before a choice and reveals nothing; the
// choice locks on the first press and unlocks the three paths; the reveal
// waits until re, mi and fa have each been heard with sound on, in any
// order; a silent play draws its path and shows the sound-off hint; a path
// cut short, by another sound or a stop, never counts, and one that runs
// out does. Until a path plays, the chart shows do and so alone and the
// live line names no middle note. The Merc of the stored voice sings and
// hops to land on each leap's second note, and Tavi celebrates once.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import type * as MercDuo from '@/features/lessons/kit/merc-duo'
import type * as MercHop from '@/features/lessons/kit/merc-hop'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type * as RunModule from '@/features/lessons/kit/run'
import { resetRuns, runs, } from '@/features/lessons/kit/run-recorder.test-fixtures'
import { Sound } from '@/features/lessons/kit/sound'
import { VoiceChoice } from '@/features/lessons/kit/voice-choice'
import { GUESS, HINTS, initColdOpen } from './cold-open'
import type { LadderChart } from './ladder-chart'
import { mercLeapLine, pathLine } from './lines'
import { el, loadPage, settle, soundOn } from './page-dom.test-fixtures'
import { leapNotes, MERC_LEAP, PATH_IDS, pathNotes } from './sounds'

const duo = vi.hoisted(() => ({
  sing: vi.fn(),
  celebrate: vi.fn(),
  hop: vi.fn(),
}))

vi.mock('@/features/lessons/kit/run', async (actual) => ({
  ...(await actual<typeof RunModule>()),
  ...(await import('@/features/lessons/kit/run-recorder.test-fixtures'))
    .recordedRuns,
}))

vi.mock('@/features/lessons/kit/merc-duo', async (actual) => ({
  ...(await actual<typeof MercDuo>()),
  mercsReady: Promise.resolve(),
  mercSing: duo.sing,
  mercCelebrate: duo.celebrate,
}))

vi.mock('@/features/lessons/kit/merc-hop', async (actual) => ({
  ...(await actual<typeof MercHop>()),
  mercHop: duo.hop,
}))

const reveal = (): HTMLElement => el('#predict .reveal')
const hint = (): string => (el('#predict .lock-hint').textContent ?? '').trim()
const said = (): string => el('[data-hero-said]').textContent ?? ''
const play = (what: string): void =>
  el(`#predict [data-play="${what}"]`).click()
const choose = (what: string): void =>
  el(`#predict [data-choice="${what}"]`).click()
const cents = (l: LadderChart): number[] =>
  (l.chart.scene.rungs ?? []).map((r) => r.c)

/** The last run started, its notes all sounded, ended `heard` or cut short. */
async function hear(heard = true): Promise<void> {
  const run = runs[runs.length - 1]
  run.notes.forEach((_, i) => run.note(i))
  run.end(heard)
  await settle()
}

let ladder: LadderChart

beforeEach(() => {
  localStorage.clear()
  VoiceChoice.set('lower')
  resetRuns()
  soundOn()
  loadPage()
  ladder = initColdOpen()
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  duo.sing.mockReset()
  duo.celebrate.mockReset()
  duo.hop.mockReset()
  document.body.textContent = ''
})

describe("Lesson 9's cold open", () => {
  it("plays Merc's leap before any choice, says it, draws its arc, and reveals nothing", async () => {
    // Act
    play('leap')
    await hear()

    // Assert
    expect(runs.map((r) => r.notes)).toEqual([leapNotes(50, MERC_LEAP)])
    expect(said()).toBe(mercLeapLine(50))
    expect(cents(ladder)).toEqual([0, 700])
    expect(ladder.chart.scene.arcs).toHaveLength(1)
    expect(reveal().hidden).toBe(true)
  })

  it('keeps the three paths locked until a choice, and locks the choice on its first press', () => {
    // Act
    PATH_IDS.forEach(play)
    const before = runs.length
    choose('mi')
    choose('re')

    // Assert
    expect(before).toBe(0)
    expect(
      PATH_IDS.map((p) =>
        el(`#predict [data-choice="${p}"]`).getAttribute('aria-pressed'),
      ),
    ).toEqual(['false', 'true', 'false'])
    expect(
      PATH_IDS.map(
        (p) => el<HTMLButtonElement>(`#predict [data-play="${p}"]`).disabled,
      ),
    ).toEqual([false, false, false])
    expect(hint()).toBe(HINTS.chosen)
  })

  it('plays each path as do, its middle note and so, and draws it as it sounds', async () => {
    // Arrange
    choose('re')

    // Act
    const drawn: number[][] = []
    for (const p of PATH_IDS) {
      play(p)
      await hear()
      drawn.push(cents(ladder))
    }

    // Assert
    expect(runs.map((r) => r.notes)).toEqual(
      PATH_IDS.map((p) => pathNotes(50, p)),
    )
    expect(drawn).toEqual([
      [0, 200, 700],
      [0, 400, 700],
      [0, 500, 700],
    ])
    expect(said()).toBe(pathLine(50, 'fa'))
  })

  it('waits for re, mi and fa, each heard with sound on, in any order, then says the choice and lets Tavi celebrate once', async () => {
    // Arrange
    choose('mi')

    // Act
    play('fa')
    await hear()
    const afterOne = { hidden: reveal().hidden, hint: hint() }
    play('re')
    await hear()
    const afterTwo = reveal().hidden
    play('mi')
    await hear()
    play('re')
    await hear()

    // Assert
    expect(afterOne).toEqual({ hidden: true, hint: HINTS.next })
    expect(afterTwo).toBe(true)
    expect(reveal().hidden).toBe(false)
    expect(el('#predict .reveal .mono').textContent).toBe('You said: mi')
    expect(hint()).toBe(HINTS.again)
    expect(duo.celebrate.mock.calls).toEqual([['orange', 1600]])
  })

  it('draws a silent play with sound off, shows why nothing was heard, and reveals nothing', async () => {
    // Arrange
    vi.spyOn(Sound, 'canPlay').mockReturnValue(false)
    vi.spyOn(Sound, 'state', 'get').mockReturnValue('off')
    choose('fa')

    // Act
    for (const p of PATH_IDS) {
      play(p)
      await hear()
    }

    // Assert
    expect(runs.map((r) => r.o.audible)).toEqual([false, false, false])
    expect(cents(ladder)).toEqual([0, 500, 700])
    expect(hint()).toBe(HINTS.silent)
    expect(reveal().hidden).toBe(true)
  })

  it('never counts a path cut short: with re and mi heard, fa stopped leaves the reveal hidden, and fa run out shows it', async () => {
    // Arrange
    choose('re')
    for (const p of ['re', 'mi']) {
      play(p)
      await hear()
    }

    // Act: another sound on the page starts while fa plays
    play('fa')
    runs[2].note(0)
    NowPlaying.claim(() => undefined)
    await settle()
    const cut = {
      stopped: runs[2].stopped,
      hidden: reveal().hidden,
      rungs: cents(ladder),
    }
    // and a stop from the Sound switch, as the kit's run ends unheard
    play('fa')
    await hear(false)
    const stoppedHidden = reveal().hidden
    play('fa')
    await hear()

    // Assert
    expect(cut).toEqual({ stopped: true, hidden: true, rungs: [0, 700] })
    expect(stoppedHidden).toBe(true)
    expect(reveal().hidden).toBe(false)
  })

  it('names and draws no middle note before a path plays, and says nothing of right or wrong', async () => {
    // Arrange
    const words = [
      ...Object.values(HINTS),
      ...Object.values(GUESS),
      mercLeapLine(50),
      ...PATH_IDS.map((p) => pathLine(50, p)),
    ]

    // Act
    const atRest = { rungs: cents(ladder), said: said() }
    play('leap')
    await hear()

    // Assert
    expect(atRest).toEqual({ rungs: [0, 700], said: '' })
    expect(said()).not.toMatch(/\b(re|mi|fa)\b/)
    expect(cents(ladder)).toEqual([0, 700])
    expect(words.filter((w) => /\b(right|wrong)\b/i.test(w))).toEqual([])
  })

  it('stops the play when another sound starts: the chart rests and the Merc falls quiet', async () => {
    // Arrange
    choose('mi')
    play('mi')
    runs[0].note(0)
    runs[0].note(1)
    const playing = cents(ladder)

    // Act
    NowPlaying.claim(() => undefined)
    await settle()

    // Assert
    expect(playing).toEqual([0, 400, 700])
    expect(cents(ladder)).toEqual([0, 700])
    expect(duo.sing.mock.calls.at(-1)).toEqual(['blue', 54, false])
  })

  it("sings with the stored voice's Merc, Tavi for the higher, and hops to land on each leap's second note", async () => {
    // Arrange
    vi.useFakeTimers()
    VoiceChoice.set('higher')
    choose('mi')

    // Act
    play('mi')
    runs[0].note(0)
    vi.advanceTimersByTime(469)
    const early = duo.hop.mock.calls.length
    vi.advanceTimersByTime(1)
    const first = duo.hop.mock.calls.length
    vi.advanceTimersByTime(1000)

    // Assert
    expect(runs[0].notes.map((n) => n.midi)).toEqual([62, 66, 69])
    expect(duo.sing.mock.calls[0]).toEqual(['orange', 62, true])
    expect([early, first]).toEqual([0, 1])
    expect(duo.hop.mock.calls).toEqual([['orange'], ['orange']])
  })

  it('stops a play when a voice is chosen elsewhere, and moves the chart to the new do', async () => {
    // Arrange
    play('leap')

    // Act
    VoiceChoice.set('higher')
    await settle()

    // Assert
    expect(runs[0].stopped).toBe(true)
    expect(ladder.chart.target).toBe(62)
    expect(cents(ladder)).toEqual([0, 700])
  })

  it('brings Merc and Tavi in once they are ready', async () => {
    // Act
    await settle()

    // Assert
    expect(el('#duo').classList.contains('pending')).toBe(false)
  })
})
