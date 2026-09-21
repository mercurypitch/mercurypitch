# Cloudway pilot — The Glass Ribbon

Approved for implementation on 2026-09-21. This supersedes the production gate
in `CLOUDWAY-PLATFORM-TRIALS.md`. Work stays on `feat/glass-museum-level-one`,
PR #807; no merge or release is requested.

## First playable route

An optional outing from the first island, using Merc's existing controls and
voice challenges. Pearl clouds, gold-edged marble, celadon ice and opaline
platforms carry the approved concept into a real 3D scene.

1. Arrival: a generous marble landing, two short skippable instruction cards,
   and a familiar comfortable-note goblet.
2. Frost garden: two icy slabs with bounded sliding and a safe recovery landing.
3. Opaline crossing: one translating raft, obvious docking positions, then a
   static singing perch. Platforms carry Merc using the collision simulation.
4. Crackle ribbon: two warning-and-release tiles, introduced individually.
   Cracks and the rim communicate the deadline without requiring sound.
5. Safe finale: a familiar voice challenge, portrait and shimmering exit.

Target first visit: roughly 2–4 minutes, to be measured during playtesting.
All singing happens on stable ground. No collapse clock runs during permission,
calibration, reference playback, challenge cameras, pause or a hidden tab.
Falls return to a nearby safe checkpoint; already earned discoveries remain.

## Unlock and save meaning

The first landmass currently contains two chapters: First Light and Glassworks
Journey. First Light has no grading policy. For the pilot, complete First Light
and finish Glassworks Journey with three saved pitch stars. The generic rule is
completion for every chapter on the island, plus three saved stars for every
authored graded encounter. Missing chapters or malformed saves never unlock it.

These are the existing pitch-accuracy stars, including legitimately saved older
editions. They are not the proposed replay difficulty stars. Do not silently
change the grading model or label this a hard-mode achievement. Future replay
tiers need the separate versioned evidence migration in
`REPLAY-DIFFICULTY-AND-LEVEL-STARS.md`.

The trial has its own level/save ID, stays outside the main chapter sequence,
and never blocks later galleries. A development-only `?layout=cloudway` route
allows testing without fabricating earned stars. Normal campaign entry must
enforce the unlock, including when an entry callback is invoked directly.

## Variants after the pilot

| Variant                            | Route emphasis                                    | Voice placement                              |
| ---------------------------------- | ------------------------------------------------- | -------------------------------------------- |
| The Glass Ribbon (this build)      | One example of frost, glide and crackle           | Static safe perches, comfortable holds       |
| The Opaline Ferry (follow-up)      | Two staggered rafts and broad docking terraces    | Low/high pairs on docks                      |
| The Frost Conservatory (follow-up) | Curved icy approach and optional crackle shortcut | Familiar gentle-wave lesson on solid islands |

Only the first route ships in this batch. Variants reuse authored behavior and
asset recipes; they do not fork the simulation. Timed singing, rival characters,
combat, new judges and legend difficulty remain separately planned.

## Runtime and asset gates

- One bounded simulation owns current platform transforms, collision activation,
  support deltas and warning states. Rendering reads that state.
- Static levels retain their existing movement. Ice affects grounded movement;
  it must not become uncontrolled skating. Jumping away from a raft is explicit.
- Authored gaps must stay gaps; ordinary museum seam forgiveness remains intact.
- Resetting a checkpoint resets nearby trial platform state deterministically.
- Use Meshy for the decorative platform donors, then finish in a dedicated Blender
  scene. Preserve guides, exact prompts, task receipts, raw donors, PBR originals,
  packed `.blend`, optimized GLBs and surface/origin measurements under
  `art/glass-adventure/platform-trials/v2/`.
- Landing surfaces match simple collision proxies. Inspect normals, hidden bevels,
  intersections, resting height and repeat resource sharing for this new family.
- Do not interrupt the user's existing compiled preview on port 5298. Publish a
  separate compiled acceptance snapshot when this route is ready.

## Implementation checklist

- [x] Confirm user approval, first-island membership and existing grading semantics.
- [x] Assign separate runtime, level/render and asset production ownership.
- [ ] Produce and inspect Meshy platform donors; finish and archive Blender source.
- [ ] Implement/test frost, translating support, crackle, reset and pause behavior.
- [ ] Build the authored route, render from simulation and integrate real assets.
- [ ] Add locked/unlocked campaign entry and development-only direct route.
- [ ] Test movement, gaps, warnings, resets, save preservation and voice safety.
- [ ] Inspect compiled phone/tablet/desktop entry and playable scene.
- [ ] Commit stages, push PR #807 and inspect the relevant CI results.
- [ ] Save receipts/checkpoint to dotfiles and provide the new test link.

No known urgent blocker remained in the prior tested batch: PR #807 at
`d291c065c7c25a09abe6fcf035969c69c3551169` had 39 passing checks and one
production-only skip. Full museum asset optimization remains follow-up work;
the new platform family receives the asset checklist as part of this production.
