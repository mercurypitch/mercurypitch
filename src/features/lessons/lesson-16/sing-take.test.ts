// ============================================================
// Lesson 16 Sing it's take tests — the reader along a phrase, and its line
// ============================================================
//
// The take on synthetic frames, as the listener hands them over: the
// reader lights each next note as the voice passes the one lit, each note
// gets its line, and the take's pitch line comes with them, each written
// note a band over the stretch it was lit, the voice folded into the
// octave of the written note nearest it, broken where no voice came
// (WEB-SPEC, Toys 6, states 6 and 7; FACTS 45 to 47). Then the chart that
// draws it after the take.

import { afterEach, describe, expect, it, vi } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import type { Listener } from '@/features/lessons/kit/listen'
import type { ListenModule } from '@/features/lessons/kit/mic-hold'
import type { NoteRun } from '@/features/lessons/kit/read-along'
import type { F0Frame, VoicedFrame } from '@/lib/mirror/metrics'
import { rowsOf, summaryOf } from './sing-chart'
import type { PitchLine, TakeContext } from './sing-take'
import { drawPitchLine, pitchLineOf, runTake } from './sing-take'

afterEach(() => {
  vi.restoreAllMocks()
  document.body.textContent = ''
})

/** Do, re, mi, re, do in G for the lower voice: G3 A3 B3 A3 G3. */
const PHRASE = [55, 57, 59, 57, 55] as const
const LABELS = ['Do', 'Re', 'Mi', 'Re', 'Do'] as const

/** The listener's hop, s. */
const HOP = 0.016

/** A note `cents` from `midi`, as Hz. */
const hz = (midi: number, cents = 0): number =>
  440 * 2 ** ((midi - 69) / 12 + cents / 1200)

/** Frames a hop apart from `t0` for `sec` seconds: `midi` sung `cents` off, or no voice for null. */
function sung(
  t0: number,
  sec: number,
  midi: number | null,
  cents = 0,
): F0Frame[] {
  const n = Math.round(sec / HOP)
  return Array.from({ length: n }, (_, i) => ({
    t: Math.round((t0 + i * HOP) * 1000) / 1000,
    f0: midi === null ? 0 : hz(midi, cents),
    conf: midi === null ? 0 : 0.9,
  }))
}

/** A take whose listener hands `frames` over a hop at a time, as `takeFrames` does; null for one abandoned. */
function context(frames: F0Frame[] | null, lit: number[] = []): TakeContext {
  const mod = {
    takeFrames: (_l: Listener, o: { until?: (fs: F0Frame[]) => boolean }) => {
      if (frames === null) return Promise.resolve(null)
      for (let n = 1; n <= frames.length; n++)
        if (o.until?.(frames.slice(0, n)) === true)
          return Promise.resolve(frames.slice(0, n))
      return Promise.resolve(frames)
    },
  } as unknown as ListenModule
  return {
    mod,
    listener: {} as Listener,
    notes: PHRASE,
    labels: LABELS,
    light: (i) => lit.push(i),
    cancelled: () => false,
  }
}

/** A note's run on the reader's clock. */
const run = (start: number, end: number | null): NoteRun => ({
  start,
  end,
  how: end === null ? null : 'hold',
  held: [],
})

/** Voiced frames a hop apart from `t0` for `sec` seconds, at `cents` (MIDI × 100). */
const voiced = (t0: number, sec: number, cents: number): VoicedFrame[] =>
  Array.from({ length: Math.round(sec / HOP) }, (_, i) => ({
    t: Math.round((t0 + i * HOP) * 1000) / 1000,
    cents,
  }))

describe('the take', () => {
  it('lights each next note as the voice passes the one lit, then reads every note and draws its line', async () => {
    // Arrange: 0.3 s of quiet, then each note held 0.7 s, in tune
    const frames = [
      ...sung(0, 0.3, null),
      ...PHRASE.flatMap((midi, i) => sung(0.3 + i * 0.7, 0.7, midi)),
      ...sung(3.8, 0.5, null),
    ]
    const lit: number[] = []

    // Act
    const end = await runTake(context(frames, lit))

    // Assert: FACTS 45 to 47
    expect(lit).toEqual([1, 2, 3, 4])
    if (end.kind !== 'read') throw new Error('the take was read')
    expect(end.voiced).toBe(true)
    expect(end.lines).toHaveLength(5)
    expect(end.lines[1]).toMatch(/^Re · /)
    expect(end.pitch?.rungs.map((r) => r.c)).toEqual([0, 200, 400, 200, 0])
    expect(end.pitch?.octaves).toBe(0)
  })

  it('reads no line and draws no pitch line when no voice came', async () => {
    // Act
    const end = await runTake(context(sung(0, 1, null)))

    // Assert: FACTS 50
    expect(end).toEqual({ kind: 'read', voiced: false, lines: [], pitch: null })
  })

  it('ends as left when the take was abandoned', async () => {
    // Act
    const end = await runTake(context(null))

    // Assert
    expect(end).toEqual({ kind: 'left' })
  })
})

describe('the pitch line', () => {
  it('lays each written note the take reached as a band over the stretch it was lit, in cents from do', () => {
    // Arrange: do lit at 1.0 s, re at 1.5 s, mi at 2.5 s, still lit when the take ended at 4.0 s
    const runs = [run(1, 1.5), run(1.5, 2.5), run(2.5, null)]

    // Act
    const p = pitchLineOf(PHRASE, runs, voiced(1, 0.5, 5500), 4)

    // Assert
    expect(p?.seconds).toBe(3)
    expect(p?.rungs).toEqual([
      { c: 0, from: 0, to: 0.5 },
      { c: 200, from: 0.5, to: 1.5 },
      { c: 400, from: 1.5, to: 3 },
    ])
  })

  it('ends as the last note passes, though the voice carried on', () => {
    // Arrange: do lit at 0 s and passed at 1.0 s; the voice held it to 1.5 s
    const runs = [run(0, 1)]

    // Act
    const p = pitchLineOf(PHRASE, runs, voiced(0, 1.5, 5500), 1.5)

    // Assert
    expect(p?.seconds).toBe(1)
    expect(Math.max(...(p?.line ?? []).map((pt) => pt.t))).toBeLessThanOrEqual(
      1,
    )
  })

  it('folds a voice an octave lower onto the bands, and says which octave it sat in', () => {
    // Arrange: do sung 10 cents sharp, an octave below the written G3
    const runs = [run(0, 1)]

    // Act
    const p = pitchLineOf(PHRASE, runs, voiced(0, 0.5, 4310), 1)

    // Assert: FACTS 46
    expect(new Set(p?.line.map((pt) => pt.c))).toEqual(new Set([10]))
    expect(p?.octaves).toBe(-1)
  })

  it('folds each frame to the written note nearest it, so a note sung before its turn still draws at its own height', () => {
    // Arrange: phrase 2, do, so, mi, re, do; so sung while do is still lit, then while so is
    const runs = [run(0, 1), run(1, 2)]
    const frames = [...voiced(0.5, 0.2, 6200), ...voiced(1.2, 0.2, 6200)]

    // Act
    const p = pitchLineOf([55, 62, 59, 57, 55], runs, frames, 2)

    // Assert: so's height both times, a fifth above do, with the gap between
    expect(new Set(p?.line.map((pt) => pt.c))).toEqual(new Set([700, null]))
  })

  it('breaks the line where no voice came, and keeps none of it outside the take', () => {
    // Arrange: 0.2 s of do, 0.4 s with no voice, 0.2 s more; a frame before and after
    const runs = [run(1, 2)]
    const frames = [
      { t: 0.5, cents: 5500 },
      ...voiced(1, 0.2, 5500),
      ...voiced(1.6, 0.2, 5500),
      { t: 2.5, cents: 5500 },
    ]

    // Act
    const p = pitchLineOf(PHRASE, runs, frames, 2)

    // Assert
    const gaps = p?.line.filter((pt) => pt.c === null) ?? []
    expect(gaps).toHaveLength(1)
    expect(gaps[0].t).toBeGreaterThan(0.2)
    expect(gaps[0].t).toBeLessThan(0.6)
    expect(p?.line.every((pt) => pt.t >= 0 && pt.t <= 1)).toBe(true)
  })

  it('names no octave from frames too far from the note to tell', () => {
    // Arrange: 80 cents above the G two octaves down
    const runs = [run(0, 1)]

    // Act
    const p = pitchLineOf(PHRASE, runs, voiced(0, 0.5, 3180), 1)

    // Assert: octaveTag's 50 cents
    expect(p?.octaves).toBe(0)
  })

  it('draws nothing before the voice', () => {
    // Act
    const p = pitchLineOf(PHRASE, [], [], 8)

    // Assert
    expect(p).toBeNull()
  })
})

describe('the chart after the take', () => {
  const PITCH: PitchLine = {
    seconds: 3,
    rungs: [
      { c: 0, from: 0, to: 0.6 },
      { c: 200, from: 0.6, to: 1.5 },
      { c: 400, from: 1.5, to: 3 },
    ],
    line: [
      { t: 0, c: 4 },
      { t: 1, c: 210 },
    ],
    octaves: -1,
  }

  /** Sing it's chart frame, as the page has it. */
  function frame(): HTMLElement {
    document.body.innerHTML = `
      <div class="sing-chart band-chart" id="singChart">
        <canvas role="img" aria-label="Your pitch line"></canvas>
        <span class="octave-tag" data-octave-tag hidden></span>
      </div>`
    return document.getElementById('singChart') as HTMLElement
  }

  it('draws the take over the phrase’s bands, a lane a semitone, with the octave tag', () => {
    // Arrange
    const root = frame()

    // Act
    const chart = drawPitchLine(root, PITCH, PHRASE, LABELS)

    // Assert: FACTS 46
    expect(chart.scene.rungs).toEqual(PITCH.rungs)
    expect(chart.scene.line).toEqual(PITCH.line)
    expect([chart.target, chart.lo, chart.hi, chart.window]).toEqual([
      55, -100, 500, 3,
    ])
    const tag = root.querySelector<HTMLElement>('[data-octave-tag]')
    expect([tag?.hidden, tag?.textContent]).toEqual([false, 'octave lower'])
    expect(root.querySelector('canvas')?.getAttribute('aria-label')).toBe(
      "Your pitch line over the written notes' bands: do, re, mi, re, do. You sang it an octave lower: same notes. It is drawn in their octave.",
    )
  })

  it('draws the next take on the same chart, its axis the new phrase’s, with no tag in the written octave', () => {
    // Arrange
    const root = frame()
    const first = drawPitchLine(root, PITCH, PHRASE, LABELS)

    // Act: phrase 2 in the treble, do, so, mi, re, do
    const next = drawPitchLine(
      root,
      { ...PITCH, seconds: 5, octaves: 0 },
      [67, 74, 71, 69, 67],
      ['Do', 'So', 'Mi', 'Re', 'Do'],
    )

    // Assert
    expect(next).toBe(first)
    expect([next.target, next.lo, next.hi, next.window]).toEqual([
      67, -100, 800, 5,
    ])
    expect(root.querySelector<HTMLElement>('[data-octave-tag]')?.hidden).toBe(
      true,
    )
  })

  it('names each row of the phrase once, low to high, by its syllable and note', () => {
    // Act
    const rows = rowsOf([67, 74, 71, 69, 67], ['Do', 'So', 'Mi', 'Re', 'Do'])

    // Assert
    expect(rows).toEqual([
      [67, 'do · G4'],
      [69, 're · A4'],
      [71, 'mi · B4'],
      [74, 'so · D5'],
    ])
  })

  it('says the notes in order, and nothing of an octave in their own', () => {
    // Act
    const said = summaryOf(LABELS, 0)

    // Assert
    expect(said).toBe(
      "Your pitch line over the written notes' bands: do, re, mi, re, do.",
    )
  })
})
