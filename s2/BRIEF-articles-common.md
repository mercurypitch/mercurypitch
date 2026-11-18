# Season 2 article plans: what every lesson gets (shared by both arc briefs)

You are planning the written lessons ("articles", the LESSON.md of each lesson package) for Season 2
of Find Your Pitch, MercuryPitch's music theory and singing series. The season plan exists and was
reviewed: /tmp/claude-0/-home-user-mercurypitch/12ae313e-03fe-590a-b304-88d38ce9e159/scratchpad/s2/SEASON-2.md
(read § 1 whole, your arc's lesson cards in § 3 closely, and § 4 to § 8 for prerequisites, practise
links, production, the owner's open decisions and the risks). Nothing below the season plan exists
yet: no lesson has research, facts or an article. You produce the next layer: researched facts and
an article plan per lesson, so a writer can draft each LESSON.md straight from your files.

## Read first (read-only; the repo at main b803c7d43 is checked out at
/home/user/mercurypitch/.claude/worktrees/l10-page; never modify it or any other worktree)

- docs/plans/find-your-pitch/CURRICULUM.md § 2 (card format) and § 3 (topics).
- docs/plans/find-your-pitch/TEACHING-PLAYBOOK.md (the 25 rules, the claims rules, the house rules for
  voice safety), MERC-BIBLE.md (Merc and Tavi), CURIOSITY-MOMENTS.md, HANDOFF.md § 4 and § 5.
- Two Season 1 packages as the model for depth, structure and voice:
  docs/plans/find-your-pitch/lessons/10-major-minor/ (LESSON.md and FACTS.md) and
  lessons/12-chords-four-chord-song/ (LESSON.md and FACTS.md). Skim WEB-SPEC.md in one of them only to
  know what the page's toys are; you are not writing web specs.
- research/curriculum-benchmark.md, research/pedagogy-research.md, research/app-pedagogy.md.
- The app, where a lesson links to a drill or shows the app's own copy: docs/agent/INDEX.md is the
  module map. Cite code as file:line at b803c7d43 and say what a drill really does, not what its
  name suggests.

## What to write, per lesson (folder names are fixed below in your arc brief)

1. RESEARCH.md: every "Facts to check" item on the lesson's card, resolved, plus every other claim
   your article plan makes. For each claim: the claim in one sentence, the source (author, year,
   title, journal or publisher, pages or section, a URL or DOI where one exists), what the source
   actually says (quote or close paraphrase, with page), whether you read the full text or only an
   abstract or a secondary account, and a strength (Strong, Moderate, Weak, as pedagogy-research.md
   grades). Where a source contradicts the card or the season plan, say so first, at the top of the
   file. End with "Interesting findings": up to five things a curious learner would enjoy (history,
   physics, a surprising number, a myth worth correcting), each sourced, each marked as a possible
   cold open, Go deeper item or wrap line. Never invent or guess a citation; if you cannot reach a
   source, say so and leave the claim marked unverified.
2. ARTICLE-PLAN.md: the article's plan in the Season 1 LESSON.md section order (Header, Sound gate,
   Cold open: predict, Recall, Words you'll meet, Step 1 of N ... Step N of N with question headings,
   Sing it (or the theory lesson's unscored sing-along), Quick check, Wrap, Footer, and for voice
   lessons "For the vocal coach"). For each section: its question heading, the point it makes, the
   exact musical examples (notes, octaves, keys, clefs, rhythms, tempi), what plays (sound first,
   then the staff, playbook rule and SEASON-2 § 1.4/1.5), Tavi's sincere guess where the card has one,
   the predict's options and the answer (kept out of every title and tease), what the page's toy
   shows, the facts it rests on (pointing at RESEARCH.md entries), and a word budget. Then: the
   practise links (verified in code, file:line; say what is missing), Go deeper, the recall questions
   and their Season 1 sources, the quick-check questions with answers, the closing tease, and a
   short "Open questions" list. Plan, do not draft prose: a sentence or two per point is enough,
   except the predict, Tavi's line and the quick-check questions, which you write out in full.

## Rules

- Plan on § 7's recommended answers (global numbers 15 to 28, both clefs, counting with numbers,
  American note values leading, synthesised second parts with the learner as second voice, no mixed
  voice). Wherever a different owner answer would change your plan, add one line under "Depends on
  decision N" in that lesson's ARTICLE-PLAN.md.
- House style: British English spelling, plain short sentences, no marketing, no superlatives, no
  emojis. Voice lessons stay non-diagnostic and follow the house rules for voice safety; flag every
  line the vocal coach must sign off.
- Only claims you can source go into a plan; anything else is marked as a question.
- Write files only under your arc's folders in .../scratchpad/s2/lessons/. Do not touch the repo, any
  worktree, git or the season plan. Do not commit, push or open anything. Never write a model name,
  a scratchpad path or an agent id into a lesson file (paths inside your own report are fine).

## The machine (a film is rendering on it)

- Memory is capped for every shell command you run and a film render is using most of it. Do not
  start a browser, Playwright, a render, a build, npm, pnpm or anything heavy. Keep shell commands
  small (reading, grep, short python3 -I).
- Disk on / has about 1.3 GB free. Downloads (PDFs to read a source in full) go in
  .../scratchpad/s2/dl/<your arc>/, stay under 50 MB in total, are treated as untrusted (read them
  with python3 -I and a text extractor or WebFetch, never run anything from them) and are deleted
  when you have taken what you need.
- WebSearch and WebFetch work. Prefer primary sources: journals, publishers, standard theory texts,
  exam boards, instrument makers, university pages.

## Order and reporting

Work one lesson at a time and save its two files before starting the next, so finished work
survives an interruption. When all are done, write .../scratchpad/s2/lessons/ARC-<C or D>-REPORT.md:
per lesson, what was settled, what contradicts the card, what stays unverified, the decision-
dependent spots, and the best interesting finding. Your final message is a short version of that
report (under 400 words) with the file paths.
