# Beside Cue V2 onboarding

V2.5 is the product's only first-run onboarding. Debug, release, and store
candidate builds all use the same timeline and media pack; there is no separate
V1/basic build or V2 preview artifact. Pull requests publish one Android
artifact named `beside-cue-debug-apk`.

## Picture and interaction scope

The opening uses the founder-selected Kling shot of Corky beside the record
player, greeting the viewer with “Hi there, I am Corky.” The accepted source is
delivered at its full portrait composition. A deterministic opaque paper wipe
now lands directly on the exact P02 Corky plate. The normal journey omits the
duplicate B02 entrance, so Corky greets the viewer once without morphing or
teleporting into the interactive scene.

The remaining V2.5 flow contains the corrected P02 record-player plate and
complete enter, hold, and recede performances for Scroll, Sugarlump, and Fog. A
custom or otherwise unauthored Pull stays on the exact P02 plate; it never falls
back to legacy Corky picture.

The record in the greeting is part of the generated B01 picture. Later, the
full four-second Google Flow H06 shot shows Corky pressing the player button,
followed by the approved full four-second standing whole-vinyl spin. When that
finite reviewed spin ends, or when the viewer presses Stop during it, the app
fades to the already-running native platter on the exact P02 plate. That native
layer can spin indefinitely, keeps one clock across the spin and Stop scenes,
and decelerates deterministically from its current angle to the next canonical
stopped orientation. The runtime enters the saved acknowledgement only after
the visual stop and correlated persistence result both complete.

The minimum Stop dwell and the native platter clock begin only when the
standing-spin presentation reaches its correlated first visible frame. Decode
or fallback latency therefore cannot shorten the visible spin interval or move
the native layer ahead beneath the reviewed shot. Foreground-aware safety
clocks fail open to native P02 if the spin never presents or presents without a
terminal media event, so a stalled decoder cannot strand the journey.

The V2.4 base delivery remains pinned in
`public/onboarding/corky-v2.4/SHA256SUMS`. Additive V2.5 media is pinned in
`public/onboarding/corky-v2.5/SHA256SUMS`, with source hashes and provenance
under `media-source/onboarding/corky-v2.5/`. The deterministic V2.4 FFmpeg
recipe remains under `media-source/onboarding/corky-v2.4/`.

## Sound scope

The delivery retains four separated, hash-pinned audio assets: Corky's
caption-bound greeting, the reviewed finite score stem, table-slide Foley, and
platter-stop Foley. The normal V2.5 journey no longer enters B02, so its
table-slide Foley remains available only to the explicit scene-review path.
The matching audio from the accepted Kling greeting is extracted into the
dialogue lane while B01 itself is silent, preserving lip timing without adding
a second audio system. The score starts once and continues through the journey
without restarting at interactive holds. Audio embedded in the generated H06
press and standing-spin sources is excluded. The fixed-timeline V1 review mix
is not used.

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
- Corky's greeting, lip-sync, direct opaque-paper handoff to P02, and omitted
  duplicate B02 entrance;
- Scroll, Sugarlump, and Fog enter, hold, and recede sequences;
- the full H06 press, finite standing spin, and fade to the native P02 platter;
- rapid repeated Stop taps;
- background and foreground transitions during spin and deceleration;
- fast, slow, failed, and retried plan saves;
- replay and review sessions, which must remain write-free;
- missing-media fallback and muted operation.

The fast record motion inside the generated greeting remains a known visual
polish item; it does not control the later reviewed or native platter. Record
visual, copy, timing, accessibility, and lifecycle findings on the draft pull
request before promoting a release build.
