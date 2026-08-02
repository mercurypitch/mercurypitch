import { describe, expect, it } from 'vitest'
import { layoutVoiceWaveBars } from '@/components/VoiceTakeWaveform'

describe('voice take waveform layout', () => {
  it('spreads cached peak buckets across the full available width', () => {
    const bars = layoutVoiceWaveBars(
      new Float32Array(72).fill(0.5),
      1000,
      66,
      0,
    )

    expect(bars).toHaveLength(72)
    expect(bars[0]!.x).toBeLessThan(10)
    expect(bars.at(-1)!.x + bars.at(-1)!.width).toBeGreaterThan(990)
  })

  it('renders an honest full-width baseline when decoding has no peaks', () => {
    const bars = layoutVoiceWaveBars(new Float32Array(), 360, 66, 0)

    expect(bars).toHaveLength(72)
    expect(bars.at(-1)!.x + bars.at(-1)!.width).toBeGreaterThan(355)
    expect(new Set(bars.map((bar) => Math.round(bar.height))).size).toBe(1)
    expect(Math.max(...bars.map((bar) => bar.height))).toBeLessThan(4)
  })
})
