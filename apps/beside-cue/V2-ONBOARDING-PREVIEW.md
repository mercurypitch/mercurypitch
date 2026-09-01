# Beside Cue V2 onboarding preview

V2 remains an opt-in developer preview. Ordinary debug, release, and store
builds continue to use V1 unless `VITE_BESIDE_CUE_V2_ONBOARDING=1` is set at
build time.

Pull requests publish a separate `beside-cue-v2-preview-debug-apk` artifact
for Android hardware review. That artifact is not a release candidate and
must not be promoted to a store build.

## Current picture scope

The founder-authorized preview pack is derived from the frozen V2.4 scene and
contains the current Corky reveal, table reveal, corrected P02 record-player
plate, and complete enter/hold/recede performances for Scroll, Sugarlump, and
Fog. It is included specifically so PR #689 can be reviewed as an integrated
Android journey. Normal release review still applies before any store build.

The delivery files are pinned in
`public/onboarding/corky-v2.4/SHA256SUMS`. Source hashes, the deterministic
FFmpeg recipe, and the Android-test authorization are recorded under
`media-source/onboarding/corky-v2.4/`. A custom or otherwise unauthored Pull
stays on the exact P02 plate; it never falls back to legacy Corky picture.

The record itself is a native deterministic layer over the stopped plate. It
turns rigidly at 30 rpm, keeps one clock mounted across the spin and Stop
scenes, and decelerates from its current angle to the next canonical stopped
orientation. The runtime enters the saved acknowledgement only after both the
visual stop and the correlated persistence result complete.

## Current sound scope

V2 uses four separated, hash-pinned assets: Corky's caption-bound greeting,
the reviewed finite score stem, table-slide Foley, and platter-stop Foley. The
score starts once and continues through the journey without restarting at
interactive holds. The fixed-timeline V1 review mix and rejected generated
platter clip are not used.

## Android review

Install the PR artifact on a test device and exercise at least:

- clear app storage or uninstall first when testing true first-run persistence;
- use **Settings → Replay introduction** for repeatable, write-free visual
  review when the device already has a Cue;

- normal and reduced-motion journeys;
- Scroll, Sugarlump, and Fog enter/hold/recede sequences;
- rapid repeated Stop taps;
- background and foreground transitions during spin and deceleration;
- fast, slow, failed, and retried plan saves;
- replay and developer-review sessions, which must remain write-free;
- missing-media fallback and muted operation.

Report visual, copy, timing, accessibility, and lifecycle findings on the draft
pull request. Do not merge the integration PR until the founder flow review is
complete.
