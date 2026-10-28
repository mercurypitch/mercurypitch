// ============================================================
// Lesson 12 ring of rooms tests — each state's chips and rooms, the key turn, the sound
// ============================================================
//
// On the page's own markup, its runs recorded (kit/run-recorder.test-
// fixtures.ts): each state (WEB-SPEC, Toys 1) opens on its own rooms with
// its chips named and labelled as the spec words them, Step 1's "on do"
// and the numerals from Step 2 on; Step 1's rooms build up, the newest
// lit. A chip plays its chord in the soft tone, 1.4 s from the key's own
// octave, as the page's one sound: it claims the owner, the next claim
// stops it, and with sound off it lights its room in silence all the same.
// The key switch is silent: a play still sounding stops first, the rooms
// turn, and the chips take G major's notes, vii° reading F♯ A C, spoken F
// sharp, until C puts them back; a second press while the rooms still
// turn does nothing. The figure draws its compact layout below 240 px of
// height. On the page's frame loop, run by hand, the ring asks for frames
// through a key turn's 0.6 s and for none at rest.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import { handLoop } from '@/features/lessons/kit/frame-loop.test-fixtures'
import type * as MotionModule from '@/features/lessons/kit/motion-switch'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type * as RunModule from '@/features/lessons/kit/run'
import { resetRuns, runs, } from '@/features/lessons/kit/run-recorder.test-fixtures'
import { Sound } from '@/features/lessons/kit/sound'
import { el, loadPage, settle, soundOn } from './page-dom.test-fixtures'
import type { Rooms, RoomsMode } from './rooms'
import { mountRooms, OPENING_ROOMS } from './rooms'
import { TURN_SEC } from './rooms-draw'
import { chip } from './sounds'

const motion = vi.hoisted(() => ({ reduced: true }))

vi.mock('@/features/lessons/kit/run', async (actual) => ({
  ...(await actual<typeof RunModule>()),
  ...(await import('@/features/lessons/kit/run-recorder.test-fixtures'))
    .recordedRuns,
}))

vi.mock('@/features/lessons/kit/motion-switch', async (actual) => ({
  ...(await actual<typeof MotionModule>()),
  reducedMotion: () => motion.reduced,
}))

/** A phone's figure at 390 x 844 (FACTS 75), and the deck's at 844 x 390. */
const FULL = { w: 356, h: 310 }
const COMPACT = { w: 778, h: 162 }

/** The figure's canvas, sized as the browser would lay it out. */
function sizeFigure(size: { w: number; h: number }): void {
  vi.spyOn(
    el<HTMLCanvasElement>('#toyRooms [data-rooms-viz] canvas'),
    'getBoundingClientRect',
  ).mockReturnValue(new DOMRect(0, 0, size.w, size.h))
}

/** The stage's ring, mounted on the page's markup in `mode`. */
function mount(
  mode: RoomsMode = 'build',
  size: { w: number; h: number } = FULL,
): Rooms {
  loadPage()
  sizeFigure(size)
  return mountRooms(el('#toyRooms'), {
    mode,
    active: () => true,
    owner: NowPlaying,
  })
}

/** The chord strip's seven chips, I to vii°. */
const chips = (): HTMLButtonElement[] =>
  Array.from(
    document.querySelectorAll<HTMLButtonElement>(
      '#toyRooms [data-chord-strip] button',
    ),
  )
const words = (b: Element, part: string): string =>
  b.querySelector(`[data-chip-${part}]`)?.textContent ?? ''
const said = (): string => el('#toyRooms [data-rooms-said]').textContent ?? ''
const summary = (): string =>
  el('#toyRooms [data-rooms-summary]').textContent ?? ''

beforeEach(() => {
  motion.reduced = true
  resetRuns()
  soundOn()
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] })
})

afterEach(() => {
  NowPlaying.claim(() => undefined)
  vi.useRealTimers()
  vi.restoreAllMocks()
  document.body.textContent = ''
})

describe("Lesson 12's ring of rooms, state by state", () => {
  it.each<[RoomsMode, string[], string]>([
    [
      'build',
      ['on do', 'on re', 'on mi', 'on fa', 'on so', 'on la', 'on ti'],
      'The chord on do: C, E, G',
    ],
    [
      'numerals',
      ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'],
      'Chord one, C major: C, E, G',
    ],
    [
      'slide',
      ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'],
      'Chord one, C major: C, E, G',
    ],
    [
      'loop',
      ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'],
      'Chord one, C major: C, E, G',
    ],
    [
      'tunes',
      ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'],
      'Chord one, C major: C, E, G',
    ],
  ])(
    'opens %s on its own rooms, none lit, its chips topped as the spec words them',
    (mode, tops, first) => {
      // Arrange
      const rooms = mount('build')

      // Act
      rooms.setMode(mode)

      // Assert: WEB-SPEC, Toys 1, the chord strip and each state
      expect(chips().map((b) => words(b, 'top'))).toEqual(tops)
      expect(chips().map((b) => words(b, 'notes'))).toEqual([
        'C E G',
        'D F A',
        'E G B',
        'F A C',
        'G B D',
        'A C E',
        'B D F',
      ])
      expect(chips()[0].getAttribute('aria-label')).toBe(first)
      expect(rooms.drawn).toEqual(OPENING_ROOMS[mode])
      expect(rooms.lit).toBeNull()
      expect(rooms.state().label).toBe(mode === 'build' ? 'name' : 'numeral')
    },
  )

  it('names every chip in words from Step 2 on: chord, quality and notes, no sign and no numeral', () => {
    // Arrange
    const rooms = mount('numerals')

    // Act
    rooms.setKey('G')
    const names = chips().map((b) => b.getAttribute('aria-label') ?? '')

    // Assert: WEB-SPEC, Toys 1, Keyboard and screen readers
    expect(names).toEqual([
      'Chord one, G major: G, B, D',
      'Chord two, A minor: A, C, E',
      'Chord three, B minor: B, D, F sharp',
      'Chord four, C major: C, E, G',
      'Chord five, D major: D, F sharp, A',
      'Chord six, E minor: E, G, B',
      'Chord seven, F sharp diminished: F sharp, A, C',
    ])
    for (const name of names) expect(name).not.toMatch(/[♯♭°]|\b[iv]+\b/)
  })

  it("builds Step 1's rooms a chip at a time, each left faint as the next lights, the newest lit", () => {
    // Arrange
    const rooms = mount('build')
    const press = (degree: number): void => chips()[degree].click()

    // Act
    press(0)
    press(3)
    press(4)
    press(3)

    // Assert: WEB-SPEC, Toys 1, Build
    expect(rooms.drawn).toEqual([0, 3, 4])
    expect(rooms.lit).toBe(3)
    expect(rooms.state().rooms).toEqual([0, 3, 4])
    expect(summary()).toBe(
      "C major's seven chords, three lit: one, four and five.",
    )
  })

  it("keeps Step 2's seven rooms as they are when a chip lights one", () => {
    // Arrange
    const rooms = mount('numerals')

    // Act
    chips()[5].click()

    // Assert
    expect(rooms.drawn).toEqual([0, 1, 2, 3, 4, 5, 6])
    expect(rooms.lit).toBe(5)
  })
})

describe("Lesson 12's chips, the page's one sound", () => {
  it('plays a chip as its chord in the soft tone, 1.4 s from the key’s own octave, lit while it sounds', async () => {
    // Arrange
    const rooms = mount('build')

    // Act
    chips()[6].click()
    const lit = chips().map((b) => b.classList.contains('is-on'))
    runs[0].end(true)
    await settle()

    // Assert: FACTS 69, B4 D5 F5 in C
    expect(runs).toHaveLength(1)
    expect(runs[0].notes).toEqual(chip(6, 'C'))
    expect(runs[0].notes.map((n) => n.midi)).toEqual([71, 74, 77])
    expect(runs[0].o).toMatchObject({ audible: true, kind: 'soft' })
    expect(lit).toEqual([false, false, false, false, false, false, true])
    expect(chips().some((b) => b.classList.contains('is-on'))).toBe(false)
    expect(rooms.lit).toBe(6)
  })

  it("claims the page's one sound, and another sound's claim stops it where it stands", async () => {
    // Arrange
    const rooms = mount('build')
    chips()[0].click()

    // Act: another source on the page takes the sound
    NowPlaying.claim(() => undefined)
    await settle()

    // Assert: stopped, its chip out, its room still lit
    expect(runs[0].stopped).toBe(true)
    expect(rooms.sounding).toBeNull()
    expect(chips()[0].classList.contains('is-on')).toBe(false)
    expect(rooms.lit).toBe(0)
  })

  it('stops the chord before when another chip plays, and lights only the new one', async () => {
    // Arrange
    const rooms = mount('build')
    chips()[0].click()

    // Act
    chips()[4].click()
    await settle()

    // Assert
    expect(runs.map((r) => r.stopped)).toEqual([true, false])
    expect(rooms.sounding).toBe(4)
    expect(chips().filter((b) => b.classList.contains('is-on'))).toEqual([
      chips()[4],
    ])
  })

  it('lights the room and the chip in silence with sound off, for as long as the chord would sound', async () => {
    // Arrange
    vi.spyOn(Sound, 'canPlay').mockReturnValue(false)
    const rooms = mount('build')

    // Act
    chips()[2].click()
    const during = { lit: rooms.lit, sounding: rooms.sounding }
    runs[0].end(true)
    await settle()

    // Assert: WEB-SPEC, Audio, Sound off or none
    expect(runs[0].o.audible).toBe(false)
    expect(during).toEqual({ lit: 2, sounding: 2 })
    expect(rooms.sounding).toBeNull()
    expect(rooms.drawn).toEqual([2])
  })
})

describe("Lesson 12's key switch", () => {
  it('relabels the chips to G major, vii° reading F♯ A C and spoken F sharp, and C restores them', () => {
    // Arrange
    const rooms = mount('numerals')
    const vii = chips()[6]

    // Act
    rooms.setKey('G')
    const inG = [words(vii, 'top'), words(vii, 'notes')]
    const nameInG = vii.getAttribute('aria-label')
    const iInG = words(chips()[0], 'notes')
    rooms.setKey('C')

    // Assert: FACTS 19, Toys 1
    expect(inG).toEqual(['vii°', 'F♯ A C'])
    expect(nameInG).toBe('Chord seven, F sharp diminished: F sharp, A, C')
    expect(iInG).toBe('G B D')
    expect([words(vii, 'top'), words(vii, 'notes')]).toEqual(['vii°', 'B D F'])
    expect(vii.getAttribute('aria-label')).toBe(
      'Chord seven, B diminished: B, D, F',
    )
  })

  it('turns the rooms in silence and says the key once', () => {
    // Arrange
    const rooms = mount('numerals')

    // Act
    const turned = rooms.setKey('G')

    // Assert: Toys 1, the switch is silent
    expect(turned).toBe(true)
    expect(runs).toHaveLength(0)
    expect(rooms.state()).toMatchObject({ key: 'G', turn: { from: 'C' } })
    expect(said()).toBe('G major: every chord turned round the ring.')
    expect(summary()).toBe(
      "G major's seven chords, seven lit: one, two, three, four, five, six and seven.",
    )
  })

  it('stops a chord still sounding first, and a chip after it sounds in the new key, from G3', () => {
    // Arrange
    const rooms = mount('numerals')
    chips()[0].click()

    // Act
    rooms.setKey('G')
    const turned = {
      stopped: runs[0].stopped,
      sounding: rooms.sounding,
      lit: chips().filter((b) => b.classList.contains('is-on')).length,
    }
    chips()[0].click()

    // Assert: WEB-SPEC, Edge cases, the key switch mid-play; FACTS 69
    expect(turned).toEqual({ stopped: true, sounding: null, lit: 0 })
    expect(runs[1].notes.map((n) => n.midi)).toEqual([55, 59, 62])
    expect(rooms.lit).toBe(0)
  })

  it('does nothing for the key already showing, and stops nothing', () => {
    // Arrange
    const rooms = mount('numerals')
    chips()[1].click()

    // Act
    const turned = rooms.setKey('C')

    // Assert
    expect(turned).toBe(false)
    expect(runs[0].stopped).toBe(false)
    expect(rooms.state().turn).toBeNull()
  })

  it('ignores a second press while the rooms still turn, and takes one once they have landed', () => {
    // Arrange: the turn moves, as with no reduced motion
    motion.reduced = false
    const rooms = mount('numerals')
    rooms.setKey('G')
    const first = rooms.state().turn

    // Act: C half way through the 0.6 s turn, then again once it has landed
    vi.advanceTimersByTime((TURN_SEC * 1000) / 2)
    const mid = rooms.setKey('C')
    const during = {
      key: rooms.settings.key,
      turn: rooms.state().turn,
      said: said(),
    }
    vi.advanceTimersByTime((TURN_SEC * 1000) / 2)
    const landed = rooms.setKey('C')

    // Assert: the rooms never jump back from half way
    expect(mid).toBe(false)
    expect(during).toEqual({
      key: 'G',
      turn: first,
      said: 'G major: every chord turned round the ring.',
    })
    expect(landed).toBe(true)
    expect(rooms.state().turn).toMatchObject({ from: 'G' })
  })

  it('takes every press under reduced motion, where each turn lands at once', () => {
    // Arrange
    const rooms = mount('numerals')

    // Act
    const presses = [rooms.setKey('G'), rooms.setKey('C'), rooms.setKey('G')]

    // Assert
    expect(presses).toEqual([true, true, true])
    expect(rooms.settings.key).toBe('G')
  })

  it('opens each state back in C, whatever key the last one was in', () => {
    // Arrange
    const rooms = mount('numerals')
    rooms.setKey('G')

    // Act
    rooms.setMode('numerals')

    // Assert
    expect(rooms.settings.key).toBe('C')
    expect(rooms.state().turn).toBeNull()
    expect(words(chips()[6], 'notes')).toBe('B D F')
    expect(said()).toBe('')
  })
})

describe("Lesson 12's ring, as the kit's spiral from above", () => {
  it('looks down on the lit turn C4 to B4, held still, its five black keys lit and its slider kept to the turn', () => {
    // Arrange, Act
    const rooms = mount('build')
    const slider = el('#toyRooms canvas')

    // Assert: WEB-SPEC, Toys 1, Seen from above
    expect(rooms.spiral.top).toBe(1)
    expect([...rooms.spiral.lit].sort((a, b) => a - b)).toEqual([
      61, 63, 66, 68, 70,
    ])
    expect(slider.getAttribute('role')).toBe('slider')
    expect(slider.tabIndex).toBe(0)
    expect(
      ['aria-valuemin', 'aria-valuemax'].map((a) =>
        Number(slider.getAttribute(a)),
      ),
    ).toEqual([60 - 45, 71 - 45])
  })

  it('draws the compact layout below 240 px tall, its label in the corner, and the full one at 240', () => {
    // Arrange, Act
    const compact = mount('numerals', COMPACT)
    const atCompact = [compact.compact, compact.state().compact]
    const edge = mount('numerals', { w: 778, h: 240 })
    const below = mount('numerals', { w: 778, h: 239 })

    // Assert: WEB-SPEC, Toys 1, The compact layout
    expect(atCompact).toEqual([true, true])
    expect(edge.compact).toBe(false)
    expect(below.compact).toBe(true)
    expect(mount('numerals', FULL).state().compact).toBe(false)
  })

  it('keeps every chord a chip in the compact layout, where the ring is too small to tap', () => {
    // Arrange
    const rooms = mount('build', COMPACT)

    // Act
    chips()[5].click()

    // Assert
    expect(runs[0].notes).toEqual(chip(5, 'C'))
    expect(rooms.lit).toBe(5)
  })
})

describe("Lesson 12's ring on the page's frame loop", () => {
  it('asks for no frame at rest, for every frame of a key turn’s 0.6 s, then for none', async () => {
    // Arrange: a fresh loop, run by hand, the turn moving
    const hand = await handLoop(false)
    const fresh = await import('./rooms')
    const { NowPlaying: owner } =
      await import('@/features/lessons/kit/now-playing')
    motion.reduced = false
    loadPage()
    const canvas = el<HTMLCanvasElement>('#toyRooms canvas')
    hand.paints(canvas)
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue(
      new DOMRect(0, 0, FULL.w, FULL.h),
    )
    const rooms = fresh.mountRooms(el('#toyRooms'), {
      mode: 'numerals',
      active: () => true,
      owner,
    })
    hand.settle()
    const resting = hand.asked.length

    // Act
    rooms.setKey('G')
    const frames = hand.settle()

    // Assert: the turn draws for its 0.6 s, a frame each 16 ms, then rests
    expect(resting).toBe(0)
    expect(frames).toBeGreaterThanOrEqual(Math.floor((TURN_SEC * 1000) / 16))
    expect(frames).toBeLessThanOrEqual(Math.ceil((TURN_SEC * 1000) / 16) + 2)
    expect(hand.asked).toHaveLength(0)
  })
})
