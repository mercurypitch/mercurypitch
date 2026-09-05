"""Repair Scroll's inherited 21px alpha-source inset without re-keying its art.

Only two new silent H.264 movies are emitted. Original sources, settled stills,
room, greeting, music and every other scene remain unchanged.
"""
import argparse
import importlib.util
import json
from pathlib import Path

from PIL import Image

from beside_cue_edge_motion import edge_offsets

SPEC = importlib.util.spec_from_file_location("pull_media", Path(__file__).with_name("prepare-beside-cue-pull-expansion.py"))
media = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(media)

SOURCES = {
    "present": {
        "foreground": "071ac7a081275693c2f19106c19fc763f1ac4f58717f0e3b48b76e40206c4e5d",
        "shadow": "ab6a37cd6d4e7827fa0bf9269c224dc7c7f30eca24f65fdc38d4622134882465",
    },
    "recede": {
        "foreground": "93c8ddce3c6a7e709c9c98455dc2c29572c7ba77677c55c5e936e456faf3e0d3",
        "shadow": "b7e3e99a7b66a1bf75bac09bcde6796590851cce89f9cf0c1b65fb753740d260",
    },
}
# The accepted V2.1 derivatives embed a 678px source at x21 in a 1080px frame.
# Removing that transparent padding lets the same contact policy govern both
# these older alphas and the newly keyed expansion sources.
SOURCE_LEFT = 21
SCALE = 2 / 3
REST_X = 14


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--sources", type=Path, required=True, help="V2.4 diagnostic layers directory")
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--proof", type=Path, required=True)
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    args.proof.mkdir(parents=True, exist_ok=True)
    plate_path = media.ROOT / "apps/beside-cue/public/onboarding/corky-v2.4/stills/p02-table-ready-v0_17.webp"
    plate = Image.open(plate_path).convert("RGBA")
    report = {"plateSha256": media.digest(plate_path), "sourceLeft": SOURCE_LEFT, "pull": "scrolling", "moments": {}}
    for moment, hashes in SOURCES.items():
        paths = {layer: args.sources / f"scroll-{moment}-{layer}-alpha-v0_1.mkv" for layer in hashes}
        for layer, path in paths.items():
            if media.digest(path) != hashes[layer]:
                raise RuntimeError(f"Source hash mismatch: {path.name}")
        contacts = []
        for frame in media.decode(paths["foreground"], rgba=True):
            contacts.append(media.touches_left(Image.fromarray(frame[:, SOURCE_LEFT:])))
        positions = edge_offsets(contacts, REST_X, moment == "recede")

        def frames():
            for n, (foreground, shadow) in enumerate(zip(media.decode(paths["foreground"], rgba=True), media.decode(paths["shadow"], rgba=True), strict=True)):
                result = plate.copy()
                for layer in (shadow, foreground):
                    # Keep the original alpha material; move shadow and actor
                    # together. No new generic ellipse or source chroma key.
                    image = Image.fromarray(layer[:, SOURCE_LEFT:])
                    result.alpha_composite(media.register(image, SCALE, (positions[n], 0)))
                yield result.convert("RGB")

        name = f"{'b03' if moment == 'present' else 'b05'}-scrolling-{moment}-v0_3.mp4"
        count = media.encode(frames(), args.output / name)
        if count != 96:
            raise RuntimeError(f"Unexpected frame count: {count}")
        touching = [n for n, contact in enumerate(contacts) if contact]
        assert all(positions[n] <= 0 for n in touching)
        report["moments"][moment] = {"file": name, "sha256": media.digest(args.output / name), "sourceHashes": hashes, "frames": count, "contactFrames": touching, "xByFrame": positions}
        print(moment, count, flush=True)
    (args.proof / "scroll-edge-manifest.json").write_text(json.dumps(report, indent=2) + "\n")


if __name__ == "__main__":
    main()
