# Living Glass integration trial

Run Beside Cue's development playtest server and open `/glass-game/?layout=living-glass`. This contained route uses one existing crystal support and one Rosebud exhibit. The regular gallery journey is unchanged.

Cross the crystal to see Pearl Current inside its shell. Stand beside the Rosebud, start the voice challenge, then hold your comfortable note. The 2.4-second hold reveals fine cracks, builds a restrained tremor and earns the usual rigid glass break with a short reward release. The exit opens only after that earned break. Cancelling settles the intact vase; saved completion restores the broken state without replaying the release.

## Configuration

| Setting                                                                         | Source                                                                          |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Platform placement, named exhibit response, seed, fullness, intensity and speed | `packages/glass-game/src/content/living-glass-trial.ts`                         |
| Platform palette, authored paths and balanced/high geometry budgets             | `packages/glass-game/src/render/pearl-current-config.ts`                        |
| Rosebud source/display height and semantic asset names                          | `packages/glass-game/src/content/resonance-rosebud-profile.ts`                  |
| Vase presentation preset and imported material units                            | `packages/glass-game/src/render/catalog.ts`                                     |
| Charge glow cap (keeps pink transmission readable)                              | `packages/glass-game/src/render/vessels.ts` (`RESONANCE_SURFACE_STRESS_TUNING`) |
| Crack stages, tremor, release cohesion, palette and accent budgets              | `packages/glass-game/src/render/resonance-release-config.ts`                    |

The inner reward is replaceable presentation. It does not grant an inventory item, coin, achievement or score. Core singing progress owns the charge and release clock; the render owners cannot complete a challenge. Ordinary vases and the existing crystal root study retain their current presentation.

## Asset delivery

The combined `resonance-rosebud-v1` GLB contains the intact `G13_INTACT` root and exactly 20 closed rigid shard roots, `shard_000` through `shard_019`. The reviewed source is 0.45 m high and the game displays it at 0.8 m. Geometry normalization also scales the glass thickness and attenuation distance exactly once; imported gold remains a separate material.

Dense source geometry, packed Blender authoring files, reproducible production recipe and render comparisons remain in the owner's synced creative archive. The game consumes the validated runtime export through its canonical asset inventory.

## Verification

The focused browser regression supplies real A3 PCM to the existing microphone/pitch pipeline. It checks silence, partial-charge cancellation, successful hold, camera recovery and saved broken restore. Renderer tests cover presentation binding, closed-shard delivery, optical units, reduced motion and resource ownership. Browser art captures use the actual game at desktop, tablet and phone sizes. Hidden-workspace captures establish functional rendering and appearance; sustained native-device performance remains an owner device check.

The delivered intact shell has 96,736 triangles and the 20 closed shards total 115,850. The combined GLB is 4,257,288 bytes, with SHA-256 `1cc56be7bf247a4217898a2ea8a3071c76d518eb005efdb264bc6802ba559741`. The [exact Meshopt delivery](../delivery/exact-meshopt-2026-09-30.md) preserves every decoded vertex, index, material and transform from the reviewed runtime export. Shape-preserving delivery retains all 30,791 gold-boundary vertices; measured maximum post-export surface deviation from the dense source remains 0.251 mm.

The final review covered transactional asset replacement, first-construction failure, custom reward failure/disposal, hidden/culled-platform updates and shader precompile visibility. The shared suite passes 1,326 tests; the standalone route and packaging tests pass 21 tests, and the real-PCM browser regression passes. Cross-workspace Beside Cue typechecks, scoped lint/format and the generated module index pass. Physical-device sustained performance remains to be accepted by the owner.
