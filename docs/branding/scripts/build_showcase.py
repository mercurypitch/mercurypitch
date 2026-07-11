#!/usr/bin/env python3
import pathlib, base64
import os as _os
# Portable paths: SCRIPT_DIR is docs/branding/scripts; REPO is the repo root.
SCRIPT_DIR = pathlib.Path(__file__).resolve().parent
WORK = pathlib.Path(_os.environ.get("BRAND_WORK", SCRIPT_DIR / ".work")); WORK.mkdir(parents=True, exist_ok=True)
SP = WORK
REPO = pathlib.Path(__file__).resolve().parents[3]
SG = REPO/"docs/branding/logo/soundglobe"
def b64f(f): return (SCRIPT_DIR/"fonts"/f).read_text().strip()
FONTS="".join(f"@font-face{{font-family:'{fam}';font-weight:{w};font-display:swap;src:url(data:font/woff2;base64,{b64f(f)}) format('woff2');}}"
  for fam,w,f in [("Outfit",600,"outfit600.b64"),("Outfit",700,"outfit700.b64"),("Inter",400,"inter400.b64"),("Inter",500,"inter500.b64"),("Inter",600,"inter600.b64")])
def svg(n): return (SG/n).read_text().strip()
def datauri(n):
    return "data:image/png;base64,"+base64.b64encode((SG/n).read_bytes()).decode()
og = datauri("soundglobe-og.png")

HTML=f"""<title>MercuryPitch — Sound Globe (Final)</title>
<style>
{FONTS}
:root{{color-scheme:dark light;
 --bg:#0d1117;--panel:#161b22;--card:#1c2128;--line:#30363d;--hair:rgba(230,237,243,.08);
 --fg:#e6edf3;--muted:#a8b3bf;--faint:#6e7681;--blue:#58a6ff;
 --spectrum:linear-gradient(120deg,#58a6ff,#2dd4bf 50%,#bc8cff);
 --tile:radial-gradient(120% 120% at 50% 14%,#12181f,#090c11);
 --shadow:0 20px 50px -26px rgba(0,0,0,.85);}}
:root[data-theme=light]{{color-scheme:light;--bg:#eef1f5;--panel:#fff;--card:#fff;--line:#d6dbe1;--hair:rgba(31,35,40,.07);
 --fg:#1f2328;--muted:#525960;--faint:#7d8590;--blue:#0969da;--tile:radial-gradient(120% 120% at 50% 14%,#fff,#e9edf2);--shadow:0 18px 44px -30px rgba(31,35,40,.4);}}
@media (prefers-color-scheme:light){{:root:not([data-theme=dark]){{color-scheme:light;--bg:#eef1f5;--panel:#fff;--card:#fff;--line:#d6dbe1;--hair:rgba(31,35,40,.07);--fg:#1f2328;--muted:#525960;--faint:#7d8590;--blue:#0969da;--tile:radial-gradient(120% 120% at 50% 14%,#fff,#e9edf2);}}}}
*{{box-sizing:border-box}}
body{{margin:0;background:var(--bg);color:var(--fg);font-family:'Inter',ui-sans-serif,system-ui,sans-serif;-webkit-font-smoothing:antialiased;line-height:1.6}}
.wrap{{max-width:1060px;margin:0 auto;padding:0 24px}}
h1,h2,h3,.disp{{font-family:'Outfit',sans-serif;font-weight:700;letter-spacing:-.02em;margin:0;text-wrap:balance}}
.eyebrow{{font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:var(--faint);font-weight:600}}
.mono{{font-family:ui-monospace,Menlo,Consolas,monospace}}
.lead{{color:var(--muted);font-size:18px}}
.toggle{{position:fixed;top:16px;right:16px;z-index:50;display:flex;gap:2px;background:color-mix(in srgb,var(--panel) 82%,transparent);backdrop-filter:blur(8px);border:1px solid var(--line);border-radius:999px;padding:4px}}
.toggle button{{all:unset;cursor:pointer;font-size:12px;font-weight:600;color:var(--muted);padding:6px 12px;border-radius:999px}}
.toggle button[aria-pressed=true]{{background:var(--card);color:var(--fg);box-shadow:var(--shadow)}}
header{{padding:84px 0 26px}}
.kick{{display:flex;align-items:center;gap:10px;margin-bottom:18px}}
.dot{{width:7px;height:7px;border-radius:50%;background:var(--spectrum)}}
.hero{{display:flex;align-items:center;gap:28px;flex-wrap:wrap}}
.hero .m{{width:132px;height:132px;flex:none}}
.hero h1{{font-size:clamp(38px,6vw,60px);line-height:1}}
.hero h1 .g{{background:var(--spectrum);-webkit-background-clip:text;background-clip:text;color:transparent}}
.hero p{{margin-top:12px;max-width:52ch}}
section{{padding:44px 0;border-top:1px solid var(--hair)}}
.sh{{margin-bottom:26px}} .sh h2{{font-size:clamp(22px,3vw,30px)}} .sh p{{color:var(--muted);margin-top:6px}}
.grid{{display:grid;gap:18px}}
.card{{background:var(--panel);border:1px solid var(--line);border-radius:18px;box-shadow:var(--shadow);overflow:hidden}}
.g3{{grid-template-columns:repeat(3,1fr)}} .g2{{grid-template-columns:repeat(2,1fr)}}
.stage{{aspect-ratio:16/11;display:grid;place-items:center;padding:30px}}
.stage svg{{width:100%;height:100%;max-height:190px}}
.dark{{background:var(--tile)}} .light{{background:radial-gradient(120% 120% at 50% 14%,#fff,#e9edf2)}}
.cap{{padding:13px 18px;border-top:1px solid var(--hair);font-size:13px;color:var(--muted)}}
.cap b{{color:var(--fg);font-family:'Outfit',sans-serif;font-weight:600}}
.favrow{{display:flex;align-items:center;gap:22px;flex-wrap:wrap;padding:26px}}
.fav{{display:grid;place-items:center;background:var(--tile);border:1px solid var(--hair);border-radius:8px}}
.fav svg{{width:74%;height:74%}}
.f16{{width:16px;height:16px}}.f32{{width:32px;height:32px}}.f48{{width:48px;height:48px}}.f64{{width:64px;height:64px}}
.tile{{width:118px;height:118px;border-radius:26px;overflow:hidden;box-shadow:var(--shadow);background:var(--tile)}}
.tile svg{{width:100%;height:100%}}
.lockcard .stage{{aspect-ratio:auto;min-height:150px}}
.ogimg{{width:100%;display:block;border-radius:14px;border:1px solid var(--line)}}
.note{{background:color-mix(in srgb,var(--blue) 8%,transparent);border-left:3px solid var(--blue);border-radius:0 12px 12px 0;padding:14px 18px;font-size:14px;margin-top:18px}}
.files{{columns:2;gap:26px;font-size:13.5px;color:var(--muted)}} .files div{{break-inside:avoid;padding:3px 0}} .files b{{color:var(--fg)}}
footer{{padding:40px 0 72px;color:var(--faint);font-size:13px;border-top:1px solid var(--hair)}}
@media(max-width:760px){{.g3,.g2,.files{{grid-template-columns:1fr;columns:1}}}}
</style>
<div class="toggle" role="group" aria-label="Theme"><button id="tl" aria-pressed="false">Light</button><button id="td" aria-pressed="true">Dark</button></div>

<header><div class="wrap">
 <div class="kick"><span class="dot"></span><span class="eyebrow">MercuryPitch · Logo finalization test</span></div>
 <div class="hero"><div class="m">{svg('soundglobe-mark.svg')}</div>
  <div><h1>Sound Globe <span class="g">— final</span></h1>
  <p class="lead">A globe whose latitude lines ripple like waveforms. Cleaned to five calm bands with one bright pitch-line through the equator; the whole system — mark, app icon, favicons, lockups, OG — generated from one vector source.</p></div></div>
</div></header>

<main><div class="wrap">

<section><div class="sh"><span class="eyebrow">The mark</span><h2>One mark, every ground</h2><p>Full-detail primary on dark and light, plus the obsidian app-tile treatment.</p></div>
 <div class="grid g3">
  <div class="card"><div class="stage dark">{svg('soundglobe-mark.svg')}</div><div class="cap"><b>On dark</b> · primary</div></div>
  <div class="card"><div class="stage light">{svg('soundglobe-mark.svg')}</div><div class="cap"><b>On light</b> · same vector</div></div>
  <div class="card"><div class="stage dark">{svg('soundglobe-app-icon.svg')}</div><div class="cap"><b>App tile</b> · rounded obsidian</div></div>
 </div></section>

<section><div class="sh"><span class="eyebrow">Favicons &amp; icons</span><h2>Sharp from 512 down to 16</h2><p>Full mark ≥ 48px; a simplified 3-wave <span class="mono">compact</span> variant kicks in at 16–32px so it never turns to mush.</p></div>
 <div class="card"><div class="favrow">
   <div class="fav f16">{svg('soundglobe-mark-compact.svg')}</div>
   <div class="fav f32">{svg('soundglobe-mark-compact.svg')}</div>
   <div class="fav f48">{svg('soundglobe-mark.svg')}</div>
   <div class="fav f64">{svg('soundglobe-mark.svg')}</div>
   <div style="flex:1"></div>
   <div class="tile">{svg('soundglobe-app-icon.svg')}</div>
 </div><div class="cap">16 · 32 (compact) &nbsp;|&nbsp; 48 · 64 (full) &nbsp;|&nbsp; maskable PWA tile → right</div></div>
</section>

<section><div class="sh"><span class="eyebrow">Lockups</span><h2>Mark + wordmark</h2><p>“Mercury” in ink, “Pitch” in the spectrum. Outfit SemiBold, tight tracking.</p></div>
 <div class="grid g2">
  <div class="card lockcard"><div class="stage dark">{svg('soundglobe-lockup-horizontal.svg')}</div><div class="cap"><b>Horizontal</b> · header / nav / email</div></div>
  <div class="card lockcard"><div class="stage dark">{svg('soundglobe-lockup-stacked.svg')}</div><div class="cap"><b>Stacked</b> · with tagline, for square spaces</div></div>
 </div>
 <div class="grid g2" style="margin-top:18px">
  <div class="card lockcard"><div class="stage light">{svg('soundglobe-lockup-horizontal-light.svg')}</div><div class="cap"><b>Horizontal · light</b></div></div>
  <div class="card lockcard"><div class="stage dark" style="min-height:0;padding:22px">{svg('soundglobe-mark-mono-light.svg')}</div><div class="cap"><b>Monochrome</b> · one-color (dark/light) for stamps &amp; embossing</div></div>
 </div>
</section>

<section><div class="sh"><span class="eyebrow">Social</span><h2>Open Graph image</h2><p>1200×630, ready for <span class="mono">og:image</span> / Twitter card.</p></div>
 <img class="ogimg" alt="MercuryPitch OG image" src="{og}"/>
</section>

<section><div class="sh"><span class="eyebrow">Deliverables</span><h2>What’s in the box</h2></div>
 <div class="files">
  <div><b>soundglobe-mark.svg</b> — primary (with disc)</div>
  <div><b>soundglobe-mark-flat.svg</b> — no disc, for glowing bg</div>
  <div><b>soundglobe-mark-compact.svg</b> — 3-wave, ≤32px</div>
  <div><b>soundglobe-mark-mono-{{dark,light}}.svg</b></div>
  <div><b>soundglobe-app-icon.svg</b> — rounded tile</div>
  <div><b>soundglobe-lockup-horizontal{{,-light}}.svg</b></div>
  <div><b>soundglobe-lockup-stacked.svg</b></div>
  <div><b>soundglobe-og.svg / .png</b> — 1200×630</div>
  <div><b>favicon/soundglobe/</b> — 16/32/48, apple-touch-180,</div>
  <div>icon-192/512, maskable-512, favicon.ico, favicon.svg</div>
 </div>
 <div class="note"><b>To ship it:</b> say the word and I’ll copy these into <span class="mono">public/</span>, update <span class="mono">index.html</span> + the PWA manifest + <span class="mono">favicon_v2.svg</span>, refresh <span class="mono">og-image.png</span>, and run <span class="mono">pnpm check</span>.</div>
</section>

</div></main>
<footer><div class="wrap">MercuryPitch · Sound Globe — generated from <span class="mono">docs/branding/logo/soundglobe/</span></div></footer>
<script>(function(){{var r=document.documentElement,l=document.getElementById('tl'),d=document.getElementById('td');
function s(m){{r.setAttribute('data-theme',m);d.setAttribute('aria-pressed',m=='dark');l.setAttribute('aria-pressed',m=='light')}}
var mq=matchMedia('(prefers-color-scheme: light)');s(mq.matches?'light':'dark');l.onclick=()=>s('light');d.onclick=()=>s('dark');}})();</script>
"""
dest=REPO/"docs/branding/soundglobe-final.html"
dest.write_text(HTML)
print("wrote",dest,len(HTML))
