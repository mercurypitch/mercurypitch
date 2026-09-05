"""Prepare the September Pull pairs as opaque, silent iOS-safe delivery media.

Requires ffmpeg, ffprobe, Pillow, numpy and scipy. Sources are never modified. One
registration derived from the entrance endpoint is used for BOTH performances.
Only the resulting H.264/WebP files go into public; no runtime keying is needed.
"""

import argparse
import hashlib
import json
import math
import subprocess
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage
from beside_cue_edge_motion import edge_offsets

ROOT = Path(__file__).resolve().parent.parent
SUFFIX = "google-flow-omni-1_1-flash-raw-v0_1.mp4"
IDS = ["familiar-ritual", "two-minute-pause", "one-tap-convenience",
       "the-thimble", "the-tab", "the-bookmark", "the-match", "the-pillow",
       "the-kettle", "the-ticker", "the-tape"]
EXITS = {
    "familiar-ritual": f"v1_eyes_poping_out_b05-familiar-ritual-recede-{SUFFIX}",
    "the-bookmark": f"b05-the-bookmark-actual-recede-{SUFFIX}",
    "the-tape": "b05-the-tape-recede-google-flow-omni-1_1-flash-raw-v0_2.mp4",
}


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def probe(path):
    return json.loads(subprocess.check_output([
        "ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", str(path)]))


def decode(path, rgba=False):
    info = probe(path)
    stream = next(s for s in info["streams"] if s["codec_type"] == "video")
    w, h = stream["width"], stream["height"]
    channels = 4 if rgba else 3
    process = subprocess.Popen(["ffmpeg", "-v", "error", "-threads", "1", "-i", str(path),
                                "-vf", "fps=24", "-f", "rawvideo", "-pix_fmt", "rgba" if rgba else "rgb24", "-"],
                               stdout=subprocess.PIPE)
    try:
        while True:
            data = process.stdout.read(w * h * channels)
            if not data:
                break
            if len(data) != w * h * channels:
                raise RuntimeError(f"Incomplete frame: {path.name}")
            yield np.frombuffer(data, np.uint8).reshape(h, w, channels)
    finally:
        process.stdout.close()
        if process.wait() != 0:
            raise RuntimeError(f"Decode failed: {path.name}")


def key(rgb, pull_id, exiting=False):
    # Chroma ratio distinguishes the shaded magenta backing from the muted
    # lavender/plum characters. Preserve neutral dark eyes and hollow cores.
    pixels = rgb.astype(np.float32)
    red, green, blue = (pixels[:, :, c] for c in range(3))
    excess = np.minimum(red, blue) - green
    ratio = excess / np.maximum(1, np.maximum(red, blue))
    alpha = np.clip((0.30 - ratio) / 0.09, 0, 1)
    alpha[excess < 18] = 1
    if pull_id in ('the-tab', 'the-bookmark'):
        # Their cream/paper bodies permit a tighter absolute chroma key; the
        # ratio-only key leaves the generated magenta floor shadows visible.
        alpha = np.clip((35 - excess) / 15, 0, 1)
    if pull_id == 'the-pillow':
        # Both 96-frame sources were measured: backing's 0.5th percentile
        # bottoms out at .3445 entering and .3098 exiting. The downloaded
        # exit has different grading; applying the entrance key retains it.
        cutoff = 0.303 if exiting else 0.338
        alpha = np.clip((cutoff + 0.006 - ratio) / 0.032, 0, 1)
        # Keep the connected fabric silhouette, including dark eyes. Isolated
        # backing speckles are not character geometry or registration anchors.
        solid = ndimage.binary_closing(ratio < cutoff, iterations=1)
        labels, _ = ndimage.label(solid)
        sizes = np.bincount(labels.ravel())
        largest = int(sizes[1:].argmax()) + 1 if sizes.size > 1 else 0
        solid = (labels == largest) if largest and sizes[largest] >= 400 else np.zeros_like(solid)
        # Eye/fabric pinholes are not transparent. The larger gap BETWEEN
        # the legs is real negative space and must remain transparent.
        holes, _ = ndimage.label(ndimage.binary_fill_holes(solid) & ~solid)
        hole_sizes = np.bincount(holes.ravel())
        fill_holes = hole_sizes <= 2500
        fill_holes[0] = False
        occupied_rows = np.where(solid)[0]
        body_limit = (occupied_rows.min() + .8 * (occupied_rows.max() - occupied_rows.min())) if occupied_rows.size else 0
        solid |= fill_holes[holes] & (np.arange(rgb.shape[0])[:, None] < body_limit)
        alpha = np.where(ndimage.binary_erosion(solid), 1,
                         np.where(ndimage.binary_dilation(solid), alpha, 0))
        rim = solid & ~ndimage.binary_erosion(solid, iterations=2)
        edge_spill = np.maximum(0, excess - 22) * rim
        pixels[:, :, 0] -= edge_spill
        pixels[:, :, 2] -= edge_spill
    # Despill only partially covered edges, never opaque character materials.
    spill = np.maximum(0, excess) * (1 - alpha)
    pixels[:, :, 0] -= spill
    pixels[:, :, 2] -= spill
    pixels[alpha == 0] = 0
    return Image.fromarray(np.dstack((np.clip(pixels, 0, 255), alpha * 255)).astype(np.uint8))


def bbox(image):
    mask = np.asarray(image)[:, :, 3] > 160
    y, x = np.where(mask)
    if not x.size:
        return None
    return int(x.min()), int(y.min()), int(x.max() + 1), int(y.max() + 1)


def touches_left(image):
    # Ignore isolated keying speckles, but include antialiased source-edge
    # contact. The four-pixel destination margin covers Lanczos resampling.
    return bool((np.asarray(image)[:, :3, 3] > 160).any(axis=1).sum() >= 8)


def register(image, scale, offset):
    # Premultiplication prevents magenta/black seams during resampling.
    resized = image.convert("RGBa").resize(
        (round(image.width * scale), round(image.height * scale)), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBa", (720, 1280))
    canvas.paste(resized, offset)
    return canvas.convert("RGBA")


def composite(plate, foreground):
    bound = bbox(foreground)
    result = plate.copy()
    if bound is not None:
        x0, _, x1, y1 = bound
        shadow = Image.new("RGBA", plate.size)
        ImageDraw.Draw(shadow).ellipse((x0 - 8, y1 - 8, x1 + 10, y1 + 9), fill=(54, 35, 17, 55))
        result.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(8)))
    result.alpha_composite(foreground)
    return result.convert("RGB")


def encode(frames, path):
    if path.exists():
        raise RuntimeError(f"Refusing to overwrite {path}; use a new output directory.")
    process = subprocess.Popen([
        "ffmpeg", "-v", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", "720x1280",
        "-r", "24", "-i", "-", "-an", "-c:v", "libx264", "-preset", "slow", "-crf", "18",
        "-profile:v", "high", "-level:v", "3.1", "-pix_fmt", "yuv420p", "-g", "48",
        "-threads", "2", "-color_primaries", "bt709", "-color_trc", "bt709",
        "-colorspace", "bt709", "-movflags", "+faststart", "-map_metadata", "-1", str(path)],
        stdin=subprocess.PIPE)
    count = 0
    try:
        for frame in frames:
            process.stdin.write(frame.tobytes())
            count += 1
    finally:
        process.stdin.close()
        if process.wait() != 0:
            raise RuntimeError(f"Encode failed: {path.name}")
    return count


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--sources", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--proof", required=True, type=Path)
    parser.add_argument("--stills-only", action="store_true")
    parser.add_argument("--pull", choices=IDS, action="append", help="Render only these IDs into a fresh output directory.")
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    args.proof.mkdir(parents=True, exist_ok=True)
    plate_path = ROOT / "apps/beside-cue/public/onboarding/corky-v2.4/stills/p02-table-ready-v0_17.webp"
    plate = Image.open(plate_path).convert("RGBA")
    manifest = {"revision": "pull-expansion-v2-edge-safe", "movieVersion": "v0_2", "plateSha256": digest(plate_path), "pulls": {}}
    sheet = Image.new("RGB", (720, 430 * 4), "#fff5dd")
    for index, pull_id in enumerate(args.pull or IDS):
        present = args.sources / f"b03-{pull_id}-present-{SUFFIX}"
        recede = args.sources / EXITS.get(pull_id, f"b05-{pull_id}-recede-{SUFFIX}")
        endpoint = None
        present_contacts = []
        for frame in decode(present):
            endpoint = frame
            present_contacts.append(touches_left(key(frame, pull_id)))
        keyed = key(endpoint, pull_id)
        x0, y0, x1, y1 = bbox(keyed)
        scale = min(310 / (y1 - y0), 215 / (x1 - x0))
        offset = (round(242 - (x0 + x1) * scale / 2), round(971 - y1 * scale))
        recede_contacts = []
        last_recede_bound = None
        for frame in decode(recede):
            keyed_exit = key(frame, pull_id, True)
            recede_contacts.append(touches_left(keyed_exit))
            last_recede_bound = bbox(keyed_exit)
        # A few generated exits finish with a sliver still inside the source.
        # Hide it geometrically before the empty tail, never with a hard cut.
        margins = {"present": 4, "recede": max(4, math.ceil(last_recede_bound[2] * scale) + 4) if last_recede_bound else 4}
        contacts = {"present": present_contacts, "recede": recede_contacts}
        positions = {moment: edge_offsets(values, offset[0], moment == "recede", margin=margins[moment])
                     for moment, values in contacts.items()}
        hold = composite(plate, register(keyed, scale, offset))
        hold.save(args.output / f"p03-{pull_id}-settled-v0_1.webp", lossless=True)
        token = keyed.crop((x0, y0, x1, y1))
        token.thumbnail((512, 512), Image.Resampling.LANCZOS)
        token.save(args.output / f"{pull_id}-token-v0_1.webp", lossless=True)
        sheet.paste(hold.resize((240, 427)), ((index % 3) * 240, (index // 3) * 430))
        ImageDraw.Draw(sheet).text(((index % 3) * 240 + 6, (index // 3) * 430 + 10), pull_id, fill="#241913")
        def rendered(source, exiting=False):
            for n, raw in enumerate(decode(source)):
                if exiting and n == 0:
                    yield hold
                else:
                    moving_offset = (positions["recede" if exiting else "present"][n], offset[1])
                    foreground = register(key(raw, pull_id, exiting), scale, moving_offset)
                    if n == len(positions["recede" if exiting else "present"]) - 1:
                        if exiting and bbox(foreground) is not None:
                            raise RuntimeError(f"Exit would pop into the empty tail: {pull_id}")
                        if not exiting and moving_offset != offset:
                            raise RuntimeError(f"Entrance does not reach its hold pose: {pull_id}")
                    yield composite(plate, foreground)
            if exiting:
                # A settled empty-room tail gives the next beat a stable seam.
                for _ in range(6):
                    yield plate.convert("RGB")
        record = {"sources": {}, "registration": {"scale": scale, "offset": offset, "edgeMotion": "silhouette-contact-smoothstep", "edgeMarginPx": margins, "transitionFrames": 24}, "matte": "pillow-beat-chroma-silhouette" if pull_id == "the-pillow" else "paper-chroma" if pull_id in ("the-tab", "the-bookmark") else "chroma-ratio", "frames": {}, "edgeAudit": {}}
        for moment, source in [("present", present), ("recede", recede)]:
            record["sources"][moment] = {"file": source.name, "sha256": digest(source)}
            touching_frames = [n for n, contact in enumerate(contacts[moment]) if contact]
            unsafe = [n for n in touching_frames if positions[moment][n] > 0]
            if unsafe:
                raise RuntimeError(f"Exposed source boundary: {pull_id} {moment}: {unsafe}")
            record["edgeAudit"][moment] = {"contactFrames": touching_frames, "xByFrame": positions[moment], "exposedFrames": unsafe}
            if not args.stills_only:
                name = f"{'b03' if moment == 'present' else 'b05'}-{pull_id}-{moment}-v0_2.mp4"
                record["frames"][moment] = encode(rendered(source, moment == "recede"), args.output / name)
        if pull_id == "familiar-ritual":
            record["knownSourceIssue"] = "Open-eye recede variant: eyes become glossy/protruding during the exit. Matched start preferred over closed-eye alternative; replacement generation remains pending."
        manifest["pulls"][pull_id] = record
        print(pull_id, record["frames"], flush=True)
    sheet.save(args.proof / "settled-review.png")
    (args.proof / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    hashes = "".join(f"{digest(p)}  {p.name}\n" for p in sorted(args.output.iterdir()) if p.is_file() and p.name != "SHA256SUMS")
    (args.output / "SHA256SUMS").write_text(hashes)


if __name__ == "__main__":
    main()
