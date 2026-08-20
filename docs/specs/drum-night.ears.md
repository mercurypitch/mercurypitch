# Drum Night visual pilot — EARS Requirements

Approved requirements for the first production slice of the standalone Drum
Night experience at `/drum-night`.

**Status:** visual pilot.

**Visual authority:** the Pocket Console mock and its Kit Horizon composition
are binding for this slice. Product truth always overrides illustrative mock
state.

EARS keywords: **WHEN** (event), **WHILE** (state), **IF/THEN** (unwanted
behaviour), **WHERE** (optional feature), otherwise ubiquitous ("shall").

## Route and pilot boundary — `DN-ROUTE-*`

- **REQ-DN-ROUTE-001 — Standalone entry:** Drum Night shall use the canonical
  `/drum-night` URL and a standalone Solid/Vite document rather than a new
  main-app hash tab.
- **REQ-DN-ROUTE-002 — Direct document:** The built application shall serve
  the Drum Night document for `/drum-night` and `/drum-night.html`; the clean
  path shall remain canonical.
- **REQ-DN-ROUTE-003 — Pilot indexing:** WHILE Drum Night remains a pilot, its
  document shall declare `noindex, nofollow` and shall stay out of the public
  sitemap.
- **REQ-DN-ROUTE-004 — Independent first paint:** The standalone entry shall
  not statically import the main App shell, App-owned stores, MIDI/GP import,
  sample loading, or protected background infrastructure.
- **REQ-DN-ROUTE-005 — Service-worker identity:** The service worker shall
  treat both Drum Night paths as standalone documents and shall not substitute
  the main App shell.

## Pocket Console composition — `DN-STAGE-*`

- **REQ-DN-STAGE-001 — Room as interface:** The first viewport shall read as
  a prepared drum tracking room, with the kit and pocket guide as its primary
  object rather than a dashboard of equal-weight cards.
- **REQ-DN-STAGE-002 — One musical document:** Pocket, Score, and Kit shall be
  alternate views of one staged phrase. A view change shall retain session,
  tempo, loop, count-in, and transport state.
- **REQ-DN-STAGE-003 — Drum primitives:** The visual language shall encode
  subdivision, kit piece, articulation, velocity, and early/on/late timing;
  it shall not reuse a guitar note highway or piano pitch fall.
- **REQ-DN-STAGE-004 — One transport:** Each responsive composition shall
  expose one primary Play/Pause owner. Opening Coach or the rack drawer shall
  not create a second clock or transport.
- **REQ-DN-STAGE-005 — Contextual depth:** Groove, Kit, Mix, Room, Songs,
  Learn, and Coach depth shall open in one rack drawer or mobile sheet rather
  than compete with the performance surface.
- **REQ-DN-STAGE-006 — Specific recovery:** The visible coach shall pair one
  bounded timing or dynamics observation with one executable recovery action.
- **REQ-DN-STAGE-007 — Semantic implementation:** The production shell shall
  recreate the composition with semantic Solid, HTML, CSS, SVG, and responsive
  image assets; it shall not embed a screenshot, iframe, or exported mock UI.

## Safe first paint and product truth — `DN-TRUTH-*`

- **REQ-DN-TRUTH-001 — Silent entry:** WHEN Drum Night mounts, it shall not
  create or resume an `AudioContext`, fetch or decode samples, request MIDI or
  microphone permission, scan devices, start a timer, or begin playback.
- **REQ-DN-TRUTH-002 — Synthetic preview:** WHILE this visual pilot has no
  measured take, timing marks, velocity, coach evidence, and recovery state
  shall identify themselves as synthetic or illustrative.
- **REQ-DN-TRUTH-003 — Visual transport:** WHEN Play, a pad, or a recovery
  action is activated in this slice, the surface shall describe the outcome as
  a visual preview and shall not imply that sound or analysis ran.
- **REQ-DN-TRUTH-004 — Honest input:** The input surface shall not claim that
  an e-kit, MIDI device, room microphone, or latency calibration is active.
- **REQ-DN-TRUTH-005 — Import boundary:** Songs may preview the planned
  MIDI/Guitar Pro workflow, but shall not claim a file was parsed, mapped,
  persisted, played, or scored until the shared percussion runtime is wired.
- **REQ-DN-TRUTH-006 — No technique inference:** Timing evidence shall not
  claim limb, sticking, grip, or acoustic-kit identity that the available
  input cannot establish.
- **REQ-DN-TRUTH-007 — Room/sound independence:** Changing visual room state
  shall not silently change kit, mix, reverb, or sample selection.

## Artwork — `DN-ROOM-*`

- **REQ-DN-ROOM-001 — Pocket Console default:** The visual pilot shall use the
  original Pocket Console room artwork under `/drum-night/`.
- **REQ-DN-ROOM-002 — Authored responsive sources:** Desktop and phone shall
  use separate landscape and portrait WebP compositions rather than treating
  the portrait stage as a blind crop.
- **REQ-DN-ROOM-003 — Durable contrast:** Musical information and controls
  shall remain legible through authored contrast layers if local image
  brightness changes or the asset fails to decode.
- **REQ-DN-ROOM-004 — Home boundary:** Until `drum` becomes a first-class
  background-catalog surface, the Home destination shall use code-native
  artwork and shall not bypass free/supporter image provenance checks.

## Interaction and accessibility — `DN-A11Y-*`

- **REQ-DN-A11Y-001 — Control names:** Every control shall expose an
  outcome-aligned accessible name and selected/pressed state where relevant.
- **REQ-DN-A11Y-002 — Target size:** Every visible primary control shall
  provide a target of at least 44 by 44 CSS pixels.
- **REQ-DN-A11Y-003 — Visible focus:** Keyboard focus shall remain visibly
  distinguishable across the photographic room and smoked control surfaces.
- **REQ-DN-A11Y-004 — Sheet focus:** WHEN a mobile sheet opens, it shall take
  and contain focus, identify itself as modal, close on Escape or its scrim,
  and restore focus to its opener.
- **REQ-DN-A11Y-005 — Keyboard kit:** WHERE no form field is active, number
  keys 1–6 may trigger the six illustrated kit surfaces and Space may toggle
  visual Play without scrolling the page.
- **REQ-DN-A11Y-006 — Reduced motion:** WHERE reduced motion is requested,
  scanning, pulsing, and hit travel shall stop while selected, timing, and
  transport state remain legible.
- **REQ-DN-A11Y-007 — Non-colour meaning:** Timing, selected, input, and kit
  state shall not depend on colour alone.

## Responsive composition — `DN-RESPONSIVE-*`

- **REQ-DN-RESPONSIVE-001 — Desktop geometry:** Desktop shall keep a narrow
  room rail, compact session bar, full performance stage, bounded coach, and
  bottom console without overlap or page overflow.
- **REQ-DN-RESPONSIVE-002 — Phone composition:** Phone portrait shall replace
  the desktop rail/coach/console with a performance stage, six playable hit
  surfaces, and bottom navigation with one raised Play control.
- **REQ-DN-RESPONSIVE-003 — Carried kit:** The six phone hit surfaces and
  primary Play control shall remain visible and reachable while a sheet is
  open; the complete kit/mapping may remain in contextual depth.
- **REQ-DN-RESPONSIVE-004 — Viewport coverage:** At 320×568, 390×844,
  844×390, 1024×768, and 1440×900 CSS pixels, Drum Night shall have no
  horizontal page overflow and no clipped primary control.
- **REQ-DN-RESPONSIVE-005 — Safe areas:** Fixed phone controls shall clear
  applicable viewport safe-area insets.

## Visual-pilot exclusions

This slice does not include real audio, sample loading, MIDI permission or
device mapping, room-microphone analysis, latency calibration, MIDI/Guitar Pro
import, percussion notation, measured coaching, scoring, persistence, Groove
Mirror generation, premium rooms, a first-class `drum` background surface,
public indexing, or deployment. Those capabilities shall not be implied by
the interface.

## Verification map

| Requirement area           | Minimum evidence                                                                                                                  |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `DN-ROUTE`                 | Direct dev/build route assertions, canonical/noindex/sitemap checks, and standalone service-worker coverage                       |
| `DN-STAGE`, `DN-TRUTH`     | Component tests for shared visual state, preview copy, and silent mount                                                           |
| `DN-ROOM`                  | Asset response and landscape/portrait selection checks plus code-native Home artwork assertion                                    |
| `DN-A11Y`, `DN-RESPONSIVE` | Desktop/phone/compact-landscape browser smoke, keyboard/focus checks, reduced-motion check, target-size and overflow measurements |
