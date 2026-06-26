// ── Per-exercise help text ──────────────────────────────────────
//
// Beginner-friendly explanations shown in the collapsible "?" panel inside
// each exercise, and reused as the short card description in the menu.
// Singers new to vocal training don't know what "long note", "slide" or
// "vibrato" mean — `summary` is the one-liner, `body` is the gentle detail.

import type { ExerciseType } from './types'
import { EXERCISE_ARPEGGIO_JUMPER, EXERCISE_CALL_RESPONSE, EXERCISE_CHORD_STACKER, EXERCISE_DRONE_INTONATION, EXERCISE_DYNAMIC_SWELL, EXERCISE_INTERVAL_TRAINER, EXERCISE_LONG_NOTE, EXERCISE_MIRROR_MELODY, EXERCISE_PITCH_HOLD, EXERCISE_PITCH_PURSUIT, EXERCISE_ROUTINE_RUNNER, EXERCISE_SCALE_RUNNER, EXERCISE_SIGHT_SINGING, EXERCISE_SIREN, EXERCISE_SLIDE, EXERCISE_STACCATO, EXERCISE_VIBRATO, } from './types'

export interface ExerciseHelp {
  /** One-line summary shown in the idle area and the menu card. */
  summary: string
  /** Beginner-friendly detail shown in the "?" panel, as paragraphs. */
  body: string[]
}

export const EXERCISE_HELP: Record<ExerciseType, ExerciseHelp> = {
  [EXERCISE_LONG_NOTE]: {
    summary:
      'Hold a steady pitch as long as you can. Builds breath support and pitch stability.',
    body: [
      'A "long note" simply means singing one pitch and holding it without wavering. Pick a comfortable note, take a relaxed breath, and sustain it.',
      'Try to keep the sound even — same loudness, same pitch — like a held organ note. It is normal for the pitch to drift at first.',
      'You are scored on how steady you stay (less wobble is better), how little you drift away from the note, and how long you hold it.',
    ],
  },
  [EXERCISE_VIBRATO]: {
    summary:
      'Sustain a note with a gentle, even vibrato. Trains controlled pitch oscillation.',
    body: [
      'Vibrato is a small, regular "wave" in your pitch — the note rises and falls a little, many times per second. You hear it in most trained singers on long notes.',
      'Hold a comfortable note and let it gently pulse. Do not force it; a relaxed throat and steady breath let vibrato appear on its own.',
      'A natural vibrato is roughly 4-7 pulses per second with a modest width. You are scored on the rate, the depth of the wave, and how even it stays.',
    ],
  },
  [EXERCISE_SLIDE]: {
    summary:
      'Slide smoothly from one note to another. No scooping, no overshoot.',
    body: [
      'A "slide" (or glide) means moving your voice smoothly between two pitches — like a siren going up or down — without jumping or stepping.',
      'Start on the first note, then glide evenly to the second and land cleanly. Avoid scooping up from below or shooting past and falling back.',
      'Follow the moving guide dot: it travels up or down to show the path your pitch should trace. You are scored on smoothness, where you start and land, and your speed.',
    ],
  },
  [EXERCISE_PITCH_HOLD]: {
    summary: 'Lock onto a target pitch and hold it within a tight zone.',
    body: [
      'This is like Long Note but stricter: you must keep your pitch inside a narrow band around the target the whole time.',
      'Match the target, then hold as still as you can. Small, controlled breaths help you avoid drifting.',
      'You are scored on how long you stay inside the target zone.',
    ],
  },
  [EXERCISE_PITCH_PURSUIT]: {
    summary: 'Follow a moving target with your voice in real time.',
    body: [
      'A target moves up and down over time, and your job is to chase it with your pitch — matching it as closely as you can.',
      'Glide rather than jump, and watch ahead so you can anticipate where the target is going.',
      'You are scored on how closely your pitch tracks the moving target.',
    ],
  },
  [EXERCISE_MIRROR_MELODY]: {
    summary: 'Listen to a short melody, then sing it back from memory.',
    body: [
      'You will hear a short sequence of notes. After it finishes, sing the same notes back in order.',
      'Listen for the shape — which notes go up, which go down — not just the individual pitches.',
      'You are scored on how accurately your sung melody matches the one you heard.',
    ],
  },
  [EXERCISE_INTERVAL_TRAINER]: {
    summary: 'Sing the requested interval above or below a starting note.',
    body: [
      'An "interval" is the distance between two notes (for example, a fifth). You will be given a starting note and asked to sing a note a set distance away.',
      'Hum the starting note first to anchor yourself, then reach for the target interval.',
      'You are scored on how accurately you hit the requested interval.',
    ],
  },
  [EXERCISE_SCALE_RUNNER]: {
    summary: 'Sing up and down a scale, one note at a time, in tune.',
    body: [
      'A "scale" is a ladder of notes (like do-re-mi-fa-so...). You sing each step in order, ascending and/or descending.',
      'Keep an even pace and make each note land cleanly before moving to the next.',
      'You are scored on how in-tune each scale step is.',
    ],
  },
  [EXERCISE_ARPEGGIO_JUMPER]: {
    summary: 'Leap between the notes of a chord cleanly and in tune.',
    body: [
      'An "arpeggio" is a chord sung one note at a time, usually with bigger jumps than a scale (for example 1-3-5-8).',
      'Aim for each target directly instead of sliding up to it. Hearing the note in your head before you sing helps you land it.',
      'You are scored on how accurately you hit each note of the arpeggio.',
    ],
  },
  [EXERCISE_DRONE_INTONATION]: {
    summary:
      'Match and hold notes against a steady drone to train pure intonation.',
    body: [
      'A "drone" is a constant background note. You sing notes against it and listen for when the two sounds lock together and stop beating.',
      'Adjust tiny amounts until the sound feels smooth and "in tune" with the drone.',
      'The exercise runs in short rounds and scores how cleanly your notes sit against the drone.',
    ],
  },
  [EXERCISE_SIREN]: {
    summary: 'Glide your full range up and down like a smooth siren.',
    body: [
      'A "siren" is a long, smooth glide through your range — low to high and back — keeping the sound connected the whole way.',
      'Stay relaxed and let the pitch flow continuously without breaks or jumps between your low and high voice.',
      'You are scored on how smooth and connected the glide is.',
    ],
  },
  [EXERCISE_CALL_RESPONSE]: {
    summary: 'Hear a short phrase, then echo it back accurately.',
    body: [
      'You will hear a short musical "call". After it plays, sing your "response" — the same phrase back.',
      'Listen carefully to the whole phrase before responding, and match both the notes and their timing.',
      'The exercise runs in rounds and scores how closely your responses match each call.',
    ],
  },
  [EXERCISE_DYNAMIC_SWELL]: {
    summary:
      'Grow and shrink your volume on a held note while keeping pitch steady.',
    body: [
      'A "swell" (messa di voce) means starting soft, growing louder, then fading back — all on one steady pitch.',
      'The hard part is keeping the note in tune while the volume changes. Support the sound with steady breath.',
      'It runs in short rounds and scores your control over the volume curve and pitch.',
    ],
  },
  [EXERCISE_CHORD_STACKER]: {
    summary: 'Add notes one at a time to build a chord in tune.',
    body: [
      'You sing a sequence of notes that stack into a chord, each one tuned against the notes already sounding.',
      'Listen for each new note to "lock in" with the others before moving on.',
      'It runs in rounds and scores how in-tune each stacked note is.',
    ],
  },
  [EXERCISE_STACCATO]: {
    summary: 'Sing short, crisp, detached notes precisely on pitch.',
    body: [
      '"Staccato" means short, separated notes — quick and clean, with a tiny silence between each.',
      'Use light, controlled bursts of breath so each note starts exactly on pitch and stops cleanly.',
      'It runs in rounds and scores the precision and timing of your short notes.',
    ],
  },
  [EXERCISE_ROUTINE_RUNNER]: {
    summary: 'Run a guided warm-up routine of several drills in sequence.',
    body: [
      'This chains a few exercises together into one guided warm-up so you can run through a full routine in one go.',
      'Follow the on-screen prompts for each step; pick a comfortable key to start.',
      'Your overall routine performance is scored across the steps.',
    ],
  },
  [EXERCISE_SIGHT_SINGING]: {
    summary: 'Read notes from a staff and sing them at sight.',
    body: [
      '"Sight-singing" means singing music you are reading for the first time, straight from the notation.',
      'Find your starting note, then read ahead one note at a time, singing the pitches shown on the staff.',
      'You are scored on how accurately you sing the written notes.',
    ],
  },
}
