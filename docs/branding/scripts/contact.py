#!/usr/bin/env python3
import pathlib
from PIL import Image, ImageDraw, ImageFont
import os as _os
# Portable paths: SCRIPT_DIR is docs/branding/scripts; REPO is the repo root.
SCRIPT_DIR = pathlib.Path(__file__).resolve().parent
WORK = pathlib.Path(_os.environ.get("BRAND_WORK", SCRIPT_DIR / ".work")); WORK.mkdir(parents=True, exist_ok=True)
SP = WORK
OUT = SP / "rendered"
variants = [
    ("v1-meniscus","V1 Meniscus","Liquid-premium"),
    ("v2-glyph","V2 Mercury Glyph","Sleek pro-tech"),
    ("v3-droplet-note","V3 Droplet-Note","Warm & musical"),
    ("v4-orbit","V4 Orbit Pitch","Cosmic premium"),
    ("v5-monoline","V5 Monoline","Minimal Swiss"),
    ("v6-soundwell","V6 Soundwell","Liquid-premium"),
]
def font(sz):
    for p in ["/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
              "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"]:
        if pathlib.Path(p).exists(): return ImageFont.truetype(p, sz)
    return ImageFont.load_default()

cols, rows = 3, 2
tile = 300; pad = 24; labelh = 54; favstrip = 60
cw = tile + pad
ch = tile + labelh + pad
W = cols*cw + pad
H = rows*ch + pad + favstrip
img = Image.new("RGB",(W,H),(13,17,23))          # obsidian
imgL = Image.new("RGB",(W,H),(238,241,245))       # light ground
d = ImageDraw.Draw(img); dL = ImageDraw.Draw(imgL)
fb = font(20); fs = font(14); ff = font(13)

for i,(key,name,pers) in enumerate(variants):
    r,c = divmod(i,cols)
    x = pad + c*cw; y = pad + r*ch
    logo = Image.open(OUT/f"{key}.png").convert("RGBA").resize((tile,tile))
    # dark sheet: card
    d.rounded_rectangle([x,y,x+tile,y+tile],18,fill=(22,27,34))
    img.paste(logo,(x,y),logo)
    d.text((x+4,y+tile+8),name,font=fb,fill=(230,237,243))
    d.text((x+4,y+tile+32),pers,font=fs,fill=(120,180,255))
    # light sheet
    dL.rounded_rectangle([x,y,x+tile,y+tile],18,fill=(255,255,255))
    imgL.paste(logo,(x,y),logo)
    dL.text((x+4,y+tile+8),name,font=fb,fill=(31,35,40))
    dL.text((x+4,y+tile+32),pers,font=fs,fill=(9,105,218))

# favicon strip along bottom (dark)
fy = H - favstrip + 6
d.text((pad,fy+14),"favicon @32px →",font=ff,fill=(150,160,175))
fx = pad + 130
for key,_,_ in variants:
    fav = Image.open(OUT/f"{key}.png").convert("RGBA").resize((32,32))
    d.rounded_rectangle([fx-6,fy+4,fx+38,fy+46],8,fill=(22,27,34))
    img.paste(fav,(fx,fy+9),fav)
    fx += 64

img.save(SP/"contact_dark.png")
imgL.save(SP/"contact_light.png")
print("saved contact sheets", W, H)
