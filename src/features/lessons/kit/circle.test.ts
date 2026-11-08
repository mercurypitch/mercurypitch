// ============================================================
// Circle toy tests — the house round its part, the bead buttons, and the walk
// ============================================================
//
// The circle-of-fifths toy (Lesson 21's WEB-SPEC, Toys 3), driven as a page
// drives it: the house steps a fifth at a time within its part, each bead in
// the part is a button named for its key, a bead past three sharps or flats
// is none, and the walk plays twelve fifths and the C they reach, the thread
// drawn bead to bead. Every sound is one of the kit's runs, here the
// recorder; the frame loop's drawer is caught, so a test draws a frame
// itself; the browser doubles turn reduced motion on, unless a test lets
// things move.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import './browser-doubles.test-fixtures'
import type { CircleToy } from './circle'
import { keyLabel, keyName, mountCircle } from './circle'
import type { CircleKey, CirclePart } from './circle-geometry'
import { CIRCLE, PARTS } from './circle-geometry'
import type * as FrameLoop from './frame-loop'
import type { Drawer } from './frame-loop'
import { createSoundOwner } from './now-playing'
import type * as RunModule from './run'
import { resetRuns, runs } from './run-recorder.test-fixtures'
import { Sound } from './sound'

vi.mock('./run', async (actual) => ({
  ...(await actual<typeof RunModule>()),
  ...(await import('./run-recorder.test-fixtures')).recordedRuns,
}))

const drawers: Drawer[] = []

vi.mock('./frame-loop', async (actual) => ({
  ...(await actual<typeof FrameLoop>()),
  addDrawer: (d: Drawer) => {
    drawers.push(d)
  },
}))

/** A circle's figure and controls, as a page marks them up. */
const MARKUP = `
  <div id="c">
    <div class="viz circle-viz" data-circle-viz>
      <svg data-circle-svg></svg>
      <div data-circle-beads role="group" aria-label="Circle of fifths"></div>
      <p data-circle-said aria-live="polite"></p>
    </div>
    <button type="button" data-circle-step="-1">Step back</button>
    <button type="button" data-circle-step="1">Step round</button>
  </div>`

/** The walk's figure: no bead buttons, Pure and Equal, and Play the walk. */
const WALK_MARKUP = `
  <div id="w">
    <div class="viz circle-viz" data-circle-viz>
      <svg data-circle-svg role="img"></svg>
      <p data-circle-said aria-live="polite"></p>
    </div>
    <div data-walk-tuning role="group">
      <button type="button" data-tuning="pure" aria-pressed="true">Pure</button>
      <button type="button" data-tuning="equal" aria-pressed="false">Equal</button>
    </div>
    <button type="button" data-walk-play>Play the walk</button>
  </div>`

let owner = createSoundOwner()
let moves: [string, string][] = []

function mount(
  part: CirclePart = PARTS.sharps,
  id = 'c',
): { toy: CircleToy; root: HTMLElement; drawer: Drawer } {
  const root = document.getElementById(id) as HTMLElement
  const toy = mountCircle(root, {
    active: () => true,
    part,
    owner,
    onMove: (k: CircleKey, from: CircleKey) =>
      moves.push([keyName(k), keyName(from)]),
  })
  return { toy, root, drawer: drawers[drawers.length - 1] }
}

const beadNames = (root: HTMLElement): (string | null)[] =>
  Array.from(root.querySelectorAll('[data-circle-beads] button'), (b) =>
    b.getAttribute('aria-label'),
  )
const current = (root: HTMLElement): string | null =>
  root
    .querySelector('[data-circle-beads] [aria-current="true"]')
    ?.getAttribute('aria-label') ?? null
const step = (root: HTMLElement, dir: 1 | -1): HTMLButtonElement =>
  root.querySelector(`[data-circle-step="${dir}"]`) as HTMLButtonElement
const said = (root: HTMLElement): string =>
  root.querySelector('[data-circle-said]')?.textContent ?? ''
const last = () => runs[runs.length - 1]

beforeEach(() => {
  document.body.innerHTML = MARKUP + WALK_MARKUP
  resetRuns()
  owner = createSoundOwner()
  moves = []
  vi.spyOn(Sound, 'canPlay').mockReturnValue(true)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('the house', () => {
  it('stands on C, the sharp side its part: four bead buttons, each named for its key', () => {
    // Act
    const { root } = mount()

    // Assert: WEB-SPEC, Toys 3
    expect(beadNames(root)).toEqual([
      'C major, no sharps or flats',
      'G major, one sharp',
      'D major, two sharps',
      'A major, three sharps',
    ])
    expect(current(root)).toBe('C major, no sharps or flats')
    expect(step(root, -1).getAttribute('aria-disabled')).toBe('true')
    expect(step(root, 1).getAttribute('aria-disabled')).toBe('false')
  })

  it('steps round a fifth at a time, telling the page each key it leaves and reaches', () => {
    // Arrange
    const { root, toy } = mount()

    // Act
    step(root, 1).click()
    step(root, 1).click()

    // Assert
    expect(moves).toEqual([
      ['G major', 'C major'],
      ['D major', 'G major'],
    ])
    expect(toy.key.key).toEqual({ sign: 'sharp', count: 2 })
    expect(current(root)).toBe('D major, two sharps')
    expect(said(root)).toBe('D major, two sharps')
  })

  it('stops at the end of its part: Step round is marked and does nothing at A', () => {
    // Arrange
    const { root, toy } = mount()
    root.querySelector<HTMLButtonElement>('[data-seat="3"]')?.click()
    moves = []

    // Act: a step round, and a page asking for E major, past three sharps
    step(root, 1).click()
    toy.moveTo(4)

    // Assert
    expect(step(root, 1).getAttribute('aria-disabled')).toBe('true')
    expect(moves).toEqual([])
    expect(current(root)).toBe('A major, three sharps')
  })

  it('steps back and round from a focused bead with the arrow keys, the focus following', () => {
    // Arrange
    const { root } = mount()
    const c = root.querySelector<HTMLButtonElement>('[data-seat="0"]')
    c?.focus()

    // Act
    c?.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }),
    )

    // Assert
    expect(moves).toEqual([['G major', 'C major']])
    expect(document.activeElement?.getAttribute('data-seat')).toBe('1')
  })

  it('moves the house without telling the page when the page plays its own scale', () => {
    // Arrange
    const { root, toy } = mount(PARTS.flats)

    // Act: Step 3's Spell it, which plays F major itself
    toy.moveTo(11, false)

    // Assert
    expect(moves).toEqual([])
    expect(current(root)).toBe('F major, one flat')
  })

  it('goes back to C, silently, when the page opens a part it stands outside', () => {
    // Arrange: on A, then Step 3's flat side
    const { root, toy } = mount()
    root.querySelector<HTMLButtonElement>('[data-seat="3"]')?.click()
    moves = []

    // Act
    toy.setPart(PARTS.flats)

    // Assert
    expect(moves).toEqual([])
    expect(toy.key.seat).toBe(0)
    expect(beadNames(root)).toEqual([
      'E flat major, three flats',
      'B flat major, two flats',
      'F major, one flat',
      'C major, no sharps or flats',
    ])
  })

  it('makes no bead past three sharps or flats a button, even in free play', () => {
    // Act
    const { root } = mount(PARTS.all)

    // Assert: FACTS 25
    expect(beadNames(root)).toHaveLength(7)
    expect(beadNames(root).join(' ')).not.toMatch(
      /\bE major|B or|F sharp or|C sharp or|A flat/,
    )
  })

  it('lights its bead and draws the house beside it, the beads dimmed past three', () => {
    // Arrange
    const { root, drawer } = mount()

    // Act
    drawer.draw(0, 0.016)

    // Assert
    expect(root.querySelectorAll('.ci-bead.is-lit')).toHaveLength(1)
    expect(root.querySelectorAll('.ci-bead.is-dim')).toHaveLength(5)
    expect(root.querySelectorAll('.ci-home')).toHaveLength(1)
    expect(drawer.wants?.()).toBe(false)
  })
})

describe('the walk', () => {
  it('plays twelve fifths up from C4 and the C they reach, then the first C again', () => {
    // Arrange
    const { toy } = mount(PARTS.sharps, 'w')

    // Act
    void toy.walk('pure')

    // Assert: FACTS 31 and 63, 7.6 s
    const notes = last().notes
    expect(notes).toHaveLength(14)
    expect(notes[0].midi).toBeCloseTo(60, 6)
    expect(notes[1].midi).toBeCloseTo(67.0196, 3)
    expect(notes[12].midi).toBeCloseTo(60.2346, 3)
    expect(notes[12].t).toBeCloseTo(5.4, 6)
    expect(notes[12].dur).toBe(1)
    expect(notes[13].t).toBeCloseTo(6.6, 6)
    expect(notes[13].dur).toBe(1)
    expect(notes[13].midi).toBeCloseTo(60, 6)
    expect(Math.max(...notes.map((n) => n.t + n.dur))).toBeCloseTo(7.6, 6)
  })

  it('closes on C with equal fifths', () => {
    // Arrange
    const { toy } = mount(PARTS.sharps, 'w')

    // Act
    void toy.walk('equal')

    // Assert
    expect(last().notes[12].midi).toBeCloseTo(60, 6)
    expect(last().notes[1].midi).toBeCloseTo(67, 6)
  })

  it('draws the thread bead to bead as each note sounds, and on Pure the gap past C', () => {
    // Arrange: motion paused by the doubles draws the whole thread at once
    const { toy, root, drawer } = mount(PARTS.sharps, 'w')

    // Act
    void toy.walk('pure')
    drawer.draw(0, 0.016)

    // Assert
    const d = root.querySelector('.ci-thread')?.getAttribute('d') ?? ''
    expect(d.match(/[ML]/g)).toHaveLength(13)
    expect(root.querySelectorAll('.ci-gap')).toHaveLength(1)
  })

  it('says how the walk ended only at its end', async () => {
    // Arrange
    const { toy, root } = mount(PARTS.sharps, 'w')
    const done = toy.walk('pure')
    const during = said(root)

    // Act
    last().end(true)
    await done

    // Assert
    expect(during).toBe('')
    expect(said(root)).toBe('The walk ended 23.46 cents above C')
  })

  it('plays as Pure or Equal says, and stops when a newer sound takes the page', async () => {
    // Arrange
    const { root } = mount(PARTS.sharps, 'w')
    root.querySelector<HTMLButtonElement>('[data-tuning="equal"]')?.click()

    // Act
    root.querySelector<HTMLButtonElement>('[data-walk-play]')?.click()
    const walk = last()
    owner.claim(() => undefined)

    // Assert
    expect(walk.notes[12].midi).toBeCloseTo(60, 6)
    expect(walk.stopped).toBe(true)
    expect(
      root.querySelector('[data-tuning="equal"]')?.getAttribute('aria-pressed'),
    ).toBe('true')
  })
})

describe('the words', () => {
  it('names each key for the eye and for a reader, the bottom three by both names', () => {
    // Assert
    expect(keyName(CIRCLE[5])).toBe('B or C♭ major')
    expect(keyName(CIRCLE[10])).toBe('B♭ major')
    expect(keyLabel(CIRCLE[6])).toBe('F sharp or G flat major, six sharps')
    expect(keyLabel(CIRCLE[11])).toBe('F major, one flat')
  })
})
