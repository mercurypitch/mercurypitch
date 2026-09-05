// ============================================================
// V2 onboarding audio manifest — dialogue, effects and continuous music
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
    revision: 'beside-cue-onboarding-v2.4-audio-v4',
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
          src: `${AUDIO_ROOT}/dialogue/corky-greeting-v0_3.m4a`,
          mimeType: 'audio/mp4; codecs="mp4a.40.2"',
          sha256:
            '544f25d1a2565f600ed3ceb10bf93e1807b223e8dd93ff05589125315dcd6cba',
          byteLength: 123_466,
          durationMs: 5_038.75,
          sampleRateHz: 48_000,
          channels: 2,
        }),
      }),
      Object.freeze({
        id: V2_ONBOARDING_AUDIO_ASSET_IDS.score,
        lane: 'score',
        // The final 1.5 seconds blend into the opening 1.5 seconds. Resume
        // after that opening on each wrap; the first pass keeps the full song.
        playback: Object.freeze({
          kind: 'loop',
          loopStartMs: 1_500,
          loopEndMs: 77_880,
        }),
        sources: frozenSource({
          src: `${AUDIO_ROOT}/score/besidecue-score-full-loop-v0_1.m4a`,
          mimeType: 'audio/mp4; codecs="mp4a.40.2"',
          sha256:
            '6548afbd060216d772173ad9d9b9229f36723d3ed82e7fec3ff48535b59fedac',
          byteLength: 1_638_086,
          durationMs: 77_880,
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
