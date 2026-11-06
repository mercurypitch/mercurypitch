// ============================================================
// Lesson 22 band chart toy tests — its plays, its sliders, Drift and the ribbon
// ============================================================
//
// WEB-SPEC, Toys 2 and Audio: each play is one sung line on A3 with its
// own vibrato, or none for a straight note, drawn from the same schedule,
// its button lit while it sounds; a slider moved during its play glides
// the voice and carries the line on from that moment; Drift switched
// during a play stops it, and the next play rises 50 cents; opening
// another state stops what plays, and so does any other sound on the page;
// a play cut short leaves its line as it last drew; Stretch widens the
// app's ribbon, its swings one per 22 px, and says so; and free play's
// line for what waits on Step 3's choice shows only between the choices.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as MotionModule from '@/features/lessons/kit/motion-switch'
import { reducedMotion } from '@/features/lessons/kit/motion-switch'
import { hz } from '@/features/lessons/kit/notes'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type * as RunModule from '@/features/lessons/kit/run'
import { resetRuns, runs, } from '@/features/lessons/kit/run-recorder.test-fixtures'
import { el, loadPage, mountSteps, settle, soundOn, words, } from './page-dom.test-fixtures'
import { A3 } from './sounds'
import { mountVibToy } from './vib-toy'
import { DRIFT_LINE, ribbonLabel, stretchLine } from './vib-words'

vi.mock('@/features/lessons/kit/run', async (actual) => ({
  ...(await actual<typeof RunModule>()),
  ...(await import('@/features/lessons/kit/run-recorder.test-fixtures'))
    .recordedRuns,
}))

// reduced motion, as the doubles set it, unless a test draws a line as it
// sounds; the doubles go in first, since the switch reads the setting as it loads
vi.mock('@/features/lessons/kit/motion-switch', async (actual) => {
  await import('@/features/lessons/kit/browser-doubles.test-fixtures')
  return {
    ...(await actual<typeof MotionModule>()),
    reducedMotion: vi.fn(() => true),
  }
})

beforeEach(() => {
  resetRuns()
  soundOn()
  vi.mocked(reducedMotion).mockReturnValue(true)
})

afterEach(() => {
  vi.restoreAllMocks()
  window.location.hash = ''
  document.body.textContent = ''
})

/** The steps, opened by the cold open's choice, on step `n`. */
function opened(n: number) {
  const deck = mountSteps()
  deck.steps.unlock()
  deck.show(n)
  return deck
}

const click = (sel: string): void => {
  el<HTMLButtonElement>(sel).click()
}

/** Moves a slider, as a pointer or a key does. */
function slide(sel: string, value: number): void {
  const input = el<HTMLInputElement>(sel)
  input.value = String(value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

describe("a play's sound", () => {
  it('sings a straight note on A3 with no vibrato at all', () => {
    // Arrange
    opened(1)

    // Act
    click('[data-vib-play="straight"]')

    // Assert
    expect(runs).toHaveLength(1)
    expect(runs[0].kind).toBe('line')
    expect(runs[0].o.vibrato).toBeNull()
    expect(runs[0].points.map((p) => p.hz)).toEqual([hz(A3), hz(A3)])
    expect(runs[0].points.at(-1)?.t).toBe(3)
  })

  it('sings the wave with its own vibrato, and lights its button while it sounds', async () => {
    // Arrange
    opened(1)
    const b = el<HTMLButtonElement>('[data-vib-play="wave"]')

    // Act
    b.click()
    const lit = b.classList.contains('is-on')
    runs[0].end(true)
    await settle()

    // Assert
    expect(runs[0].o.vibrato).toEqual({ rate: 6, extent: 40, growIn: 0.3 })
    expect(lit).toBe(true)
    expect(b.classList.contains('is-on')).toBe(false)
  })

  it('says what it draws as it starts, and draws it on the chart', () => {
    // Arrange
    const deck = opened(1)

    // Act
    click('[data-vib-play="wave"]')

    // Assert
    expect(words(el('#toyChart [data-vib-said]'))).toBe(
      'The line waves up and down, six swings a second.',
    )
    expect(deck.steps.toy.chart.scene.wave?.stretches[0]).toMatchObject({
      kind: 'wave',
      rate: 6,
      extent: 40,
    })
    expect(deck.steps.toy.chart.canvas.getAttribute('aria-label')).toMatch(
      /swinging 40 cents either side/,
    )
  })
})

describe('a slider moved during a play', () => {
  it("glides Step 2's Play to the sliders' new values and carries its line on from that moment", () => {
    // Arrange
    const deck = opened(2)
    const clock = vi.spyOn(performance, 'now').mockReturnValue(10_000)
    click('[data-vib-play="measure"]')

    // Act: Rate 1.5 s in, Extent a tenth of a second later
    clock.mockReturnValue(11_500)
    slide('#vibRate2', 7)
    clock.mockReturnValue(11_600)
    slide('#vibExtent2', 60)

    // Assert
    expect(runs[0].glides).toEqual([
      { rate: 7, extent: 30 },
      { rate: 7, extent: 60 },
    ])
    const line = deck.steps.toy.chart.scene.wave?.stretches ?? []
    expect(line.at(-1)).toMatchObject({ rate: 7, extent: 60 })
    expect(words(el('#toyChart [data-vib-count]'))).toBe('7 swings a second')
  })

  it("leaves Merc's “ooh” in its own voice", () => {
    // Arrange
    opened(2)
    click('[data-vib-play="ooh"]')

    // Act
    slide('#vibRate2', 8)

    // Assert
    expect(runs[0].o.vibrato).toEqual({ rate: 5.5, extent: 14, growIn: 0.35 })
    expect(runs[0].glides).toEqual([])
  })

  it("follows Step 3's Rate in Play at this rate, at ±50", () => {
    // Arrange
    opened(3)
    click('[data-choice="moves"]')
    click('[data-vib-play="at-rate"]')

    // Act
    slide('#vibRate3', 2)

    // Assert
    expect(runs[0].glides).toEqual([{ rate: 2, extent: 50 }])
  })

  it('redraws the still and its readouts when no play sounds', () => {
    // Arrange
    const deck = opened(2)

    // Act
    slide('#vibExtent2', 50)

    // Assert
    expect(deck.steps.toy.chart.scene.wave?.stretches[0]).toMatchObject({
      extent: 50,
    })
    expect(words(el('#toyChart [data-vib-ruler]'))).toBe(
      '±50plus or minus 50 cents',
    )
    expect(el('#vibExtent2').getAttribute('aria-valuetext')).toBe(
      'plus or minus 50 cents',
    )
  })

  it('puts the still back, at the new value, once a play has ended', async () => {
    // Arrange: Step 3's slow wave heard to its end
    const deck = opened(3)
    click('[data-choice="moves"]')
    click('#predict3 [data-play="two"]')
    await settle()
    runs[0].end(true)
    await settle()

    // Act
    slide('#vibRate3', 4)

    // Assert
    expect(deck.steps.toy.chart.scene.wave?.stretches[0]).toMatchObject({
      rate: 4,
      extent: 50,
    })
    expect(runs[0].glides).toEqual([])
  })
})

describe('Drift', () => {
  it('stops a play when switched during it; the next play rises 50 cents, and says so once heard', async () => {
    // Arrange
    opened(3)
    click('[data-choice="one"]')
    click('[data-vib-play="at-rate"]')

    // Act
    click('[data-vib-drift]')
    const stopped = runs[0].stopped
    click('[data-vib-play="at-rate"]')
    runs[1].end(true)
    await settle()

    // Assert
    expect(stopped).toBe(true)
    expect(el('[data-vib-drift]').getAttribute('aria-pressed')).toBe('true')
    expect(runs[1].points.map((p) => p.hz)).toEqual([
      hz(A3),
      expect.closeTo(226.45, 2) as number,
    ])
    expect(words(el('#toyChart [data-vib-said]'))).toBe(DRIFT_LINE)
  })
})

describe('one sound at a time', () => {
  it('stops what plays when another step opens, or another sound on the page claims the owner', () => {
    // Arrange
    const deck = opened(1)
    click('[data-vib-play="wave"]')

    // Act
    deck.show(2)
    const left = runs[0].stopped
    click('[data-vib-play="measure"]')
    NowPlaying.claim(() => undefined)

    // Assert
    expect(left).toBe(true)
    expect(runs.map((r) => r.stopped)).toEqual([true, true])
  })

  it('leaves a line cut short as it last drew', async () => {
    // Arrange: the line drawn as it sounds
    vi.mocked(reducedMotion).mockReturnValue(false)
    const deck = opened(4)
    const clock = vi.spyOn(performance, 'now').mockReturnValue(10_000)
    click('[data-vib-play="sung"]')
    clock.mockReturnValue(10_800)

    // Act
    deck.steps.toy.stop()
    await settle()

    // Assert
    expect(runs[0].stopped).toBe(true)
    expect(deck.steps.toy.chart.scene.wave?.upTo).toBeCloseTo(0.8, 6)
  })
})

describe("Step 4's ribbon", () => {
  it('widens with Stretch, one swing per 22 px, and says so once let go', async () => {
    // Arrange: the ribbon's own chunk loaded
    opened(4)
    await vi.dynamicImportSettled()
    const svg = el('#toyChart [data-vib-ribbon] svg')

    // Act
    slide('#vibStretch', 330)
    el('#vibStretch').dispatchEvent(new Event('change', { bubbles: true }))

    // Assert
    expect(svg.getAttribute('aria-label')).toBe(ribbonLabel(15))
    expect(svg.querySelectorAll('path.vib-mark')).toHaveLength(1)
    expect(words(el('[data-vib-stretch-out]'))).toBe('330 px')
    expect(words(el('#toyChart [data-vib-said]'))).toBe(stretchLine(15))
  })

  it('starts at 220 px, ten swings, as the markup says', async () => {
    // Arrange
    mountSteps()
    await vi.dynamicImportSettled()

    // Assert
    expect(
      el('#toyChart [data-vib-ribbon] svg').getAttribute('aria-label'),
    ).toBe(ribbonLabel(10))
  })
})

describe("free play's held line", () => {
  it("shows on Step 3's state between the cold open's choice and Step 3's, and its held plays wait", () => {
    // Arrange
    loadPage()
    const root = el('#freePlay')
    const toy = mountVibToy(root, { active: () => true, owner: NowPlaying })
    const line = el('#freePlay [data-vib-lock3]')

    // Act
    toy.setState(3)
    const before = line.hidden
    toy.unlock()
    const between = line.hidden
    const twoHeld = el<HTMLButtonElement>(
      '#freePlay [data-vib-play="two"]',
    ).disabled
    const sixOpen = !el<HTMLButtonElement>('#freePlay [data-vib-play="six"]')
      .disabled
    toy.unlockHeld()

    // Assert
    expect([before, between, line.hidden]).toEqual([true, false, true])
    expect(twoHeld).toBe(true)
    expect(sixOpen).toBe(true)
    expect(
      el<HTMLButtonElement>('#freePlay [data-vib-play="two"]').disabled,
    ).toBe(false)
  })
})
