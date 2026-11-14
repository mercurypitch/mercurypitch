// ============================================================
// Take in time tests — Lesson 18's two bars in time, read note by note
// ============================================================
//
// On synthetic takes, a frame every 10 ms (Lesson 18 WEB-SPEC, Toys 5,
// states 6 and 7; FACTS 52 to 54, 82): the take opens on its own clock
// half a beat before bar 1, waits with no voice until an unmoved last
// window would close, and with voice listens until the last window closes,
// moved by the anchor; each note's line names the written note; a take
// that heard no voice in any window has no lines and no pitch line; one
// abandoned is left. The pitch line sits on the bars' time axis, moved by
// the anchor: each written note an amber band over its own beats, the
// voice folded into the written notes' octave, a gap where it stopped, and
// the octave named when it sat an octave away.

import { afterEach, describe, expect, it, vi } from 'vitest'
import './browser-doubles.test-fixtures'
import type { F0Frame } from '@/lib/mirror/metrics'
import type { Listener, TakeOptions } from './listen'
import type { ListenModule } from './mic-hold'
import type { InTimeOptions, WrittenNote } from './read-in-time'
import { readInTime } from './read-in-time'
import { heldSeconds } from './rhythm-model'
import { pitchLineOf, runTake } from './take-in-time'

const HOP = 0.01
/** Bar 1's first beat on the take's clock: half a beat after it opens, a beat 1 s at 60 BPM. */
const BAR1 = 0.5
const G3 = 55
const A3 = 57
const B3 = 59
const D4 = 62

/** Tune 1 in the bass: do re mi so, so mi do, the last a half note. */
const TUNE_1: readonly WrittenNote[] = [
  { midi: G3, beat: 0, beats: 1 },
  { midi: A3, beat: 1, beats: 1 },
  { midi: B3, beat: 2, beats: 1 },
  { midi: D4, beat: 3, beats: 1 },
  { midi: D4, beat: 4, beats: 1 },
  { midi: B3, beat: 5, beats: 1 },
  { midi: G3, beat: 6, beats: 2 },
]
const LABELS = ['Do', 'Re', 'Mi', 'So', 'So', 'Mi', 'Do']
const OPTIONS: InTimeOptions = { notes: TUNE_1, bpm: 60, bar1: BAR1, opened: 0 }

const hz = (midi: number, cents = 0): number =>
  440 * 2 ** ((midi - 69 + cents / 100) / 12)

/** Tune 1 sung, each note held its full length, `late` s after its written beat, `shift` semitones from it. */
function sung(late = 0, shift = 0): F0Frame[] {
  const out: F0Frame[] = []
  for (const n of TUNE_1)
    for (let i = 0; i * HOP < n.beats - 1e-9; i++)
      out.push({
        t: BAR1 + n.beat + late + i * HOP,
        f0: hz(n.midi + shift),
        conf: 0.95,
      })
  return out
}

/** Silence from the take's open to `until` s on its clock, a frame every 10 ms. */
const quiet = (until: number): F0Frame[] =>
  Array.from({ length: Math.round(until / HOP) }, (_, i) => ({
    t: i * HOP,
    f0: 0,
    conf: 0,
  }))

afterEach(() => {
  vi.restoreAllMocks()
})

describe('the pitch line', () => {
  it('sets each written note as a band over its own beats on the bars’ time axis, from half a beat before bar 1 to the last window’s close', () => {
    // Arrange
    const frames = sung()

    // Act
    const line = pitchLineOf(frames, OPTIONS, readInTime(frames, OPTIONS))

    // Assert (WEB-SPEC, Toys 5, state 7)
    expect(line?.seconds).toBeCloseTo(8.75, 9)
    expect(
      line?.rungs.map((r) => [r.c, r.from, Number(r.to?.toFixed(3))]),
    ).toEqual(
      TUNE_1.map((n) => [
        (n.midi - G3) * 100,
        0.5 + n.beat,
        Number((0.5 + n.beat + heldSeconds(n.beats, 60)).toFixed(3)),
      ]),
    )
    expect(line?.octaves).toBe(0)
  })

  it('draws the voice on its bands, in time, and breaks it where the voice stopped', () => {
    // Arrange: so held only half its beat, then silence until the next so
    const frames = sung().filter((f) => !(f.t >= BAR1 + 3.5 && f.t < BAR1 + 4))

    // Act
    const line = pitchLineOf(frames, OPTIONS, readInTime(frames, OPTIONS))

    // Assert
    const points = line?.line ?? []
    const at = (t: number) =>
      points.find((p) => p.c !== null && Math.abs(p.t - t) < HOP / 2)
    expect(at(0.5)?.c).toBeCloseTo(0, 6)
    expect(at(3.5)?.c).toBeCloseTo(700, 6)
    expect(points.filter((p) => p.c === null)).toHaveLength(1)
  })

  it('folds a voice an octave lower onto the written notes’ bands, naming the octave', () => {
    // Arrange
    const frames = sung(0, -12)

    // Act
    const line = pitchLineOf(frames, OPTIONS, readInTime(frames, OPTIONS))

    // Assert (FACTS 53)
    const cs = (line?.line ?? []).flatMap((p) => (p.c === null ? [] : [p.c]))
    expect(Math.min(...cs)).toBeCloseTo(0, 6)
    expect(Math.max(...cs)).toBeCloseTo(700, 6)
    expect(line?.octaves).toBe(-1)
  })

  it('moves the axis by the anchor, so a singer who came in late sits on the bands', () => {
    // Arrange: every note 1.5 s late
    const frames = sung(1.5)

    // Act
    const reading = readInTime(frames, OPTIONS)
    const line = pitchLineOf(frames, OPTIONS, reading)

    // Assert
    expect(reading.voice && reading.shift).toBeCloseTo(1.5, 1)
    expect(line?.line[0]?.t).toBeCloseTo(0.5, 1)
  })

  it('draws nothing for a take with no voice', () => {
    // Arrange
    const frames = quiet(9)

    // Act / Assert
    expect(pitchLineOf(frames, OPTIONS, readInTime(frames, OPTIONS))).toBeNull()
  })
})

describe('the take', () => {
  /** A listener module whose take resolves with `frames`, keeping the options it was given. */
  function module(frames: F0Frame[] | null): {
    mod: ListenModule
    asked: TakeOptions[]
  } {
    const asked: TakeOptions[] = []
    const mod = {
      takeFrames: (_l: Listener, o: TakeOptions) => {
        asked.push(o)
        return Promise.resolve(frames)
      },
    } as unknown as ListenModule
    return { mod, asked }
  }

  /** A take of tune 1 opened at page time 1000 ms, bar 1 at 1500 ms. */
  function run(mod: ListenModule) {
    vi.spyOn(performance, 'now').mockReturnValue(1000)
    return runTake({
      mod,
      listener: {} as Listener,
      notes: TUNE_1,
      labels: LABELS,
      bpm: 60,
      bar1: 1500,
      cancelled: () => false,
    })
  }

  it('reads tune 1 sung in time, a line a note naming the written note, with its pitch line', async () => {
    // Arrange
    const { mod } = module([...quiet(BAR1), ...sung()])

    // Act
    const end = await run(mod)

    // Assert (FACTS 54)
    expect(end.kind === 'read' && end.voiced).toBe(true)
    expect(end.kind === 'read' ? end.lines : []).toEqual(
      LABELS.map((l) => `${l} · Right in the middle: on the written note.`),
    )
    expect(end.kind === 'read' ? end.pitch?.rungs : []).toHaveLength(7)
  })

  it('waits with no voice until an unmoved last window would close, and with voice listens until the last window closes, moved by the anchor', async () => {
    // Arrange
    const { mod, asked } = module([])
    await run(mod)
    const o = asked[0]
    const at = (t: number): F0Frame => ({ t, f0: 0, conf: 0 })

    // Act: on time, the last window closes at 8.75 s; a beat late, at 9.75 s
    const onTime = [
      o.until?.([...sung(), at(8.74)]),
      o.until?.([...sung(), at(8.75)]),
    ]
    const late = [
      o.until?.([...sung(1), at(9.74)]),
      o.until?.([...sung(1), at(9.75)]),
    ]

    // Assert: 0.5 s to bar 1, then 8 beats and a quarter (FACTS 82)
    expect(o.wait).toBeCloseTo(8.75, 9)
    expect(onTime).toEqual([false, true])
    expect(late).toEqual([false, true])
  })

  it('has no lines and no pitch line when no window held a voice', async () => {
    // Arrange
    const { mod } = module(quiet(9))

    // Act
    const end = await run(mod)

    // Assert
    expect(end).toEqual({
      kind: 'read',
      voiced: false,
      lines: [],
      pitch: null,
      inBand: 0,
      onset: null,
    })
  })

  it('says when the singer’s first note started against bar 1, early or late, anchored or not (Lesson 28)', async () => {
    // Arrange: on time, a beat late, three beats late (past the anchor's
    // two), and do hummed from the take's open through bar 1
    const takes = [
      [...quiet(BAR1), ...sung()],
      [...quiet(BAR1 + 1), ...sung(1)],
      [...quiet(BAR1 + 3), ...sung(3)],
      [
        ...Array.from({ length: BAR1 / HOP }, (_, i) => ({
          t: i * HOP,
          f0: hz(G3),
          conf: 0.95,
        })),
        ...sung(),
      ],
    ]

    // Act
    const onsets: (number | null)[] = []
    for (const frames of takes) {
      const end = await run(module(frames).mod)
      onsets.push(end.kind === 'read' ? end.onset : null)
    }

    // Assert: seconds from bar 1's first beat, the hummed do from the open
    expect(onsets.map((t) => Number(t?.toFixed(2)))).toEqual([0, 1, 3, -0.5])
  })

  it('has no onset for a take with voice but no run of it 0.15 s long', async () => {
    // Arrange: a tenth of a second at the start of each note, and silence between
    const blips = sung().filter((f) => {
      const n = TUNE_1.find(
        (m) => f.t >= BAR1 + m.beat - 1e-9 && f.t < BAR1 + m.beat + m.beats,
      )
      return n !== undefined && f.t < BAR1 + n.beat + 0.1 - 1e-9
    })
    const frames = [...quiet(BAR1), ...blips].sort((a, b) => a.t - b.t)

    // Act
    const end = await run(module(frames).mod)

    // Assert: heard, so read, but nothing to line a playback up on
    expect(end.kind === 'read' && end.voiced).toBe(true)
    expect(end.kind === 'read' ? end.onset : 0).toBeNull()
  })

  it('counts the notes read in the band', async () => {
    // Arrange: tune 1 sung 40 cents sharp, but for its first note
    const sharp = sung().map((f) =>
      f.t < BAR1 + 1 ? f : { ...f, f0: f.f0 * 2 ** (40 / 1200) },
    )
    const { mod } = module([...quiet(BAR1), ...sharp])

    // Act
    const end = await run(mod)

    // Assert: the first in the band; the others close, outside it
    expect(end.kind === 'read' ? end.inBand : -1).toBe(1)
  })

  it('reads a note sung on the other part’s note as theirs, measures gaps from the note it is given, and asks after every frame (Lesson 26)', async () => {
    // Arrange: tune 1 sung as written, under a part a third above, its first note sung on the part's
    vi.spyOn(performance, 'now').mockReturnValue(1000)
    const above = TUNE_1.map((n) => ({ ...n, midi: n.midi + 4 }))
    const frames = [
      ...quiet(BAR1),
      ...sung().map((f) =>
        f.t < BAR1 + 1 ? { ...f, f0: f.f0 * 2 ** (4 / 12) } : f,
      ),
    ]
    const { mod, asked } = module(frames)
    let ticks = 0

    // Act
    const end = await runTake({
      mod,
      listener: {} as Listener,
      notes: TUNE_1,
      labels: LABELS,
      bpm: 60,
      bar1: 1500,
      cancelled: () => false,
      whose: "your part's note",
      other: {
        notes: above,
        whose: "Tavi's",
        labels: ['mi', 'fa', 'so', 'ti', 'ti', 'so', 'mi'],
      },
      onFrame: () => {
        ticks += 1
      },
    })
    asked[0].onFrame?.(null, null)

    // Assert
    const lines = end.kind === 'read' ? end.lines : []
    expect(lines[0]).toBe("Do · That was Tavi's note: mi.")
    expect(lines[1]).toBe("Re · Right in the middle: on your part's note.")
    expect(ticks).toBe(1)
  })

  it('is left when the take was abandoned', async () => {
    // Arrange
    const { mod } = module(null)

    // Act / Assert
    expect(await run(mod)).toEqual({ kind: 'left' })
  })
})
