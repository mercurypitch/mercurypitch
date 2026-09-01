// Percussion-window tests keep compact drum references bounded on dense songs.

import { describe, expect, it } from 'vitest'
import type { MidiSongPercussionHit } from '@/lib/midi-song'
import { buildPercussionWindowIndex, queryPercussionWindow, } from './percussion-window'

function hit(startBeat: number, gmKey = 38): MidiSongPercussionHit {
  return { gmKey, startBeat, velocity: 96 }
}

describe('queryPercussionWindow', () => {
  it('returns stable source hits inside the moving window without reordering input', () => {
    const late = hit(40, 49)
    const nearby = hit(2, 42)
    const now = hit(0, 36)
    const source = [late, nearby, now]

    const result = queryPercussionWindow(
      buildPercussionWindowIndex(source),
      0,
      6,
    )

    expect(result.hits).toEqual([now, nearby])
    expect(result.hits[0]).toBe(now)
    expect(source).toEqual([late, nearby, now])
    expect(result.omittedHitCount).toBe(0)
  })

  it('keeps a dense imported track behind a hard preview ceiling', () => {
    const source = Array.from({ length: 10_000 }, (_, index) =>
      hit(index / 1_000, 35 + (index % 47)),
    )
    const compiled = buildPercussionWindowIndex(source)
    let indexedReads = 0
    const startBeats = new Proxy(compiled.startBeats, {
      get(target, property, receiver) {
        if (typeof property === 'string' && /^\d+$/.test(property)) {
          indexedReads += 1
        }
        return Reflect.get(target, property, receiver)
      },
    })

    const result = queryPercussionWindow({ ...compiled, startBeats }, 5, 6, 64)

    expect(result.hits).toHaveLength(64)
    expect(result.sourceHitCount).toBeGreaterThan(1_000)
    expect(result.omittedHitCount).toBe(result.sourceHitCount - 64)
    expect(indexedReads).toBeLessThan(40)
  })

  it('drops a corrupt non-finite attack instead of poisoning binary search', () => {
    const result = queryPercussionWindow(
      buildPercussionWindowIndex([hit(Number.NaN), hit(1)]),
      0,
      6,
    )

    expect(result.hits).toEqual([hit(1)])
    expect(result.sourceHitCount).toBe(1)
  })
})
