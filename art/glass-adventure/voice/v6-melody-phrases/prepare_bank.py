"""Resynthesize exact authored Merc contours and verify decoded delivery audio."""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
from pathlib import Path
import shutil
import subprocess
import tempfile

import librosa
import numpy as np
import pyworld
import soundfile as sf
from scipy.interpolate import interp1d


ROOT = Path(__file__).resolve().parent
REPO = ROOT.parents[3]
PUBLIC = REPO / "apps" / "beside-cue" / "public" / "games" / "adventure-voice-v6"
DELIVERY = ROOT / "delivery"
REVIEW = ROOT / "review"
ANALYSIS = ROOT / "analysis"
FRAME_SECONDS = 0.005
LEAD_SECONDS = 0.12
TAIL_SECONDS = 0.16
BITRATE = "64k"
MAXIMUM_CONSONANT_SECONDS = 0.11
SPECIAL_NUCLEUS_WINDOWS = {
    ("another-beautiful-mess", "ti"): 0.04,
}
PRESERVE_CONSONANT_SYLLABLES = {
    ("tiny-sparks-can-glow", "sparks"),
}
PRESERVED_CONSONANT_SCALE = 1
MINIMUM_MAPPED_NUCLEUS_SECONDS = 0.12


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def pace_code(pace: float) -> str:
    return f"{round(pace * 100):03d}"


def variant_path(variant: dict) -> Path:
    return PUBLIC / variant["melodyId"] / f"r{variant['rootMidi']}-p{pace_code(variant['pace'])}.mp3"


def midi_at(variant: dict, seconds: np.ndarray) -> np.ndarray:
    result = np.empty_like(seconds)
    for index, value in enumerate(seconds):
        bounded = min(max(0.0, float(value)), variant["durationSeconds"])
        segment = next(
            (candidate for candidate in variant["segments"] if bounded < candidate["endSeconds"]),
            variant["segments"][-1],
        )
        duration = segment["endSeconds"] - segment["startSeconds"]
        unit = min(max((bounded - segment["startSeconds"]) / duration, 0.0), 1.0)
        if segment["kind"] == "landing":
            result[index] = segment["fromMidi"]
        elif segment["kind"] == "glide":
            eased = unit * unit * (3 - 2 * unit)
            result[index] = segment["fromMidi"] + (
                segment["toMidi"] - segment["fromMidi"]
            ) * eased
        else:
            result[index] = np.nan
    return result


def syllable_regions(phrase: dict, alignment: dict) -> list[dict]:
    characters = [
        character
        for character in alignment["characters"]
        if character["text"].isalpha()
    ]
    expected_letters = "".join(character for character in phrase["words"] if character.isalpha())
    actual_letters = "".join(character["text"] for character in characters)
    if actual_letters.casefold() != expected_letters.casefold():
        raise ValueError(f"Alignment characters differ for {phrase['id']}: {actual_letters}")
    flat_counts = [
        count
        for word_counts in phrase["word_syllable_character_counts"]
        for count in word_counts
    ]
    if sum(flat_counts) != len(characters) or len(flat_counts) != len(phrase["syllables"]):
        raise ValueError(f"Syllable spelling differs for {phrase['id']}")
    regions = []
    cursor = 0
    for syllable, count in zip(phrase["syllables"], flat_counts):
        group = characters[cursor : cursor + count]
        vowel_indices = [
            index
            for index, character in enumerate(group)
            if character["text"].casefold() in "aeiouy"
        ]
        if not vowel_indices:
            raise ValueError(f"No vowel nucleus for {phrase['id']} syllable {syllable}")
        nucleus_start_index = vowel_indices[0]
        nucleus_end_index = nucleus_start_index
        while (
            nucleus_end_index + 1 < len(group)
            and group[nucleus_end_index + 1]["text"].casefold() in "aeiouy"
        ):
            nucleus_end_index += 1
        regions.append(
            {
                "syllable": syllable,
                "start": group[0]["start"],
                "end": group[-1]["end"],
                "nucleusStart": group[nucleus_start_index]["start"],
                "nucleusEnd": group[nucleus_end_index]["end"],
            }
        )
        cursor += count
    return regions


def select_voiced_nucleus_window(
    source: dict, start: float, end: float, window_seconds: float
) -> tuple[float, float, dict]:
    candidates = np.arange(
        start,
        end - window_seconds + FRAME_SECONDS / 2,
        FRAME_SECONDS,
    )
    if not len(candidates):
        raise ValueError("Aligned nucleus is shorter than its required voiced window")
    window_samples = round(window_seconds * source["rate"])
    scored = []
    for candidate in candidates:
        frame_mask = (source["times"] >= candidate) & (
            source["times"] < candidate + window_seconds
        )
        if not np.any(frame_mask):
            continue
        voiced = source["f0"][frame_mask] > 0
        voiced_fraction = float(np.mean(voiced))
        periodicity = float(1 - np.mean(source["aperiodic"][frame_mask]))
        sample_start = round(candidate * source["rate"])
        window = source["samples"][sample_start : sample_start + window_samples]
        energy = float(np.mean(window * window))
        scored.append(
            (
                voiced_fraction == 1,
                voiced_fraction,
                periodicity,
                energy,
                float(candidate),
            )
        )
    if not scored:
        raise ValueError("No WORLD frames overlap the required nucleus window")
    fully_voiced, voiced_fraction, periodicity, _, selected = max(scored)
    if not fully_voiced:
        raise ValueError(
            f"No fully voiced {window_seconds:.3f}s WORLD window in aligned nucleus"
        )
    return selected, selected + window_seconds, {
        "policy": "fully voiced WORLD window, then periodicity and energy",
        "voicedFraction": voiced_fraction,
        "meanPeriodicity": periodicity,
    }


def source_time_map(
    source: dict, regions: list[dict], variant: dict
) -> tuple[list[float], list[float], list[tuple[float, float]]]:
    source_edges = [0.0]
    source_edges.extend(
        (left["end"] + right["start"]) / 2
        for left, right in zip(regions, regions[1:])
    )
    source_edges.append(source["duration"])
    target_edges = [anchor["startSeconds"] for anchor in variant["anchors"]]
    target_edges.append(variant["durationSeconds"])
    if len(source_edges) != len(target_edges):
        raise ValueError(f"Syllable/anchor count differs for {variant['id']}")

    source_points: list[float] = []
    target_points: list[float] = []
    nuclei = []
    nucleus_selections = []
    for index, region in enumerate(regions):
        source_start, source_end = source_edges[index : index + 2]
        target_start, target_end = target_edges[index : index + 2]
        nucleus_start = min(
            max(region["nucleusStart"], source_start + FRAME_SECONDS),
            source_end - FRAME_SECONDS * 2,
        )
        nucleus_end = min(
            max(region["nucleusEnd"], nucleus_start + FRAME_SECONDS),
            source_end - FRAME_SECONDS,
        )
        selection = {"policy": "full aligned vowel"}
        special_window = SPECIAL_NUCLEUS_WINDOWS.get(
            (variant["phraseId"], region["syllable"].casefold())
        )
        if special_window is not None and nucleus_end - nucleus_start > special_window:
            nucleus_start, nucleus_end, selection = select_voiced_nucleus_window(
                source, nucleus_start, nucleus_end, special_window
            )
        nuclei.append((nucleus_start, nucleus_end))
        target_duration = target_end - target_start
        source_attack = nucleus_start - source_start
        source_release = source_end - nucleus_end
        preserve_consonants = (
            variant["phraseId"],
            region["syllable"].casefold(),
        ) in PRESERVE_CONSONANT_SYLLABLES
        if preserve_consonants:
            consonant_scale = min(
                PRESERVED_CONSONANT_SCALE,
                (target_duration - MINIMUM_MAPPED_NUCLEUS_SECONDS)
                / (source_attack + source_release),
            )
            attack = source_attack * consonant_scale
            release = source_release * consonant_scale
            consonant_policy = "retain near-natural source duration around mapped vowel"
        else:
            attack = min(
                MAXIMUM_CONSONANT_SECONDS,
                source_attack,
                target_duration * 0.18,
            )
            release = min(
                MAXIMUM_CONSONANT_SECONDS,
                source_release,
                target_duration * 0.18,
            )
            consonant_policy = "bounded natural edge"
        nucleus_selections.append(
            {
                "syllable": region["syllable"],
                "start": nucleus_start,
                "end": nucleus_end,
                "mappedAttackSeconds": attack,
                "mappedReleaseSeconds": release,
                "consonantPolicy": consonant_policy,
                **selection,
            }
        )
        source_points.extend([source_start, nucleus_start, nucleus_end])
        target_points.extend(
            [target_start, target_start + attack, target_end - release]
        )
    source_points.append(source_edges[-1])
    target_points.append(target_edges[-1])
    if any(right <= left for left, right in zip(source_points, source_points[1:])):
        raise ValueError(f"Source time map is not increasing for {variant['id']}")
    if any(right <= left for left, right in zip(target_points, target_points[1:])):
        raise ValueError(f"Target time map is not increasing for {variant['id']}")
    return source_points, target_points, nuclei, nucleus_selections


def analyze_source(path: Path) -> dict:
    source, rate = sf.read(path, dtype="float64")
    if source.ndim != 1 or rate != 24000:
        raise ValueError(f"Expected mono 24 kHz source: {path.name}")
    source = np.ascontiguousarray(source)
    f0, times = pyworld.harvest(
        source,
        rate,
        f0_floor=60,
        f0_ceil=600,
        frame_period=FRAME_SECONDS * 1000,
    )
    f0 = pyworld.stonemask(source, f0, times, rate)
    return {
        "samples": source,
        "rate": rate,
        "duration": len(source) / rate,
        "f0": f0,
        "times": times,
        "spectral": pyworld.cheaptrick(source, f0, times, rate),
        "aperiodic": pyworld.d4c(source, f0, times, rate),
    }


def synthesize(source: dict, variant: dict, regions: list[dict]) -> tuple[np.ndarray, dict]:
    source_points, target_points, nuclei, nucleus_selections = source_time_map(
        source, regions, variant
    )
    output_times = np.arange(
        0,
        variant["durationSeconds"] + TAIL_SECONDS + FRAME_SECONDS / 2,
        FRAME_SECONDS,
    )
    warped = np.interp(
        np.minimum(output_times, variant["durationSeconds"]),
        target_points,
        source_points,
    )
    spectral = interp1d(
        source["times"],
        source["spectral"],
        axis=0,
        bounds_error=False,
        fill_value=(source["spectral"][0], source["spectral"][-1]),
    )(warped)
    aperiodic = interp1d(
        source["times"],
        source["aperiodic"],
        axis=0,
        bounds_error=False,
        fill_value=(source["aperiodic"][0], source["aperiodic"][-1]),
    )(warped)
    closest = np.minimum(
        np.rint(warped / FRAME_SECONDS).astype(int), len(source["f0"]) - 1
    )
    expected_midi = midi_at(
        variant, np.minimum(output_times, variant["durationSeconds"])
    )
    target_pitch = 440 * np.power(2, (expected_midi - 69) / 12)
    pitch = target_pitch.copy()
    nucleus_frames = np.zeros(len(warped), dtype=bool)
    for nucleus_start, nucleus_end in nuclei:
        nucleus_frames |= (warped >= nucleus_start) & (warped <= nucleus_end)
    pitch[(source["f0"][closest] == 0) & ~nucleus_frames] = 0
    rendered = pyworld.synthesize(
        np.ascontiguousarray(pitch),
        np.ascontiguousarray(spectral),
        np.ascontiguousarray(aperiodic),
        source["rate"],
        FRAME_SECONDS * 1000,
    )
    fade_start = int((variant["durationSeconds"] - 0.04) * source["rate"])
    envelope = np.ones(len(rendered))
    envelope[fade_start:] = np.linspace(1, 0, len(rendered) - fade_start) ** 2
    onset = min(len(rendered), int(source["rate"] * 0.012))
    envelope[:onset] = np.linspace(0, 1, onset)
    rendered *= envelope
    rendered = np.concatenate(
        [np.zeros(round(LEAD_SECONDS * source["rate"])), rendered]
    )
    peak = max(1e-9, float(np.max(np.abs(rendered))))
    rendered *= min(0.79 / peak, 2)
    return rendered, {
        "sourceSeconds": source_points,
        "targetSeconds": target_points,
        "nucleusSelections": nucleus_selections,
    }


def decoded_report(decoded: Path, variant: dict) -> dict:
    audio, rate = sf.read(decoded, dtype="float64")
    f0, voiced, probability = librosa.pyin(
        audio,
        fmin=60,
        fmax=800,
        sr=rate,
        frame_length=2048,
        hop_length=120,
        center=True,
    )
    times = librosa.times_like(f0, sr=rate, hop_length=120)
    mask = (
        voiced
        & np.isfinite(f0)
        & (probability >= 0.5)
        & (times >= LEAD_SECONDS + 0.06)
        & (times < LEAD_SECONDS + variant["durationSeconds"] - 0.06)
    )
    expected = midi_at(variant, times[mask] - LEAD_SECONDS)
    cents = 100 * (69 + 12 * np.log2(f0[mask] / 440) - expected)
    if len(cents) < 8:
        raise ValueError(f"Insufficient decoded pitch evidence for {variant['id']}")
    deltas = np.abs(np.diff(audio))
    return {
        "sampleRate": rate,
        "durationSeconds": len(audio) / rate,
        "peakDb": float(20 * np.log10(max(1e-9, np.max(np.abs(audio))))),
        "maximumSampleDelta": float(np.max(deltas)),
        "pyinVoicedFrames": int(mask.sum()),
        "pyinMedianAbsoluteCents": float(np.median(np.abs(cents))),
        "pyinP95AbsoluteCents": float(np.percentile(np.abs(cents), 95)),
        "pyinMaximumAbsoluteCents": float(np.max(np.abs(cents))),
    }


parser = argparse.ArgumentParser()
parser.add_argument("mode", choices=("pilot", "full"))
args = parser.parse_args()
plan = json.loads((ROOT / "phrase-plan.json").read_text())
selection = json.loads((ANALYSIS / "source-selection.json").read_text())
compiled = json.loads((ANALYSIS / "compiled-contours.json").read_text())
if not (plan["revision"] == selection["revision"] == compiled["revision"]):
    raise SystemExit("Production revisions differ.")

phrases = {phrase["id"]: phrase for phrase in plan["phrases"]}
selections = {phrase["id"]: phrase for phrase in selection["phrases"]}
sources = {}
regions = {}
for phrase_id, phrase in phrases.items():
    identity = selections[phrase_id]["selected_source"]
    source_path = ROOT / "raw" / f"{identity}.wav"
    alignment = json.loads((ANALYSIS / f"{identity}-alignment.json").read_text())
    if alignment["status"] != "complete" or alignment["sha256"] != sha256(source_path):
        raise SystemExit(f"Alignment/source mismatch for {identity}")
    sources[phrase_id] = analyze_source(source_path)
    regions[phrase_id] = syllable_regions(phrase, alignment)

roots = (
    {plan["supported_root_midi"]["minimum"], plan["native_root_midi"], plan["supported_root_midi"]["maximum"]}
    if args.mode == "pilot"
    else set(range(plan["supported_root_midi"]["minimum"], plan["supported_root_midi"]["maximum"] + 1))
)
variants = [variant for variant in compiled["variants"] if variant["rootMidi"] in roots]
expected_count = len(phrases) * len(roots) * len(plan["supported_paces"])
if len(variants) != expected_count:
    raise SystemExit(f"Expected {expected_count} compiled variants, found {len(variants)}")
variant_filter = os.environ.get("MERC_VARIANT_FILTER")
if variant_filter:
    variants = [variant for variant in variants if variant_filter in variant["id"]]
    if not variants:
        raise SystemExit(f"No variant matches {variant_filter!r}")

PUBLIC.mkdir(parents=True, exist_ok=True)
DELIVERY.mkdir(exist_ok=True)
REVIEW.mkdir(exist_ok=True)
reports = []
with tempfile.TemporaryDirectory(prefix="merc-v6-bank-") as temporary:
    temporary_root = Path(temporary)
    for index, variant in enumerate(variants, start=1):
        phrase = phrases[variant["phraseId"]]
        # Catch drift between the Python sampler and compiler probes before rendering.
        probe_times = np.array([probe["timeSeconds"] for probe in variant["probes"]])
        probe_expected = np.array([probe["midi"] for probe in variant["probes"]])
        if not np.allclose(midi_at(variant, probe_times), probe_expected, atol=1e-9):
            raise SystemExit(f"Contour sampler drift for {variant['id']}")
        if phrase["id"] == "tiny-sparks-can-glow":
            peak_index = int(np.argmax([anchor["midi"] for anchor in variant["anchors"]]))
            if phrase["syllables"][peak_index] != "sparks":
                raise SystemExit("Sunlit-steps peak no longer lands on sparks.")

        rendered, time_map = synthesize(
            sources[variant["phraseId"]], variant, regions[variant["phraseId"]]
        )
        master = temporary_root / f"{variant['id']}-master.wav"
        sf.write(master, rendered, sources[variant["phraseId"]]["rate"], subtype="PCM_24")
        output = variant_path(variant)
        output.parent.mkdir(parents=True, exist_ok=True)
        subprocess.run(
            [
                "ffmpeg",
                "-v",
                "error",
                "-y",
                "-i",
                str(master),
                "-af",
                "loudnorm=I=-20:TP=-2:LRA=9",
                "-ar",
                "24000",
                "-ac",
                "1",
                "-c:a",
                "libmp3lame",
                "-b:a",
                BITRATE,
                str(output),
            ],
            check=True,
        )
        decoded = temporary_root / f"{variant['id']}-decoded.wav"
        subprocess.run(
            ["ffmpeg", "-v", "error", "-y", "-i", str(output), "-ar", "24000", str(decoded)],
            check=True,
        )
        quality = decoded_report(decoded, variant)
        report = {
            "id": variant["id"],
            "phraseId": variant["phraseId"],
            "melodyId": variant["melodyId"],
            "rootMidi": variant["rootMidi"],
            "pace": variant["pace"],
            "source": selections[variant["phraseId"]]["selected_source"],
            "asset": str(output.relative_to(REPO / "apps" / "beside-cue" / "public" / "games")),
            "bytes": output.stat().st_size,
            "sha256": sha256(output),
            "timeMap": time_map,
            **quality,
        }
        reports.append(report)
        if variant["rootMidi"] == plan["native_root_midi"] and variant["pace"] == 1:
            retained_master = DELIVERY / f"{variant['phraseId']}-root50-pace100-master.wav"
            retained_decoded = DELIVERY / f"{variant['phraseId']}-root50-pace100-decoded.wav"
            shutil.copyfile(master, retained_master)
            shutil.copyfile(decoded, retained_decoded)
            shutil.copyfile(output, REVIEW / f"{variant['phraseId']}-root50-pace100.mp3")
        print(json.dumps({"variant": index, "total": len(variants), "id": variant["id"], "bytes": report["bytes"]}), flush=True)

summary = {
    "revision": plan["revision"],
    "status": args.mode,
    "codec": f"mono 24 kHz MP3 {BITRATE}",
    "synthesis": {
        "pitchSource": "authored contour on naturally voiced WORLD frames",
        "detectorCarrier": "none",
        "defaultMaximumMappedConsonantEdgeSeconds": MAXIMUM_CONSONANT_SECONDS,
        "preservedConsonantSyllables": [
            {
                "phraseId": phrase_id,
                "syllable": syllable,
                "sourceDurationScale": PRESERVED_CONSONANT_SCALE,
            }
            for phrase_id, syllable in sorted(PRESERVE_CONSONANT_SYLLABLES)
        ],
        "defaultNucleusSelection": "full aligned vowel",
        "specialNucleusWindows": [
            {
                "phraseId": phrase_id,
                "syllable": syllable,
                "seconds": seconds,
                "selection": "fully voiced WORLD window, then periodicity and energy",
            }
            for (phrase_id, syllable), seconds in SPECIAL_NUCLEUS_WINDOWS.items()
        ],
    },
    "variantFilter": variant_filter,
    "roots": sorted({report["rootMidi"] for report in reports}),
    "paces": sorted({report["pace"] for report in reports}),
    "variantCount": len(reports),
    "totalBytes": sum(report["bytes"] for report in reports),
    "maximumBytes": max(report["bytes"] for report in reports),
    "pyinMedianAbsoluteCentsMaximum": max(report["pyinMedianAbsoluteCents"] for report in reports),
    "pyinP95AbsoluteCentsMaximum": max(report["pyinP95AbsoluteCents"] for report in reports),
    "maximumSampleDelta": max(report["maximumSampleDelta"] for report in reports),
    "variants": reports,
}
(ANALYSIS / f"bank-{args.mode}.json").write_text(json.dumps(summary, indent=2) + "\n")
if args.mode == "full":
    manifest = {
        "revision": plan["revision"],
        "kind": "merc-exact-contour-bank",
        "lazyLoadOneVariant": True,
        "synthesis": summary["synthesis"],
        "roots": sorted(roots),
        "paces": plan["supported_paces"],
        "totalBytes": summary["totalBytes"],
        "files": [
            {"path": report["asset"].removeprefix("adventure-voice-v6/"), "bytes": report["bytes"], "sha256": report["sha256"]}
            for report in reports
        ],
    }
    (PUBLIC / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
print(json.dumps({key: summary[key] for key in ("status", "variantCount", "totalBytes", "pyinMedianAbsoluteCentsMaximum", "pyinP95AbsoluteCentsMaximum", "maximumSampleDelta")}))
