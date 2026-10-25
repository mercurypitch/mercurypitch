// ============================================================
// Lesson 9 steps tests — the one stage, in each step's parts, and Steps 1 and 2
// ============================================================
//
// On the page's own markup and its own deck: every step shows the controls
// its `data-part` lists name and hides the rest, so no two controls on the
// stage ever share an accessible name (WEB-SPEC, Toys 1, "Keyboard and
// screen readers"; Tests 8), each step has a control to press, and the
// figure's label and the chart's state follow the step. An address that
// names a step opens it in its own parts, and the step showing, shown
// again, changes nothing.
//
// Then Steps 1 and 2, their runs recorded (kit/run-recorder.test-fixtures.ts)
// and Merc and Tavi's renderer left out: what each play sounds for the
// stored voice (FACTS 92) and what its status line says (Tests 4's ratios);
// Slow's `aria-pressed`, doubling every length and onset and no pitch; the
// folds strip singing each of Step 1's notes, in its two stills under
// reduced motion (which the kit's browser doubles hold on), and resting
// apart when the play ends; Hear it first sounding so alone and lighting
// its band; and Step 2's illustration, labelled, before any play.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import type * as MercDuo from '@/features/lessons/kit/merc-duo'
import { hz } from '@/features/lessons/kit/notes'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type * as RunModule from '@/features/lessons/kit/run'
import { resetRuns, runs, } from '@/features/lessons/kit/run-recorder.test-fixtures'
import { Sound } from '@/features/lessons/kit/sound'
import { VoiceChoice } from '@/features/lessons/kit/voice-choice'
import { foldsLine, HEAR_LINE, moveLine } from './lines'
import { el, loadPage, mountSteps, settle, soundOn, } from './page-dom.test-fixtures'
import { hearFirstNotes, leapNotes, MERC_LEAP, SLOW, stepNotes } from './sounds'
import { FIG, partSteps, showParts } from './steps'

const duo = vi.hoisted(() => ({ sing: vi.fn() }))

vi.mock('@/features/lessons/kit/run', async (actual) => ({
  ...(await actual<typeof RunModule>()),
  ...(await import('@/features/lessons/kit/run-recorder.test-fixtures'))
    .recordedRuns,
}))

vi.mock('@/features/lessons/kit/merc-duo', async (actual) => ({
  ...(await actual<typeof MercDuo>()),
  mercSing: duo.sing,
}))

beforeEach(() => {
  localStorage.clear()
  VoiceChoice.set('lower')
  resetRuns()
})

afterEach(() => {
  vi.restoreAllMocks()
  duo.sing.mockReset()
  window.location.hash = ''
  document.body.textContent = ''
})

/** Whether `e` shows: neither it nor a parent inside the stage is hidden. */
function shows(e: HTMLElement): boolean {
  for (let at: HTMLElement | null = e; at !== null; at = at.parentElement)
    if (at.hidden) return false
  return true
}

/** The accessible name of each control showing on the stage, in page order. */
const stageNames = (): string[] =>
  Array.from(
    document.querySelectorAll<HTMLElement>('#stepsStage :is(button, input)'),
  )
    .filter(shows)
    .map(
      (b) =>
        b.getAttribute('aria-label') ??
        (b.textContent ?? '').replace(/\s+/g, ' ').trim(),
    )

/** The figure label's words. */
const label = (): string =>
  (el('#toyLadder [data-fig-label]').textContent ?? '')
    .replace(/\s+/g, ' ')
    .trim()

describe("Lesson 9's stage, step by step", () => {
  it.each([1, 2, 3, 4, 5])(
    'shows step %i its own controls, none sharing a name, under its own label',
    (n) => {
      // Arrange
      const deck = mountSteps()

      // Act
      deck.show(n)

      // Assert
      const names = stageNames()
      const own = names.filter(
        (name) => !['Previous step', 'Next step'].includes(name),
      )
      expect(own.length, names.join(' | ')).toBeGreaterThan(1)
      expect(names.filter((name, i) => names.indexOf(name) !== i)).toEqual([])
      expect(label()).toBe(FIG[n].replace(/<[^>]+>/g, ''))
    },
  )

  it("hides every part a step leaves out, and shows Step 1's folds only on Step 1", () => {
    // Arrange
    const deck = mountSteps()
    const strip = el('#toyLadder [data-folds-strip]')
    const scrub = el('#toyLadder [data-landing-scrub]')

    // Act
    deck.show(5)
    const onFive = [shows(strip), shows(scrub)]
    deck.show(1)

    // Assert
    expect(onFive).toEqual([false, true])
    expect([shows(strip), shows(scrub)]).toEqual([true, false])
  })

  it('opens the step an address names in its own parts, and its chart in its state', () => {
    // Arrange
    window.location.hash = '#step-3'

    // Act
    const { ladder } = mountSteps()

    // Assert
    expect(shows(el('#toyLadder [data-ladder-play="climb"]'))).toBe(true)
    expect(shows(el('#toyLadder [data-ladder-play="step"]'))).toBe(false)
    expect(label()).toBe(FIG[3].replace(/<[^>]+>/g, ''))
    expect(ladder.state).toBe('ladder')
  })

  it('shows each step its own state of the chart, and the step showing, shown again, leaves it be', () => {
    // Arrange
    const deck = mountSteps()
    const states: string[] = [deck.ladder.state]

    // Act
    for (const n of [2, 3, 4, 5]) {
      deck.show(n)
      states.push(deck.ladder.state)
    }
    const drawn = deck.ladder.play({ notes: [{ t: 0, midi: 50, dur: 1 }] })
    drawn.end()
    const before = deck.ladder.view
    deck.show(5)

    // Assert
    expect(states).toEqual(['step', 'hear', 'ladder', 'order', 'landing'])
    expect(deck.ladder.view).toBe(before)
    expect(el('#toyLadder .ladder-canvas').getAttribute('aria-label')).toBe(
      'Do, D3, and so, A3',
    )
  })

  it("draws the page in Step 1's parts before any script runs", () => {
    // Arrange
    loadPage()
    const root = el('#toyLadder')
    const before = Array.from(
      root.querySelectorAll<HTMLElement>('[data-part]'),
      (e) => e.hidden,
    )

    // Act
    showParts(root, 1)

    // Assert
    expect(
      Array.from(
        root.querySelectorAll<HTMLElement>('[data-part]'),
        (e) => e.hidden,
      ),
    ).toEqual(before)
  })

  it("reads a part's steps from its list, and nothing from an empty one", () => {
    // Arrange
    const both = document.createElement('p')
    both.setAttribute('data-part', ' 1  2 ')
    const none = document.createElement('p')
    none.setAttribute('data-part', '')

    // Act / Assert
    expect(partSteps(both)).toEqual([1, 2])
    expect(partSteps(none)).toEqual([])
  })
})

/** A play button on the steps' row. */
const press = (id: string): void =>
  el(`#toyLadder [data-ladder-play="${id}"]`).click()
const slowBtn = (): HTMLElement => el('#toyLadder [data-ladder-slow]')
const status = (): string =>
  el('#toyLadder [data-ladder-status]').textContent ?? ''

describe("Lesson 9's Steps 1 and 2", () => {
  beforeEach(() => {
    soundOn()
  })

  it.each([
    ['lower', 'step', stepNotes(50), foldsLine(50, 'step')],
    ['lower', 'leap', leapNotes(50, MERC_LEAP), foldsLine(50, 'leap')],
    ['higher', 'step', stepNotes(62), foldsLine(62, 'step')],
    ['higher', 'leap', leapNotes(62, MERC_LEAP), foldsLine(62, 'leap')],
  ] as const)(
    "plays Step 1's %s voice's %s as its notes, and names the move and the folds' ratio",
    (voice, id, notes, line) => {
      // Arrange
      VoiceChoice.set(voice)
      mountSteps()

      // Act
      press(id)

      // Assert
      expect(runs.map((r) => r.notes)).toEqual([notes])
      expect(status()).toBe(line)
    },
  )

  it("says Step 1's ratios as the spec gives them, 1.12 and 1.50 times", () => {
    // Arrange
    mountSteps()

    // Act
    press('step')
    const step = status()
    press('leap')

    // Assert
    expect(step).toBe(
      'The step: D3 to E3, a tone. The folds go about an eighth faster: 1.12 times.',
    )
    expect(status()).toBe(
      'The leap: D3 to A3, a perfect fifth. The folds go one and a half times as fast: 1.50 times.',
    )
  })

  it('presses Slow with aria-pressed, doubling every length and onset and no pitch, until it is pressed again', () => {
    // Arrange
    mountSteps()

    // Act
    slowBtn().click()
    const pressed = slowBtn().getAttribute('aria-pressed')
    press('step')
    press('leap')
    slowBtn().click()
    press('leap')

    // Assert
    expect(pressed).toBe('true')
    expect(slowBtn().getAttribute('aria-pressed')).toBe('false')
    expect(runs.map((r) => r.notes)).toEqual([
      stepNotes(50, SLOW),
      leapNotes(50, MERC_LEAP, SLOW),
      leapNotes(50, MERC_LEAP),
    ])
    expect(runs[0].notes).toEqual(
      stepNotes(50).map((n) => ({ ...n, t: 2 * n.t, dur: 2 * n.dur })),
    )
  })

  it("sings the folds strip at each of Step 1's notes, as its two stills under reduced motion, and rests it apart when the play ends", async () => {
    // Arrange
    const { strip } = mountSteps()
    press('step')
    const before = [strip.hz, strip.mode]

    // Act
    runs[0].note(0)
    const onDo = [strip.hz, strip.mode]
    runs[0].note(1)
    const onRe = strip.hz
    runs[0].end(true)
    await settle()

    // Assert
    expect(before).toEqual([null, 'apart'])
    expect(onDo).toEqual([hz(50), 'stills'])
    expect(onRe).toBe(hz(52))
    expect([strip.hz, strip.mode]).toEqual([null, 'apart'])
  })

  it("sings Merc of the chart's voice for each note, and quiets him and the button when a newer sound cuts the play short", async () => {
    // Arrange
    const { strip } = mountSteps()
    press('leap')
    runs[0].note(0)
    const playing = el(
      '#toyLadder [data-ladder-play="leap"]',
    ).classList.contains('is-on')

    // Act
    NowPlaying.claim(() => undefined)
    await settle()

    // Assert
    expect(playing).toBe(true)
    expect(runs[0].stopped).toBe(true)
    expect(strip.hz).toBe(null)
    expect(duo.sing.mock.calls).toEqual([
      ['blue', 50, true],
      ['blue', 50, false],
    ])
    expect(
      el('#toyLadder [data-ladder-play="leap"]').classList.contains('is-on'),
    ).toBe(false)
  })

  it("plays Step 2's Hear it first as so alone, lights so's band while it sounds, and says where the leap lands", () => {
    // Arrange
    const deck = mountSteps()
    deck.show(2)

    // Act
    press('hear')
    runs[0].note(0)

    // Assert
    expect(runs.map((r) => r.notes)).toEqual([hearFirstNotes(50)])
    expect(runs[0].notes.map((n) => n.midi)).toEqual([57])
    expect(status()).toBe(HEAR_LINE)
    expect(
      (deck.ladder.chart.scene.rungs ?? []).map((r) => [r.c, r.glow]),
    ).toEqual([
      [0, 0],
      [700, 1],
    ])
    expect(deck.strip.hz).toBe(null)
  })

  it("plays Step 2's Leap as do then so with Merc's arc, names the move alone, and leaves the folds be", () => {
    // Arrange
    const deck = mountSteps()
    deck.show(2)

    // Act
    press('leap')
    runs[0].note(0)
    runs[0].note(1)

    // Assert
    expect(runs.map((r) => r.notes)).toEqual([leapNotes(50, MERC_LEAP)])
    expect(status()).toBe(moveLine(50, 'leap'))
    expect(deck.ladder.chart.scene.arcs?.map((a) => a.drawn)).toEqual([1])
    expect(deck.strip.hz).toBe(null)
  })

  it("draws Step 2's illustrated copy from the start, labelled, landing 75 cents under so", () => {
    // Arrange
    const deck = mountSteps()

    // Act
    deck.show(2)

    // Assert
    const s = deck.ladder.chart.scene
    expect(s.label?.text).toBe('an illustration')
    expect(s.line.at(-1)?.c).toBe(625)
    expect(runs).toEqual([])
  })

  it('still draws a play with sound off, silently, and starts each step with an empty status line', () => {
    // Arrange
    vi.spyOn(Sound, 'canPlay').mockReturnValue(false)
    const deck = mountSteps()

    // Act
    press('step')
    const said = status()
    deck.show(2)

    // Assert
    expect(runs[0].o.audible).toBe(false)
    expect(said).toBe(foldsLine(50, 'step'))
    expect(status()).toBe('')
  })
})
