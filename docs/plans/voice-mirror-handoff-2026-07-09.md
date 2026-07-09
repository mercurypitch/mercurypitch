# Voice Mirror — Session Handoff & Agreements Log (2026-07-09)

Continuation document for the Voice Mirror results-page redesign + legend
"voice twin" reveal. Written so work can resume in **any** environment (local
PC, fresh cloud session) with zero prior chat context: read this file, and you
have every decision, prompt, cost, link and open item.

- **Branch:** `feat/mirror-feature-improvements-5us19s` (no PR opened yet — do
  not open one unless asked)
- **Commits so far:** `ebd4e6f` (layout redesign + reveal + caricatures),
  `0b90465` (flip easing + lenticular clip + MJ prompts doc), plus this doc.
- **Workflow rules (CLAUDE.md):** `feat/` branches only, never push `main`,
  never force-push, **no Claude/AI attribution in commits or PRs**, run
  `pnpm check` after code changes.
- **Interactive preview artifact (flip vs lenticular, all 12 legends):**
  <https://claude.ai/code/artifact/38d5d8c5-5fb1-4df0-af2f-0243211f23c1>

---

## 1. What shipped (both commits pushed)

### Results-page redesign (`MirrorApp.tsx`, `mirror.css`)
- Voiceprint card centered; **Accuracy / Steadiness moved into "note" cards
  flanking it** (left/right ≥900px, stacked beneath on mobile,
  `.mirror-results-grid`).
- Removed the redundant giant "F2 – C#5" hero line (the card already shows it).
- **Button hierarchy:** hero `Share my voiceprint` (`.mirror-cta-hero`) →
  smaller sub-row Copy / Sing the Universe / Train (`.mirror-cta-sm`) →
  `Start over` as a quiet underlined text button (`.mirror-textbtn`).
- "Saved on this device only…" demoted to a one-line subtle footnote
  (`.mirror-foot`).

### Card declutter + reveal gating
- `card-renderer.ts`: `CardInput.legend` is now **opt-in** — the front/default
  card renders only the voice-type pill (e.g. `Baritone`). The
  `like <legend>` pill is drawn **only** when `legend` is passed.
- On-screen chip near the card shows `Baritone · like Elvis Presley` **only
  after the reveal**; the shared story card bakes the legend in only
  post-reveal (`buildStoryCard()` in `MirrorApp.tsx`).

### Tap-to-reveal "voice twin" (`RevealCard.tsx`, CSS in `mirror.css`)
- Voiceprint = card **front**; legend = hidden until tap. Pre-reveal: breathing
  gold glow + animated chevrons + "✦ tap to meet your voice twin".
- **Two reveal styles, both implemented,** switchable via an on-screen
  Flip/Lenticular segmented toggle:
  - `flip` — 2.5 turns in 3D (`rotateY(900deg)`), lands on a back face:
    constellation portrait, "✦ YOUR VOICE TWIN", name, epithet, voice type.
  - `lenticular` — portrait shines through the data (`mix-blend-mode: screen`),
    pointer tilt rotates the card in 3D, moving specular sheen.
- **Default logic:** first visit → flip; returning (delta) visit → lenticular
  (`finishRun()` sets it from `deltaVsBaseline`). `resetAll()` resets to flip.
- Fixes after review: flip start softened
  (`transition: transform 1.45s cubic-bezier(0.62, 0.02, 0.25, 1)`), lenticular
  specular clipped to the card (`.mode-lenticular.is-revealed .mirror-reveal-card
  { overflow: hidden }`) so light no longer spills past the edge (flip stays
  unclipped so the 3D spin isn't sliced).
- `prefers-reduced-motion` respected. New funnel event: `twin_revealed`.

### Constellation caricatures (`LegendCaricature.tsx`)
- All 12 legends as SVG "constellation portraits": shared nebula bust +
  per-legend signature silhouettes/accents + gold constellation stars/lines
  over an ambient starfield. This is the shipping fallback art.
- **`LegendArt.imageSrc`** — set it and a raster portrait renders in the same
  frame instead of the vector (`preserveAspectRatio="xMidYMid slice"`, frame
  viewBox `220×280` ≈ 4:5). **This is the hook for AI-generated portraits.**

### Dev/test infrastructure
- `demo-data.ts` + `?demo=` hook in `MirrorApp.tsx` (DEV-only, tree-shaken):
  `https://localhost:3000/mirror?demo=<bass|baritone|tenor|alto|mezzo|soprano>`
  renders the results screen with synthetic data through the REAL metrics.
  Extra params: `&delta=1` (delta line + lenticular default),
  `&mode=flip|lenticular`, `&revealed=1`.
  Profiles map to legends: bass→Johnny Cash, baritone→Elvis, tenor→Freddie,
  alto→Amy Winehouse, mezzo→Adele, soprano→Mariah Carey.
- Playwright screenshot loop exists (scratchpad scripts, not committed):
  launch chromium with `executablePath: '/opt/pw-browsers/chromium'` (cloud) or
  default local install, `ignoreHTTPSErrors: true`, shoot the demo URLs.

---

## 2. Decisions & agreements (chronological)

1. **Layout:** card centered, chip-style detail cards flanking, hero-vs-sub
   button hierarchy, subtle footnote. Shipped.
2. **Declutter:** voice-type stays on the card; `like <legend>` removed
   everywhere pre-reveal. Shipped.
3. **Legend art strategy:** constellation vector art now (ship-safe), swap to
   AI-generated raster portraits later via `imageSrc`. Hook shipped.
4. **Reveal:** build BOTH animations to compare. Shipped + artifact.
5. **User verdict on reveal:** **flip preferred**; flip start was too fast →
   fixed; lenticular light overshoot → fixed. Lenticular + toggle still in
   code — **open decision** whether to retire them or keep for delta visits.
6. **Caricature verdict:** constellations "interesting" but not likeness-strong
   enough → **go AI-image route** for real portraits.
7. **MidJourney path** (user drives MJ manually): 12 copy-paste prompts written
   → `docs/plans/voice-mirror-midjourney-prompts.md`. Seed vs style-code
   explained (seed = reproducibility, `--sref` = transferable style,
   `--cref <photo-url> --cw` = face lock). Freddie came out well in user's MJ
   tests; **Bruce Dickinson likeness failed** from name alone → use reference
   images (`--cref` / image prompts, era: Rock in Rio 2001).
8. **Style direction (user):** "quicksilver" — liquid mercury / polished
   chrome caricature, neon cyan-violet rim light, warm gold glints, deep-tech,
   on our indigo starfield (`#0b1026 → #090714`). On-brand for MercuryPitch.
9. **Higgsfield pivot:** user has the Higgsfield MCP connector + credits.
   Agreed process: **preflight cost via API → ask approval → generate → show →
   stop.** No batches/auto-retries without approval.
10. **First Higgsfield test (approved, executed):** one Freddie per model,
    total 2.12 credits. Results displayed in chat widgets; **user has not yet
    judged them** — that's the next conversation beat.

---

## 3. Higgsfield state (as of 2026-07-09 ~20:10 UTC)

- **Plan:** Plus. **Balance after test:** ~386.67 credits (was 388.79; spent
  2.12).
- **Cost preflight method:** `generate_image` with `params.get_cost: true`
  returns exact credits WITHOUT submitting a job. Always preflight + get user
  approval before spending.
- **Measured image costs:** `nano_banana_pro` @1k 4:5 = **2 credits**/image;
  `soul_2` @2k 3:4 = **0.12 credits**/image (bills ≥1 in display, 0.12 exact).
  For scale: user's history shows video models are the credit-eaters (Kling
  v3 = 48, Seedance = 24 per generation) — images are cheap.
- **Full 12-legend estimates:** Soul 2.0 ≈ 1.5–4 credits total;
  Nano Banana Pro ≈ 24–72 credits total (1–3 attempts each). Either fits the
  balance comfortably.
- **Note:** the API routed `nano_banana_pro` → backend `nano_banana_2` but
  billed under "Nano Banana Pro" (2 cr). Aspect ratios: nano models support
  native `4:5`; soul_2's closest is `3:4` (fine — the frame center-crops).
- **Open question (user offered to check):** which models are free/unlimited
  on their Plus plan in the Higgsfield app — route retries through those.
  Transactions API confirms both test jobs charged, so neither is MCP-free.

### The two Freddie test generations (2026-07-09)

| Model | Job ID | Cost |
|---|---|---|
| Nano Banana Pro (928×1152, 4:5) | `32c482d0-91d5-482a-b578-30465ad42dd3` | 2.00 |
| Soul 2.0 (1536×2048, 3:4, style "General") | `e4ac2c9e-cc6b-4e65-bb36-d32253301df7` | 0.12 |

Raw URLs (note: CDN links may expire — download/save promptly, e.g. into
`public/legends/` candidates or a scratch folder):

- Nano Banana Pro:
  `https://d8j0ntlcm91z4.cloudfront.net/user_3FzrLUxMBWR0PrMXVVnYingY7JV/hf_20260709_200945_32c482d0-91d5-482a-b578-30465ad42dd3.png`
- Soul 2.0:
  `https://d8j0ntlcm91z4.cloudfront.net/user_3FzrLUxMBWR0PrMXVVnYingY7JV/hf_20260709_200951_e4ac2c9e-cc6b-4e65-bb36-d32253301df7.png`

They can also be re-displayed any time with the Higgsfield MCP
`job_display(id)` tool, or found in the Higgsfield app's generations.

**Cloud-sandbox limitation (why this doc matters):** the remote session's
network policy blocks `d8j0ntlcm91z4.cloudfront.net`, so the agent could not
view the generated images there. **On a local machine there is no such proxy**
— a local Claude can `curl` the URLs above (or Read files the user saved) and
actually see/judge the images.

### Exact Higgsfield prompt used for both Freddie tests

```
Freddie Mercury at Live Aid 1985, thick black moustache, short dark hair, white tank top, one arm thrust triumphantly upward gripping a chrome half mic-stand, exaggerated stylized caricature with a big expressive head and a strong recognizable likeness, sculpted from liquid mercury and polished chrome with molten metallic reflections, iridescent neon rim-light in electric cyan and violet with warm gold glints, holographic sheen, head and shoulders, three-quarter view, set against a deep indigo-to-black cosmic nebula dusted with tiny constellation stars, luminous deep-tech futurism, dark cinematic studio lighting, ultra-detailed, sleek and premium
```

For the other 11 legends: reuse this scaffold, swapping the subject clause —
the 12 subject descriptions live in
`docs/plans/voice-mirror-midjourney-prompts.md` (strip the MJ `--flags`; those
are MidJourney-only. For Higgsfield, aspect ratio/count/model are API params).

---

## 4. Prompt library (MidJourney track, if resumed)

- **12 complete copy-paste prompts:**
  `docs/plans/voice-mirror-midjourney-prompts.md` (also has slugs + wiring
  table).
- **Quicksilver style-seed prompt** (run once with `--sref random`, then reuse
  the resulting code on all legends):

```
a portrait bust sculpted from liquid mercury and polished chrome, glossy quicksilver metal skin with molten reflections and exaggerated stylized caricature features, iridescent neon rim-light in electric cyan and violet with warm gold glints, holographic sheen, suspended in a deep indigo-to-black cosmic nebula dusted with tiny constellation stars, luminous deep-tech futurism, dark cinematic studio lighting, ultra-detailed, sleek and premium --ar 4:5 --style raw --stylize 400 --v 6.1 --sref random
```

- **Bruce Dickinson v8.1 prompt (no sref; pair with user's reference images
  via image-prompt URLs first, or `--cref <photo-url> --cw 80`):**

```
Bruce Dickinson, lead singer of Iron Maiden in his 2001 Rock in Rio era, shoulder-length wavy dark-brown hair flying, athletic frame, caught mid-scream gripping a microphone, fierce wide eyes and open mouth, exaggerated stylized caricature with a big expressive head and a strong recognizable likeness, sculpted from liquid mercury and polished chrome with molten metallic reflections, iridescent neon rim-light in electric cyan and violet with warm gold glints, holographic sheen, head and shoulders, three-quarter view, set against a deep indigo-to-black cosmic nebula (#0b1026 to #090714) dusted with tiny constellation stars, luminous deep-tech futurism, dark cinematic studio lighting, ultra-detailed, sleek and premium --ar 4:5 --stylize 300 --v 8.1 --no text, watermark, frame, signature
```

- Likeness dials: face melts → lower `--stylize` (150–200) / raise `--cw`;
  too photoreal → raise `--stylize` (400–500). Bruce reference sources:
  Wikimedia Commons "Bruce Dickinson" category (rights-safe), Ultimate Classic
  Rock year-by-year gallery, Getty "rock in rio 2001" search.

---

## 5. Image → app wiring (once portraits are chosen)

1. Save winners as `public/legends/<slug>.webp` (4:5-ish portrait, ≤~120 KB;
   dark cosmic bg blends best). Slugs: `elvis, sinatra, freddie,
   bruce-dickinson, johnny-cash, barry-white, amy-winehouse, cher, adele,
   whitney-houston, mariah-carey, celine-dion`.
2. In `src/features/mirror/LegendCaricature.tsx`, add per legend:
   `imageSrc: '/legends/<slug>.webp'` (constellation stays as fallback).
3. **Pending follow-up (agreed, not yet built):** draw the revealed legend
   portrait into the exported/shared story card too (canvas `drawImage` in
   `card-renderer.ts` — currently the shared card only gains the
   `like <legend>` pill post-reveal).
4. Verify with `?demo=` screenshots per voice type; run `pnpm check`; commit,
   push (never force), no PR unless asked.

---

## 6. Open items / next steps

- [ ] **User judges the two Freddie tests** (widgets in old chat, Higgsfield
      app, or URLs above). Pick model: Soul 2.0 (0.12/img) vs Nano Banana Pro
      (2/img) vs user's free/unlimited models.
- [ ] User checks which Higgsfield models are free/unlimited on their plan.
- [ ] Generate remaining 11 legends (preflight cost → approval → generate).
- [ ] Wire `imageSrc` for all 12 + commit images.
- [ ] Draw portrait into the shared story card (`card-renderer.ts`).
- [ ] Decide lenticular's fate: keep as delta-visit default, or flip-only and
      remove the toggle (user leans flip).
- [ ] Optional: hide the Flip/Lenticular compare toggle before release (it was
      built for A/B comparison).
- [ ] Croatian localization + other Phase-2 leftovers (unrelated backlog, see
      `voice-mirror-phase2.md`).

## 7. How to continue in a fresh environment

```bash
git fetch origin
git checkout feat/mirror-feature-improvements-5us19s
pnpm install
pnpm dev   # https://localhost:3000/mirror?demo=baritone&mode=flip
```

Then tell the assistant: *"Read docs/plans/voice-mirror-handoff-2026-07-09.md
and continue from the open items."* If the Higgsfield MCP connector is
attached to the new session, generation can continue there (always
`get_cost: true` preflight + user approval first). If portrait image files are
available locally, the assistant can view them directly with Read.

---

## 8. UPDATE — 2026-07-09 late session (local): Style A shipped, 14 legends live

Everything in §6 up to the Croatian-localization backlog is **done**. Current
state and the canonical recipe for adding legends:

### What happened

- **Style shootout** (user judged): full-chrome NBP Freddie = "too much
  mercury silver"; Soul 2.0 likenesses uncanny (disqualified). Three Style
  probes on Nano Banana 2 → **Style A "mercury accents" won** (warm-skin
  caricature, thin liquid-mercury ribbons, cosmic starfield) — validated on
  Freddie (easy) AND Bruce Dickinson (hard likeness).
- **All 14 legends generated + wired**: the original 12, plus **Kurt Cobain**
  and **David Bowie** (user request + assistant pick; both Baritone, honestly
  classified — Baritone now carries 4 legends and `singerForVoiceType` takes
  `readonly string[]`).
- **Reveal**: BOTH styles stay (user decision). Flip default on first visit;
  lenticular on delta visits. Lenticular upgraded to a **full-bleed
  double-exposure**: raster twin covers the card (`object-fit: cover`,
  `mix-blend-mode: screen`), bottom mask keeps stats legible, tilt drives a
  parallax drift (`portraitParallax()` in `RevealCard.tsx`).
- **Share card**: revealed story export draws a gold-ringed circular twin
  medallion beside the pills (`drawTwinRow` in `card-renderer.ts`); the
  portrait is preloaded/decoded at results time (`preloadLegendPortrait` in
  `MirrorApp.tsx`) so ClipboardItem stays inside Safari's tap gesture.
- **Demo profiles** (`/mirror?demo=…`, dev-only): voice-type keys (`bass`,
  `baritone`, `tenor`, `alto`, `mezzo`, `soprano`) plus one key per legend
  (`cash barry elvis sinatra kurt bowie freddie bruce amy cher adele whitney
  mariah celine`) whose range seed picks exactly that legend
  (+ `&mode=flip|lenticular&revealed=1&delta=1`). Fast lane:
  **`/mirror#<legend-key>`** (e.g. `#freddie`, `#cher`) jumps straight to the
  already-revealed result for that legend.

### Canonical generation recipe (for future legends)

1. Model **`nano_banana_2`** via Higgsfield MCP `generate_image`
   (routes to `nano_banana_flash`; **1.5 cr** @1k `4:5`). Preflight with
   `get_cost: true` when in doubt.
2. **Style A master template** — swap only the `{subject}` clause:

   > Vibrant stylized caricature illustration with bold playful exaggeration —
   > oversized expressive head, warm natural skin tones, confident linework
   > and rich painterly shading; thin ribbons of liquid mercury swirl around
   > {him/her} and quicksilver glints trace {his/her} silhouette {and the
   > microphone} — **{LEGEND, era, 3–5 signature visual attributes, pose}**,
   > head and shoulders, three-quarter view, set against a deep
   > indigo-to-black cosmic nebula dusted with tiny constellation stars, gold
   > and periwinkle starlight rim-light, dark cinematic lighting,
   > ultra-detailed, sleek and premium, no text, no watermark

3. Failure modes (both auto-refund): `nsfw` false positives on female
   celebrities → soften adjectives ("red lips", "eyes closed") and resubmit;
   plain `failed` → resubmit verbatim.
4. `magick in.png -quality 82 public/legends/<slug>.webp` (~120–230 KB).
5. Wire: `imageSrc` (+ optional vector fallback) in `LegendCaricature.tsx`;
   if it's a NEW legend also add it to `SINGERS_BY_VOICE_TYPE`
   (singer-match.ts), extend `singer-match.test.ts`, and optionally a demo
   profile whose `lowMidi*3+highMidi` seed (mod options.length) selects it.
6. Verify: `/mirror?demo=…&mode=flip&revealed=1` screenshot + `pnpm check`.

### Spend log (all transaction-verified)

Chrome/Soul probes 2.12 · style shootout 7.62 · batch of 10 net 12.00 ·
Amy+Celine NSFW retries 3.00 · Kurt+Bowie 3.00 · Celine face-ribbon retry
1.5–3.0 → **≈ 29–31 cr total**; balance ≈ 358–360 of 388.79 start.

### Still open

- [ ] Croatian localization + Phase-2 leftovers (`voice-mirror-phase2.md`).
- [ ] Free-sing surface has no reveal, so its share carries no legend
      (deliberate for now; follow-up candidate).

### Update — 2026-07-10 (share variants PR)

- **Flip is the shipped reveal**; the compare toggle is gone from the UI. The
  lenticular machinery stays in `RevealCard.tsx` (dev `?mode=lenticular`
  still works) and its LOOK ships as the **"Share with twin"** export:
  `drawTwinBackdrop` in `card-renderer.ts` blends the portrait full-bleed
  behind the data (screen composite + bottom alpha mask). The medallion
  (`drawTwinRow`) was removed — clean shares carry the legend as a name pill.
- Two main share buttons post-reveal (clean / with twin) + a **"Pitch
  trace"** option chip (`showTrace`) as the seed of customizable shares.
- Layout: shell widened to 960px with panels self-capped at 640px — fixes
  the tablet horizontal scroll (the 640px shell couldn't contain the ≥900px
  results grid); side-rail notes top-align with the card; `overflow-x: clip`
  as the page-level guarantee.
- Dev-domain builds use `--mode development`, so `/mirror#<legend>` demo
  fast lanes DO work on dev.mercurypitch.com (prod builds tree-shake them).
