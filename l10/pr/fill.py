#!/usr/bin/env python3
# Fill BODY.md's placeholders into BODY.final.md.
# usage: python3 -I fill.py <warnings> <e2e-count>
import pathlib
import sys

d = pathlib.Path(__file__).resolve().parent
warnings, e2e = sys.argv[1], sys.argv[2]

commits = "\n".join(
    line.strip() for line in (d / "commits.txt").read_text().splitlines() if line.strip()
)


def kb(n):
    return f"{n // 1024} KB"


def num(n):
    return f"{n:,}" if n else ""


# page: (js main, js here, js ceiling here, css main, css here, css ceiling)
rows = [
    ("01", 145458, 145853, 158720, 78980, 78980, 81920),
    ("02", 165613, 166159, 168960, 85493, 85493, 97280),
    ("03", 133668, 133921, 134144, 86482, 86482, 98304),
    ("04", 131823, 132375, 133120, 83335, 83335, 94208),
    ("05", 138241, 138489, 139264, 87191, 87191, 98304),
    ("06", 142329, 143020, 159744, 92420, 92420, 111616),
    ("07", 135712, 136046, 164864, 90072, 90072, 108544),
    ("08", 152335, 152586, 185344, 98560, 98560, 118784),
    ("09", 153922, 154283, 192512, 88410, 88410, 110592),
    ("10", 0, 172612, 216064, 0, 90214, 113664),
]
table = [
    "| Page | Script on `main` | Script here | Ceiling | Left | CSS on `main` | CSS here | Ceiling |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
]
for page, jm, jh, jc, cm, ch, cc in rows:
    ceiling = "129 KB, 130 here" if page == "04" else kb(jc)
    table.append(
        f"| /learn/{page} | {num(jm)} | {num(jh)} | {ceiling} | {jc - jh:,} | {num(cm)} | {num(ch)} | {kb(cc)} |"
    )

note = (
    "Measured in `build:e2e` on `main` `d37453987` and on this branch; Left is what this "
    "branch leaves under the script ceiling. Lessons 1 to 9 gain 248 to 691 bytes of "
    "script and no CSS: 216 are Lesson 10's season entry and drafts line, which every "
    "lesson page carries, and the rest is modules Lesson 10 shares with them only in "
    "part, regrouped into chunks of their own. That puts Lesson 4 279 bytes over its "
    "129 KB ceiling, so the shell (11) raises it to 130, with the reason in the budget "
    "file. Lesson 10's ceilings are a quarter over its measure (25)."
)

checks = f"""These ran on the same tree before its twelve `(lesson-10)` subjects were reworded and its five module-map commits were squashed into one (31): `71289c89f` on `main` `d37453987`. The tree is identical, and the 30 other patches are unchanged.

- `pnpm check`: no errors and the {warnings} warnings `main` has. It changed no files.
- Unit tests for the lessons and the lesson pages: 201 files, 2,418 tests, all pass.
- `pnpm test:scripts`, `pnpm pr:validate`, `docs:index:check` and `metrics:check`: pass.
- `plan-cites check`: 151 findings, all of them on `main` too, which has 157. The six this clears are in Lesson 10's FACTS and WEB-SPEC.
- `lesson:words` on Lesson 10: 2,331 words, 48 under the series' cap of 2,379, and every step's own text 92 to 120.
- `build:e2e`: in this checkout Vite stops when it copies the Glassworks model, a Git LFS pointer here, after it has written the site, so the six bundle asserts ran on that site by hand. All pass, the first-paint budgets among them, and the drafts assert finds Lessons 3 to 10 shown by default and pages 1 to 10 built. Every lesson page's first paint is the table above, to the byte.
- In the browser, on that build: Lesson 10's four specs, the next-lesson card's and the stage-fit spec, {e2e} tests with no retries: all pass.

Earlier, on code this head carries unchanged (every commit since touches only `docs/`), all 42 `learn-` specs ran on a `build:e2e`: 596 passed and 2 skipped, Lessons 1 and 2's own skips."""

headroom = (
    "Lessons 3, 4 and 5 have 223, 745 and 775 bytes of script left under their ceilings. "
    "0.9.24's kit fixes reach every lesson page, so whichever of the two merges second "
    "measures them again, and may need to raise one or split a chunk."
)

body = (d / "BODY.md").read_text()
for key, value in {
    "@@COMMITS@@": commits,
    "@@TABLE@@": "\n".join(table),
    "@@TABLENOTE@@": note,
    "@@CHECKS@@": checks,
    "@@HEADROOM@@": headroom,
}.items():
    assert body.count(key) == 1, key
    body = body.replace(key, value)
assert "@@" not in body
(d / "BODY.final.md").write_text(body)
print(f"wrote {d / 'BODY.final.md'}: {len(body)} chars")
