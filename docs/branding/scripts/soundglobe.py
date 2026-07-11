import os as _os
#!/usr/bin/env python3
"""Generate the high-quality MercuryPitch 'Sound Globe' asset set."""
import pathlib, math
REPO = pathlib.Path(__file__).resolve().parents[3]
OUT = REPO / "docs/branding/logo/soundglobe"
OUT.mkdir(parents=True, exist_ok=True)

# ---- smooth wave path (Catmull-Rom -> cubic Bezier through sample points) ----
def wave_d(y0, amp, cycles, phase, x0=8, x1=120, n=None):
    W = x1 - x0
    if n is None: n = max(16, int(cycles * 10))
    p = [(x0 + W*i/n, y0 + amp*math.sin(2*math.pi*cycles*(i/n) + phase)) for i in range(n+1)]
    def pt(i): return p[min(max(i,0), len(p)-1)]
    d = f"M{p[0][0]:.2f} {p[0][1]:.2f}"
    for i in range(len(p)-1):
        p0,p1,p2,p3 = pt(i-1),pt(i),pt(i+1),pt(i+2)
        c1 = (p1[0] + (p2[0]-p0[0])/6, p1[1] + (p2[1]-p0[1])/6)
        c2 = (p2[0] - (p3[0]-p1[0])/6, p2[1] - (p3[1]-p1[1])/6)
        d += f" C{c1[0]:.2f} {c1[1]:.2f} {c2[0]:.2f} {c2[1]:.2f} {p2[0]:.2f} {p2[1]:.2f}"
    return d

# 5 latitude bands: calm waves, amplitude bulging at the equator, opacity fading
# toward the poles (gives the 3D lit-sphere shading). No white overlay.
BANDS = [
    # y0, amp, cycles, phase_step_index, width, opacity
    (43, 8.0,  2.0, 0, 3.2, .55),
    (54, 11.0, 2.0, 1, 4.0, .78),
    (64, 13.0, 2.0, 2, 5.2, 1.0),   # equator — boldest, spectrum (not white)
    (75, 11.0, 2.0, 3, 4.0, .78),
    (86, 8.0,  2.0, 4, 3.2, .55),
]
PHASE = 0.35  # small phase shift per band -> subtle life, still reads horizontal

def meridians(gradient="sgWave"):
    # vertical longitude rings that make it read as a 3D globe (the "ring through")
    return (f'<ellipse cx="64" cy="64" rx="20" ry="50" fill="none" stroke="url(#{gradient})" stroke-width="1.8" opacity=".38"/>'
            f'<ellipse cx="64" cy="64" rx="42" ry="50" fill="none" stroke="url(#{gradient})" stroke-width="1.4" opacity=".20"/>')

def waves(gradient="sgWave"):
    out = []
    for y0,amp,cyc,pi,w,op in BANDS:
        d = wave_d(y0, amp, cyc, pi*PHASE)
        out.append(f'<path d="{d}" fill="none" stroke="url(#{gradient})" stroke-width="{w}" stroke-linecap="round" opacity="{op}"/>')
    out.append(meridians(gradient))
    return "\n    ".join(out)

DEFS = """  <defs>
    <radialGradient id="sgBg" cx="42%" cy="34%" r="76%">
      <stop offset="0" stop-color="#1c2634"/><stop offset="1" stop-color="#090d13"/>
    </radialGradient>
    <linearGradient id="sgWave" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#58a6ff"/><stop offset=".5" stop-color="#2dd4bf"/><stop offset="1" stop-color="#bc8cff"/>
    </linearGradient>
    <linearGradient id="sgRim" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#7cc0ff"/><stop offset=".5" stop-color="#4fe3d0"/><stop offset="1" stop-color="#cbacff"/>
    </linearGradient>
    <clipPath id="sgClip"><circle cx="64" cy="64" r="50"/></clipPath>
  </defs>"""

def mark(with_disc=True):
    disc = '<circle cx="64" cy="64" r="50" fill="url(#sgBg)"/>' if with_disc else ''
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128" role="img" aria-label="MercuryPitch">
{DEFS}
  {disc}
  <g clip-path="url(#sgClip)">
    {waves()}
  </g>
  <circle cx="64" cy="64" r="50" fill="none" stroke="url(#sgRim)" stroke-width="2.5" opacity=".95"/>
</svg>
'''

# ---- compact mark (3 bold waves) for tiny favicon sizes ----
BANDS_COMPACT = [
    (47, 11.5, 2.0, 0, 6.0, .9, False),
    (64, 13.5, 2.0, 1, 7.0, 1.0, True),
    (81, 11.5, 2.0, 2, 6.0, .9, False),
]
def mark_compact(with_disc=True):
    disc = '<circle cx="64" cy="64" r="50" fill="url(#sgBg)"/>' if with_disc else ''
    ws = []
    for y0,amp,cyc,pi,w,op,_hot in BANDS_COMPACT:
        d = wave_d(y0, amp, cyc, pi*0.4)
        ws.append(f'<path d="{d}" fill="none" stroke="url(#sgWave)" stroke-width="{w}" stroke-linecap="round" opacity="{op}"/>')
    ws.append(f'<ellipse cx="64" cy="64" rx="21" ry="50" fill="none" stroke="url(#sgWave)" stroke-width="2.2" opacity=".4"/>')
    ws = "\n    ".join(ws)
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128" role="img" aria-label="MercuryPitch">
{DEFS}
  {disc}
  <g clip-path="url(#sgClip)">
    {ws}
  </g>
  <circle cx="64" cy="64" r="50" fill="none" stroke="url(#sgRim)" stroke-width="2.8" opacity=".95"/>
</svg>
'''

# ---- mono (single-color) version ----
def mark_mono(color="#0d1117"):
    ws = []
    for y0,amp,cyc,pi,w,op in BANDS:
        d = wave_d(y0, amp, cyc, pi*PHASE)
        ws.append(f'<path d="{d}" fill="none" stroke="{color}" stroke-width="{w}" stroke-linecap="round" opacity="{max(op,.6):.2f}"/>')
    ws.append(f'<ellipse cx="64" cy="64" rx="20" ry="50" fill="none" stroke="{color}" stroke-width="1.8" opacity=".5"/>')
    ws = "\n    ".join(ws)
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128" role="img" aria-label="MercuryPitch">
  <defs><clipPath id="sgClipM"><circle cx="64" cy="64" r="50"/></clipPath></defs>
  <g clip-path="url(#sgClipM)">
    {ws}
  </g>
  <circle cx="64" cy="64" r="50" fill="none" stroke="{color}" stroke-width="2.6"/>
</svg>
'''

# ---- app icon tile ----
def app_icon():
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128" role="img" aria-label="MercuryPitch app icon">
{DEFS}
  <rect x="4" y="4" width="120" height="120" rx="28" fill="url(#sgBg)"/>
  <g clip-path="url(#sgClip)">
    {waves()}
  </g>
  <circle cx="64" cy="64" r="50" fill="none" stroke="url(#sgRim)" stroke-width="2.5" opacity=".9"/>
  <rect x="4.75" y="4.75" width="118.5" height="118.5" rx="27.25" fill="none" stroke="url(#sgRim)" stroke-width="1.5" opacity=".4"/>
</svg>
'''

# ---- lockups (mark + wordmark) ----
def mark_group(cx, cy, r):
    """place a 100-unit mark scaled to radius r at center (cx,cy)."""
    s = (2*r)/128.0
    ox, oy = cx - r, cy - r
    return f'<g transform="translate({ox:.2f} {oy:.2f}) scale({s:.4f})"><circle cx="64" cy="64" r="50" fill="url(#sgBg)"/><g clip-path="url(#sgClip)">{waves()}</g><circle cx="64" cy="64" r="50" fill="none" stroke="url(#sgRim)" stroke-width="2.5" opacity=".95"/></g>'

def lockup_h(dark=True):
    fg = "#e6edf3" if dark else "#1f2328"
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 140" width="520" height="140" role="img" aria-label="MercuryPitch">
{DEFS}
  {mark_group(70, 70, 56)}
  <text x="150" y="84" font-family="Outfit, 'Plus Jakarta Sans', sans-serif" font-weight="600" font-size="50" letter-spacing="-2">
    <tspan fill="{fg}">Mercury</tspan><tspan fill="url(#sgWave)">Pitch</tspan>
  </text>
</svg>
'''

def lockup_stacked(dark=True):
    fg = "#e6edf3" if dark else "#1f2328"
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 300" width="360" height="300" role="img" aria-label="MercuryPitch">
{DEFS}
  {mark_group(180, 108, 82)}
  <text x="180" y="252" text-anchor="middle" font-family="Outfit, 'Plus Jakarta Sans', sans-serif" font-weight="600" font-size="46" letter-spacing="-2">
    <tspan fill="{fg}">Mercury</tspan><tspan fill="url(#sgWave)">Pitch</tspan>
  </text>
  <text x="180" y="282" text-anchor="middle" font-family="Inter, sans-serif" font-weight="500" font-size="15" letter-spacing="3" fill="{'#6e7681' if dark else '#7d8590'}">FIND YOUR PITCH</text>
</svg>
'''

# ---- OG / social 1200x630 ----
def og_image():
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630" role="img" aria-label="MercuryPitch">
{DEFS}
  <defs>
    <radialGradient id="ogGlow" cx="72%" cy="24%" r="60%">
      <stop offset="0" stop-color="#12324f" stop-opacity=".9"/><stop offset="100%" stop-color="#0d1117" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1200" height="630" fill="#0d1117"/>
  <rect width="1200" height="630" fill="url(#ogGlow)"/>
  {mark_group(902, 315, 190)}
  <text x="90" y="250" font-family="Outfit, sans-serif" font-weight="700" font-size="96" letter-spacing="-3" fill="#e6edf3">Mercury<tspan fill="url(#sgWave)">Pitch</tspan></text>
  <text x="94" y="322" font-family="Inter, sans-serif" font-weight="500" font-size="34" fill="#a8b3bf">Your voice, made visible.</text>
  <text x="94" y="372" font-family="Inter, sans-serif" font-weight="400" font-size="25" fill="#6e7681">Real-time vocal pitch training with liquid precision.</text>
  <g font-family="Inter, sans-serif" font-weight="500" font-size="20" fill="#8b95a1">
    <rect x="94" y="470" width="220" height="44" rx="22" fill="none" stroke="#30363d"/>
    <text x="120" y="498">Real-time feedback</text>
    <rect x="332" y="470" width="196" height="44" rx="22" fill="none" stroke="#30363d"/>
    <text x="358" y="498">AI stem separation</text>
  </g>
</svg>
'''

files = {
    "soundglobe-mark.svg": mark(True),
    "soundglobe-mark-flat.svg": mark(False),
    "soundglobe-mark-compact.svg": mark_compact(True),
    "soundglobe-mark-mono-dark.svg": mark_mono("#0d1117"),
    "soundglobe-mark-mono-light.svg": mark_mono("#e6edf3"),
    "soundglobe-app-icon.svg": app_icon(),
    "soundglobe-lockup-horizontal.svg": lockup_h(True),
    "soundglobe-lockup-horizontal-light.svg": lockup_h(False),
    "soundglobe-lockup-stacked.svg": lockup_stacked(True),
    "soundglobe-og.svg": og_image(),
}
for name, content in files.items():
    (OUT/name).write_text(content)
    print("wrote", name)

# also refresh the exploration canonical
(REPO/"docs/branding/logo/explorations/v15-soundglobe.svg").write_text(mark(True))
print("updated exploration v15")
