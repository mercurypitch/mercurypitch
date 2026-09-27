# Glassworks creator studies

This batch extends the existing course compiler and shared runtime. The private
level studio remains in `<user-dotfiles>/personal/besidecue/glass-adventure/tools/cloudway-level-studio/v1`;
its UI is not shipped in BesideCue. Game-ready content and reusable validation
belong in this repository. Large Blender masters and appearance proofs belong in
the linked Proton creative archive.

## Author a level

The studio keeps the original design-v1 draft format and a separate complete
runtime-course v3 mode. Export v3 JSON for implementation: it includes platform
profiles and orientations, checkpoints, encounters, dependencies, gates, camera
sections, a melody lesson and optional discoveries. The runtime compiler remains
the source of truth. A successful compile proves structure and certified contacts;
it does not prove that every jump is reachable or a route is enjoyable.

The local bridge reads the private UI only from the explicitly supplied root:

```sh
node --experimental-strip-types scripts/glass-studio/cli.ts serve \
  --root <user-dotfiles>/personal/besidecue/glass-adventure/tools/cloudway-level-studio/v1 \
  --host 127.0.0.1 --port 5635
node --experimental-strip-types scripts/glass-studio/cli.ts validate course.json
node --experimental-strip-types scripts/glass-studio/cli.ts compile course.json
```

Use Node 22.22 or newer. Compilation writes JSON to stdout, never into a project
file. The server accepts only same-origin JSON requests, bounds input size and
graph counts, rejects unknown fields through the game compiler and refuses
static paths or symlinks outside its UI root. There are no shell execution or
arbitrary filesystem endpoints. Bind `0.0.0.0` only when testing the private
studio on another device on the local network.

`GET /api/catalog` returns fresh certified profiles and examples.
`POST /api/validate` returns a compact level summary; `POST /api/compile` returns
compiled definitions. Structural failures return 422. Unsupported data cannot be
silently treated as a playable level.

The melody profile owns judge policy and the comfortable vocal range. A course
may choose a certified pace and a bounded comfortable offset; it cannot override
the singer's actual key or supply arbitrary detector settings.

## Play the studies

BesideCue's B-side games list contains **Little discoveries** and **Echo Curator**.
They are owner-build previews with separate progress. Web development shortcuts:

- `/glass-game/?lab=creator-gallery`: optional pearl alcove and three crystal studies.
- `/glass-game/?lab=echo-curator`: three rounds of musical call and response.
- `/glass-game/?layout=crystal-interiors&interior=resonance-veins`: direct crystal study.
  Other presets are `frost-roots` and `aurora-heart`.

The normal museum now groups its real optional trials by island. Each island's
existing three-star requirement still controls entry; a future route is never
shown as unlocked. This is route navigation, not a claim of new 3D island terrain.

### Optional pearl alcove

The alcove branches from the Thawing Song east court. Its two optional vessels
award finite, distinct discovery coins. Required melody stations, gates and finale
still decide completion. The variant uses its own level, lesson and checkpoint
identity, so it cannot overwrite the accepted Thawing Song run. Replaying a
discovery does not mint another coin.

### Living crystal

Seeded three-dimensional branches sit within the scroll's reviewed transparent
inset. Motion is shader-driven over static geometry; there is no fluid simulation
or frame-by-frame mesh generation. Preset, seed, palette, intensity and speed are
configurable. Only certified scroll platforms accept this presentation field.

The effect retracts with the platform and respects pause, reset and reduced
motion. Each instance has a bounded resource lifecycle and one or two mesh draws per
render pass; transmission passes can multiply the total frame cost. It changes
no movement contacts or singing requirements.

### Echo Curator and musical memories

The optional curator introduces existing three-, five- and seven-note contours
through demonstration and response. It reuses the current pitch judge and Merc
references, with the existing instrumental fallback where no recording exists.
There is no countdown opponent, lost life or campaign penalty. Reference playback
and microphone capture are fenced so Merc cannot pass the player's attempt.

After completing a gallery, choose **Sing an optional encore**; an earned
portrait in the collection also offers **Sing or hear your encore**. The Encore
scorecard shows actual local attempt and phrase evidence. Merc/player
comparison uses the existing opt-in recording, playback, deletion and export
controls. Recording is optional; nothing is uploaded automatically, and a missing
clip is shown honestly rather than as a usable playback button.

## Review and device acceptance

Compiler, HTTP-boundary, effect-lifecycle, route-unlock, local-memory and native
entry tests cover the changed behavior. Browser tests cover phone/tablet/desktop
layouts and real microphone PCM for the musical audition. Art acceptance also
requires actual renderer images: test counts or triangle counts alone are not
appearance proof.

Physical-device checks still matter: compare the three crystal presets while the
scroll opens, explore and leave the optional branch, repeat a discovery, resume a
checkpoint, sing the curator's three rounds and compare/delete a saved recording.
The accepted camera, fog, collisions and canonical Thawing route remain regression
checks. Main campaign expansion and tuning a more competitive rival remain
separate follow-ups after these auditions.
