---
version: 1
slug: "src-features-voice-history-voicehistorypage-tsx"
primary_target: "src/features/voice-history/VoiceHistoryPage.tsx"
related_targets: ["src/App.tsx","src/features/challenges/ChallengeResultCard.tsx","src/features/challenges/WeeklyLegendHero.tsx","src/features/glass/GlassApp.tsx","src/features/exercises/ExerciseShell.tsx","src/features/exercises/use-base-exercise.ts","src/features/home/DestinationGallery.tsx"]
---

# Voice history surface brief

- Scope and mode: in-app Operate surface for local voice-take history,
  practice threads, playback, management, and Earlier/Later comparison.
- Audience and job: a returning singer wants to keep a meaningful Glass,
  Exercise, or Weekly Legend take, find it after reload, and hear an older take
  beside a newer take from the same practice context without uploading audio.
- Primary task and proof: comparable contexts lead; two real local recordings
  unlock an immediate A/B switch. Storage, export, and delete make the privacy
  promise inspectable rather than decorative copy.
- Direction: inherit MercuryPitch's dark app shell and focused Pitch Studio
  language. Compose the first viewport as a listening desk: context/thread rail
  on the left and a large active comparison field on the right, collapsing to
  one continuous column on phones. Avoid a flat voice-memo grid.
- Memorable moment: Earlier/Later share one waveform scale; switching the
  selected side moves a single luminous playhead and never overlaps audio.
- Constraints: metadata and audio load separately; cached peak buckets only;
  keyboard/touch complete; reduced motion; honest unsupported, empty, quota,
  decode, and delete states; local audio never makes a network request.
- Unresolved: final public name, navigation label, and future cloud-sync
  commercial details. Internal route and data names stay neutral.
