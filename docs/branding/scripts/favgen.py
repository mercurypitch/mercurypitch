#!/usr/bin/env python3
import pathlib, shutil
from PIL import Image
import os as _os
# Portable paths: SCRIPT_DIR is docs/branding/scripts; REPO is the repo root.
SCRIPT_DIR = pathlib.Path(__file__).resolve().parent
WORK = pathlib.Path(_os.environ.get("BRAND_WORK", SCRIPT_DIR / ".work")); WORK.mkdir(parents=True, exist_ok=True)
SP = WORK
REPO = pathlib.Path(__file__).resolve().parents[3]
RENDER = SP / "rendered"
EXPL = REPO / "docs/branding/logo/explorations"
FAVROOT = REPO / "docs/branding/favicon"
OBSIDIAN = (13, 17, 23, 255)

# which variants get a full favicon set
sets = {"v1-meniscus": "v1", "v2-glyph": "v2", "v6-soundwell": "v6"}

def rounded_bg(size, radius_frac=0.22, bg=OBSIDIAN):
    from PIL import ImageDraw
    im = Image.new("RGBA", (size, size), (0,0,0,0))
    d = ImageDraw.Draw(im)
    r = int(size*radius_frac)
    d.rounded_rectangle([0,0,size-1,size-1], r, fill=bg)
    return im

for key, short in sets.items():
    master = Image.open(RENDER/f"{key}.png").convert("RGBA")   # 512 transparent
    out = FAVROOT / short
    out.mkdir(parents=True, exist_ok=True)
    # transparent PNGs (browser favicon + PWA)
    for sz, name in [(16,"favicon-16.png"),(32,"favicon-32.png"),(48,"favicon-48.png"),
                     (192,"icon-192.png"),(512,"icon-512.png")]:
        master.resize((sz,sz), Image.LANCZOS).save(out/name)
    # apple-touch: opaque, obsidian ground (iOS ignores alpha)
    at = Image.new("RGBA",(180,180),OBSIDIAN)
    logo = master.resize((150,150), Image.LANCZOS)
    at.alpha_composite(logo,(15,15))
    at.convert("RGB").save(out/"apple-touch-icon-180.png")
    # maskable: logo at 70% inside safe zone on obsidian rounded tile
    msk = rounded_bg(512, 0.22)
    lg = master.resize((360,360), Image.LANCZOS)
    msk.alpha_composite(lg,(76,76))
    msk.save(out/"maskable-512.png")
    # multi-res .ico
    master.resize((256,256),Image.LANCZOS).save(out/"favicon.ico",
        sizes=[(16,16),(32,32),(48,48),(64,64)])
    # svg copy
    shutil.copy(EXPL/f"{key}.svg", out/"favicon.svg")
    print("favicon set:", short, "->", ", ".join(sorted(p.name for p in out.iterdir())))
print("done")
