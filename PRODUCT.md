# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

MercuryPitch serves singers who want immediate visual feedback while practising pitch, songs, and vocal exercises in a browser. It also serves vocal coaches and product administrators who author guided exercises and multi-week practice journeys.

## Product Purpose

MercuryPitch helps people understand and improve their singing through real-time pitch visualisation, configurable targets, scored practice, and reviewable attempts. Success means a singer can begin practising quickly, understand what to sing, see how their voice moved, and compare useful past attempts without recording or uploading their voice.

## Positioning

MercuryPitch combines private on-device vocal pitch detection, song and separated-stem practice, editable pitch targets, and reusable guided vocal exercises in one browser-based practice environment.

## Operating Context

- Singers practise with a microphone on desktop or mobile, often in short repeated phrases.
- Free practice may have no target melody; guided practice loads an authored exercise specification.
- Exercises can be opened independently or launched from an Ascent journey step.
- Administrators author reusable exercises and attach them to challenges or journey steps.
- A short example recording teaches pronunciation and intended tone before practice begins.

## Capabilities and Constraints

- Voice pitch detection and detailed practice contours run on-device.
- Zen practice progresses from left to right in bounded loops and retains up to 50 pitch-only attempts; microphone audio is not retained.
- The default visible pitch range is 24 semitones and remains stable during an attempt.
- Target notes can be hidden, dimmed, or shown. Free monitoring has no playhead; scored exercises may optionally show one.
- Exercise events independently define pitch, timing, and visible cue text such as `ng`, `mam`, `Nya`, or `Mah`.
- Exercise scoring may assess pitch, timing, coverage, and steadiness, but must not claim to assess pronunciation.
- Exercise content is configurable and versionable. The initial seed content is provisional and will be reviewed by a vocal coach.
- Example-audio delivery must be lazy, user initiated, and separate from microphone scoring.
- UK English (`en-GB`) is the initial exercise locale.

## Brand Commitments

- The product name is MercuryPitch.
- The existing Stem Mixer Pitch Studio is the binding visual and interaction reference for Zen practice.
- Zen extends the established dark, focused Pitch Studio environment rather than adopting the white visual styling of the external exercise references.
- Product language is direct, calm, and instructional rather than competitive or judgmental.

## Evidence on Hand

- Existing Pitch Studio implementation: `src/components/StemMixerPitchStudio.tsx`
- Existing pitch visual language: `src/features/stem-mixer/pitch-canvas-visuals.ts`
- Mobile exercise references: `/home/maff/Downloads/visual_tests/design_dir_exercises/`
- Prototype pronunciation and tone sample: `/home/maff/Downloads/visual_tests/design_dir_exercises/ExercisesDevelop.denoised-strong.mp3`
- Existing exercise, scoring, challenge, and journey implementations in `src/features/exercises/`, `src/features/challenges/`, and related database workers

## Product Principles

- Keep the singer in the practice flow; controls and feedback should recede behind the live pitch experience.
- Preserve privacy by storing contours and scores without storing voice audio by default.
- Reuse one exercise definition from catalogue preview through briefing, live practice, scoring, and guided journeys.
- Make feedback actionable and specific without pretending to evaluate qualities the system cannot measure.
- Keep independent Zen practice open and exploratory while allowing Ascent to provide deliberate progression.

## Accessibility & Inclusion

- Core practice controls must remain keyboard accessible and usable at mobile touch sizes.
- Canvas-only information needs equivalent labels or summaries for assistive technology.
- Motion and glowing effects must respect reduced-motion preferences.
- Exercises must transpose to an appropriate range instead of assuming one voice type.
