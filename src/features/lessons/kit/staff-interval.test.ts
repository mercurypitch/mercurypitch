// ============================================================
// Staff interval tests — two notes from C, the signs by their rule, held back until the choice, folded and curled
// ============================================================
//
// The staff toy's interval state (Lesson 23's WEB-SPEC, Toys 1), driven as
// a page drives it: every sound is one of the kit's runs (here the
// recorder, so the test decides when each note starts and how a run ends),
// and the page's one sound owner stops it when anything newer plays.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import './browser-doubles.test-fixtures'
import type { Spelled } from './notes'
import { createSoundOwner } from './now-playing'
import type * as RunModule from './run'
import { resetRuns, runs } from './run-recorder.test-fixtures'
import { Sound } from './sound'
import { PitchLine } from './staff'
import type { IntervalOptions, IntervalToy } from './staff-interval'
import { mountIntervalStaff, playLength } from './staff-interval'

vi.mock('./run', async (actual) => ({
  ...(await actual<typeof RunModule>()),
  ...(await import('./run-recorder.test-fixtures')).recordedRuns,
}))

const n = (letter: Spelled['letter'], alter = 0, octave = 4): Spelled => ({
  letter,
  alter,
  octave,
})

/** The toy's figure and controls, as a page marks them up. */
const MARKUP = `
  <div class="toy" id="t">
    <div class="viz"><svg data-staff-svg role="group" tabindex="0"></svg></div>
    <p data-staff-said aria-live="polite"></p>
    <p data-iv-readout></p>
    <button type="button" data-staff-step="1">Step up</button>
    <button type="button" data-staff-step="-1">Step down</button>
    <button type="button" data-iv-sign="sharp" aria-pressed="false">Sharp</button>
    <button type="button" data-iv-sign="flat" aria-pressed="false">Flat</button>
    <button type="button" data-iv-fold>Fold</button>
    <button type="button" data-iv-curl>Curl into a ring</button>
    <div role="group" data-staff-clef>
      <button type="button" data-clef="treble" aria-pressed="false">Treble</button>
      <button type="button" data-clef="bass" aria-pressed="true">Bass</button>
    </div>
    <button type="button" data-staff-lanes aria-pressed="true">See it on the pitch line</button>
  </div>`

let owner = createSoundOwner()

function mount(o: Partial<IntervalOptions> = {}): IntervalToy {
  const root = document.getElementById('t')
  if (root === null) throw new Error('no #t')
  return mountIntervalStaff(root, {
    state: { top: n('E') },
    owner,
    clef: 'treble',
    ...o,
  })
}

const root = (): HTMLElement => document.getElementById('t') as HTMLElement
const btn = (sel: string): HTMLButtonElement =>
  root().querySelector<HTMLButtonElement>(sel) as HTMLButtonElement
const said = (): string =>
  root().querySelector('[data-staff-said]')?.textContent ?? ''
const readout = (): string =>
  (root().querySelector('[data-iv-readout]')?.textContent ?? '')
    .replace(/\s+/g, ' ')
    .trim()
const last = () => runs[runs.length - 1]
/** Starts every note of the last run, as its timers would. */
const sound = (): void => {
  const r = last()
  r.notes.forEach((_n, i) => r.note(i))
}
const disabled = (sel: string): boolean =>
  btn(sel).getAttribute('aria-disabled') === 'true'
/** The pitch line's black-key lanes drawn, by their count. */
const blackLanes = (): number =>
  root().querySelectorAll('.iv-lane.is-black').length

beforeEach(() => {
  document.body.innerHTML = MARKUP
  resetRuns()
  owner = createSoundOwner()
  vi.spyOn(Sound, 'canPlay').mockReturnValue(true)
  PitchLine.set(true)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('the interval state', () => {
  it('opens on its clef and lines alone, the readout empty, until a sound writes the notes', () => {
    // Act
    mount()

    // Assert: SEASON-2 § 1.4 item 1
    expect(root().querySelectorAll('.st-head')).toHaveLength(0)
    expect(readout()).toBe('')
    expect(runs).toHaveLength(0)
  })

  it('moves the top note a letter at a time from C, playing the pair, and reads out the letters, semitones and name', () => {
    // Arrange: the top note waits on E, unwritten
    mount()

    // Act
    btn('[data-staff-step="1"]').click()
    sound()

    // Assert: C4, then F4, as Lesson 6's pair (FACTS 66, 71)
    expect(last().notes.map((x) => [x.t, x.midi, x.dur])).toEqual([
      [0, 60, 0.6],
      [0.75, 65, 0.8],
    ])
    expect(readout()).toBe(
      'C up to F: 4 letters · 5 semitones · a perfect fourth',
    )
    expect(said()).toBe(
      'C4 up to F4: 4 letters, 5 semitones, a perfect fourth.',
    )
    expect(root().querySelectorAll('.st-head')).toHaveLength(2)
  })

  it('stops at the unison and the octave, the step past each disabled', () => {
    // Arrange
    const toy = mount({ state: { top: n('C', 0, 5) } })

    // Assert: the eight letters from the unison to the octave
    expect(disabled('[data-staff-step="1"]')).toBe(true)
    toy.setState({ top: n('C') })
    expect(disabled('[data-staff-step="-1"]')).toBe(true)
    expect(disabled('[data-staff-step="1"]')).toBe(false)
  })

  it('plays on the bass staff an octave lower, and keeps the letters when the clef changes', () => {
    // Arrange
    const toy = mount({ clef: 'bass' })

    // Act
    toy.step(1)

    // Assert: C3 up to F3; the clef switch moves the interval, playing nothing
    expect(last().notes.map((x) => x.midi)).toEqual([48, 53])
    const before = runs.length
    toy.setClef('treble')
    expect(toy.top).toEqual(n('F'))
    expect(runs).toHaveLength(before)
    expect(btn('[data-clef="treble"]').getAttribute('aria-pressed')).toBe(
      'true',
    )
  })
})

describe('Sharp and Flat', () => {
  it('offer only the page’s spellings, whatever the choice: no sharp on E, B or C, no flat on F or C', () => {
    // Arrange
    const toy = mount()
    const offered = (top: Spelled): [boolean, boolean] => {
      toy.setState({ top })
      return [
        !disabled('[data-iv-sign="sharp"]'),
        !disabled('[data-iv-sign="flat"]'),
      ]
    }

    // Assert: Toys 1 and Tests 3
    expect(offered(n('E'))).toEqual([false, true])
    expect(offered(n('F'))).toEqual([true, false])
    expect(offered(n('B'))).toEqual([false, true])
    expect(offered(n('C'))).toEqual([false, false])
    expect(offered(n('C', 0, 5))).toEqual([false, false])
    expect(offered(n('G'))).toEqual([true, true])
  })

  it('raise or lower the top note a semitone, a second press takes the sign off, and the other swaps it', () => {
    // Arrange
    const toy = mount({ state: { top: n('G') } })

    // Act and assert
    toy.sign('sharp')
    expect([toy.top.alter, last().notes[1].midi]).toEqual([1, 68])
    toy.sign('flat')
    expect([toy.top.alter, last().notes[1].midi]).toEqual([-1, 66])
    toy.sign('flat')
    expect([toy.top.alter, last().notes[1].midi]).toEqual([0, 67])
    expect(btn('[data-iv-sign="flat"]').getAttribute('aria-pressed')).toBe(
      'false',
    )
  })

  it('clear when the top note moves to a new letter', () => {
    // Arrange
    const toy = mount({ state: { top: n('A') } })
    toy.sign('flat')

    // Act
    toy.step(1)

    // Assert: B, its own letter, plain
    expect(toy.top).toEqual(n('B'))
  })
})

describe('before the choice', () => {
  it('holds back Sharp, Flat, Fold and Curl, and draws the white-key lanes alone', () => {
    // Act
    const toy = mount({ locked: true, state: { top: n('A'), ring: true } })

    // Assert: Toys 1, Before the choice
    for (const sel of [
      '[data-iv-sign="sharp"]',
      '[data-iv-sign="flat"]',
      '[data-iv-fold]',
      '[data-iv-curl]',
    ])
      expect(disabled(sel), sel).toBe(true)
    expect(blackLanes()).toBe(0)
    expect(root().querySelectorAll('.iv-lane.is-white')).toHaveLength(8)
    toy.sign('flat')
    toy.curl()
    expect(runs).toHaveLength(0)
    expect(toy.curled).toBe(false)
  })

  it("draws a black key's own lane as it sounds, and no other", () => {
    // Arrange
    const toy = mount({ locked: true })

    // Act: Step 1's C up to E♭
    void toy.play({ pairs: [{ lo: n('C'), hi: n('E', -1) }] })
    sound()

    // Assert
    expect(blackLanes()).toBe(1)
    expect(readout()).toBe(
      'C up to E♭ flat: 3 letters · 3 semitones · a minor third',
    )
  })

  it('offers everything at the choice, the signs still by their rule, and draws the black-key lanes in', () => {
    // Arrange
    const toy = mount({ locked: true, state: { top: n('E') } })

    // Act
    toy.unlock()

    // Assert
    expect(toy.locked).toBe(false)
    expect(disabled('[data-iv-sign="sharp"]')).toBe(true)
    expect(disabled('[data-iv-sign="flat"]')).toBe(false)
    expect(disabled('[data-iv-fold]')).toBe(false)
    expect(blackLanes()).toBe(5)
  })
})

describe('Fold', () => {
  it('plays the interval and then its upside down, two pairs 3.6 s, and reads out both with the sums', () => {
    // Arrange
    const toy = mount({ state: { top: n('G') } })

    // Act
    void toy.fold()
    sound()

    // Assert: FACTS 21 to 24, 71
    expect(last().notes.map((x) => x.midi)).toEqual([60, 67, 67, 72])
    expect(last().notes.map((x) => x.t)).toEqual([0, 0.75, 2.05, 2.8])
    expect(readout()).toBe(
      'C up to G, then G up to C: a perfect fifth, then a perfect fourth · 5 + 4 = 9 · 7 + 5 = 12',
    )
    expect(said()).toContain('5 and 4 make 9, 7 and 5 make 12.')
    expect(root().querySelectorAll('.st-head')).toHaveLength(4)
    expect(root().querySelector('.iv-fit')).not.toBeNull()
  })

  it('folds the tritone onto six semitones again, and a move brings back the single interval', () => {
    // Arrange
    const toy = mount({ state: { top: n('F', 1) } })

    // Act
    void toy.fold()
    sound()
    const folded = readout()
    toy.step(1)
    sound()

    // Assert
    expect(folded).toContain('4 + 5 = 9 · 6 + 6 = 12')
    expect(readout()).toBe(
      'C up to G: 5 letters · 7 semitones · a perfect fifth',
    )
    expect(root().querySelector('.iv-fit')).toBeNull()
  })
})

describe("a page's plays", () => {
  it('play two pairs 0.5 s apart, and two together back to back, as long as the facts say', () => {
    // Assert: FACTS 66, 70
    expect(playLength({ pairs: [{ lo: n('C'), hi: n('E') }] })).toBeCloseTo(
      1.55,
      9,
    )
    expect(
      playLength({
        pairs: [
          { lo: n('C'), hi: n('F') },
          { lo: n('C'), hi: n('F', 1) },
        ],
      }),
    ).toBeCloseTo(3.6, 9)
    expect(
      playLength({
        pairs: [
          { lo: n('B', 0, 3), hi: n('F'), together: true },
          { lo: n('C'), hi: n('E'), together: true },
        ],
      }),
    ).toBeCloseTo(3.0, 9)
  })

  it('leave the top note where the play left it, and resolve heard only when nothing cut them short', async () => {
    // Arrange
    const toy = mount()

    // Act
    const play = toy.play({
      pairs: [
        { lo: n('C'), hi: n('G') },
        { lo: n('C'), hi: n('G', -1) },
      ],
    })
    sound()
    last().end(true)

    // Assert
    expect(await play).toBe(true)
    expect(toy.top).toEqual(n('G', -1))
    expect(readout()).toBe(
      'C up to G♭ flat: 5 letters · 6 semitones · a diminished fifth, a tritone',
    )
  })

  it("is the page's one sound: a newer sound stops it, and it counts as not heard", async () => {
    // Arrange
    const toy = mount()
    const play = toy.play({ pairs: [{ lo: n('C'), hi: n('E') }] })

    // Act: another of the page's sounds claims the owner
    owner.claim(() => undefined)

    // Assert
    expect(await play).toBe(false)
    expect(last().stopped).toBe(true)
  })
})

describe('Curl into a ring', () => {
  it('curls the line and straightens it, in a state that offers it, and plays nothing', () => {
    // Arrange
    const toy = mount({ state: { top: n('E'), ring: true } })

    // Act
    toy.curl()

    // Assert
    expect(toy.curled).toBe(true)
    expect(btn('[data-iv-curl]').textContent).toBe('Straighten the line')
    expect(runs).toHaveLength(0)
    toy.curl()
    expect(btn('[data-iv-curl]').textContent).toBe('Curl into a ring')
  })
})
