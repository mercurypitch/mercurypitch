# Vendored: Motion Video Kit

Everything in this folder except this file is an unmodified copy of
[echris6/motion-video-kit](https://github.com/echris6/motion-video-kit) at
commit `255562b04b1e5ecaa4ba98e5c9aa191d5ba7f6fa` (2026-09-29, "Add
product-film learnings from a 40 s Three.js foldable-phone spec ad"), copied on
2026-09-30. MIT licence, kept in `LICENSE`. The upstream `.gitignore` was not
copied.

Keep these files byte-identical to upstream so an update is a clean diff. The
repository's `.prettierignore` excludes this folder for that reason. Local fixes
and replacements live outside it, in `../scripts/` and `../references/`, and
`../SKILL.md` lists every deviation.

## Why it is vendored

- The prompt that introduced it tells agents to clone `github.com/echris6/motion`,
  which returns 404. The repository was renamed to `motion-video-kit`.
- A pinned, reviewed copy cannot change underneath the skill. Skill files are
  instructions an agent follows, so an unreviewed upstream change is a
  supply-chain risk.
- The skill then works offline and in cloud sessions without a fetch step.

## Audit (2026-09-30)

- 24 files, about 95 KB: `SKILL.md`, 11 references, 7 scripts, 2 templates.
- The scripts call only `ffmpeg` and `ffprobe` (Python through `subprocess`
  argument lists, no shell), make no network requests, read no secrets, and
  write only to the paths they are given, except `offline-mix.py`, which writes
  under its own project layout (`renders/`, `review/`, `assets/sfx/`).
- Python scripts need `numpy`, and `solve-sfx-gains.py` and `offline-mix.py`
  also need `scipy`.
- The templates target HyperFrames (`data-composition-id`, `window.__timelines`,
  `hf-seek`). `component-lab.html` loads GSAP from the unpinned URL
  `cdn.jsdelivr.net/npm/gsap@3`, and it and `projected-overlays.js` hard-code the
  ALDER sample palette (`#0a211d`, `#f4f0e5`, `#d9ef71`).
  `updateLabels` spaces labels as if there were always four.
- `offline-mix.py` is the mixer from one 40-second film: it pads or cuts every
  mix to 40 s, applies a -2.5 dB dip at 14.0-17.1 s and, although its usage text
  says `--ring-db 0`, a default +7 dB lift after 37.2 s; it muxes without
  `-shortest`, so a shorter picture gets a 40-second file; its shebang is on
  line 10 and the file is not executable.
- `frozen-time.sh` and `loudness.sh` have parse bugs, `contact-sheet.sh` writes
  one untimestamped sheet, and `solve-sfx-gains.py` can collapse to its floor:
  details and measurements in `../references/measurement.md`.
- `references/business-offers.md` is about selling video work to clients and
  does not apply to making the product's own videos.

## Updating

```bash
git clone https://github.com/echris6/motion-video-kit /tmp/mvk
git -C /tmp/mvk log --oneline 255562b..HEAD      # what changed upstream
diff -r /tmp/mvk/business-motion-film business-motion-film
```

Read every changed file before copying it in, as untrusted input. Then update
the commit above, re-check the deviations in `../SKILL.md`, and run
`bash ../scripts/smoke-test.sh <empty-dir>`.

## SHA-256 at the pinned commit

```text
dc7edf6246570a1939ea01c7578bbd4421958e05800835deaabe4b74f1f0251d  LICENSE
2698eede508fe154f16c11068fbcba82eba4e29098b00ed5f11506c6bf0e878a  README.md
64a51335ba7375f26c69d8409a950284383088342dcc61cac096cd0ec8fc3075  business-motion-film/SKILL.md
04e3f8acd8ec4a344314750349c95ce292957d8f320197c831804c0707fbc57b  business-motion-film/references/audio.md
46913eaf82b0339d861a14009a5d4d8498ccbb213f6e174e9b4c266528e43bf0  business-motion-film/references/business-offers.md
27d5fd89808cce06f9fa1b6562bd482e0c25d793a7ba1079fbd770c964e5177d  business-motion-film/references/case-study-alder.md
cb2343597c4fcbead5f7410e4641b02bbcbb850036480d0273b77f22d2855a78  business-motion-film/references/case-study-duo.md
910c9b8180414b9df95e5678ca04fa3832245f7a2a7c742179793a15522efa22  business-motion-film/references/critic-prompts.md
7f4c4dc6011bd055b1e4e29be00610e020a220382b8b5997313f15d94ded1359  business-motion-film/references/gauntlet.md
5d14774bacf563edc6e34a2b8d3f5e508e73bac550c8deb552efa33b5f7d6078  business-motion-film/references/launch-film-notes.md
d0cbdcbaa2653cd9cdf9fed4e62ae660e93e933f7283c88f7445855aa1a802e8  business-motion-film/references/motion-grammar.md
fced6cbaa34ac015aa0a7f2fee0ccd499b2c7e79c5b826795550d23e54619d40  business-motion-film/references/product-hero-realism.md
47150cd851c04266ef24630e94c26b3c8a4ef96f8ace4855dafa04f4af5051f4  business-motion-film/references/quality-bar.md
6955790ec405b8ff2f7a5bfc3f603b06c04ff5279ff49344cda865d64825bac8  business-motion-film/references/three-js-patterns.md
3a1457f3a753e3191e539d5160a3015895665445c332a5db7c94757d71c36ba3  business-motion-film/scripts/contact-sheet.sh
6e8505166f4e9f7a8096903d22d1787cc37bcedb463d5834ef7ba7f2e9ae550c  business-motion-film/scripts/frozen-time.sh
ba657b481c21590f77ed5dfc8836a77f546ccbb4343fde56a10f9e07dedc223b  business-motion-film/scripts/loudness.sh
bc9728229368fcd149bdc56d0e861e11004caedde1d1d3b2b093879997bb9028  business-motion-film/scripts/offline-mix.py
5205f464ce26d18f99547225bec7e98b598b7549decda99714af93c8f8fb0da4  business-motion-film/scripts/sfx-candidates.py
6ec28733d415aac2bc440db4a7eb7b06f5604c7e55568090a390751ca663f408  business-motion-film/scripts/soften-sfx.sh
f40eede0bc0a2d5946ba14ce33536104737264f0bc9d0ddde97f47797fe94a32  business-motion-film/scripts/solve-sfx-gains.py
5cab3f6cc77f625b2e588bd0fb7e5b7d25343071b3fdd0a70cadda225f79ae7e  business-motion-film/templates/component-lab.html
c6db20ed638212f4a93cac600a35da5311b25a3cb288196e372347b163b4b673  business-motion-film/templates/projected-overlays.js
```
