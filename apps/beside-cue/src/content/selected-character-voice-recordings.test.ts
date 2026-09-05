// ============================================================
// Selected V1 voice delivery tests — actual captions, bytes and availability
// ============================================================

import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { DEFAULT_CONTENT_PACK, validateContentPack } from './pack'
import { SELECTED_CHARACTER_VOICE_AUDIO_ASSETS, SELECTED_CHARACTER_VOICE_REVISION, } from './selected-character-voice-recordings'
import { createVoicePlayer } from './voice'
import { CANONICAL_VOICE_LINES } from './voice-lines'

const SELECTED_LINES = CANONICAL_VOICE_LINES

function packageRoot(): string {
  const root = [process.cwd(), resolve(process.cwd(), 'apps/beside-cue')].find(
    (candidate) =>
      existsSync(
        resolve(
          candidate,
          'src/content/selected-character-voice-recordings.ts',
        ),
      ),
  )
  if (root === undefined) throw new Error('Beside Cue package root is missing.')
  return root
}

describe('selected V1 character voice delivery', () => {
  it('registers exactly the selected 25 Corky and 42 pull captions once each', () => {
    expect(SELECTED_CHARACTER_VOICE_REVISION).toBe(
      'besidecue-v1-selected-voices-02',
    )
    expect(
      SELECTED_LINES.filter((line) => line.speakerId === 'corky'),
    ).toHaveLength(25)
    expect(
      SELECTED_LINES.filter((line) => line.speakerId !== 'corky'),
    ).toHaveLength(42)
    expect(new Set(SELECTED_LINES.map((line) => line.speakerId)).size).toBe(15)
    expect(SELECTED_CHARACTER_VOICE_AUDIO_ASSETS).toHaveLength(67)
    expect(
      SELECTED_CHARACTER_VOICE_AUDIO_ASSETS.map(
        (asset) => asset.dialogue.lineId,
      ).sort(),
    ).toEqual(SELECTED_LINES.map((line) => line.id).sort())
    expect(
      new Set(SELECTED_CHARACTER_VOICE_AUDIO_ASSETS.map((asset) => asset.id))
        .size,
    ).toBe(67)
    for (const line of SELECTED_LINES) {
      const asset = SELECTED_CHARACTER_VOICE_AUDIO_ASSETS.find(
        (candidate) => candidate.dialogue.lineId === line.id,
      )
      expect(asset?.id, line.id).toBe(`dialogue.${line.id}`)
      expect(asset?.dialogue.captionSha256, line.id).toBe(
        createHash('sha256')
          .update(line.text.normalize('NFC'), 'utf8')
          .digest('hex'),
      )
      expect(asset?.sources[0].src, line.id).toBe(
        `/audio/voice/en/${line.speakerId}/${line.fileStem}__v1_01.m4a`,
      )
    }
  })

  it('pins all 67 packaged recordings to their real delivery bytes', () => {
    const root = packageRoot()
    for (const asset of SELECTED_CHARACTER_VOICE_AUDIO_ASSETS) {
      expect(asset.sources, asset.id).toHaveLength(1)
      const source = asset.sources[0]
      const file = resolve(root, 'public', source.src.slice(1))
      expect(existsSync(file), source.src).toBe(true)
      const bytes = readFileSync(file)
      expect(bytes.byteLength, source.src).toBe(source.byteLength)
      expect(createHash('sha256').update(bytes).digest('hex'), source.src).toBe(
        source.sha256,
      )
      expect(source.mimeType).toBe('audio/mp4; codecs="mp4a.40.2"')
      expect(source.sampleRateHz).toBe(48_000)
      expect(source.channels).toBe(1)
      // Preserve Fog's approved, slower performance; every delivered clip
      // still leaves at least two seconds under the 15s automatic-scene guard.
      expect(source.durationMs).toBeGreaterThan(0)
      expect(source.durationMs).toBeLessThan(13_000)
    }
  })

  it('makes only selected voices available through the unchanged character player', () => {
    const player = createVoicePlayer({ pack: DEFAULT_CONTENT_PACK })
    const selectedIds = new Set(SELECTED_LINES.map((line) => String(line.id)))

    expect(validateContentPack(DEFAULT_CONTENT_PACK)).toEqual([])
    for (const line of DEFAULT_CONTENT_PACK.lines) {
      expect(player.hasRecording(line.id), line.id).toBe(
        selectedIds.has(line.id),
      )
    }
    // Registration alone cannot trigger speech; no new autoplay path is added.
    player.dispose()
  })
})
