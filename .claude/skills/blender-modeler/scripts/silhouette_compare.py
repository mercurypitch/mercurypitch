"""Silhouette gate: compare a model mask with a reference image (needs Pillow and numpy).

python3 -I silhouette_compare.py REFERENCE.png MODEL_MASK.png OUT_DIR [--bands 10] [--ref-mask MASK.png] [--threshold 0.11]

The reference is segmented from a plain studio backdrop (concept renders): a
smooth background is fitted to the border pixels, the colour distance from it is
thresholded (Otsu), cleaned, and holes smaller than 0.2% of the image are
filled. Enclosed background (the gap inside a handle loop) stays background.
Pass --ref-mask to use a hand-made or SAM mask instead.

Both masks are cropped to their bounding boxes and scaled to the same height,
so the numbers measure shape, not scale or position:
  iou            intersection over union of the aligned outer contours, each row
                 filled between its outline extremes in both masks (pale glass can
                 match a backdrop too closely for any colour rule, and the outline
                 is what reads at a distance); iou_with_holes_info is reported too
  aspect         width / height of each silhouette
  bands          outline width (leftmost to rightmost pixel) at the centre of
                 each of N equal height bands, divided by the silhouette height
  band_delta     model minus reference per band (same units)
Gates used by the skill: blockout iou >= 0.85 and |band_delta| <= 0.05;
forms iou >= 0.90 and |band_delta| <= 0.03. Size in metres is checked
separately against the brief, so a correct shape at the wrong scale still fails.
Writes OUT_DIR/silhouette.json, overlay.png (reference only cyan, model only
magenta, both white) and reference_mask.png.
"""

import json
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

H = 800


def otsu(values):
    hist, edges = np.histogram(values, bins=256)
    centres = (edges[:-1] + edges[1:]) / 2
    weight = np.cumsum(hist)
    mean = np.cumsum(hist * centres)
    total, total_mean = weight[-1], mean[-1]
    between = (total_mean * weight - mean * total) ** 2 / np.maximum(weight * (total - weight), 1)
    return centres[int(np.argmax(between))]


def segment(path, threshold=None):
    """Object mask of a concept on a studio backdrop. threshold: the colour distance from
    the fitted backdrop that counts as object; None picks it by Otsu, which sets it too
    high when one material is far from the backdrop and another close (amber and cream
    marble on grey): give the asset a measured `segment_threshold` then."""
    rgb = np.asarray(Image.open(path).convert('RGB'), dtype=np.float64) / 255.0
    h, w, _ = rgb.shape
    yy, xx = np.mgrid[0:h, 0:w]
    border = np.zeros((h, w), bool)
    m = max(4, int(0.03 * min(h, w)))
    border[:m, :] = border[-m:, :] = border[:, :m] = border[:, -m:] = True
    x = xx / w
    y = yy / h
    basis = np.stack([np.ones_like(x), x, y, x * x, x * y, y * y], axis=-1)
    background = np.zeros_like(rgb)
    for c in range(3):
        coeff, *_ = np.linalg.lstsq(basis[border], rgb[..., c][border], rcond=None)
        background[..., c] = basis @ coeff
    distance = np.abs(rgb - background).max(axis=-1)
    chroma = rgb.max(axis=-1) - rgb.min(axis=-1)
    luminance = rgb.mean(axis=-1)
    gradient = np.zeros_like(luminance)
    gradient[:, 1:] = np.abs(np.diff(luminance, axis=1))
    raw = distance > (threshold if threshold is not None else max(otsu(distance.ravel()), 0.04))
    close = max(5, int(0.01 * min(h, w)) | 1)
    image = Image.fromarray((raw * 255).astype(np.uint8))
    image = image.filter(ImageFilter.MaxFilter(close)).filter(ImageFilter.MinFilter(close))  # close outline gaps
    strong = np.asarray(image) > 127
    # Backdrop statistics from border pixels that are not object (a rim can touch the border).
    clean = border & ~raw
    limit_distance = np.percentile(distance[clean], 95) * 1.5 + 0.005
    limit_chroma = np.percentile(chroma[clean], 95) * 1.5 + 0.005
    limit_gradient = np.percentile(gradient[clean], 95) * 3 + 0.002
    # Everything the outline encloses is object, except enclosed regions that look
    # exactly like the backdrop (the gap inside a handle loop). Pale glass that is
    # close to the backdrop in brightness still differs in tint or texture.
    exterior = _flood_exterior(~strong)
    enclosed = ~exterior & ~strong
    labels, sizes = _labels_full(enclosed)
    mask = ~exterior
    for label in range(1, len(sizes)):
        region = labels == label
        if sizes[label] < 0.001 * h * w:
            continue
        if (np.median(distance[region]) <= limit_distance and np.median(chroma[region]) <= limit_chroma
                and np.mean(gradient[region]) <= limit_gradient):
            mask &= ~region
    image = Image.fromarray((mask * 255).astype(np.uint8))
    image = image.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.MaxFilter(3))  # drop specks
    return np.asarray(image) > 127


def filled(mask, smooth=6):
    """Outer contour as a row fill: every row filled from its leftmost to its rightmost pixel.

    Robust to any interior segmentation error (pale glass matching the backdrop, a gap
    in a faint outline) because only the two outline extremes of each row matter. It
    also fills handle loops, so apply it to both masks after `normalise`: the same
    operation shapes both, and the outline is what reads at gameplay distance.
    The left and right edges then take a running median over +-`smooth` rows: a
    band of rows where pale glass at the rim of the silhouette dropped out of the
    segmentation reads as a notch, while a real step (a foot ring, a band) survives
    a median unchanged.
    """
    rows = []
    for y in range(mask.shape[0]):
        xs = np.nonzero(mask[y])[0]
        rows.append((xs.min(), xs.max()) if len(xs) else None)
    out = np.zeros_like(mask)
    for y, row in enumerate(rows):
        if row is None:
            continue
        near = [r for r in rows[max(0, y - smooth):y + smooth + 1] if r is not None]
        left = int(np.median([r[0] for r in near]))
        right = int(np.median([r[1] for r in near]))
        out[y, left:right + 1] = True
    return out


def edges(mask):
    """[(row from the bottom as a fraction of height, left, right as fractions of height)]."""
    h = mask.shape[0]
    out = []
    for y in range(h):
        xs = np.nonzero(mask[h - 1 - y])[0]
        if len(xs):
            out.append((round(y / h, 4), round(xs.min() / h, 4), round((xs.max() + 1) / h, 4)))
    return out


def _flood_exterior(free):
    """Pixels of `free` connected to the image border (4-connectivity)."""
    from collections import deque

    h, w = free.shape
    seen = np.zeros_like(free)
    queue = deque()
    for x in range(w):
        for y in (0, h - 1):
            if free[y, x] and not seen[y, x]:
                seen[y, x] = True
                queue.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if free[y, x] and not seen[y, x]:
                seen[y, x] = True
                queue.append((y, x))
    while queue:
        cy, cx = queue.popleft()
        for ny, nx in ((cy - 1, cx), (cy + 1, cx), (cy, cx - 1), (cy, cx + 1)):
            if 0 <= ny < h and 0 <= nx < w and free[ny, nx] and not seen[ny, nx]:
                seen[ny, nx] = True
                queue.append((ny, nx))
    return seen


def _labels_full(mask):
    return _labels(mask)


def _labels(mask):
    from collections import deque

    h, w = mask.shape
    labels = np.zeros((h, w), np.int32)
    sizes = [0]
    current = 0
    for sy in range(h):
        row = mask[sy]
        for sx in np.nonzero(row & (labels[sy] == 0))[0]:
            if labels[sy, sx]:
                continue
            current += 1
            count = 0
            queue = deque([(sy, sx)])
            labels[sy, sx] = current
            while queue:
                cy, cx = queue.popleft()
                count += 1
                for ny, nx in ((cy - 1, cx), (cy + 1, cx), (cy, cx - 1), (cy, cx + 1)):
                    if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not labels[ny, nx]:
                        labels[ny, nx] = current
                        queue.append((ny, nx))
            sizes.append(count)
    return labels, sizes


def keep_largest(mask):
    small = Image.fromarray((mask * 255).astype(np.uint8))
    scale = max(1, max(mask.shape) // 400)
    reduced = np.asarray(small.resize((mask.shape[1] // scale, mask.shape[0] // scale), Image.NEAREST)) > 127
    labels, sizes = _labels(reduced)
    if len(sizes) <= 1:
        return mask
    biggest = int(np.argmax(sizes[1:])) + 1
    keep = Image.fromarray(((labels == biggest) * 255).astype(np.uint8)).resize(
        (mask.shape[1], mask.shape[0]), Image.NEAREST)
    grown = np.asarray(keep.filter(ImageFilter.MaxFilter(2 * scale + 1))) > 127
    return mask & grown


def fill_small_holes(mask, max_area):
    scale = max(1, max(mask.shape) // 400)
    reduced = ~(np.asarray(Image.fromarray((mask * 255).astype(np.uint8)).resize(
        (mask.shape[1] // scale, mask.shape[0] // scale), Image.NEAREST)) > 127)
    labels, sizes = _labels(reduced)
    h, w = reduced.shape
    edge = set(np.unique(np.concatenate([labels[0], labels[-1], labels[:, 0], labels[:, -1]])))
    fill = np.zeros_like(reduced)
    for label, size in enumerate(sizes):
        if label and label not in edge and size * scale * scale < max_area:
            fill |= labels == label
    filled = Image.fromarray((fill * 255).astype(np.uint8)).resize((mask.shape[1], mask.shape[0]), Image.NEAREST)
    return mask | (np.asarray(filled) > 127)


def normalise(mask):
    ys, xs = np.nonzero(mask)
    crop = mask[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    ch, cw = crop.shape
    width = max(1, round(cw * H / ch))
    resized = np.asarray(Image.fromarray((crop * 255).astype(np.uint8)).resize((width, H), Image.BILINEAR)) > 127
    return resized, cw / ch


def bands_of(mask, n):
    out = []
    for k in range(n):
        y = int((k + 0.5) / n * mask.shape[0])
        xs = np.nonzero(mask[mask.shape[0] - 1 - y])[0]  # band 0 is the bottom
        out.append(0.0 if len(xs) == 0 else (xs.max() - xs.min() + 1) / mask.shape[0])
    return out


def main():
    args = sys.argv[1:]
    ref_path, model_path, out_dir = args[0], args[1], args[2]
    n = int(args[args.index('--bands') + 1]) if '--bands' in args else 10
    os.makedirs(out_dir, exist_ok=True)
    if '--ref-mask' in args:
        ref_mask = np.asarray(Image.open(args[args.index('--ref-mask') + 1]).convert('L')) > 127
    else:
        ref_mask = segment(ref_path, float(args[args.index('--threshold') + 1]) if '--threshold' in args else None)
    Image.fromarray((ref_mask * 255).astype(np.uint8)).save(os.path.join(out_dir, 'reference_mask.png'))
    model_mask = np.asarray(Image.open(model_path).convert('L')) > 127

    ref_n, ref_aspect = normalise(ref_mask)
    mod_n, mod_aspect = normalise(model_mask)
    width = max(ref_n.shape[1], mod_n.shape[1])

    def pad(m):
        left = (width - m.shape[1]) // 2
        return np.pad(m, ((0, 0), (left, width - m.shape[1] - left)))

    # The gate compares outer contours, row-filled the same way in both masks.
    ha, hb = pad(ref_n), pad(mod_n)
    a, b = filled(ha), filled(hb)
    ref_n, mod_n = a, b
    iou = float((a & b).sum() / max((a | b).sum(), 1))
    iou_with_holes = float((ha & hb).sum() / max((ha | hb).sum(), 1))
    ref_bands, mod_bands = bands_of(ref_n, n), bands_of(mod_n, n)
    delta = [round(m - r, 4) for r, m in zip(ref_bands, mod_bands)]
    result = {'iou': round(iou, 4), 'iou_with_holes_info': round(iou_with_holes, 4),
              'aspect_reference': round(ref_aspect, 4), 'aspect_model': round(mod_aspect, 4),
              'bands_reference': [round(x, 4) for x in ref_bands], 'bands_model': [round(x, 4) for x in mod_bands],
              'band_delta': delta, 'worst_band': int(np.argmax(np.abs(delta))), 'worst_delta': float(max(delta, key=abs)),
              'blockout_pass': bool(iou >= 0.85 and max(map(abs, delta)) <= 0.05),
              'forms_pass': bool(iou >= 0.90 and max(map(abs, delta)) <= 0.03)}
    overlay = np.zeros(a.shape + (3,), np.uint8)
    overlay[a & b] = (235, 235, 235)
    overlay[a & ~b] = (0, 200, 255)
    overlay[~a & b] = (255, 60, 200)
    image = Image.fromarray(overlay)
    draw = ImageDraw.Draw(image)
    try:
        font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 16)
    except OSError:
        font = ImageFont.load_default()
    for k in range(n):
        y = H - 1 - int((k + 0.5) / n * H)
        draw.line([(0, y), (12, y)], fill=(255, 220, 0))
        draw.text((14, y - 9), f'{delta[k]:+.3f}', fill=(255, 220, 0), font=font)
    draw.text((8, 8), f"IoU {iou:.3f}  aspect ref {ref_aspect:.3f} model {mod_aspect:.3f}", fill=(255, 255, 255), font=font)
    draw.text((8, 28), 'cyan: reference only   magenta: model only', fill=(200, 200, 200), font=font)
    image.save(os.path.join(out_dir, 'overlay.png'))
    with open(os.path.join(out_dir, 'silhouette.json'), 'w') as handle:
        json.dump(result, handle, indent=1)
    # Per-row outline of both contours, for fitting a profile to the reference.
    with open(os.path.join(out_dir, 'rows.json'), 'w') as handle:
        json.dump({'height_px': H, 'width_px': width, 'reference': edges(a), 'model': edges(b)}, handle)
    print(json.dumps(result))


if __name__ == '__main__':
    main()
