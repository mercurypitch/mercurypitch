// ============================================================
// Character voice recordings — exact captions to validated delivery assets
// ============================================================
//
// Only supplied recordings are registered. The canonical line owns its stable
// asset identity; delivery metadata may replace a take, never its caption.

import type { AudioSourceVariant, DialogueAudioAsset, DialogueAudioBinding, } from './audio-manifest'
import { AUDIO_MANIFEST_SCHEMA_VERSION, validateAudioAssetManifest, } from './audio-manifest'
import { findCanonicalVoiceLine } from './voice-lines'

export interface CharacterVoiceRecording extends DialogueAudioBinding {
  readonly sources: readonly [AudioSourceVariant, ...AudioSourceVariant[]]
}

export function registerCharacterVoiceRecordings(
  recordings: readonly CharacterVoiceRecording[],
): readonly DialogueAudioAsset[] {
  const assets = recordings.map((recording): DialogueAudioAsset => {
    const line = findCanonicalVoiceLine(recording.lineId)
    if (line === undefined) {
      throw new Error(`Unknown recorded character line "${recording.lineId}".`)
    }
    if (line.captionSha256 !== recording.captionSha256) {
      throw new Error(`Recording caption does not match "${line.id}".`)
    }
    return {
      id: `dialogue.${line.id}`,
      lane: 'dialogue',
      playback: { kind: 'one-shot' },
      dialogue: {
        lineId: line.id,
        captionSha256: line.captionSha256,
      },
      sources: recording.sources,
    }
  })
  const problems = validateAudioAssetManifest({
    schemaVersion: AUDIO_MANIFEST_SCHEMA_VERSION,
    revision: 'character-voice-recordings-v1',
    locale: 'en',
    assets,
  })
  if (problems.length > 0) {
    throw new Error(`Invalid character voice recordings: ${problems.join(' ')}`)
  }

  return Object.freeze(
    assets.map((asset) => {
      const sources: [AudioSourceVariant, ...AudioSourceVariant[]] = [
        Object.freeze({ ...asset.sources[0] }),
        ...asset.sources.slice(1).map((source) => Object.freeze({ ...source })),
      ]
      return Object.freeze({
        ...asset,
        dialogue: Object.freeze({ ...asset.dialogue }),
        playback: Object.freeze({ ...asset.playback }),
        sources: Object.freeze(sources),
      })
    }),
  )
}
