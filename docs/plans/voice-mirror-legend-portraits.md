# Voice Mirror — Legend "Voice Twin" Portraits

The results card hides the famous-singer match until the singer taps it (the
reveal). The back / overlay shows the legend as art. Two art tiers:

1. **Constellation portraits (shipping now).** Pure SVG in
   `src/features/mirror/LegendCaricature.tsx` — a shared nebula bust + each
   legend's signature (Elvis pompadour, Sinatra fedora, Amy beehive, Celine's
   heart-hand, Mariah's whistle-note …) traced as a gold constellation over an
   ambient starfield. Tiny, vector-crisp, and drawn in the *same* visual
   language as the voiceprint card so it blends instead of sitting on top.

2. **Richer raster portraits (optional upgrade).** Generate per-legend art in
   MidJourney and drop it into the exact same frame — no code changes beyond
   pointing a legend at its image.

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
