# Beside Cue V2 onboarding

V2.4 is the product's only first-run onboarding. Debug, release, and store
candidate builds all use the same timeline and media pack; there is no separate
V1/basic build or V2 preview artifact. Pull requests publish one Android
artifact named `beside-cue-debug-apk`.

## Picture and interaction scope

The opening uses the founder-selected Kling shot of Corky beside the record
player, greeting the viewer with “Hi there, I am Corky.” The accepted source is
delivered at its full portrait composition. A deterministic opaque paper wipe
then lands on the exact P01 Corky plate before the authored table reveal, so the
generated pose cannot morph or teleport into the interactive scene.

The remaining V2.4 flow contains the corrected P02 record-player plate and
complete enter, hold, and recede performances for Scroll, Sugarlump, and Fog. A
custom or otherwise unauthored Pull stays on the exact P02 plate; it never falls
back to legacy Corky picture.

The record in the greeting is part of the generated B01 picture. The
interactive platter later in the flow is a separate native deterministic layer
over the stopped plate: it turns rigidly at 30 rpm, keeps one clock across the
spin and Stop scenes, and decelerates from its current angle to the next
canonical stopped orientation. The runtime enters the saved acknowledgement
only after the visual stop and correlated persistence result both complete.

Delivery files are pinned in
`public/onboarding/corky-v2.4/SHA256SUMS`. Source hashes and the deterministic
FFmpeg recipe live under `media-source/onboarding/corky-v2.4/`.

## Sound scope

V2 uses four separated, hash-pinned assets: Corky's caption-bound greeting,
the reviewed finite score stem, table-slide Foley, and platter-stop Foley. The
matching audio from the accepted Kling greeting is extracted into the dialogue
lane while B01 itself is silent, preserving lip timing without adding a second
audio system. The score starts once and continues through the journey without
restarting at interactive holds. The fixed-timeline V1 review mix and rejected
generated platter clip are not used.

## Review controls

`VITE_BESIDE_CUE_ONBOARDING_REVIEW=1` adds explicit scene-review controls to a
local build. These controls only navigate the normal V2 runtime and suppress
all domain writes. They do not select a different onboarding or produce a
different APK.

## Android review

Install `beside-cue-debug-apk` on a test device and exercise at least:

- clear app storage or uninstall first when testing true first-run persistence;
- use **Settings → Replay introduction** for repeatable, write-free visual
  review when the device already has a Cue;
- normal and reduced-motion journeys;
- Corky's greeting, lip-sync, opaque paper handoff, and table reveal;
- Scroll, Sugarlump, and Fog enter, hold, and recede sequences;
- rapid repeated Stop taps;
- background and foreground transitions during spin and deceleration;
- fast, slow, failed, and retried plan saves;
- replay and review sessions, which must remain write-free;
- missing-media fallback and muted operation.

The fast record motion inside the generated greeting remains a known visual
polish item; it does not control the later native platter. Record visual, copy,
timing, accessibility, and lifecycle findings on the draft pull request before
promoting a release build.
