#!/usr/bin/env python3
"""V3 asset review builder — present only available source, donor and finalization evidence."""
from datetime import datetime, timezone
from hashlib import sha256
from html import escape
import json
import os
import struct
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
FAMILIES = [
    ("fluted-carafe", "Fluted carafe", "The fluted treasure", "fluted-carafe-geometry.png"),
    ("moon-amphora", "Moon amphora", "The moon amphora", "moon-amphora-geometry.png"),
    ("cut-crystal-decanter", "Cut-crystal decanter", "Asset gallery only; placement not chosen", "cut-crystal-decanter-geometry-v2.png"),
    ("aurora-coupe", "Aurora coupe", "Asset gallery only; placement not chosen", "aurora-coupe-geometry.png"),
    ("gilded-column", "Gilded column", "Architectural study; placement not chosen", None),
    ("garden-arcade", "Garden arcade", "Backdrop and boundary dressing; low sills", None),
    ("observatory-canopy", "Observatory pavilion", "Skyline landmark; scene clearance pending", None),
]


ARCHITECTURE_CANDIDATES = {
    "gilded-column": "gilded-column-01-final-v2",
    "garden-arcade": "garden-arcade-01-final-v1",
    "observatory-canopy": "observatory-canopy-01-final-v1",
}


def relative(path):
    return Path(os.path.relpath(path, HERE)).as_posix()


def first(paths):
    return next((path for path in paths if path.is_file()), None)


def ready_glb(path):
    if path is None or not path.is_file() or path.stat().st_size < 12:
        return False
    with path.open("rb") as handle:
        magic, version, size = struct.unpack("<4sII", handle.read(12))
    return magic == b"glTF" and version == 2 and size == path.stat().st_size


def link(path, label):
    if path is None or not path.is_file():
        return ""
    return f'<a href="{escape(relative(path), quote=True)}">{escape(label)}</a>'


def read(path):
    if path is None or not path.is_file():
        return {}
    return json.loads(path.read_text())


def picture(path, title, caption, pending):
    if path is None:
        visual = f'<div class="pending"><span>{escape(pending)}</span><small>No substitute image is shown.</small></div>'
    else:
        url = escape(relative(path), quote=True)
        visual = f'<a class="image-link" href="{url}" aria-label="Open full-size {escape(title, quote=True)}"><img src="{url}" alt="{escape(title, quote=True)}" loading="lazy"></a>'
    return f'<figure>{visual}<figcaption><h3>{escape(title)}</h3><p>{escape(caption)}</p></figcaption></figure>'


def family(entry):
    slug, title, use, guide = entry
    donor = HERE / "donors" / slug
    architecture = HERE / "architecture"
    source = HERE.parent / "v2" / "meshy" / (slug + "-01")
    reference = HERE.parent / "v2" / "references" / (slug + ".png")
    status = read(source / "status.json")
    final_stem = ARCHITECTURE_CANDIDATES.get(slug, slug)
    if not reference.is_file():
        reference = HERE.parent / "v2" / "references" / (slug + "-geometry.png")
    raw = first([source / "donor.glb", architecture / "raw" / (slug + "-01") / "donor.glb"])
    raw_image = first([donor / "inspection-three-quarter.png", donor / "inspection-front.png", architecture / "proofs" / (slug + "-01-raw-three-quarter.png"), architecture / "reviews" / (slug + "-raw.png"), architecture / (slug + "-raw.png")])
    final_image = first([donor / "finalized-intact.png", donor / "final-intact.png", donor / "intact-review.png", donor / "finalized.png", architecture / "proofs" / (final_stem + "-three-quarter.png"), architecture / "reviews" / (slug + "-final.png"), architecture / (slug + "-final.png")])
    fracture = first([donor / "finalized-fracture.png", donor / "fracture-review.png", donor / "fractures.png"])
    raw_blend = first([donor / "raw-import.blend", architecture / "sources" / (slug + "-01-imported.blend")])
    final_blend = first([donor / "finalized.blend", architecture / "sources" / (final_stem + ".blend")])
    final_glb = first([HERE / "exports" / (slug + ".glb"), HERE / "staging" / (slug + ".glb"), architecture / "exports" / (final_stem + ".glb")])
    report = first([donor / "finalization.json", architecture / "reports" / (final_stem + ".json")])
    validation = first([donor / "validation.json", architecture / "reports" / (final_stem + "-validation.json")])
    inspection = first([donor / "inspection.json", architecture / "reports" / (slug + "-01-intake.json")])
    # A diagnostic file's existence never promotes a rejected trial to a candidate.
    if slug not in ARCHITECTURE_CANDIDATES and read(donor / "validation.json").get("status") != "passed":
        final_image = fracture = final_blend = final_glb = None
    if slug in ARCHITECTURE_CANDIDATES:
        accepted = ARCHITECTURE_CANDIDATES[slug]
        candidate_validation = architecture / "reports" / (accepted + "-validation.json")
        if read(candidate_validation).get("status") == "passed":
            final_image = first([architecture / "proofs" / (accepted + "-three-quarter.png")])
            final_blend = first([architecture / "sources" / (accepted + ".blend")])
            final_glb = first([architecture / "exports" / (accepted + ".glb")])
            validation = candidate_validation
            report = first([architecture / "reports" / (accepted + ".json")])
        else:
            final_image = fracture = final_blend = final_glb = None
    if final_glb and (not ready_glb(final_glb) or read(validation).get("glbSha256") != sha256(final_glb.read_bytes()).hexdigest()):
        final_image = fracture = final_blend = final_glb = None
    available = ready_glb(raw)
    raw_caption = "Actual donor geometry, before glass and fracture finalization. Neutral inspection materials may be used to make the shape readable; the linked source GLB is unchanged." if raw_image else ("GLB archived. An actual donor image has not been added yet." if available else "Meshy reports success. The local archive download is still pending.")
    final_caption = "Actual Blender render, available for visual review. This is not an in-game capture or an integration approval." if final_image else "Material, topology and fracture work remain pending in this view. The running game still uses v2 artwork."
    if slug == "garden-arcade" and final_image:
        final_caption += " Backdrop audition: the donor retains low sills and an end planter; rear trim is softer close up."
    if slug == "observatory-canopy" and final_image:
        final_caption += " The crown is open; the white center in the top view is the podium below. Original rib waviness remains."
    archive = [link(reference, "Beauty reference"), link(HERE.parent / "v2" / "references" / guide, "Geometry guide") if guide else "", link(raw if available else None, "Unchanged Meshy GLB"), link(raw_blend, "Original import .blend"), link(donor / "prepared.blend", "Prepared .blend"), link(final_blend, "Finalized .blend"), link(final_glb, "Staged GLB"), link(donor / "inspection-mouth.png", "Donor mouth detail"), link(architecture / "proofs" / (slug + "-01-raw-back.png"), "Donor back view"), link(architecture / "proofs" / (slug + "-01-raw-capital.png"), "Donor capital detail"), link(architecture / "proofs" / (final_stem + "-back.png"), "Final back view"), link(architecture / "proofs" / (final_stem + "-capital.png"), "Final capital detail"), link(architecture / "proofs" / (final_stem + "-top.png"), "Final top view"), link(inspection, "Inspection report"), link(report, "Finalization report"), link(validation, "Validation report"), link(source / "archive.json", "Source archive and hashes"), link(source / "provider-task.json", "Provider provenance"), link(donor / "source.json", "Source hash")]
    if available:
        archive.insert(0, f'<a href="model-viewer.html?asset={escape(slug, quote=True)}">Inspect the model in 3D</a>')
    extra = ''
    if fracture:
        extra = '<div class="fracture">' + picture(fracture, title + " fracture", "Actual finalized geometry. Check the silhouette, cut faces and matching trim.", "") + '</div>'
    stage = "Blender image ready for review" if final_image else ("Donor archived; finalization pending" if available else "Download pending")
    html = f'<section id="{slug}"><div class="section-head"><div><h2>{escape(title)}</h2><p>Intended use: {escape(use)}.</p></div><span class="stage">{stage}</span></div><div class="comparison">' + picture(reference, "Visual reference", "Generated design target; not a 3D model or gameplay screenshot.", "Reference unavailable") + picture(raw_image, "Raw Meshy donor", raw_caption, "Donor image pending") + picture(final_image, "Blender-final study", final_caption, "Final study pending") + '</div>' + extra + '<details><summary>Source archive and inspection evidence</summary><div class="archive">' + ''.join(item for item in archive if item) + '</div><p class="small">Raw files remain preserved separately from prepared and finalized sources. No v3 asset on this page is activated in the current game.</p></details></section>'
    evidence = {"id": slug, "meshystatus": status.get("status"), "rawArchived": available, "rawImage": relative(raw_image) if raw_image else None, "finalImage": relative(final_image) if final_image else None, "finalGlb": relative(final_glb) if final_glb else None, "integration": "not-activated"}
    return html, evidence


def main():
    sections, evidence = zip(*(family(entry) for entry in FAMILIES))
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    archived = sum(item["rawArchived"] for item in evidence)
    finals = sum(item["finalImage"] is not None for item in evidence)
    nav = ''.join(f'<a href="#{slug}">{escape(title)}</a>' for slug, title, _, _ in FAMILIES)
    css = r"""
:root { color-scheme: light; --ink:#183b42; --muted:#526c72; --page:#e7f0f0; --paper:#fff; --gold:#886321; --line:#b9cccf; }
* { box-sizing:border-box; } html { scroll-behavior:smooth; } body { margin:0; color:var(--ink); background:var(--page); font:16px/1.55 'Trebuchet MS',Arial,sans-serif; }
a { color:#145866; text-underline-offset:4px; } a:hover { color:#784f16; } a:focus-visible,summary:focus-visible { outline:3px solid #86601a; outline-offset:5px; }
main { max-width:1460px; margin:auto; padding:42px 36px 80px; } header { display:grid; grid-template-columns:1fr minmax(260px,31%); gap:42px; align-items:center; } h1 { font-size:clamp(36px,4.4vw,62px); line-height:1.08; letter-spacing:-.04em; margin:12px 0 20px; max-width:720px; } h2 { font-size:32px; line-height:1.15; margin:0 0 7px; letter-spacing:-.025em; } h3 { font-size:19px; margin:0 0 6px; } p { margin:0 0 14px; max-width:76ch; } .intro { font-size:18px; color:var(--muted); max-width:67ch; } .direction { margin:0; } .direction img { width:100%; display:block; aspect-ratio:1.35; object-fit:cover; } .direction figcaption { font-size:13px; color:var(--muted); padding-top:7px; }
.status { background:#d4e5e7; border-left:4px solid #386872; padding:16px 20px; margin:28px 0 22px; display:flex; flex-wrap:wrap; gap:8px 28px; } .status strong { display:block; } .status span { color:var(--muted); font-size:14px; } nav { display:flex; flex-wrap:wrap; gap:12px 25px; margin-bottom:40px; } section { background:var(--paper); padding:28px; margin:0 0 30px; scroll-margin-top:18px; } .section-head { display:flex; flex-wrap:wrap; justify-content:space-between; gap:12px; align-items:start; margin-bottom:20px; } .section-head p { color:var(--muted); margin:0; font-size:14px; } .stage { max-width:300px; font-size:13px; color:#66511e; background:#f0ebd8; padding:7px 11px; }
.comparison { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:20px; } figure { margin:0; min-width:0; } .image-link { display:block; background:#ecf0f0; } .image-link img { display:block; width:100%; height:auto; aspect-ratio:3/4; object-fit:contain; } figcaption { padding:14px 2px 8px; } figcaption p { font-size:14px; color:var(--muted); } .pending { aspect-ratio:3/4; background:#edf2f3; border:1px dashed var(--line); display:flex; justify-content:center; align-items:center; flex-direction:column; text-align:center; padding:24px; color:var(--muted); } .pending span { font-size:19px; color:#3d5c63; } .pending small { margin-top:7px; max-width:22ch; } details { margin-top:16px; padding-top:17px; border-top:1px solid var(--line); } summary { cursor:pointer; width:fit-content; font-weight:bold; } .archive { display:flex; flex-wrap:wrap; gap:12px 24px; margin:17px 0; } .small { font-size:13px; color:var(--muted); } .fracture { max-width:680px; margin:12px auto; } .fracture img { aspect-ratio:4/3; } footer { color:var(--muted); padding-top:8px; font-size:14px; } footer a { margin-right:20px; }
@media(max-width:850px) { main { padding:28px 18px 60px; } header { grid-template-columns:1fr; gap:20px; } .direction { display:none; } section { padding:20px; } .comparison { gap:13px; } h2 { font-size:27px; } .stage { max-width:none; } }
@media(max-width:620px) { .comparison { grid-template-columns:1fr; gap:20px; } .image-link img,.pending { aspect-ratio:1; } .pending { min-height:200px; } .section-head { gap:14px; } nav { gap:9px 19px; } }
@media(prefers-reduced-motion:reduce) { html { scroll-behavior:auto; } }
"""
    html = f'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Glassworks — Meshy source and Blender studies</title><style>{css}</style></head><body><main><header><div><a href="../v2/review.html">View the current v2 artwork</a><h1>From Meshy donor<br>to museum glass.</h1><p class="intro">Compare the design reference, untouched source model and Blender finish. These seven studies are separate from the version you are currently playing.</p></div><figure class="direction"><a href="../concepts/floating-museum-direction.png"><img src="../concepts/floating-museum-direction.png" alt="The floating glass museum visual direction"></a><figcaption>The museum direction. Model fidelity is reviewed below.</figcaption></figure></header><div class="status"><div><strong>Current game remains on v2</strong><span>No v3 visual replacements are activated.</span></div><div><strong>{archived} of {len(FAMILIES)} raw donors archived</strong><span>{finals} Blender study images available for review.</span></div><div><strong>Snapshot {now[:10]}</strong><span>Updated {now[11:19]} UTC; reload after the gallery is refreshed.</span></div></div><nav aria-label="Asset families">{nav}</nav>' + ''.join(sections) + '<footer><p>Generated reference pictures show the intended design. Raw inspection and Blender study pictures show actual geometry with their stated materials and lighting. Final appearance and performance still need an in-game review before activation.</p><p><a href="../v2/review.html">V2 artwork review</a><a href="../audio/v1/review.html">Music and ambience auditions</a><a href="README.md">V3 production notes</a><a href="review-evidence.json">Gallery file snapshot</a></p></footer></main></body></html>'
    (HERE / "review.html").write_text(html)
    (HERE / "review-evidence.json").write_text(json.dumps({"generatedAt": now, "families": evidence}, indent=2) + "\n")
    print(json.dumps({"gallery": str(HERE / "review.html"), "rawArchived": archived, "finalImages": finals}))


if __name__ == "__main__":
    main()
