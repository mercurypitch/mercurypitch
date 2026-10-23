# Find Your Pitch: the hosts

Merc, the blue one, and Tavi, the orange one, named from Octavia because she sings an octave above
him, host every episode and every lesson page. Their bible: looks, voices, behaviour, production.

## 1. Canon

The repository holds four different Mercs:

- the WebGL2 resin droplet (`src/lib/merc`, a raymarched shader), the **current mascot**, made for
  the premium exercise rooms;
- painted plates of the same design (onboarding, for example
  `public/onboarding/merc-first-light-v2-wide.webp`);
- the **old mascot**: a pastel sprite with closed eyes (Beside Cue journey,
  `apps/beside-cue/public/games/journey/merc-singing.webp`);
- a silver iridescent 3D Merc with hands (Glassworks).

**The series uses only the WebGL2 resin Merc**, confirmed by the owner as the new mascot. He is the
most expressive, he renders deterministically frame by frame, and his look is code the company owns.
Never use the old sprite or the Glassworks Merc in the series. The onboarding plates may serve as
reference for his look and world (night sky, low violet mist, a glossy floor with his reflection),
not as footage. Mixing in the others would break continuity (the 3D one even has hands).

`docs/branding/MASCOT.md` still describes an SVG mascot that never shipped and links a missing
`mascot-explorations.html`; it should be updated to point here and to `src/lib/merc`.

## 2. Roles

|              | Merc                                                                                                                                                 | Tavi                                                                                                                                                  |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Job          | Teaches. A kind expert who explains, demonstrates and sings the model note                                                                           | Learns alongside the viewer. A smart friend who voices the intuitive guess and asks why                                                               |
| Lines        | Plain words, one idea per sentence, verbs over adjectives (the brand voice)                                                                          | Only deep questions ("why", "how", "what if"), sincere guesses (wrong, or half right), or re-explanations in her own words. No filler ("wow", "cool") |
| Musical part | Sings the reference note (lower register in Lesson 1, A3)                                                                                            | Sings back, often an octave higher (A4), showing that octave matches count                                                                            |
| Colour       | Signal Blue `#58a6ff` is Merc's note in explanatory diagrams; on a pitch canvas his sung model note is the app's amber target band (MASTER-PLAN § 5) | `#ff7448` is Tavi's note in explanatory diagrams; on a pitch canvas the app's own canvas colours apply (MASTER-PLAN § 5)                              |

The pairing follows the strongest evidence in the research: stating a misconception and refuting
it beat a clear exposition, whether it was narrated (d = 0.79) or played as a tutor-student
dialogue (d = 0.83; Muller et al. 2008). The gain is the refutation, not the second character:
Tavi is how we voice it, and her deep questions (Craig et al. 2006) are what make a
dialogue pay. Rules: Merc never mocks a guess; Tavi is visibly puzzled, then gets it; neither
ever calls a singer wrong, bad or failed (the lines are about the sound, never the singer, as the
app's own Merc lines rule).

## 3. Looks

- **Merc**: the shipped palette (`src/lib/merc/constants.ts` `PALETTE`): aqua base `#04ecd8`
  through azure and indigo to a violet crown `#be6cf5`, blue bead feet, silver rim.
- **Tavi**: the same body and rig with a warm gradient: gold base `#ffd84d`, orange belly
  `#ff7448` (the stats site's warm accent), rose crown `#ff86b8`, amber feet. Applied with
  `setLook()` (uniforms only). The shader also hard-codes some cool light: the floor pool, foot
  streaks, landing rings, sound arcs, key light, hot core, eye crescent. For Lesson 1 those are
  swapped to amber at build time in the film's own bundle
  (`output/motion/lesson-01/tools/build-merc.mjs`), without touching the app. The proper fix is in
  § 7.
- Both read well on Obsidian `#0d1117` (orange's darkest gradient stop `#d42a5c` 3.9:1, blue's
  `#5133f3` 2.8:1; the bodies are not text).
- **Bodies are not signals.** The series colour code (MASTER-PLAN § 5) governs marks, labels and
  glows, not the hosts' bodies: Tavi's gold base is body colour, never a signal, even though
  gold `#ffd84d` means "the fit" on a diagram. Both bodies are in the palette the colour-blindness
  gate checks (MASTER-PLAN § 5).
- Framing: `front` for teaching, `hero` for personality, custom views for camera moves; idle Merc
  fills about 56 % of his canvas height; feet sit at 0.81 of the canvas height in the front view.

## 4. Voices

|                            | Merc                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Tavi                                                                                                                                                                                                                                                                                                                        |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Speaking (final)           | The owner-approved ElevenLabs voice "Merc V1 Gentle Whimsical D2" (`B4fBPRmasEsTgd6YlSok`, `eleven_v3`, chosen 2026-09-20; brief: "soft and androgynous ... a friendly encouraging coach"). Voices Lessons 1 and 2 from October 2026; the owner holds its rights (MASTER-PLAN § 12 item 1)                                                                                                                                                                                                                 | The owner-chosen ElevenLabs voice "Orange Merc" (`p2JfZCXWY245UrEylK7q`, `eleven_v3`, chosen 2026-10-17 from a new Voice Design session), saved in a second workspace of the owner's account, apart from D2. The earlier auditions "Grounded Wry" and "Bright Playful" (`art/glass-adventure/voice/v1`) stay as a reference |
| Speaking (scratch, drafts) | Local Kokoro-82M (Apache-2.0), voice `am_michael`                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Kokoro `af_heart`                                                                                                                                                                                                                                                                                                           |
| Singing (Lesson 1)         | Never text-to-speech singing (it failed the pitch check in the Glassworks v7 songbook). His sung notes are the Echo "ooh" sample set (`src/features/echo/voice`, measured 220.0 and 439.6 Hz): development placeholders, ElevenLabs takes re-pitched onto exact contours, which the app keeps out of its store build (`src/features/echo/merc-voice-set.ts`). The sung tune uses the app's synthesised Merc "ooh" (`src/lib/demo-audio.ts` timbre: the same partials, lowpass, vibrato 5.5 Hz, +-14 cents) | Same sources, an octave up                                                                                                                                                                                                                                                                                                  |
| Singing (final)            | Real or licensed sung "ooh" sets, or the synthesised demo-audio "ooh" if the rights to the ElevenLabs-derived Echo samples are not confirmed before any public release (owner decision 1; Phase 1 Voices track)                                                                                                                                                                                                                                                                                            | Its own real or licensed set, or the same synthesised "ooh" an octave up                                                                                                                                                                                                                                                    |

The research is clear that human voices rate higher for engagement, and that the gesture benefit
of an on-screen agent appears only with a human voice (Mayer and DaPra 2012), so the final cast is
human or the most natural voice available (playbook rule 14); the synthetic D2 is a trade-off
against that evidence. Re-voicing Lesson 1 with the final speaking and singing voices is a Phase 1
task (the Voices track; the same pass changes the film's "Hum it back" to "Sing it back, or hum
along" and adds a short spoken promise after the title sting, MASTER-PLAN § 4.1); the cue
pipeline re-times the whole film from the new recordings automatically.

## 5. Behaviour on screen

Mascots act; they don't decorate (Wang et al. 2018; Moreno et al. 2001):

- A Merc is on screen to ask, react, sing or point. During dense diagrams Merc and Tavi leave or sit
  small at the edge, and come back to react.
- Merc looks at and points (his nub) at the element being explained; Tavi looks at Merc when
  asking.
- While a Merc speaks, his mouth follows the line's loudness (`sing` state driven by the speech
  envelope, sound arcs off); while he sings, the arcs show.

State vocabulary (`src/lib/merc/constants.ts`), and what each is for in a lesson:

| State          | Use                                                                               |
| -------------- | --------------------------------------------------------------------------------- |
| `idle`         | Waiting, breathing, blinking; never during explanation for long                   |
| `listen`       | While the other Merc or the viewer sings: leans in, sound arcs arrive             |
| `sing`         | Singing a note (mouth by loudness, stretch by pitch) and, with arcs off, speaking |
| `lock`         | Holding a note in tune: the glow builds                                           |
| `hum` / `ride` | Humming; riding a glide (sirens, slides)                                          |
| `hop`          | Moving between places; jumping notes                                              |
| `climb`        | "Higher": crouch, rise, hover                                                     |
| `celebrate`    | A success; sparkles on every second jump (fan them away from the other Merc)      |
| `point`        | Pointing with the nub at the content                                              |
| `drop`         | An entrance (falls in and splats)                                                 |
| `sleep`        | Rest, end of a session                                                            |

## 6. Production

- **Renderer.** `src/lib/merc` has no dependencies; it bundles to a 70 KB IIFE with esbuild. In
  capture mode (`mount(..., { capture: true, continuous: true })`, `renderAt(t)`) every frame is a
  pure function of the state score, the voice, the view and time: verified bit-identical in
  HyperFrames' headless Chrome.
- **Cost.** On a 4-core CPU with SwiftShader at `medium`, a Merc frame costs from about a quarter
  of a second at 225 px to about a second at 480 px, and up to four times that when the CPU is
  shared (the Lesson 1 render log, `merc/render.log`, where one 315 px re-run took 2132 ms a frame
  against 536 ms unshared; the measured table is in [PRODUCTION-PIPELINE.md](PRODUCTION-PIPELINE.md)).
  On a desktop GPU the app's own timing note (`src/lib/merc/constants.ts`, beside `QUALITY`) puts a
  1024 px frame at about 1 ms at `high` and about 0.3 ms at `medium`. So films pre-render each Merc
  performance once.
- **Passes.** `tools/merc-pass.mjs` renders each performance to one straight-alpha VP9 WebM
  (`<id>-merc.webm`) with alpha = max(A, R, G, B) over his premultiplied colour, so his bloom and
  floor light survive and he composites correctly in any moved, scaled or faded layer. The ffmpeg
  graph forces `format=rgba` (left to negotiate, ffmpeg once dropped the alpha). Each scene holds
  static `<video data-merc>` tags, timed from the cue sheet by `tools/merc-tags.py`. The earlier
  matte plus `plus-lighter` light-pass pair is abandoned: CSS blends only within its stacking
  context, so inside any transformed or faded layer it turned into a black square.
- **Performances from the script.** `tools/merc-shots.py` turns the narration cue sheet into each
  pass: he sings on his sung cues, talks on his lines (mouth from the line's loudness envelope),
  listens while the other speaks, idles otherwise, with moods (celebrate) on named cues. A
  re-voiced line re-times every Merc automatically.
- **Web pages.** The same bundle runs live in the browser (one WebGL context per Merc, `medium`
  quality on phones, paused with `setPaused(true)` or destroyed off screen; capture mode can be
  scroll-scrubbed). His idle loop freezes under `prefers-reduced-motion` and with the page's
  visible "Pause animations" toggle (WCAG 2.2.2).

## 7. Engineering backlog (Merc in the app)

MASTER-PLAN § 7 schedules items 1, 2, 3, 6 and 9 in the Phase 1 Merc track, item 7 in the Render
track and item 8 in the Voices track; items 4, 5 and 10 are not scheduled yet.

| #   | Item                                                                                                                                                                                                                                                                                                                                                                                 | Size     | Touches the pinned shader hash? |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- | ------------------------------- |
| 1   | Export the orange look as a constant (`LOOKS.ember` in `constants.ts`) so web, app and film share one source                                                                                                                                                                                                                                                                         | small    | no                              |
| 2   | Accent uniforms for the floor pool, rings, arcs, dots, arrow, droplets, core, nub, glints and key light, defaulting to today's values; prove blue pixel-identical; owner approval (MASTER-PLAN § 12 item 10); update `scene-shader.test.ts` hashes                                                                                                                                   | medium   | yes                             |
| 3   | A `talk` state: mouth shapes from a speech envelope, small nods and blinks (today `sing` with arcs off is the stopgap)                                                                                                                                                                                                                                                               | medium   | possibly                        |
| 4   | Presenter gestures: mirrored point (the nub is one-sided), nod, wobble ("encouraging"), look at the other Merc                                                                                                                                                                                                                                                                       | medium   | no for choreography             |
| 5   | A screen-projection helper (`screenOf(worldPoint, view, size)`) so graphics land on his nub or feet in any view                                                                                                                                                                                                                                                                      | small    | no                              |
| 6   | A non-drawing `prepare(t)` so crossing a cue in capture mode skips the throwaway draw                                                                                                                                                                                                                                                                                                | small    | no                              |
| 7   | A GPU render host (`hyperframes render --browser-gpu`) or a shared Merc frame cache for delivery renders                                                                                                                                                                                                                                                                             | ops      | no                              |
| 8   | Final sung "ooh" sets for Merc and Tavi to replace the ElevenLabs-derived Echo placeholders: real or licensed recordings (F2 to F5 at least, as the Echo set spans), or the synthesised demo-audio "ooh" (`src/lib/demo-audio.ts`) declared final. Phase 1 Voices track; owner decision 1                                                                                            | external | no                              |
| 9   | Update `docs/branding/MASCOT.md`                                                                                                                                                                                                                                                                                                                                                     | small    | no                              |
| 10  | Fix the one-frame black crescent along the crown at the top of a fast stretch (hop take-off, celebrate), seen at medium and high quality in 5 of Lesson 1's 17 passes. The film works round it (`merc-pass.mjs` re-renders a flagged frame at a nudged time); the app shows it on every hop, hidden only by its dark background. Reproduce with `merc/shots/m10-blue.json`, frame 46 | medium   | yes                             |

## 8. Owner decisions

MASTER-PLAN § 12 is the single register of what waits for the owner. The items that concern the
hosts:

- **Item 1.** Decided (23 October 2026): orange Merc is Tavi, from Octavia, as she sings an octave
  above Merc; she. This overtakes 22 October's "unnamed, with no pronoun" (the voice is cast, § 4).
  Decided (16 October 2026): the owner holds the rights to the ElevenLabs voices, which covers
  commercial YouTube use of the D2 voice and Merc's sung notes, Lesson 1's ElevenLabs-derived
  placeholders that the app keeps out of its store build (`src/features/echo/merc-voice-set.ts`):
  they stay for now, and a voice actor replaces them later.
- **Item 10.** Orange Merc as a first-class palette in the app (backlog items 1 and 2), with the
  pinned shader hash its accent uniforms need. Decided (22 October 2026): after Season 1.
