# Drum Night kit assets

These are optional, gesture-loaded one-shot banks. Every sampled resource has
an audited MP3 compatibility object and a deterministic Ogg Opus sibling. The
player proves Opus with its real Web Audio decode path and then pins one format
for the whole selected-kit plan; it never mixes codecs per hit. Assets are not
precached by the service worker and are safe to move behind a configured media
origin while their content-hashed object keys remain unchanged.

`catalog.json` is the machine-readable byte, hash, articulation, and pinned
source-provenance companion. Licence identity is declared in the app-owned kit
manifest and the `LICENSE.md` / `NOTICE` files inside each sampled-kit folder.
`publish-plan.json` is inert metadata for a later, reviewed Cloudflare R2
upload; it does not contain credentials or execute a deployment.

Rebuild and verify from the repository root:

```sh
DRUM_AUDITION_ROOT=/absolute/path/to/approved-audition node scripts/curate-drum-night-kits.mjs
node scripts/curate-drum-night-kits.mjs --check
node scripts/curate-drum-night-kits.mjs --publish-plan
node scripts/encode-drum-kit-formats.mjs --check
```

The canonical curator rebuilds MP3 and Opus together. For a format-only refresh
of already audited MP3 bytes, run `node scripts/encode-drum-kit-formats.mjs`.
Both paths require the pinned FFmpeg version recorded in the generated
catalogue; `--check` re-encodes every Opus object and verifies byte-for-byte
hash and publish closure.

Mercury Synth and Circuit have no downloadable assets. Mercury's recipes live
in `src/lib/drum-voices.ts` and remain the only per-hit fallback for sampled
flavors; Circuit is used only when explicitly selected. FLAC is accepted by the
catalogue schema but is not selected by the runtime until a separate delivery
and entitlement decision is implemented.

## Muldjord and Crocell

The optional **Muldjord** (old v1 SFZ edition) and **Crocell** (v1.1) banks
preserve the eight approved core microphone mixtures and expand their acoustic
GM coverage. Both selectors expose the sample credits:
[Muldjord](muldjord/LICENSE.md), [Crocell](crocell/LICENSE.md).

| Bank     | GM note mappings | Distinct recorded strikes | Added sounds                                                                    |
| -------- | ---------------- | ------------------------- | ------------------------------------------------------------------------------- |
| Muldjord | 17               | 111                       | Second kick/crash/ride, china, ride bell, remaining toms                        |
| Crocell  | 21               | 107                       | Second kick/crash, rim, rimshot, pedal hat, bell, china, splash, remaining toms |

Velocity selects recorded
layers, and repeat positions rotate real strikes. The kit-wide levels are
−5 dB (Muldjord) and +5 dB (Crocell), compensating for the 10 LU difference measured
in the same audition groove while preserving each kit's internal balance. The extra headroom accommodates decoded codec
peaks. No additional per-hit normalization, velocity taper or power correction
is applied. Room/master gain and the mixer remain available as usual.

Crocell's naturally quiet pedal chick uses a fixed +12 dB offline instrument
bus (not individual-hit normalization). Its soft/medium/hard pairs were selected
from measured close/OH mix levels, since upstream multi-microphone power ranks
did not predict the mixed chick level. These changes are in its source recipes.

Mappings retain General MIDI semantics, not the upstream custom MIDI numbers:

- Both kits have four physical toms, shared across six GM notes: 43/45 share
  the next-lowest tom and 48/50 share the highest. There is no pitch shifting.
- Muldjord's two rides are separate 51/59 recordings. Crocell has one ride bow,
  shared at 51/59; its native note 59 is actually an extra **crash**, not a ride.
- GM53 has a real bell; GM52 a china; Crocell GM55 a real splash. GM37/40 use
  Crocell's recorded rim/rimshot, consistent with its acoustic mapping.
- Muldjord v1 has no pedal-hat recording, sidestick, alternate snare or splash;
  GM44/37/40/55 retain fallback. Neither kit supplies GM39 clap or general
  auxiliary percussion. No snare-rest noise becomes a clap or china a tambourine.
- Native-only variants (extra bells/cymbals, recorded chokes, snare-rest noise,
  Crocell hat openness/pedal splash) are listed in each recipe's `expansion`
  inventory. They require explicit articulation selection; they are not silently
  assigned to unrelated GM keys or rotated in as different techniques.

The new banks use 128 kbit/s Opus to preserve cymbal transients within the existing
codec comparison limits. Older banks retain their unchanged 64 kbit/s encodings.
The runtime v2 projection stores compact rows, expanded and validated into the
same playback resources; the public canonical catalogue remains readable v2 JSON.

`selected-mixes.json` in each bank records the source release, licensed input
hashes, microphone channels/pans/gains, crop/fade history, prepared-master
hashes, and velocity/repeat choices. It contains no private audio or absolute
workstation paths. Full licence text and unmodified upstream notices ship
beside the sounds; sample derivatives remain CC BY 4.0, not the app's licence.

The approved 2026-09-09 audition manifest is pinned by SHA-256 in
`scripts/pin-drum-kit-audition.mjs`. Rebuilds require its corresponding frozen
48 kHz stereo mixtures under `samples/{muldjord,crocell}/`; every input hash is
checked before encoding. Upstream source identities and mix recipes are public,
but clean CI intentionally uses the committed MP3 compatibility masters and
does not download the multi-gigabyte upstream libraries or depend on an owner's
audition directory. To refresh just these banks without rerendering older kits:

```sh
node scripts/expand-drum-kit-recorded-banks.mjs /absolute/path/to/approved-audition
DRUM_AUDITION_ROOT=/absolute/path/to/approved-audition \
  node scripts/curate-drum-night-kits.mjs --update-recorded
```

Expansion preparation uses the pinned Muldjord Git tree with blob verification
and bounded Crocell archive ranges with member CRC checks. It retains approved
core-master hashes, and saves source hashes, microphone recipes, and expanded
master hashes. Re-running `pin-drum-kit-audition.mjs` alone restores only the
original eight-voice recipes; follow it with the expansion preparer.

`--check` needs no audition files or network: it verifies source/asset closure,
hashes, licences, both decoded codecs, onset, noise, headroom, recorded dynamics,
and the generated calibration/runtime/Opus projections. The default kits,
their encoded bytes, calibration and fallback routing are unchanged.
