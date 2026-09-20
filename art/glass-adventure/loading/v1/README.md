# Merc's gallery threshold

The loading presentation uses the approved, existing transparent Merc idle
artwork from `apps/beside-cue/public/games/journey/merc-idle.webp`. The host
resolves it as `merc-loading`; no new image, model or voice generation was
needed. The architecture, light pass and gentle float are CSS. Reduced motion
uses a static pose.

The warm ivory cover is fully opaque. Downloads begin immediately. Required
textures, model dependencies, geometry and authored scene installation must
finish before rendering starts. The scene is revealed on a successfully
rendered frame at or after the original two-second entry deadline. Retry does
not restart this deadline. Slow loading has explanatory copy, not a fabricated
percentage. Failure keeps the cover with Retry and Leave museum.

## Evidence

- `capture.mjs` inspects the actual development host at desktop, portrait phone
  and landscape phone sizes, then captures its real installed WebGL frame.
  It holds Merc's GLB only during the loading screenshot; it does not delay
  production downloads. RAF stops after reveal for repeatable screenshots.
- `inspection.json` records dimensions, reduced-motion behavior and browser
  errors. The error screenshots deliberately abort a required model request;
  they verify that Retry is reachable by touch.
- `inspect-production.mjs` checks the built app's opaque cover, font, button
  size and touch reachability at desktop, tablet and narrow phone widths.
  It holds/fails an asset deliberately and does not measure rendering speed.
- `production-inspection.json` records the emitted production CSS checks.
- `apps/beside-cue/e2e/glass-adventure-loading.e2e.ts` separately exercises
  blocked input, focus, failed texture recovery, actual context loss, preserved
  progress, safe leave and the post-load tutorial. That state-oriented test
  suppresses raster work; the visual captures here render the actual scene.

These are desktop Chromium captures with touch emulation, not physical iOS or
Android acceptance, a frame-rate benchmark or a diagnosis of the separately
reported machine-wide Chrome GPU corruption.

From the repository root with the HTTPS development preview already running:

```sh
node art/glass-adventure/loading/v1/capture.mjs
```

For production style inspection, first build and locally preview the
games-enabled BesideCue app, then supply its origin as `GLASS_PROOF_BASE` to
`inspect-production.mjs`. It defaults to `http://localhost:5196`. Neither script
should target a deployed site.
