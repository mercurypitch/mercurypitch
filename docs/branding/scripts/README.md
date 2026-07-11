# Branding generation scripts

The scripts that generated the assets in `docs/branding/`. They're committed so the
identity is reproducible — regenerate SVGs, PNGs, favicon sets, OG images, and the
HTML brand boards from source rather than hand-editing binaries.

## Requirements
- **Python 3** with **Pillow** (`pip install Pillow`) — used for PNG compositing,
  favicon `.ico` packing, and contact sheets.
- **Chromium** — used to rasterize SVG → PNG. Scripts default to the pre-installed
  path `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`; override with the
  `CHROME` env var (any Chrome/Chromium binary works):
  ```sh
  CHROME=/usr/bin/chromium python3 docs/branding/scripts/finalize_sg.py
  ```
- No network needed. Fonts (Outfit, Inter) are bundled as base64 in `fonts/` and the
  HTML templates live in `templates/`.

## Paths
Every script derives the repo root from its own location (`__file__`), so run them from
anywhere. Intermediate render artifacts go to `scripts/.work/` (git-ignored); final
assets are written into `docs/branding/…`.

## What each script does
| Script | Output |
| --- | --- |
| `soundglobe.py` | The finalized **Sound Globe** vector set: mark (+flat/compact/mono), app icon, lockups, OG SVG → `logo/soundglobe/`. Also refreshes `explorations/v15-soundglobe.svg`. Edit the `BANDS` / `PHASE` / `meridians()` here to retune the mark. |
| `finalize_sg.py` | Renders the Sound Globe PNGs (OG, lockups, mark) with fonts embedded, and the full favicon export set → `favicon/soundglobe/`. |
| `render.py` | Rasterizes the round-I exploration SVGs (v1–v6) to 512px PNG. |
| `render2.py` | Rasterizes the round-II exploration SVGs (v7–v15) + builds dark/light contact sheets. |
| `render_sg.py` | Quick Sound Globe preview + contact sheet (dev aid). |
| `contact.py` | Builds the round-I contact sheets. |
| `favgen.py` | Generates favicon export sets for the three round-I leads → `favicon/{v1,v2,v6}/`. |
| `build_board.py` | Builds `brand-board.html` from `templates/brand-board.template.html`. |
| `build_logos.py` | Builds `logo-explorations.html` (round I). |
| `build_logos2.py` | Builds `logo-explorations-2.html` (round II). |
| `build_showcase.py` | Builds `soundglobe-final.html` (finalization showcase). |

## Typical regen flow (Sound Globe)
```sh
python3 docs/branding/scripts/soundglobe.py      # vectors
python3 docs/branding/scripts/finalize_sg.py     # PNGs + favicons (needs Chromium)
python3 docs/branding/scripts/build_showcase.py  # showcase HTML
```

## Bundled inputs
- `fonts/*.b64` — Outfit 600/700, Inter 400/500/600 (woff2, base64). SIL Open Font
  License; embedded so renders and boards are self-contained.
- `templates/*.template.html` — page shells for the brand boards; the build scripts
  inject the fonts, SVGs, and prompt/card content into these.
