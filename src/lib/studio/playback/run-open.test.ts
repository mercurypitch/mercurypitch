import { describe, expect, it } from 'vitest'
import type { PlaybackParam } from './playback.test-fixtures'
import { PlaybackContext } from './playback.test-fixtures'
import { openRunEnvelope, RUN_OPEN_SECONDS } from './run'

function openAt(time: number) {
  const ctx = new PlaybackContext()
  const envelope = ctx.createGain()
  const end = openRunEnvelope(envelope as unknown as GainNode, time)
  return { end, gain: envelope.gain as PlaybackParam }
}

describe('a run opening from silence', () => {
  it('reaches full level 10 ms after it starts', () => {
    const { end, gain } = openAt(2)
    expect(RUN_OPEN_SECONDS).toBe(0.01)
    expect(end).toBeCloseTo(2.01, 12)
    expect(gain.linearRamps.at(-1)).toEqual({ value: 1, time: end })
  })

  it('starts at zero and follows a raised cosine, with no exponential tail', () => {
    const { gain } = openAt(2)
    expect(gain.events.filter((e) => e.kind === 'set').at(-1)).toEqual({
      kind: 'set',
      time: 2,
      value: 0,
    })
    expect(gain.ramps).toEqual([])
    expect(gain.linearRamps.length).toBeGreaterThanOrEqual(64)
    for (const { value, time } of gain.linearRamps) {
      const x = (time - 2) / RUN_OPEN_SECONDS
      expect(value).toBeCloseTo(Math.sin((Math.PI / 2) * x) ** 2, 9)
    }
  })
})
