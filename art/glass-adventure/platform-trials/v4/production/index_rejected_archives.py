"""Resolve historical V4 report hashes without rewriting their original paths."""

import hashlib
import json
from pathlib import Path
import struct


ROOT = Path(__file__).resolve().parents[5]
V4 = ROOT / "art/glass-adventure/platform-trials/v4"
OUTPUT = V4 / "production/rejected-archive-index.json"


def sha(data):
    return hashlib.sha256(data).hexdigest()


def main():
    preserved = {}
    for folder in (V4 / "sources/rejected", V4 / "exports/rejected"):
        for path in sorted(folder.rglob("*")):
            if not path.is_file():
                continue
            data = path.read_bytes()
            entry = {
                "status": "exact-file",
                "archiveFile": str(path.relative_to(ROOT)),
                "bytes": len(data),
            }
            preserved[sha(data)] = entry
            if path.suffix != ".glb":
                continue
            magic, version, total = struct.unpack_from("<III", data)
            assert (magic, version, total) == (0x46546C67, 2, len(data))
            json_size, chunk_type = struct.unpack_from("<II", data, 12)
            assert chunk_type == 0x4E4F534A
            document = json.loads(data[20 : 20 + json_size])
            bin_size, bin_type = struct.unpack_from("<II", data, 20 + json_size)
            assert bin_type == 0x004E4942
            binary = data[28 + json_size : 28 + json_size + bin_size]
            for image_index, image in enumerate(document.get("images", [])):
                view = document["bufferViews"][image["bufferView"]]
                assert view.get("buffer", 0) == 0
                offset = view.get("byteOffset", 0)
                encoded = binary[offset : offset + view["byteLength"]]
                assert len(encoded) == view["byteLength"]
                preserved.setdefault(
                    sha(encoded),
                    {
                        "status": "exact-encoded-image-in-glb",
                        "archiveFile": entry["archiveFile"],
                        "imageIndex": image_index,
                        "bufferView": image["bufferView"],
                        "bytes": len(encoded),
                    },
                )

    reports = []
    for path in sorted((V4 / "production").glob("*build-rejected*.json")):
        references = []

        def visit(value, pointer=""):
            if isinstance(value, list):
                for index, child in enumerate(value):
                    visit(child, f"{pointer}/{index}")
            elif isinstance(value, dict):
                old_path = value.get("file", "")
                digest = value.get("sha256")
                if isinstance(old_path, str) and "/v4/" in old_path and digest and "/meshy/" not in old_path:
                    resolved = preserved.get(digest, {"status": "historical-intermediate-bytes-not-retained"})
                    original = ROOT / old_path
                    if resolved["status"] == "historical-intermediate-bytes-not-retained" and original.is_file():
                        original_data = original.read_bytes()
                        if sha(original_data) == digest:
                            resolved = {"status": "exact-file", "archiveFile": old_path, "bytes": len(original_data)}
                    if "bytes" in resolved and "bytes" in value:
                        assert resolved["bytes"] == value["bytes"]
                    references.append({"reportPointer": pointer, "historicalFile": old_path, "sha256": digest, **resolved})
                for key, child in value.items():
                    visit(child, f"{pointer}/{key}")

        visit(json.loads(path.read_text()))
        reports.append({"report": str(path.relative_to(ROOT)), "sha256": sha(path.read_bytes()), "references": references})

    result = {
        "purpose": "Resolve original report paths by their recorded hashes after rejected artifacts were archived. Original reports remain unchanged.",
        "scope": "Rejected V4 local bake and direct-simplification iterations; immutable provider originals are separate. There is no accepted V4 runtime derivative.",
        "limitation": "The earliest rejected iteration's packed Blend and standalone AO/metallic/roughness PNG encodings were superseded before archival. Both rejected GLBs retain their exact embedded base/normal/ORM images; ORM retains those three channels, but does not recreate the missing original PNG encodings. The later corrected 90k and direct 238k iterations have their full packed Blend, maps and GLBs preserved.",
        "reports": reports,
    }
    OUTPUT.write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps({"output": str(OUTPUT.relative_to(ROOT)), "references": sum(len(r["references"]) for r in reports), "unretainedHistoricalIntermediates": sum(v["status"] == "historical-intermediate-bytes-not-retained" for r in reports for v in r["references"])}))


if __name__ == "__main__":
    main()
