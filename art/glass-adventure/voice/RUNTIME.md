# Merc narration — approved D2

The owner chose the original D2 Gentle Whimsical voice on 2026-09-20.
Permanent ElevenLabs identity: `Merc V1 Gentle Whimsical D2`,
`B4fBPRmasEsTgd6YlSok`. Selection/enrollment receipts live in `v3/`.
The earlier audition manifests record their historical generation state.

## First game integration

| Cue | Exact approved line | Trigger |
| --- | --- | --- |
| Welcome | A little note can break glass. | First eligible movement/orbit/tutorial-close gesture after the scene is ready |
| Required glass | Beautiful. A new path is open. | Required exhibit breaks |
| Optional glass | Gorgeous. Absolutely gorgeous. | Optional exhibit breaks |

The three runtime MP3s are exact copies of the approved v1 D2 isolated clips,
not regenerated performances. They total 140,144 bytes. The ordinary-Git
runtime manifest is `apps/beside-cue/public/games/adventure-voice-v1/manifest.json`;
it records original source paths, byte sizes and SHA-256 hashes. Original raw
PCM, WAV reels, clips and every alternative stay in the LFS authoring archive.
No new spoken-line generation was required.

## Playback policy

- One short cue at a time; a new cue invalidates and softly retires the previous one.
- Fetch/unlock/decode must start playback within 1.8 seconds or the cue is skipped.
- Microphone start synchronously cancels all pending cues and awaits every fading tail alongside the music/ambience release before pitch detection begins.
- Pause, backgrounding, tutorial, graphics loss and exit retire playback. Old fetch/decode results cannot revive it.
- Pause has an independent, saved **Merc voice** checkbox, enabled by default. Turning it off stops narration; turning it on does not replay a cue. Music mute remains independent.
- The calibration prompt and longer comedy line remain audition material in this pass.

The shared host contract separates narration from music, sound effects, pitch
capture and game simulation. The browser adapter owns media/context lifetime;
the session controller owns cue eligibility. This applies to web and native
WebView hosts.

## Verification

Final focused checks: 11 browser-service tests and 10 controller tests passed,
including late decode, replacement, capture silence across retiring cues,
lifecycle cancellation and preference behavior. Browser and final CI results are recorded in the canonical
N2 milestone under dotfiles. Physical-device listening remains owner acceptance.

Final browser evidence: welcome/mic/voice-switch acceptance passed; music and
Pause focus/layout/persistence passed at 390/820/1280px. Real PCM input earned a
break and started the approved celebration once; reloading preserved progress
without replay. The final 390×740 Pause panel was visually inspected and saved
under `v4/architecture/proofs/playable-v1/390-merc-voice-settings.png`.
