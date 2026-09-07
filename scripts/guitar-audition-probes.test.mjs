// Guitar spectral probe tests pin amplitude normalization, rejection and independent bins.
import assert from 'node:assert/strict'
import test from 'node:test'
import { binPower } from './guitar-audition-probes.mjs'

const rate = 8000
const tone = (frequencies) =>
  Float32Array.from({ length: rate * 1.5 }, (_, index) =>
    frequencies.reduce(
      (sum, [frequency, amplitude]) =>
        sum + amplitude * Math.sin((2 * Math.PI * frequency * index) / rate),
      0,
    ),
  )

test('coherent sine power is amplitude squared over two, independent of phase offset', () => {
  const samples = tone([[220, 0.2]])
  for (const from of [0, 500, 2000])
    assert.ok(Math.abs(binPower(samples, rate, 220, from) - 0.02) < 1e-8)
})
test('linear two-tone input contributes no selected intermodulation bins', () => {
  const samples = tone([
    [110, 0.1],
    [173, 0.05],
  ])
  assert.ok(Math.abs(binPower(samples, rate, 110) - 0.005) < 1e-8)
  assert.ok(Math.abs(binPower(samples, rate, 173) - 0.00125) < 1e-8)
  for (const frequency of [63, 47, 236, 283, 393, 456])
    assert.ok(binPower(samples, rate, frequency) < 1e-16)
})
test('spectral power scales quadratically; silence remains zero', () => {
  const quiet = binPower(tone([[220, 0.05]]), rate, 220)
  const loud = binPower(tone([[220, 0.2]]), rate, 220)
  assert.ok(Math.abs(loud / quiet - 16) < 1e-7)
  assert.equal(binPower(new Float32Array(rate * 1.5), rate, 220), 0)
})
test('invalid windows, bins and nonfinite PCM are rejected', () => {
  const samples = tone([[220, 0.1]])
  for (const frequency of [0, 0.5, rate / 2, NaN])
    assert.throws(() => binPower(samples, rate, frequency))
  assert.throws(() => binPower(samples, rate, 220, -1))
  assert.throws(() => binPower(samples, rate, 220, 6000))
  samples[2001] = NaN
  assert.throws(() => binPower(samples, rate, 220))
})
