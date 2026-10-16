# Find Your Pitch: master plan

A music theory and singing tutorial series by MercuryPitch, in two forms per lesson: a web lesson
(short text, many motion visuals, interactive toys, a lesson explorer) and a YouTube explainer
built entirely in code, hosted by blue Merc and orange Merc.

Status, 16 Oct 2026: Phase 0 is done. Research, curriculum, playbook, host bible and production
pipeline are written; Lesson 1 exists as a script, a storyboard, a rendered film and a web lesson
with the explorer (see § 11). Phase 1 starts with the owner decisions in § 12.

| Document                                                 | What it holds                                                      |
| -------------------------------------------------------- | ------------------------------------------------------------------ |
| This file                                                | Vision, decisions, formats, pipeline, phases, measurement, risks   |
| [CURRICULUM.md](CURRICULUM.md)                           | Season 1 lesson cards, the topic graph, Seasons 2 and 3            |
| [TEACHING-PLAYBOOK.md](TEACHING-PLAYBOOK.md)             | The 25 teaching rules with their evidence; claims and safety rules |
| [MERC-BIBLE.md](MERC-BIBLE.md)                           | The hosts: roles, looks, voices, behaviour, production, backlog    |
| [PRODUCTION-PIPELINE.md](PRODUCTION-PIPELINE.md)         | Step by step, tool by tool, for the film and the web lesson        |
| [lessons/01-what-is-a-note/](lessons/01-what-is-a-note/) | Lesson 1: brief, facts, script, storyboard, written lesson, ledger |

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
   make. This is not decoration: a tutor-student dialogue that voices and refutes a misconception
   beat a clear lecture in Derek Muller's research (effect size 0.83), the strongest single finding
   behind Veritasium.

**Quality bar:** Veritasium's misconception-first storytelling and 3Blue1Brown's "one object that
transforms into the next idea", with motion craft that holds up next to the best launch films.

**Audience:** adults and teens who sing or want to, with no theory, many of whom believe they
"can't sing". They watch on phones (so text is large and the bottom of the frame stays clear for
captions) and they want to understand, not memorise jargon.

## 2. Decisions made (and why)

| #   | Decision                                                                                                                                     | Reason                                                                                                                                  |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Series name **"Find Your Pitch"**                                                                                                            | The brand's recommended tagline (`docs/branding/BRAND.md` § 1), with its double meaning                                                 |
| D2  | **The WebGL2 resin Merc is canon**; blue teaches, orange asks                                                                                | Most expressive, deterministic, company-owned code, already the premium-exercise host. See MERC-BIBLE                                   |
| D3  | **Orange Merc = the same body with a warm palette** (gold, orange `#ff7448`, rose)                                                           | No orange Merc existed anywhere in the repo; this pairs with the stats site's cold-blue/warm-orange themes and keeps one rig            |
| D4  | **Season 1 is sound-first: 14 lessons and a trailer; the staff waits for Season 2**                                                          | The app's native representation is a live pitch line, the sound-first choice; all major music methods put sound before symbol           |
| D5  | **Theory and voice alternate** after two theory openers; each closing question is the next cold open                                         | Interleaving; a running open loop across episodes                                                                                       |
| D6  | **Episodes 6 to 9 minutes** (cap 10; tiny topics 4 to 5)                                                                                     | 3Blue1Brown's curriculum series and MOOC engagement data; Lesson 1 runs 4:48                                                            |
| D7  | **Built in code**: HyperFrames (HTML, GSAP, one seekable timeline)                                                                           | Deterministic, versionable, every number exact, reusable scene kit, the repo's existing motion pipeline                                 |
| D8  | **Merc is pre-rendered per performance** into straight-alpha video, from the narration cue sheet                                             | His raymarcher costs about 1 s a frame on CPU; one pass per performance is cached and re-timed automatically                            |
| D9  | **Every musical example synthesised at exact pitch; no licensed music**; a quiet synthesised bed ducked to silence under every example       | Precision, no Content ID risk (it matches melodies), the coherence principle                                                            |
| D10 | **60 fps master, Merc at 30 fps**                                                                                                            | Smooth camera, waves and type; character animation on twos is a standard look. Revisit if a GPU host makes 60 fps Merc cheap            |
| D11 | **Captions: a word-perfect SRT/VTT for the long form; burned-in captions only for Shorts**; the bottom 17 % of every frame stays clear       | Redundancy principle (verbatim on-screen text hurts learning); YouTube auto-translates uploaded captions                                |
| D12 | **Scratch voices are local Kokoro; final voices are a human-quality cast** (blue: the owner-approved ElevenLabs "D2" voice; orange: to cast) | Human voices rate higher, and the on-screen agent's benefit needs a human voice. The cue pipeline re-times the film from new recordings |
| D13 | **Web lesson = step deck + toys + predict + sung checkpoint + quiz**; explorer in two lanes (Theory, Voice)                                  | Ableton Learning Music, Ciechanowski, Brilliant, 3Blue1Brown lesson pages, The Pudding (benchmark § 3)                                  |
| D14 | **Lesson CTAs go to `/exercises/<slug>` and named pages**; Lesson 1 goes to `/mirror`                                                        | Voice Mirror is free, needs no account and accepts octave matches, matching the lesson's own claim                                      |
| D15 | **Every claim has a line in the lesson's FACTS.md** and is checked against code, standards or primary research                               | The motion pipeline's honesty rule; the app's guided-voice claims rules                                                                 |

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
- **No music under listening or explaining.**
- **Mascots act; they don't decorate**: they leave during dense diagrams and come back to react.
- **Retrieve at the end and again later**: three recap questions; the next episode opens with one
  from the last.
- **Every voice is learning; no labels**; octave matches count; feedback describes the sound,
  never the singer; "gentle, never push".

## 4. Formats

### 4.1 The YouTube episode

Beat sheet for a 7:30 episode (scale proportionally; Lesson 1 already follows it):

| Time      | Beat                      | Content                                                                                  |
| --------- | ------------------------- | ---------------------------------------------------------------------------------------- |
| 0:00-0:30 | Cold open                 | A sound puzzle; orange's intuitive answer; blue turns it into the hook question          |
| 0:30-0:34 | Title sting               | Series mark and episode title with jumping notes (never a logo before the question)      |
| 0:34-1:00 | Promise                   | What you'll be able to hear or do by the end                                             |
| 1:00-2:30 | Act 1: the concrete model | One physical or visual model built from scratch                                          |
| 2:30-2:50 | Predict                   | "Before you listen, predict" with a visible pause                                        |
| 2:50-4:30 | Act 2: the twist          | The reveal refutes orange's guess explicitly                                             |
| 4:30-5:30 | Act 3: name it            | The term arrives now; connect it to the MercuryPitch pitch line                          |
| 5:30-6:30 | Act 4: sing it            | Call and response with sung gaps; gentle; octave counts                                  |
| 6:30-7:05 | Recap                     | Three quick questions, a beat to answer, the answer shown with the object that taught it |
| 7:05-7:30 | Next and end screen       | The next episode's hook question; the practise link; a 5 to 20 s end screen              |

Packaging: chapters (first at 00:00, at least 3, each at least 10 s) named as the beats; a title
and thumbnail that state the hook question accurately ("legit bait"), tested with YouTube's Test &
Compare (up to three variants); thumbnails at 3840x2160 from the stats site's album-cover template
with Merc in place of the record; two Shorts per episode (the cold-open puzzle, 30 to 60 s, ending
on the question; and a 9:16 sing-along), recomposed as sibling projects, never letterboxed.
Release: the trailer and Lessons 1 to 3 together or on consecutive days, then a fixed weekly day.

### 4.2 The web lesson

Budget: 8 to 12 minutes of active time, 500 to 900 words, 6 to 10 motion visuals, 3 to 5 toys, one
sung checkpoint, the embedded episode.

1. Header: lesson number, the hook question as the title, time, prerequisite chips, a one-line
   promise.
2. Sound gate: one tap enables audio; the microphone is asked for only at the checkpoint.
3. Cold-open toy, predict then reveal: orange's guess in a bubble; the learner taps a prediction;
   the sound and the reveal play.
4. Four to six steps in a step deck (sticky visual, 50 to 120 words each, one "Try:" imperative,
   one "Notice:" line, N of M counter, play / pause / scrub / slow on every animation).
5. A "common mix-up" card: the belief, why it seems right, the evidence, the better idea.
6. The sung checkpoint: the learner's line against Merc's target band, octave-tolerant, generous
   cents window, language about the sound.
7. Quick check: three retrieval questions with one-line feedback.
8. Playground: the main toy with every control.
9. Watch the episode, with chapters mirroring the steps, captions and the transcript.
10. Wrap: a three-line recap, a one-sentence challenge, the practise link, the next lesson's hook.

### 4.3 The lesson explorer

Two lanes, Theory and Voice, drawn from the topic graph (IDs T01..., S01...), with prerequisite
edges, arcs ("Hear it", "Shape it"), node states (not started, in progress, done, recommended next)
and a card per lesson (hook question, length, start). On phones a vertical two-lane list with
prerequisite chips, not a zoomable graph. No account needed to read; progress in local storage
until sign-in. Lesson 1's prototype is the published page in § 11.

### 4.4 In the app

- Home's existing "Learn" button opens `#/learn/<chapterId>` read-along chapters: the natural home
  for the lessons inside the app, once the existing chapters' errors are fixed (§ 7, Phase 1).
- The Ascent's week cards already hold curated video links as plain data
  (`src/features/path/path-content.ts`): voice lessons slot into their matching weeks.
- Lesson pages and episodes link into drills with `/exercises/<slug>` (Phase 1 engineering).

## 5. Visual and sound language

- **Ground:** Obsidian `#0d1117` with three soft glows and the stats site's faint five-line staves;
  depth through far, mid and near layers (parallax on every camera move); seeded dust motes.
- **Type:** Outfit (display, numbers), Inter (UI), Instrument Serif italic (the big ideas, from the
  stats site), JetBrains Mono (kickers, readouts), Noto Music glyphs drawn as paths. All SIL OFL.
  Essential labels at least 48 px at 1080p; kickers at least 30 px; on-screen words never repeat a
  narrated sentence.
- **Colour code, for the whole series:** blue `#58a6ff` = blue Merc's note; orange `#ff7448` =
  orange Merc's note; gold `#ffd84d` = the fit (things that line up, the key relationship); violet
  `#bc8cff` = a contrast case; chrome `#c3ccd6` = any other note; ink `#e6edf3` labels. Colour is
  never the only carrier. For pitch-canvas concepts the colour-blind-checked set from the production
  research applies (target amber `#f59e0b`, sung violet `#a78bfa`, in tune mint `#80ffca`, off
  rose `#ff4d97`, tonic butter `#ffdf80`, wave cyan `#52c2cc`; worst-case CIEDE2000 distance 12.4
  under all three simulated colour-blindness types), kept on diagrams, never on the hosts.
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
- **Sound:** the voice leads; musical examples at exact pitch with their visual twin; the pad only
  in transitions, ducked to silence under examples and dense explanation; one soft whoosh per real
  scene change; loudness about -16 LUFS integrated for this calm style, true peak at most -1 dBTP.

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
   before escalating); measured quality bar (holds, frame one, contrast, collisions, loudness,
   determinism).
10. **Audio**: the mix built from the same cues; a music-only version for checking effects.
11. **Deliver**: 1080p60 master, captions (SRT and VTT), chapters, contact sheet, ledger, delivery
    notes; Shorts and thumbnail; the web lesson goes live with the episode.

**Measured on Lesson 1** (4-core CPU, no GPU): Kokoro speaks 5 minutes of script in about 80 s;
Merc costs 0.4 to 1.0 s per frame at 300 to 640 px, about 1.5 to 2 hours for one film's 17
performances; HyperFrames renders the composition at roughly 3 to 4 s of wall time per second of
60 fps film. Updated numbers are in the Lesson 1 ledger.

## 7. Phases and roadmap

### Phase 0: discovery and proof (done, October 2026)

- Seven research reports: Merc as a production asset, the stats site's motifs, brand and motion
  pipeline, the app's existing teaching content and deep links, evidence-based pedagogy,
  curriculum benchmarks, production stack.
- Curriculum (14 lessons and a trailer, topic graph, Seasons 2 and 3), playbook, host bible.
- The Merc film pipeline: bundled read-only from `src/lib/merc`, orange look, capture, straight-alpha
  passes, performances from the cue sheet.
- Lesson 1 end to end: script, facts, storyboard (two critic rounds), film, written lesson, web
  lesson with explorer.

### Phase 1: foundation (about 3 weeks)

Goal: everything Lesson 2 needs, so each later episode is production, not invention.

| Track       | Work                                                                                                                                                                                                                                                                     | Exit criterion                             |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------ |
| Decisions   | The owner answers § 12                                                                                                                                                                                                                                                   | Recorded in DECISIONS                      |
| Voices      | Cast orange; confirm D2's commercial terms; re-voice Lesson 1 with the cast; a pronunciation sheet (note names, hertz, "A four")                                                                                                                                         | Lesson 1 re-rendered with final voices     |
| Film kit    | Promote `output/motion/lesson-01/tools` and `assets/lib` into a versioned kit (cue sheet, mixer, Merc passes and performances, root generator, lab, captions, scene kit); a home for durable film sources (§ 12)                                                         | Lesson 2 scaffolds in minutes              |
| Merc        | `LOOKS.ember` constant; accent uniforms with owner approval of the shader hash; a `talk` state; `prepare(t)`; MASCOT.md update                                                                                                                                           | Orange is a first-class palette in the app |
| Render      | A GPU render host (`--browser-gpu`) or a shared Merc frame cache                                                                                                                                                                                                         | A full delivery render in under an hour    |
| Web kit     | A reusable toy kit: pitch canvas with target band, tone player, wave and interval ruler, keyboard strip, spiral, step deck, predict widget, retrieval quiz, sound gate                                                                                                   | Two lessons share it with no copy-paste    |
| App         | Data-only `/exercises/<slug>` entries per lesson; `pattern` and scale-type on launches; `ear-drill`, `zen` and `learn` launch kinds; a `?lesson=` marker that skips First Light and records attribution; Voice Mirror's "you matched an octave lower: same note" message | Every Season 1 CTA opens its drill         |
| App content | Fix the Learn chapters (band thresholds, "C minor's relative major is A major", "perfect pitch" wording) and card copy (Interval Trainer "above and below", Call & Response "rhythmic accuracy")                                                                         | No lesson contradicts the app              |
| Channel     | Channel art, playlist, trailer script, end-screen template, thumbnail template, analytics plan (§ 9)                                                                                                                                                                     | Ready to publish                           |

### Phase 2: Arc A, "Hear it" (Lessons 2 to 7 and the trailer; about 7 weeks)

One episode a week after the first two, each through the full pipeline and critic loop, each with
its web lesson and two Shorts. Launch batch: trailer and Lessons 1 to 3 together; then weekly.
Exit: seven episodes live, retrieval data on each page.

### Phase 3: Arc B, "Shape it" (Lessons 8 to 14; about 7 weeks)

Same cadence. Lesson 13 brings the Chladni plate and the spectrum; Lesson 14 a whole song (public
domain or original). Exit: Season 1 complete; the explorer shows the whole graph.

### Phase 4: measure and improve (continuous from launch)

Retrieval scores per question and per lesson (the learning metric); 30-second retention, average
view percentage and click-through (engagement); lesson-to-app conversions and seven-day return
(product). A/B tests: mascot presence in dense diagrams, feedback fading in the checkpoint, title
and thumbnail variants. Re-cut any episode whose retrieval scores lag.

### Phase 5: Season 2, "Read it, harmonise it"

The staff and rhythm reading, sight-singing with movable do, interval quality, minor properly, keys
and the circle of fifths, harmony singing, vibrato, agility, cadences and form, seventh chords, why
twelve notes (see CURRICULUM § 5).

### Per-episode timeline (from Lesson 3 on, with the kits in place)

| Day | Work                                                                                       | Gate                                                               |
| --- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| 1   | Brief, facts, script v1; script critic; voice                                              | Facts complete; every orange line is a question or a sincere guess |
| 2   | Storyboard and handoffs; critic and verification rounds; Merc performances start rendering | Storyboard SHIP                                                    |
| 3-4 | Scenes built in parallel; lab stills and clips; integration                                | Every scene proven in its lab                                      |
| 4-5 | Full-film critic loop; mix; captions; Shorts; thumbnail                                    | Film SHIP and measured quality bar                                 |
| 5   | Web lesson from the toy kit; app-check at phone and desktop                                | Page QA passes; links open their drills                            |
| 6   | Owner review; publish                                                                      |                                                                    |

## 8. Roles

| Role                                                        | Owns                                                                                   |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Series director (owner, with Claude as production director) | The brief, the bar, final approval                                                     |
| Writer                                                      | Script and lesson copy, in the brand voice and the playbook                            |
| Fact checker                                                | Every line of FACTS.md against code, standards or primary research                     |
| Vocal coach                                                 | Voice lessons' exercises and safety copy (PRODUCT.md already expects a coach's review) |
| Voice cast                                                  | Blue and orange                                                                        |
| Motion builders                                             | Scenes, from the storyboard and the kit                                                |
| Independent critic                                          | A fresh motion-critic per round; never the builder                                     |
| Audio                                                       | The mix, the stings, the examples' timbres                                             |
| Web builder                                                 | The lesson page from the toy kit                                                       |
| QA                                                          | The app-check sweep at phone and desktop; captions; accessibility                      |

## 9. Measurement

| Kind       | Metric                                                                                      | Target for Season 1                                       |
| ---------- | ------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Learning   | Share of first-try correct answers on the three page questions; again at the next visit     | 70 % first try; 80 % after review                         |
| Engagement | YouTube viewers remaining at 30 s; average view percentage                                  | Above the channel median after five episodes              |
| Product    | Lesson-page practise-link clicks; first sung note in the app within a day; seven-day return | Tracked from launch; targets set after four weeks of data |
| Craft      | Critic rounds to SHIP; factual corrections after publishing                                 | Three or fewer; zero                                      |

Judge lessons by retrieval, not by "that was so clear": fluency inflates perceived learning.

## 10. Risks

| Risk                                                                                                    | Mitigation                                                                                    |
| ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| CPU-only rendering is slow (Merc about 1 s a frame)                                                     | GPU host in Phase 1; Merc performances cached; drafts at low quality                          |
| Voice licensing (ElevenLabs plan terms undocumented; Kokoro trained partly on synthetic audio)          | Owner confirms terms; human actors as the fallback; keep the per-line manifest                |
| Character drift (four Mercs in the repo)                                                                | The canon decision (D2) and the bible                                                         |
| Claims errors in a teaching series                                                                      | FACTS.md per lesson, critic rounds that check truth, the playbook's claims rules              |
| Content ID claims on melodies                                                                           | Public-domain or original tunes only; everything synthesised                                  |
| Interactive pages are expensive and break over time                                                     | One shared toy kit; interactivity only where it explains                                      |
| Premium positioning conflict (`docs/plans/premium.md`: pitch training never premium; safety never paid) | Lessons free as the top of the funnel; premium stays the Merc practice rooms (owner decision) |
| First-time visitors from a lesson see onboarding first                                                  | The `?lesson=` marker in Phase 1, or embrace First Light for Lesson 1                         |
| Builders produce uneven quality                                                                         | The shared kit, the build guide, handoff frames, and a critic that never saw the build        |

## 11. Lesson 1: what exists now

- Durable sources in this repo: [`lessons/01-what-is-a-note/`](lessons/01-what-is-a-note/) (brief,
  facts, script with timings, storyboard, handoffs, the written lesson, the ledger and decisions).
- The film project: `output/motion/lesson-01/` (gitignored, per the motion pipeline's house rules;
  its tools and scene kit are the seed of the Phase 1 film kit).
- The web lesson and explorer: a published artifact page (link in the session report), with the
  episode embedded.

## 12. Owner decisions

1. Orange Merc's name, pronouns and voice; confirm the D2 voice's commercial terms.
2. Where durable film sources live (compositions and tools): a private repository, the
   `<user-dotfiles>/mercurypitch/` convention, or promoted into this repo as a kit.
3. Free or premium: are the lessons the free top of the funnel?
4. 60 fps with Merc on twos, or 30 fps throughout; 1080p or 4K delivery.
5. British or American English for narration (the exercise locale is en-GB; the UI moved to US
   spelling in 0.9.18).
6. Whether the in-app lessons live in Learn chapters, the Ascent, or a new Lessons surface.
7. Self-host the episode on the lesson page, or embed YouTube.
8. A vocal coach to review the voice lessons before production.
