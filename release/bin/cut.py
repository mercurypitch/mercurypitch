#!/usr/bin/env python3
"""Apply the 0.9.22 release edits to a checkout of main.

Usage: python3 -I cut.py <repo-worktree> <YYYY-MM-DD>

Inserts the two drafted entries above 0.9.21, bumps package.json, adds
datePublished to Lessons 1 and 2 (and corrects their head comment), and dates
the hub and both lessons in the sitemap. Each edit must match exactly once.
"""
import pathlib, re, sys

root = pathlib.Path(sys.argv[1])
day = sys.argv[2]
assert re.fullmatch(r"2026-1[0-2]-\d{2}", day), day
notes = pathlib.Path(__file__).resolve().parent.parent / "notes"

def edit(rel, pairs):
    p = root / rel
    t = p.read_text()
    for old, new in pairs:
        n = t.count(old)
        assert n == 1, f"{rel}: {n} matches for {old[:50]!r}"
        t = t.replace(old, new)
    p.write_text(t)
    print("edited", rel)

for rel, draft in (("CHANGELOG.md", "CHANGELOG-entry.md"),
                   ("dev-changelog.md", "dev-changelog-entry.md")):
    entry = (notes / draft).read_text().replace("2026-10-DD", day).rstrip("\n")
    assert "-DD" not in entry, draft
    edit(rel, [("## [0.9.21] - 2026-10-18", entry + "\n\n## [0.9.21] - 2026-10-18")])

edit("package.json", [('"version": "0.9.21"', '"version": "0.9.22"')])

OLD_NOTE = """No
         datePublished until the release that puts the lesson on
         mercurypitch.com; no VideoObject until the episode plays here
         (docs/plans/find-your-pitch/SEARCH.md). -->"""
NEW_NOTE = """datePublished
         is the day the lesson went live on mercurypitch.com. No VideoObject:
         it belongs on the watch page (docs/plans/find-your-pitch/SEARCH.md).
         -->"""
for n in ("01", "02"):
    pos = int(n)
    edit(f"learn/{n}.html", [
        (OLD_NOTE, NEW_NOTE),
        (f'"isAccessibleForFree": true,\n        "position": {pos},',
         f'"isAccessibleForFree": true,\n        "datePublished": "{day}",\n        "position": {pos},'),
    ])

edit("public/sitemap.xml", [
    (f"<loc>https://mercurypitch.com/learn/{path}</loc>\n    <lastmod>2026-10-20</lastmod>",
     f"<loc>https://mercurypitch.com/learn/{path}</loc>\n    <lastmod>{day}</lastmod>")
    for path in ("", "01", "02")
])
print("done:", day)
