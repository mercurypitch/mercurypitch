#!/usr/bin/env python3
import pathlib, subprocess, sys
import os as _os
# Portable paths: SCRIPT_DIR is docs/branding/scripts; REPO is the repo root.
SCRIPT_DIR = pathlib.Path(__file__).resolve().parent
WORK = pathlib.Path(_os.environ.get("BRAND_WORK", SCRIPT_DIR / ".work")); WORK.mkdir(parents=True, exist_ok=True)
SP = WORK
REPO = pathlib.Path(__file__).resolve().parents[3]
CHROME = _os.environ.get("CHROME", "/opt/pw-browsers/chromium-1194/chrome-linux/chrome")
EXPL = REPO / "docs/branding/logo/explorations"
OUT = SP / "rendered"; OUT.mkdir(exist_ok=True)

variants = [
    ("v1-meniscus","Meniscus","Liquid-premium"),
    ("v2-glyph","Mercury Glyph ☿","Sleek pro-tech"),
    ("v3-droplet-note","Droplet-Note","Warm & musical"),
    ("v4-orbit","Orbit Pitch","Cosmic premium"),
    ("v5-monoline","Monoline","Minimal Swiss"),
    ("v6-soundwell","Soundwell","Liquid-premium"),
]

WRAP = """<!doctype html><html><head><meta charset="utf-8"><style>
html,body{{margin:0;padding:0;background:transparent}}
#b{{width:100vw;height:100vh;display:grid;place-items:center}}
#b svg{{width:96%;height:96%}}
</style></head><body><div id="b">{svg}</div></body></html>"""

def render(svg_path, out_png, size):
    svg = pathlib.Path(svg_path).read_text()
    tmp = SP / "_r.html"
    tmp.write_text(WRAP.format(svg=svg))
    subprocess.run([CHROME,"--headless","--no-sandbox","--disable-gpu","--hide-scrollbars",
        "--default-background-color=00000000","--force-device-scale-factor=1",
        f"--window-size={size},{size}",f"--screenshot={out_png}",f"file://{tmp}"],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)

for key,_,_ in variants:
    render(EXPL/f"{key}.svg", OUT/f"{key}.png", 512)
    print("rendered", key)
print("done")
