// ============================================================
// Synthetic Voice & Audio Driver for E2E and Headless Testing
// ============================================================
//
// Generates parameterized synthetic audio signals (WAV buffers or Web Audio
// nodes) for automated end-to-end testing of pitch detection, scoring, note
// segmentation, and singing game mechanics without requiring physical microphones.

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export interface SyntheticVoiceConfig {
  sampleRate?: number // default 48000
  durationSec?: number // default 3.0
  fundamentalHz: number // base frequency in Hz (e.g. 220 for A3, 440 for A4)
  targetHz?: number // optional destination Hz for pitch glides / portamento
  vibratoHz?: number // vibrato rate in Hz (typically 4.5 - 6.5 Hz)
  vibratoCents?: number // vibrato depth in cents (typically 20 - 50 cents)
  noiseSnrDb?: number // signal-to-noise ratio in dB (optional background noise)
  harmonics?: number[] // harmonic amplitude ratios, default [0.5, 0.25, 0.12, 0.06]
}

/**
 * Generate a PCM WAV buffer with rich harmonic content, optional glides,
 * vibrato modulation, and background noise.
 */
export function generateSyntheticVoiceWav(
  config: SyntheticVoiceConfig,
): Buffer {
  const sampleRate = config.sampleRate ?? 48000
  const duration = config.durationSec ?? 3.0
  const samples = Math.floor(sampleRate * duration)
  const harmonics = config.harmonics ?? [0.5, 0.25, 0.12, 0.06]
  const baseHz = config.fundamentalHz
  const targetHz = config.targetHz ?? baseHz
  const vibratoHz = config.vibratoHz ?? 0
  const vibratoCents = config.vibratoCents ?? 0

  const buf = Buffer.alloc(44 + samples * 2)
  buf.write('RIFF', 0)
  buf.writeUInt32LE(36 + samples * 2, 4)
  buf.write('WAVE', 8)
  buf.write('fmt ', 12)
  buf.writeUInt32LE(16, 16)
  buf.writeUInt16LE(1, 20) // PCM format
  buf.writeUInt16LE(1, 22) // Mono
  buf.writeUInt32LE(sampleRate, 24)
  buf.writeUInt32LE(sampleRate * 2, 28)
  buf.writeUInt16LE(2, 32)
  buf.writeUInt16LE(16, 34) // 16-bit
  buf.write('data', 36)
  buf.writeUInt32LE(samples * 2, 40)

  let phase = 0

  for (let i = 0; i < samples; i++) {
    const t = i / sampleRate
    const progress = t / duration

    // Interpolate base pitch for linear glide
    const currentBaseHz = baseHz + (targetHz - baseHz) * progress

    // Apply vibrato frequency modulation if enabled
    let instantHz = currentBaseHz
    if (vibratoHz > 0 && vibratoCents > 0) {
      const semitoneShift =
        (vibratoCents / 100) * Math.sin(2 * Math.PI * vibratoHz * t)
      instantHz = currentBaseHz * Math.pow(2, semitoneShift / 12)
    }

    phase += (2 * Math.PI * instantHz) / sampleRate

    // Synthesize fundamental + harmonic overtones
    let sample = 0
    for (let h = 0; h < harmonics.length; h++) {
      const harmonicOrder = h + 1
      const amp = harmonics[h]
      sample += amp * Math.sin(harmonicOrder * phase)
    }

    // Optional noise injection
    if (config.noiseSnrDb !== undefined) {
      const noiseAmp = Math.pow(10, -config.noiseSnrDb / 20)
      const whiteNoise = (Math.random() * 2 - 1) * noiseAmp
      sample += whiteNoise
    }

    // Clip and write 16-bit signed integer
    const clamped = Math.max(-1.0, Math.min(1.0, sample))
    const int16 = Math.round(clamped * 28000)
    buf.writeInt16LE(int16, 44 + i * 2)
  }

  return buf
}

/**
 * Write a synthetic voice WAV to a temporary file and return its path.
 */
export function writeSyntheticVoiceFile(
  config: SyntheticVoiceConfig,
  filenamePrefix = 'synth-voice',
): string {
  const buf = generateSyntheticVoiceWav(config)
  const filePath = path.join(
    os.tmpdir(),
    `mercurypitch-${filenamePrefix}-${Math.round(config.fundamentalHz)}hz.wav`,
  )
  fs.writeFileSync(filePath, buf)
  return filePath
}
