# Android tablet camera and portrait audit

Audit date: 2026-09-24. The reported sequence was holding `W`, adding or
releasing `A`/`D`, then seeing the view swing sideways and settle again. The
same playtest reported an inverted final Journey portrait whose artwork stayed
intact while glass appeared to break behind it.

## Camera finding

The sideways swing and post-input settling are deterministic current behavior,
not an Android-only recenter call:

- `ui/input.ts:99-105` marks every normalized keyboard direction change,
  including adding or releasing one key in a held chord.
- `ui/useAdventure.ts:545-552` responds by rebasing movement to the current
  camera view before reading the next movement frame.
- `core/movement.ts:240-263` derives Merc's facing from smoothed physical
  velocity.
- `render/camera.ts:640-677` continually commits that facing while input and
  physical motion are active, then retains the committed heading until the
  camera settles.
- `render/camera.test.ts:456-483` explicitly requires a short side-step heading
  to finish after movement stops. This behavior came from commit `37f87fe0`
  (`fix(glass-game): finish camera turns after short movement`).
- The explicit `recenter()` path is only `render/camera.ts:561-568`; keyboard
  chord changes do not call it.

This explains the report: adding a lateral key rotates the committed heading
toward Merc's diagonal velocity. Releasing it while `W` remains held rebases
forward movement to the camera's then-current yaw and starts another heading
commit. Follow smoothness changes how quickly this occurs but cannot remove the
second turn or the retained post-input settling.

Recommended product behavior is **forward-biased follow**: while forward or
back movement is held, treat the lateral component as strafe and keep camera
yaw stable. Continue centering the camera target on Merc. Permit automatic yaw
follow for a sustained pure lateral direction only after a short dwell. This
matches the UI's “WASD move” promise and removes the surprising `W` + `A`/`D`
camera correction without reintroducing the self-reinforcing circle that the
stable movement basis prevents.

A smaller alternative is a 250-350 ms follow-intent dwell reset by every
keyboard chord change. `rebaseMovement()` already clears `committedHeading`, so
it is the natural place to restart that dwell. This filters quick lateral taps
but long diagonals still rotate the view. Simply clearing the heading only when
all movement ends does not solve releasing `A` while `W` remains held.

Any camera change should add a focused sequence for `W down -> A/D down -> A/D
up while W remains down` and retain the existing sustained-strafe and
wall-contact tests. Device video would still help distinguish this deterministic
yaw behavior from enclosure-distance recovery, but no enclosure code is needed
to reproduce the reported turn.

## Portrait orientation finding and fix

The source `apps/beside-cue/public/games/adventure-v5/painting-portrait.webp` is
upright and has no orientation transform. Runtime textures are configured with
`flipY = false` for imported glTF UVs in `render/texture-recipe.ts:26-38`. The
final portrait's persistent image, however, is a native Three.js
`PlaneGeometry` created in `render/vessels.ts:153-168`; that geometry needs the
regular vertically flipped image upload.

`createAssetKit` waits for the glTF bundles, clones the loaded texture once per
vessel, and disposes the shared source. For persistent portraits, `setKit()`
replaces the imported `legend_portrait` material with glass, while
`setPortrait()` binds the owned clone only to the separate plane and returns
before the imported-material loop. The fix therefore sets `flipY = true` and
`needsUpdate = true` only for that plane-owned clone. Imported glTF faces,
framed wall art, other vessels, and source files retain `flipY = false`.

The focused regression first failed with `expected false to be true`, then
passed with all three vessel tests. It also asserts that the nonpersistent glTF
portrait path stays `flipY = false`. A bounded SwiftShader render loaded the
actual portrait checkpoint with raster calls suppressed during loading and
restored for one frame. The inspected tablet capture is
[`portrait-tablet.png`](portrait-tablet.png); the muse's head and halo are at
the top and match the source artwork.

Reproduce the visual proof on any free adjacent port pair:

```bash
BESIDE_CUE_E2E_PORT=5614 GLASS_PORTRAIT_RENDER_PROOF=1 pnpm --dir apps/beside-cue exec playwright test e2e/glass-adventure-portrait-orientation.e2e.ts --project=chromium-adventure --workers=1 --output=test-results-portrait-orientation
```

The proof is opt-in so routine CI does not spend full-resolution SwiftShader
frames on a human-inspected artifact.

## Portrait fracture finding and options

The difficult-to-read fracture is also confirmed by the render contract:

- `render/catalog.ts:25-31` defines `persistentPortrait` as a separate art plane
  that survives protective glazing.
- `render/vessels.ts:275-304` replaces the authored portrait material with
  glass for persistent recipes, binds the image only to the separate plane, and
  leaves that plane visible through the entire lifecycle.
- `render/vessels.ts:306-360` hides the intact glass after 0.1 seconds and flies
  glass-only shards for 2.2 seconds. The portrait never fractures or fades.
- `render/vessels.test.ts` explicitly locks “persistent artwork survives its
  breakable glazing.”
- The plane is at local `z = 0.032`; the authored slab face is at about
  `z = 0.0225`, so the intact image is in front of and visually masks much of
  the glazing event.
- `legend-slab.glb` already contains a `legend_portrait` primitive on the intact
  slab and all 16 authored shards. No new crop, generated art, or UV rewrite is
  needed for picture-bearing shards.

The recommended finale treatment is **intact image -> visible crack beat ->
picture-bearing authored shards -> collected portrait reward**, with the frame
remaining. Add an explicit recipe-level mode and apply it to
`portrait-awakened-muse`; keep `archive-glazing-v5` in the current protective
glazing mode. This preserves every source pixel and makes the event legible.

Other bounded choices are:

1. Keep the image intact, move it behind the authored glass face, and briefly
   dim or flash it while cracks and shards pass in front. This is the smallest
   visual change, but the portrait still feels unaffected.
2. Hide the image during the shard flight and fade it back as the collected
   reward. The break reads clearly, though the disappearance can look like a
   texture pop.
3. Fly picture-bearing shards and reassemble them. This retains the in-world
   image but adds motion, save/restore, and reduced-motion scope.

The fracture design remains unchanged in this work pending the product choice.
