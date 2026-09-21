# Floating Museum — second polish batch

Approved 2026-09-21 after the owner accepted the V3 composition and requested
the remaining visual follow-ups plus correctly centred Merc at each destination.
Work stays on `feat/glass-museum-level-one`, draft PR #807. Commit/push reviewed
stages; no merge, release or store publication. Keep the existing static preview
unchanged while building the next snapshot.

## Scope and acceptance

- [x] Merc stands in the centre of every destination medallion. Use one shared
      marker coordinate/height contract instead of independently authored Merc
      positions. Normalize the donor's rendered footprint; preserve animation
      and smooth travel, with immediate reduced-motion placement.
- [x] Twin halls have distinct amber and teal domes. Split the accepted donor's
      dome in Blender and preserve ivory/gold architecture, with packed sources,
      exports, texture provenance and matching-angle proof renders.
- [x] Reuse accepted botanical models for richer flower beds and hanging ivy.
      Keep clear approach areas, restrained repeat counts and instanced details.
- [x] Engrave route medallions and add shared bridge/rim ornament. Three stars
      display only existing earned singing-quality progress; no invented grades.
- [x] Reveal a collected portrait on its actual 3D monument. Stage identity maps
      to the physical surface; collectible identity stays save data. Uncollected,
      failed and still-loading artwork retains its mystery silhouette. Stale
      loads, retry, context loss and teardown must retire owned resources.
- [x] Correct prior-head CI regressions without weakening the gates: web heading
      expectation, newly loaded map-kit expectation, and label readiness timing.
- [x] Review all four Merc destinations, earned/unearned states, narrow layouts,
      mouse/touch selection and actual compiled render counts/screenshots.
- [x] Preserve source, assets, proofs and checklist with this PR update. Provide
      a verified static HTTPS tablet preview and complete restart command.
- [ ] Final pushed-revision CI acceptance and owner device playtest. The earlier
      failed revision is superseded; do not call pending checks green.

## Ownership and architecture

Root owns planning/review, `models.ts`, Merc placement, content, asset mappings,
web/campaign test updates, verification and Git. Sol implementation subtasks own
Blender assets; architecture/vegetation; and progress display/scene/UI lifecycle.
No new renderer, frame loop, persistence schema or gameplay gate is introduced.

`journey/landmarks.ts` is the common coordinate source for marker surface,
selection halo, projected labels and Merc. A scene-owned progress display applies
chapter-view data to model-owned stars and portrait surfaces. It owns its async
textures and disposes before the underlying model graph.

The existing first-island mystery monument moves logically from First Light to
Glassworks Journey, retaining its physical location, because Journey is the
currently implemented collectible-portrait pilot. The other monuments stay
mysteries until those chapters have authored rewards. This is presentation only;
it does not grant or remove achievements.

## Baseline evidence

Runtime `8fa38d83`, documentation head `4f109ab0`. Owner accepted the V3
composition. CI run `35559303543` failed the root web entry heading assertion
(obsolete copy), campaign model inventory (new V3 kit omitted), and journey
projected-label readiness. Existing native builds and remaining checks passed.
Fix and rerun the affected checks; do not report the prior head as fully green.

V3 captures: 178 draws/317,628 triangles at desktop/tablet, 132 draws/272,947 at
320px phone, including shadows. Software render evidence is not physical-device
FPS or thermal acceptance. The separate Celadon breakable production task stays
open and must not be claimed complete as part of static map polish.

## Production checkpoint

Asset commit `619e41e4` is pushed to PR #807. The V4 kit replaces V3 at runtime;
the older sources remain archived. Packed Blender source, two full-resolution
dome textures, public/source GLBs and matching-angle renders are preserved under
`journey-map/v4/`. No new Meshy credits were needed for these accepted donors.
The runtime GLB is 5,642,860 bytes, SHA-256
`3c356e39746551ea1afb5d5cdecca784eb9e520acafafe81b31a6aedccad7991`.

`audit-merc-centering.mjs` loads the actual delivered mascot and measures 240
animation frames at each of four stage positions. Maximum lateral body movement
from the marker centre is 0.00473 metres, preserving the idle animation. The
separate offset fields are removed; content placement drives the marker, Merc,
halo and labels. A failed mascot construction also retires assembled scenery;
normal teardown restores donor materials before retiring their shared textures.

Browser review caught a portrait whose texture installed successfully but was
not visibly presented by its frame. Texture-install diagnostics alone did not
prove visibility. The ornate `map_frame_atlas_01` primitive contains an occluding front slab;
actual donor raycasts proved that directly replacing `map_frame_atlas_00` was
still hidden: the slab was first on 7,740 of 7,760 sampled rays inside the arched opening. The corrected display reuses that inset's exact arched silhouette
(55 triangles) ahead of the slab, with 3 mm of frame-local clearance beyond the measured foremost donor vertex.
Its authored UV crop is retained. U is reversed for the rotated frame; V is
reversed because glTF places V=0 at the top, unlike the generic plane used by
the bitmap loader. The material is visible from both sides. The original donor geometry stays intact;
the new surface shares its inset geometry and is visible only when earned. The inset contract is validated
before assembly allocates scenery resources. Failed or cleared portrait loads
restore the donor material and the separate mystery silhouette.

## Final verification and handoff

Focused architecture/progress/model tests pass (15/15); Merc normalisation and
resource-retirement regressions pass. Package TypeScript and the app typecheck
pass, as do scoped formatting/lint and the generated-index check. Actual-donor
measurement scripts preserve the Merc animation audit and frame-occlusion/UV
evidence. No required gate was weakened.

Journey browser checks pass (6/6), including real mouse and CDP touch selection;
follow-up context-loss and 320x568/320x640 earned-card checks also pass. The
campaign lobby-model inventory passes. The compiled web-entry smoke passes
(19.4 seconds), including map readiness before cover-image inspection. Both
final hosts build; the web build retains its bundle-boundary, first-paint-budget
and portable-console assertions.

Final earned desktop/phone captures show the actual portrait upright inside its
gold rim. The phone fixture also shows two saved singing stars; the desktop
portrait-only fixture stays ungraded. Fixtures run in isolated browser contexts,
not owner saves. Final PR CI is still required after the runtime push.
Eight final captures are archived in `journey-map/v4/proofs/runtime/`, with no
browser errors or horizontal overflow. The first model-backed published frame
reports 202 draws/391,854 triangles on desktop/tablet, 152/344,809 on the ordinary
phone view, and 155/345,337 for the phone reward fixture. These include shadows;
water contributes 5 draws/2,688 triangles. The published counters are an initial
frame snapshot, not continuously sampled earned-state costs or measured device
FPS. Keep software renderer counts separate from owner tablet feedback.

## Owner test and restart

New static HTTPS preview: `https://192.168.178.33:5293/glass-game/?campaign=1`.
The previous 5292 snapshot is unchanged. Different ports have separate browser
progress; the proof captures use isolated fixtures and never alter owner saves.

1. Select each of the four destinations, then switch quickly between them.
   Merc should settle over the centre of its medallion at every destination.
2. Inspect amber/teal domes, flower beds, hanging foliage and the bridge/route
   details on desktop and tablet; test tap selection and camera drag.
3. After earning the Journey portrait, return to the map and reload: its image
   should appear in the arched monument and the card. Existing singing stars
   should match the result; owning a portrait alone must not invent a grade.
4. Check the narrow portrait card and CTA remain readable, then enter/revisit
   a gallery. Report tablet smoothness or heat separately from art feedback.

The preview has no HMR. It runs for three hours from launch; Ctrl+C stops a
foreground restart. Start it from any directory with:

```bash
rtk proxy env PATH=/home/maff/.nvm/versions/node/v22.22.2/bin:/home/maff/.local/bin:/usr/local/bin:/usr/bin:/bin VITE_BESIDE_CUE_GAMES=1 timeout 10800 pnpm --dir /home/maff/.codex/worktrees/00ad/mercurypitch-agent/apps/beside-cue exec vite preview --mode https --outDir /tmp/glass-museum-polish-v4 --host 0.0.0.0 --port 5293 --strictPort
```

If the temporary snapshot was cleaned, rebuild it from this branch first:

```bash
rtk proxy env PATH=/home/maff/.nvm/versions/node/v22.22.2/bin:/home/maff/.local/bin:/usr/local/bin:/usr/bin:/bin VITE_BESIDE_CUE_GAMES=1 timeout 240 pnpm --dir /home/maff/.codex/worktrees/00ad/mercurypitch-agent/apps/beside-cue exec vite build --outDir /tmp/glass-museum-polish-v4 --emptyOutDir
```
