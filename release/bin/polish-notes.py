#!/usr/bin/env python3
"""Fold the two 0.9.22 polish PRs (#1216 and the onboarding one) into the drafts.

Usage: python3 -I polish-notes.py <onboarding PR number> <its commit count>
Each edit must match exactly once; run it on the pre-polish copies.
"""
import pathlib, sys

P, PN = sys.argv[1], int(sys.argv[2])
notes = pathlib.Path(__file__).resolve().parent.parent / "notes"

def edit(name, pairs):
    p = notes / name
    t = p.read_text()
    for old, new in pairs:
        n = t.count(old)
        assert n == 1, f"{name}: {n} matches for {old[:60]!r}"
        t = t.replace(old, new)
    p.write_text(t)
    print("edited", name)

# ---------- CHANGELOG ----------
edit("CHANGELOG-entry.md", [
    ("""  open: _What is a note?_ and _Twelve notes_, 8 and 13 minutes. Home's
  Lessons link opens the first, and mercurypitch.com/learn maps the season.""",
     """  open: _What is a note?_ and _Twelve notes_, 8 and 13 minutes. Home's
  Lessons link opens the lesson you're on, and mercurypitch.com/learn maps
  the season."""),
    ("""  every lesson in the season and every step of this one, and shows where
  you are.
""",
     """  every lesson in the season and every step of this one, and shows where
  you are.
- **Lesson pages link each other.** A trail at the top leads back to the
  season map, and the foot of each page links the lessons either side.
"""),
    ("""  answers pick up to three stops: Start here, Learn and Play.""",
     """  answers pick up to three stops: Start here, Learn and Play. See every
  room shows them all, the lessons too."""),
])

# ---------- paragraph helpers (join a wrapped paragraph, edit, re-wrap at 78) ----------
import re, textwrap
HEAD = sys.argv[3]
COMMITS, PRS, FIRST_PARENT = 637 + 6 + PN, 112, 549 + 6 + PN

def wrap(text, first, rest):
    text = re.sub(r'`[^`]*`', lambda m: m.group(0).replace(' ', ' '), text)
    return textwrap.fill(text, width=78, initial_indent=first, subsequent_indent=rest,
                         break_long_words=False, break_on_hyphens=False).replace(' ', ' ')

def edit_para(name, start, pairs, wrapped=True):
    """The paragraph whose first line starts with `start` (after its indent)."""
    p = notes / name
    lines = p.read_text().split('\n')
    idx = [i for i, l in enumerate(lines) if l.lstrip().startswith(start)]
    assert len(idx) == 1, f"{name}: {len(idx)} paragraphs start {start!r}"
    i = idx[0]
    j = i + 1
    while j < len(lines) and lines[j].strip() and not re.match(r'^\s*(- |\d+\. |#+ |\|)', lines[j]):
        j += 1
    first_line = lines[i]
    m = re.match(r'^(\s*)(- |\d+\. )?', first_line)
    lead = m.group(1) + (m.group(2) or '')
    text = ' '.join(l.strip() for l in lines[i:j])
    if lead.strip():
        text = text[len(lead.strip()):].lstrip()
    for old, new in pairs:
        n = text.count(old)
        assert n == 1, f"{name} [{start}]: {n} matches for {old[:60]!r}"
        text = text.replace(old, new)
    out = wrap(text, lead, ' ' * len(lead)) if wrapped else lead + text
    lines[i:j] = out.split('\n')
    p.write_text('\n'.join(lines))
    print("edited", name, "paragraph", start[:30])

def insert_before(name, anchor, block):
    p = notes / name
    t = p.read_text()
    assert t.count(anchor) == 1, f"{name}: anchor {anchor[:40]!r}"
    p.write_text(t.replace(anchor, block + anchor))
    print("inserted into", name, "before", anchor[:30].strip())

# ---------- dev-changelog ----------
D = "dev-changelog-entry.md"
edit_para(D, "637 commits since", [
    ("637 commits", f"{COMMITS} commits"),
    ("from 110 PRs", f"from {PRS} PRs"),
    ("on 549 first-parent entries, up to cddefd571.", f"on {FIRST_PARENT} first-parent entries, up to {HEAD}."),
    ("75 were rebased onto `main`:", "77 were rebased onto `main`:"),
    ("#1187 (7),", f"#1187 and #{P} (7 each),"),
    ("#1148, #1161, #1167, #1189 and #1200 (6 each)", "#1148, #1161, #1167, #1189, #1200 and #1216 (6 each)"),
])
edit_para(D, "- **Find Your Pitch on mercurypitch.com.**", [
    ("the release review's accessibility fixes (#1177) and anonymous first answers from its quick check (#1193).",
     "the release review's accessibility fixes (#1177), anonymous first answers from its quick check (#1193), and a trail back to the hub with links to the lessons either side (#1216)."),
])
edit_para(D, "- **Onboarding and the plan.**", [
    ("the tour, first-value and Map counts (#1134) and the router race (#1196).",
     f"the tour, first-value and Map counts (#1134), the router race (#1196), and the plan's polish (#{P}): Start here as the main button, an unclean range read no longer taken for a narrow one, Home's Lessons link and a Lessons door on the Map to the visitor's lesson, and a tablet's width."),
])
edit_para(D, "- **Search.** The studio's markup", [
    ("the 404 scene (#1118) and search-led lesson titles (#1187).",
     "the 404 scene (#1118), search-led lesson titles (#1187), and the lesson pages' and room pages' links to the lessons in their served HTML (#1216)."),
])
edit_para(D, "- **Home's Lessons link still opens `/learn/01`**", [
    ("**Home's Lessons link still opens `/learn/01`** (`src/pages/HomePage.tsx:191`), not the hub; #1177 lists it as W-01's open half.",
     f"**Home's Lessons link opened `/learn/01` for everyone** (#1177's W-01, its open half). #{P} makes it the visitor's current lesson, and the hub once both released lessons are done."),
])
insert_before(D, "\n### Web: publishing lessons at run time", """- **#1216, lesson pages link the hub and the lessons either side** (6
  commits). A trail under the masthead, `MercuryPitch > Find Your Pitch > the
  lesson`, in a `nav` named "Breadcrumb", written at build time from each
  page's own BreadcrumbList by `tools/lesson-ways.ts`. Each page's foot links
  the lessons before and after (`rel="prev"`, `rel="next"`), and a draft's
  link is taken out per request by the site worker and the page's own reading,
  as every other link to a lesson that is not live. The room documents link
  the released lessons that practise in them (`lessonsPractised` in
  `src/seo/entry-pages.ts`, SEARCH.md § 8): `/mirror` and `/vocal-range-test`
  Lesson 1, `/ear-lab` Lesson 2. The tour's "?" ends the masthead's row at
  every width instead of hanging over the page under 1181 px; the logo gives
  way to it under 561 px and from 821 to 1020 px, the wordmark from 1021 to
  1180 px, and the trail links MercuryPitch at every width.
""")
insert_before(D, "\n### Web: karaoke, the studio and UVR", f"""- **#{P}, the plan's polish** ({PN} commits). A range read that is not clean
  (a steady tone reads 0 semitones) counts as not measured: one rule,
  `isCleanRange` beside `singerForRange`, read by `pickFirstStop`, Keep, the
  twin's stat card, the voiceprint share and the twin, so the plan no longer
  sends it to the range stop. The main button is Start here and opens the
  first stop as its card does; Show me around stays beside it, with the
  room's page tour where it has one.
  With a voiceprint, Start here keeps "Every take lands in Progress" where the
  stop's runs land there (Exercises, the Ascent; not Karaoke Night). Home's
  Lessons link opens the first released lesson this browser has not marked
  done, or the hub (`src/lib/current-lesson.ts`; the done list's key and parse
  move to `src/lib/lesson-done.ts`). The Map gains a Lessons door
  (`onboarding_map_door_lessons`) and a section naming the current lesson,
  both web only. A lesson's cover shows whole on the plan's cards, and the
  plan's column is 640 px from 600 px wide.
""")

# ---------- PR body (one line per paragraph, not wrapped) ----------
B = "PR-BODY.md"
edit(B, [
    ("#1135 covered the first 40 PRs; this covers all 110.", f"#1135 covered the first 40 PRs; this covers all {PRS}."),
    ("637 commits since `v0.9.21` (bd524160a), from 110 PRs, on 549 first-parent entries, up to cddefd571. 23 PRs came in as merge commits, 75 were rebased and 12 squashed.",
     f"{COMMITS} commits since `v0.9.21` (bd524160a), from {PRS} PRs, on {FIRST_PARENT} first-parent entries, up to {HEAD}. 23 PRs came in as merge commits, 77 were rebased and 12 squashed."),
    ("search-led titles (#1187) and Merc's shader compile off the page's path (#1200).",
     "search-led titles (#1187), Merc's shader compile off the page's path (#1200), and a trail back to the hub with links to the lessons either side (#1216)."),
    ("the tour and first-value counts (#1134), and the `#/map` router race (#1196).",
     f"the tour and first-value counts (#1134), the `#/map` router race (#1196), and the plan's polish (#{P}): Start here as the main button, an unclean range read no longer taken for a narrow one, Home's Lessons link and a Lessons door on the Map to the visitor's lesson, and a tablet's width."),
    ("- **Search:** #1105, #1106, #1107, #1109, #1122, #1116 and the 404 scene (#1118).",
     "- **Search:** #1105, #1106, #1107, #1109, #1122, #1116, the 404 scene (#1118), and the lesson pages' and room pages' links to the lessons in their served HTML (#1216)."),
    ("3. **The privacy notice** on about.mercurypitch.com covers #1190's and #1193's data (the owner says it does).",
     f"3. **The privacy notice** on about.mercurypitch.com covers #1190's and #1193's data (the owner says it does), and the owner checks #{P}'s one new funnel name, `onboarding_map_door_lessons`, sent like the other Map doors'."),
    ("- **Home's Lessons link opens `/learn/01`**, not the hub.",
     f"- **Home's Lessons link opened `/learn/01` for everyone** (#1177's W-01): #{P} makes it the visitor's current lesson."),
    ("6. **Anything merged after cddefd571** gets its bullet and its paragraph first.",
     f"6. **Anything merged after {HEAD}** gets its bullet and its paragraph first."),
])

# ---------- REACH ----------
R = "REACH.md"
edit(R, [
    ("The 110 PRs merged between `v0.9.21` (bd524160a) and `origin/main` at cddefd571, in merge order.",
     f"The {PRS} PRs merged between `v0.9.21` (bd524160a) and `origin/main` at {HEAD}, in merge order."),
    ("Counts total 614 PR commits plus 23 merge commits, 637 in all, on 549 first-parent entries.",
     f"Counts total {614 + 6 + PN} PR commits plus 23 merge commits, {COMMITS} in all, on {FIRST_PARENT} first-parent entries."),
    ("Reach was read from the code at cddefd571, not from a build.",
     f"Reach was read from the code at cddefd571, and #1216's and #{P}'s at their own heads, not from a build."),
])
p = notes / R
t = p.read_text().rstrip('\n') + '\n'
TITLE_P = sys.argv[4]
t += ("| #1216 | feat(lessons): lesson pages link the hub and the lessons either side, rooms link their lessons | rebased, 6 commits | web | "
      "`tools/lesson-ways.ts` (the trail and the foot's links, from each page's BreadcrumbList), `src/seo/render-entry-page.ts` (`lessonsPractised`), "
      "`kit/lesson-menu.css` (the \"?\" in the masthead's row) | Lesson pages link each other |\n")
t += (f"| #{P} | {TITLE_P} | rebased, {PN} commits | web | `src/lib/mirror/singer-match.ts` (`isCleanRange`), `src/features/plan/PlanScreen.tsx`, "
      "`build-plan.ts`, `src/lib/current-lesson.ts`, `src/pages/HomePage.tsx`, `src/features/onboarding/beats/BeatMap.tsx` | "
      "Find Your Pitch (Home's Lessons link); Four questions, then a plan (See every room); the rest folded, as the plan is new in this release |\n")
p.write_text(t)
print("appended two rows to", R)
print(f"counts: {COMMITS} commits, {PRS} PRs, {FIRST_PARENT} first-parent entries, head {HEAD}")
