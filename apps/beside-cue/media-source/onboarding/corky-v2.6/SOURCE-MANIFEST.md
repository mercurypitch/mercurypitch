# Selected J2 greeting picture

On 2026-09-14 the owner selected the existing one-offset J2 greeting preview
for integration. This derivative retains its complete six-second Flow picture
and appends the established cream wipe into the exact P02 table-ready plate.
No new generation, camera pre-roll, performance trim or retiming is used.
The V2.5 record-start and spin pictures remain unchanged.

## Source authority

All private paths below are relative to `<user-dotfiles>/besidecue/assets/`.
The builder rejects sources whose hashes differ from `BUILD-CONTRACT.json`.

| Input                          | Private source                                                                                   |
| ------------------------------ | ------------------------------------------------------------------------------------------------ |
| Selected picture               | `g01-flow-2026-09-14/raw/g01-flow-omni-take-20260914102516-keeper.mp4`                           |
| Existing cream panel, frame 19 | `onboarding-video-edit-v2_4/assets/diagnostics/transitions/b02-table-reveal-diagnostic-v0_1.mkv` |
| Exact P02 endpoint             | `onboarding-video-edit-v2_4/assets/diagnostics/plates/p02-table-ready-candidate-v0_17.png`       |

The selected review file is
`<agent-output>/beside-cue/2026-09-14/g01-take-102516/g01-take-102516-j2-greeting-one-offset.mp4`.
Its SHA-256 is recorded in the build contract. All 144 decoded picture frames
match the raw keeper exactly. Its mono audio correlates 0.999985 with the
delivered J2 greeting at a single 850 ms offset (16 kHz decoded comparison).
The raw keeper contains provider audio; the builder reads only its picture.

## Picture and dialogue timeline

| Segment                                     | Zero-based frames | Duration |
| ------------------------------------------- | ----------------- | -------- |
| Complete selected greeting                  | 0–143             | 6.000 s  |
| Cream wipe-in over the final greeting frame | 144–151           | 8/24 s   |
| Fully opaque cream                          | 152–155           | 4/24 s   |
| Wipe-out revealing exact P02                | 156–163           | 8/24 s   |
| P02 handle                                  | 164–169           | 6/24 s   |

The total is 170 frames at 24 fps: 7.083333 seconds. The transition reproduces
the V2.5 8/4/8/6-frame handoff, using the same panel and P02 source. P02 is exact
before the normal lossy H.264 encode; the final frame must match the app's
table-ready still visually without a composition jump.

Dialogue remains the separately registered
`/audio/voice/en/corky/en__corky__onboarding-greeting__v1_02.m4a` (2.660 seconds).
Its onset is **0.850 seconds on this final video's media timeline**, with no
additional phase-entry or camera delay. The video has no audio stream, so
provider or preview audio cannot double the app's dialogue. Playback must use
the authored media cue and keep the existing completion/background rules;
simply muxing the review audio into the product video would violate that contract.

## Reproduction

From the repository root, with Node and FFmpeg installed:

```sh
node scripts/prepare-beside-cue-j2-greeting.mjs \
  --greeting-source '<user-dotfiles>/besidecue/assets/g01-flow-2026-09-14/raw/g01-flow-omni-take-20260914102516-keeper.mp4' \
  --transition-source '<user-dotfiles>/besidecue/assets/onboarding-video-edit-v2_4/assets/diagnostics/transitions/b02-table-reveal-diagnostic-v0_1.mkv' \
  --table-source '<user-dotfiles>/besidecue/assets/onboarding-video-edit-v2_4/assets/diagnostics/plates/p02-table-ready-candidate-v0_17.png'
```

Optional `--output-dir` and `--proof-dir` paths support isolated reproduction.
The builder validates pinned inputs, the 144-frame source cadence, the silent
170-frame output's codec/geometry/colour tags, faststart layout and full decode
before installing files. It records its own hash and FFmpeg version. Output is
H.264 High 3.1, 720×1280, yuv420p BT.709, 24 fps CFR, CRF 16, GOP 48, with one
encoding thread. `SHA256SUMS` pins the public output; `BUILD-CONTRACT.json`
records sources, dialogue onset and delivery metadata. Physical device review
of the in-app audio/video timing remains part of release acceptance.
