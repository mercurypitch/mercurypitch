# Progress UI surface

`ProgressPage` is a pure, display-ready UI. It does not query a database or
derive product claims. The Progress domain adapter owns comparability,
coverage, selection, and measurement semantics; this component renders the
semantic snapshot it receives.

## Material assets

The Resonance Atlas substrate is served from
`/progress/resonance-atlas.webp` (`public/progress/resonance-atlas.webp`). It is
decorative material only. All weekly pressure, traces, labels, pins, values,
and source colour are live DOM/SVG derived from the supplied snapshot.

The Mercury Pressing files in `public/progress/` belong to the share composer.
They are intentionally not used as Atlas data layers.

The share-card plate has its own `backgroundExposure` and `dataScrimOpacity`
controls in `share-card.ts`. The current review defaults are `1.12` and `0.62`,
so the Pressing can be brightened after device testing without altering the
Resonance Atlas or reducing the live evidence scrim.

The two independent tuning controls live at the top of
`ProgressPage.module.css`:

- `--progress-atlas-exposure` changes only the photographic substrate.
- `--progress-live-scrim-opacity` and `--progress-live-contrast` protect live
  typography and geometry independently of the plate.

This separation is deliberate so the plate can be made brighter after a real
device review without weakening evidence contrast.
