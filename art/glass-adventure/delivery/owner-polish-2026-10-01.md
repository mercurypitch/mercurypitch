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
movement and manual orbit retain their existing control model.

The results card presents accuracy, discoveries and portrait as three compact
collection tiles. Medals are 48 pixels on phones and 72 on wider layouts;
the portrait is 60 or 80 pixels wide. Portrait hover and keyboard focus lift
the artwork subtly; reduced-motion mode removes that movement. The next-level
and next-star actions remain separate and prominent.

## Playtest

1. Approach a Journey singing circle slowly. Check that automatic singing
   starts at contact, while manual Sing remains available farther away.
   Cancel, step away, then return.
2. Walk the narrow Journey turn using forward and right together. Check the
   lower third-person framing, corner follow and manual mouse/touch orbit.
3. During a first-visit melody, pause briefly or sing a neighboring note,
   then recover. Progress should wait for the correct pitch. Compare a
   harder replay and toggle the pitch guide.
4. Open the optional encore and hear Merc at a supported key and pace.
   Compare its correction behavior with the in-world melody.
5. Inspect results on a phone, tablet and desktop; open the portrait by
   touch, mouse and keyboard, then return to the same focused control.

Regression and browser results belong to the exact PR head. Browser viewport
proof does not establish physical-device frame pacing, touch feel or singing
comfort; those remain owner acceptance checks.
