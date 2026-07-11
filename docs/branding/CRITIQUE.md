# Brand review — a critic's pass on the Sound Globe (V15)

Date: 2026-07-11 · Reviewer: Claude (requested: "be a critic, don't just say all is well")

## Verdict up front

The **strategy** in BRAND.md is excellent and should not change: *Liquid Precision*, mercury as
quicksilver + the messenger god who invented the lyre, pitch as the sine. The **color system**
(Obsidian + Signal + the new Chrome family) is production-grade. The **wordmark rules** are right.

The **final mark (Sound Globe V15) is the weakest of the fifteen concepts and should not ship.**
The branch's own early lead — V1 Meniscus — was the right answer and was abandoned. This review
refines it into **Meniscus v2** (`logo/meniscus2/`).

## Why the Sound Globe fails

1. **It fails the favicon test — measurably.** Rendered at 16 px it is teal noise in a circle; at
   32 px, "wavy ball". See `review/favicon-duel.png` (left: Sound Globe, right: Meniscus v2).
   Five overlapping waves + meridian ellipses cannot survive small sizes; a mark that dies at
   16 px fails its most-seen placement (the browser tab).
2. **It's off-strategy.** Nothing in it is *mercury* — no liquid, no chrome, no droplet, no planet.
   Globe + soundwaves is the stock visual language of translation apps, world-radio streamers and
   telecom brands: it says "audio, worldwide", not "your voice, made visible, sub-cent precise".
3. **One idea, drawn five times.** Strong marks state one idea once. The five waves add noise, not
   meaning — and none of them is *the* pitch line the product draws.
4. **Gradient-dependent.** Strip the teal→violet gradients (mono print, embroidery, single-ink
   contexts) and the leftover geometry — ellipses and squiggles — has no silhouette. The mono SVGs
   in the set are technically present but not distinctive.
5. **It drifts from the live product.** The app is Signal Blue `#58a6ff` / Violet `#bc8cff` on
   Obsidian; the globe is teal-first. The brand and the product should share one accent story.

## What Meniscus v2 keeps and fixes

Same idea as V1 (chrome orb, dark liquid, the waterline **is** the pitch wave) with V1's flaws fixed:

| V1 weakness | v2 fix |
| --- | --- |
| Wave amplitude too small — vanishes at 16 px | Amplitude ≈ 18% of diameter; survives 16 px |
| Blobby soft specular | One crisp ellipse, top-left, echoes the app's "perfect note" glow |
| Grey dome reads as "bubble" on dark UI | Cooler chrome ramp ending near-obsidian at the rim + hairline ring |
| Flat navy liquid | Deep liquid gradient (`#1d3050 → #0b1220`) — depth without noise |
| No mono discipline | `mark-mono-dark/light.svg`: silhouette = circle + wave; still unmistakable |

Three shapes total: dome, liquid, waterline. Mercury (the metal, the planet at night), Pitch (the
sine), and the product promise (your voice draws the line) in one image. The waterline can animate
in-product (ripple on mic input) — brand = product, same philosophy as the live pitch demo.

## Files added

- `logo/meniscus2/mark.svg` (+ 512 png) — primary mark
- `logo/meniscus2/favicon.svg` (+16/32/180 png) — simplified per BRAND.md's own <32 px rule
- `logo/meniscus2/mark-mono-dark.svg`, `mark-mono-light.svg` — single-ink variants
- `logo/meniscus2/lockup-horizontal.svg` — mark + Outfit wordmark (Mercury chrome / Pitch spectrum)
- `logo/explorations/recraft/g1–g4.svg` — AI vector explorations (Recraft V4.1). Keeper: **g3
  M-wave monogram** (two wave-peaks form an M, mercury bead in the valley) — strong app-icon /
  avatar alternate if the orb feels too quiet there. g1/g2/g4: discards, kept for the record.
- `imagery/quicksilver-hero.jpg` — cinematic mercury-sphere-with-waterline render for OG/hero use.
- `review/favicon-duel.png`, `review/marks-row.png` — the evidence.

## Recommendation

Primary = **Meniscus v2** everywhere (favicon, nav, footer, OG watermark). Consider **g3 M-wave**
(hand-redrawn, not raw AI output) for the PWA/app icon where a letterform helps recall. Keep
BRAND.md strategy, colors, and wordmark rules as written; replace §2's final mark. Sound Globe →
`explorations/` as V15, honorably retired.

## Addendum (2026-07-11, after reading HANDOFF.md)

**Fairness correction:** the favicon-duel above tested the *full* Sound Globe mark; the branch also
ships a 3-wave `soundglobe-mark-compact.svg` for ≤32 px. Re-tested: **at 32 px the compact reads
acceptably** (three waves discernible) — **at 16 px it is still mush** (standard-DPI browser tabs
request 16 px, so the point stands where it matters most). Critique items 2–5 (off-strategy, five-
times-one-idea, gradient dependence, product drift) are unaffected by the compact variant.

**Also noted:** V15 was iterated with the founder's own feedback (HANDOFF §4) — the choice between
Sound Globe and Meniscus v2 is therefore the founder's call, not this review's. Both favicon export
sets are now drop-in ready (`favicon/soundglobe/`, `favicon/meniscus2/`) and `public/` uses
standardized filenames, so switching marks is a single folder copy.

## Founder correction on meaning (2026-07-11)

**"Mercury" is not the element.** Per the founder: the name means **Freddie Mercury first** — the
voice, the performer, the patron saint of anyone learning to sing — and **the planet second**
(space, stars, cosmos). The quicksilver/liquid-metal reading in BRAND.md §1 is retired as the lead
story; keep "responds instantly / fluid" only as product adjectives, not as brand mythology.

Implications:
- **Imagery** goes celestial: planets, terminator light, starfields — not liquid-metal macro shots.
  `imagery/quicksilver-hero.jpg` is superseded (kept for the record); cosmic key visuals live
  alongside it.
- **The orb mark survives the reframe** — read it as the planet at dawn: lit side, night side, and
  the terminator drawn as *your* pitch line (this is exploration V11's idea living inside the
  Meniscus geometry). No Freddie likeness anywhere, ever — rights and taste; the homage lives in
  the name and the mission ("find your voice"), not in imagery.
- **Copy**: "Find your pitch." gains a second harmonic — the pitch you sing, and the stage you take.
