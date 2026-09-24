# Camera comfort and varied Cloudway routes

Status: owner-requested backlog, 23 September 2026. The current museum mesh
repair remains first. The owner accepted the tighter fog; retain its 9–14m
radial reveal. No additional level is authorized until the current trial is
visually ready. These are proposed trials, not shipped controls or new levels.

## C1 — soften turns without changing jump reach

The owner reports abrupt Merc rotation and camera motion on left/right input
across galleries and Cloudway. Earlier fixes established heading convergence,
zoom independence and input-reference ownership. Preserve those properties.
Use the smooth feel of a 3D platformer as a reference; do not claim to reproduce
Mario's implementation or change camera-relative movement into tank steering.

- [ ] Capture keyboard A/D taps, W→W+A→A transitions, 180-degree reversal and
      continuous touch-stick arcs. Measure desired travel heading, visible Merc
      heading and camera yaw separately at near/default/far zoom.
- [ ] Identify whether the sudden step comes from input/reference rebasing,
      physical velocity, visual facing or camera follow. Record an actual input
      trace before changing constants.
- [ ] Trial bounded, frame-independent angular acceleration/deceleration or
      critically damped heading response with a turn-rate limit. Compare a gentle
      and a responsive preset. Do not stack delays that make landing correction
      feel disconnected. Keep position acceleration and jump physics unchanged
      unless a separate test demonstrates a problem.
- [ ] Keep manual orbit immediate and authoritative; resume follow smoothly
      after movement, without snapping or feeding camera rotation back into a
      held movement vector. Preserve wall avoidance and challenge framing.
- [ ] Expose a development tuning panel with independent **Look sensitivity**
      (mouse/touch orbit gain) and **Follow smoothness** (automatic chase response).
      Keyboard input is digital: expose turn response, not a misleading mouse
      sensitivity multiplier on A/D. Consider separate Merc turn response only
      if two controls cannot produce coherent movement and view.
- [ ] Provide reset-to-default, bounded ranges, local persistence and a copyable
      preset for owner feedback. Keep settings in the shared package; both hosts
      use the same policy. Decide final public settings after the device audition.
- [ ] Preserve reduced-motion behavior, recenter, pause/resume, encounter return
      and idle manual view. Check 30/60/120 Hz plus a delayed frame.
- [ ] Verify with real mouse/keyboard and touch browser input, followed by owner
      tablet play. No automatic circles, oscillation, zoom-dependent turn speed,
      new drift at rest or loss of next-landing visibility.

Deliverable: one comparable short recording per preset on the same current
route, with saved tuning values. Choose the default through playtesting rather
than declaring smoothness from unit tests alone.

## C2 — route-shape audition using existing components

Do this after C1 and the current art repair. Prototype alternate shapes of the
same trial in development before commissioning extra worlds or unlocking more
levels. Preserve authored platform IDs/checkpoints during experiments, or use
an explicit separate development save namespace if topology changes.

| Candidate  | Layout and purpose                                                                | Main risk to test                                                  |
| ---------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Crescent   | Broad arc around a planted floating landmark; direction changes accumulate gently | Inside curve must not hide a landing behind scenery                |
| Ribbon     | Two broad S bends, with safe viewing/rest pads between                            | Follow camera must reverse smoothly rather than swing at each step |
| Terrace    | Short left/right offset sections linked by generous straight landings             | Avoid constant corrective taps and rhythm that feels repetitive    |
| Rising bow | A gentle parabolic plan-view curve with modest authored height changes            | Foreshortening and vertical camera motion must preserve depth cues |

The curve is an authoring guide, not an automatically accepted level. Place
actual landing surfaces, gap widths, platform motion and singing stations by
hand. Use arc-length spacing so a bend does not silently widen jumps. Singing
stays on stable resting platforms; do not combine a new blind corner with a
cracking surface or moving-raft tutorial.

- [ ] Sketch top-down candidates against measured jump reach and the accepted
      fog envelope. Mark safe rests, landmarks, optional detours and sightlines.
- [ ] Author reusable route segments with incoming/outgoing direction, landing
      footprints, elevation, checkpoint and reveal anchors. Keep content data
      separate from the collision, movement and camera implementations.
- [ ] Check next and next-after-next landings from actual approach cameras at
      each supported zoom; the distant finale should remain concealed. Keep the
      accepted fog unchanged unless a specific bend demonstrates a conflict.
- [ ] Test each candidate with ordinary keyboard/touch input, falls, moving
      platforms and saved checkpoints. Include approach from the wrong side.
- [ ] Compare short owner-playable previews of the same length and mechanics.
      Select a shape before expanding the route or adding future mini-games.

## Priority and completion record

1. Current: recover museum silhouettes and finish high-detail game derivatives.
2. Current-route art: planted islands, clean modular foliage and Frost texture seam.
3. C1: camera comfort and development tuning audition across existing levels.
4. C2: non-linear shape audition; no extra released level until current acceptance.

Planning saved in repo and the dotfiles master plan. Implementation boxes remain
open intentionally. Existing controls research is preserved in the dotfiles
`CAMERA-CONTROLS-REVIEW.md` and `STEERING-AND-CROSSINGS.md`.
