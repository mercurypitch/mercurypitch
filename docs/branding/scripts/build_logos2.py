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

cards = [
 ("v7-glassorb","Glassy","Glass Orb","A translucent glass sphere with the pitch wave refracted through the lens — glossy speculars, spectrum rim. Modern, premium, and it glows.",True),
 ("v8-liquidglass","Glassy","Liquid Glass","A ‘liquid-glass’ squircle pebble (the current design-era look), blue→violet with a top sheen and a wave. Feels instantly like a tappable app.",False),
 ("v9-prismdrop","Glassy · dispersion","Prism Drop","A glass droplet splitting light into the brand’s blue/teal/violet — literally where the palette is born. The most conceptual of the set.",False),
 ("v10-cratered","Planet","Cratered Planet","Grey, cratered Mercury with an orbit ring that resolves into a waveform on the near side. The realistic ‘planet’ read.",False),
 ("v11-terminator","Planet","Terminator Wave","Mercury’s day/night line, drawn as a glowing pitch wave splitting the sphere. Elegant, unmistakable, gorgeous small.",True),
 ("v12-crescent","Planet","Crescent","A lit gibbous Mercury with a glowing sine terminator and a spectrum limb. Calm and cosmic.",False),
 ("v13-beads","Hybrid · metal","Mercury Beads","Real quicksilver beads coalescing along a pitch contour — the most literally ‘mercury the metal,’ with a metaball gooeyness.",False),
 ("v14-tuningfork","Hybrid · music","Tuning Fork","A chrome tuning fork shedding a mercury droplet while its vibration rings out. Precision meets music, very literal.",False),
 ("v15-soundglobe","Hybrid · techy","Sound Globe","A globe whose latitude lines ripple like waveforms — a planet made of sound. Techy, distinctive, scales cleanly.",True),
]
def card(key,tag,name,rat,rec):
    s=svg(key); recattr=" rec" if rec else ""
    badge='<div class="badge"><span class="rec-pill">◆ Lead</span></div>' if rec else ""
    strip="".join(f'<div class="fav f{sz}">{s}</div>' for sz in (16,24,32,48))
    return f'''<article class="card{recattr}">{badge}
  <div class="top"><div class="stage">{s}</div>
    <div class="side"><span class="tag">{tag}</span><h3>{name}</h3><p>{rat}</p></div></div>
  <div class="previews"><span class="lbl">Favicon</span>{strip}<span class="spacer"></span>
    <span class="lbl">App tile</span><div class="apptile">{s}</div></div>
</article>'''
cards_html="\n".join(card(*c) for c in cards)

out=(tpl.replace("__FONTS__",fonts).replace("__CARDS__",cards_html)
     .replace("<title>MercuryPitch — Logo Explorations</title>","<title>MercuryPitch — Logo Explorations II</title>")
     .replace("Six marks, four personalities","Round II · glass, planets & hybrids")
     .replace("A fresh take on the “mercury” symbol — each concept is a distinct idea, not a recolor, and each is drawn to survive at 16&nbsp;px. Recommended leads are ringed. Every mark is production SVG; favicon export sets exist for the three leads.",
              "Nine more directions: three <b>glassy / liquid-glass</b>, three <b>planet-Mercury</b>, three <b>hybrids</b>. One lead is ringed per group — but they’re all yours to pick from. Round I (Meniscus, Glyph, Soundwell…) still lives alongside these.")
     .replace("vectors in <span class=\"mono\">docs/branding/logo/explorations/</span>; drop-in favicon sets (16/32/48, apple-touch, maskable, .ico, .svg) in <span class=\"mono\">docs/branding/favicon/{v1,v2,v6}/</span>. Pick one and I’ll wire it into <span class=\"mono\">public/</span> + <span class=\"mono\">index.html</span> and generate the OG image.",
              "vectors + 512px PNGs in <span class=\"mono\">docs/branding/logo/explorations/</span> (v7–v15). Tell me the winner (from either round) and I’ll finalise it: lockups, favicon set, OG image, and wire it into <span class=\"mono\">public/</span> + <span class=\"mono\">index.html</span>."))
dest=REPO/"docs/branding/logo-explorations-2.html"
dest.write_text(out); print("wrote",dest,len(out))
