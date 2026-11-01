// ============================================================
// Phrase fit — the first root, the window, and runs that stay in it
// ============================================================

import { describe, expect, it } from 'vitest'
import type { VoiceprintRecord } from '@/db/services/voiceprint-service'
import { pickHoldTarget } from '@/lib/hold/hold-target'
import type { EchoWindow } from './phrase-fit'
import { echoWindow, nextRootChoices, overshoot, planEchoRun, } from './phrase-fit'
import type { EchoLevelId } from './sequence-engine'

function voiceprint(
  takenAt: string,
  lowMidi: number | null,
  highMidi: number | null,
): VoiceprintRecord {
  return {
    id: `vp-${takenAt}`,
    summary: {
      lowMidi,
      highMidi,
      semitones:
        lowMidi === null || highMidi === null ? null : highMidi - lowMidi,
      accuracy: 61,
      steadiness: 73,
    },
    twin: null,
    source: 'mirror',
    takenAt,
  }
}

/** C3 to C5: two octaves. */
const TWO_OCTAVES = [voiceprint('2026-10-01T10:00:00Z', 48, 72)]

const LEVELS: readonly EchoLevelId[] = ['learning', 'singer', 'professional']
const SEEDS = Array.from({ length: 200 }, (_, i) => i + 1)

/** Rounded to 1e-9, so window edges compare exactly. */
const exact = (window: EchoWindow) => ({
  ...window,
  low: Math.round(window.low * 1e9) / 1e9,
  high: Math.round(window.high * 1e9) / 1e9,
})

describe('echoWindow', () => {
  it('starts on the hold target and spans 20 to 80 % of the voiceprint', () => {
    // Act
    const window = echoWindow({ voiceprints: TWO_OCTAVES })

    // Assert: 48 + 0.35 * 24 = 56.4 -> A3; 48 + 4.8 and 48 + 19.2.
    expect(exact(window)).toEqual({
      low: 52.8,
      high: 67.2,
      firstRoot: 57,
      source: 'voiceprint',
    })
    expect(window.firstRoot).toBe(pickHoldTarget(TWO_OCTAVES, 'tenor').midi)
  })

  it('places a range wider than two octaves in its practice range, root and window alike', () => {
    // Arrange: F2 to D5, read as B2 (47) to B4 (71) (practiceRange).
    const prints = [voiceprint('2026-10-01T10:00:00Z', 41, 74)]

    // Act
    const window = echoWindow({ voiceprints: prints })

    // Assert: 47 + 4.8 and 47 + 19.2; the first root is Long note's G3.
    expect(exact(window)).toEqual({
      low: 51.8,
      high: 66.2,
      firstRoot: 55,
      source: 'voiceprint',
    })
    expect(window.firstRoot).toBe(pickHoldTarget(prints, 'tenor').midi)
  })

  it('reads the newest voiceprint, as the hold target does', () => {
    // Arrange: newest A2..A4.
    const prints = [
      voiceprint('2026-09-01T10:00:00Z', 48, 72),
      voiceprint('2026-10-05T10:00:00Z', 45, 69),
      voiceprint('2026-10-07T10:00:00Z', null, null),
    ]

    // Act
    const window = echoWindow({ voiceprints: prints })

    // Assert: 45 + 8.4 = 53.4 -> F3.
    expect(exact(window)).toEqual({
      low: 49.8,
      high: 64.2,
      firstRoot: 53,
      source: 'voiceprint',
    })
  })

  it('starts on the settled note without a voiceprint, 35 % up a voice-type span', () => {
    // Act: a bass's easy note, as the pre-roll hears it.
    const window = echoWindow({ voiceprints: [], settledMidi: 45.3 })

    // Assert: the tenor span (24) around A2: 45 - 8.4 + 4.8, + 19.2.
    expect(exact(window)).toEqual({
      low: 41.4,
      high: 55.8,
      firstRoot: 45,
      source: 'settled',
    })
  })

  it.each([
    ['tenor', 52, 48.4, 62.8],
    ['bass', 45, 41.4, 55.8],
  ] as const)(
    'falls back to the %s note with nothing heard',
    (voicePreset, firstRoot, low, high) => {
      // Act
      const window = echoWindow({
        voiceprints: [],
        settledMidi: null,
        voicePreset,
      })

      // Assert
      expect(exact(window)).toEqual({ low, high, firstRoot, source: 'preset' })
    },
  )
})

describe('nextRootChoices', () => {
  const window = echoWindow({ voiceprints: TWO_OCTAVES })

  it.each([
    [60, [58, 62]],
    [54, [56]],
    [53, [55]],
    [66, [64]],
    [67, [65]],
  ])(
    'moves %i a step either way, never out of 52.8-67.2: %j',
    (previous, roots) => {
      // Act
      const choices = nextRootChoices(previous, window)

      // Assert
      expect(choices).toEqual(roots)
    },
  )

  it('steps toward the middle of a window too narrow for either step', () => {
    // Arrange
    const narrow: EchoWindow = {
      low: 60,
      high: 61,
      firstRoot: 60,
      source: 'preset',
    }

    // Act
    const choices = [nextRootChoices(60, narrow), nextRootChoices(61, narrow)]

    // Assert
    expect(choices).toEqual([[62], [59]])
  })
})

describe('planEchoRun', () => {
  const WINDOWS: Array<[string, EchoWindow]> = [
    ['two octaves', echoWindow({ voiceprints: TWO_OCTAVES })],
    [
      'an octave',
      echoWindow({ voiceprints: [voiceprint('2026-10-01T10:00:00Z', 60, 72)] }),
    ],
    ['a tenor with no voiceprint', echoWindow({ voiceprints: [] })],
  ]

  it.each(WINDOWS)(
    'steps every root by two from the first, inside the window (%s)',
    (_name, window) => {
      // Act
      const runs = LEVELS.flatMap((level) =>
        SEEDS.map((seed) => planEchoRun({ level, window, seed })),
      )

      // Assert
      const roots = runs.map((run) => run.map((phrase) => phrase.root))
      expect(new Set(roots.map((r) => r[0]))).toEqual(
        new Set([window.firstRoot]),
      )
      expect(
        roots.filter((r) =>
          r.slice(1).some((root, i) => Math.abs(root - r[i]) !== 2),
        ),
      ).toEqual([])
      expect(
        roots.flat().filter((root) => root < window.low || root > window.high),
      ).toEqual([])
      expect(runs.map((run) => run.length)).toEqual(runs.map(() => 5))
    },
  )

  it.each(LEVELS)(
    'keeps every note of every phrase inside a two-octave window at %s',
    (level) => {
      // Arrange
      const window = echoWindow({ voiceprints: TWO_OCTAVES })

      // Act
      const runs = SEEDS.map((seed) => planEchoRun({ level, window, seed }))

      // Assert
      const outside = runs
        .flat()
        .filter((phrase) => overshoot(phrase, window) > 0)
      expect(outside).toEqual([])
    },
  )

  it('never sings an octave leap in a voice too narrow for one', () => {
    // Arrange: G3 to A4, 14 semitones: the window is 8.4 wide.
    const window = echoWindow({
      voiceprints: [voiceprint('2026-10-01T10:00:00Z', 55, 69)],
    })

    // Act
    const runs = SEEDS.map((seed) =>
      planEchoRun({ level: 'professional', window, seed }),
    )

    // Assert
    const spans = runs.flat().map((phrase) => {
      const midis = phrase.notes.map((note) => note.midi)
      return Math.max(...midis) - Math.min(...midis)
    })
    expect(Math.max(...spans)).toBeLessThan(12)
  })

  it('never sings the same motif twice in a row, and mixes minor in', () => {
    // Arrange
    const window = echoWindow({ voiceprints: TWO_OCTAVES })

    // Act
    const runs = LEVELS.flatMap((level) =>
      SEEDS.map((seed) => planEchoRun({ level, window, seed })),
    )

    // Assert
    expect(
      runs.filter((run) =>
        run.slice(1).some((phrase, i) => phrase.motif === run[i].motif),
      ),
    ).toEqual([])
    expect(
      runs.filter((run) => run[0].mode !== 'major' || run[1].mode !== 'major'),
    ).toEqual([])
    expect(
      runs.filter((run) => !run.some((phrase) => phrase.mode === 'minor')),
    ).toEqual([])
  })

  it('plans the same run for the same seed, and another for another seed', () => {
    // Arrange
    const window = echoWindow({ voiceprints: TWO_OCTAVES })
    const plan = (seed: number) =>
      planEchoRun({ level: 'singer', window, seed })

    // Act
    const runs = [plan(3), plan(3), plan(4)]

    // Assert
    expect(runs[0]).toEqual(runs[1])
    expect(runs[0]).not.toEqual(runs[2])
  })
})
