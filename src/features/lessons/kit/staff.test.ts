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
import { Motion } from './motion-switch'
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

  it("writes a chord's notes in one column, two chords side by side: Lesson 25's chord on so, then home", () => {
    // Arrange: E, G sharp and B, then A, C and E, in the treble clef
    const chord = (t: number, col: number, notes: readonly Spelled[]) =>
      notes.map((note) => ({ t, dur: 1.2, note, col }))
    const toy = mount()

    // Act
    void toy.play({
      show: 'run',
      notes: [
        ...chord(0, 0, [
          E4,
          { letter: 'G', alter: 1, octave: 4 },
          { letter: 'B', alter: 0, octave: 4 },
        ]),
        ...chord(1.2, 1, [
          { letter: 'A', alter: 0, octave: 4 },
          { letter: 'C', alter: 0, octave: 5 },
          { letter: 'E', alter: 0, octave: 5 },
        ]),
      ],
    })
    for (let i = 0; i < 6; i++) last().note(i)
    const xs = Array.from(root().querySelectorAll('.st-head'), (h) =>
      Number(
        /translate\(([-\d.]+)/.exec(h.getAttribute('transform') ?? '')?.[1],
      ),
    )

    // Assert: three heads in each of two columns
    expect(xs).toHaveLength(6)
    expect(new Set(xs.slice(0, 3)).size).toBe(1)
    expect(new Set(xs.slice(3)).size).toBe(1)
    expect(xs[3]).toBeGreaterThan(xs[0])
  })

  it("writes a silent play's notes as they come, sounding nothing and claiming no owner (Lesson 20's run toy)", async () => {
    // Arrange
    const toy = mount()

    // Act
    const heard = toy.play({ ...CLIMB, silent: true })
    last().note(0)
    const one = heads()
    owner.claim(() => undefined)
    last().note(1)
    last().note(2)
    last().end(true)

    // Assert: nothing asked to sound, and a newer sound leaves it to its page
    expect(last().o.audible).toBe(false)
    expect(Sound.canPlay).not.toHaveBeenCalled()
    expect(one).toEqual(['st-head is-lit'])
    expect(runs[0].stopped).toBe(false)
    expect(await heard).toBe(true)
  })

  it('stops a silent play when its page stops the toy', async () => {
    // Arrange
    const toy = mount()
    const heard = toy.play({ ...CLIMB, silent: true })
    last().note(0)

    // Act
    toy.stop()

    // Assert
    expect(runs[0].stopped).toBe(true)
    expect(await heard).toBe(false)
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

  it('writes a chord in one column and climbs the note a play turns over from where it was', () => {
    // Arrange: motion on, a figure that animates; C major turned over, E, G
    // and C5, its C climbing from C4 (Lesson 27's Turn over)
    vi.spyOn(Motion, 'paused', 'get').mockReturnValue(false)
    const climbs: number[] = []
    Object.defineProperty(SVGElement.prototype, 'animate', {
      configurable: true,
      value: (frames: Keyframe[], o: KeyframeAnimationOptions) => {
        if (/px, -?[1-9]/.test(String(frames[0].transform)))
          climbs.push(Number(o.duration))
        return {} as Animation
      },
    })
    const C4: Spelled = { letter: 'C', alter: 0, octave: 4 }
    const C5: Spelled = { letter: 'C', alter: 0, octave: 5 }
    const toy = mount()

    try {
      // Act
      void toy.play({
        show: 'run',
        notes: [
          { t: 0, dur: 1.2, note: E4, col: 0 },
          { t: 0, dur: 1.2, note: G4, col: 0 },
          { t: 0, dur: 1.2, note: C5, col: 0, from: C4 },
        ],
      })
      for (const i of [0, 1, 2]) last().note(i)

      // Assert: three heads in one column, and the climb, each time the
      // staff drew while it ran
      const xs = Array.from(root().querySelectorAll('.st-head'), (h) =>
        h.getAttribute('transform')?.replace(/ .*/, ''),
      )
      expect(new Set(xs).size).toBe(1)
      expect(xs).toHaveLength(3)
      expect(climbs.length).toBeGreaterThan(0)
      expect(new Set(climbs)).toEqual(new Set([400]))
    } finally {
      Reflect.deleteProperty(SVGElement.prototype, 'animate')
    }
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

  it("keeps a column of its own for each note on a phone's figure, so no two heads touch", () => {
    // Arrange: do, so, then so, do (Lesson 23's) beside the pitch line, in a
    // figure 200 px wide, as on a 344 px screen
    PitchLine.set(true)
    const svg = root().querySelector('svg')
    if (svg === null) throw new Error('no figure')
    vi.spyOn(svg, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      width: 200,
      height: 208,
      right: 200,
      bottom: 208,
      toJSON: () => ({}),
    })
    const at = (letter: 'A' | 'D', octave: number): Spelled => ({
      letter,
      alter: 0,
      octave,
    })

    // Act
    mount({
      ...PLACE,
      tap: 'none',
      score: [at('D', 4), at('A', 4), at('A', 4), at('D', 5)].map((note) => ({
        note,
      })),
    })

    // Assert: the heads' centres, in staff spaces apart; a head is about 1.2 wide
    const xs = Array.from(root().querySelectorAll('.st-head'), (h) =>
      Number(
        /translate\(([\d.-]+)/.exec(h.getAttribute('transform') ?? '')?.[1],
      ),
    )
    const lines = Array.from(root().querySelectorAll('.st-line'))
      .filter((l) => l.getAttribute('y1') === l.getAttribute('y2'))
      .map((l) => Number(l.getAttribute('y1')))
      .sort((a, b) => a - b)
    const space = lines[1] - lines[0]
    const gaps = xs.slice(1).map((x, i) => (x - xs[i]) / space)
    expect(gaps).toHaveLength(3)
    expect(Math.min(...gaps)).toBeGreaterThan(1.8)
  })
})

describe('a key signature', () => {
  const ONE_SHARP: StaffState = {
    ...PLACE,
    key: { sign: 'sharp', count: 1 },
    keyRoom: 3,
  }

  it('draws the signature of a state past the clef and names it with the staff', () => {
    // Act
    mount(ONE_SHARP)

    // Assert: Lesson 21 WEB-SPEC, Toys 2
    const svg = root().querySelector('[data-staff-svg]')
    expect(svg?.querySelectorAll('.st-keysign').length).toBe(1)
    expect(svg?.getAttribute('aria-label')).toBe(
      'Treble staff, five lines and four spaces. Key signature: one sharp, F sharp',
    )
  })

  it('plays a tapped place as the signature has it: the F line sounds F sharp', () => {
    // Arrange: the top line is F5
    const picks: [string, number][] = []
    const r = document.getElementById('t') as HTMLElement
    const toy = mountStaff(r, {
      state: ONE_SHARP,
      owner,
      onPick: (n, place) => picks.push([`${n.letter}${n.alter}`, place]),
    })

    // Act
    toy.tapPlace(8)

    // Assert
    expect(last().notes[0].midi).toBe(78)
    expect(toy.selected).toEqual({ letter: 'F', alter: 1, octave: 5 })
    expect(said()).toBe('F sharp 5, the top line')
    expect(picks).toEqual([['F1', 8]])
  })

  it('grows a sign at a time as the page sets it, saying each new signature', () => {
    // Arrange
    const toy = mount(ONE_SHARP)

    // Act
    toy.setKey({ sign: 'sharp', count: 2 })

    // Assert
    expect(said()).toBe('Key signature: two sharps, F sharp and C sharp')
    expect(root().querySelectorAll('.st-keysign').length).toBe(2)
    expect(toy.key).toEqual({ sign: 'sharp', count: 2 })
  })

  it('fades in a joining sign only on the draw that adds it', () => {
    // Arrange
    const toy = mount(ONE_SHARP)
    toy.setKey({ sign: 'sharp', count: 2 })
    const fresh = root().querySelectorAll('.st-keysign.is-fresh').length

    // Act: anything that draws again
    toy.tapPlace(2)
    last().note(0)

    // Assert
    expect(fresh).toBe(1)
    expect(root().querySelectorAll('.st-keysign.is-fresh').length).toBe(0)
  })

  it("travels a joining sign from the note that carried it in the time a page gives: Lesson 25's flats take 0.6 s, Lesson 21's 0.45", () => {
    // Arrange: motion on, a figure that animates, and C minor's run
    // written, its E flat in column 2 and its B flat in column 6
    vi.spyOn(Motion, 'paused', 'get').mockReturnValue(false)
    const moves: number[] = []
    Object.defineProperty(SVGElement.prototype, 'animate', {
      configurable: true,
      value: (_frames: Keyframe[], o: KeyframeAnimationOptions) => {
        moves.push(Number(o.duration))
        return {} as Animation
      },
    })
    const letters = ['C', 'D', 'E', 'F', 'G', 'A', 'B', 'C'] as const
    const flat = [2, 5, 6]
    const notes = letters.map((letter, i) => ({
      t: i * 0.4,
      dur: 0.35,
      note: {
        letter,
        alter: flat.includes(i) ? -1 : 0,
        octave: i === 7 ? 5 : 4,
      } as Spelled,
    }))
    const toy = mount({ ...PLACE, keyRoom: 3 })
    void toy.play({ show: 'run', notes })
    notes.forEach((_n, i) => last().note(i))
    last().end(true)

    try {
      // Act: B flat into the signature, then E flat
      toy.setKey({ sign: 'flat', count: 1 }, { from: 6, sec: 0.6 })
      toy.setKey({ sign: 'flat', count: 2 }, { from: 2 })

      // Assert
      expect(moves).toEqual([600, 450])
      expect(said()).toBe('Key signature: two flats, B flat and E flat')
    } finally {
      Reflect.deleteProperty(SVGElement.prototype, 'animate')
    }
  })

  it('drops the signature, saying so, and says nothing when it stays the same', () => {
    // Arrange
    const toy = mount(ONE_SHARP)
    toy.setKey(null)
    const dropped = said()
    toy.say('')

    // Act
    toy.setKey(null)

    // Assert
    expect(dropped).toBe('No key signature')
    expect(said()).toBe('')
    expect(root().querySelectorAll('.st-keysign').length).toBe(0)
  })

  it('writes the outlined note of a run in its ring, and its do over the house', () => {
    // Arrange
    const toy = mount({ ...PLACE, across: 23 })
    void toy.play({
      show: 'run',
      notes: [
        { t: 0, dur: 0.35, note: G4, home: true },
        { t: 0.4, dur: 0.35, note: E4, outline: true },
      ],
    })

    // Act
    last().note(0)
    last().note(1)

    // Assert
    expect(root().querySelectorAll('.st-home').length).toBe(1)
    expect(root().querySelectorAll('.st-outline').length).toBe(1)
  })

  it('puts the house on the picked note where the state places do', () => {
    // Arrange
    const toy = mount({ ...ONE_SHARP, house: true, reach: [-1, 9] })

    // Act
    toy.tapPlace(2)
    last().note(0)

    // Assert
    expect(root().querySelectorAll('.st-home').length).toBe(1)
  })

  it('hands a clef change to a page that follows the clef, saying and playing nothing itself', () => {
    // Arrange
    const clefs: string[] = []
    const r = document.getElementById('t') as HTMLElement
    const toy = mountStaff(r, {
      state: ONE_SHARP,
      owner,
      onClef: (c) => clefs.push(c),
    })
    toy.tapPlace(2)
    const before = runs.length

    // Act
    click('[data-clef="bass"]')

    // Assert: the signature moves with the clef, a line lower
    expect(clefs).toEqual(['bass'])
    expect(runs.length).toBe(before)
    expect(said()).not.toBe('Bass clef.')
    expect(toy.clef).toBe('bass')
    expect(root().querySelectorAll('.st-keysign').length).toBe(1)
  })
})

describe('reading along a written line (Lesson 16)', () => {
  const A4: Spelled = { letter: 'A', alter: 0, octave: 4 }
  const B4: Spelled = { letter: 'B', alter: 0, octave: 4 }
  const C5: Spelled = { letter: 'C', alter: 0, octave: 5 }
  const D5: Spelled = { letter: 'D', alter: 0, octave: 5 }
  /** Lesson 16's staff in the treble: do to so in G, the house on do. */
  const DO_TO_SO: StaffState = {
    ...PLACE,
    solfa: G4,
    score: [
      { note: G4, home: true },
      { note: A4 },
      { note: B4 },
      { note: C5 },
      { note: D5 },
    ],
  }
  const syls = (): string[] =>
    Array.from(root().querySelectorAll('.st-syl'), (t) => t.textContent ?? '')
  const NAMES = `
    <div data-staff-names role="group">
      <button type="button" data-names="on" aria-pressed="true">Names on</button>
      <button type="button" data-names="off" aria-pressed="false">Names off</button>
    </div>`

  it("writes each note's syllable under the staff, counted up from do, and Names off hides them and keeps the house", () => {
    // Arrange
    root().insertAdjacentHTML('beforeend', NAMES)
    const toy = mount(DO_TO_SO)
    const shown = syls()

    // Act
    click('[data-names="off"]')

    // Assert: WEB-SPEC, Toys 2, item 5
    expect(shown).toEqual(['do', 're', 'mi', 'fa', 'so'])
    expect(syls()).toEqual([])
    expect(toy.names).toBe(false)
    expect(root().querySelectorAll('.st-home')).toHaveLength(1)
    expect(heads()).toHaveLength(5)
    expect(
      root().querySelector('[data-names="off"]')?.getAttribute('aria-pressed'),
    ).toBe('true')
  })

  it('keeps its Names choice from state to state unless a state says, and shows syllables only with a do', () => {
    // Arrange
    const toy = mount(DO_TO_SO)
    toy.setNames(false)

    // Act
    toy.setState({ ...DO_TO_SO })
    const kept = syls()
    toy.setState({ ...DO_TO_SO, names: true })
    const said = syls()
    toy.setState({ ...PLACE, score: DO_TO_SO.score })

    // Assert
    expect(kept).toEqual([])
    expect(said).toEqual(['do', 're', 'mi', 'fa', 'so'])
    expect(syls()).toEqual([])
  })

  it("lights the score's note each note of a play sounds, and puts it back at rest", async () => {
    // Arrange
    const toy = mount({ ...DO_TO_SO, tap: 'none' })

    // Act: do, mi, so
    const heard = toy.play({
      show: 'score',
      notes: [
        { t: 0, dur: 0.5, note: G4 },
        { t: 0.6, dur: 0.5, note: B4 },
        { t: 1.2, dur: 0.5, note: D5 },
      ],
    })
    last().note(1)
    const mi = heads()
    last().end(true)

    // Assert
    expect(mi).toEqual([
      'st-head',
      'st-head',
      'st-head is-lit',
      'st-head',
      'st-head',
    ])
    expect(await heard).toBe(true)
    expect(heads().every((h) => h === 'st-head')).toBe(true)
  })

  it("lights a line that comes back down on its own later notes, not on the first of each pitch (Lesson 20's run)", () => {
    // Arrange: do, re, mi, re and do written
    const line = [G4, A4, B4, A4, G4]
    const toy = mount({
      ...PLACE,
      tap: 'none',
      score: line.map((note) => ({ note })),
    })

    // Act: the same five played, re and do again sounding
    void toy.play({
      show: 'score',
      notes: line.map((note, i) => ({ t: i * 0.5, dur: 0.4, note })),
    })
    last().note(3)
    const reAgain = heads()
    last().note(4)
    const doAgain = heads()

    // Assert: re's and do's later heads, never the first re or do
    expect([reAgain[1], reAgain[3]]).toEqual(['st-head', 'st-head is-lit'])
    expect([doAgain[0], doAgain[4]]).toEqual(['st-head', 'st-head is-lit'])
  })

  it('lights a note its beat before it sounds, silent, when it plays ahead: Hear it inside', () => {
    // Arrange
    vi.useFakeTimers()
    try {
      const toy = mount({ ...DO_TO_SO, tap: 'none' })

      // Act: re, sounding at 1.6 s, lit from 0.6 s
      void toy.play({
        show: 'score',
        notes: [{ t: 1.6, dur: 0.6, note: A4, ahead: 1.0 }],
      })
      vi.advanceTimersByTime(590)
      const before = heads()[1]
      vi.advanceTimersByTime(20)
      const ahead = heads()[1]

      // Assert: lit with nothing sounding yet (FACTS 68)
      expect(before).toBe('st-head')
      expect(ahead).toBe('st-head is-lit')
      expect(last().o.audible).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })

  it('plays do before a tapped note, 0.2 s apart, and do alone for a tap on do', () => {
    // Arrange: Step 1's Try
    const toy = mount({ ...DO_TO_SO, lead: G4 })

    // Act
    toy.tapPlace(4)
    const toMi = last().notes
    toy.tapPlace(2)
    const toDo = last().notes

    // Assert: FACTS 68, a tap 0.8 s
    expect(toMi).toEqual([
      { t: 0, midi: 67, dur: 0.8, kind: 'soft' },
      { t: 1, midi: 71, dur: 0.8, kind: 'soft' },
    ])
    expect(toDo).toEqual([{ t: 0, midi: 67, dur: 0.8, kind: 'soft' }])
  })

  it('lights the tapped note on a score, where a state with no score draws it alone', () => {
    // Arrange
    const toy = mount(DO_TO_SO)

    // Act: the middle line, mi
    toy.tapPlace(4)
    last().note(0)

    // Assert
    expect(heads()).toEqual([
      'st-head',
      'st-head',
      'st-head is-lit',
      'st-head',
      'st-head',
    ])
    expect(said()).toBe('B4, the middle line')
  })

  it('lights each note of a list, and the house glows with its do', () => {
    // Arrange: Sing it's start lights each written do amber
    const toy = mount({
      ...DO_TO_SO,
      tap: 'none',
      score: [
        { note: G4, home: true },
        { note: A4 },
        { note: B4 },
        { note: A4 },
        { note: G4 },
      ],
    })

    // Act
    toy.light([0, 4], 'amber')

    // Assert
    expect(heads()).toEqual([
      'st-head is-amber',
      'st-head',
      'st-head',
      'st-head',
      'st-head is-amber',
    ])
    expect(root().querySelector('.st-home')?.getAttribute('class')).toBe(
      'st-home is-amber',
    )
  })
})

describe('room and levels (Lesson 27)', () => {
  it('keeps room for the places a state names, so G3 under the treble staff stays in the figure', () => {
    // Arrange: G3 is place -5, under the second ledger line below
    const G3: Spelled = { letter: 'G', alter: 0, octave: 3 }
    const tight = mount()
    void tight.play({ show: 'run', notes: [{ t: 0, dur: 1, note: G3 }] })
    last().note(0)
    const low = (): number =>
      Number(
        /translate\([-\d.]+ ([-\d.]+)\)/.exec(
          root().querySelector('.st-head')?.getAttribute('transform') ?? '',
        )?.[1],
      )
    const height = (): number =>
      Number(
        root().querySelector('svg')?.getAttribute('viewBox')?.split(' ')[3],
      )
    const before = low() / height()

    // Act: the same note in a state that keeps room for it
    document.body.innerHTML = MARKUP
    const roomy = mount({ ...PLACE, room: [-5, 12] })
    void roomy.play({ show: 'run', notes: [{ t: 0, dur: 1, note: G3 }] })
    last().note(0)

    // Assert: drawn higher in its figure, inside it
    expect(low() / height()).toBeLessThan(before)
    expect(low()).toBeLessThan(height())
  })

  it("plays each note at its own level where a play's chords differ in size", () => {
    // Arrange
    const toy = mount()
    const C4: Spelled = { letter: 'C', alter: 0, octave: 4 }
    const B4: Spelled = { letter: 'B', alter: 0, octave: 4 }

    // Act: a three-note chord, then a four-note one
    void toy.play({
      show: 'run',
      notes: [
        { t: 0, dur: 1.2, note: C4, col: 0, gain: 0.075 },
        { t: 0, dur: 1.2, note: E4, col: 0, gain: 0.075 },
        { t: 0, dur: 1.2, note: G4, col: 0, gain: 0.075 },
        { t: 1.2, dur: 1.2, note: C4, col: 1, gain: 0.056 },
        { t: 1.2, dur: 1.2, note: E4, col: 1, gain: 0.056 },
        { t: 1.2, dur: 1.2, note: G4, col: 1, gain: 0.056 },
        { t: 1.2, dur: 1.2, note: B4, col: 1, gain: 0.056 },
      ],
    })

    // Assert
    expect(last().notes.map((n) => n.gain)).toEqual([
      0.075, 0.075, 0.075, 0.056, 0.056, 0.056, 0.056,
    ])
  })
})
