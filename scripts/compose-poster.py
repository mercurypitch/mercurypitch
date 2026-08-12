#!/usr/bin/env python3
"""Composite CTA text onto a generated backdrop plate.

Generative models can render headline text, but every tweak to its size or
position re-rolls the whole image: the composition changes underneath you,
and the type comes back subtly wrong — a dropped full stop, a stray one
appended to the URL. Both happened while making this card.

So the plate is generated once with NO text on it, and the type is drawn
here. Position, size, weight and tracking become flags, the backdrop stays
fixed, and the copy is exact by construction.

Brand values per docs/branding/BRAND.md §4: Outfit 600 display, tracking
-1.5 to -2%, chrome white on obsidian.

    python3 scripts/compose-poster.py \\
      --backdrop docs/branding/marketing/cta-plate-pitch-curve.png \\
      --font /path/to/Outfit.ttf --out poster.png --top 0.62

Outfit is not vendored (it is loaded from a CDN at runtime by index.html).
Fetch the variable TTF for local rendering:

    curl -sSL -o Outfit.ttf \\
      https://raw.githubusercontent.com/google/fonts/main/ofl/outfit/Outfit%5Bwght%5D.ttf

Requires Pillow (`pip install Pillow`); it is not a project dependency.
"""
import argparse
from PIL import Image, ImageDraw, ImageFont

HEADLINE = "Find your pitch."
URL = "mercurypitch.com/mirror"

INK = (230, 237, 243, 255)      # #e6edf3 chrome white
MUTED = (168, 179, 191, 255)    # #a8b3bf


def to_exact_ratio(im, out_w, out_h):
    """Scale to width, then centre-crop height. Never distorts."""
    scale = out_w / im.width
    im = im.resize((out_w, round(im.height * scale)), Image.LANCZOS)
    if im.height == out_h:
        return im
    if im.height > out_h:
        top = (im.height - out_h) // 2
        return im.crop((0, top, out_w, top + out_h))
    pad = Image.new("RGB", (out_w, out_h), im.getpixel((1, im.height - 1)))
    pad.paste(im, (0, (out_h - im.height) // 2))
    return pad


def fit_font(path, text, target_px, weight, tracking):
    """Largest size whose tracked width still fits target_px."""
    lo, hi = 10, 400
    while lo < hi:
        mid = (lo + hi + 1) // 2
        f = ImageFont.truetype(path, mid)
        f.set_variation_by_axes([weight])
        if tracked_width(f, text, mid * tracking) <= target_px:
            lo = mid
        else:
            hi = mid - 1
    f = ImageFont.truetype(path, lo)
    f.set_variation_by_axes([weight])
    return f, lo


def tracked_width(font, text, spacing):
    w = sum(font.getlength(ch) for ch in text)
    return w + spacing * (len(text) - 1)


def draw_tracked(draw, xy, text, font, fill, spacing):
    x, y = xy
    for ch in text:
        draw.text((x, y), ch, font=font, fill=fill)
        x += font.getlength(ch) + spacing


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--backdrop", required=True)
    p.add_argument("--font", required=True)
    p.add_argument("--out", required=True)
    p.add_argument("--headline", default=HEADLINE)
    p.add_argument("--url", default=URL)
    # Vertical position of the headline cap, as a fraction of image height.
    p.add_argument("--top", type=float, default=0.60)
    # Headline width as a fraction of image width.
    p.add_argument("--width", type=float, default=0.76)
    p.add_argument("--tracking", type=float, default=-0.0175)
    p.add_argument("--url-scale", type=float, default=0.42)
    p.add_argument("--gap", type=float, default=0.42)
    # Delivery size. Generators emit ~9:16.1; social wants exactly 9:16, so
    # the plate is scaled to width and centre-cropped to height rather than
    # squashed.
    p.add_argument("--out-width", type=int, default=1080)
    p.add_argument("--out-height", type=int, default=1920)
    args = p.parse_args()

    im = Image.open(args.backdrop).convert("RGB")
    im = to_exact_ratio(im, args.out_width, args.out_height)
    W, H = im.size
    draw = ImageDraw.Draw(im)

    head_font, head_px = fit_font(
        args.font, args.headline, W * args.width, 600, args.tracking
    )
    url_px_target = int(head_px * args.url_scale)
    url_font = ImageFont.truetype(args.font, url_px_target)
    url_font.set_variation_by_axes([400])

    head_sp = head_px * args.tracking
    url_sp = url_px_target * args.tracking

    head_w = tracked_width(head_font, args.headline, head_sp)
    url_w = tracked_width(url_font, args.url, url_sp)

    # Anchor on the cap, not the em box, so --top means what it looks like.
    asc, _ = head_font.getmetrics()
    head_y = H * args.top - asc
    draw_tracked(
        draw, ((W - head_w) / 2, head_y), args.headline, head_font, INK, head_sp
    )

    url_y = head_y + head_px * (1 + args.gap)
    draw_tracked(
        draw, ((W - url_w) / 2, url_y), args.url, url_font, MUTED, url_sp
    )

    im.save(args.out, "PNG", optimize=True)
    print(f"{args.out}  {W}x{H}  headline {head_px}px  url {url_px_target}px")


if __name__ == "__main__":
    main()
