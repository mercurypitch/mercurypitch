# Merc voice auditions v1

Four original voice directions for Merc, generated as unsaved ElevenLabs Voice
Design previews. No cloning is used and no candidate is added to the voice
library during auditioning. The selected `generated_voice_id` can later be
saved with ElevenLabs' create-voice endpoint.

## Canon

- `docs/branding/BRAND.md` — clear, concise, premium and encouraging; never
  shaming, clinical or childish.
- `docs/branding/MASCOT.md` — Merc is the quicksilver hero mascot, a warm
  pitch-reactive guide rather than a decorative sticker.
- `apps/beside-cue/docs/games/glass-3d-art.md` §2.1 — the comedy comes from
  clumsy Merc moving through a calm, priceless museum.
- `<user-dotfiles>/irchiinnuss/native-apps/break-glass/voiceover-plan.md` §1 —
  ageless sprite, bright quick young-adult read, buoyant and lightly
  mischievous, warm over polished, musical, nonjudgmental, and usually 1–3
  seconds per game line.

The first three audition lines are exact current UI copy. The fourth is the
archived short shatter quip A4. The fifth adapts J11 as a longer range and
comic-timing sample; it is explicitly not proposed as a 1–3 second trigger.
`batch.json` records every line's status and exact source.

## Review package

Open `review.html` through the local preview server. It presents one direction
at a time, with a full reel and the same five isolated lines for direct
comparison:

| Choice | Principal take | Direction        |
| ------ | -------------- | ---------------- |
| A      | A1             | Warm Nimble      |
| B      | B2             | Bright Playful   |
| C      | C3             | Grounded Wry     |
| D      | D2             | Gentle Whimsical |

These are editorial picks from the three raw previews returned for each design
direction, not the owner's final voice choice. All twelve lossless raw previews
remain under `raw/`, with generated IDs and hashes in the generation receipt.
`candidates/` contains the four principal source WAVs and lightweight full-reel
MP3s; `lines/` contains the 20 isolated MP3 audition clips.

`review-manifest.json` is the browser-facing record. It includes the exact
source hash, generated voice ID, Voice Design description, line status and
provenance, clip timing, media hashes and quality evidence for each principal
candidate. Binary voice media is covered by the parent `.gitattributes` and
stored through Git LFS when committed.

The four principal reels decode as 44.1 kHz, 16-bit mono PCM with zero clipped
samples. An independent local Whisper `base.en` pass, without expected text or
a prompt, recovered the exact normalized five-line script for every principal
take. Integrated loudness is -24.4 to -23.3 LUFS and true peak is -8.9 to -3.1
dBFS. Exact per-candidate measurements and the ASR model hash are retained in
`review-manifest.json` and `review-plan.json`.

Chromium verification at a 390×740 viewport played all four principal reels
through the real audio element, observed advancing playback with no media or
page errors, and confirmed that starting a line clip pauses the previous reel.
The listening page fits without horizontal scrolling. This verifies playback
and controls; the owner's voice choice is still pending.

Rebuild only the derived review media after an intentional plan change:

```sh
rtk node prepare-review.mjs
```

The packager verifies each raw file against the completed generation receipt,
refuses clipping or invalid clip ranges, creates WAV/MP3 derivatives, probes
every output, and writes the review manifest atomically.

## Reproduce safely

Dry-run validation does not need credentials:

```sh
rtk node generate.mjs --dry-run
```

Paid generation requires the ElevenLabs key to be injected into
`BESIDECUE_ELEVENLABS_API_KEY` by the password manager at process launch. Never
put a key in this directory, a command argument, a URL, or a receipt. Existing
per-direction ledgers deliberately block blind retries.

The generator requests Voice Design v3, four calls total, with the same five
lines in each direction. ElevenLabs generates three previews per call while
charging once for that call's preview text. Lossless 44.1 kHz PCM is requested;
derived browser-friendly audition files are prepared from the retained raw
responses.

The account subscription read returned HTTP 401 with provider status
`missing_permissions` for the `user_read` permission. That scope applies to the
subscription metadata endpoint; the four Voice Design calls completed with the
same key. Cost therefore cannot be derived from before/after account counts.

The first request was stopped after HTTP 400 and returned no preview, generated
ID, request ID or reported character cost. A diagnostic replay captured the
structured provider error `invalid_parameters`: `quality` is supported only by
`eleven_multilingual_ttv_v2`. The corrected request removed only that unsupported
field. Both rejected attempts are preserved under `raw/attempt-*`; there was no
unknown outcome and no blind retry.

Official docs reviewed 2026-09-20:

- <https://elevenlabs.io/docs/api-reference/text-to-voice/design>
- <https://elevenlabs.io/docs/api-reference/text-to-voice/create>
- <https://elevenlabs.io/docs/eleven-creative/voices/voice-design>

Those pages explain how to save a chosen `generated_voice_id`, but do not state
an expiry or guaranteed retention period for unsaved preview IDs. Keep the raw
audio and receipt, then save the winner promptly after selection.

## Selection and enrollment

1. Record the owner's A/B/C/D choice in `selection.json`, including the exact
   candidate take, its `generated_voice_id`, raw SHA-256, and the unchanged
   voice description from `batch.json`.
2. Verify those fields against the completed per-direction manifest. Refuse a
   missing, altered, or ambiguous match.
3. Search the owner's voice library for the final unique name before writing.
   If it already exists, stop for identity reconciliation rather than creating
   a duplicate.
4. Call `POST /v1/text-to-voice` exactly once with the selected
   `generated_voice_id`, final name and original description. Reserve an atomic
   enrollment ledger before the call and retain the returned stable `voice_id`
   and provider request ID.
5. Generate production lines only from that stable saved `voice_id`. The other
   eleven previews remain unsaved; do not enroll or delete library voices while
   auditioning.
