// Compressor kernel tests — a steady level comes out at the static curve's gain, as a settled DynamicsCompressorNode plays it, and every frame comes out on its own frame, with nothing looked ahead.
import { describe, expect, it } from 'vitest'
import { compressorStaticOutputDb } from './compressor-curve'
import type { CompressorKernelSettings } from './compressor-kernel'
import { createCompressorKernel } from './compressor-kernel'
import { dbToGain, gainToDb } from './dsp'

const SR = 48000
const QUANTUM = 128

/** The voice role's compressor (role-chains.ts 'character'). */
const VOICE: CompressorKernelSettings = {
  thresholdDb: -20,
  kneeDb: 6,
  ratio: 2,
  attackSeconds: 0.015,
  releaseSeconds: 0.18,
}

/** Drums' parallel smash: hard knee, 8:1, a 2 ms attack. */
const SMASH: CompressorKernelSettings = {
  thresholdDb: -30,
  kneeDb: 0,
  ratio: 8,
  attackSeconds: 0.002,
  releaseSeconds: 0.08,
}

/** `input` (one channel per side) through a fresh kernel, a render quantum at a time; both sides of what comes out. */
function run(
  input: readonly Float32Array[],
  settings:
    | CompressorKernelSettings
    | ((quantum: number) => CompressorKernelSettings),
): [Float32Array, Float32Array] {
  const kernel = createCompressorKernel(SR)
  const length = input[0]?.length ?? 0
  const out: [Float32Array, Float32Array] = [
    new Float32Array(length),
    new Float32Array(length),
  ]
  for (let at = 0; at < length; at += QUANTUM) {
    const slice = (data: Float32Array) => data.subarray(at, at + QUANTUM)
    kernel.process(
      input.map(slice),
      out.map(slice),
      typeof settings === 'function' ? settings(at / QUANTUM) : settings,
    )
  }
  return out
}

/** A square wave of `seconds` whose every sample is `level` dBFS away from zero: a level the detector sees the same on every frame. */
function square(seconds: number, levelDb: number): Float32Array {
  const amplitude = dbToGain(levelDb)
  return Float32Array.from({ length: Math.round(seconds * SR) }, (_, i) =>
    Math.floor(i / 24) % 2 === 0 ? amplitude : -amplitude,
  )
}

/** The gain the last `frames` frames came out at, in dB. */
function settledGainDb(
  input: Float32Array,
  output: Float32Array,
  frames = 480,
): number {
  let gain = 0
  for (let i = input.length - frames; i < input.length; i++)
    gain += output[i] / input[i]
  return gainToDb(gain / frames)
}

describe('compressor kernel', () => {
  it.each([
    ['the voice compressor', VOICE, -40],
    ['the voice compressor', VOICE, -20],
    ['the voice compressor', VOICE, -10],
    ['the voice compressor', VOICE, -3],
    ['a hard-knee smash', SMASH, -40],
    ['a hard-knee smash', SMASH, -20],
    ['a hard-knee smash', SMASH, -10],
  ])(
    'holds %s at its static curve for a steady level of %s dBFS',
    (_name, settings, levelDb) => {
      const input = square(1, levelDb)

      const [left, right] = run([input], settings)

      const expected =
        compressorStaticOutputDb(
          levelDb,
          settings.thresholdDb,
          settings.kneeDb,
          settings.ratio,
        ) - levelDb
      expect(settledGainDb(input, left)).toBeCloseTo(expected, 4)
      expect(settledGainDb(input, right)).toBeCloseTo(expected, 4)
    },
  )

  it('compresses a level above the threshold, and leaves one below it alone', () => {
    const loud = square(1, -6)
    const quiet = square(1, -40)

    const loudGainDb = settledGainDb(loud, run([loud], VOICE)[0])
    const quietGainDb = settledGainDb(quiet, run([quiet], VOICE)[0])

    expect(loudGainDb).toBeLessThan(-3)
    expect(quietGainDb).toBe(0)
  })

  it('puts out every frame on the frame it came in on: an impulse comes out whole on its own frame, and nothing else does', () => {
    const input = new Float32Array(SR / 4)
    input[1000] = 0.5

    const [left, right] = run([input], VOICE)

    for (const side of [left, right]) {
      expect(side[1000]).toBe(0.5)
      expect(side.reduce((sum, value) => sum + Math.abs(value), 0)).toBe(0.5)
    }
  })

  it('starts settled: a level under the threshold passes at unity from its first frame', () => {
    const input = square(0.05, -30)

    const [left] = run([input], VOICE)

    expect(Array.from(left)).toEqual(Array.from(input))
  })

  it('catches a jump in level at the next 32-frame division, as the browser does, and not before', () => {
    const jumpAt = 1000
    const input = Float32Array.from({ length: SR / 2 }, (_, i) =>
      i < jumpAt ? 0.01 : 0.5,
    )

    const [left] = run([input], SMASH)

    const nextDivision = Math.ceil(jumpAt / 32) * 32
    for (let i = jumpAt; i < nextDivision; i++) expect(left[i]).toBe(input[i])
    expect(left[nextDivision]).toBeLessThan(input[nextDivision])
  })

  it('pulls a jump down by most of the way within its attack, then releases to unity once the level falls back', () => {
    const loudFrom = SR / 4
    const quietFrom = loudFrom + SR / 4
    const input = Float32Array.from({ length: SR * 2 }, (_, i) =>
      i >= loudFrom && i < quietFrom ? 0.9 : 0.01,
    )

    const [left] = run([input], VOICE)

    const gainDbAt = (frame: number) => gainToDb(left[frame] / input[frame])
    const settledDb = gainDbAt(quietFrom - 1)
    const attackEnd = loudFrom + Math.round(VOICE.attackSeconds * SR) + 32
    expect(settledDb).toBeLessThan(-5)
    expect(gainDbAt(attackEnd) - settledDb).toBeLessThan(0.5)
    expect(gainDbAt(quietFrom + 32)).toBeLessThan(-4)
    expect(gainDbAt(input.length - 1)).toBeGreaterThan(-0.01)
  })

  it('compresses both sides by the louder one, and copies one side to both', () => {
    const loud = square(0.5, -6)
    const quiet = square(0.5, -40)

    const [, quietSide] = run([loud, quiet], VOICE)
    const copied = run([loud], VOICE)

    const loudGainDb = settledGainDb(loud, copied[0])
    expect(settledGainDb(quiet, quietSide)).toBeCloseTo(loudGainDb, 6)
    expect(Array.from(copied[1])).toEqual(Array.from(copied[0]))
  })

  it('puts out silence for an input with no channels', () => {
    const kernel = createCompressorKernel(SR)
    const out = [new Float32Array(QUANTUM).fill(1), new Float32Array(QUANTUM)]

    kernel.process([], out, VOICE)

    expect(out[0].every((value) => value === 0)).toBe(true)
  })

  it('follows a threshold that moves between render quanta', () => {
    const input = square(2, -10)
    const lowered = { ...VOICE, thresholdDb: -30 }

    const [left] = run([input], (quantum) =>
      quantum * QUANTUM < SR ? VOICE : lowered,
    )

    const expected =
      compressorStaticOutputDb(-10, -30, VOICE.kneeDb, VOICE.ratio) + 10
    expect(settledGainDb(input, left)).toBeCloseTo(expected, 4)
  })
})
