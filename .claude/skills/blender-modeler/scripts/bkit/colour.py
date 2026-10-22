"""Colour maths without Blender: sRGB and CIE Lab conversions, and the palette moves the
skill's materials use (`push_chroma`, `shift_lightness`).

Pure Python, so asset colour modules (`colours.py` beside a `build.py`) and the GLB
probes (`glb_recolour.py`) import it outside Blender; `bkit.materials` re-exports it.
"""


def srgb(value):
    """'#d9fff4' or (r, g, b) in 0..1 sRGB -> linear (r, g, b)."""
    if isinstance(value, str):
        value = value.lstrip('#')
        value = tuple(int(value[i:i + 2], 16) / 255 for i in range(0, 6, 2))

    def lin(c):
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

    return tuple(lin(c) for c in value)


def lab(rgb):
    """sRGB 0..1 to CIE Lab (D65)."""
    lin = [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in rgb]
    x = (0.4124 * lin[0] + 0.3576 * lin[1] + 0.1805 * lin[2]) / 0.95047
    y = 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2]
    z = (0.0193 * lin[0] + 0.1192 * lin[1] + 0.9505 * lin[2]) / 1.08883
    f = [t ** (1 / 3) if t > 0.008856 else 7.787 * t + 16 / 116 for t in (x, y, z)]
    return 116 * f[1] - 16, 500 * (f[0] - f[1]), 200 * (f[1] - f[2])


def linear_from_lab(L, a, b):
    fy = (L + 16) / 116
    fx, fz = fy + a / 500, fy - b / 200
    inv = [t ** 3 if t ** 3 > 0.008856 else (t - 16 / 116) / 7.787 for t in (fx, fy, fz)]
    x, y, z = inv[0] * 0.95047, inv[1], inv[2] * 1.08883
    return (3.2406 * x - 1.5372 * y - 0.4986 * z, -0.9689 * x + 1.8758 * y + 0.0415 * z,
            0.0557 * x - 0.2040 * y + 1.0570 * z)


def srgb_from_linear(lin):
    return tuple(min(1.0, max(0.0, 12.92 * c if c <= 0.0031308 else 1.055 * c ** (1 / 2.4) - 0.055)) for c in lin)


def push_chroma(rgb, about, gain):
    """Move an sRGB colour's chroma `gain` times further from `about`'s (both 0..1), its
    lightness and hue kept, and no further than sRGB holds: more colour play round the
    same average without washing to white, which pushing lightness does. Used where the
    renderer compresses a palette's spread (the opal's vertex colours lose about 60% of
    theirs in three.js)."""
    L, a, b = lab(rgb)
    _, a0, b0 = lab(about)
    da, db = (a - a0) * gain, (b - b0) * gain
    lo, hi = 0.0, 1.0
    if not all(-1e-6 <= c <= 1 + 1e-6 for c in linear_from_lab(L, a0 + da, b0 + db)):
        for _ in range(24):  # the largest share of the push that stays inside the gamut
            mid = (lo + hi) / 2
            if all(-1e-6 <= c <= 1 + 1e-6 for c in linear_from_lab(L, a0 + da * mid, b0 + db * mid)):
                lo = mid
            else:
                hi = mid
        da, db = da * lo, db * lo
    return srgb_from_linear(linear_from_lab(L, a0 + da, b0 + db))


def shift_lightness(rgb, d_l):
    """The sRGB colour (0..1) with its Lab lightness moved by d_l, hue and chroma kept as far as
    sRGB holds them: when the moved colour leaves the gamut its chroma shrinks, never its hue.
    For lightness play on top of a chroma-pushed palette (the opal read flat in the game: L*
    spread 3 against the concept's 7)."""
    L, a, b = lab(rgb)
    L = min(100.0, max(0.0, L + d_l))
    lo = 1.0
    if not all(-1e-6 <= c <= 1 + 1e-6 for c in linear_from_lab(L, a, b)):
        lo, hi = 0.0, 1.0
        for _ in range(24):
            mid = (lo + hi) / 2
            if all(-1e-6 <= c <= 1 + 1e-6 for c in linear_from_lab(L, a * mid, b * mid)):
                lo = mid
            else:
                hi = mid
    return srgb_from_linear(linear_from_lab(L, a * lo, b * lo))
