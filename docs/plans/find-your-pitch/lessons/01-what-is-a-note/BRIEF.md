---
workflow: motion-designer
flow: automation
storyboard: no
renders: pre-authorized
unattended: true
message: 'A note is a vibration; doubling its speed gives the same note an octave higher, so pitch is a spiral, not a line.'
audience: 'Adult and teen beginners who sing or want to, with no theory; YouTube viewers who like Veritasium and 3Blue1Brown'
destination: youtube, landing-page
aspect: 1920x1080
sizes: 1920x1080
length: 4m52s (narration-timed, cues.json total)
fps: 60
language: en-GB
project_dir: output/motion/lesson-01
---

# Brief

## Intent

- What the video is for: Lesson 1 of "Find Your Pitch", MercuryPitch's music theory and singing
  series. It is the proof episode for the whole series format: the first full concept explained
  visually, hosted by blue Merc and orange Merc. It also embeds in the web lesson page.
- Who is watching: beginners who think theory is hard, or who think they "can't sing". They care
  about understanding, not jargon. Many watch with the sound on (this is about sound), but the
  picture must still carry the idea with the sound off (captions on).
- What they should do at the end: answer three recap questions in their head, then try singing
  one note in MercuryPitch's Voice Mirror. On screen: "Practise it free: mercurypitch.com/mirror".
  Next episode tease: "Seven letters, twelve notes."

## Brand

- Name: MercuryPitch. Series: "Find Your Pitch".
- Logo files: `assets/brand/mark.svg`, `assets/brand/lockup-horizontal.svg` (copied from
  `docs/branding/logo/meniscus2/`, the only canonical source).
- Colours: Obsidian `#0d1117`, ink `#e6edf3`, ink-2 `#a8b3bf`, Signal Blue `#58a6ff`, Aqua
  `#2dd4bf`, Violet `#bc8cff`, chrome `#f4f8fd` to `#1b2430`. Lesson pair: blue Merc `#58a6ff`,
  orange Merc `#ff7448` (the stats site's warm accent). Gold `#ffd84d` for "the fit" highlights.
- Fonts (local, SIL OFL 1.1, licences in `assets/fonts/`): Outfit (display, numbers), Inter (small
  UI labels), Instrument Serif italic (the poetic voice: big ideas), JetBrains Mono (kickers,
  hertz readouts), Noto Music (clef and note glyphs, drawn as paths).

## Facts

- Facts file: `FACTS.md`, the only source for any number, name or claim on screen or in the voice.

## Assets

- `assets/merc-lib/merc-blue.js`, `merc-orange.js` - the app's own WebGL2 Merc (src/lib/merc),
  bundled read-only by `tools/build-merc.mjs`; orange is a palette plus a build-time warm swap of the
  shader's hard-coded cool light. Rendered to matte + light passes by `tools/merc-pass.mjs`.
- `assets/voice/*.wav` - scratch narration, local Kokoro-82M (Apache-2.0). Blue: `am_michael`,
  orange: `af_heart`. To be re-voiced with the final cast (see DECISIONS.md).
- Merc's sung notes: `src/features/echo/voice/echo-merc-ooh-57-A3.mp3`, `-69-A4.mp3`
  (development placeholders per `src/features/echo/merc-voice-set.ts`).
- Every musical example is synthesised at its exact frequency by `tools/mix.py`.
- Notation geometry and Noto Music glyph paths: the stats site kit, via the research snippets.

## Style references

None supplied as video. Mechanisms from `kit/business-motion-film/references/motion-grammar.md`
(persistent actor, continuous canvas, materialising result, foreground fly-through) and the
3Blue1Brown habit of one object that transforms into the next idea (line to spiral to piano).
Visual language: the MercuryPitch stats report (dev.stats.maff.app/mercurypitch): faint living
staves, chrome and spectrum type, mono kickers, Instrument Serif italic.

## Audio

- Music: none recorded. A quiet synthesised open-fifth pad in A (code), heard in act transitions
  and under the dressed pauses (predict, hum, quiz) and silent under narration and every listening
  example (playbook rule 12, coherence; updated after critic 03). Stings are synthesised chimes.
- Sound effects: synthesised in code (soft band-limited whooshes); the "effects" that matter are
  the musical examples themselves.
- Voiceover: yes, two characters (blue Merc teaches, orange Merc asks).

## Must never appear

- Claims not in FACTS.md; scoring claims about pronunciation; "wrong", "failed", "bad" about a
  singer; "tone deaf" as a label; emojis; any AI-assistant attribution.
- Merc saying a singer is bad. Merc lines are about the sound, never the singer.

## Notes

- Teaching film, not a launch film: pacing rules adapted in DECISIONS.md (reading holds with
  internal life are allowed where a diagram is being explained).
