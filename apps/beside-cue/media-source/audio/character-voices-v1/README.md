# V1 selected character voices

This delivery contains 67 exact-caption English clips for Corky and all fourteen
selected Pull voices. The six basic Pulls remain free; the eight premium Pulls
still require Pro. Locked previews do not gain autoplay or selection privileges.

| Character                                           | Selected design                     | Clips                  |
| --------------------------------------------------- | ----------------------------------- | ---------------------- |
| Corky                                               | Batch 02 I                          | 25 canonical app lines |
| Sugarlump                                           | Batch 02 E                          | Meet, Present, Recede  |
| The Scroll                                          | Batch 02 F                          | Meet, Present, Recede  |
| The Fog                                             | Basic C                             | Meet, Present, Recede  |
| Dinger                                              | Basic C                             | Meet, Present, Recede  |
| The Usual                                           | Original C, unchanged               | Meet, Present, Recede  |
| Ember                                               | Basic B                             | Meet, Present, Recede  |
| Thimble, Tab, Bookmark, Match, Kettle, Ticker, Tape | Premium 01 C, individually selected | Three each             |
| The Pillow                                          | Original female premium 01 C        | Meet, Present, Recede  |

Corky's greeting and the six Pull lines are edited from the approved audition
takes. His remaining 24 lines were generated separately with the saved selected
voice, using ElevenLabs `eleven_v3` and the app's unchanged canonical captions.
The remaining 36 Pull clips are also cut from the approved audition performances.
The original designs used `eleven_ttv_v3`. No exploratory audition wording is
substituted for product captions. Private account IDs and provider credentials
are not included in the app.

Pocket Turner and Loop reserve C are selected for future exploration only; neither
is registered in this app. Male Pillow comparison takes remain unselected.

`delivery-audit.json` preserves the first 31 deliveries; the additive
`remaining-pulls-delivery-audit.json` records the other 36. Together they match
runtime registration revision `besidecue-v1-selected-voices-02`. Both reports
describe technical provenance, not legal clearance or exclusive voice ownership.

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
`<user-dotfiles>/besidecue/assets/voice-auditions/2026-09-05-v1-selected/`
and `2026-09-05-v1-remaining-pulls/` beside it. The remaining-cast preparation uses
independent local recognition plus quiet-boundary checks, not provider alignment.

## Acceptance

Full decoder, caption-binding, static asset-integrity and dialogue-lifetime tests
are required. The longest delivered clip is below the existing 15-second dialogue
safety timeout; video completion alone must not cut longer speech. Independent
transcription is a word-check aid, not a substitute for the owner's listening
approval of character performance. Physical iOS playback and in-app mix review
remain release acceptance requirements.

The new 36 files pass complete decoding and independent final-clip caption-word
screening (30 plain matches, six disclosed spelling normalizations, no unexplained
differences). All have zero clipped samples and encoded peaks at or below
-2.66 dBTP. Fog's longest clip remains its approved unhurried 12.94-second Meet;
his automatic Present and Recede clips are below ten seconds. The earlier 31
files, continuous score and Foley bytes are unchanged.
