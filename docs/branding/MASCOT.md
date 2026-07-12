# MercuryPitch — Mascot Plan ("Merc")

> Version 0.1 · Companion to [`BRAND.md`](./BRAND.md) (§5 Imagery, §6.6 Mascot prompt, §7 Legal).
> Proposal: one **hero mascot** for marketing, the landing page, and in-app moments — produced with
> AI generators for *look development* and shipped as *hand-authored vector animation*.

---

## 1. The core insight: two different assets, two different toolchains

"An animated mascot like Claude's" is really **two deliverables**:

| Deliverable | Constraints | Right tool |
| --- | --- | --- |
| **Runtime mascot** (in app + landing DOM) | Tiny (KB, not MB), loops forever, themeable (dark/light), reacts to app state, crisp at 24 px and 512 px | Hand-authored SVG + CSS/WAAPI, or Rive/Lottie |
| **Marketing footage** (pitch deck, hero video, socials) | Cinematic, HDR chrome, one-off renders, file size irrelevant | AI image → video generators |

AI generators (Higgsfield, Nano Banana, Veo/Kling) produce *pictures and footage* — they cannot
produce the runtime asset. Duolingo's Duo runs on Rive; Claude's characters are hand-built vector
animation. **So the answer to "Higgsfield or Nano Banana?" is: both, but only for design and
marketing surfaces — the shipped mascot is vector, which BRAND.md §7 requires anyway for
copyright/trademark cleanliness.**

## 2. What the repo already has

- **Nine "voice specialist" characters** in `public/characters/` (aria, blaze, echo, flux, glint,
  harmony, luna, nova, spark) — hand-authored ~1 KB SVGs, ~4 emotion states each
  (`idle/happy/focused/encouraging`), already on the spectrum palette.
- **Usage today** (static `<img>` only, no animation): character picker
  (`src/components/CharacterIcons.tsx`), jam chat avatar (`src/components/jam/JamChatWidget.tsx`),
  session metadata (`src/App.tsx`).
- **Brand direction already decided** in `BRAND.md`: mascots keep soft droplet/cloud silhouettes,
  unified onto the spectrum gradient (violet `#bc8cff` → teal `#2dd4bf`) with a chrome rim, on
  obsidian `#0d1117` (§5), with a MidJourney prompt + `--cref` continuity workflow (§6.6) and an
  AI-ideate → vector-rebuild → trademark playbook (§7).

**The gap:** there is no single *hero* character that fronts the brand, and nothing animates.

## 3. The character: Merc, the quicksilver droplet

Promote the brand's key visual — the quicksilver droplet with a pitch wave — into the mascot.
The nine specialists remain the supporting cast (coach picker); **Merc** becomes the face of
MercuryPitch: landing hero, onboarding/tour guide, empty states, loading, celebrations, pitch-deck
narrator. This fuses logo-world and character-world exactly as §5 intends.

Why a liquid droplet is the *right* mascot mechanically:

- Liquid = **squash & stretch for free** — the two properties that make simple mascots feel alive.
- MercuryPitch streams **real-time pitch + accuracy data**. Merc can *react to your singing*:
  float up/down with pitch, ripple on note onsets, beam on Perfect, wobble encouragingly when
  you're off (never shaming — brand voice, §1). A mascot with a job, not a sticker.

### Visual directions to explore (pick one in Phase 0)

| Direction | Idea | Fit |
| --- | --- | --- |
| **A. Luminous droplet** (brand-doc faithful) | Soft droplet, violet→teal gradient body, chrome rim light, serene face, floating notes | Exactly §5/§6.6; warm, safest |
| **B. Chrome quicksilver blob** | Full mirror-chrome liquid-metal droplet, big friendly eyes, glowing pitch sine-wave across the belly | Logo-world premium; riskier (chrome face = less warm) |
| **C. Singing performer** | Gradient-chrome hybrid droplet, mouth open, waveform ribbon spiraling out, tiny chrome headphones | Most product-storytelling; busiest silhouette |

### States (superset of the existing character conventions)

`idle` (breathing bob, blink, occasional note) · `listening` (mic on — leans in, ear ripple) ·
`celebrate` (Perfect/streak — jump, notes burst) · `encouraging` (off-pitch — soft wobble, nod) ·
`focused` (practice cycle running) · `sleep` (idle timeout, landing pre-scroll).

## 4. Production pipeline

### Phase 0 — Design lock with AI generators (1–2 days, ≈ free–$30)

Goal: a locked **character sheet** — 1 hero pose + turnaround (front/¾/side) + expression sheet
(the states above) + mouth-open singing. This sheet is the only thing later phases consume.

> **Pre-visualization:** [`mascot-explorations.html`](./mascot-explorations.html) sketches all three
> directions as animated hand-authored SVG (the Phase-1 shipping technique) — use it to judge
> silhouette, face language and 24/48 px legibility before spending generator credits.

- **Nano Banana / Nano Banana Pro** (Gemini image, via Google AI Studio or the Gemini API): the
  best *iterative character editor* — generate direction A/B/C, then conversational edits ("same
  character, ¾ view, mouth open") keep the character consistent across the sheet. Pennies per image.
- **Higgsfield**: hosts multiple image models (incl. Nano Banana Pro and Soul 2.0 with `soul_id`
  character personalization) — and it's already connected to Claude Code via MCP, so the whole
  explore → pick → sheet loop can be driven from a Claude session. Run it from an *interactive*
  session (claude.ai or CLI) — in headless remote sessions the connector's permission prompts
  can't be approved.
- **MidJourney**: §6.6 prompt + `--cref` also works if you prefer; keep the params log per §6.

Ready-to-adapt prompts (model-agnostic; append §6.6-style negative terms as needed):

```
A) friendly abstract mascot character, a soft rounded droplet of luminous liquid,
   smooth gradient body violet #bc8cff to teal #2dd4bf, subtle mirror-chrome rim light,
   simple serene face, small floating music notes, deep obsidian #0d1117 background,
   flat-3D hybrid, clean vector-friendly shapes, centered, full body, app mascot design

B) cute mascot character, a droplet of liquid mercury with mirror-chrome HDR surface,
   big friendly white oval eyes, cheerful smile, glowing pitch sine-wave rippling across
   its belly in blue #58a6ff teal #2dd4bf violet #bc8cff, playful squash-and-stretch
   bounce pose, tiny reflective droplets floating, obsidian #0d1117 background,
   premium 3D render, studio lighting, centered, full body

C) cute mascot character, a liquid-metal droplet singing joyfully, sound as a glowing
   ribbon waveform spiraling from its mouth in blue #58a6ff teal #2dd4bf violet #bc8cff,
   tiny chrome headphones, dark chrome body with violet-teal iridescence, obsidian
   #0d1117 background, flat-3D hybrid, warm encouraging expression, centered, full body
```

### Phase 1 — Vector rebuild + rig: the shipped mascot (2–4 days)

Rebuild the locked design as **original vector** (Illustrator/Figma/Inkscape), extending the
existing conventions: 100×100 viewBox, gradient `<defs>`, per-state files or a single rigged file.
Human-authored vector = copyrightable + tiny + crisp (§7), and it's what animation needs anyway.

Animation options, in order of recommendation:

1. **SVG + CSS/Web Animations in a Solid component** — zero new dependencies, themeable via CSS
   variables, ~2–4 KB. Idle bob/blink/notes are keyframes; pitch-reactivity is a `transform`
   driven by the existing pitch signals (accuracy bands Perfect/Excellent/Good/Okay already
   exist). Ship `<Mascot state={...} energy={...} />` and reuse it in the tour, empty states,
   jam chat, and celebration toasts. **Start here.**
2. **Rive** — a state machine (idle → listening → celebrate → encouraging) with numeric inputs
   fed from the pitch store; the "Duolingo-grade" option if we want richer secondary motion.
   Canvas runtime (~100 KB) is framework-agnostic and works fine with Solid. Adopt only if
   option 1 feels stiff.
3. **Higgsfield AutoSprite** (character image → background-removed sprite-sheet PNG, idle/custom
   presets, 2–64 frames) — fastest way to *prototype the feel* from a Phase-0 still; heavier and
   not themeable, so not the final in-app asset.

### Phase 2 — Marketing, landing hero, pitch deck (1–2 days + credits)

From the locked character sheet, image→video on Higgsfield:

- **Seedance 2.0** (reference-driven, consistent identity, start/end frames, up to 4K) or
  **Wan 2.7** (character-consistent, synced audio) for: a 5–8 s seamless **landing hero loop**
  (droplet suspended in obsidian, wave rippling through it), pitch-deck beats (Merc hears a note
  and lights up), and social teasers. `upscale_video` to 4K, `reframe` for 9:16 cuts,
  `remove_background` on stills for compositing.
- On the **landing page itself**, prefer the Phase-1 vector mascot inline (crisp, interactive,
  ~KB) and use one AI hero video only as a cinematic section background. OG/social stills come
  from BRAND.md §6.3/§6.4.
- Optional flourish later: Higgsfield `generate_3d` (image → GLB) for a WebGL droplet — the app
  already ships typegpu/WebGPU, but treat as a stretch goal.

## 5. Tool verdict

| Tool | Use for | Don't use for |
| --- | --- | --- |
| Nano Banana (Pro) | Character design iteration, consistency edits, sheets | Runtime assets, video |
| Higgsfield | Model variety (incl. Nano Banana Pro, Soul 2.0), sprite sheets, char-consistent video, upscale/bg-removal/reframe; MCP-scriptable from Claude Code | The shipped in-app mascot |
| Veo/Kling/Seedance/Wan (video gen) | Hero loops, pitch-deck clips, socials | Anything that ships in the bundle |
| SVG + CSS / Rive | The actual mascot users see every day | Cinematic marketing footage |

Budget: Phase 0 ≈ free–$30 (Nano Banana is pennies; Higgsfield plan credits). Phase 2 is where
credits go — polished video loops cost real credits including retries; budget accordingly and
generate at 720p/1080p first, upscale winners only.

## 6. Legal & acceptance

- Follow BRAND.md §7 verbatim: AI output = ideation/marketing surround; the mascot that ships is
  human-authored vector; reverse-image-search the locked design; keep prompt/seed logs; the mascot
  can be added to the trademark scope alongside the mark.
- Acceptance for Phase 1: mascot renders crisply at 24/48/512 px, respects dark/light themes,
  `prefers-reduced-motion` falls back to a static pose, adds ≤ 10 KB to the bundle (option 1),
  and reacts to live pitch within one animation frame.
- If the mascot becomes an interactive surface on a page with a guided tour, update that page's
  tour in the same PR (CLAUDE.md tour policy).

## 7. Suggested next steps

1. Pick a direction (A/B/C) — generate the exploration grid via Higgsfield/Nano Banana from an
   interactive Claude session, or run the prompts above in MidJourney/AI Studio.
2. Lock the sheet, rebuild in vector, ship `<Mascot />` with `idle` + `celebrate` wired to the
   accuracy bands.
3. Produce the landing hero loop + two pitch-deck clips from the locked sheet.
