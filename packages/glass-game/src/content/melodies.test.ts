// Glass melody catalogue — preserve the original 3, 5, 7 and 10-note sketches.

import { describe, expect, it } from 'vitest'
import type { MelodyDefinition } from '../core/melody-contour'
import { compileMelody } from '../core/melody-contour'
import { GLASS_MELODIES, glassMelody } from './melodies'

describe('glass melody catalogue', () => {
  it('keeps the listening-study pitch shapes as authored data', () => {
    const melodies: readonly MelodyDefinition[] = GLASS_MELODIES
    expect(
      melodies.map(
        (melody) => melody.phrases.flatMap((phrase) => phrase.anchors).length,
      ),
    ).toEqual([3, 5, 7, 10])
    expect(
      melodies.map((melody) =>
        melody.phrases.map((phrase) =>
          phrase.anchors.map((anchor) => anchor.offsetSemitones),
        ),
      ),
    ).toEqual([
      [[0, 2, 0]],
      [[0, 2, 4, 2, 0]],
      [[0, 2, 4, 7, 4, 2, 0]],
      [
        [0, 2, 4, 2, 0],
        [0, 2, 5, 2, 0],
      ],
    ])
  })

  it('makes only the ten-note sketch a two-phrase breath exercise', () => {
    for (const melody of GLASS_MELODIES.slice(0, 3)) {
      expect(melody.phrases).toHaveLength(1)
      expect(melody.phrases[0].allowBreathAfter).toBe(false)
    }
    const twoWindows = glassMelody('two-windows')
    expect(twoWindows.phrases.map((phrase) => phrase.allowBreathAfter)).toEqual(
      [true, false],
    )
    expect(
      compileMelody(twoWindows, { rootMidi: 57 }).segments.filter(
        (segment) => segment.kind === 'breath',
      ),
    ).toHaveLength(1)
  })
})
