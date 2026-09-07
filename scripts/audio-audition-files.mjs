// Audio audition files — lossless PCM export and declared post-render loudness measurement.
import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'

export const hashBytes = (bytes) =>
  createHash('sha256').update(bytes).digest('hex')
export const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'))
export const saveJson = (path, value) =>
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)

export function writeMonoFloatWav(path, base64, rate) {
  assert.ok(
    Number.isInteger(rate) && rate > 0 && rate * 4 <= 0xffffffff,
    'Valid integer WAV sample rate required',
  )
  const pcm = Buffer.from(base64, 'base64')
  assert.ok(pcm.length > 0 && pcm.length % 4 === 0)
  let peak = 0
  let sum = 0
  let energy = 0
  let clippedSamples = 0
  for (let offset = 0; offset < pcm.length; offset += 4) {
    const value = pcm.readFloatLE(offset)
    assert.ok(Number.isFinite(value), 'Nonfinite output')
    peak = Math.max(peak, Math.abs(value))
    sum += value
    energy += value * value
    if (Math.abs(value) >= 1) clippedSamples += 1
  }
  const wav = Buffer.alloc(44 + pcm.length)
  wav.write('RIFF')
  wav.writeUInt32LE(36 + pcm.length, 4)
  wav.write('WAVEfmt ', 8)
  wav.writeUInt32LE(16, 16)
  wav.writeUInt16LE(3, 20)
  wav.writeUInt16LE(1, 22)
  wav.writeUInt32LE(rate, 24)
  wav.writeUInt32LE(rate * 4, 28)
  wav.writeUInt16LE(4, 32)
  wav.writeUInt16LE(32, 34)
  wav.write('data', 36)
  wav.writeUInt32LE(pcm.length, 40)
  pcm.copy(wav, 44)
  writeFileSync(path, wav)
  return {
    sha256: hashBytes(wav),
    pcmSha256: hashBytes(pcm),
    clippedSamples,
    samplePeakDbfs: 20 * Math.log10(peak),
    rmsDbfs: 10 * Math.log10(energy / (pcm.length / 4)),
    dcOffset: sum / (pcm.length / 4),
    frames: pcm.length / 4,
    sampleRate: rate,
  }
}

export function measureLoudness(path) {
  const result = spawnSync(
    'ffmpeg',
    [
      '-hide_banner',
      '-i',
      path,
      '-filter_complex',
      'ebur128=peak=true',
      '-f',
      'null',
      '-',
    ],
    { encoding: 'utf8' },
  )
  assert.equal(result.status, 0, result.stderr)
  const summary = result.stderr.slice(result.stderr.lastIndexOf('Summary:'))
  const integratedLufs = Number(/I:\s+(-?[\d.]+) LUFS/.exec(summary)?.[1])
  const truePeakDbTP = Number(/Peak:\s+(-?[\d.]+) dBFS/.exec(summary)?.[1])
  assert.ok(
    Number.isFinite(integratedLufs) &&
      integratedLufs > -70 &&
      Number.isFinite(truePeakDbTP),
  )
  return { integratedLufs, truePeakDbTP, method: 'FFmpeg ebur128=peak=true' }
}
