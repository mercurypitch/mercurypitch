// ============================================================
// Synthetic Voice Driver Unit Tests
// ============================================================

import fs from 'node:fs'
import { describe, expect, it } from 'vitest'
import { generateSyntheticVoiceWav, writeSyntheticVoiceFile, } from '@/e2e/helpers/synthetic-voice-driver'

describe('Synthetic Voice Driver', () => {
  it('generates a valid PCM WAV buffer with correct RIFF headers', () => {
    const buf = generateSyntheticVoiceWav({
      fundamentalHz: 440,
      durationSec: 1.0,
      sampleRate: 48000,
    })

    expect(buf.toString('ascii', 0, 4)).toBe('RIFF')
    expect(buf.toString('ascii', 8, 12)).toBe('WAVE')
    expect(buf.toString('ascii', 12, 16)).toBe('fmt ')
    expect(buf.readUInt16LE(20)).toBe(1) // PCM format
    expect(buf.readUInt16LE(22)).toBe(1) // Mono
    expect(buf.readUInt32LE(24)).toBe(48000) // Sample rate
    expect(buf.readUInt16LE(34)).toBe(16) // 16-bit
    expect(buf.toString('ascii', 36, 40)).toBe('data')

    const expectedDataLength = 48000 * 2 // 48k samples * 2 bytes
    expect(buf.readUInt32LE(40)).toBe(expectedDataLength)
    expect(buf.length).toBe(44 + expectedDataLength)
  })

  it('generates WAV with portamento glide and vibrato without throwing', () => {
    const buf = generateSyntheticVoiceWav({
      fundamentalHz: 220,
      targetHz: 440,
      vibratoHz: 5.5,
      vibratoCents: 35,
      durationSec: 0.5,
      sampleRate: 44100,
      noiseSnrDb: 30,
    })

    expect(buf.length).toBe(44 + Math.floor(44100 * 0.5) * 2)
  })

  it('writes and cleans up temporary file properly', () => {
    const filePath = writeSyntheticVoiceFile({
      fundamentalHz: 330,
      durationSec: 0.2,
    })

    expect(fs.existsSync(filePath)).toBe(true)
    const stats = fs.statSync(filePath)
    expect(stats.size).toBeGreaterThan(1000)
    fs.unlinkSync(filePath)
  })
})
