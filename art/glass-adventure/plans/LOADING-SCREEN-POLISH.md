# Loading screen polish

**Status:** Implemented and locally verified for draft PR #807;
physical-device acceptance and fresh PR CI remain open.
**Updated:** 2026-09-20

The Glass Adventure now enters through a branded, fully opaque Merc loading
presentation. It conceals scene construction until required art is installed
and a real game frame has rendered. This document records the implemented
contract and the remaining acceptance work. The broader loader, First Light and
Glassworks Journey checkpoint is in
[LOADER-TUTORIAL-JOURNEY-IMPLEMENTATION.md](./LOADER-TUTORIAL-JOURNEY-IMPLEMENTATION.md).

## Implemented lifecycle

The host exposes four states: `loading-assets`, `awaiting-first-frame`, `ready`
and `error`.

1. On initial entry, required requests begin concurrently behind an opaque
   Merc cover. Gameplay controls, camera gestures, microphone capture,
   narration and the ordinary HUD remain unavailable.
2. Required Merc, material textures, sky, exhibit and architecture bundles
   must load and install. Missing declared platform, decoration, exhibit or
   visual nodes reject readiness rather than revealing procedural proxies as a
   completed scene. The existing authored legacy bundle may replace its
   preferred revision when that catalogued fallback loads completely.
3. After installation, the phase becomes `awaiting-first-frame`. The installed
   scene renders behind the cover. Only a frame rendered at or after the
   original entry deadline can move the lifecycle to `ready`, so an intervening
   resize or orientation change cannot expose a reallocated, unpainted canvas.
4. The initial presentation minimum is 2,000 ms from entry. It does not delay,
   serialize or throttle downloads, decode, installation or rendering. A slow
   load reveals as soon as its first qualifying frame renders after installation.
5. Retry reconstructs the renderer in the same covered mount with a new
   generation identity. It preserves level progress and does not replay the
   initial two-second minimum. Stale callbacks cannot install art or dismiss a
   newer attempt.

The presentation uses ordinary English UI text and a lightweight existing Merc treatment.
Reduced-motion mode keeps the cover stable. No microphone permission, loading
voice line or automatic audio is part of entry.

## Error, leave and recovery behavior

A required asset, decode, installation, renderer or WebGL context failure keeps
the scene covered and presents a user-safe error with **Retry** and **Leave
museum**. Load errors remain separate from microphone errors.

While loading or in error:

- movement, jump and orbit input are ignored and cleared;
- audio, narration and capture cannot start;
- hidden game controls are not mounted or focusable;
- late work from a failed, retried or departed attempt is disposed;
- a WebGL context loss enters the same covered recovery path.

Leaving during pending work returns to the host. Cleanup invalidates the active
generation so a late promise cannot reopen the game.

## Readiness and fallback policy

Readiness describes the playable route, not an animation timer. Required art
includes the assets and authored nodes needed by the loaded level, their
material textures, Merc, enclosure and exhibit installation, and the first
post-install frame. Missing required art is an error.

The procedural sky/environment remains an intentional rendering fallback for
optional HDR/reflection preparation. A preferred bundle may fall back only to
the catalogued authored legacy bundle. Neither case permits missing physical
floors, walls, gates or reachable exhibit art to masquerade as ready.

The game and loading presentation keep separate responsibilities: the renderer
settles required assets, the lifecycle observes the qualifying frame and the UI
keeps the cover opaque until that state is ready.

## Current verification boundary

Focused lifecycle, asset-loader, renderer-construction and malformed-bundle
regressions exist, including late completion, required dependency failure,
context loss, retry and first-frame behavior. Browser coverage exercises a held
load, failure/retry with preserved progress, context loss, leaving while work is
pending and the First Light handoff. Local verification and responsive production-style evidence are recorded in
[the implementation checkpoint](./LOADER-TUTORIAL-JOURNEY-IMPLEMENTATION.md).
This status does not claim a fresh CI result or physical-device acceptance.

Device acceptance must still cover:

- cached, uncached and slow initial entry on representative phone and tablet;
- retry after an actual unavailable/corrupt resource and recovery after context
  loss where the platform permits it;
- orientation and safe-area changes during the two-second cover;
- keyboard, touch, switch/focus and reduced-motion access to Retry and Leave;
- a clean reveal with no proxy, texture, camera or collision flash;
- load time, post-reveal frame pacing, memory, heat and repeated visits.

The loader is shared by the original route, **First Light Gallery** at the stable
save identity `glassworks-chamber/chamber`, and the development-only
`glassworks-journey/journey` route. The journey currently has four required and
four optional held-note encounters. Its eight-pose render proof is a scene
inspection, not a complete gameplay or device-performance result.

## Historical design decisions now resolved

The original plan proposed a two- to three-second brand moment, a fast-ready
alternative and a choice about retry timing. The development implementation
uses the lower bound: a two-second minimum on initial entry, immediate readiness
on a successful retry, and no artificial request delay. It uses honest phase
copy rather than a fabricated percentage.

The original requirements for opaque concealment, real readiness, generation
safe cancellation, reduced motion, Retry/Leave and a small Merc presentation
remain the product intent. Final animation polish and copy can change without
weakening those lifecycle rules.

## Remaining priorities

1. Record the pushed revision and fresh CI result in the canonical handoff.
2. Run the physical-device matrix above.
3. Profile the longer journey's room visibility, LOD, shadows, draw calls,
   triangles, memory and heat before treating the blockout as scalable.
4. Add distinctive room dressing after the visibility budget is understood.
   The current garden has no actual plant dressing.

Coins, grades/stars, badges, recording/replay/share and campaign rewards are not
implemented by this loader work.
