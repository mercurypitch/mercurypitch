# Beside Cue V2 onboarding preview

V2 remains an opt-in developer preview. Ordinary debug, release, and store
builds continue to use V1 unless `VITE_BESIDE_CUE_V2_ONBOARDING=1` is set at
build time.

Pull requests publish a separate `beside-cue-v2-preview-debug-apk` artifact
for Android hardware review. That artifact is not a release candidate and
must not be promoted to a store build.

## Current picture scope

The public preview pack contains the already-delivered Scroll sequence and its
shared stopped record-player plate. Missing Pull media fails open to native
character art, so every journey remains completable.

The private V2.4 diagnostic reel and its Sugarlump and Fog derivatives are not
copied into this repository. Their source package explicitly withholds app and
public-distribution authority pending rights promotion. A later additive media
pack may replace the native fallbacks after that promotion is recorded.

The record itself is a native deterministic layer over the stopped plate. It
turns rigidly at 30 rpm, keeps one clock mounted across the spin and Stop
scenes, and decelerates from its current angle to the next canonical stopped
orientation. The runtime enters the saved acknowledgement only after both the
visual stop and the correlated persistence result complete.

## Current sound scope

V2 is intentionally silent when no separately cleared audio manifest is
present. The fixed-timeline V1 review mix and the rejected generated platter
clip are not reused: neither can remain correct through V2's user-controlled
holds. Music, dialogue, and Stop Foley can be added as separate lanes after
their distribution records and the integrated timing are approved.

## Android review

Install the PR artifact on a test device and exercise at least:

- normal and reduced-motion journeys;
- rapid repeated Stop taps;
- background and foreground transitions during spin and deceleration;
- fast, slow, failed, and retried plan saves;
- replay and developer-review sessions, which must remain write-free;
- missing-media fallback and muted operation.

Report visual, copy, timing, accessibility, and lifecycle findings on the draft
pull request. Do not merge the integration PR until the founder flow review is
complete.
