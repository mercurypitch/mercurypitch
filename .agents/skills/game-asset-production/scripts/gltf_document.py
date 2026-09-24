"""Load GLB or same-directory external-buffer glTF with immutable provenance."""

from __future__ import annotations

from dataclasses import dataclass
import hashlib
import json
from pathlib import Path, PurePosixPath
import struct
from urllib.parse import unquote, urlsplit


JSON_CHUNK = b"JSON"
BIN_CHUNK = b"BIN\0"


class GltfFormatError(ValueError):
    """An asset cannot be audited without ambiguous or unsafe I/O."""


@dataclass(frozen=True)
class GltfDocument:
    path: Path
    document: dict
    buffers: tuple[bytes, ...]
    bytes: int
    sha256: str
    dependencies: tuple[dict, ...]

    def provenance(self) -> dict:
        return {
            "file": str(self.path),
            "bytes": self.bytes,
            "sha256": self.sha256,
            "dependencies": [dict(record) for record in self.dependencies],
        }

    def buffer_view(self, index: int) -> memoryview:
        index = _nonnegative_integer(index, "bufferView index")
        try:
            view = self.document["bufferViews"][index]
        except (IndexError, KeyError, TypeError) as error:
            raise GltfFormatError(f"Invalid bufferView {index}") from error
        if not isinstance(view, dict):
            raise GltfFormatError(f"bufferView {index} must be an object")
        buffer_index = _nonnegative_integer(
            view.get("buffer", 0), f"bufferView {index}.buffer"
        )
        try:
            data = self.buffers[buffer_index]
        except IndexError as error:
            raise GltfFormatError(
                f"bufferView {index} references missing buffer {buffer_index}"
            ) from error
        offset = _nonnegative_integer(view.get("byteOffset", 0), "byteOffset")
        length = _nonnegative_integer(view.get("byteLength"), "byteLength")
        if offset + length > len(data):
            raise GltfFormatError(f"bufferView {index} exceeds its buffer")
        return memoryview(data)[offset : offset + length]


def _sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _nonnegative_integer(value, label: str) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or value < 0:
        raise GltfFormatError(f"{label} must be a non-negative integer")
    return value


def _json_document(data: bytes, label: str) -> dict:
    try:
        value = json.loads(data)
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise GltfFormatError(f"Invalid {label} JSON") from error
    if not isinstance(value, dict):
        raise GltfFormatError(f"{label} JSON root must be an object")
    return value


def _safe_sibling(asset: Path, uri: str) -> Path:
    if not isinstance(uri, str) or not uri:
        raise GltfFormatError("Every external buffer needs a non-empty URI")
    parsed = urlsplit(uri)
    if parsed.scheme or parsed.netloc or parsed.query or parsed.fragment:
        raise GltfFormatError(f"External buffer URI must be a local file: {uri}")
    decoded = unquote(parsed.path)
    if "\\" in decoded or "\0" in decoded:
        raise GltfFormatError(f"External buffer URI is not portable: {uri}")
    relative = PurePosixPath(decoded)
    if relative.is_absolute() or ".." in relative.parts:
        raise GltfFormatError(f"External buffer URI may not traverse: {uri}")
    dependency = asset.parent.joinpath(*relative.parts)
    asset_directory = asset.parent.resolve()
    resolved = dependency.resolve()
    if resolved.parent != asset_directory:
        raise GltfFormatError(
            f"External buffer must be beside the glTF asset: {uri}"
        )
    return dependency


def _buffer_records(document: dict) -> list[dict]:
    records = document.get("buffers", [])
    if not isinstance(records, list):
        raise GltfFormatError("buffers must be an array")
    for index, record in enumerate(records):
        if not isinstance(record, dict):
            raise GltfFormatError(f"Buffer {index} must be an object")
    return records


def _external_buffers(
    path: Path, document: dict
) -> tuple[tuple[bytes, ...], tuple[dict, ...]]:
    buffers = []
    dependencies = []
    for index, record in enumerate(_buffer_records(document)):
        expected = _nonnegative_integer(record.get("byteLength"), "byteLength")
        dependency = _safe_sibling(path, record.get("uri"))
        try:
            data = dependency.read_bytes()
        except OSError as error:
            raise GltfFormatError(
                f"Missing external buffer {record.get('uri')}"
            ) from error
        if len(data) != expected:
            raise GltfFormatError(
                f"External buffer {record.get('uri')} length mismatch: "
                f"expected {expected}, found {len(data)}"
            )
        buffers.append(data)
        dependencies.append(
            {
                "buffer": index,
                "uri": record["uri"],
                "file": str(dependency),
                "bytes": len(data),
                "sha256": _sha256(data),
            }
        )
    return tuple(buffers), tuple(dependencies)


def _glb_document(path: Path, raw: bytes) -> tuple[dict, tuple[bytes, ...]]:
    if len(raw) < 20:
        raise GltfFormatError("Truncated GLB header")
    magic, version, total = struct.unpack_from("<4sII", raw)
    if magic != b"glTF" or version != 2 or total != len(raw):
        raise GltfFormatError("Invalid GLB header/version/length")
    json_length, json_kind = struct.unpack_from("<I4s", raw, 12)
    json_end = 20 + json_length
    if json_kind != JSON_CHUNK or json_end > total:
        raise GltfFormatError("Invalid GLB JSON chunk")
    document = _json_document(raw[20:json_end], "GLB")
    declared = _buffer_records(document)
    if any("uri" in record for record in declared):
        raise GltfFormatError("External buffers in GLB are not supported")
    if len(declared) > 1:
        raise GltfFormatError("GLB may expose only its embedded buffer")
    if not declared:
        return document, ()
    expected = _nonnegative_integer(declared[0].get("byteLength"), "byteLength")
    if json_end + 8 > total:
        raise GltfFormatError("Missing GLB BIN chunk")
    binary_length, binary_kind = struct.unpack_from("<I4s", raw, json_end)
    binary_start = json_end + 8
    binary_end = binary_start + binary_length
    if binary_kind != BIN_CHUNK or binary_end > total or binary_length < expected:
        raise GltfFormatError("Invalid GLB BIN chunk")
    return document, (raw[binary_start : binary_start + expected],)


def load_gltf(path: Path) -> GltfDocument:
    path = Path(path)
    try:
        raw = path.read_bytes()
    except OSError as error:
        raise GltfFormatError(f"Could not read asset: {path}") from error
    suffix = path.suffix.lower()
    if suffix == ".glb":
        document, buffers = _glb_document(path, raw)
        dependencies = ()
    elif suffix == ".gltf":
        document = _json_document(raw, "glTF")
        buffers, dependencies = _external_buffers(path, document)
    else:
        raise GltfFormatError(f"Expected .glb or .gltf asset: {path}")
    result = GltfDocument(
        path=path,
        document=document,
        buffers=buffers,
        bytes=len(raw),
        sha256=_sha256(raw),
        dependencies=dependencies,
    )
    views = document.get("bufferViews", [])
    if not isinstance(views, list):
        raise GltfFormatError("bufferViews must be an array")
    for index in range(len(views)):
        result.buffer_view(index)
    return result
