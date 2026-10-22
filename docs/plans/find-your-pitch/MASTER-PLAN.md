# Find Your Pitch: master plan

A music theory and singing tutorial series by MercuryPitch, in two forms per lesson: a web lesson
(short text, many motion visuals, interactive toys, a lesson explorer) and a YouTube explainer
built entirely in code, hosted by blue Merc and orange Merc.

Status, 19 Oct 2026: Phase 0 is done when Lesson 1's delivery master and LEDGER exist. Both do
now, and one human check remains: the master, `rc-07` (5:14, 314.2 s on its cue sheet), speaks
with the owner's ElevenLabs voices and passed the last of nine critic rounds, and a person listens
to the new voices before it is published. Written: the research, curriculum, playbook, host bible
and production pipeline, and Lesson 1's documents (script, storyboard and the rest, see § 11).
Built: the Lesson 1 and Lesson 2 films, and the web lessons with the explorer at `/learn/01` and
`/learn/02`; `/learn/03` is built as a draft that waits on the vocal coach (§ 11). Phase 1 starts with the owner decisions in § 12.

| Document                                                 | What it holds                                                        |
| -------------------------------------------------------- | -------------------------------------------------------------------- |
| This file                                                | Vision, decisions, formats, pipeline, phases, measurement, risks     |
| [CURRICULUM.md](CURRICULUM.md)                           | Season 1 lesson cards, the topic graph, Seasons 2 and 3              |
| [TEACHING-PLAYBOOK.md](TEACHING-PLAYBOOK.md)             | The 25 teaching rules with their evidence; claims and safety rules   |
| [MERC-BIBLE.md](MERC-BIBLE.md)                           | The hosts: roles, looks, voices, behaviour, production, backlog      |
| [PRODUCTION-PIPELINE.md](PRODUCTION-PIPELINE.md)         | Step by step, tool by tool, for the film and the web lesson          |
| [lessons/01-what-is-a-note/](lessons/01-what-is-a-note/) | Lesson 1: brief, facts, script, storyboard, written lesson, web spec |
| [research/](research/)                                   | The seven Phase 0 research reports and the stats-site snippets       |

---

## 1. Vision

**Promise:** "Find your pitch." By the end of Season 1 a beginner can hear and explain what a note
is, find any note on a keyboard, match a note with their own voice, sing a scale and a leap in tune,
and understand the chords under a song they love.

**Why MercuryPitch can make the best series of its kind.** Three things no other music explainer
has together:

1. **Precision you can hear.** Every musical example is synthesised at its exact frequency in code,
   and every diagram is drawn from the same numbers, so what you see is what you hear to the hertz.
2. **A practice room one tap away.** Each lesson ends in the app on the exact drill that practises
   it, with the same pitch line the lesson taught.
3. **Two hosts with a teaching job.** Blue Merc explains; orange Merc voices the guess most people
   make. In Derek Muller's research, the strongest single finding behind Veritasium, stating a
   misconception and refuting it beat a clear lecture whether it was narrated (d = 0.79) or played
   as a tutor-student dialogue (d = 0.83; Muller et al. 2008). The gain is the refutation; orange
   is how we voice it, and orange's deep questions (Craig et al. 2006) are what make a dialogue
   pay.

**Quality bar:** Veritasium's misconception-first storytelling and 3Blue1Brown's "one object that
transforms into the next idea", with motion craft that holds up next to the best launch films.

**Audience:** adults and teens who sing or want to, with no theory, many of whom believe they
"can't sing". They watch on phones (so text is large and the bottom of the frame stays clear for
captions) and they want to understand, not memorise jargon.

## 2. Decisions made (and why)

All fifteen are decided: the plan and Lesson 1 follow them. Where part of one still waits for the
owner, its status names the § 12 item; § 12 is the single register of what is still open.

| #   | Decision                                                                                                                                                                                                                        | Reason                                                                                                                                                                                                                                                                              | Status                                |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| D1  | Series name **"Find Your Pitch"**                                                                                                                                                                                               | The brand's recommended tagline (`docs/branding/BRAND.md` § 1), with its double meaning                                                                                                                                                                                             | Decided                               |
| D2  | **The WebGL2 resin Merc is canon**; blue teaches, orange asks                                                                                                                                                                   | Most expressive, deterministic, company-owned code, already the premium-exercise host. See MERC-BIBLE                                                                                                                                                                               | Decided (owner-confirmed)             |
| D3  | **Orange Merc = the same body with a warm palette** (gold, orange `#ff7448`, rose)                                                                                                                                              | No orange Merc existed anywhere in the repo; this pairs with the stats site's cold-blue/warm-orange themes and keeps one rig                                                                                                                                                        | Decided; in the app: § 12 item 10     |
| D4  | **Season 1 is sound-first: 14 lessons and a trailer; the staff waits for Season 2**                                                                                                                                             | The app's native representation is a live pitch line, the sound-first choice; all major music methods put sound before symbol                                                                                                                                                       | Decided                               |
| D5  | **Theory and voice alternate** after two theory openers; each closing question is the next cold open                                                                                                                            | Interleaving; a running open loop across episodes                                                                                                                                                                                                                                   | Decided                               |
| D6  | **Episodes 6 to 9 minutes** (cap 10; tiny topics 4 to 5)                                                                                                                                                                        | 3Blue1Brown's curriculum series and MOOC engagement data; Lesson 1 runs 4:57 (297.0 s on the current cue sheet)                                                                                                                                                                     | Decided                               |
| D7  | **Built in code**: HyperFrames (HTML, GSAP, one seekable timeline)                                                                                                                                                              | Deterministic, versionable, every number exact, reusable scene kit, the repo's existing motion pipeline                                                                                                                                                                             | Decided                               |
| D8  | **Merc is pre-rendered per performance** into one straight-alpha VP9 WebM, from the narration cue sheet                                                                                                                         | His raymarcher costs a quarter of a second to over a second a frame on CPU, by size (measured table in PRODUCTION-PIPELINE); one pass per performance is cached and re-timed automatically                                                                                          | Decided                               |
| D9  | **Every musical example synthesised at exact pitch; no licensed music**; a quiet synthesised pad that plays only in act transitions and under the dressed pauses (predict, hum, quiz), silent under narration and every example | Precision, no Content ID risk (it matches melodies), the coherence principle                                                                                                                                                                                                        | Decided                               |
| D10 | **60 fps master, Merc at 30 fps**                                                                                                                                                                                               | Smooth camera, waves and type; character animation on twos is a standard look. Revisit if a GPU host makes 60 fps Merc cheap                                                                                                                                                        | Decided; delivery size: § 12 item 4   |
| D11 | **Captions: a word-perfect SRT/VTT for the long form; burned-in captions only for Shorts**; the bottom 17 % of every frame stays clear                                                                                          | Redundancy principle (verbatim on-screen text hurts learning); YouTube auto-translates uploaded captions                                                                                                                                                                            | Decided                               |
| D12 | **Scratch voices are local Kokoro; final voices are a human-quality cast** (blue: the owner-approved ElevenLabs "D2" voice; orange: to cast)                                                                                    | Human voices rate higher and carry the on-screen agent's benefit (Mayer and DaPra 2012), so the cast is human or the most natural voice available (playbook rule 14); the synthetic D2 is a trade-off against that evidence. The cue pipeline re-times the film from new recordings | Decided for blue; orange: § 12 item 1 |
| D13 | **Web lesson = step deck + toys + predict + sung checkpoint + quiz**; explorer in two lanes (Theory, Voice)                                                                                                                     | Ableton Learning Music, Ciechanowski, Brilliant, 3Blue1Brown lesson pages, The Pudding ([research/curriculum-benchmark.md](research/curriculum-benchmark.md) § 3)                                                                                                                   | Decided; public home: § 12 item 9     |
| D14 | **Lesson CTAs go to `/exercises/<slug>` and named pages**; Lesson 1 goes to `/mirror`                                                                                                                                           | Voice Mirror is free, needs no account and accepts octave matches, matching the lesson's own claim                                                                                                                                                                                  | Decided                               |
| D15 | **Every claim has a line in the lesson's FACTS.md** and is checked against code, standards or primary research                                                                                                                  | The motion pipeline's honesty rule; the app's guided-voice claims rules                                                                                                                                                                                                             | Decided                               |

## 3. Pedagogy in one page

The [playbook](TEACHING-PLAYBOOK.md) has 25 rules; these shape every episode and page:

- **Hook with a question in the first 30 seconds**, spoken over the phenomenon itself.
- **Predict before every reveal** (a visible pause card in the film, a locking two-choice widget
  on the page).
- **Voice the misconception, then refute it**: orange says it sincerely, the demonstration breaks
  it, blue never mocks it.
- **Orange only asks deep questions** (why, how, what if) or makes sincere guesses. No filler.
- **Sound before symbol, concrete before abstract**: hear it, sing it, name it.
- **One persistent object transforms into the next idea** (Lesson 1: line, spiral, piano).
- **Label, don't transcribe**; words where and when the picture is; gold only for "the fit".
- **No music under listening or explaining**: the pad plays only in act transitions and under the
  dressed pauses (predict, hum, quiz), so the film never drops to digital silence; it is silent
  under narration and under every musical example.
- **Mascots act; they don't decorate**: they leave during dense diagrams and come back to react.
- **Retrieve at the end and again later**: three recap questions in the film, three or four on the
  page; the next episode opens with one from the last, and the next page visit asks two from
  earlier lessons again.
- **Every voice is learning; no labels**; octave matches count; feedback describes the sound,
  never the singer; "gentle, never push"; a comfort check before anything beyond a comfortable hum
  (the playbook's house rules).

## 4. Formats

### 4.1 The YouTube episode

Beat sheet for a 7:30 episode (scale proportionally). Lesson 1 follows it with three deviations:
no separate Promise beat (the title sting runs straight into Act 1; the promise is on the page),
a reveal that settles orange's guess with a nuance ("Higher, yes. But together, they melt into one
note.") rather than a refutation, and a single sung gap in Act 4. The Phase 1 re-voice adds a
short spoken promise after the sting (Phase 1 Voices track).

| Time      | Beat                      | Content                                                                                  |
| --------- | ------------------------- | ---------------------------------------------------------------------------------------- |
| 0:00-0:30 | Cold open                 | A sound puzzle; orange's intuitive answer; blue turns it into the hook question          |
| 0:30-0:34 | Title sting               | Series mark and episode title with jumping notes (never a logo before the question)      |
| 0:34-1:00 | Promise                   | What you'll be able to hear or do by the end                                             |
| 1:00-2:30 | Act 1: the concrete model | One physical or visual model built from scratch                                          |
| 2:30-2:50 | Predict                   | "Before you listen, predict" with a visible pause                                        |
| 2:50-4:30 | Act 2: the twist          | The reveal settles orange's guess: refutes it, or shows why it is half right             |
| 4:30-5:30 | Act 3: name it            | The term arrives now; connect it to the MercuryPitch pitch line                          |
| 5:30-6:30 | Act 4: sing it            | Call and response with sung gaps; gentle; octave counts                                  |
| 6:30-7:05 | Recap                     | Three quick questions, a beat to answer, the answer shown with the object that taught it |
| 7:05-7:30 | Next and end screen       | The next episode's hook question; the practise link; a 5 to 20 s end screen              |

Packaging: chapters (first at 00:00, at least 3, each at least 10 s) named as the beats; a YouTube
title of at most 100 characters (aim for about 60) that states the hook accurately and may shorten
it, with the full hook in the thumbnail text, the first description line and the cold open
("legit bait"); titles tested with YouTube's Test & Compare (up to three variants, one of them a
search-style title in the audience's words, such as "how to match pitch"); a description and
keywords from the per-episode template (Phase 1 Channel track); thumbnails at 3840x2160 from the
stats site's album-cover template with Merc in place of the record; two Shorts per episode (the
cold-open puzzle, 30 to 60 s, ending on the question; and a 9:16 sing-along), recomposed as
sibling projects, never letterboxed.
Release: the trailer and Lessons 1 to 3 together or on consecutive days, then a fixed weekly day.

### 4.2 The web lesson

Budget: 8 to 12 minutes of active time, 500 to 900 words, 6 to 10 motion visuals, 3 to 5 toys, one
sung checkpoint, the embedded episode.

1. Header: lesson number, the hook question as the title, time, prerequisite chips, a one-line
   promise.
2. Sound gate: one tap enables audio; the microphone is asked for only at the checkpoint.
3. Cold-open toy, predict then reveal: orange's guess in a bubble; the learner taps a prediction;
   the sound and the reveal play. It opens the page, straight under the title.
4. From Lesson 2 on, a recall check, straight after the cold open: two questions from earlier
   lessons, asked again rather than shown with their stored answers, which give the delayed
   score (§ 9). Decided 20 October 2026 (§ 12 item 13): the cold open comes first, as on Lesson
   2's page; until then this list put the recall first.
5. Four to six steps in a step deck (sticky visual, 50 to 120 words each, one "Try:" imperative,
   one "Notice:" line, N of M counter, play / pause / scrub / slow on every animation).
6. A "common mix-up" card: the belief, why it seems right, the evidence, the better idea.
7. The sung checkpoint: the learner's line against Merc's target band, octave-tolerant, generous
   cents window, language about the sound. Required from Lesson 3 on. A theory lesson may instead
   offer an unscored sing- or hum-along with the app link for the scored version (Lesson 1: hum
   along with Merc, nothing listens; to be scored, sing it back on "ooh" in Voice Mirror).
8. Quick check: three or four retrieval questions, each with three or four options, with one-line
   feedback (Lesson 1 has four).
9. Playground: the main toy with every control.
10. Watch the episode, with chapters mirroring the steps, captions and the transcript.
11. Wrap: a three-line recap, a one-sentence challenge, the practise link, the next lesson's hook.

Lesson 1's page keeps this order with two changes: its step toys double as the Playground, and
its Wrap comes before the episode (WEB-SPEC, which also lists its smaller departures). Every page
freezes its idle loops and drifts under `prefers-reduced-motion` and offers a visible "Pause
animations" toggle (WCAG 2.2.2).

### 4.3 The lesson explorer

Two lanes, Theory and Voice, drawn from the topic graph (IDs T01..., S01...), with prerequisite
edges from CURRICULUM's lesson-to-lesson prerequisite table (every Season 1 prerequisite is in
Season 1), arcs ("Hear it", "Shape it"), node states (not started, in progress, done, recommended
next) and a card per lesson (hook question, length, start). On phones a vertical two-lane list
with prerequisite chips, not a zoomable graph. No account needed to read; progress in local storage
until sign-in, which needs the lessons on the app's origin (§ 12 item 9). Lesson 1's prototype is
the preview page in § 11.

### 4.4 In the app

- Home's existing "Learn" button opens `#/learn/<chapterId>` read-along chapters: the natural home
  for the lessons inside the app, once the existing chapters' errors are fixed (§ 7, Phase 1).
- The Ascent's week cards already hold curated video links as plain data
  (`src/features/path/path-content.ts`): voice lessons slot into their matching weeks, once weeks
  2 and 3 ("Breath & Power", "Reach New Notes") stop promising breath support and a wider range
  (Phase 1 App content).
- Lesson pages and episodes link into drills with `/exercises/<slug>` (Phase 1 engineering).

## 5. Visual and sound language

- **Ground:** Obsidian `#0d1117` with three soft glows and the stats site's faint five-line staves;
  depth through far, mid and near layers (parallax on every camera move); seeded dust motes.
- **Type:** Outfit (display, numbers), Inter (UI), Instrument Serif italic (the big ideas, from the
  stats site), JetBrains Mono (kickers, readouts), Noto Music glyphs drawn as paths. All SIL OFL.
  Essential labels at least 48 px at 1080p; kickers at least 30 px; on-screen words never repeat a
  narrated sentence.
- **Colour code, for explanatory diagrams across the series:** blue `#58a6ff` = blue Merc's note;
  orange `#ff7448` = orange Merc's note; gold `#ffd84d` = the fit (things that line up, the key
  relationship); violet = a contrast case, drawn as a dashed wave or bead in the darker `#8957e5`
  (L\* 49, so it separates from blue's L\* 67 for protan and deutan viewers) with its text labels
  in `#bc8cff` for 4.5:1 text contrast; chrome `#c3ccd6` = any other note; ink `#e6edf3` labels.
  Colour is never the only carrier. The signal colours govern marks, labels and glows, not the
  hosts' bodies: orange Merc's gold base is body colour, never a signal.
- **Pitch-canvas scenes** (anything drawn as the app's pitch line) use the app's own canvas set, so
  the lesson's line is the one the app shows: target amber `#f59e0b` and singer violet `#a78bfa`
  (`PITCH_VISUAL_COLORS` in `src/features/stem-mixer/pitch-canvas-visuals.ts`), with the production
  research's in tune mint `#80ffca`, off rose `#ff4d97`, tonic butter `#ffdf80` and wave cyan
  `#52c2cc` (worst-case CIEDE2000 distance 12.4 under all three simulated colour-blindness types,
  [research/production-research.md](research/production-research.md)). Merc's sung model note on
  a pitch canvas is the amber target band, never gold or blue.
- **One meaning for violet per film.** The singer's line on a pitch canvas is violet, and so is
  the contrast case in the series code. In a film that has a pitch canvas, the contrast case (a
  wrong guess, the case that does not fit) is drawn dashed in ink-2 `#a8b3bf` with a "?", so
  violet only ever means the singer. Lesson 2 is the first film this applies to (its DECISIONS
  38).
- **Colour-blindness gate**, part of the measured quality bar: a Machado et al. (2009) simulation
  (protan, deutan, tritan, severity 1.0) and CIEDE2000 over the full palette (series code,
  pitch-canvas set, both Merc bodies), with the worst case recorded beside the canvas set's 12.4.
- **Pitch is always height**; loudness is size, brightness or wave height; a pitch change is never
  shown as a size change.
- **Motifs from the stats site** (all hand-built SVG, already seekable in the research snippets):
  the plucked string and living staff (vibration), the jumping notes on an engraved staff
  (notation), the Chladni plate (standing waves, harmonics: Lesson 13), the piano roll (pitch
  against time: every singing lesson), the metronome and step sequencer (Lesson 8), the LED
  analyser (vowels, Lesson 13), ticket cards (key facts, recaps), the album cover (thumbnails, end
  cards).
- **Motion:** one main move leads, smaller ones overlap; land slowly, leave fast; no linear easing
  on movement; a carried object lands on the same pixels either side of a cut; no still stretch
  longer than about 0.5 s (a diagram being explained keeps a travelling wave, a breathing glow or a
  slow drift).
- **Sound:** the voice leads; musical examples at exact pitch with their visual twin; the pad plays
  only in act transitions and under the dressed pauses, and is silent under narration and under
  every musical example; one soft
  whoosh per real scene change; loudness about -16 LUFS integrated for this calm style, true peak
  at most -1 dBTP.

## 6. Production pipeline (summary)

Full detail and commands in [PRODUCTION-PIPELINE.md](PRODUCTION-PIPELINE.md). Per episode:

1. **Brief and facts.** `BRIEF.md` (message, audience, CTA) and `FACTS.md` (every claim with its
   source).
2. **Script** as a typed event list (`script.json`): lines (speaker, text, gap), sung notes,
   musical examples, pauses, marks. A script critic checks the teaching and the orange lines.
3. **Voice.** Per-line synthesis (scratch: Kokoro; final: the cast), a loudness envelope per line.
4. **One clock.** `cues.py` places every event; the composition, the mixer, the Merc performances
   and the captions all key off cue names, so a re-voiced line re-times everything.
5. **Storyboard** with a shot line per row (size, angle, lens, move, light, composition, time,
   out), the persistent objects, the signature moments and the handoff frames; a fresh
   motion-critic round, then a verification round.
6. **Shared kit**: room, camera with parallax, beads and hops, waves, staff and notes, Merc layers,
   tokens, fonts.
7. **Merc performances** generated from the cues and rendered once per performance.
8. **Scenes built in parallel** by several builders, each owning contiguous scenes and proving
   them with lab stills and clips before handing back.
9. **Integrate and render**; a fresh critic per full-film round until SHIP (at most six rounds
   before escalating); measured quality bar (holds, frame one, contrast, colour-blind separation,
   collisions, loudness, the bed silent inside every spoken line and musical example,
   determinism).
10. **Audio**: the mix built from the same cues; a music-only version for checking effects.
11. **Deliver**: 1080p60 master, captions (SRT and VTT), chapters, contact sheet, ledger (written
    after the critic rounds), delivery notes; Shorts and thumbnail; the web lesson goes live at its
    public URL with the episode.

**Measured on Lesson 1** (4-core CPU, no GPU): Kokoro speaks 5 minutes of script in about 80 s;
Merc's cost per frame by size is the measured table in PRODUCTION-PIPELINE (from a quarter of a
second at 225 px to about a second at 480 px at `medium`, and up to four times that when the CPU is
shared), about 1.5 hours for the film's 17 performances; HyperFrames renders the composition at
roughly 3 to 4 s of wall time per second of 60 fps film. The Lesson 1 ledger, written after the
critic rounds, will hold the final numbers.

## 7. Phases and roadmap

### Phase 0: discovery and proof (in progress, October 2026)

- Seven research reports ([research/](research/)): Merc as a production asset, the stats site's
  motifs, brand and motion pipeline, the app's existing teaching content and deep links,
  evidence-based pedagogy, curriculum benchmarks, production stack.
- Curriculum (14 lessons and a trailer, topic graph, Seasons 2 and 3), playbook, host bible.
- The Merc film pipeline: bundled read-only from `src/lib/merc`, orange look, capture, straight-alpha
  passes, performances from the cue sheet.
- Lesson 1: script, facts, storyboard (two critic rounds), all 17 Merc passes, all 21 scenes built,
  written lesson; the web lesson with explorer in build. Still to come: the full-film critic
  rounds, the delivery render and the LEDGER.

Exit: Lesson 1's delivery master and LEDGER exist; these two alone mark Phase 0 done. The web
lesson's preview URL goes in § 11 once the preview is published; its public URL is the Phase 1
Lesson host track's exit, not Phase 0's.

### Phase 1: foundation (about 3 weeks)

Goal: everything Lesson 2 needs, so each later episode is production, not invention.

| Track            | Work                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Exit criterion                                                        |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Decisions        | The owner answers § 12                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Every § 12 item marked decided in § 12, the single register           |
| Voices           | Cast: done in October 2026, Blue as D2 and orange as "Orange Merc", a Voice Design saved on the owner's ElevenLabs account (MERC-BIBLE § 4; rights, § 12 item 1); final singing voices: the ElevenLabs-derived Echo samples stay for now (the owner holds their rights, § 12 item 1) and a voice actor replaces them later; Lesson 1 speaks with the cast from `rc-07`, on its unchanged script, so its next re-voice changes "Hum it back" to "Sing it back, or hum along" and adds a short spoken promise after the title sting (§ 4.1); a pronunciation sheet (note names, hertz, "A four")                                                                                                                                                                                                | Lesson 1 re-rendered with final speaking and singing voices           |
| Voice safety     | A vocal coach (§ 12 item 8) reviews Lessons 3 and 5: exercises, hold lengths, the comfort check before demanding segments and the referral line (playbook house rules, REQ-GVC-020 and 021); coach sign-off becomes a standing gate for every voice lesson (§ 7 timeline)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Coach sign-off on Lessons 3 and 5                                     |
| Film kit         | Promote `output/motion/lesson-01/tools` and `assets/lib` into a versioned kit (cue sheet, mixer, Merc passes and performances, root generator, lab, captions, scene kit); the colour-blindness and bed-silence checks in the measured quality bar (§ 5, § 6); a home for durable film sources (§ 12 item 2)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Lesson 2 scaffolds in minutes                                         |
| Merc             | `LOOKS.ember` constant; accent uniforms with owner approval of the shader hash (§ 12 item 10); a `talk` state; `prepare(t)`; MASCOT.md update                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | If item 10 says yes: orange is a first-class palette in the app       |
| Render           | A GPU render host (`--browser-gpu`) or a shared Merc frame cache                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | A full delivery render in under an hour                               |
| Web kit          | A reusable toy kit: pitch canvas with target band, tone player, wave and interval ruler, keyboard strip, spiral, step deck, predict widget, retrieval quiz, sound gate; in its contract, idle loops and drifts frozen under `prefers-reduced-motion` and a visible "Pause animations" toggle                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Two lessons share it with no copy-paste                               |
| Lesson host      | The public home of the web lessons, `mercurypitch.com/learn/NN` (§ 12 item 9): the route, the toy kit's build target, the episode's player (§ 12 item 7: self-hosted on R2) and explorer progress synced on sign-in. The private preview page stays the proof preview                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Lesson 1 served at its public URL; its CTAs carry `?lesson=01`        |
| Lesson telemetry | An event schema (`lesson_id`, `question_id`, `first_try_correct`, `visit_index`, `consent`); an endpoint on the db-worker under an owner-approved payload exception (§ 12 item 11: the app's analytics are counts-only today, `src/lib/analytics.ts`); a privacy note; the delayed re-test at the next visit (§ 4.2 item 4); an A/B assignment mechanism for Phase 4                                                                                                                                                                                                                                                                                                                                                                                                                          | Lesson 1's page reports guess-corrected first-try scores per question |
| App              | Data-only `/exercises/<slug>` entries per lesson; new launch fields: `intervals` (semitones and direction; Interval Trainer, Drone Intonation) and `durationSec` (Long Note, Pitch Hold), plus `pattern` and scale-type on `ExerciseLaunch` (`launch-override.ts` already exposes `launchPattern`, which the warm-up reads; `ExerciseLaunch` lacks it); fix `perfect-octave` so it drills an octave; an octave-folded scoring option for Pitch Hold and the other matching drills (or an explicit written-octave note in Lessons 3 and 9); `ear-drill` (accepting a bank subset), `zen` and `learn` launch kinds; a `?lesson=` marker that skips First Light and records attribution; Voice Mirror's "you matched an octave lower: same note" message. Estimated as code with tests, not data | Every Lesson 2 to 7 CTA opens its drill                               |
| App content      | Fix the Learn chapters (band thresholds, "C minor's relative major is A major", "perfect pitch" wording) and card copy (Call & Response "rhythmic accuracy"); rewrite `src/features/path/path-content.ts` weeks 2, 3 and 4 (breath "support", "extend your range" and "as true as your ear can hear" copy and videos) against the playbook's claims rules, and until then drop the Ascent links from the Lesson 5, 7 and 9 cards                                                                                                                                                                                                                                                                                                                                                              | No lesson contradicts the app                                         |
| Channel          | Channel art, playlist, trailer script, end-screen template, thumbnail template; a per-episode description and keyword template covering the audience's search phrases ("how to match pitch", "how to sing in tune"); a search-style title among the Test & Compare variants; the YouTube side of the analytics plan (§ 9)                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Ready to publish                                                      |

### Phase 2: Arc A, "Hear it" (Lessons 2 to 7 and the trailer; about 7 weeks)

One episode a week after the first two, each through the full pipeline and critic loop, each with
its web lesson and two Shorts. Launch batch: trailer and Lessons 1 to 3 together; then weekly.
Alongside it, an engineering track for Arc B's practise links: Chord Stacker triad chord types
(maj, min) for Lesson 12 (today it has sevenths and a sixth only), Drone Intonation limited to the
major and minor thirds for Lesson 10 (it already has both), and Interval Trainer given a minor
third, which its fixed pool (M2, M3, P4, P5, M6, P8) lacks, then limited to Lesson 9's thirds,
fifth, fourth and octave (both limits through the `intervals` field from Phase 1). Exit: seven
episodes live, retrieval data on each page, and every Lesson 8 to 14 CTA opening its drill.

### Phase 3: Arc B, "Shape it" (Lessons 8 to 14; about 7 weeks)

Same cadence. Lesson 13 brings the Chladni plate and the spectrum; Lesson 14 a whole song (public
domain or original). Exit: Season 1 complete; the explorer shows the whole graph.

### Phase 4: measure and improve (continuous from launch)

Retrieval scores per question and per lesson (the learning metric); 30-second retention, average
view percentage and click-through (engagement); lesson-to-app conversions and seven-day return
(product). A/B tests, through the assignment mechanism from the Lesson telemetry track: mascot
presence in dense diagrams, feedback fading in the checkpoint, title and thumbnail variants. When
an episode's retrieval scores lag, re-cut it and replace it on the page's self-hosted player, and
re-teach the point in the next cold open; on YouTube, upload a re-cut only as a new video, when
retrieval lags badly.

### Phase 5: Season 2, "Read it, harmonise it"

The staff and rhythm reading, sight-singing with movable do, interval quality, minor properly, keys
and the circle of fifths, harmony singing, vibrato, agility, cadences and form, seventh chords, why
twelve notes (see CURRICULUM § 5).

### Per-episode timeline (from Lesson 3 on, with the kits in place)

| Day | Work                                                                                       | Gate                                                                                                                    |
| --- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| 1   | Brief, facts, script v1; script critic; voice                                              | Facts complete; every orange line is a question or a sincere guess; voice lessons: the vocal coach signs off the script |
| 2   | Storyboard and handoffs; critic and verification rounds; Merc performances start rendering | Storyboard SHIP                                                                                                         |
| 3-4 | Scenes built in parallel; lab stills and clips; integration                                | Every scene proven in its lab                                                                                           |
| 4-5 | Full-film critic loop; mix; captions; Shorts; thumbnail                                    | Film SHIP and measured quality bar                                                                                      |
| 5   | Web lesson from the toy kit; app-check at phone and desktop                                | Page QA passes; links open their drills                                                                                 |
| 6   | Owner review; publish                                                                      | Owner approval; voice lessons: the vocal coach signs off the film and page                                              |

## 8. Roles

| Role                                                        | Owns                                                                                                                            |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Series director (owner, with Claude as production director) | The brief, the bar, final approval                                                                                              |
| Writer                                                      | Script and lesson copy, in the brand voice and the playbook                                                                     |
| Fact checker                                                | Every line of FACTS.md against code, standards or primary research                                                              |
| Vocal coach                                                 | Voice lessons' exercises and safety copy, signed off at the day-1 and day-6 gates (PRODUCT.md already expects a coach's review) |
| Voice cast                                                  | Blue and orange                                                                                                                 |
| Motion builders                                             | Scenes, from the storyboard and the kit                                                                                         |
| Independent critic                                          | A fresh motion-critic per round; never the builder                                                                              |
| Audio                                                       | The mix, the stings, the examples' timbres                                                                                      |
| Web builder                                                 | The lesson page from the toy kit                                                                                                |
| QA                                                          | The app-check sweep at phone and desktop; captions; accessibility                                                               |

## 9. Measurement

| Kind       | Metric                                                                                                                                                              | Target for Season 1                                       |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Learning   | Share of first-try correct answers on the page's quick-check questions (three or four; Lesson 1 has four); again at the next visit, with the questions asked afresh | 70 % first try; 80 % after review; both guess-corrected   |
| Engagement | YouTube viewers remaining at 30 s; average view percentage                                                                                                          | From episode 6 on, beat the median of episodes 1 to 5     |
| Product    | Lesson-page practise-link clicks; first sung note in the app within a day; seven-day return                                                                         | Tracked from launch; targets set after four weeks of data |
| Craft      | Critic rounds to SHIP; factual corrections after publishing                                                                                                         | Three or fewer; zero                                      |

Each question has three or four options, so a blind guess scores a third or a quarter; scores are
reported guess-corrected, (raw - 1/k) / (1 - 1/k) for k options. The learning metric is collected
by the Phase 1 Lesson telemetry track, on the lesson host (§ 12 items 9 and 11); until both exist,
quiz answers stay in the viewer's browser and nothing reaches the team.

Judge lessons by retrieval, not by "that was so clear": fluency inflates perceived learning.

## 10. Risks

| Risk                                                                                                                                                            | Mitigation                                                                                                                                                                       |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CPU-only rendering is slow (Merc up to about a second a frame, more on a shared CPU: PRODUCTION-PIPELINE)                                                       | GPU host in Phase 1; Merc performances cached; drafts at low quality                                                                                                             |
| Voice licensing (ElevenLabs plan terms undocumented; Kokoro trained partly on synthetic audio)                                                                  | Owner confirms terms; human actors as the fallback; keep the per-line manifest                                                                                                   |
| Merc's sung notes in Lesson 1 are ElevenLabs-derived placeholders that the app withholds from its store build (`src/features/echo/merc-voice-set.ts`)           | The owner holds the rights (§ 12 item 1, decided); a voice actor replaces them later, in the Phase 1 Voices track                                                                |
| The two voices live in different ElevenLabs workspaces, and an account can lose a voice                                                                         | Both voice IDs are in MERC-BIBLE § 4; every line's take and its manifest stay with the lesson's sources (§ 12 item 2), so a lost voice costs future lines, never a finished film |
| Character drift (four Mercs in the repo)                                                                                                                        | The canon decision (D2) and the bible                                                                                                                                            |
| Claims errors in a teaching series                                                                                                                              | FACTS.md per lesson, critic rounds that check truth, the playbook's claims rules                                                                                                 |
| Content ID claims on melodies                                                                                                                                   | Public-domain or original tunes only; everything synthesised                                                                                                                     |
| Interactive pages are expensive and break over time                                                                                                             | One shared toy kit; interactivity only where it explains                                                                                                                         |
| Premium positioning conflict (`docs/plans/premium.md:48`: pitch training never premium; `docs/specs/guided-voice-check.ears.md` REQ-GVC-025: safety never paid) | Lessons free as the top of the funnel; whether premium stays the Merc practice rooms, which already conflict with `premium.md:3-8`, is § 12 item 3                               |
| First-time visitors from a lesson see onboarding first                                                                                                          | The `?lesson=` marker in Phase 1, or embrace First Light for Lesson 1                                                                                                            |
| Builders produce uneven quality                                                                                                                                 | The shared kit, the build guide, handoff frames, and a critic that never saw the build                                                                                           |

## 11. What exists now

- Durable sources in this repo: [`lessons/01-what-is-a-note/`](lessons/01-what-is-a-note/) (brief,
  facts, script with timings and `script.json`, storyboard, handoffs, build guide, decisions,
  captions, the written lesson, the web spec and the LEDGER of all nine critic rounds) and
  [`research/`](research/) (the seven reports and the stats-site snippets).
- The film project: `output/motion/lesson-01/` (gitignored, per the motion pipeline's house rules;
  its tools and scene kit are the seed of the Phase 1 film kit). The master is `rc-07` (5:14,
  60 fps, with the owner's ElevenLabs voices); round 09 passed it and left four cosmetic items,
  each under two seconds, for a later render. Its 1080p and 720p web encodes go to R2 (§ 12 item
  7); the film is never committed.
- The web lesson and explorer: built in the app at `/learn/01` (`learn/01.html`,
  `src/features/lessons/`), merged on 19 October 2026 and live on the dev site; it reaches
  `mercurypitch.com` with the next release. Until the film is on R2 the page shows the poster,
  the chapters and the transcript. A private preview page, which also plays the film, stays for
  review.
- Lesson 2: [`lessons/02-twelve-notes/`](lessons/02-twelve-notes/) holds the same set, plus the
  film's build decisions and the LEDGER of its fifteen critic rounds (ten on the script and
  storyboard, five on the film). Its film project is `output/motion/lesson-02/` (gitignored); the
  master is `rc-04` (7:11, 60 fps, with the owner's ElevenLabs voices), which round 15 passed with
  four polish items for a later render. Its web lesson is built at `/learn/02` (`learn/02.html`,
  `src/features/lessons/lesson-02/`, on the shared kit in `src/features/lessons/kit/`), merged on
  19 October 2026 and live on the dev site; it reaches `mercurypitch.com` with the next release.
- Lessons 3 to 7: written lessons, text only and reviewed, in
  [`lessons/03-match-a-note/`](lessons/03-match-a-note/),
  [`lessons/04-major-scale/`](lessons/04-major-scale/),
  [`lessons/05-breath-steady-note/`](lessons/05-breath-steady-note/),
  [`lessons/06-intervals/`](lessons/06-intervals/) and
  [`lessons/07-slides-sirens-range/`](lessons/07-slides-sirens-range/) (facts, copy and page
  spec). Lessons 3, 5 and 7 wait on the vocal coach (§ 12 item 8), and so does Lesson 6's
  sing-along. Lessons 3 to 6 have pages, `/learn/03` to `/learn/06`, all four drafts
  (`src/features/lessons/kit/drafts.ts`): every build carries them, the dev site and previews serve
  them, and mercurypitch.com answers each with the 404 page until the console publishes it
  (`src/lesson-gate.ts`): 3 and 5 after the coach, 6 after the owner and the coach, 4 after 1 and 2.
- Lessons 8 to 10: written lessons, text only, each reviewed once and fixed, in
  [`lessons/08-beat-tempo-backbeat/`](lessons/08-beat-tempo-backbeat/),
  [`lessons/09-landing-a-leap/`](lessons/09-landing-a-leap/) and
  [`lessons/10-major-minor/`](lessons/10-major-minor/) (facts, copy and page spec). Their sung
  parts wait on the vocal coach (§ 12 item 8). No page is built yet; each goes live when the
  console publishes it, after the coach's sign-off and once the pages its recall links to are
  live: `/learn/06` for all three, and `/learn/03` too for Lesson 9.
- Lesson 11: a written lesson, text only, reviewed once and fixed, in
  [`lessons/11-registers-break/`](lessons/11-registers-break/) (facts, copy and page spec). Its sung
  checkpoint waits on the vocal coach (§ 12 item 8). No page is built yet; it goes live when the
  console publishes it, after the coach's sign-off and once `/learn/07`, the page its prerequisite
  chip and its recall link to, is live.
- Lesson 12: a written lesson, text only, reviewed once and fixed, in
  [`lessons/12-chords-four-chord-song/`](lessons/12-chords-four-chord-song/) (facts, copy and page
  spec). Its sung checkpoint waits on the vocal coach (§ 12 item 8). No page is built yet; it goes
  live when the console publishes it, after the coach's sign-off and once `/learn/10`, the page its
  recall links to, is live.
- Lesson 14: a written lesson, text only, reviewed once and fixed, in
  [`lessons/14-phrasing-whole-song/`](lessons/14-phrasing-whole-song/) (facts, copy and page spec).
  Its sung parts wait on the vocal coach (§ 12 item 8). No page is built yet: it waits on a season
  close that knows a rest ending (its WEB-SPEC, What the kit and the app still need, item 12). It
  goes live when the console publishes it, after the coach's sign-off and once `/learn/05`,
  `/learn/08`, `/learn/09` and `/learn/12`, the pages its chips and its recall link to, are live.
- YouTube: [`youtube/YOUTUBE.md`](youtube/YOUTUBE.md) is the upload guide for Lessons 1 and 2
  (every Studio field, chapters, end screens, cards and pinned comments, checked against YouTube's
  help pages on 19 October 2026), with three thumbnails per film, end-screen maps, paste-ready
  descriptions and tags, and titles, thumbnail ideas, opening lines and tags for the trailer and
  Lessons 3 to 14. Nothing is uploaded yet: the owner uploads the films once its four gates pass.
  Decided on 19 October 2026: not made for kids, no AI disclosure, the playlist element on Lesson
  2's end screen, and Shorts remixing allowed.

## 12. Owner decisions

The single register of what still waits for the owner (the decisions already made are D1 to D15
in § 2; a lesson's own choices stay in its DECISIONS.md). Each item is marked **Decided** or
**Proposed**: a recommendation, or none yet, awaiting the owner's answer. When the owner answers,
the item is marked decided here and the Phase 1 Decisions track closes when every item is.

1. **Partly decided (16 October 2026).** The owner holds the rights to the ElevenLabs voices,
   which covers the D2 voice's commercial terms and Merc's sung notes in Lesson 1 (the Echo set
   the app withholds from its store build, `src/features/echo/merc-voice-set.ts`): they stay for
   now, and a voice actor replaces them later (Phase 1 Voices track). Still open: orange Merc's
   name and pronouns.
2. **Decided (16 October 2026): a private repository.** It is `disjoint-colliders`, package
   `packages/learn` (17 October 2026). The film sources go there; source media (the Merc passes,
   the voice takes) goes to a private R2 bucket listed in a `media.json` manifest, never into git.
   Until each lesson moves, its working files travel as the archive the director sends at each
   milestone. (The lesson documents stay in this repo, in `lessons/`.) The film tools become a
   shared, versioned film kit vendored into that repository with a drift check; until then tool
   changes stay small and are logged in the film's `tools/CHANGES.md`.
3. **Proposed: the lessons are free**, the top of the funnel (`docs/plans/premium.md:48`: pitch
   training never premium; `docs/specs/guided-voice-check.ears.md` REQ-GVC-025: safety never
   paid). Still open: whether premium stays the Merc practice rooms, which already sit uneasily with
   `premium.md:3-8` (everything that runs on the device is free forever).
4. **Proposed, no recommendation yet.** 1080p or 4K delivery. (The frame rate is decided: D10.)
5. **Decided (16 October 2026): British English in general,** with American wording where the
   owner prefers it, case by case. Narration and lesson copy stay as drafted ("semitone" and "tone"
   lead, "half step" and "whole step" are the alternates), so nothing re-voices. The app's screens
   (0.9.18) stay American; the lesson pages are their own documents.
6. **Proposed: the Learn chapters** (`#/learn/<chapterId>`), the natural home for the lessons
   inside the app once their errors are fixed, with voice lessons also linked from their matching
   Ascent weeks (§ 4.4). Whether the in-app lessons live in Learn chapters, the Ascent, or a new
   Lessons surface.
7. **Decided (16 October 2026): self-hosted on R2.** The page plays its own copy of the episode, an
   MP4 at 1080p with a 720p copy for phones, from the R2 bucket the site's security policy already
   allows (`media-src` in `public/_headers`); a re-cut replaces the file in place. Updated 17
   October 2026: the web encodes go to R2 on a custom domain (planned: `media.mercurypitch.com`),
   because Cloudflare rate-limits `r2.dev` and meant it for development; `media-src` gains that
   domain when it exists. In the app, a lesson film plays from those MP4s in the app's own player,
   with a "Watch on YouTube" link and no YouTube embed: iOS WebViews send no Referer, so YouTube
   embeds fail with Error 153, and the app's COEP header blocks YouTube iframes. The film files are
   never committed (renders stay out of git, and the asset layer serves no file over 25 MiB).
8. **Proposed, no recommendation yet.** Who the vocal coach is. (That a coach signs off every
   voice lesson at the day-1 and day-6 gates is fixed: § 7.)
9. **Decided (16 October 2026): `mercurypitch.com/learn/NN`.** The public web lessons are the
   app's own documents, Lesson 1 at `/learn/01`. The app's origin shares its analytics, its
   accounts (explorer progress on sign-in) and the `?lesson=` marker; the private preview page
   stays the proof preview.
10. **Proposed, no recommendation yet.** Whether orange Merc becomes a first-class palette in the
    app (MERC-BIBLE backlog items 1 and 2), including approval of the new pinned shader hash that
    the accent uniforms need.
11. **Proposed: yes.** A payload exception for lesson telemetry: anonymous per-question events
    (`lesson_id`, `question_id`, `first_try_correct`, `visit_index`, `consent`) through the
    db-worker, where the app's analytics carry counts only today (`src/lib/analytics.ts`).
12. **Decided (19 October 2026): do-based minor.** Minor is sung do-me-so, and the natural minor
    scale do re me fa so le te do. Do stays home, as Lesson 4 teaches it, and a minor third is one
    changed syllable. The app's Ear Lab already sings minor this way (`MINOR_SOLFEGE`,
    `src/lib/ear/wild.ts:159`; `src/lib/ear/item-bank.ts:65-72`), though it spells the fifth "Sol"
    where the lessons write "so". La-based minor (la-do-mi, the Kodály choice) is named once in
    Lesson 10's Go deeper and never taught. Season 2's sight-singing inherits the choice
    (CURRICULUM Lesson 10).
13. **Decided (20 October 2026): the cold open before the recall.** Every page opens on its cold
    open, straight under the title, and asks the recall straight after it, as Lesson 2's page
    does (§ 4.2 items 3 and 4; CURIOSITY-MOMENTS § 3.1 and § 5, item 1). Lessons 4 and 5 moved
    their recall below the cold open that day; Lessons 6 and 7 take the same order when they
    are built.
