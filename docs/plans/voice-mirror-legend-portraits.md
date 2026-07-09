# Voice Mirror — Legend "Voice Twin" Portraits

> **STATUS 2026-07-09: DONE — all 14 legends ship with raster portraits** in
> `public/legends/` (Style A "mercury accents" caricatures generated via the
> Higgsfield MCP; see `voice-mirror-handoff-2026-07-09.md` §8 for the master
> prompt template + generation recipe, costs and failure modes). The roster
> also grew: **Kurt Cobain** and **David Bowie** joined Baritone
> (`kurt-cobain.webp`, `david-bowie.webp`). MidJourney (below) remains an
> *alternate* generation route only.

The results card hides the famous-singer match until the singer taps it (the
reveal). The back / overlay shows the legend as art. Two art tiers:

1. **Constellation portraits (fallback).** Pure SVG in
   `src/features/mirror/LegendCaricature.tsx` — a shared nebula bust + each
   legend's signature (Elvis pompadour, Sinatra fedora, Amy beehive, Celine's
   heart-hand, Mariah's whistle-note …) traced as a gold constellation over an
   ambient starfield. Renders automatically for any legend without an
   `imageSrc`.

2. **Raster portraits (shipping).** Per-legend Style A caricatures, wired via
   `imageSrc` — the reveal back face, the full-bleed lenticular overlay and
   the share-card medallion all use them.

## How to swap a richer image in

`LegendArt` already supports `imageSrc`. Once you have an image:

```ts
// src/features/mirror/LegendCaricature.tsx
'Elvis Presley': {
  epithet: 'The King of Rock and Roll',
  imageSrc: '/legends/elvis.webp', // ← renders the image instead of the vector
  silhouette: [...], stars: [...],  // kept as the fallback
},
```

- Put files in `public/legends/<slug>.webp` (served from root, **not** bundled,
  so the mirror bundle stays lean). Only the revealed legend's image loads.
- Target a **4:5 portrait** (the frame is `220 × 280`); `preserveAspectRatio`
  is `slice`, so it fills and centre-crops.
- Prefer WebP/AVIF, ≤ ~120 KB each. A dark, cosmic background that matches the
  card (`#0b1026 → #090714`) blends best; a transparent PNG also works and lets
  the card's own gradient show through.

## MidJourney prompts

**Copy-paste-ready prompts live in
[`voice-mirror-midjourney-prompts.md`](./voice-mirror-midjourney-prompts.md)** —
twelve complete prompts (one per legend), each with the shared cosmic style
block already baked in, plus the target filename per legend.

The legend → voice-type mapping lives in `src/lib/mirror/singer-match.ts`
(two legends per type, chosen deterministically from the detected range).
