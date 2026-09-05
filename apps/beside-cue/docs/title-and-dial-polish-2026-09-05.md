# Opening title and circular reminder gestures

Follow-up to the Spanish/German preview. This is a narrow interaction correction;
the record artwork, media, sound, voice selections and reminder persistence stay
unchanged.

## Why the earlier behaviour failed

The opening uses one HTML brand mark, not two video assets. The automatic move
from brand reveal to the Begin hold removed its animation class. That discarded
the filled final `Cue` rotation and exposed the unrotated base style. Keep the
opening class while the same mark remains on screen, including its departure.
Reduced-motion users keep the existing static presentation.

The earlier dial intentionally gave vertical movement to page scrolling. That
also rejected legitimate circular turns starting at the left or right of either
ring. A gesture's native pan policy is determined before its movement; changing
`touch-action` after deciding to capture the pointer is too late. See the
[Pointer Events direct-manipulation rules](https://www.w3.org/TR/pointerevents3/#determining-supported-direct-manipulation-behavior).

## Default interaction for the next device test

- On a ready record, contact chooses the inner hours or outer minutes ring.
  That ring owns the complete drag in every direction until release/cancel.
- The record is ready when at least **80%** is visible through all clipping
  ancestors and scrolling has been quiet for **180 ms**.
- Less-visible records and contacts begun during scrolling remain page-owned.
  They cannot become dial turns halfway through the same contact.
- Scroll beside the record or start outside it and move across it. There is no
  global page lock, modal adjustment mode, or long-press requirement.
- A small near-rim halo belongs to the minutes ring. The circular hit surface
  does not consume its surrounding square corners.
- **4 px** of initial movement filters hand jitter. Tapping focuses a ring but
  does not commit the displayed draft or round a previously selected time.
- Moving through the centre pauses angular measurement; leaving it rebases the
  angle instead of jumping by half a turn. Hours/minutes never switch mid-drag.
- Release retains the existing five-minute settle and bounded inertia. A pause
  of more than **100 ms** before release, a second touch, cancellation or a
  layout shift prevents a stale inertial fling. Native pinch zoom is allowed
  by the control's touch policy; it is not implemented as a custom gesture.
- Keyboard arrows, layer buttons and the exact-time field remain available.
  The short gesture instructions are updated in English, Spanish and German.

## Tuning choices

These are implementation defaults, not additional user-facing Settings.

| Choice                   | Current default           | Trade-off                                                                                       |
| ------------------------ | ------------------------- | ----------------------------------------------------------------------------------------------- |
| Ownership                | Contact on a ready record | Immediate, natural half/full circles; scroll from outside the disc.                             |
| Visibility               | 80%                       | Lowering to 70% makes partly clipped records easier to turn but increases scroll interception.  |
| Scroll quietness         | 180 ms                    | Shorter feels faster after stopping; longer protects deliberate page scrolling.                 |
| Movement slop            | 4 px                      | Lower responds to lighter movement; higher filters more jitter.                                 |
| Explicit adjustment mode | Not enabled               | A separate “Adjust time / Done” step gives the clearest lock, but adds a step to every use.     |
| Hold to turn             | Not enabled               | Protects incidental scrolling but adds latency and competes with familiar long-press behaviour. |

Start with direct contact ownership. If the iPhone test still finds accidental
turns, adjust the visibility/quietness thresholds before adding a separate mode.

## Evidence and device acceptance

Regression coverage includes the title's computed transform before/after its
state boundary, real mouse turns, trusted Chromium touch half-circles from both
side tangents on both rings, near-rim contact, scrolling across a partially
clipped record, and a page-owned contact held through the quietness threshold.
Unit coverage checks tap/jitter, centre crossing, cancellation, geometry changes,
readiness publication and observer cleanup.

Local verification: 56 dial/math/readiness/copy unit tests and 49 V2 director
tests passed. Eleven title/dial browser tests and four Spanish/German compact
layout tests passed. Changed-file preparation/lint, the Beside Cue/shared
typecheck, and the production Vite build passed; the build retains its
large-chunk warning. The mechanical UI scan reported no findings. The held title
was visually reviewed at desktop and 390 px; the dial at desktop, 390 px, and
320 px with German at 200% text. No physical iOS result is claimed.

Desktop touch emulation is not physical iOS certification. On the next iPhone
build, check:

1. Let `Cue` finish rotating and wait; it must not snap to a different pose.
   Tap Begin and confirm its departure does not reset the logo.
2. Scroll Settings past a partly visible record, then centre it and stop.
3. Turn each ring in both directions, including a vertical start at either side.
4. Start a page scroll beside it and cross over it without changing the time.
5. Tap without moving; the reminder must remain unset if it was unset.
6. Try a second finger, scroll momentum, browser toolbar changes and rotation;
   there must be no stuck capture, sudden time jump or page-wide scroll lock.
7. Repeat the dial check in onboarding and with enlarged text. Verify the exact
   time field remains usable when the record cannot be made mostly visible.
