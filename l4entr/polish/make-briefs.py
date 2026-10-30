#!/usr/bin/env python3
"""Write one polish brief per scene group: BRIEF-common.md with the group's fields filled in and
its items (items-<G>.md, written by the director after the film critic's round) appended.
Usage: make-briefs.py [group ...]   (default: every group that has an items file)"""
import os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
GROUPS = {
    "A": ("s01-cold-open", "s02-title", "s03-promise", "s04-recall"),
    "B": ("s05-steps", "s06-groups"),
    "C": ("s07-predict", "s08-anywhere"),
    "D": ("s09-names", "s10-ti", "s11-why"),
    "E": ("s12-sing", "s13-your-turn"),
    "F": ("s14-recap", "s15-next", "s16-end"),
}
REPORTS = {"A": "A-04", "B": "B-05", "C": "C-03", "D": "D-04", "E": "E-03", "F": "F-04"}


def listing(words):
    return words[0] if len(words) == 1 else ", ".join(words[:-1]) + " and " + words[-1]


common = open(os.path.join(HERE, "BRIEF-common.md")).read()
wanted = sys.argv[1:] or [g for g in GROUPS if os.path.exists(os.path.join(HERE, f"items-{g}.md"))]
for g in wanted:
    scenes = GROUPS[g]
    fields = {
        "{G}": g,
        "{SCENES}": listing(scenes),
        "{NOTES}": f"lab/{scenes[0]}/BUILD-NOTES.md",
        "{COMPREPORT}": f"review/component-{REPORTS[g]}/REPORT.md",
        "{FILES}": "compositions/" + listing([f"{s}.html" for s in scenes]),
        "{LABS}": listing([f"lab/{s}/" for s in scenes]),
    }
    text = common
    for k, v in fields.items():
        text = text.replace(k, v)
    assert "{" not in text.split("Items:")[0].replace("{self}", ""), f"unfilled field in {g}"
    items = open(os.path.join(HERE, f"items-{g}.md")).read().strip()
    out = os.path.join(HERE, f"BRIEF-{g}.md")
    open(out, "w").write(text.rstrip() + "\n\n" + items + "\n")
    print(out, len(text.split()) + len(items.split()), "words")
