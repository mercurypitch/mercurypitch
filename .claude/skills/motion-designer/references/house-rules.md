# House rules: the MercuryPitch monorepo

These apply when the skill runs inside the MercuryPitch repository. Anywhere
else, find the equivalent of each section (brand source, product truth, real
product visuals, licensing, where work goes) and record it in `BRIEF.md` before
planning.

## Which product

|                   | MercuryPitch                                                                                                                     | Beside Cue                                                                                                                                           |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Brand source      | `docs/branding/BRAND.md`, `docs/branding/MASCOT.md`                                                                              | `apps/beside-cue/DESIGN.md`                                                                                                                          |
| Product truth     | `PRODUCT.md`                                                                                                                     | `apps/beside-cue/PRODUCT.md`                                                                                                                         |
| Direction         | "Liquid Precision": quicksilver, pitch made visible                                                                              | "The Pocket B-Side": one 7-inch record and its paper sleeve                                                                                          |
| Palette           | Obsidian stage `#0d1117`, text `#e6edf3`, Signal Blue `#58a6ff`, Aqua `#2dd4bf`, Violet `#bc8cff`, chrome `#f4f8fd` to `#1b2430` | paper `#fff5dd`, ink `#241913`, orange `#c93513`, turquoise `#00777d` (`#005b60` for text), custard `#f2c84b`, spruce `#165c4a`                      |
| Type              | Outfit 600-700 display, Inter for UI and numbers, Plus Jakarta Sans as the warmer alternative                                    | Coiny for the wordmark, Gabarito Variable for body, Saira Condensed for labels                                                                       |
| Font files        | Not vendored. Download from `google/fonts` (OFL) into the project, as `docs/branding/marketing/README.md` shows                  | `@fontsource` packages in `apps/beside-cue/node_modules` after `pnpm install`; copy the font files and their licence                                 |
| Marks             | `docs/branding/logo/meniscus2/` is the only canonical source: `mark.svg`, `lockup-horizontal.svg`, `mark-mono-{dark,light}.svg`  | `apps/beside-cue/public/icons/`; the Corky character belongs to the onboarding film                                                                  |
| Voice             | "Find your pitch." Short sentences, verbs over adjectives, an encouraging coach                                                  | Copy names a moment, never an identity or a diagnosis. Operational copy is literal; record metaphors belong to Corky dialogue and display lines only |
| Motion signatures | A liquid-metal droplet, spectrum rim light, the pitch contour as the persistent actor                                            | One authored plan transition, `cubic-bezier(0.16, 1, 0.3, 1)` over about 680 ms; supporting responses 160-220 ms                                     |

Measured contrast (WCAG): on Obsidian, text `#e6edf3` 16.0:1, Signal Blue 7.5:1,
Aqua 10.2:1, Violet 7.5:1, `--text-muted` `#6e7681` only 4.1:1, so never use it
for text in a video. On paper, ink 15.8:1, orange 4.8:1, turquoise 4.9:1,
turquoise-dark 7.3:1, custard 1.5:1, so custard is never text. The spectrum
gradient is decoration and never the only carrier of meaning.

## Facts file

Build `FACTS.md` before the storyboard: one line per fact, as
`claim | source (path and line or symbol) | how it was verified`.

Authority, highest first: the code; `PRODUCT.md` and
`apps/beside-cue/PRODUCT.md`; `CHANGELOG.md` for what shipped and when;
`docs/branding/BRAND.md` for taglines. Anything in `docs/plans/` is an
intention, not a fact: check `docs/agent/DOCS-AUDIT.md`, then the code.

Claims that were wrong once, from `docs/plans/ugc-noise-integration.md` § 8.
That plan predates the voice-history work in `PRODUCT.md`, so treat it as a
list of traps to re-verify, not as facts:

- "Hear yourself played back" was true of Glass only at the time; check the
  current voice-history capability in `PRODUCT.md` and the code before claiming
  it anywhere.
- The Voice Mirror asks for a glide up, a glide down, one held note, then five
  played notes sung back (`MATCH_NOTE_COUNT` in `src/lib/mirror/session.ts`),
  about two to three minutes, not "three things".
- `/mirror` needs no account and no download.
- Exercise scoring must not claim to assess pronunciation (`PRODUCT.md`).
- Beside Cue: no account, ads, analytics or cloud sync; plan content stays on
  the device; progress has no streaks and no failure states.

## Product visuals

- Real product UI comes from the product. `pnpm marketing:capture -- --recipe
<karaoke-zen|jam-karaoke|piano-practice|singing-practice|voice-mirror>`
  writes deterministic screenshots and a manifest to
  `output/marketing-captures/`. It is localhost-only by hard assertion and uses
  synthetic demo state. Read the header of `scripts/capture-marketing.mjs`
  first. Serve a local-mode build: `pnpm run build:tours` builds with an empty
  API URL and mock jam signalling, and `tour-check` shows how to serve `dist`.
- Never capture production, a real account, or personal data, and never point
  anything at `api.mercurypitch.com`.
- The pitch canvas and piano roll are brand assets (`BRAND.md` § 5): prefer
  real product shots plus one abstract mercury hero.
- UI rebuilt in HTML for a scene must match the shipped UI. In its component
  round, give the critic a captured still to compare against.
- Mascots: the nine voice specialists in `public/characters/`, and the Merc
  plan in `MASCOT.md`.

## Generated imagery

- Generate text-free plates and composite the type in code
  (`docs/branding/marketing/README.md`: generators drop the full stop from a
  headline and append one to a URL).
- Label every generated shot as a concept. Scale to width and centre-crop to the
  exact canvas; generators emit about 9:16.1, which letterboxes on a phone.
- `BRAND.md` § 6 is a MidJourney prompt pack for mood; it is not a source of
  final assets for a logo.
- The repository has used Higgsfield for plates and Google Flow for the Beside
  Cue character clips; any generator is acceptable. Whichever it is, write the
  prompt with `shot-grammar.md` § 3 and record it in the generation ledger.

## Music and sound

- MercuryPitch rule (`docs/plans/ugc-noise-integration.md` § 8): no recorded
  music unless it is cleared for commercial use, and creator (UGC) briefs carry
  no music at all. The kit's Mixkit tip is only as good as the licence on the
  day you download; save the licence text or receipt next to every track and
  effect and list them in `DELIVERY.md`.
- Beside Cue onboarding pictures are silent. Dialogue is a separately registered
  cue (`apps/beside-cue/media-source/onboarding/*/SOURCE-MANIFEST.md`); never mux
  audio into an in-app onboarding video.

## Where work goes

- Video projects live in `output/motion/<slug>/`, which is gitignored. Never
  commit renders or HyperFrames projects to this repository.
- Durable sources (brief, facts, storyboard, compositions, ledgers): ask the
  owner where they go. Private originals in this repo's convention live under
  `<user-dotfiles>/mercurypitch/`.
- Media that ships inside an app follows the existing contract: a builder script
  in `scripts/` (for example `scripts/prepare-beside-cue-j2-greeting.mjs`), a
  `SOURCE-MANIFEST.md` and `BUILD-CONTRACT.json` under
  `apps/beside-cue/media-source/onboarding/<version>/`, pinned hashes, and the
  encoding those manifests record. Never overwrite shipped media; add a version.

## Repository guardrails that apply to video work

- No emojis anywhere: on-screen text, captions, file names, reports.
- No Claude or AI-assistant attribution in deliverables or file metadata.
- Never test against production.
- Do not commit or push unless the user asks.

## In-app animation

A button press, a modal or a page transition is ordinary SolidJS and CSS work
(`docs/agent/CONVENTIONS.md`), not this pipeline. Principles 3, 4, 6 and 7 still
apply: layered, overlapping motion; eased, never linear; every action shows a
result; type moves with purpose. Always ship the reduced-motion variant, which
keeps every state and message without rotation, travel or parallax. Verify at a
phone viewport with the `mobile-ui-check` skill. A watched sequence, such as an
onboarding film or a mascot animation, does use this pipeline, and its render
then goes through the in-app builder contract above.
