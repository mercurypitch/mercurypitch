#!/usr/bin/env python3
"""Render final Sound Globe PNGs (fonts embedded) + full favicon export set."""
import pathlib, subprocess, shutil
from PIL import Image, ImageDraw
import os as _os
# Portable paths: SCRIPT_DIR is docs/branding/scripts; REPO is the repo root.
SCRIPT_DIR = pathlib.Path(__file__).resolve().parent
WORK = pathlib.Path(_os.environ.get("BRAND_WORK", SCRIPT_DIR / ".work")); WORK.mkdir(parents=True, exist_ok=True)
SP = WORK
REPO = pathlib.Path(__file__).resolve().parents[3]
CHROME = _os.environ.get("CHROME", "/opt/pw-browsers/chromium-1194/chrome-linux/chrome")
SG = REPO / "docs/branding/logo/soundglobe"
FAV = REPO / "docs/branding/favicon/soundglobe"; FAV.mkdir(parents=True, exist_ok=True)
OBS = (13,17,23,255)

def b64(f): return (SCRIPT_DIR/"fonts"/f).read_text().strip()
FONTFACE = "".join(
    f"@font-face{{font-family:'{fam}';font-weight:{w};font-display:block;src:url(data:font/woff2;base64,{b64(f)}) format('woff2');}}"
    for fam,w,f in [("Outfit",600,"outfit600.b64"),("Outfit",700,"outfit700.b64"),
                    ("Inter",400,"inter400.b64"),("Inter",500,"inter500.b64")])

def render(svg_file, out_png, w, h, transparent=True, bg=None, scale=1):
    svg = pathlib.Path(svg_file).read_text()
    body_bg = bg if bg else "transparent"
    wrap = f"""<!doctype html><meta charset="utf-8"><style>{FONTFACE}
    html,body{{margin:0;height:100%;background:{body_bg}}} svg{{display:block;width:100vw;height:100vh}}</style>{svg}"""
    tmp = SP/"_fin.html"; tmp.write_text(wrap)
    args=[CHROME,"--headless","--no-sandbox","--disable-gpu","--hide-scrollbars",
        f"--force-device-scale-factor={scale}",f"--window-size={w},{h}",f"--screenshot={out_png}",f"file://{tmp}"]
    if transparent: args.insert(5,"--default-background-color=00000000")
    subprocess.run(args,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,check=True)
    if scale!=1:
        from PIL import Image as _I; _I.open(out_png).resize((w,h),_I.LANCZOS).save(out_png)

# --- deliverable PNGs (into the soundglobe folder) ---
render(SG/"soundglobe-og.svg", SG/"soundglobe-og.png", 1200, 630, transparent=False, bg="#0d1117", scale=2)
render(SG/"soundglobe-lockup-horizontal.svg", SG/"soundglobe-lockup-horizontal.png", 1040, 280)
render(SG/"soundglobe-lockup-stacked.svg", SG/"soundglobe-lockup-stacked.png", 720, 600)
render(SG/"soundglobe-mark.svg", SG/"soundglobe-mark.png", 512, 512)
render(SG/"soundglobe-app-icon.svg", SG/"soundglobe-app-icon.png", 512, 512)
print("rendered deliverable PNGs")

# --- favicon masters: full (>=48) and compact (<=32) ---
render(SG/"soundglobe-mark.svg", SP/"sg_full.png", 512, 512)
render(SG/"soundglobe-mark-compact.svg", SP/"sg_compact.png", 512, 512)
full = Image.open(SP/"sg_full.png").convert("RGBA")
comp = Image.open(SP/"sg_compact.png").convert("RGBA")

# transparent PNGs
comp.resize((16,16),Image.LANCZOS).save(FAV/"favicon-16.png")
comp.resize((32,32),Image.LANCZOS).save(FAV/"favicon-32.png")
full.resize((48,48),Image.LANCZOS).save(FAV/"favicon-48.png")
full.resize((192,192),Image.LANCZOS).save(FAV/"icon-192.png")
full.resize((512,512),Image.LANCZOS).save(FAV/"icon-512.png")
# apple-touch (opaque obsidian)
at=Image.new("RGBA",(180,180),OBS); lg=full.resize((150,150),Image.LANCZOS); at.alpha_composite(lg,(15,15))
at.convert("RGB").save(FAV/"apple-touch-icon-180.png")
# maskable (safe zone on rounded obsidian)
def rounded(size,frac=.22):
    im=Image.new("RGBA",(size,size),(0,0,0,0)); d=ImageDraw.Draw(im)
    d.rounded_rectangle([0,0,size-1,size-1],int(size*frac),fill=OBS); return im
msk=rounded(512); msk.alpha_composite(full.resize((372,372),Image.LANCZOS),(70,70)); msk.save(FAV/"maskable-512.png")
# .ico (compact for small sizes)
comp.resize((256,256),Image.LANCZOS).save(FAV/"favicon.ico",sizes=[(16,16),(32,32),(48,48),(64,64)])
# svg copies
shutil.copy(SG/"soundglobe-mark.svg", FAV/"favicon.svg")
shutil.copy(SG/"soundglobe-mark-compact.svg", FAV/"favicon-compact.svg")
print("favicon set:", ", ".join(sorted(p.name for p in FAV.iterdir())))
