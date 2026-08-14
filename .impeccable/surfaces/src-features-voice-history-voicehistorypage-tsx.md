---
version: 1
slug: 'src-features-voice-history-voicehistorypage-tsx'
primary_target: 'src/features/voice-history/VoiceHistoryPage.tsx'
related_targets:
  [
    'src/App.tsx',
    'src/features/voice-history/GuidedVoiceCheck.tsx',
    'src/features/voice-history/GuidedPitchCentreCanvas.tsx',
    'src/features/voice-history/GuidedVoiceCheck.module.css',
    'src/features/voice-history/FreeformVoiceRecorder.tsx',
    'src/features/exercises/ExerciseShell.tsx',
    'src/features/exercises/pitch-hold/PitchHoldExercise.tsx',
  ]
---

# Voice history surface brief

- Scope and mode: in-app Operate surface for local voice-take history plus one
  bounded guided Pitch Centre assessment, its evidence-linked Focus reading,
  prescribed practice, exact matched retake, and longitudinal comparison.
- Audience and job: a singer wants useful feedback without uploading their
  voice or receiving a medical/composite score. They should hear an authored
  target, complete three comfortable exact-register landings, report effort,
  inspect the specific moments behind one positive observation and one focus,
  keep explicitly, practise a short reviewed dose, and return to the same
  saved reading before deciding whether to check again.
- Primary task and proof: the guided route produces a local, denominator-visible
  reading only after comfort and signal gates pass. Evidence markers seek
  without autoplay. The first kept Focus Take remains on its result until the
  singer leaves; two valid compatible takes unlock Twin Trails and three unlock
  Practice Loom. Malformed guided metadata remains manageable but never enters
  comparison.
- Direction: inherit MercuryPitch's dark app shell and focused Pitch Studio
  language. Compose the first viewport as a listening desk: context/thread rail
  on the left and a large active comparison field on the right, collapsing to
  one continuous column on phones. Avoid a flat voice-memo grid.
- Memorable moment: a dark, instrument-like canvas layers relative input energy
  under a bright exact-register pitch trail; one or two restrained evidence
  beacons take the playhead directly to what the reading describes, without
  starting audio. On phones, all guidance and result actions live in the app's
  regular bottom drawer while the voice map remains visible behind it.
- Constraints: local dry audio only; explicit keep/discard; no symptom details
  persisted; no medical claims; no octave folding or composite score; required
  quality facts fail closed; post-capture discomfort overrides acoustic output;
  exact protocol and complete recommendation contract survive practice/return;
  keyboard/touch complete; reduced motion; no network request for audio.
- Visual hierarchy: one primary canvas, one compact contextual inspector, and
  one dominant action per state. Quiet labels carry provenance; large text is
  reserved for the task, current phase, and the single Focus reading. Avoid
  dashboards, metric grids, celebratory scoring, decorative gradients outside
  the canvas, and competing button weights.
- Responsive contract: desktop uses canvas plus sticky inspector; mobile keeps
  the canvas inline and moves briefing, controls, effort, reading, and recovery
  into the standard Sheet bottom drawer. Touch targets are at least 44px, the
  drawer scrolls independently, and Space controls replay even while the
  ordinary drawer is open but never while confirmation or text entry owns it.
- Unresolved: final public name, navigation label, and future cloud-sync
  commercial details. Internal route and data names stay neutral.
