// ============================================================
// Lesson 28 steps' toy tests — the song on two staffs, a state for each step
// ============================================================
//
// The WEB-SPEC's Toys 2 and 3 and FACTS 46 and 48 to 51, on the page's own
// markup with the kit's runs a recorder and its score a double that the
// test moves beat by beat: the hero's ten empty bars and every control
// held until the cold open's choice; Step 1's tags fading in as each
// phrase's last bar sounds, and staying; Step 2's three ways from bar 7,
// each ending on its tag; Step 3's B written as it plays, then A, the form
// strip outlining the section sounding and lettering each heard; Step 4's
// part alone at a tap on its staff; the pitch line and back; one sound at
// a time; and free play's state switch.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type * as RunModule from '@/features/lessons/kit/run'
import { resetRuns, runs, } from '@/features/lessons/kit/run-recorder.test-fixtures'
import { el, loadPage, settle, soundOn, words } from './page-dom.test-fixtures'
import type { ScoreDouble } from './score-double.test-fixtures'
import { resetScores, scores } from './score-double.test-fixtures'
import { BANDS_SAID, blockSaid, blockScene, LOCKED_SAID, STATE_SAID, stepOneScene, waySaid, wayScene, } from './score-plays'
import type { ScoreToy } from './score-toy'
import { mountScoreToy } from './score-toy'
import { A, barsOf, bothNotes, partNotes } from './song'

vi.mock('@/features/lessons/kit/run', async (actual) => ({
  ...(await actual<typeof RunModule>()),
  ...(await import('@/features/lessons/kit/run-recorder.test-fixtures'))
    .recordedRuns,
}))
vi.mock(
  '@/features/lessons/kit/score',
  async () => (await import('./score-double.test-fixtures')).scoreDouble,
)

beforeEach(() => {
  loadPage()
  soundOn()
  resetRuns()
  resetScores()
})

afterEach(() => {
  // a newer sound stops what the test started
  NowPlaying.claim(() => undefined)
  vi.restoreAllMocks()
  document.body.textContent = ''
})

/** The toy on its own markup, `root` the steps' stage or free play, as the page mounts it. */
const mount = (root = '#toyScore'): ToyAndScore => {
  const toy = mountScoreToy(el(root), {
    state: 1,
    strip: el('[data-hero-strip]'),
  })
  return { toy, score: scores[scores.length - 1] }
}

interface ToyAndScore {
  readonly toy: ScoreToy
  readonly score: ScoreDouble
}

const lastRun = () => runs[runs.length - 1]
const clockOf = (score: ScoreDouble) => score.clocks[score.clocks.length - 1]
const said = (root = '#toyScore'): string =>
  words(el(`${root} [data-score-said]`))
const block = (k: number): HTMLButtonElement =>
  el<HTMLButtonElement>(`#toyScore [data-form-block="${k}"]`)

describe("until the cold open's choice", () => {
  it("draws the hero's ten empty bars and no staff, every control waiting under the lock line (FACTS 46)", () => {
    // Act
    const { toy, score } = mount()

    // Assert
    const figure = el('#toyScore [data-score]')
    const still = figure.querySelector('.score-locked')
    expect(toy.held).toBe(true)
    expect(figure.classList.contains('is-locked')).toBe(true)
    expect(figure.getAttribute('aria-label')).toBe(LOCKED_SAID)
    expect(still?.getAttribute('aria-hidden')).toBe('true')
    expect(still?.querySelectorAll('li')).toHaveLength(20)
    // a copy with no name of its own and no part for the steps to hide
    expect(
      still?.querySelector('[data-part], [role], [data-hero-strip]'),
    ).toBeNull()
    expect(score.shown).toHaveLength(0)
    const controls = Array.from(
      document.querySelectorAll<HTMLButtonElement>(
        '#toyScore [data-toy-play], #toyScore [data-form-block], #toyScore [data-pitch-line]',
      ),
    )
    expect(controls.length).toBe(9)
    expect(controls.every((b) => b.disabled)).toBe(true)
    expect(el('#toyScore [data-lock-line]').hidden).toBe(false)
  })

  it('plays nothing while it waits', async () => {
    const { toy } = mount()
    expect(await toy.play('phrase1')).toBe(false)
    expect(runs).toHaveLength(0)
  })
})

describe('Step 1: what makes a phrase sound finished', () => {
  it('draws A with its breaths and house once the choice is in, and puts the lock line away', () => {
    // Arrange
    const { toy, score } = mount()

    // Act
    toy.unlock()

    // Assert
    expect(score.last).toEqual({
      scene: stepOneScene(),
      written: Number.POSITIVE_INFINITY,
    })
    const figure = el('#toyScore [data-score]')
    expect(figure.classList.contains('is-locked')).toBe(false)
    expect(figure.getAttribute('aria-label')).toBe(STATE_SAID[1])
    expect(el('#toyScore [data-lock-line]').hidden).toBe(true)
    expect(el<HTMLButtonElement>('#toyScore [data-pitch-line]').disabled).toBe(
      false,
    )
  })

  it("fades each phrase's tag in as its last bar starts, says it, and keeps it (FACTS 48)", async () => {
    // Arrange
    const { toy, score } = mount()
    toy.unlock()

    // Act: bars 1 to 4, to the frame before bar 4 and the frame it starts
    void toy.play('phrase1')
    await settle()
    const clock = clockOf(score)
    clock.beat(11.9)
    const before = score.last?.scene.marks?.tags
    clock.beat(12)

    // Assert
    expect(lastRun().notes).toEqual(bothNotes(barsOf(A, 1, 4)))
    expect(clock.p.from).toBe(0)
    expect(clock.p.seconds).toBeCloseTo(13.333, 3)
    expect(before).toEqual([])
    expect(score.last?.scene.marks).toMatchObject({
      tags: [{ bar: 3, text: 'Imperfect: on V' }],
      numerals: [{ bar: 3, text: 'V' }],
    })
    expect(said()).toBe('Imperfect: on V.')
    // the cursor and the lights put back where the play stands
    expect(score.lit[score.lit.length - 1]).toBe(12)

    // Act: heard to its end, then bars 5 to 8
    lastRun().end(true)
    clock.end(true)
    await settle()
    void toy.play('phrase2')
    await settle()
    clockOf(score).beat(28)

    // Assert: both tags, the first kept
    expect(clockOf(score).p.from).toBe(16)
    expect(score.last?.scene.marks?.tags).toEqual([
      { bar: 3, text: 'Imperfect: on V' },
      { bar: 7, text: 'Perfect: V to I' },
    ])
    expect(score.last?.scene.marks?.numerals).toEqual([
      { bar: 3, text: 'V' },
      { bar: 6, text: 'V' },
      { bar: 7, text: 'I' },
    ])
  })

  it('stops a play when another starts: one sound at a time', async () => {
    // Arrange
    const { toy } = mount()
    toy.unlock()
    void toy.play('phrase1')
    await settle()

    // Act
    void toy.play('phrase2')
    await settle()

    // Assert
    expect(runs.map((r) => r.stopped)).toEqual([true, false])
  })
})

describe('Step 2: how a song can fake its ending', () => {
  it('draws each way from bar 7 and ends it on its tag, said once it shows (FACTS 49)', async () => {
    // Arrange
    const { toy, score } = mount()
    toy.unlock()

    // Act
    void toy.play('interrupted')
    await settle()
    const first = score.last
    clockOf(score).beat(3.9)
    const early = score.last?.scene
    clockOf(score).beat(4)

    // Assert
    expect(toy.state).toBe(2)
    expect(first?.scene).toEqual(wayScene('interrupted', false))
    expect(early).toEqual(wayScene('interrupted', false))
    expect(score.last?.scene).toEqual(wayScene('interrupted', true))
    expect(said()).toBe(waySaid('interrupted'))
  })

  it("shows the plagal tag at the Amen's second bar, its chords sounding in the soft tone", async () => {
    // Arrange
    const { toy, score } = mount()
    toy.unlock()

    // Act
    void toy.play('plagal')
    await settle()
    clockOf(score).beat(11.9)
    const early = score.last?.scene.marks?.tags
    clockOf(score).beat(12)

    // Assert
    expect(early).toEqual([])
    expect(score.last?.scene).toEqual(wayScene('plagal', true))
    expect(lastRun().notes.filter((n) => n.kind === 'soft')).toHaveLength(5)
  })

  it("keeps a way's tag once heard, and draws the next way plain", async () => {
    // Arrange
    const { toy, score } = mount()
    toy.unlock()
    void toy.play('perfect')
    await settle()
    clockOf(score).beat(4)

    // Act
    void toy.play('interrupted')
    await settle()
    const next = score.last?.scene
    void toy.play('perfect')
    await settle()

    // Assert
    expect(next).toEqual(wayScene('interrupted', false))
    expect(score.last?.scene).toEqual(wayScene('perfect', true))
  })
})

describe('Step 3: how a song is put together', () => {
  it('writes B as it plays, then shows A, outlining the block sounding and lettering each heard (Toys 3)', async () => {
    // Arrange
    const { toy, score } = mount()
    toy.unlock()

    // Act: Play B, then A
    void toy.play('bridge')
    await settle()
    const b = score.last
    const writes = clockOf(score).p.write
    const duringB = [3, 4].map((k) => [
      block(k).classList.contains('is-playing'),
      block(k).classList.contains('is-heard'),
    ])
    clockOf(score).end(true)
    await settle()
    const a = score.last
    const duringA = [3, 4].map((k) => block(k).classList.contains('is-playing'))
    clockOf(score).end(true)
    lastRun().end(true)
    await settle()

    // Assert
    expect(toy.state).toBe(3)
    expect(b).toEqual({ scene: blockScene(3), written: 0 })
    expect(writes).toBe(true)
    expect(duringB).toEqual([
      [true, true],
      [false, false],
    ])
    expect(a).toEqual({
      scene: blockScene(4),
      written: Number.POSITIVE_INFINITY,
    })
    expect(duringA).toEqual([false, true])
    expect(
      [1, 2, 3, 4].map((k) => block(k).classList.contains('is-heard')),
    ).toEqual([false, false, true, true])
    expect(document.querySelectorAll('#toyScore .is-playing')).toHaveLength(0)
  })

  it("plays a block's section at a tap, 26.67 s, and says which it shows", async () => {
    // Arrange
    const { toy, score } = mount()
    toy.unlock()
    toy.setState(3)

    // Act
    block(1).click()
    await settle()

    // Assert
    expect(lastRun().notes).toEqual(bothNotes(A))
    expect(clockOf(score).p.seconds).toBeCloseTo(26.667, 3)
    expect(clockOf(score).p.write).toBe(false)
    expect(el('#toyScore [data-score]').getAttribute('aria-label')).toBe(
      blockSaid(1),
    )
  })
})

describe('Step 4: how to read my part', () => {
  it('plays a part alone at a tap on its staff, lighting that staff only (FACTS 51)', async () => {
    // Arrange
    const { toy, score } = mount()
    toy.unlock()
    toy.setState(4)

    // Act
    score.options.onStaff?.(1)
    await settle()

    // Assert
    expect(lastRun().notes).toEqual(partNotes(A.merc))
    expect(clockOf(score).p.staffs).toEqual([1])
  })

  it('takes no tap on a staff in another step, nor before the choice', async () => {
    // Arrange
    const { toy, score } = mount()
    score.options.onStaff?.(0)
    toy.unlock()
    toy.setState(2)

    // Act
    score.options.onStaff?.(0)
    await settle()

    // Assert
    expect(runs).toHaveLength(0)
  })
})

describe('the pitch line', () => {
  it('redraws both parts as bands and says so, and another step opens on its staffs', () => {
    // Arrange
    const { toy, score } = mount()
    toy.unlock()
    const line = el<HTMLButtonElement>('#toyScore [data-pitch-line]')

    // Act
    line.click()
    const pressed = line.getAttribute('aria-pressed')
    const view = score.view
    const words = said()
    toy.setState(2)

    // Assert
    expect([view, pressed, words]).toEqual(['bands', 'true', BANDS_SAID])
    expect(score.view).toBe('staffs')
  })
})

describe('free play', () => {
  it('switches its state with 1 to 4 once the choice is in, each button pressed in turn (Toys 2)', () => {
    // Arrange
    const { toy } = mount('#freePlay')
    const state = (n: number) =>
      el<HTMLButtonElement>(`#freePlay [data-state="${n}"]`)
    const held = state(3).disabled

    // Act
    toy.unlock()
    state(3).click()

    // Assert
    expect(held).toBe(true)
    expect(toy.state).toBe(3)
    expect(
      [1, 2, 3, 4].map((n) => state(n).getAttribute('aria-pressed')),
    ).toEqual(['false', 'false', 'true', 'false'])
    expect(el('#freePlay [data-form-strip]').hidden).toBe(false)
    expect(said('#freePlay')).toBe(blockSaid(1))
  })
})
