import { describe, expect, it } from 'vitest'
import { compressorAutoMakeupGain, compressorStaticOutputDb, } from './compressor-curve'
import { createHardClampCurve, createIdentityCurve, createLeadCurve, createLogEnvelopeCurve, createSaturationCurve, createSoftClipCurve, dbToGain, delayTailSeconds, ENVELOPE_DOMAIN, equalPowerMix, gainToDb, HARD_CLAMP_DOMAIN, linearMix, LOG_FLOOR_DB, LOG_SPAN_DB, QUADRATURE_ALLPASS, SATURATION_DOMAIN, SOFT_CLIP_DOMAIN, } from './dsp'
import { generateReverbImpulse, reverbImpulseLength } from './reverb-impulse'

/** Evaluate a shaper curve the way WaveShaperNode does: linear interpolation. */
function shape(curve: Float32Array, x: number): number {
  const position = ((Math.max(-1, Math.min(1, x)) + 1) / 2) * (curve.length - 1)
  const index = Math.floor(position)
  const next = Math.min(curve.length - 1, index + 1)
  const fraction = position - index
  return curve[index] * (1 - fraction) + curve[next] * fraction
}

describe('mix laws', () => {
  it('keeps correlated paths at constant amplitude across the linear mix', () => {
    for (const amount of [0, 0.1, 0.5, 0.73, 1]) {
      const { dry, wet } = linearMix(amount)
      expect(dry + wet).toBeCloseTo(1, 12)
    }
  })

  it('keeps decorrelated paths at constant power across the equal-power mix', () => {
    for (const amount of [0, 0.2, 0.5, 0.9, 1]) {
      const { dry, wet } = equalPowerMix(amount)
      expect(dry * dry + wet * wet).toBeCloseTo(1, 12)
    }
    expect(equalPowerMix(0.5).dry).toBeCloseTo(Math.SQRT1_2, 12)
  })

  it('clamps an out-of-range mix amount', () => {
    expect(linearMix(3)).toEqual({ dry: 0, wet: 1 })
    expect(linearMix(-1)).toEqual({ dry: 1, wet: 0 })
  })
})

describe('shaper curves', () => {
  it('maps silence to exact silence (no DC from the curve centre)', () => {
    for (const curve of [
      createSaturationCurve(),
      createSoftClipCurve(),
      createHardClampCurve(),
    ]) {
      expect(curve[(curve.length - 1) / 2]).toBe(0)
    }
  })

  it('passes quiet material through the saturation at unity', () => {
    const curve = createSaturationCurve()
    const x = 0.001
    expect(shape(curve, x) / x).toBeCloseTo(1, 4)
  })

  it('saturates to tanh(g x) / g once the drive gains are applied', () => {
    const curve = createSaturationCurve()
    const drive = dbToGain(12)
    for (const x of [0.05, 0.3, 0.9]) {
      const y =
        shape(curve, (x * drive) / SATURATION_DOMAIN) *
        (SATURATION_DOMAIN / drive)
      expect(y).toBeCloseTo(Math.tanh(drive * x) / drive, 4)
    }
  })

  it('soft-clips: linear below the knee, never past the ceiling, monotonic', () => {
    const curve = createSoftClipCurve(0.9)
    const ceiling = 1 / SOFT_CLIP_DOMAIN
    expect(shape(curve, 0.8 * ceiling)).toBeCloseTo(0.8 * ceiling, 6)
    expect(shape(curve, 0.95 * ceiling)).toBeLessThan(0.95 * ceiling)
    for (let i = 1; i < curve.length; i++) {
      expect(curve[i]).toBeGreaterThanOrEqual(curve[i - 1])
      expect(Math.abs(curve[i])).toBeLessThanOrEqual(ceiling)
    }
  })

  it('hard-clamps exactly at the ceiling and is an identity below it', () => {
    const curve = createHardClampCurve()
    const ceiling = 1 / HARD_CLAMP_DOMAIN
    expect(shape(curve, 0.3)).toBeCloseTo(0.3, 6)
    expect(shape(curve, ceiling)).toBeCloseTo(ceiling, 6)
    expect(shape(curve, 0.9)).toBe(ceiling)
    expect(shape(curve, -1)).toBe(-ceiling)
  })

  it('makes the identity curve a straight line', () => {
    const curve = createIdentityCurve()
    for (const x of [-1, -0.25, 0, 0.6, 1])
      expect(shape(curve, x)).toBeCloseTo(x, 6)
  })
})

describe('transient detector curves', () => {
  const logCurve = createLogEnvelopeCurve()
  const decibels = (level: number) =>
    shape(logCurve, level / ENVELOPE_DOMAIN) * LOG_SPAN_DB

  it('reads levels in decibels, accurately down to -60 dBFS', () => {
    for (const db of [-60, -40, -18, -6, 0, 6]) {
      expect(decibels(dbToGain(db))).toBeCloseTo(db, 1)
    }
  })

  it('floors silence and a follower’s undershoot at -70 dB', () => {
    expect(decibels(0)).toBeCloseTo(LOG_FLOOR_DB, 4)
    expect(decibels(-0.01)).toBeCloseTo(LOG_FLOOR_DB, 4)
    expect(decibels(dbToGain(-90))).toBeCloseTo(LOG_FLOOR_DB, 4)
  })

  it('maps a lead in decibels to 0..1 with a smoothstep', () => {
    const curve = createLeadCurve(9)
    const at = (db: number) => shape(curve, db / LOG_SPAN_DB)
    expect(at(-5)).toBe(0)
    expect(at(0)).toBe(0)
    expect(at(4.5)).toBeCloseTo(0.5, 3)
    expect(at(9)).toBeCloseTo(1, 4)
    expect(at(20)).toBe(1)
  })

  it('keeps the allpass pair 90 degrees apart from 30 Hz to 20 kHz', () => {
    const sampleRate = 48000
    const phase = (
      coefficients: readonly number[],
      later: boolean,
      f: number,
    ) => {
      const w = (2 * Math.PI * f) / sampleRate
      let total = later ? -w : 0
      for (const a of coefficients) {
        const a2 = a * a
        // arg((a^2 - e^-2jw) / (1 - a^2 e^-2jw))
        const num = Math.atan2(Math.sin(2 * w), a2 - Math.cos(2 * w))
        const den = Math.atan2(a2 * Math.sin(2 * w), 1 - a2 * Math.cos(2 * w))
        total += num - den
      }
      return total
    }
    for (const f of [30, 41, 100, 1000, 8000, 16000, 20000]) {
      const difference =
        phase(QUADRATURE_ALLPASS[0], true, f) -
        phase(QUADRATURE_ALLPASS[1], false, f)
      const wrapped =
        (((((difference * 180) / Math.PI) % 360) + 540) % 360) - 180
      expect(Math.abs(Math.abs(wrapped) - 90)).toBeLessThan(1)
    }
  })
})

describe('compressor makeup', () => {
  // Measured in Chrome 153: a raw DynamicsCompressorNode fed a steady -70 dBFS
  // sine, output level over input level once settled.
  const MEASURED_IN_CHROME: [
    threshold: number,
    knee: number,
    ratio: number,
    makeupDb: number,
  ][] = [
    [-10, 0, 2, 3.0],
    [-18, 6, 3, 6.132],
    [-24, 30, 12, 3.66],
    [-24, 0, 4, 10.8],
    [-40, 6, 8, 19.805],
    [-30, 3, 6, 14.436],
    [-2.5, 0, 20, 1.425],
    [-20, 10, 2.5, 5.429],
  ]

  it('predicts the makeup gain Chrome applied, to within 0.01 dB', () => {
    for (const [threshold, knee, ratio, makeupDb] of MEASURED_IN_CHROME) {
      expect(
        gainToDb(compressorAutoMakeupGain(threshold, knee, ratio)),
      ).toBeCloseTo(makeupDb, 2)
    }
  })

  it('follows the closed form 0.6 * |threshold| * (1 - 1/ratio) for a hard knee', () => {
    expect(gainToDb(compressorAutoMakeupGain(-24, 0, 4))).toBeCloseTo(
      0.6 * 24 * 0.75,
      6,
    )
  })

  it('adds nothing at ratio 1, which is why a null compressor is a pure delay', () => {
    expect(compressorAutoMakeupGain(0, 0, 1)).toBe(1)
    expect(compressorAutoMakeupGain(-30, 12, 1)).toBe(1)
  })

  it('applies the ratio above the knee', () => {
    expect(compressorStaticOutputDb(-6, -18, 0, 3)).toBeCloseTo(-18 + 12 / 3, 6)
    expect(compressorStaticOutputDb(-30, -18, 0, 3)).toBeCloseTo(-30, 6)
  })
})

describe('reverb impulse', () => {
  const options = { sampleRate: 8000, decaySeconds: 1.5, damping: 0.5 }

  it('is the same for the same settings and seed', () => {
    const [a] = generateReverbImpulse(options)
    const [b] = generateReverbImpulse(options)
    expect(a).toEqual(b)
  })

  it('lasts exactly its decay time', () => {
    expect(generateReverbImpulse(options)[0]).toHaveLength(
      reverbImpulseLength(8000, 1.5),
    )
    expect(reverbImpulseLength(8000, 1.5)).toBe(12000)
  })

  it('falls about 60 dB from its start to its end', () => {
    const [left] = generateReverbImpulse(options)
    const rms = (from: number, to: number) => {
      let sum = 0
      for (let i = from; i < to; i++) sum += left[i] * left[i]
      return Math.sqrt(sum / (to - from))
    }
    const drop = gainToDb(rms(11000, 12000)) - gainToDb(rms(100, 1100))
    expect(drop).toBeLessThan(-45)
    expect(drop).toBeGreaterThan(-75)
  })

  it('gives left and right different noise, for width', () => {
    const [left, right] = generateReverbImpulse(options)
    let lr = 0
    let ll = 0
    let rr = 0
    for (let i = 0; i < left.length; i++) {
      lr += left[i] * right[i]
      ll += left[i] * left[i]
      rr += right[i] * right[i]
    }
    expect(Math.abs(lr / Math.sqrt(ll * rr))).toBeLessThan(0.2)
  })

  it('starts from silence so the onset does not click', () => {
    expect(generateReverbImpulse(options)[0][0]).toBe(0)
  })
})

describe('delay tail', () => {
  it('is one repeat without feedback', () => {
    expect(delayTailSeconds(0.3, 0)).toBe(0.3)
  })

  it('lasts until the repeats are 60 dB down', () => {
    // 0.5 feedback: ten repeats bring 1 down to 1/1024, just under -60 dB.
    expect(delayTailSeconds(0.25, 0.5)).toBeCloseTo(
      0.25 * (1 + Math.log(0.001) / Math.log(0.5)),
      9,
    )
  })
})
