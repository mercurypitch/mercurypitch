# Cloudway laboratory runtime integration

This document defines the boundary between the Cloudway laboratory source art,
level authoring, deterministic platform simulation and the museum renderer. The
current Cloudway course and its `cloudway-platform-kit-v1` bundle remain
unchanged while this work is developed and accepted.

The provider deliveries and packed dense masters are source material. They are
not runtime assets. Runtime acceptance still requires semantic mesh separation,
certified support anchors, material treatment, repeatable export, performance
measurement and evidence from the actual game renderer.

## First playable boundary

The smallest useful course slice is a developer-only route with:

1. a static arrival and checkpoint;
2. one centred scroll bridge between static landings;
3. a Rose crackle platform that loses support two seconds after first contact;
4. a deliberate unsupported gap;
5. an Amethyst crackle platform that loses support four seconds after first
   contact; and
6. a static catch and exit.

This slice proves the Scroll Court and Rose Duet mechanics before the remaining
course dressing is connected. It must use a distinct level and save identity and
must stay out of the campaign trial catalogue until the complete course passes
runtime review. Simple visible fallback floors remain in place until the whole
runtime donor family validates and installs transactionally.

The complete 27-piece top-view study remains the design authority in
[`crystal-promenade.design.json`](crystal-promenade.design.json). Its clean
schema and top-view review establish authored intent, not runtime reachability,
camera clearance or playability.

Later sections add the frost bend, listening garden, three-contact ivory stairs,
notched cross landing and final three voice targets. Spawn points, checkpoints,
voice targets and the exit remain on static support. The optional frosted wall
does not participate in exit eligibility.

## Cardinal presentation contract

`PlatformDefinition.renderQuarterTurns` is the renderer-only cardinal
orientation around world +Y:

- accepted values are `0`, `1`, `2` and `3`;
- it does not change collision, which remains the axis-aligned platform bounds;
- inside a room prefab it is local to that prefab;
- room compilation adds `RoomPlacement.yawQuarterTurns` modulo four;
- an omitted local value inherits a turned room;
- an omitted value in an unturned room stays omitted; and
- a direct runtime level may omit it, which means zero turns.

The scroll behavior axis follows a separate contract. It is local in editor and
prefab data, then becomes a world axis during compilation. The renderer uses
`renderQuarterTurns` to orient the donor and the compiled scroll axis to select
the live world extent. Keeping both values prevents an asymmetric deck from
visually retracting across a different axis than its collider.

At installation, the adapter rotates the metadata `localExtensionAxis` by
`renderQuarterTurns` and requires the result to equal the compiled behavior
axis. A mismatch rejects the donor family and leaves its visible fallbacks in
place.

The current Cloudway renderer should remain unchanged for the first laboratory
adapter. Existing Cloudway levels use direct runtime definitions without
`renderQuarterTurns`, and that renderer fits complete donor families to world
bounds. Adding a yaw there without also swapping the local fit dimensions on odd
turns would distort asymmetric art. A separate laboratory adapter can establish
the role-based transform before shared code is extracted.

### Transform order

An accepted donor has one family root at the support datum. Descendant node
transforms are authored data and must survive import. For descendant local matrix
`L`, local fit scale `S`, compiled cardinal yaw `C` and platform-centre
translation `T`, the presentation matrix is:

```text
M = T * C * S * L
```

The cardinal transform is outside the imported hierarchy. The adapter must not
zero, decompose or recreate descendant rotations, and it must not pre-rotate the
geometry and apply `C` again. For odd cardinal turns, the target world X and Z
spans map to the donor's local Z and X spans respectively before `S` is built.
The final matrix is then applied once.

The existing Cloudway renderer already preserves imported descendant matrices by
capturing them after `updateMatrixWorld(true)` and multiplying a platform matrix
outside them. The laboratory adapter should retain that property while adding
cardinal orientation and semantic part motion.

## Accepted runtime donor coordinates

Every accepted laboratory platform donor must meet the same basic coordinate
convention as the current Cloudway runtime kit:

- glTF +Y up and metres;
- an identity family-root transform in the delivered file;
- family-root origin at `[0, 0, 0]`, the top-centre of the actual fully extended
  support surface;
- the landing plane at local `y = 0`;
- positive collider thickness extending below the landing plane; and
- authored descendant transforms preserved below the family root.

The support surface is the part a player can actually stand on. Decorative
frames, fins, clasps, rolled ends and overhanging ornament do not enlarge the
support bounds. A broad, flat-looking patch discovered during source inspection
is only a candidate until the runtime export certifies it.

The family root carries the existing string-encoded `collider_json` extra:

```ts
interface ColliderMetadataV1 {
  shape: 'box'
  width: number
  depth: number
  height: number
  topY: 0
  center: [0, number, 0]
}
```

`width`, `depth` and `height` are positive finite metres. `center[1]` equals
`-height / 2`. Width and depth describe the fully extended support, rather than
the visual shell. The runtime level's simple collision rectangle remains the
simulation authority; metadata lets installation reject art that does not line
up with it.

Each dynamic donor also carries a string-encoded `platform_adapter_json` extra
with this versioned shape:

```ts
interface PlatformAdapterMetadataV1 {
  version: 1
  coordinates: {
    upAxis: '+Y'
    units: 'metres'
    origin: 'top-centre-of-fully-extended-support'
  }
  support: {
    state: 'fully-extended' | 'intact'
    topY: 0
    width: number
    depth: number
  }
  motion:
    | {
        kind: 'scroll'
        localExtensionAxis: 'x' | 'z'
        roles: {
          deck: string
          negativeRoller: string
          positiveRoller: string
          persistent: readonly string[]
        }
        rollerEdgeAnchors: {
          negative: [number, 0, number]
          positive: [number, 0, number]
        }
      }
    | {
        kind: 'crackle'
        roles: {
          persistent: readonly string[]
          intactGlass: string
          contact: string
          shards: readonly string[]
        }
        materials: {
          glass: string
          framework: string
          internalDetail: string
          cornerDetail: string
        } & (
          | { ivory: string; accent?: never }
          | { accent: string; ivory?: never }
        )
      }
}
```

Role values are exact descendant node names. Every named node must exist once,
and no node may occupy two roles. The negative and positive roller anchors lie
on opposite edges along `localExtensionAxis` at the fully extended endpoint.
The deck role contains the complete walkable glass deck and excludes rollers and
persistent ornament.

For a scroll snapshot, `lengthRatio` changes only the deck extent along the
local extension axis. Both rollers translate to the resulting live edges. The
family centre, landing plane and perpendicular extent remain fixed. Persistent
ornament does not stretch. The rendered extent and the materialized collision
extent must agree on every update, including both endpoints and a paused frame.

For a crackle snapshot, persistent gold or frame nodes remain fixed through all
phases. The contact role certifies support but is never rendered. Warning is a
runtime material pulse on `intactGlass`; there is no separate warning role.
Release swaps the intact role atomically to the exact shard set while collision
is removed by the same authoritative platform state. Shards are closed volumes
with independent centroid pivots. Respawn restores the intact set and platform
timer.

Material bindings are independent of motion-role containment. Framework,
internal-detail and accent meshes may be children of `intactGlass` when they
must disappear with the unbroken shell, or children of a persistent role when
they must survive fracture. `glass` is the only primary closed-shell and shard
transmissive material and has zero metalness. `framework`, `cornerDetail` and
the asset-specific `ivory` or `accent` binding remain opaque. The contact role
has no rendered material. Rose uses `ivory`; Amethyst uses `accent`; every other
material key is shared and every material node name is nonempty and unique.

The runtime manifest records the metadata version, exact roots and roles,
source lineage, asset hashes, required extensions, decoder policy, texture
inventory and external dependencies. No donor is installed from inferred node
names or bounds.

## Material acceptance boundary

The inspected provider pilots currently contain one fused mesh, primitive and
opaque material per object. Their colour, packed metal/roughness and normal maps
preserve useful source detail, but they do not identify semantic gold and glass
regions reliably. The packed metallic channel is not a material-classification
mask.

The runtime Blender derivative must split glass and gold into explicit geometry
or material slots before integration:

- scroll deck glass, each roller and persistent ornament are separate roles;
- crackle glass, contact, persistent ornament and shards are separate roles;
  warning is a runtime pulse on the intact-glass material; and
- region-specific maps retain the accepted source detail without stretching
  gold ornament across a changing deck.

The existing material library clones the imported material class. Applying a
glass palette to an opaque standard material therefore does not create physical
transmission. The laboratory adapter uses explicit per-mesh material bindings independent of
motion roles. Every exported mesh has a unique name and exactly one reviewed
binding. A glass deck can therefore carry opaque gold stars and frosted etching
without those details inheriting the glass material. Mixed ivory/gold rollers
retain a reviewed PBR atlas rather than receiving a uniform gold override. Glass begins from a physical transmissive material, forces
metalness to zero and accepts only audited glass-region colour, normal,
roughness and ambient-occlusion maps. Opaque ornament may use a standard or physical PBR material with its audited
region maps; a mixed atlas must retain its reviewed metallic channel. Borrowed
materials and textures are never disposed by the adapter. Intact opaque crackle
surfaces use adapter-owned material clones for a snapshot-driven warm warning;
their textures remain shared, and their original emission returns after warning.
The deck must contain
at least one physical glass binding; missing, duplicate or unknown mesh bindings
reject installation. Actual loader and visual proofs are separate from device
performance acceptance.

The selected Rose/Amethyst delivery keeps the exact provider-textured exterior
opaque while intact, and pairs its surface detail with closed physical-glass
volumes when fractured. This preserves the approved ornament without pretending
the fused donor has an optically separated glass body. A future interior-light
effect requires that additional optical material pass; its first audition should
use the scroll bridge's separately authored transmissive inset.

Dense geometry and original high-resolution maps remain source masters. Runtime
topology, texture container and resolution decisions follow measurements from
the actual renderer; source quality is not reduced to satisfy a provisional
integration.

## Renderer and catalogue integration points

The implementation uses these boundaries:

- `content/cloudway-laboratory.ts`: distinct developer-only level and route;
- `render/cloudway-laboratory-catalog.ts`: stable render IDs, bundle ID, exact
  semantic roles and material policies;
- `render/cloudway-laboratory-platforms.ts`: transactional family validation,
  cardinal donor transform and per-role scroll/crackle presentation;
- `render/catalog.ts`: platform recipes so `asset-load-plan.ts` discovers the
  new bundle from the selected level;
- `render/museum.ts`: install, update, view-cull and dispose the laboratory
  renderer beside the current Cloudway renderer;
- `browser/assets.ts`: a separate logical bundle path, manifest and declared
  external dependencies for web and native packaging; and
- `content/development-levels.ts` plus the standalone host: an explicit
  developer query route only.

The new bundle must not replace or redirect `cloudway-platform-kit-v1`.
Installation validates the complete family before removing any visible fallback
floor.

The laboratory renderer can reuse current Cloudway view selection, shadow-bound
collection, authoritative platform snapshots and transactional fallback swap.
It can reuse instancing for repeated opaque parts with identical geometry and
materials. Transmissive glass stays unbatched until ordering is proven because
one `InstancedMesh` cannot sort its instances independently.

Authored crackle shards can reuse the exact-root validation and centroid-pivot
ideas in `asset-geometry.ts` and `exhibit-asset.ts`. The procedural fracture
helper only partitions existing triangles and does not establish closed shard
volumes, so it is unsuitable for course support.

The Rose mirror can reuse the bounded planar-reflection path with a separate
flat optical surface. The basin stays dry for the first integration. Repeated
opaque props may use the static decoration batching path once each instance can
retain any required picking identity.

## Camera and collision cost

Simulation collision always uses simple level rectangles and never dense render
meshes. The existing camera path also has cheap platform boxes, but the museum
currently collects every visible opaque depth-writing mesh as a camera
occluder. Laboratory art needs an explicit opt-out marker and simple camera
proxies where ornament must block the camera. Dense decorative meshes must not
enter per-frame camera raycasts.

Live scroll presentation bounds feed view and shadow culling. Repeated falls are
part of acceptance because falling below authored bounds is where an accidental
dense-mesh camera query is most visible.

## Dependency and acceptance order

1. Accept semantic runtime exports for the scroll, Rose and Amethyst donors,
   including exact metadata, manifests and repeatable export evidence.
2. Add the developer-only content, catalogue and asset declaration without
   changing the campaign or current Cloudway IDs.
3. Add the laboratory renderer with cardinal matrices, role-based motion and
   explicit material replacement.
4. Prove the focused first playable in the real host.
5. Integrate and validate the remaining course pieces.
6. Consider campaign exposure only after the complete course passes review.

### Asset checks

- Expected roots and role nodes exist exactly once.
- Family roots use the accepted coordinates and identity transform.
- Certified support bounds match visible deck support and the simple collider.
- Scroll deck and rollers match the full, minimum and intermediate extents.
- Crackle shards are closed, consistently wound volumes with cut faces and
  independent pivots.
- Optical regions use physical transmission; preserved opaque provider surfaces
  are explicitly identified and are not described as transparent glass.
- Gold and glass retain separate audited maps, normals, tangents and UVs.
- The manifest records hashes, dependencies, source lineage and loader needs.

### Unit and integration checks

- Room turns compose with local `renderQuarterTurns` modulo four.
- An omitted local render turn inherits a turned room and stays omitted in an
  unturned room.
- Invalid render turns fail authoring validation with an actionable path.
- Scroll visuals and collision share their centre, top, axis and length ratio at
  zero and one quarter turns.
- Pausing freezes both the visual and collision extent.
- Persistent gold roles never scale with the scroll deck or fall with crackle
  shards. Source ornament assigned to a shard moves with that shard.
- Two- and four-second crackle timers start on first support contact, do not
  restart after leaving and relanding, and reset on checkpoint respawn.
- A deliberate gap remains unsupported throughout every platform phase.
- Missing roles, materials or shards leave the complete fallback family visible.
- Dense laboratory meshes stay out of simulation and camera collision queries.
- The existing Cloudway load plan, bundle ID and focused renderer tests remain
  unchanged.

### Real-host proof

Use a separate bounded development server. Verify the runtime bundle, manifest
and every dependency from the same host used by the game. Walk the slice with
keyboard/mouse and real touch layouts at phone, tablet and desktop sizes. Capture
the full and minimum scroll endpoints, pause mid-transition, step beyond a
shrinking edge, measure the two crackle lifetimes, repeat fall/respawn, and
finish the gate.

Record draw calls, triangles, textures, geometries, reflection captures, decoded
texture memory, load time and frame timing on the balanced and high profiles.
Compare the closest runtime inspection against the accepted source render and
Blender export. Runtime source and quality acceptance remain pending until this
evidence exists.
