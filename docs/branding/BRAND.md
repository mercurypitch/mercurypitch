# MercuryPitch — Brand System

> Version 0.1 · Direction: **Liquid Precision** — sleek pro-tech with a quicksilver-premium edge.
> This document is the single source of truth for the brand: strategy, logo, color, type, imagery,
> the MidJourney prompt pack, and the copyright/production playbook.

---

## 1. Brand Strategy

### The idea: **Liquid Precision**
"Mercury" is quicksilver — a liquid metal that is fluid, reflective, and *responds instantly*. That is
exactly what the product does: it turns your voice into something you can see, in real time, with
sub-cent accuracy. Mercury is also the fastest planet and the Roman messenger god — who, in myth,
**invented the lyre**. Speed, communication, music, and liquid metal all live in one word. "Pitch" is
the vertical axis of music — frequency, the sine wave, the tuning fork.

**Brand promise:** *Your voice, made visible — fluid, immediate, precise.*

### Personality
| Trait | Means | Not |
| --- | --- | --- |
| Precise | Instrument-grade, trustworthy feedback | Clinical, cold |
| Fluid | Real-time, responsive, effortless | Sluggish, rigid |
| Premium | HDR, chrome, considered craft | Flashy, gaudy |
| Encouraging | Helps you improve, never shames | Gamey, childish |

### Voice & tone
- Confident and clear, never jargon-heavy. Short sentences. Verbs over adjectives.
- Encouraging coach, not a drill sergeant. "You're 8 cents sharp — ease off." not "WRONG."
- Tagline options (pick one primary):
  1. **"Find your pitch."** (double meaning: musical pitch + your voice/identity — recommended)
  2. "Your voice, in perfect focus."
  3. "See every note."
  4. "Real-time pitch, liquid precision."

---

## 2. Logo

### Concept
The mark evolves the existing orb-and-wave favicon into a **quicksilver droplet** (an HDR chrome sphere)
with a **pitch sine-wave** carved through it and a spectrum meniscus ring (blue→teal→violet). The app
icon is a **liquid-metal "M"** built from a doubled pitch wave — two wave peaks form the M, and a
mercury droplet dots the valley.

### Concept explorations (choose the final mark here)
Six distinct concepts across the four personalities live in `logo/explorations/` (SVG + 512px PNG),
compared visually in **`logo-explorations.html`**. Leads: **V1 Meniscus**, **V2 Mercury Glyph ☿**,
**V6 Soundwell** — each has a drop-in favicon set in `favicon/{v1,v2,v6}/`.

| Concept | Personality | Idea |
| --- | --- | --- |
| V1 Meniscus | Liquid-premium | Chrome sphere half-filled with liquid; the waterline is the pitch wave |
| V2 Mercury Glyph ☿ | Sleek pro-tech | Alchemical Mercury symbol rebuilt with a pitch wave |
| V3 Droplet-Note | Warm & musical | Mercury droplet as a note-head on a wave staff |
| V4 Orbit Pitch | Cosmic premium | Mercury planet with an orbit that becomes a waveform |
| V5 Monoline | Minimal Swiss | One rising pitch-stroke ending in a mercury bead |
| V6 Soundwell | Liquid-premium | Mercury droplet with concentric sound ripples |

### First-pass assets in this folder (`logo/`)
| File | Use |
| --- | --- |
| `mercurypitch-mark.svg` | Early primary mark — droplet + wave (superseded by the explorations above). |
| `mercurypitch-icon-M.svg` | App/tile icon — rounded square, liquid-metal "M". PWA, home screen, store. |
| `mercurypitch-lockup.svg` | Horizontal lockup — mark + wordmark. Header, docs, footer, email. |

> These SVGs are **production-ready starting points**, authored by hand (original vector = copyrightable
> and trademark-clean). Use MidJourney only for exploration/mood, then finalize in vector — see §7.

### Wordmark
- Type it **MercuryPitch** — one word, camel-case, no space.
- Set in **Outfit SemiBold** (600), letter-spacing −1.5 to −2%.
- "Mercury" in chrome-white (`--text-primary`), "Pitch" in the spectrum gradient (or solid Signal Blue
  on busy backgrounds).

### Clear space & minimum size
- Clear space on all sides = the diameter of the droplet's specular highlight (≈ 0.25× mark height).
- Minimum mark size: 24 px (screen), 8 mm (print). Below 32 px, drop the meniscus ring and the wave's
  inner gradient — keep the black wave only, for legibility.

### Don'ts
- Don't recolor the chrome body to a flat brand color (kills the "mercury" read).
- Don't stretch, add drop shadows beyond the spec in §4, rotate the wave, or place the gradient wordmark
  on a mid-tone background where it loses contrast.

---

## 3. Color System

Built **on top of** the live app tokens (`src/styles/app.css`) so there is zero migration cost — the
existing values are the "Signal" and "Surface" families. The **Mercury (chrome)** family is the new,
brand-defining addition.

### Core palette (dark — primary)
| Token | Hex | Role |
| --- | --- | --- |
| `--bg-primary` (Obsidian) | `#0d1117` | App background, brand black |
| `--bg-secondary` | `#161b22` | Panels |
| `--bg-tertiary` | `#21262d` | Raised surfaces |
| `--bg-card` | `#1c2128` | Cards |
| `--border` | `#30363d` | Hairlines |
| `--text-primary` | `#e6edf3` | Primary text / chrome-white |
| `--text-secondary` | `#a8b3bf` | Secondary text |
| `--text-muted` | `#6e7681` | Muted text |

### Signal (accents — keep)
| Token | Hex | Role |
| --- | --- | --- |
| **Signal Blue** `--accent` | `#58a6ff` | Primary accent, active pitch, links, CTAs |
| **Aqua** `--teal` | `#2dd4bf` | Secondary — success/in-tune, data |
| **Violet** `--purple` | `#bc8cff` | Tertiary — highlights, premium, mascots |
| Green `--green` | `#3fb950` | Perfect/in-tune |
| Yellow `--yellow` | `#d29922` | Slightly off |
| Red `--red` | `#f85149` | Off pitch / error |

### Mercury / Chrome (NEW — brand signature)
Use for the HDR logo, hero surfaces, and premium accents. This is what makes the brand feel like
"mercury" rather than generic dark-tech.
| Token | Hex | Role |
| --- | --- | --- |
| `--chrome-100` | `#f4f8fd` | Specular highlight, top of chrome gradient |
| `--chrome-300` | `#c3ccd6` | Light chrome |
| `--chrome-500` | `#8a97a6` | Mid chrome |
| `--chrome-700` | `#5b6b7b` | Deep chrome |
| `--chrome-900` | `#1b2430` | Chrome shadow / bevel |

**Signature gradients**
```css
/* Spectrum (brand rim / "Pitch" wordmark / active states) */
--grad-spectrum: linear-gradient(120deg, #58a6ff 0%, #2dd4bf 50%, #bc8cff 100%);
/* Quicksilver (logo body, premium chrome surfaces) */
--grad-mercury: radial-gradient(120% 120% at 38% 30%, #f4f8fd 0%, #aeb9c6 28%, #5b6b7b 62%, #1b2430 100%);
/* Hero wash (landing background) */
--grad-hero: radial-gradient(80% 60% at 50% 0%, rgba(88,166,255,0.18), transparent 60%), #0d1117;
```

### Light theme
Already defined in `app.css` (`[data-theme='light']`): off-white `#f3f4f6`, Signal Blue `#0969da`.
Keep it. The Mercury chrome family works unchanged in light mode (chrome reads against any ground).

### Accessibility
- Body text on `--bg-primary`: `--text-primary` passes AA (≥ 7:1). `--text-secondary` passes AA for
  ≥ 16px. Never put `--text-muted` on `--bg-card` for body copy.
- The spectrum gradient is decorative — never the only carrier of meaning. Pair with text/icon.

---

## 4. Typography

Fonts are already loaded in `index.html` (Inter, Outfit, Plus Jakarta Sans) — no new dependencies.

| Role | Font | Weight | Notes |
| --- | --- | --- | --- |
| Display / headlines | **Outfit** | 600–700 | Tight tracking (−1 to −2%). Geometric, modern, matches the "precise" feel. |
| Alt display | Plus Jakarta Sans | 600 | Warmer fallback for marketing when Outfit feels too rigid. |
| UI / body | **Inter** | 400–600 | The workhorse — matches the app today. |
| Data / numerics | Inter (tabular) or a mono | 500 | Cents, Hz, timers — enable `font-variant-numeric: tabular-nums`. |

**Type scale** (already in `app.css`): xs 10.5 → xl 20px for UI. For **marketing**, extend upward:
Display XL 64/72, Display L 48/56, H1 36/44, H2 28/36, Lead 20/30.

---

## 5. Imagery & Motif

- **Hero motif:** a suspended mercury droplet or ribbon of liquid metal whose surface ripples into a
  **soundwave/pitch contour**. HDR studio lighting, high reflectance, deep obsidian ground, thin
  blue/teal/violet rim light. This is the recurring key visual.
- **Textures:** rippling liquid-metal fields, oscilloscope/waveform grids, fine particle constellations
  in the spectrum colors on black.
- **Data as art:** the piano roll and pitch canvas ARE brand assets — screenshots with the spectrum
  glow read as authentically "us." Prefer real product shots + one abstract mercury hero.
- **Mascots:** the existing `public/characters/*` gradient "voice specialists" are the brand's warm,
  human layer. Keep their soft cloud silhouettes but unify them onto the spectrum gradient and give
  each a subtle chrome rim so they belong to the same world as the logo. (See MJ prompt §6.6.)
- **Photography:** if used, single-subject, low-key lighting, one colored rim light (blue/teal/violet),
  lots of negative space. No stocky "happy people with headphones."

---

## 6. MidJourney Prompt Pack

**Read §7 before using these for a logo.** These prompts are tuned for **MidJourney v7**. Notes:
- `--ar` aspect ratio · `--stylize` (`--s`) artistic liberty · `--chaos` (`--c`) variation ·
  `--style raw` for less "MJ house style" / more control · `--no` to exclude.
- `--sref <url>` locks a **style** across images (generate the hero first, then feed its URL as `--sref`
  to everything else for a coherent set). `--cref <url>` + `--cw` locks a **character** (mascots).
- Swap the literal hex palette words if you change the palette. Keep "obsidian / quicksilver / chrome"
  language — it's what makes outputs feel like Mercury.
- Iterate: generate 4, upscale/vary the best, then use it as `--sref` for the rest.

### 6.1 Primary logo mark (droplet + wave)
```
minimalist app logo, a single suspended droplet of liquid mercury / quicksilver,
mirror-chrome HDR surface, a smooth sine soundwave rippling across its surface,
thin rim light in electric blue #58a6ff to teal #2dd4bf to violet #bc8cff,
deep obsidian #0d1117 background, centered, symmetrical, high contrast,
studio product render, octane, crisp vector-ready silhouette, negative space,
--style raw --ar 1:1 --s 250 --c 4 --no text, letters, words, mockup, hands, gradient banding
```

### 6.2 Liquid-metal "M" monogram (app icon)
```
single letterform "M" sculpted from flowing liquid mercury, mirror chrome,
the M formed by two soundwave peaks, glossy HDR reflections, one small mercury
droplet resting in the valley, rounded-square app icon on obsidian #0d1117,
subtle spectrum rim light blue-teal-violet, minimal, iconic, centered,
3d render, studio lighting, --style raw --ar 1:1 --s 200 --c 3
--no serif, extra letters, words, texture noise, drop shadow
```

### 6.3 Landing hero — key visual (16:9)
```
a ribbon of liquid mercury suspended in dark space, its surface rippling into a
glowing pitch waveform, mirror-chrome reflections, HDR, cinematic studio lighting,
electric blue #58a6ff, teal #2dd4bf and violet #bc8cff rim light and volumetric glow,
obsidian #0d1117 background, depth of field, particles, ultra detailed, premium tech
brand key visual, wide empty space on the left for headline text,
--style raw --ar 16:9 --s 400 --c 6 --no people, text, logo, watermark, clutter
```

### 6.4 Social / OG image (1200×630 → use 1.91:1)
```
premium tech brand banner, floating mercury droplet with a soundwave meniscus,
mirror chrome, obsidian background with a soft radial blue glow at top,
spectrum rim light blue teal violet, lots of negative space for a title,
clean, modern, HDR, --style raw --ar 1.91:1 --s 300 --no text, logo, faces
```

### 6.5 Abstract background textures (tileable-ish)
```
abstract field of rippling liquid mercury, macro, mirror chrome micro-waves like an
oscilloscope, obsidian base, faint blue-teal-violet iridescence, dark, minimal,
high detail, seamless texture, --style raw --ar 16:9 --s 150 --c 2 --tile
--no text, objects, people
```

### 6.6 Mascot style — "voice specialist" (character continuity)
Generate one hero mascot, then use `--cref <its url> --cw 60` to keep the character consistent across
poses (idle / happy / focused / encouraging), matching the existing `public/characters` set.
```
a friendly abstract mascot shaped like a soft cloud droplet of luminous liquid,
smooth gradient body from violet #bc8cff to teal #2dd4bf, subtle chrome rim light,
simple serene face, floating music notes, obsidian background, flat-3d hybrid,
clean vector-friendly, centered, --style raw --ar 1:1 --s 180 --c 3
--no text, realistic human, harsh shadows
```

### 6.7 3D product / device mock mood (marketing)
```
sleek dark web app for vocal pitch training shown on a floating laptop,
glowing piano-roll and pitch waveform UI in blue teal violet on obsidian,
liquid mercury accents, studio product photography, HDR reflections, soft gradient
backdrop, premium, minimal, --style raw --ar 3:2 --s 250 --no clutter, text, logo, brand names
```

### Building a coherent set (workflow)
1. Generate **6.3 (hero)** first. Upscale the best.
2. Copy its image URL → append `--sref <url>` to 6.4, 6.5, 6.7 so the whole set shares one look.
3. For mascots use `--cref` (character) not `--sref` (style).
4. Keep a params log (seed, sref, prompt) so you can reproduce and iterate.

---

## 7. Copyright, Licensing & Production Playbook

**The single most important point: for a logo you want a _trademark_, not a copyright — and you want a
clean vector. MidJourney is superb for _ideation and imagery_, but it is the wrong final step for a
registrable logo.** Here's why and what to do.

### What MidJourney gives you (as of 2026 — verify current terms)
- **Ownership/commercial use:** Paid MidJourney plans grant you broad rights to *use* the images you
  generate commercially. Companies with **> USD 1M/yr revenue must be on the Pro or Mega plan** to use
  outputs commercially. Read the current [MidJourney Terms of Service](https://docs.midjourney.com/docs/terms-of-service) — terms change.
- **Copyright caveat:** In the US (and similarly in many jurisdictions), a purely AI-generated image
  **cannot be registered for copyright** because it lacks human authorship (US Copyright Office
  guidance, *Zarya of the Dawn* and subsequent). Practical effect: even though MidJourney lets you *use*
  it, **you may not be able to stop others from copying** a raw AI logo, and you can't register the image
  itself.
- **Similarity risk:** AI can output something close to existing art. Always reverse-image-search and
  trademark-search a candidate before committing.

### The recommended pipeline (copyright- and trademark-clean)
1. **Ideate in MidJourney** — use §6.1/§6.2 to explore droplet/M directions. Treat outputs as *mood and
   reference*, not final art.
2. **Rebuild the chosen mark as original vector** (Illustrator / Figma / Inkscape) — like the SVGs in
   `logo/`. Human-authored vector is **copyrightable** and gives you crisp scaling for favicons → billboards.
3. **Register a trademark** on the **wordmark ("MercuryPitch")** and the **logo mark**. Trademark protects
   your *brand use in commerce* regardless of the copyright status of the underlying image, and it's what
   actually stops competitors. (US: USPTO; EU: EUIPO; or use a service like a trademark attorney.)
   - Do a knockout search first (USPTO TESS / EUIPO eSearch) for "MercuryPitch" in music-software classes
     (Nice class 9 software, 41 education/entertainment).
   - **Full step-by-step global filing guide (EU-based → worldwide via Madrid Protocol): see
     [`TRADEMARK.md`](./TRADEMARK.md).**
4. **Keep records** — save prompts, seeds, and your vector source files as authorship/provenance evidence.
5. **Use MJ imagery for the _surround_** — hero art, backgrounds, OG images, social — where "can't
   copyright the raster" matters far less than for the logo, and speed matters more.

### If you would rather stay MidJourney-only for the logo
Acceptable for an MVP/side-project, with these mitigations:
- Be on the correct paid tier for your revenue.
- Reverse-image + trademark search the result.
- Recreate at least a clean 1-color version in vector for favicons/small sizes (MJ raster fails there).
- Understand you likely **can't register copyright** on the image and enforcement is weaker.

### Fonts
- Inter, Outfit, Plus Jakarta Sans are all **open-source (SIL Open Font License)** — free for commercial
  use, including in a logo wordmark and embedded in the app. Keep a copy of the license.

---

## 8. Quick-start checklist
- [ ] Pick the tagline (§1) and confirm personality direction.
- [ ] Approve the logo direction (droplet+wave / liquid-M) — SVGs in `logo/` are the v0.
- [ ] Add the Mercury/Chrome tokens (§3) to `src/styles/app.css`.
- [ ] Generate the hero (§6.3), lock its `--sref`, produce the set.
- [ ] Vectorize the final logo; export favicon.ico/png, 512/192/32/16, apple-touch, maskable icon, og-image.
- [ ] Trademark knockout search on "MercuryPitch"; file wordmark + mark.
- [ ] Replace `public/favicon*`, `og-image.png` with the finalized exports.
