// ============================================================
// Staff toy tests — a tap plays its place, a step moves, a play lights as it sounds
// ============================================================
//
// The kit's staff toy (Lesson 15's WEB-SPEC, Toys 1), driven as a page
// drives it: its states are options, every sound is one of the kit's runs
// (here the recorder, so the test decides when each note starts and how a
// run ends), and the page's one sound owner stops it when anything newer
// plays.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import './browser-doubles.test-fixtures'
import type { Spelled } from './notes'
import { createSoundOwner } from './now-playing'
import type * as RunModule from './run'
import { live, resetRuns, runs } from './run-recorder.test-fixtures'
import { Sound } from './sound'
import type { StaffState, StaffToy } from './staff'
import { mountStaff, PitchLine } from './staff'

vi.mock('./run', async (actual) => ({
  ...(await actual<typeof RunModule>()),
  ...(await import('./run-recorder.test-fixtures')).recordedRuns,
}))

const G4: Spelled = { letter: 'G', alter: 0, octave: 4 }
const E4: Spelled = { letter: 'E', alter: 0, octave: 4 }

/** A toy's figure and controls, as a page marks them up. */
const MARKUP = `
  <div class="toy" id="t">
    <div class="viz"><svg data-staff-svg role="group" tabindex="0"></svg></div>
    <p data-staff-said aria-live="polite"></p>
    <div data-staff-clef role="group">
      <button type="button" data-clef="treble" aria-pressed="true">Treble</button>
      <button type="button" data-clef="bass" aria-pressed="false">Bass</button>
    </div>
    <button type="button" data-staff-step="1">Step up</button>
    <button type="button" data-staff-step="-1">Step down</button>
    <button type="button" data-staff-lanes aria-pressed="false">See it on the pitch line</button>
    <button type="button" data-staff-pan="-1">Lower keys</button>
    <button type="button" data-staff-pan="1">Higher keys</button>
  </div>`

const PLACE: StaffState = { staff: 'single', clef: 'treble', tap: 'place' }

let owner = createSoundOwner()

function mount(state: StaffState = PLACE, id = 't'): StaffToy {
  const root = document.getElementById(id)
  if (root === null) throw new Error(`no #${id}`)
  return mountStaff(root, { state, owner })
}

const root = (): HTMLElement => document.getElementById('t') as HTMLElement
const said = (): string =>
  root().querySelector('[data-staff-said]')?.textContent ?? ''
const heads = (): string[] =>
  Array.from(
    root().querySelectorAll('.st-head'),
    (h) => h.getAttribute('class') ?? '',
  )
const click = (sel: string): void =>
  root().querySelector<HTMLElement>(sel)?.click()
const last = () => runs[runs.length - 1]

beforeEach(() => {
  document.body.innerHTML = MARKUP
  resetRuns()
  owner = createSoundOwner()
  vi.spyOn(Sound, 'canPlay').mockReturnValue(true)
  PitchLine.set(false)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('a tap on a place', () => {
  it('plays its note for 0.8 s and says where it sits, its letter and octave', () => {
    // Arrange
    const toy = mount()

    // Act: the second line
    toy.tapPlace(2)

    // Assert: FACTS 64
    expect(runs).toHaveLength(1)
    expect(last().notes).toEqual([{ t: 0, midi: 67, dur: 0.8, kind: 'soft' }])
    expect(last().o.audible).toBe(true)
    expect(said()).toBe('G4, the second line')
    expect(toy.selected).toEqual(G4)
  })

  it('draws the note only as it sounds, lit, and back at rest when it ends', async () => {
    // Arrange: nothing on the staff before its sound
    const toy = mount()
    toy.tapPlace(2)
    expect(heads()).toEqual([])

    // Act
    last().note(0)
    const sounding = heads()
    last().end(true)
    await Promise.resolve()
    await Promise.resolve()

    // Assert
    expect(sounding).toEqual(['st-head is-lit'])
    expect(heads()).toEqual(['st-head'])
  })

  it("keeps to the state's reach, and says its end line at the edge", () => {
    // Arrange
    const toy = mount({
      ...PLACE,
      reach: [0, 8],
      endLine: 'Past here, the next lesson.',
    })

    // Act
    toy.tapPlace(11)

    // Assert
    expect(last().notes[0].midi).toBe(77)
    expect(said()).toBe('F5, the top line. Past here, the next lesson.')
  })

  it('plays nothing in a state with no taps', () => {
    // Arrange
    const toy = mount({ ...PLACE, tap: 'none' })

    // Act
    toy.tapPlace(2)
    click('[data-staff-step="1"]')

    // Assert
    expect(runs).toHaveLength(0)
  })

  it('asks for no sound while sound is off, and still says the place', () => {
    // Arrange
    vi.spyOn(Sound, 'canPlay').mockReturnValue(false)
    const toy = mount()

    // Act
    toy.tapPlace(0)

    // Assert
    expect(last().o.audible).toBe(false)
    expect(said()).toBe('E4, the bottom line')
  })
})

describe('Step up and Step down', () => {
  it('step one place at a time from the selected place, as the arrow keys do', () => {
    // Arrange
    const toy = mount()
    toy.tapPlace(2)

    // Act
    click('[data-staff-step="1"]')
    const up = said()
    root()
      .querySelector('[data-staff-svg]')
      ?.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }),
      )
    root()
      .querySelector('[data-staff-svg]')
      ?.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }),
      )

    // Assert
    expect(up).toBe('A4, the second space')
    expect(said()).toBe('F4, the bottom space')
    expect(runs.map((r) => r.notes[0].midi)).toEqual([67, 69, 67, 65])
  })

  it('start from the bottom of the reach with nothing picked, and say the end line past it', () => {
    // Arrange
    const toy = mount({
      ...PLACE,
      reach: [0, 1],
      endLine: 'That is the reach.',
    })

    // Act
    toy.step(1)
    toy.step(1)
    toy.step(1)

    // Assert
    expect(runs.map((r) => r.notes[0].midi)).toEqual([64, 65])
    expect(said()).toBe('That is the reach.')
  })
})

describe('a mover', () => {
  it('opens on its start note and moves the one note, 0.6 s at each place', () => {
    // Arrange
    const toy = mount({ ...PLACE, tap: 'mover', start: E4 })
    expect(heads()).toHaveLength(1)

    // Act
    toy.step(1)

    // Assert: FACTS 66
    expect(last().notes).toEqual([{ t: 0, midi: 65, dur: 0.6, kind: 'soft' }])
    expect(heads()).toHaveLength(1)
    expect(toy.selected).toEqual({ letter: 'F', alter: 0, octave: 4 })
  })
})

describe('the clef switch', () => {
  it('keeps the selected place, so the same line names another note and plays it, and presses its button', () => {
    // Arrange
    const toy = mount()
    toy.tapPlace(2)

    // Act
    click('button[data-clef="bass"]')

    // Assert
    expect(toy.clef).toBe('bass')
    expect(runs.map((r) => r.notes[0].midi)).toEqual([67, 47])
    expect(runs[0].stopped).toBe(true)
    expect(toy.selected).toEqual({ letter: 'B', alter: 0, octave: 2 })
    expect(said()).toBe('Bass clef. B2, the second line')
    expect(
      root()
        .querySelector('button[data-clef="bass"]')
        ?.getAttribute('aria-pressed'),
    ).toBe('true')
    expect(
      root()
        .querySelector('button[data-clef="treble"]')
        ?.getAttribute('aria-pressed'),
    ).toBe('false')
    expect(
      root().querySelector('[data-staff-svg]')?.getAttribute('aria-label'),
    ).toBe('Bass staff, five lines and four spaces')
  })

  it('stops what plays, and with no place picked plays nothing and names the clef', () => {
    // Arrange
    const toy = mount()
    void toy.play({ show: 'cursor', notes: [{ t: 0, dur: 1, note: G4 }] })

    // Act
    toy.setClef('bass')

    // Assert
    expect(runs[0].stopped).toBe(true)
    expect(live()).toHaveLength(0)
    expect(said()).toBe('Bass clef.')
  })
})

describe('a play', () => {
  const CLIMB = {
    show: 'run' as const,
    notes: [
      { t: 0, dur: 0.5, note: E4 },
      {
        t: 0.6,
        dur: 0.5,
        note: { letter: 'F', alter: 0, octave: 4 } as Spelled,
      },
      { t: 1.2, dur: 0.5, note: G4, gold: 'treble' as const },
    ],
  }

  it('is one run on one clock, each note drawn in its column as it sounds, and resolves true when heard', async () => {
    // Arrange
    const toy = mount()

    // Act
    const heard = toy.play(CLIMB)
    const before = heads()
    last().note(0)
    last().note(1)
    const two = heads()
    last().note(2)
    const gold = root().querySelectorAll('.st-gold').length
    last().end(true)

    // Assert
    expect(runs).toHaveLength(1)
    expect(last().notes.map((n) => n.midi)).toEqual([64, 65, 67])
    expect(before).toEqual([])
    expect(two).toEqual(['st-head is-lit', 'st-head is-lit'])
    expect(gold).toBe(1)
    expect(await heard).toBe(true)
  })

  it('stops, goes back to rest and resolves false when a newer sound claims the owner', async () => {
    // Arrange
    const toy = mount()
    const heard = toy.play(CLIMB)
    last().note(0)

    // Act
    owner.claim(() => undefined)

    // Assert
    expect(runs[0].stopped).toBe(true)
    expect(await heard).toBe(false)
    expect(heads().every((h) => h === 'st-head')).toBe(true)
  })

  it('stops the play before it when the toy plays again', async () => {
    // Arrange
    const toy = mount()
    const first = toy.play(CLIMB)

    // Act
    toy.tapPlace(4)

    // Assert
    expect(runs[0].stopped).toBe(true)
    expect(await first).toBe(false)
    expect(live()).toHaveLength(1)
  })

  it("keeps each note's letter beside the staff where the play says so", () => {
    // Arrange
    const toy = mount()

    // Act
    void toy.play({ ...CLIMB, keep: true })
    for (const i of [0, 1, 2]) last().note(i)

    // Assert
    expect(
      Array.from(root().querySelectorAll('.st-letter'), (t) => t.textContent),
    ).toEqual(['E', 'F', 'G'])
  })

  it("sounds in Merc's voice with a blue head where a note says so", () => {
    // Arrange
    const toy = mount()

    // Act
    void toy.play({
      show: 'cursor',
      kind: 'merc',
      notes: [{ t: 0, dur: 1, note: G4, tone: 'blue' }],
    })
    last().note(0)

    // Assert
    expect(last().o.kind).toBe('merc')
    expect(heads()).toEqual(['st-head is-blue'])
  })
})

describe('the pitch-line switch', () => {
  it('is one choice for the page: every staff toy follows it, and its buttons say so', () => {
    // Arrange: two toys
    document.body.innerHTML = MARKUP + MARKUP.replace('id="t"', 'id="u"')
    const a = mount()
    mount(PLACE, 'u')
    a.tapPlace(2)

    // Act
    click('[data-staff-lanes]')

    // Assert
    expect(PitchLine.on).toBe(true)
    for (const id of ['t', 'u']) {
      const el = document.getElementById(id)
      expect(
        el?.querySelector('[data-staff-lanes]')?.getAttribute('aria-pressed'),
      ).toBe('true')
      expect(el?.querySelectorAll('.st-lane').length).toBeGreaterThan(0)
    }
  })

  it('draws no pitch line in a state that leaves it out', () => {
    // Arrange
    mount({ ...PLACE, noLanes: true })

    // Act
    PitchLine.set(true)

    // Assert
    expect(root().querySelectorAll('.st-lane')).toHaveLength(0)
  })
})

describe('the key strip', () => {
  const KEYS: StaffState = {
    staff: 'grand',
    tap: 'place',
    keys: { lo: 43, hi: 77 },
  }

  it("plays a tapped key and writes it on the grand staff, a black key on its letter's place with a sharp", () => {
    // Arrange
    const toy = mount(KEYS)

    // Act
    toy.tapKey(61)
    last().note(0)

    // Assert
    expect(last().notes[0].midi).toBe(61)
    expect(toy.selected).toEqual({ letter: 'C', alter: 1, octave: 4 })
    expect(root().querySelectorAll('.st-sign')).toHaveLength(1)
    expect(root().querySelectorAll('.st-key.is-lit')).toHaveLength(1)
    expect(said()).toMatch(/^C sharp 4, /)
  })

  it('pans a white key at a time, each end button marked as at its end', () => {
    // Arrange
    const toy = mount(KEYS)
    const lower = root().querySelector('[data-staff-pan="-1"]')
    const higher = root().querySelector('[data-staff-pan="1"]')

    // Act: all the way down, then all the way up
    for (let i = 0; i < 30; i++) toy.panKeys(-1)
    const atBottom = [
      lower?.getAttribute('aria-disabled'),
      higher?.getAttribute('aria-disabled'),
    ]
    for (let i = 0; i < 30; i++) toy.panKeys(1)

    // Assert
    expect(atBottom).toEqual(['true', 'false'])
    expect([
      lower?.getAttribute('aria-disabled'),
      higher?.getAttribute('aria-disabled'),
    ]).toEqual(['false', 'true'])
  })

  it('names the grand staff for its group', () => {
    // Act
    mount(KEYS)

    // Assert
    expect(
      root().querySelector('[data-staff-svg]')?.getAttribute('aria-label'),
    ).toMatch(/^Grand staff: a treble staff above a bass staff/)
  })
})

describe('a score', () => {
  it('writes its notes before anything plays, the house on do, and lights one at a time', () => {
    // Arrange
    const toy = mount({
      ...PLACE,
      tap: 'none',
      score: [
        { note: G4, home: true },
        { note: { letter: 'A', alter: 0, octave: 4 } },
        { note: { letter: 'B', alter: 0, octave: 4 } },
      ],
    })

    // Act
    const before = heads()
    toy.light(1, 'amber')

    // Assert
    expect(before).toEqual(['st-head', 'st-head', 'st-head'])
    expect(root().querySelectorAll('.st-home')).toHaveLength(1)
    expect(heads()).toEqual(['st-head', 'st-head is-amber', 'st-head'])
    expect(runs).toHaveLength(0)
  })
})
