# Cinematic onboarding runtime

Status: **v0.7 picture approved and packaged; runtime contract 0.3.0 wired;
interactive device validation pending.** The app architecture must not be
described as release-ready until the automated gates and the Android/iOS
device checks below pass.

## Approved picture truth

The old 624-frame / 26-second value was a planning estimate. The approved
linear picture is exactly `746` frames at `24 fps` (`31.083333 s`) and must not
be trimmed to match that estimate.

The eight storyboard beats use seven picture assets because H01 and H02 share
one uninterrupted clip:

| Beat                        | Inclusive source frames | Frames | App presentation                                                  |
| --------------------------- | ----------------------: | -----: | ----------------------------------------------------------------- |
| H01 entrance + H02 greeting |                  `1-96` |     96 | Moving clip; H02 is a logical cue at local frame 48.              |
| H03 table reveal            |                `97-192` |     96 | Moving clip.                                                      |
| H04 Scroll arrival          |               `193-288` |     96 | Moving clip, then a native hold on its final plate.               |
| H05 sort sides              |               `289-481` |    193 | Moving clip, then a native sorting hold.                          |
| H06 press and play          |               `482-578` |     97 | Moving clip, then a native spin/stop hold.                        |
| H07 stopped acknowledgement |               `579-674` |     96 | Moving clip, then native reminder states.                         |
| H08 quiet close             |               `675-746` |     72 | Stable plate with native closing motion; no fabricated H08 video. |

H07 is the user-approved deterministic stopped-player take. Its authored
motion is confined to Corky's eye matte, while the player, record, tonearm,
camera, brow/forehead holdout, and pixels outside the matte remain fixed. Its
last 24 frames form the stable seam into H08.

## Runtime shape

Contract `0.3.0` expands the linear picture into 13 ordered runtime states:

- 6 moving automatic states play once and advance only from the matching
  segment and playback-attempt callback. A late callback from an earlier clip
  cannot advance the current state.
- 4 native interaction holds wait indefinitely for Scroll confirmation,
  six-card sorting, record stop, and reminder choice. They never advance on a
  timer, all retain an explicit skip path, and their wait time is not part of
  the 31.083333-second picture duration.
- 3 automatic native overlays use stable plates instead of fake repeated-frame
  video: reminder reveal (48 frames), reminder confirmation (24 frames), and
  the H08 title close (72 frames).
- The two S07 overlays pause the authored picture/audio clock. The H08 title
  close advances its final 72-frame source slice over the stable H08 plate.
- Normal moving states advance on correlated `MEDIA_ENDED`; reduced-motion
  states use authored stable stills and correlated dwell completion instead.

Rendered pixels provide character and environment picture only. Captions,
sorting, spin/stop, reminder selection, status, retry, pause, and dismiss
controls remain native DOM UI owned by the app.

## Packaged media boundary

The app package lives under `public/onboarding/corky-v0.7/` and contains only
delivery media:

- 6 silent, one-shot H.264/yuv420p portrait clips for H01/H02 through H07;
- 12 WebP plates: poster and reduced-motion states for H01/H02 through H07;
  H08 deliberately reuses H07's exact final-authority still so there is no
  independently encoded cut;
- 1 continuous 746-frame AAC review mix; and
- `SHA256SUMS` for byte provenance.

`CORKY_ONBOARDING_MEDIA_V0_7` maps all 13 states to those shared picture
assets. The strict manifest guard rejects an incorrect contract version, a
malformed source SHA-256, missing or extra states, a state with the wrong
media kind, empty descriptions, unexpected fields, and paths outside packaged
`onboarding/` assets. A static integrity test pins the default manifest to the
actual timeline bytes and all 19 referenced media hashes. Moving files never
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
starts its exact slice of the 746-frame source clock; holds and the two S07
non-picture overlays pause it, and the next advancing state resumes from the
next authored frame. Per-source gain envelopes soften starts and stops.

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
  four interaction states remain indefinite.
- Interactions require tap/keyboard alternatives and semantic labels; sorting
  cannot depend on drag precision. Controls need 48 dp targets, portrait safe
  areas, a landscape fallback, and usable reflow at 200% text.
- A decode/playback failure preserves the current poster and offers retry,
  continue to the next scene, or dismiss. Retrying increments the playback
  attempt so stale media events cannot cross the state boundary.
- Finishing or dismissing writes a revision-scoped local preference outside
  the cue-domain schema. A matching preference prevents the film from being
  forced again; an existing stored cue continues directly to Home. Denied or
  corrupt local storage must not block the app, and Reset all data clears the
  preference with the cue data.
- Sound-independent meaning, persistent pause/resume and dismiss controls,
  screen-reader order, focus behavior, and background/resume all require
  device verification even when unit tests pass.

## Integration and device gate

The v0.7 source Blender project, connected review render, and additive
`app-source-v0_2` export have passed their independent structural, stream,
frame-count, checksum, sample-clock, continuity, and preservation validators.
That proves the authored media package; it does not prove the app experience.

Before calling `cinematic-first-run` validated or merging it as release-ready:

1. Pass timeline, state-machine, manifest-byte, audio-clock, preference,
   director, app-flow, lint, typecheck, and production-build gates.
2. Verify first run, finish, dismiss, relaunch, existing-cue bypass, Reset all
   data, retry, continue-to-next-scene, and corrupt/denied-storage paths.
3. Test normal and reduced motion with TalkBack/VoiceOver, keyboard or switch
   input, 200% text, no sound, portrait safe areas, and landscape fallback.
4. On Android and iOS hardware, test speaker and Bluetooth audio, rapid
   pause/resume, app background/foreground, interruptions, decode failure, and
   every indefinite hold.
5. Confirm no approved 9:16 picture is cropped and no visual media element is
   duplicated on a surface.

Until those checks are recorded, v0.7 is the approved first app architecture
and media authority—not a device-validated onboarding release.
