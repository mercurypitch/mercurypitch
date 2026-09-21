# Animated Merc loading threshold

This revision uses the shipped game character and its custom five-bone rig.
The left arch presents a welcome wave, relaxed listening pose, and one short
laugh if preparation advances during a longer load. It is silent and never
delays the level. Reduced motion uses a still listening pose. The existing
artwork is retained for the first instant and for an optional-preview failure.

The right side keeps the gallery name, guidance, Retry and Leave museum. A
contrasting track fills from left to right as unique logical assets finish
installation. There are no visible percentage numbers or elapsed-time progress.
Preferred and fallback models share a unit; retries reset the attempt and ignore
late callbacks. The full track and “Lighting the exhibits” phase still wait for
the existing initial presentation deadline and successful game frame.

The preview owns a temporary WebGL context, animation mixer, procedural studio
environment and capped-resolution canvas. It pauses when hidden and releases
its resources when the cover leaves. No microphone or gameplay audio starts
under the cover.

## Evidence

- Blender source and optimized/runtime GLBs remain in the established Merc
  asset paths under `apps/beside-cue/`.
- `proofs/` records the authored welcome/laugh at front and three-quarter views.
- `capture-runtime.mjs` holds one required surface map in the compiled local
  app, leaving the actual 3D preview rendering. It captures desktop, tablet,
  portrait phone, short landscape, reduced motion and error states.
- `runtime/manifest.json` records real layout, track state and browser errors.
- Focused package tests cover task identity, installation order, retries,
  disposal and the actual GLB contract. The loading browser spec verifies
  blocked input, held progress, recoverable failure and safe entry/leave.

Browser captures use desktop Chromium with SwiftShader and touch emulation.
They establish rendered appearance and behavior, not physical-device memory,
thermal performance or mobile driver compatibility.

## Owner test

1. Enter First Light or Glassworks from the floating museum. Merc should wave
   in the arch; the track should fill visibly before the game appears.
2. Enter a longer gallery with a cold cache. The track should pause where work
   is still pending, without creeping forward on a timer.
3. Leave and enter several times, including on the tablet. Confirm the game
   stays responsive and the loader never leaves a second visible canvas behind.
4. With system reduced motion enabled, confirm the mascot stays calm and still.

Physical-device acceptance remains open until the owner tests it.
