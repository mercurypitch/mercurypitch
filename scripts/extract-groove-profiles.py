#!/usr/bin/env python3
"""Extract per-style humanization tables from the Groove MIDI Dataset.

Offline, one-time tool. Input: an extracted GMD v1.0 directory (the
`groove/` folder containing info.csv and the per-drummer MIDI files),
CC-BY 4.0, https://magenta.tensorflow.org/datasets/groove — attribution
ships in the app's license manifest ("statistical aggregation only, no
MIDI redistributed"). Output: a JSON table consumed by
src/features/drum-night/groove/groove-humanize.ts as per-style,
per-articulation, per-sixteenth overrides for the flat defaults.

Usage:
    python3 scripts/extract-groove-profiles.py \
        --gmd /path/to/groove \
        --out src/features/drum-night/groove/groove-profiles.generated.json

Dependencies: python3 >= 3.11, pretty_midi, numpy (pandas not required).
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import math
import statistics
import sys
from collections import defaultdict
from pathlib import Path

try:
    import pretty_midi  # type: ignore
except ImportError:  # pragma: no cover
    sys.exit("pretty_midi is required: pip install pretty_midi numpy")

# Roland TD-11 pitches (per the GMD documentation) folded onto the app's
# twelve shared articulations; unmapped auxiliary percussion is dropped.
TD11_TO_ARTICULATION = {
    36: "kick",
    38: "snare",
    40: "snare",
    37: "sidestick",
    22: "hh-closed",
    42: "hh-closed",
    44: "hh-pedal",
    26: "hh-open",
    46: "hh-open",
    48: "tom-high",
    50: "tom-high",
    45: "tom-mid",
    47: "tom-mid",
    43: "tom-low",
    58: "tom-low",
    49: "crash",
    52: "crash",
    55: "crash",
    57: "crash",
    51: "ride",
    53: "ride",
    59: "ride",
}

STYLE_GROUPS = {
    "rock": {"rock", "punk", "pop", "country", "blues"},
    "funk": {"funk", "soul", "dance", "hiphop"},
    "jazz": {"jazz", "gospel", "neworleans"},
    "latin": {"latin", "afrocuban", "afrobeat", "reggae", "highlife"},
}

STEPS_PER_BAR = 16
MIN_CELL_COUNT = 50
GHOST_VELOCITY_MAX = 45
FLAM_WINDOW_S = (0.015, 0.045)
ACCENT_VELOCITY = 100


def style_group(style: str) -> str | None:
    primary = style.split("/")[0].strip().lower()
    for group, members in STYLE_GROUPS.items():
        if primary in members:
            return group
    return None


def robust_stats(values: list[float]) -> tuple[float, float]:
    """Median and MAD-scaled sigma; resistant to mis-quantized outliers."""
    median = statistics.median(values)
    mad = statistics.median(abs(value - median) for value in values)
    return median, 1.4826 * mad


def position_class(step: int) -> str:
    if step % 4 == 0:
        return "down"
    if step % 4 == 2:
        return "eighthOff"
    return "sixteenthOff"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--gmd", required=True, type=Path)
    parser.add_argument("--out", required=True, type=Path)
    args = parser.parse_args()

    info_path = args.gmd / "info.csv"
    if not info_path.is_file():
        sys.exit(f"info.csv not found under {args.gmd}")

    # cell[(group, articulation, step)] -> {"off": [...ms], "vel": [...]}
    cells: dict[tuple[str, str, int], dict[str, list[float]]] = defaultdict(
        lambda: {"off": [], "vel": []}
    )
    ghost_hits: dict[str, int] = defaultdict(int)
    ghost_slots: dict[str, int] = defaultdict(int)
    ghost_velocities: dict[str, list[float]] = defaultdict(list)
    flam_opportunities: dict[str, int] = defaultdict(int)
    flam_hits: dict[str, int] = defaultdict(int)
    flam_leads: dict[str, list[float]] = defaultdict(list)
    files_used = 0

    with info_path.open(newline="") as handle:
        rows = list(csv.DictReader(handle))
    for row in rows:
        if row.get("time_signature") != "4-4":
            continue
        group = style_group(row.get("style", ""))
        if group is None:
            continue
        is_beat = row.get("beat_type") == "beat"
        midi_path = args.gmd / row["midi_filename"]
        if not midi_path.is_file():
            continue
        try:
            midi = pretty_midi.PrettyMIDI(str(midi_path))
            bpm = float(row["bpm"])
        except (OSError, ValueError, KeyError):
            continue
        if bpm <= 0:
            continue
        grid_s = 60.0 / bpm / 4.0  # one sixteenth
        notes = [
            (note.start, note.pitch, note.velocity)
            for instrument in midi.instruments
            for note in instrument.notes
            if note.pitch in TD11_TO_ARTICULATION
        ]
        if not notes:
            continue
        files_used += 1
        notes.sort()

        # De-drift: subtract each bar's mean offset before aggregating so the
        # slow tempo-drift process stays out of the per-position tables.
        bar_offsets: dict[int, list[float]] = defaultdict(list)
        placed: list[tuple[int, int, str, float, float]] = []
        for start, pitch, velocity in notes:
            slot = round(start / grid_s)
            offset_s = start - slot * grid_s
            if abs(offset_s) > 0.45 * grid_s:
                continue
            bar = slot // STEPS_PER_BAR
            step = slot % STEPS_PER_BAR
            articulation = TD11_TO_ARTICULATION[pitch]
            bar_offsets[bar].append(offset_s)
            placed.append((bar, step, articulation, offset_s, float(velocity)))

        bar_mean = {
            bar: sum(values) / len(values) for bar, values in bar_offsets.items()
        }
        if is_beat:
            for bar, step, articulation, offset_s, velocity in placed:
                cell = cells[(group, articulation, step)]
                cell["off"].append((offset_s - bar_mean[bar]) * 1000.0)
                cell["vel"].append(velocity)

            # Ghost statistics: quiet snares away from the backbeats.
            snare_steps: dict[int, list[tuple[int, float]]] = defaultdict(list)
            for bar, step, articulation, _, velocity in placed:
                if articulation == "snare":
                    snare_steps[bar].append((step, velocity))
            for bar, hits in snare_steps.items():
                occupied = {step for step, _ in hits}
                eligible = [
                    step
                    for step in range(STEPS_PER_BAR)
                    if step not in (4, 12) and step not in occupied
                ]
                ghost_slots[group] += len(eligible) + sum(
                    1
                    for step, velocity in hits
                    if step not in (4, 12) and velocity < GHOST_VELOCITY_MAX
                )
                for step, velocity in hits:
                    if step not in (4, 12) and velocity < GHOST_VELOCITY_MAX:
                        ghost_hits[group] += 1
                        ghost_velocities[group].append(velocity)

        # Flam statistics come from every file, fills included.
        snare_notes = [
            (start, velocity)
            for start, pitch, velocity in notes
            if TD11_TO_ARTICULATION[pitch] == "snare"
        ]
        for index in range(1, len(snare_notes)):
            start, velocity = snare_notes[index]
            previous_start, previous_velocity = snare_notes[index - 1]
            gap = start - previous_start
            if velocity >= ACCENT_VELOCITY:
                flam_opportunities[group] += 1
                if FLAM_WINDOW_S[0] <= gap <= FLAM_WINDOW_S[1]:
                    flam_hits[group] += 1
                    flam_leads[group].append(gap * 1000.0)

    if files_used == 0:
        sys.exit("No usable 4/4 GMD files found — is --gmd the groove/ root?")

    # Pool per position class for sparse cells.
    pooled: dict[tuple[str, str, str], dict[str, list[float]]] = defaultdict(
        lambda: {"off": [], "vel": []}
    )
    for (group, articulation, step), cell in cells.items():
        pool = pooled[(group, articulation, position_class(step))]
        pool["off"].extend(cell["off"])
        pool["vel"].extend(cell["vel"])

    styles: dict[str, dict] = {}
    for group in STYLE_GROUPS:
        table: dict[str, list[dict | None]] = {}
        articulations = sorted(
            {articulation for g, articulation, _ in cells if g == group}
        )
        for articulation in articulations:
            positions: list[dict | None] = []
            for step in range(STEPS_PER_BAR):
                cell = cells.get((group, articulation, step))
                source = cell
                if cell is None or len(cell["off"]) < MIN_CELL_COUNT:
                    source = pooled.get(
                        (group, articulation, position_class(step))
                    )
                if source is None or len(source["off"]) < MIN_CELL_COUNT:
                    positions.append(None)
                    continue
                off_mean, off_sd = robust_stats(source["off"])
                vel_mean, vel_sd = robust_stats(source["vel"])
                positions.append(
                    {
                        "offMeanMs": round(off_mean, 2),
                        "offSdMs": round(off_sd, 2),
                        "velMean": round(vel_mean, 1),
                        "velSd": round(vel_sd, 1),
                        "count": len(source["off"]),
                    }
                )
            table[articulation] = positions
        ghost_probability = (
            ghost_hits[group] / ghost_slots[group] if ghost_slots[group] else 0.0
        )
        flam_probability = (
            flam_hits[group] / flam_opportunities[group]
            if flam_opportunities[group]
            else 0.0
        )
        styles[group] = {
            "positions": table,
            "ghostProb": round(ghost_probability, 4),
            "ghostVel": (
                [round(value, 1) for value in robust_stats(ghost_velocities[group])]
                if ghost_velocities[group]
                else None
            ),
            "flamProb": round(flam_probability, 4),
            "flamLeadMs": (
                [round(value, 1) for value in robust_stats(flam_leads[group])]
                if flam_leads[group]
                else None
            ),
        }

    info_sha = hashlib.sha256(info_path.read_bytes()).hexdigest()
    payload = {
        "schemaVersion": 1,
        "provenance": {
            "dataset": "Groove MIDI Dataset v1.0",
            "url": "https://magenta.tensorflow.org/datasets/groove",
            "license": "CC-BY 4.0 (Google LLC)",
            "attribution": (
                "Humanization profiles derived from the Groove MIDI Dataset "
                "(Gillick et al., 2019), Google Magenta, CC-BY 4.0; "
                "statistical aggregation only, no MIDI redistributed."
            ),
            "infoCsvSha256": info_sha,
            "filesUsed": files_used,
            "extractor": "scripts/extract-groove-profiles.py",
        },
        "styles": styles,
    }
    args.out.write_text(json.dumps(payload, indent=1, sort_keys=True) + "\n")
    total_cells = sum(
        1
        for style in styles.values()
        for positions in style["positions"].values()
        for cell in positions
        if cell is not None
    )
    print(
        f"Wrote {args.out} — {files_used} files, "
        f"{len(styles)} styles, {total_cells} filled cells"
    )


if __name__ == "__main__":
    main()
