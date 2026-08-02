# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

MercuryPitch serves singers who want immediate visual feedback while practising
pitch, songs, and vocal exercises in a browser. Returning singers also need a
trustworthy way to hear how their voice changes across practice sessions. The
product also serves vocal coaches and administrators who author guided
exercises and multi-week practice journeys.

## Product Purpose

MercuryPitch helps people understand and improve their singing through
real-time pitch visualisation, configurable targets, scored practice, and
reviewable attempts. Success means a singer can begin practising quickly,
understand what to sing, see how their voice moved, and compare useful past
attempts. Pitch-only practice remains useful without retaining audio; when a
singer explicitly keeps a voice take, they can also hear an Earlier/Later
comparison without uploading it.

## Positioning

MercuryPitch combines private on-device vocal pitch detection, song and
separated-stem practice, editable pitch targets, reusable guided vocal
exercises, and an optional local voice history in one browser-based practice
environment. Progress is something singers can both see in honest metrics and
hear in their own recordings.

## Operating Context

- Singers practise with a microphone on desktop or mobile, often in short repeated phrases.
- Free practice may have no target melody; guided practice loads an authored exercise specification.
- Exercises can be opened independently or launched from an Ascent journey step.
- Administrators author reusable exercises and attach them to challenges or journey steps.
- A short example recording teaches pronunciation and intended tone before practice begins.
- Voice-history users explicitly keep short takes, revisit them on the same
  device, and compare recordings from equivalent practice contexts.
- The in-app voice-history capability is currently explored under the working
  hook and name **Hear Yourself**. It is part of MercuryPitch, not a standalone
  campaign experience.

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
- The voice-history foundation is a local take vault. Saving a take is an
  explicit user action; audio is not uploaded in the first release.
- Singers can start multiple self-chosen practice threads directly in Hear
  Yourself, rename those freeform threads, and keep adding takes to any one of
  them. They can review a dry temporary recording and keep or discard it
  explicitly; keeping another take in the same thread unlocks Earlier/Later
  comparison.
- Voice history and comparison work while signed out and without a configured
  backend.
- Future cloud sync is opt-in portability for signed-in users. New users will
  receive a limited free storage allowance; additional cloud capacity will be
  paid. Allowance sizes, pricing, retention policy, and launch timing remain
  open decisions.
- Cloud sync is not audio sharing. Public or community audio requires a
  separate privacy, moderation, and abuse-prevention decision.
- **Hear Yourself** and **Voice Mystery** are working language, not locked
  public names.

## Brand Commitments

- The product name is MercuryPitch.
- The existing Stem Mixer Pitch Studio is the binding visual and interaction reference for Zen practice.
- Zen extends the established dark, focused Pitch Studio environment rather than adopting the white visual styling of the external exercise references.
- Product language is direct, calm, and instructional rather than competitive or judgmental.
- The voice-history capability lives inside MercuryPitch and strengthens the
  relationship between visual pitch feedback and self-listening.
- Privacy copy must distinguish local-only audio, optional synced audio, and
  public sharing plainly.
- Progress claims use real takes and compatible contextual metrics, never a
  fabricated composite “voice score.”

## Evidence on Hand

- Existing Pitch Studio implementation: `src/components/StemMixerPitchStudio.tsx`
- Existing pitch visual language: `src/features/stem-mixer/pitch-canvas-visuals.ts`
- Mobile exercise references: `/home/maff/Downloads/visual_tests/design_dir_exercises/`
- Prototype pronunciation and tone sample: `/home/maff/Downloads/visual_tests/design_dir_exercises/ExercisesDevelop.denoised-strong.mp3`
- Existing exercise, scoring, challenge, and journey implementations in `src/features/exercises/`, `src/features/challenges/`, and related database workers
- Mystery teaser: `src/features/home/DestinationGallery.tsx` and
  `public/home/hear-yourself-tease.webp`
- Existing local real-voice capture and playback:
  `src/features/glass/take-recorder.ts` and
  `src/features/glass/take-strip.tsx`
- IndexedDB, durable-write, quota, and persistent-storage patterns under
  `src/db/`
- No recorded user research, take-volume distribution, cloud-storage
  willingness-to-pay evidence, or finalized cloud allowance; future work must
  not invent these.

## Product Principles

- Keep the singer in the practice flow; controls and feedback should recede behind the live pitch experience.
- Preserve privacy by storing contours and scores without storing voice audio by default.
- Reuse one exercise definition from catalogue preview through briefing, live practice, scoring, and guided journeys.
- Make feedback actionable and specific without pretending to evaluate qualities the system cannot measure.
- Keep independent Zen practice open and exploratory while allowing Ascent to provide deliberate progression.
- Keep voice recording, saving, replay, and local comparison useful before
  signup.
- Treat comparison as the voice-history payoff and storage as supporting
  infrastructure.
- Keep capture surfaces connected to one practice history rather than creating
  isolated recording silos.
- Add cloud portability later without weakening the private local baseline.

## Accessibility & Inclusion

- Core practice controls must remain keyboard accessible and usable at mobile touch sizes.
- Canvas-only information needs equivalent labels or summaries for assistive technology.
- Motion and glowing effects must respect reduced-motion preferences.
- Exercises must transpose to an appropriate range instead of assuming one voice type.
- Voice-history states must cover microphone denial or loss, unsupported
  recording formats, storage denial or exhaustion, missing audio, and reduced
  motion.
- Take management and comparison must be operable with keyboard and touch,
  must not rely on colour alone, and must expose recording/playback state
  without requiring hearing.
