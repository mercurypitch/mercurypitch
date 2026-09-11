// Audio audition file tests verify actual WAV bytes and offline measurement evidence.
import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { hashBytes, measureLoudness, readJson, saveJson, writeMonoFloatWav, } from './audio-audition-files.mjs'

function scratchFile(t, name = 'audio.wav') {
  const directory = mkdtempSync(join(tmpdir(), 'audio-audition-files-test-'))
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  return join(directory, name)
}

function encodedPcm(samples) {
  const bytes = Buffer.alloc(samples.length * 4)
  samples.forEach((value, index) => bytes.writeFloatLE(value, index * 4))
  return bytes.toString('base64')
}

function near(actual, expected, tolerance = 1e-10) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${actual} differs from ${expected} by more than ${tolerance}`,
  )
}

for (const rate of [44100, 48000, 96000]) {
  test(`writes a mono IEEE-float RIFF with exact sample order at ${rate} Hz`, (t) => {
    const path = scratchFile(t)
    const samples = [0, 0.25, -0.5, 0.125]

    const report = writeMonoFloatWav(path, encodedPcm(samples), rate)

    const wav = readFileSync(path)
    assert.equal(wav.length, 60)
    assert.equal(wav.toString('ascii', 0, 4), 'RIFF')
    assert.equal(wav.readUInt32LE(4), wav.length - 8)
    assert.equal(wav.toString('ascii', 8, 16), 'WAVEfmt ')
    assert.equal(wav.readUInt32LE(16), 16)
    assert.equal(wav.readUInt16LE(20), 3)
    assert.equal(wav.readUInt16LE(22), 1)
    assert.equal(wav.readUInt32LE(24), rate)
    assert.equal(wav.readUInt32LE(28), rate * 4)
    assert.equal(wav.readUInt16LE(32), 4)
    assert.equal(wav.readUInt16LE(34), 32)
    assert.equal(wav.toString('ascii', 36, 40), 'data')
    assert.equal(wav.readUInt32LE(40), 16)
    assert.deepEqual(
      samples.map((_, index) => wav.readFloatLE(44 + index * 4)),
      samples,
    )
    assert.equal(report.frames, samples.length)
    assert.equal(report.sampleRate, rate)
  })
}

test('reports hashes and peak, RMS and DC from the exact exported samples', (t) => {
  const path = scratchFile(t)

  const report = writeMonoFloatWav(
    path,
    encodedPcm([0, 0.25, -0.5, 0.125]),
    48000,
  )

  const wav = readFileSync(path)
  assert.equal(report.sha256, createHash('sha256').update(wav).digest('hex'))
  assert.equal(
    report.pcmSha256,
    createHash('sha256').update(wav.subarray(44)).digest('hex'),
  )
  near(report.samplePeakDbfs, -6.020599913279624)
  near(report.rmsDbfs, 10 * Math.log10(21 / 256))
  assert.equal(report.dcOffset, -1 / 32)
  assert.equal(report.clippedSamples, 0)
})

test('keeps finite over-range float samples and reports their clipping risk without limiting', (t) => {
  const path = scratchFile(t)
  const samples = [-1.25, -1, -0.5, 0, 0.5, 1, 1.25]

  const report = writeMonoFloatWav(path, encodedPcm(samples), 48000)

  const wav = readFileSync(path)
  const decoded = samples.map((_, index) => wav.readFloatLE(44 + index * 4))
  assert.deepEqual(decoded, samples)
  assert.ok(decoded.every(Number.isFinite))
  assert.equal(report.clippedSamples, 4)
  near(report.samplePeakDbfs, 20 * Math.log10(1.25))
  assert.ok(Number.isFinite(report.rmsDbfs))
  assert.equal(report.dcOffset, 0)
})

test('preserves silent PCM and reports zero energy without fabricating an audible level', (t) => {
  const path = scratchFile(t)

  const report = writeMonoFloatWav(path, encodedPcm([0, 0, 0]), 48000)

  assert.deepEqual(readFileSync(path).subarray(44), Buffer.alloc(12))
  assert.equal(report.frames, 3)
  assert.equal(report.samplePeakDbfs, -Infinity)
  assert.equal(report.rmsDbfs, -Infinity)
  assert.equal(report.dcOffset, 0)
  assert.equal(report.clippedSamples, 0)
})

for (const value of [NaN, Infinity, -Infinity]) {
  test(`rejects ${value} PCM before creating an output file`, (t) => {
    const path = scratchFile(t)

    assert.throws(
      () => writeMonoFloatWav(path, encodedPcm([0.25, value]), 48000),
      /Nonfinite output/,
    )

    assert.equal(existsSync(path), false)
  })
}

for (const length of [0, 1, 3, 5, 7]) {
  test(`rejects a ${length}-byte incomplete float32 stream without an output file`, (t) => {
    const path = scratchFile(t)
    const base64 = Buffer.alloc(length).toString('base64')

    assert.throws(() => writeMonoFloatWav(path, base64, 48000))

    assert.equal(existsSync(path), false)
  })
}

for (const rate of [0, -1, 44100.5, NaN, Infinity, -Infinity, 2 ** 30]) {
  test(`rejects invalid or unrepresentable sample rate ${rate} before creating a WAV`, (t) => {
    const path = scratchFile(t)

    assert.throws(
      () => writeMonoFloatWav(path, encodedPcm([0.25]), rate),
      /Valid integer WAV sample rate required/,
    )

    assert.equal(existsSync(path), false)
  })
}

test('hashes the standard SHA-256 vector independently of WAV formatting', () => {
  assert.equal(
    hashBytes(Buffer.from('abc')),
    'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
  )
})

test('saves a newline-terminated JSON record that reloads without changing measurements', (t) => {
  const path = scratchFile(t, 'measurements.json')
  const expected = { sampleRate: 48000, frames: 4, gainDb: -6.25 }

  saveJson(path, expected)

  assert.deepEqual(readJson(path), expected)
  assert.equal(
    readFileSync(path, 'utf8'),
    `${JSON.stringify(expected, null, 2)}\n`,
  )
})

test('FFmpeg measures a generated one-second 1 kHz tone near its known level', (t) => {
  const available = spawnSync('ffmpeg', ['-version'], { encoding: 'utf8' })
  if (available.error?.code === 'ENOENT') {
    t.skip('Optional integration check requires FFmpeg on PATH')
    return
  }
  assert.equal(available.status, 0, available.stderr)
  const path = scratchFile(t)
  const tone = Array.from(
    { length: 48000 },
    (_, frame) => 0.25 * Math.sin((2 * Math.PI * 1000 * frame) / 48000),
  )
  const wav = writeMonoFloatWav(path, encodedPcm(tone), 48000)

  const measured = measureLoudness(path)

  assert.equal(wav.frames, 48000)
  assert.equal(wav.clippedSamples, 0)
  near(wav.samplePeakDbfs, -12.041199826559248)
  near(wav.rmsDbfs, -15.051499783199061, 1e-6)
  // EBU R128's mono 1 kHz calibration is approximately RMS minus 0.05 LU;
  // FFmpeg prints its integrated loudness and true peak to one decimal place.
  near(measured.integratedLufs, -15.1, 0.2)
  near(measured.truePeakDbTP, -12, 0.15)
  assert.equal(measured.method, 'FFmpeg ebur128=peak=true')
})
