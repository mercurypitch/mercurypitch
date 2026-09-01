// ============================================================
// V2 onboarding audio manifest — approved finite picture companions
// ============================================================
//
// These ids are the stable content/runtime seam. Delivery paths and revisions
// can change without teaching the onboarding director about filenames.

import type { AudioAssetManifest, AudioSourceVariant } from './audio-manifest'
import { AUDIO_MANIFEST_SCHEMA_VERSION } from './audio-manifest'

const AUDIO_ROOT = '/onboarding/corky-v2.4/audio'

function frozenSource(
  source: AudioSourceVariant,
): readonly [AudioSourceVariant] {
  return Object.freeze([Object.freeze(source)])
}

export const V2_ONBOARDING_AUDIO_ASSET_IDS = Object.freeze({
  greeting: 'dialogue.corky.onboarding.greeting',
  score: 'score.onboarding.v2',
  introTableSlide: 'foley.onboarding.intro-table-slide',
  platterStop: 'foley.onboarding.platter-stop',
} as const)

export const V2_ONBOARDING_AUDIO_ASSET_MANIFEST: AudioAssetManifest =
  Object.freeze({
    schemaVersion: AUDIO_MANIFEST_SCHEMA_VERSION,
    revision: 'beside-cue-onboarding-v2.4-audio-v2',
    locale: 'en',
    assets: Object.freeze([
      Object.freeze({
        id: V2_ONBOARDING_AUDIO_ASSET_IDS.greeting,
        lane: 'dialogue',
        playback: Object.freeze({ kind: 'one-shot' }),
        dialogue: Object.freeze({
          lineId: 'corky.onboarding.greeting',
          captionSha256:
            '4d74d9080a6e32473f9a83d5956dae4e47dfc8861f0fae159e8a4e4c9febd805',
        }),
        sources: frozenSource({
          src: `${AUDIO_ROOT}/dialogue/corky-greeting-v0_2.m4a`,
          mimeType: 'audio/mp4; codecs="mp4a.40.2"',
          sha256:
            '1ec12a8456c6fa922bd73614ab9eb0fa1f8754e3d26197383cd654b762f7a3f3',
          byteLength: 71_868,
          durationMs: 5_351,
          sampleRateHz: 48_000,
          channels: 2,
        }),
      }),
      Object.freeze({
        id: V2_ONBOARDING_AUDIO_ASSET_IDS.score,
        lane: 'score',
        playback: Object.freeze({ kind: 'one-shot' }),
        sources: frozenSource({
          src: `${AUDIO_ROOT}/score/besidecue-score-v0_9.m4a`,
          mimeType: 'audio/mp4; codecs="mp4a.40.2"',
          sha256:
            '063b9b244d54c75b6742ad3220f22c7cbf34d795d7a3cce23203a80640260b79',
          byteLength: 811_165,
          durationMs: 32_833.333,
          sampleRateHz: 48_000,
          channels: 2,
        }),
      }),
      Object.freeze({
        id: V2_ONBOARDING_AUDIO_ASSET_IDS.introTableSlide,
        lane: 'foley',
        playback: Object.freeze({ kind: 'one-shot' }),
        sources: frozenSource({
          src: `${AUDIO_ROOT}/foley/intro-table-slide-v0_1.m4a`,
          mimeType: 'audio/mp4; codecs="mp4a.40.2"',
          sha256:
            '19771a2a5e685c0632f6066adbc96f3839e035ddbe38d505b546126a549002ac',
          byteLength: 62_129,
          durationMs: 2_500,
          sampleRateHz: 48_000,
          channels: 2,
        }),
      }),
      Object.freeze({
        id: V2_ONBOARDING_AUDIO_ASSET_IDS.platterStop,
        lane: 'foley',
        playback: Object.freeze({ kind: 'one-shot' }),
        sources: frozenSource({
          src: `${AUDIO_ROOT}/foley/platter-stop-v0_1.m4a`,
          mimeType: 'audio/mp4; codecs="mp4a.40.2"',
          sha256:
            '0b277a72ed506d9281487a77424e058080ab61bcd0e099dc88a3bc8234ad1cd3',
          byteLength: 40_268,
          durationMs: 1_600,
          sampleRateHz: 48_000,
          channels: 2,
        }),
      }),
    ]),
  })
