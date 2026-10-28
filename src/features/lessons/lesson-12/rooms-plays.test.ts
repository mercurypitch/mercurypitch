// ============================================================
// Lesson 12 ring of rooms tests — Step 3's slide, Step 4's loop and roots, Slow, the names
// ============================================================
//
// On the page's own markup, its runs recorded (kit/run-recorder.test-
// fixtures.ts), each note started by hand: Play I, then vi lights I, slides
// its corner as vi comes in, says what stayed and what moved once vi
// sounds, and leaves vi lit; cut short before vi it says nothing and leaves
// I lit (WEB-SPEC, Toys 1, Slide). Play the loop lights each room and its
// chip with its bar, and nothing once it ends; Play the roots names each
// move in the figure's readout as its root sounds, "do", "down to so", "up
// to la", "down to fa", its line joining each root to the one before (Toys
// 1, Loop; FACTS 26). Slow doubles every length from the next play, and
// holds when a step opens another state. The names switch, Letters ·
// Do-re-mi (Tests 13): under Do-re-mi in C the chord on la reads "la do mi"
// and the chord on do "do mi so"; in G do is G and ti is F♯, and the five
// beads left without a syllable are C♯, D♯, F, G♯ and A♯; no state names la
// as home (FACTS 8). A change of names stops what sounds first. The compact
// layout puts the syllables on the chips alone, and Step 4's readout in the
// figure's top-right corner, clear of the label in its top-left.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import type * as MotionModule from '@/features/lessons/kit/motion-switch'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type * as RunModule from '@/features/lessons/kit/run'
import { resetRuns, runs, } from '@/features/lessons/kit/run-recorder.test-fixtures'
import { BAR_SEC, KEYS, LOOP_DEGREES } from './music'
import { chips, COMPACT, el, FULL, mountRing, said, settle, soundOn, words, } from './page-dom.test-fixtures'
import type { RoomsMode } from './rooms'
import { marksAnimating, syllablesOf } from './rooms-marks'
import { iThenVi, loop, roots, slow } from './sounds'

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

const MODES: readonly RoomsMode[] = [
  'build',
  'numerals',
  'slide',
  'loop',
  'tunes',
]

/** The chips that show `is-on`, by degree. */
const lit = (): number[] =>
  chips().flatMap((b, i) => (b.classList.contains('is-on') ? [i] : []))
/** Step 4's readout of moves, as it reads now. */
const moves = (): string =>
  el('#toyRooms [data-rooms-moves]').textContent?.trim() ?? ''

/** Starts every note of the latest run that starts at `t` seconds, as the kit's timer would. */
function notesAt(t: number): void {
  const r = runs.at(-1)
  if (r === undefined) throw new Error('nothing plays')
  r.notes.forEach((n, i) => {
    if (Math.abs(n.t - t) < 1e-9) r.note(i)
  })
}

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

describe("Lesson 12's Step 3, Play I, then vi", () => {
  it('lights I, slides its corner as vi comes in, says what stayed and what moved, and leaves vi lit', async () => {
    // Arrange
    const rooms = mountRing('slide')

    // Act
    void rooms.playSlide()
    const opening = { lit: rooms.lit, slide: rooms.state().slide }
    notesAt(0)
    const saidOverI = said()
    notesAt(1.7)
    const saidOverVi = said()
    runs[0].end(true)
    await settle()

    // Assert: WEB-SPEC, Toys 1, Slide; FACTS 21, 69
    expect(runs[0].notes).toEqual(iThenVi('C'))
    expect(runs[0].o).toMatchObject({ audible: true, kind: 'soft' })
    expect(opening).toMatchObject({ lit: 0, slide: { by: 1 } })
    expect(saidOverI).toBe('')
    expect(saidOverVi).toBe(
      'One, C major, then six, A minor: C and E stay, and G becomes A.',
    )
    expect(rooms.lit).toBe(5)
    expect(rooms.state().slide).toBeNull()
  })

  it('says nothing and leaves I lit when it is stopped before vi sounds', async () => {
    // Arrange
    const rooms = mountRing('slide')
    void rooms.playSlide()
    notesAt(0)

    // Act: another sound on the page takes over
    NowPlaying.claim(() => undefined)
    await settle()

    // Assert
    expect(runs[0].stopped).toBe(true)
    expect(said()).toBe('')
    expect(rooms.lit).toBe(0)
    expect(rooms.state().slide).toBeNull()
  })

  it('slides D to E in G, from G3, and takes twice as long under Slow', () => {
    // Arrange
    const rooms = mountRing('slide')
    rooms.setKey('G')
    rooms.setSlow(true)

    // Act
    void rooms.playSlide()
    notesAt(2 * 1.7)

    // Assert: FACTS 69a
    expect(runs[0].notes).toEqual(slow(iThenVi('G')))
    expect(runs[0].notes.slice(0, 3).map((n) => n.midi)).toEqual([55, 59, 62])
    expect(rooms.state().slide).toMatchObject({ by: 2 })
    expect(said()).toBe(
      'One, G major, then six, E minor: G and B stay, and D becomes E.',
    )
  })
})

describe("Lesson 12's Step 4, Play the loop", () => {
  it('lights each room and its chip with its bar, I, V, vi and IV, and nothing once it ends', async () => {
    // Arrange
    const rooms = mountRing('loop')
    void rooms.playLoop()

    // Act: each bar's chord starts
    const seen = LOOP_DEGREES.map((_, i) => {
      notesAt(i * BAR_SEC)
      return { room: rooms.lit, chips: lit() }
    })
    runs[0].end(true)
    await settle()

    // Assert: WEB-SPEC, Toys 1, Loop; FACTS 68
    expect(runs[0].notes).toEqual(loop('C'))
    expect(seen).toEqual([
      { room: 0, chips: [0] },
      { room: 4, chips: [4] },
      { room: 5, chips: [5] },
      { room: 3, chips: [3] },
    ])
    expect(rooms.drawn).toEqual([...LOOP_DEGREES])
    expect(rooms.lit).toBeNull()
    expect(lit()).toEqual([])
  })

  it('follows its bars at twice their length under Slow, 16 s in all', () => {
    // Arrange
    const rooms = mountRing('loop')
    rooms.setSlow(true)

    // Act
    void rooms.playLoop()
    notesAt(2 * BAR_SEC)

    // Assert
    expect(runs[0].notes).toEqual(slow(loop('C')))
    expect(Math.max(...runs[0].notes.map((n) => n.t + n.dur))).toBe(16)
    expect(rooms.lit).toBe(4)
  })
})

describe("Lesson 12's Step 4, Play the roots", () => {
  it('names each move in the readout as its root sounds, and joins each root to the one before', async () => {
    // Arrange
    const rooms = mountRing('loop')
    const atRest = moves()
    void rooms.playRoots()

    // Act
    const heard = runs[0].notes.map((_, i) => {
      runs[0].note(i)
      return {
        move: moves(),
        roots: rooms.marks().roots.map((r) => r.midi),
        playing: rooms.marks().rootsPlaying,
      }
    })
    runs[0].end(true)
    await settle()

    // Assert: WEB-SPEC, Toys 1, Loop; FACTS 26, 71
    expect(runs[0].notes).toEqual(roots('C'))
    expect(heard).toEqual([
      { move: 'do', roots: [60], playing: true },
      { move: 'down to so', roots: [60, 55], playing: true },
      { move: 'up to la', roots: [60, 55, 57], playing: true },
      { move: 'down to fa', roots: [60, 55, 57, 53], playing: true },
    ])
    expect(atRest).toBe('—')
    expect(rooms.marks().rootsPlaying).toBe(false)
    expect(rooms.marks().roots).toHaveLength(4)
  })

  it('pulses only while a root sounds, and a root cut short stops sounding at once', async () => {
    // Arrange
    const rooms = mountRing('loop')
    void rooms.playRoots()
    runs[0].note(0)
    const start = performance.now()

    // Act: half way through do, the play is stopped
    vi.advanceTimersByTime(1000)
    const sounding = marksAnimating(rooms.marks(), performance.now())
    rooms.stop()
    await settle()

    // Assert
    expect(sounding).toBe(true)
    expect(rooms.marks().roots[0]).toMatchObject({
      from: start,
      to: start + 1000,
    })
    expect(marksAnimating(rooms.marks(), performance.now())).toBe(false)
  })

  it('clears its line and puts the readout back when another play starts, or the step opens another state', () => {
    // Arrange
    const rooms = mountRing('loop')
    void rooms.playRoots()
    runs[0].note(0)
    runs[0].note(1)

    // Act
    void rooms.playLoop()
    const afterLoop = { roots: rooms.marks().roots, move: moves() }
    void rooms.playRoots()
    runs[2].note(0)
    rooms.setMode('slide')

    // Assert
    expect(afterLoop).toEqual({ roots: [], move: '—' })
    expect(rooms.marks().roots).toEqual([])
    expect(moves()).toBe('—')
  })
})

describe("Lesson 12's Step 4 readout, in the compact layout", () => {
  it("moves to the figure's top-right corner, clear of the label in its top-left, and stays top-left at full size", () => {
    // Arrange, Act
    mountRing('loop', COMPACT)
    const compact = el('#toyRooms .readout').classList.contains('right')
    mountRing('loop', FULL)

    // Assert: WEB-SPEC, Toys 1, The compact layout and Readouts
    expect(compact).toBe(true)
    expect(el('#toyRooms .readout').classList.contains('right')).toBe(false)
  })
})

describe("Lesson 12's Slow", () => {
  it('holds when a step opens another state, and changes nothing that already sounds', () => {
    // Arrange
    const rooms = mountRing('slide')
    void rooms.playSlide()

    // Act
    rooms.setSlow(true)
    rooms.setMode('loop')
    void rooms.playLoop()

    // Assert
    expect(runs[0].notes).toEqual(iThenVi('C'))
    expect(rooms.settings.slow).toBe(true)
    expect(runs[1].notes).toEqual(slow(loop('C')))
  })
})

describe("Lesson 12's names switch, Letters · Do-re-mi", () => {
  it('reads the chord on la "la do mi" and the chord on do "do mi so" under Do-re-mi, by syllable in its name too', () => {
    // Arrange
    const rooms = mountRing('slide')

    // Act
    rooms.setNames('solfege')

    // Assert: WEB-SPEC, Tests 13
    expect(chips().map((b) => words(b, 'notes'))).toEqual([
      'do mi so',
      're fa la',
      'mi so ti',
      'fa la do',
      'so ti re',
      'la do mi',
      'ti re fa',
    ])
    expect(chips()[5].getAttribute('aria-label')).toBe(
      'Chord six, A minor: la, do, mi',
    )
    expect(chips()[0].getAttribute('aria-label')).toBe(
      'Chord one, C major: do, mi, so',
    )
  })

  it.each(KEYS)(
    'puts do on %s major’s tonic beside its bead, ti on its seventh, and no syllable on the five notes outside the key',
    (key) => {
      // Arrange
      const rooms = mountRing('slide')
      rooms.setKey(key)

      // Act
      rooms.setNames('solfege')
      const marks = new Map(rooms.marks().syllables.map((s) => [s.pc, s.text]))

      // Assert: WEB-SPEC, Edge cases, G major under Do-re-mi
      const [tonic, seventh, outside] =
        key === 'C' ? [0, 11, [1, 3, 6, 8, 10]] : [7, 6, [1, 3, 5, 8, 10]]
      expect(marks.get(tonic)).toBe('do')
      expect(marks.get(seventh)).toBe('ti')
      expect(marks.size).toBe(7)
      for (const pc of outside) expect(marks.has(pc)).toBe(false)
      expect(syllablesOf(key).map((s) => s.text)).toEqual([
        'do',
        're',
        'mi',
        'fa',
        'so',
        'la',
        'ti',
      ])
    },
  )

  it.each(MODES.flatMap((mode) => KEYS.map((key) => [mode, key] as const)))(
    'names no la as home in %s, in %s: the chord on la reads la do mi and do sits on the tonic',
    (mode, key) => {
      // Arrange
      const rooms = mountRing(mode)
      rooms.setKey(key)

      // Act
      rooms.setNames('solfege')

      // Assert: FACTS 8
      expect(words(chips()[5], 'notes')).toBe('la do mi')
      expect(words(chips()[0], 'notes')).toBe('do mi so')
      const tonic = key === 'C' ? 0 : 7
      expect(rooms.marks().syllables.find((s) => s.text === 'do')?.pc).toBe(
        tonic,
      )
    },
  )

  it('puts the letters back under Letters, and draws no syllable on the ring', () => {
    // Arrange
    const rooms = mountRing('slide')
    rooms.setNames('solfege')

    // Act
    rooms.setNames('letters')

    // Assert
    expect(words(chips()[5], 'notes')).toBe('A C E')
    expect(chips()[5].getAttribute('aria-label')).toBe(
      'Chord six, A minor: A, C, E',
    )
    expect(rooms.marks().syllables).toEqual([])
  })

  it('stops what sounds first, and changes nothing for the names already showing', async () => {
    // Arrange
    const rooms = mountRing('loop')
    void rooms.playLoop()
    notesAt(0)

    // Act
    rooms.setNames('letters')
    const same = runs[0].stopped
    rooms.setNames('solfege')
    await settle()

    // Assert
    expect(same).toBe(false)
    expect(runs[0].stopped).toBe(true)
    expect(rooms.lit).toBeNull()
  })

  it('puts the syllables on the chips alone in the compact layout, none on the ring', () => {
    // Arrange
    const rooms = mountRing('slide', COMPACT)

    // Act
    rooms.setNames('solfege')

    // Assert: WEB-SPEC, Toys 1, The compact layout
    expect(rooms.compact).toBe(true)
    expect(rooms.marks().syllables).toEqual([])
    expect(words(chips()[5], 'notes')).toBe('la do mi')
  })
})
