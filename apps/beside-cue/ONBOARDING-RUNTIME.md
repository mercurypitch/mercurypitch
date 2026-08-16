# Cinematic onboarding runtime

The app now has the playback contract for the eight-shot Corky onboarding, but
the cinematic is deliberately **not** the default first-run surface yet. The
default app config remains `welcome-only` until the Phase 5 export provides a
complete, validated media manifest.

## Runtime shape

- 8 shots are split into 14 ordered segments.
- 10 automatic segments are one-shot presentations. Normal motion advances on
  that clip's correlated `MEDIA_ENDED`; reduced motion advances only after the
  correlated authored still dwell.
- 4 interaction segments hold indefinitely for their named native user event.
  They never advance from a timer or a late media callback.
- A hold can be skipped without answering it. The entire onboarding also has
  an always-available dismiss path.
- A failed clip keeps its poster visible and offers retry, continue, or dismiss.
- Normal mode keeps the optional vertical `Cue` reflection. Reduced motion
  always uses stable stills and keeps the title upright.

The finite 624-frame / 26-second timing is a review and authoring baseline, not
a promise that someone will complete the runtime interactions in 26 seconds.
It also supplies each reduced-motion automatic state's configurable dwell at
24 fps; the four native interaction holds remain indefinite in both modes.

## Media boundary

Phase 5 supplies one manifest containing every segment. Automatic segments
need a poster, a reduced-motion still, and a non-looping H.264/yuv420p clip.
Native interaction holds need the two stable images only. The manifest guard
rejects missing or extra segments, wrong segment kinds, malformed entries,
empty descriptions, anything outside packaged `onboarding/` asset paths, and
an invalid source-contract SHA-256.

Blender files, rigs, collision reports, and authoring frame sequences stay in
the dotfiles source packages. The app receives only optimized versioned media,
portable paths, and provenance hashes.

## Phase 5 integration gate

Before changing `delivery` to `cinematic-first-run`:

1. Export all 14 segment states and all 10 one-shot clips.
2. Validate the manifest and verify every packaged asset exists.
3. Mount a dedicated cinematic director; do not reuse the ambient looping
   `AssetStage` component.
4. Keep captions, skip/retry controls, sorting, spin/stop, and reminder choice
   as accessible native UI outside rendered pixels.
5. Persist completion by onboarding revision without changing the cue-domain
   schema; stored-cue users continue directly to Home.
6. Device-test background/resume, decode failure, reduced motion, TalkBack,
   200% text, portrait safe areas, and landscape fallback.
7. Add a real-mouse Playwright smoke test if record spin becomes a drag or scrub
   gesture; always retain tap and keyboard alternatives.
