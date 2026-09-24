# Merc voice auditions v2

Three original Voice Design v3 directions close to the owner's current favorite, D2 Gentle Whimsical. D2 remains unchanged in `../v1` and is referenced as the favorite baseline; it was not synthesized again.

This is an audition package only. No preview is enrolled in the ElevenLabs voice library, selected as final, or integrated into the game.

## Comparison set

| Direction            | Review take | Intended difference from D2                                    |
| -------------------- | ----------- | -------------------------------------------------------------- |
| D — Gentle Whimsical | D2 from v1  | Unchanged favorite baseline                                    |
| E — Warmer Grounded  | E1          | Slightly more low-mid warmth and grounded resonance            |
| F — Brighter Clear   | F1          | Slightly brighter presence and clearer short-line articulation |
| G — Quiet Playful    | G1          | Subtle playful mischief in the comic beats                     |

These are close variations, not imitations and not an objective ranking. The owner still needs to listen and make the final direction and take decision.

Open `review.html` through a local static server. It compares D2, E1, F1 and G1 with the same full five-line reel and the same five isolated clips. D2 is visibly marked as the favorite baseline. The page references the existing v1 D media through `../v1`; there is no duplicate D audio in v2.

## Generation record

`generate.mjs` made exactly three paid calls to ElevenLabs `/v1/text-to-voice/design` with `eleven_ttv_v3`. Each call used the same five-line, 191-character script and returned three lossless 44.1 kHz PCM previews:

- E1, E2, E3;
- F1, F2, F3;
- G1, G2, G3.

All nine PCM responses remain in `raw/`. `generation-receipt.json`, `raw/request-*.json`, and `raw/manifest-*.json` retain the request settings, descriptions, seeds, provider request IDs, generated voice IDs, duration, byte size, and SHA-256 for every take. The request contains no unsupported `quality` parameter.

The known key has no `user_read` permission, so v2 deliberately did not repeat the subscription endpoint request. The completed generation receipt and each per-direction ledger block a blind paid retry. Any rejection, partial response, parse failure, or uncertain network result would have stopped the batch while retaining completed and partial results.

The password manager injected `BESIDECUE_ELEVENLABS_API_KEY` only for the generator process. The reference-only mode-0600 dotenv was removed after generation. No resolved key is stored in this package, a command argument, URL, log, or receipt.

## Quality audit and editorial picks

Run the non-paid raw audit with:

```sh
rtk node audit-raw.mjs
```

The audit verifies every raw file against the generation receipt, measures PCM clipping and loudness, and runs local Whisper `base.en` without expected text or a prompt. `raw-audit.json` contains the evidence for all nine takes.

Results:

- all nine raw takes match their receipt hashes;
- all nine have zero clipped samples;
- all nine recover the exact normalized five-line script;
- E1, F1 and G1 have the highest independent ASR token confidence within their respective direction and provide clean line boundaries for the review clips.

E1, F1 and G1 are credible representative takes for owner comparison. That mechanical evidence does not establish which performance has the best character, warmth, comic timing, or repeat-listening comfort.

`prepare-review.mjs` refuses a changed raw hash, clipping, non-exact selected transcript, invalid clip range, mismatched revision, altered D description, or changed D2 media hash. Rebuild the derived WAV, MP3, line clips, and browser manifest with:

```sh
rtk node prepare-review.mjs
```

The resulting `review-manifest.json` contains four candidates: the verified v1 D2 benchmark followed by the three new v2 selections. All 20 isolated line clips and all four full reels report exact ASR and zero clipping. New v2 candidate WAVs and MP3s live under `candidates/`; new isolated clips live under `lines/`.

Run the final non-network archive check with:

```sh
rtk node verify.mjs
```

It rechecks revisions, paid-call and preview bounds, all raw and derived hashes, unique generated IDs, the absence of the unsupported `quality` field, zero clipping, exact ASR, D2's unchanged baseline role, and the absence of duplicated D media in v2.

## Safe checks

The generator defaults to a non-paid dry run:

```sh
rtk node generate.mjs --dry-run
```

It validates the revision, Voice Design v3 model, PCM format, exact script length, D2 benchmark, and exactly three E–G directions. The completed receipt prevents `--generate` from issuing another paid request. Do not delete or bypass the receipt or per-direction ledgers to retry.

The v1 official documentation references remain the API basis for this batch:

- <https://elevenlabs.io/docs/api-reference/text-to-voice/design>
- <https://elevenlabs.io/docs/api-reference/text-to-voice/create>
- <https://elevenlabs.io/docs/eleven-creative/voices/voice-design>

Those pages explain saving a chosen `generated_voice_id` but state no guaranteed retention duration for an unsaved preview ID. Raw audio and IDs are preserved here. Enrollment is a separate future action after the owner chooses a final direction and exact take.

## Boundaries

- No voice cloning or imitation was used.
- No voice was added to, edited in, or removed from the voice library.
- No winner is declared by this package.
- No runtime voice mapping or narration integration changed.
- No D2 media or v1 ledger changed.
- No subscription, enrollment, or production-line request is part of v2.

## Browser verification — 2026-09-20

At a 390×740 phone viewport, D2/E1/F1/G1 reels decode and advance playback
without media errors. Starting an isolated clip pauses the preceding reel.
The page fits the viewport without horizontal overflow or browser errors; the
phone rendering was visually inspected. This verifies playback and layout,
not the owner's final artistic preference.
