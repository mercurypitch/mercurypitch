# Find Your Pitch: the hosts

Blue Merc and orange Merc host every episode and every lesson page. This is their bible: who they
are, how they look, sound and behave, and how they are produced.

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

|              | Blue Merc                                                                   | Orange Merc                                                                                                                            |
| ------------ | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Job          | Teaches. A kind expert who explains, demonstrates and sings the model note  | Learns alongside the viewer. A smart friend who voices the intuitive guess and asks why                                                |
| Lines        | Plain words, one idea per sentence, verbs over adjectives (the brand voice) | Only deep questions ("why", "how", "what if"), sincere wrong guesses, or re-explanations in their own words. No filler ("wow", "cool") |
| Musical part | Sings the reference note (lower register in Lesson 1, A3)                   | Sings back, often an octave higher (A4), showing that octave matches count                                                             |
| Colour       | Signal Blue `#58a6ff` is blue Merc's note everywhere                        | `#ff7448` is orange Merc's note everywhere                                                                                             |

The pairing follows the strongest evidence in the research: a tutor-student dialogue that voices
and refutes a misconception beat a clear lecture (Muller et al. 2008), and it works only when the
learner character asks deep questions (Craig et al. 2006). Rules: blue never mocks a guess; orange
is visibly puzzled, then gets it; neither ever calls a singer wrong, bad or failed (the lines are
about the sound, never the singer, as the app's own Merc lines rule).

## 3. Looks

- **Blue Merc**: the shipped palette (`src/lib/merc/constants.ts` `PALETTE`): aqua base `#04ecd8`
  through azure and indigo to a violet crown `#be6cf5`, blue bead feet, silver rim.
- **Orange Merc**: the same body and rig with a warm gradient: gold base `#ffd84d`, orange belly
  `#ff7448` (the stats site's warm accent), rose crown `#ff86b8`, amber feet. Applied with
  `setLook()` (uniforms only). The shader also hard-codes some cool light: the floor pool, foot
  streaks, landing rings, sound arcs, key light, hot core, eye crescent. For Lesson 1 those are
  swapped to amber at build time in the film's own bundle
  (`output/motion/lesson-01/tools/build-merc.mjs`), without touching the app. The proper fix is in
  § 7.
- Both read well on Obsidian `#0d1117` (orange's darkest stop 3.6:1, blue's 2.8:1; the bodies are
  not text).
- Framing: `front` for teaching, `hero` for personality, custom views for camera moves; idle Merc
  fills about 56 % of his canvas height; feet sit at 0.81 of the canvas height in the front view.

## 4. Voices

|                             | Blue Merc                                                                                                                                                                                                                                                                                                                                        | Orange Merc                                                                                                                                                            |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Speaking (final)            | The owner-approved ElevenLabs voice "Merc V1 Gentle Whimsical D2" (`B4fBPRmasEsTgd6YlSok`, `eleven_v3`, chosen 2026-09-20; brief: "soft and androgynous ... a friendly encouraging coach"). Needs an API key and a check of the plan's commercial rights                                                                                         | To cast. The unsaved Voice Design auditions "Grounded Wry" and "Bright Playful" (`art/glass-adventure/voice/v1`) are the most distinct from D2; or a human voice actor |
| Speaking (Lesson 1 scratch) | Local Kokoro-82M (Apache-2.0), voice `am_michael`                                                                                                                                                                                                                                                                                                | Kokoro `af_heart`                                                                                                                                                      |
| Singing                     | Never text-to-speech singing (it failed the pitch check in the Glassworks v7 songbook). Lesson 1 uses the Echo "ooh" sample set (`src/features/echo/voice`, development placeholders, measured 220.0 and 439.6 Hz) and the app's synthesised Merc "ooh" (`src/lib/demo-audio.ts` timbre: the same partials, lowpass, vibrato 5.5 Hz, +-14 cents) | Same sources, an octave up                                                                                                                                             |

The research is clear that human voices rate higher for engagement, and that the gesture benefit
of an on-screen agent appears only with a human voice (Mayer and DaPra 2012). Re-voicing Lesson 1
with the final cast is a Phase 1 task; the cue pipeline re-times the whole film from the new
recordings automatically.

## 5. Behaviour on screen

Mascots act; they don't decorate (Wang et al. 2018; Moreno et al. 2001):

- A Merc is on screen to ask, react, sing or point. During dense diagrams the Mercs leave or sit
  small at the edge, and come back to react.
- Blue looks at and points (his nub) at the element being explained; orange looks at blue when
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
- **Cost.** On a 4-core CPU with SwiftShader a 420 to 560 px Merc costs about 1 to 2.5 s per frame
  at `medium` (a 1080 px square: 2.1 s medium, 8 s high). On a GPU it is about 1 ms. So films
  pre-render each Merc performance once.
- **Passes.** `tools/merc-pass.mjs` renders each performance to two VP9 WebM files: a matte (black,
  Merc's alpha) and an additive light pass (his premultiplied colour on black). The composition
  stacks them (normal, then `mix-blend-mode: plus-lighter`), which rebuilds the browser's own
  composite exactly, bloom and floor light included (a straight-alpha export would lose them).
- **Performances from the script.** `tools/merc-shots.py` turns the narration cue sheet into each
  pass: he sings on his sung cues, talks on his lines (mouth from the line's loudness envelope),
  listens while the other speaks, idles otherwise, with moods (celebrate) on named cues. A
  re-voiced line re-times every Merc automatically.
- **Web pages.** The same bundle runs live in the browser (one WebGL context per Merc, `medium`
  quality on phones, destroyed off screen; capture mode can be scroll-scrubbed).

## 7. Engineering backlog (Merc in the app)

| #   | Item                                                                                                                                                                                                                    | Size     | Touches the pinned shader hash? |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------------------------------- |
| 1   | Export the orange look as a constant (`LOOKS.ember` in `constants.ts`) so web, app and film share one source                                                                                                            | small    | no                              |
| 2   | Accent uniforms for the floor pool, rings, arcs, dots, arrow, droplets, core, nub, glints and key light, defaulting to today's values; prove blue pixel-identical; owner approval; update `scene-shader.test.ts` hashes | medium   | yes                             |
| 3   | A `talk` state: mouth shapes from a speech envelope, small nods and blinks (today `sing` with arcs off is the stopgap)                                                                                                  | medium   | possibly                        |
| 4   | Presenter gestures: mirrored point (the nub is one-sided), nod, wobble ("encouraging"), look at the other Merc                                                                                                          | medium   | no for choreography             |
| 5   | A screen-projection helper (`screenOf(worldPoint, view, size)`) so graphics land on his nub or feet in any view                                                                                                         | small    | no                              |
| 6   | A non-drawing `prepare(t)` so crossing a cue in capture mode skips the throwaway draw                                                                                                                                   | small    | no                              |
| 7   | A GPU render host (`hyperframes render --browser-gpu`) or a shared Merc frame cache for delivery renders                                                                                                                | ops      | no                              |
| 8   | Real sung recordings to replace the placeholder Echo samples                                                                                                                                                            | external | no                              |
| 9   | Update `docs/branding/MASCOT.md`                                                                                                                                                                                        | small    | no                              |

## 8. Owner decisions

- Orange Merc's name, pronouns and voice. (This plan avoids inventing them: the user's own words
  are "blue and orange Merc".)
- Confirm the ElevenLabs plan covers commercial YouTube use of the D2 voice.
- Whether orange Merc becomes a first-class palette in the app (backlog items 1 and 2).
