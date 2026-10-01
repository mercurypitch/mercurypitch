# Gallery singing and camera polish

This pass addresses the owner's first rollout playtest without adding another
level. It remains part of the Living Glass rollout PR.

## Singing and approach

Portrait melody encounters and optional encores share a difficulty policy.
The first visit allows 1.2 seconds of wrong voiced pitch and 0.8 seconds of
silence to find the next note. Two stars allow 0.75 and 0.4 seconds;
three stars allow 0.45 and 0.4 seconds. These are independent limits, not
extra time credited toward singing. Progress freezes during correction and
the next anchor still requires fresh, correct pitch evidence.

The optional pitch guide shows the detected note, target and signed distance
in cents. The existing ribbon target and live-pitch markers stay visible.
Encore difficulty follows the completed visit, or the earned tier when opened
from the collection. Lesson and effective-policy identity protect saved
attempts and replay clears from incompatible content changes.

Scored **Hear Merc** already uses the accepted D2 v6 set of 88 approved
melody/key/pace variants. This pass removes two unused v5 aliases; it does not
replace those accepted performances. The newer v7 audition remains unscored
because its conversions did not pass the prior judge/lyric acceptance. An
unsupported exact key/pace or failed recording load uses the instrumental
compiled-contour guide.

Automatic singing now uses contact with the rendered approach ring rather
than the wider manual interaction reach. The ring's 0.46-metre outer radius
plus Merc's 0.16-metre body radius gives a 0.62-metre first-contact boundary.
Manual Sing retains its 1.1-metre reach. Grounding, floor height and encounter
eligibility still apply. Cancelling consumes the current contact; physically
leaving and re-entering the ring allows another automatic attempt.

## Camera and results

Enclosed third-person framing retains a readable boom distance when physical
clearance permits, lowers the compressed view toward eye level, and starts
following sustained diagonal keyboard movement. Collision remains authoritative;
the camera does not automatically switch to first person. Open-platform
movement and manual orbit retain their existing control model. WASD moves
Merc; held arrow keys turn or tilt the camera continuously, scaled by look
sensitivity. R recentres the view. Editable fields and covered gameplay retain
their own keyboard handling.

The subsequent real-input hallway reproduction found two interacting errors:
manual orbit could retain ownership after movement, and wall sliding could
leave Merc facing the requested diagonal instead of the surviving movement.
Movement now preserves a stable world-space input basis while the camera can
follow a sustained corridor slide. Merc faces his actual post-collision
velocity; stopping against a wall preserves his last heading. Camera angular
response catches up through bounded slices on slow frames. The full corridor
replay also found a geometry defect: two fillers used window depth instead
of screen depth, projecting 7.74 cm into the north passage and catching Merc
during a held diagonal wall slide. Matching their rendered and collision
depth to the screen removes that ledge without weakening collision checks.
The verification route keeps the diagonal input held beyond this seam,
including entry after a front-facing orbit.

An additional edge case occurred when Merc's body could slide closer to a
wall than the camera's clearance radius allowed. A parallel camera boom then
collapsed to its look-at target despite having the correct heading. Enclosed
framing now searches a small, validated sideways boom offset when the normal
reach falls below 0.72 m. It retains a safe side and eases back when the normal
reach clears 1.6 m; room bounds, closed gates and actual occluders still apply.
The offset never changes Merc's movement basis. Bounds reject impossible
candidates before mesh queries, and unchanged failed searches have a 0.25 s
retry interval. Regression tests check actual camera clearance and Merc's
screen projection throughout the outer-wall slide, rather than yaw alone.

The results card presents accuracy, discoveries and portrait as three compact
collection tiles. Medals are up to 84 pixels on phones, 76 in short landscape
and 94 on wider layouts, constrained to the available tile width;
the portrait is 60 or 80 pixels wide. Portrait hover and keyboard focus lift
the artwork subtly; reduced-motion mode removes that movement. The next-level
and next-star actions remain separate and prominent.

## Mobile rendering and input follow-up

The loading preview uses a brighter lower-hemisphere studio reflection so
Merc's silver body remains readable. It checks the floating-point render
capabilities it needs and verifies its first drawn frame before hiding the
fallback artwork. A failed optional preview cannot claim readiness or block
the main gallery. Linux WebKit pixel captures verify both the normal silver
preview and a deliberately unsupported-loader fallback; these are not
physical iPhone results.

Gallery loading now draws resident hidden effects once before play, using
the gameplay framebuffer. Shader compilation alone had left first-use work
for the first shatter: the software-rendered phone probe recorded a 3.2-second
long task. The corrected probe found no shader compilation, program inspection
or initial buffer upload during the first shatter after readiness.

During the input-locked shatter, one simulation frame can advance at most
0.1 seconds of its shared presentation clock. The shard motion, camera hold
and movement unlock therefore stay synchronized through a delayed frame.
Ordinary movement and vocal judging retain their existing time sources.

Auto on a mobile device and Balanced can now reduce the render resolution
and shadow-update frequency after sustained slow foreground frames. The
governor requires a complete 24-frame window lasting at least one second,
with at least six frames slower than 24 fps. It caps each interval's contribution
at 0.25 seconds, so one hitch is insufficient. Loading, hidden tabs, pauses
and challenge cinematics cannot supply this evidence. The change is one-way
for that setting; choosing High opts out. It preserves geometry, textures
and material settings, caps DPR at 1.0 and updates shadows every fourth frame.

The software-GPU workload probe confirmed a 487×1055 canvas becoming
390×844, with one shadow update followed by three reused frames. This is a
verified workload reduction, not a prediction of physical-phone frame rates.
Renderer metrics expose the effective DPR, shadow interval and adaptation
state for subsequent device diagnosis. Merc's visual turn also processes up
to 0.25 seconds of elapsed time in stable 0.05-second slices, instead of
discarding slow-frame time and lagging behind his movement.

Native selection defaults are cancelled only on joystick and Jump controls,
including their descendants. The viewport, dialogs and tuning inputs retain
their normal pointer ownership. Chromium exercises long presses and both
three-contact movement/look/jump orders; Linux WebKit verifies native taps
and actual slider changes. Physical iOS callouts remain a device check.

The active joystick also stays inside a stable DOM boundary while nearby
Sing prompts and guidance change. Previously, sibling reconciliation briefly
removed and reinserted the same controls node, cancelling native capture even
though the component never unmounted. The fix preserves the existing release
behavior on pause, tutorial, completion and disabled input.

## Playtest

1. Approach a Journey singing circle slowly. Check that automatic singing
   starts at contact, while manual Sing remains available farther away.
   Cancel, step away, then return.
2. Walk the narrow Journey turn using forward and right together. Check the
   lower third-person framing, corner follow and manual mouse/touch orbit.
   Repeat after orbiting in front of Merc. Try WASD plus held arrow keys,
   release them, then open Tune and confirm arrows operate focused controls.
3. During a first-visit melody, pause briefly or sing a neighboring note,
   then recover. Progress should wait for the correct pitch. Compare a
   harder replay and toggle the pitch guide.
4. Open the optional encore and hear Merc at a supported key and pace.
   Compare its correction behavior with the in-world melody.
5. Inspect results on a phone, tablet and desktop; open the portrait by
   touch, mouse and keyboard, then return to the same focused control.
6. Hold and drag the phone joystick, add a second finger to orbit, then
   release either contact and reacquire it. Long presses on the joystick or
   Jump must not select the page. Open Tune and confirm its ordinary controls
   still respond.
7. Compare Auto/Balanced and High during an uninterrupted walk on the same
   device, then break the first glass. Watch the complete shatter rather
   than only its start and end. On a supported loading preview Merc should
   look silver; an unavailable optional preview should retain artwork and
   let the level load.

Regression and browser results belong to the exact PR head. Browser viewport
proof does not establish physical-device frame pacing, touch feel or singing
comfort; those remain owner acceptance checks.
