#!/usr/bin/env python3
import pathlib
import os as _os
# Portable paths: SCRIPT_DIR is docs/branding/scripts; REPO is the repo root.
SCRIPT_DIR = pathlib.Path(__file__).resolve().parent
WORK = pathlib.Path(_os.environ.get("BRAND_WORK", SCRIPT_DIR / ".work")); WORK.mkdir(parents=True, exist_ok=True)
SP = WORK
REPO = pathlib.Path(__file__).resolve().parents[3]
EXPL = REPO / "docs/branding/logo/explorations"
tpl = (SCRIPT_DIR/"templates"/"logos.template.html").read_text()

def face(fam,w,f):
    b=(SCRIPT_DIR/"fonts"/f).read_text().strip()
    return f"@font-face{{font-family:'{fam}';font-weight:{w};font-display:swap;src:url(data:font/woff2;base64,{b}) format('woff2');}}"
fonts="\n".join([face("Outfit",600,"outfit600.b64"),face("Outfit",700,"outfit700.b64"),
                 face("Inter",400,"inter400.b64"),face("Inter",500,"inter500.b64"),face("Inter",600,"inter600.b64")])

def svg(key): return (EXPL/f"{key}.svg").read_text().strip()

# card data: key, tag, name, rationale, recommended
cards = [
 ("v1-meniscus","Liquid-premium","Meniscus","A quicksilver sphere half-filled with liquid — the waterline IS the pitch wave. The clearest ‘mercury + pitch’ read, and gorgeous as an app tile.",True),
 ("v2-glyph","Sleek pro-tech","Mercury Glyph ☿","The alchemical symbol for Mercury, rebuilt: a pitch wave inside the head-ring and as the cross-bar. Self-contained badge, deeply on-name, unmistakable.",True),
 ("v6-soundwell","Liquid-premium","Soundwell","A mercury droplet with concentric ripples — liquid meeting sound propagation. Elegant, distinctive, reads instantly at any size.",True),
 ("v5-monoline","Minimal Swiss","Monoline","One continuous rising pitch-stroke ending in a mercury bead. Ultra-minimal, timeless, cheapest to reproduce anywhere.",False),
 ("v3-droplet-note","Warm & musical","Droplet-Note","A mercury droplet doubling as a note-head on a wave staff. Friendly and approachable — the most ‘music-first’ option.",False),
 ("v4-orbit","Cosmic premium","Orbit Pitch","Mercury the planet with an orbit that resolves into a waveform. The most literal ‘planet’ read; busiest at tiny sizes.",False),
]

def card(key,tag,name,rat,rec):
    s = svg(key)
    recattr = " rec" if rec else ""
    badge = '<div class="badge"><span class="rec-pill">◆ Lead</span></div>' if rec else ""
    # favicon strip reuses the same svg at CSS sizes
    strip = "".join(f'<div class="fav f{sz}">{s}</div>' for sz in (16,24,32,48))
    return f'''<article class="card{recattr}">{badge}
  <div class="top">
    <div class="stage">{s}</div>
    <div class="side"><span class="tag">{tag}</span><h3>{name}</h3><p>{rat}</p></div>
  </div>
  <div class="previews">
    <span class="lbl">Favicon</span>{strip}
    <span class="spacer"></span>
    <span class="lbl">App tile</span><div class="apptile">{s}</div>
  </div>
</article>'''

cards_html="\n".join(card(*c) for c in cards)
out=tpl.replace("__FONTS__",fonts).replace("__CARDS__",cards_html)
dest=REPO/"docs/branding/logo-explorations.html"
dest.write_text(out)
print("wrote",dest,len(out))
