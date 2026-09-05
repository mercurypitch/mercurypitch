# V1 selected character voices

This delivery contains 31 exact-caption English clips for the three selected
character voices. Other characters remain caption-only until their voices are
chosen; locked premium previews do not gain autoplay or selection privileges.

| Character  | Selected design | Clips                  |
| ---------- | --------------- | ---------------------- |
| Corky      | Batch 02 I      | 25 canonical app lines |
| Sugarlump  | Batch 02 E      | Meet, Present, Recede  |
| The Scroll | Batch 02 F      | Meet, Present, Recede  |

Corky's greeting and the six Pull lines are edited from the approved audition
takes. His remaining 24 lines were generated separately with the saved selected
voice, using ElevenLabs `eleven_v3` and the app's unchanged canonical captions.
The original designs used `eleven_ttv_v3`. No exploratory audition wording is
substituted for product captions. Private account IDs and provider credentials
are not included in the app.

## Delivery contract

- Versioned same-origin files under `public/audio/voice/en/`: mono AAC-LC,
  48 kHz, 128 kbps, faststart; no embedded music, Foley, pitch shift or time stretch.
- Whole-word edits preserve clean attacks and tails. Raw provider MP3s remain
  unchanged in the private archive. Clean 48 kHz/24-bit WAVs are decoded archives,
  not original lossless provider masters.
- Level matching uses constant gain per character collection rather than forcing
  every short phrase to the same loudness. Encoded true peaks must remain at or
  below -2 dBTP. AAC noise substitution and temporal noise shaping are disabled:
  direct encode/decode measurements found transient overshoots with those options
  in the preparation toolchain; final files are measured after encoding.
- Every runtime file is bound to its exact caption hash, byte hash, byte count,
  duration, channel count and sample rate. The greeting keeps its existing stable
  asset ID and replaces the earlier recording rather than adding a duplicate.
- Existing continuous score and Foley bytes are unchanged. No new playback
  trigger is added: recorded lines use the existing dialogue lane and cancellation.

Private source/selection ledgers and reproduction scripts live under
`<user-dotfiles>/besidecue/assets/voice-auditions/2026-09-05-v1-selected/`.

## Acceptance

Full decoder, caption-binding, static asset-integrity and dialogue-lifetime tests
are required. The longest delivered clip is below the existing 15-second dialogue
safety timeout; video completion alone must not cut longer speech. Independent
transcription is a word-check aid, not a substitute for the owner's listening
approval of character performance. Physical iOS playback and in-app mix review
remain release acceptance requirements.
