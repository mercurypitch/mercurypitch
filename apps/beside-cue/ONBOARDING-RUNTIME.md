# Cinematic onboarding runtime

Status: **v0.7 picture plus the additive v0.8 eye-only H08 close are approved
and packaged; V1 product/runtime contract 0.4.0 is wired as media revision
v0.8; interactive device validation is pending.**
The app architecture must not be
described as release-ready until the automated gates and the Android/iOS
device checks below pass.

## Approved picture truth

The old 624-frame / 26-second value was a planning estimate. The approved
linear picture is exactly `746` frames at `24 fps` (`31.083333 s`) and must not
be trimmed to match that estimate.

The eight storyboard beats use seven picture assets because H01 and H02 share
one uninterrupted clip:

| Beat                        | Inclusive source frames | Frames | App presentation                                           |
| --------------------------- | ----------------------: | -----: | ---------------------------------------------------------- |
| H01 entrance + H02 greeting |                  `1-96` |     96 | Moving clip; H02 is a logical cue at local frame 48.       |
| H03 table reveal            |                `97-192` |     96 | Moving clip.                                               |
| H04 Scroll arrival          |               `193-288` |     96 | Moving clip, then a short automatic Pull introduction.     |
| H05 side choice             |               `289-481` |    193 | Moving clip, then a real Side B choice on the final plate. |
| H06 press and play          |               `482-578` |     97 | Moving clip, then `Stop record` saves the real plan.       |
| H07 stopped acknowledgement |               `579-674` |     96 | Moving clip, then a real reminder-or-not-now choice.       |
| H08 quiet close             |               `675-746` |     72 | Eye-only moving clip beneath the native closing BrandMark. |

H07 is the user-approved deterministic stopped-player take. Its authored
motion is confined to Corky's eye matte, while the player, record, tonearm,
camera, brow/forehead holdout, and pixels outside the matte remain fixed. Its
last 24 frames form the stable seam into H08.

H08 is the approved deterministic paired-blink close. It preserves the player,
record, tonearm, camera, Corky's body and brow/forehead holdout exactly; only
the declared eye/eyelid mattes move. Its opening 13 and final 37 frames are the
exact H07 final-authority plate, preserving both the incoming seam and the
quiet title hold.

## Runtime shape

Contract `0.4.0` expands the linear picture into 11 ordered runtime states:

- 7 moving automatic states play once and advance only from the matching
  segment and playback-attempt callback. A late callback from an earlier clip
  cannot advance the current state.
- 3 native interaction holds wait indefinitely for a real Side B choice,
  plan confirmation, and reminder choice. They never advance on a timer and
  their wait time is not part of the 31.083333-second picture duration.
- 1 automatic native overlay uses a stable plate instead of fake repeated-frame
  video: the short H04 Pull introduction.
- The H04 introduction pauses the authored picture/audio clock. The moving H08
  clip advances its final 72-frame source slice while the native closing
  BrandMark remains overlaid by segment identity.
- Normal moving states advance on correlated `MEDIA_ENDED`; reduced-motion
  states use authored stable stills and correlated dwell completion instead.

The fixed V1 domain choice is Pull id `scrolling`, visible Pull text
`Endless scrolling`, and familiar Side A `Keep scrolling`. The Scroll is the
character that represents that Pull; it is not a Cue. A Cue is the later
signal or reminder that presents the saved Side A/Side B plan.

Rendered pixels provide character and environment picture only. Captions,
Side B choice, plan confirmation, reminder selection, status, and recovery
controls remain native DOM UI owned by the app. The first production pass does
not expose shot counts, persistent Pause, or Skip chrome. It keeps only the
small mute/unmute control plus the text equivalent. Explicit scene navigation
is available only in review builds and must never persist product choices.

## Packaged media boundary

The unchanged picture package remains under `public/onboarding/corky-v0.7/`.
The approved additive H08 clip lives under
`public/onboarding/corky-v0.8/picture/`; active runtime/media mapping
`CORKY_ONBOARDING_MEDIA_V0_8` versions the product contract without relabeling
the v0.7 bytes. The package contains only delivery media:

- 7 silent, one-shot H.264/yuv420p portrait clips: the unchanged v0.7 H01/H02
  through H07 files plus the additive 72-frame v0.8 H08 eye-only close;
- 12 WebP plates: poster and reduced-motion states for H01/H02 through H07;
  H08 deliberately reuses H07's exact final-authority still so there is no
  independently encoded cut;
- 1 continuous 746-frame AAC review mix; and
- revision-local `SHA256SUMS` files for byte provenance.

`CORKY_ONBOARDING_MEDIA_V0_8` maps all 11 states to those shared picture
assets. The strict manifest guard rejects an incorrect contract version, a
malformed source SHA-256, missing or extra states, a state with the wrong
media kind, empty descriptions, unexpected fields, and paths outside packaged
`onboarding/` assets. A static integrity test pins the default manifest to the
actual timeline bytes and all 20 referenced media hashes. The H08 integrity
test also parses its ISO BMFF sample tables and pins H.264 `avc1.64001f`,
`720x1280`, `72` frames at `24 fps`, and a three-second duration. Moving files never
loop.

The source-authoring authority remains in dotfiles at
`besidecue/assets/onboarding-video-edit-v0_1/`, including the Blender project,
selected inputs, prompts, lossless proofs, diagnostics, source manifests, and
`exports/app-source-v0_2/`. Do not copy `.blend` files, rigs, frame sequences,
lossless intermediates, generated-source audio, or workstation paths into the
app. App delivery does not make generated-shot anatomy a Corky model
authority.

## Audio prototype

The first interactive architecture uses the continuous review mix through Web
Audio, not a second `<audio>` media element. Each advancing picture state
starts its exact slice of the 746-frame source clock; the H04 Pull introduction
and three interaction holds pause it, and the next advancing state resumes from
the next authored frame. Per-source gain envelopes soften starts and stops.

This `pause_with_picture` policy is intentionally marked
`prototype_requires_device_validation`. It preserves authored cue alignment,
but it is not yet evidence that pauses are inaudible on phone speakers,
Bluetooth routes, WebView background/resume, interruptions, or repeated
pause/retry cycles. If those checks expose seams, replace the continuous score
with hold-safe beds and transition stingers; do not hide the problem by
letting the fixed linear mix drift freely.

## Accessibility, failure, and persistence boundary

- The exact opening caption/dialogue is `Hi there, I am Corky.` Captions and
  interaction instructions stay readable as native text and are not baked
  into video.
- Reduced motion selects complete authored stills, removes optional reflected
  Cue motion, and uses finite authored dwells only for automatic states. The
  three interaction states remain indefinite.
- Side B and reminder interactions require tap/keyboard alternatives and
  semantic labels. Controls need 48 dp targets, portrait safe areas, a
  landscape fallback, and usable reflow at 200% text.
- A decode/playback failure retries once automatically, then falls through the
  reduced still, poster, and last-known-good/native brand surface. One bad
  image must never strand the person behind a raw decoder message. Attempt and
  segment correlation still prevent stale callbacks from crossing a boundary.
- `Stop record` is the guarded commit boundary. It creates or atomically
  replaces one real saved plan using the fixed Pull and selected Side B. The
  reminder step calls the existing scheduler, while `Not now` creates no rule.
  Completion goes directly to Home; it never opens the old Choose Pull/Choose
  Side B setup screens.
- First-run completion writes the revision preference. A matching preference
  prevents the film from being forced again; an existing stored plan continues
  directly to Home. Denied or corrupt local storage must not block the app.
- `Watch Corky's introduction again` is a rehearsal that preserves plan,
  history, and reminder and suppresses all domain writes. `Change this plan`
  replaces only after confirmation. `Reset all local data` remains the sole
  destructive reset.
- Sound-independent meaning, an accessible non-persistent pause/escape path,
  screen-reader order, focus behavior, and background/resume all require
  device verification even when unit tests pass.

## Integration and device gate

The v0.7 source Blender project, connected review render, additive
`app-source-v0_2` export, and deterministic v0.8 H08 proof have passed their
independent structural, stream, frame-count, checksum, sample-clock,
continuity, matte-containment, and preservation validators. That proves the
authored media package; it does not prove the app experience.

Before calling `cinematic-first-run` validated or merging it as release-ready:

1. Pass timeline, state-machine, manifest-byte, audio-clock, preference,
   director, app-flow, lint, typecheck, and production-build gates.
2. Verify first run, plan save, reminder set/not-now, relaunch, existing-plan
   bypass, rehearsal, atomic plan replacement, Reset all data, fail-soft media,
   and corrupt/denied-storage paths.
3. Confirm production shows the opaque brand curtain, one sound-on Begin
   gesture, and only mute/unmute chrome. Confirm review navigation appears only
   when `VITE_BESIDE_CUE_ONBOARDING_REVIEW=1` and never persists choices.
4. Test normal and reduced motion with TalkBack/VoiceOver, keyboard or switch
   input, 200% text, no sound, portrait safe areas, and landscape fallback.
5. On Android and iOS hardware, test speaker and Bluetooth audio, rapid
   pause/resume, app background/foreground, interruptions, decode failure, and
   every indefinite hold.
6. Confirm no approved 9:16 picture is cropped, the default hold layout does
   not scroll at normal text size, Home text is not covered by the record art,
   and no visual media element is duplicated on a surface.

Until those checks are recorded, runtime v0.4/media revision v0.8 over the
approved v0.7 picture plus additive H08 motion is the current first app
architecture—not a device-validated onboarding release.
