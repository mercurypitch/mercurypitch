// ============================================================
// Localized deliveries — exact caption identities and actual shipped media bytes
// ============================================================

import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { LOCALIZED_CHARACTER_VOICE_RECORDINGS, WITHHELD_LOCALIZED_VOICE_LINE_IDS, } from './localized-character-voice-recordings'
import { getRecordedVoiceLines } from './localized-voice-lines'

const ROOT = [process.cwd(), resolve(process.cwd(), 'apps/beside-cue')].find(
  (candidate) =>
    existsSync(
      resolve(candidate, 'src/content/localized-character-voice-recordings.ts'),
    ),
)

describe('Spanish and German voice delivery', () => {
  it.each(['es', 'de'] as const)(
    'ships 42 screened %s lines with one explicitly withheld audition',
    (locale) => {
      const recordings = LOCALIZED_CHARACTER_VOICE_RECORDINGS[locale]
      const lines = getRecordedVoiceLines(locale)
      expect(recordings).toHaveLength(42)
      expect(lines).toHaveLength(43)
      expect(WITHHELD_LOCALIZED_VOICE_LINE_IDS[locale]).toEqual(
        locale === 'es'
          ? ['corky.not-now.02']
          : ['pull.familiar-ritual.present'],
      )
      expect(lines.filter((line) => line.speakerId === 'corky')).toHaveLength(
        25,
      )
      expect(new Set(lines.map((line) => line.speakerId)).size).toBe(7)
      expect(recordings.map((recording) => recording.lineId).sort()).toEqual(
        lines
          .filter(
            (line) =>
              !WITHHELD_LOCALIZED_VOICE_LINE_IDS[locale].includes(line.id),
          )
          .map((line) => line.id)
          .sort(),
      )
      expect(ROOT).toBeDefined()

      for (const recording of recordings) {
        const line = lines.find(
          (candidate) => candidate.id === recording.lineId,
        )!
        expect(recording.captionSha256).toBe(
          createHash('sha256')
            .update(line.text.normalize('NFC'), 'utf8')
            .digest('hex'),
        )
        expect(recording.sources).toHaveLength(1)
        const source = recording.sources[0]
        expect(source.src).toContain(
          `/audio/voice/${locale}/${line.speakerId}/`,
        )
        const bytes = readFileSync(
          resolve(ROOT!, 'public', source.src.slice(1)),
        )
        expect(bytes.byteLength, source.src).toBe(source.byteLength)
        expect(
          createHash('sha256').update(bytes).digest('hex'),
          source.src,
        ).toBe(source.sha256)
        expect(source.mimeType).toBe('audio/mp4; codecs="mp4a.40.2"')
        expect(source.sampleRateHz).toBe(48_000)
        expect(source.channels).toBe(1)
        expect(source.durationMs).toBeGreaterThan(0)
        // The Director allows full-length translated speech rather than speeding it up.
        expect(source.durationMs).toBeLessThan(30_000)
      }
    },
  )
})
