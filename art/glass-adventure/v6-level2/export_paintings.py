"""Export untouched original painting masters to measured runtime WebP derivatives."""
from hashlib import sha256
import json
from pathlib import Path
from PIL import Image

SOURCE = Path(__file__).resolve().parent
REPO = SOURCE.parents[2]
OUTPUT = REPO / "apps/beside-cue/public/games/adventure-v6"
OUTPUT.mkdir(parents=True, exist_ok=True)
assets = []
for name in ("low-note-keeper", "high-note-muse", "interval-between"):
    master = SOURCE / "paintings" / f"{name}-master.png"
    output = OUTPUT / f"{name}.webp"
    with Image.open(master) as image:
        image.convert("RGB").save(output, "WEBP", quality=88, method=6)
        dimensions = list(image.size)
    assets.append({
        "file": output.name,
        "source": str(master.relative_to(REPO)),
        "sourceSha256": sha256(master.read_bytes()).hexdigest(),
        "sha256": sha256(output.read_bytes()).hexdigest(),
        "dimensions": dimensions,
        "bytes": output.stat().st_size,
    })
manifest = {
    "version": 1,
    "description": "Original fictional Twin Galleries paintings, shared across wall frames, inspection and campaign art.",
    "sourceReceipt": "art/glass-adventure/v6-level2/imagegen-receipt.json",
    "encoding": "Full-resolution RGB WebP, quality 88, method 6. Source masters unchanged.",
    "assets": assets,
}
(OUTPUT / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
print(json.dumps({"files": len(assets), "bytes": sum(item["bytes"] for item in assets)}))
