#!/usr/bin/env python3
import pathlib, html

import os as _os
# Portable paths: SCRIPT_DIR is docs/branding/scripts; REPO is the repo root.
SCRIPT_DIR = pathlib.Path(__file__).resolve().parent
WORK = pathlib.Path(_os.environ.get("BRAND_WORK", SCRIPT_DIR / ".work")); WORK.mkdir(parents=True, exist_ok=True)
SP = WORK
REPO = pathlib.Path(__file__).resolve().parents[3]
tpl = (SCRIPT_DIR/"templates"/"brand-board.template.html").read_text()

# ---- fonts ----
def face(fam, weight, fname):
    b64 = (SCRIPT_DIR/"fonts" / fname).read_text().strip()
    return (f"@font-face{{font-family:'{fam}';font-style:normal;font-weight:{weight};"
            f"font-display:swap;src:url(data:font/woff2;base64,{b64}) format('woff2');}}")
fonts = "\n".join([
    face("Outfit", 600, "outfit600.b64"),
    face("Outfit", 700, "outfit700.b64"),
    face("Inter", 400, "inter400.b64"),
    face("Inter", 500, "inter500.b64"),
    face("Inter", 600, "inter600.b64"),
])

# ---- svg marks (inner file content) ----
def svg(name):
    return (REPO / "docs/branding/logo" / name).read_text().strip()

# ---- prompts ----
PROMPTS = [
 ("6.1","Primary logo mark","droplet + wave · --ar 1:1",
  "minimalist app logo, a single suspended droplet of liquid mercury / quicksilver,\n"
  "mirror-chrome HDR surface, a smooth sine soundwave rippling across its surface,\n"
  "thin rim light in electric blue #58a6ff to teal #2dd4bf to violet #bc8cff,\n"
  "deep obsidian #0d1117 background, centered, symmetrical, high contrast,\n"
  "studio product render, octane, crisp vector-ready silhouette, negative space,\n"
  "--style raw --ar 1:1 --s 250 --c 4 --no text, letters, words, mockup, hands, gradient banding"),
 ("6.2","Liquid-metal “M” monogram","app icon · --ar 1:1",
  "single letterform \"M\" sculpted from flowing liquid mercury, mirror chrome,\n"
  "the M formed by two soundwave peaks, glossy HDR reflections, one small mercury\n"
  "droplet resting in the valley, rounded-square app icon on obsidian #0d1117,\n"
  "subtle spectrum rim light blue-teal-violet, minimal, iconic, centered,\n"
  "3d render, studio lighting, --style raw --ar 1:1 --s 200 --c 3\n"
  "--no serif, extra letters, words, texture noise, drop shadow"),
 ("6.3","Landing hero — key visual","--ar 16:9 · generate first, use as --sref",
  "a ribbon of liquid mercury suspended in dark space, its surface rippling into a\n"
  "glowing pitch waveform, mirror-chrome reflections, HDR, cinematic studio lighting,\n"
  "electric blue #58a6ff, teal #2dd4bf and violet #bc8cff rim light and volumetric glow,\n"
  "obsidian #0d1117 background, depth of field, particles, ultra detailed, premium tech\n"
  "brand key visual, wide empty space on the left for headline text,\n"
  "--style raw --ar 16:9 --s 400 --c 6 --no people, text, logo, watermark, clutter"),
 ("6.4","Social / OG image","--ar 1.91:1",
  "premium tech brand banner, floating mercury droplet with a soundwave meniscus,\n"
  "mirror chrome, obsidian background with a soft radial blue glow at top,\n"
  "spectrum rim light blue teal violet, lots of negative space for a title,\n"
  "clean, modern, HDR, --style raw --ar 1.91:1 --s 300 --no text, logo, faces"),
 ("6.5","Abstract background texture","--ar 16:9 --tile",
  "abstract field of rippling liquid mercury, macro, mirror chrome micro-waves like an\n"
  "oscilloscope, obsidian base, faint blue-teal-violet iridescence, dark, minimal,\n"
  "high detail, seamless texture, --style raw --ar 16:9 --s 150 --c 2 --tile\n"
  "--no text, objects, people"),
 ("6.6","Mascot — “voice specialist”","--ar 1:1 · then --cref for poses",
  "a friendly abstract mascot shaped like a soft cloud droplet of luminous liquid,\n"
  "smooth gradient body from violet #bc8cff to teal #2dd4bf, subtle chrome rim light,\n"
  "simple serene face, floating music notes, obsidian background, flat-3d hybrid,\n"
  "clean vector-friendly, centered, --style raw --ar 1:1 --s 180 --c 3\n"
  "--no text, realistic human, harsh shadows"),
 ("6.7","3D product mock — mood","--ar 3:2",
  "sleek dark web app for vocal pitch training shown on a floating laptop,\n"
  "glowing piano-roll and pitch waveform UI in blue teal violet on obsidian,\n"
  "liquid mercury accents, studio product photography, HDR reflections, soft gradient\n"
  "backdrop, premium, minimal, --style raw --ar 3:2 --s 250 --no clutter, text, logo, brand names"),
]

def prompt_block(num, title, tag, body):
    esc = html.escape(body)
    openattr = " open" if num == "6.1" else ""
    return (f'<details class="prompt"{openattr}>'
            f'<summary><span class="caret">›</span>{html.escape(num)} · {html.escape(title)}'
            f'<span class="tag">{html.escape(tag)}</span></summary>'
            f'<div class="body"><div class="code"><button class="copy" aria-label="Copy prompt">Copy</button>'
            f'<pre>{esc}</pre></div></div></details>')

prompts_html = "\n".join(prompt_block(*p) for p in PROMPTS)

out = (tpl
       .replace("__FONTS__", fonts)
       .replace("__MARK__", svg("mercurypitch-mark.svg"))
       .replace("__ICON__", svg("mercurypitch-icon-M.svg"))
       .replace("__LOCKUP__", svg("mercurypitch-lockup.svg"))
       .replace("__PROMPTS__", prompts_html))

dest = REPO / "docs/branding/brand-board.html"
dest.write_text(out)
print("wrote", dest, len(out), "bytes")
