// ============================================================
// The Ascent — guided-path content (data, not code)
// ============================================================
//
// One path = an ordered list of themed weeks (the celestial orbs). Each
// week binds the in-app exercises its daily sessions should favour, plus
// authored focus/goal copy and curated external resources. The 7-theme
// cycle follows standard vocal pedagogy (SOVT warm-ups first, tone &
// vibrato last, a recovery week to close) — see the guided-path plan.
//
// Resource links are curated by hand (official uploads only) in the
// content pass; an empty list simply hides the section in the UI.

import type { ExerciseType } from '@/features/exercises/types'
import { EXERCISE_ARPEGGIO_JUMPER, EXERCISE_CALL_RESPONSE, EXERCISE_DRONE_INTONATION, EXERCISE_DYNAMIC_SWELL, EXERCISE_INTERVAL_TRAINER, EXERCISE_LONG_NOTE, EXERCISE_MIRROR_MELODY, EXERCISE_PITCH_HOLD, EXERCISE_SCALE_RUNNER, EXERCISE_SIGHT_SINGING, EXERCISE_SIREN, EXERCISE_SLIDE, EXERCISE_STACCATO, EXERCISE_VIBRATO, } from '@/features/exercises/types'

export type WeekTheme =
  | 'foundations'
  | 'breath'
  | 'range'
  | 'ear'
  | 'agility'
  | 'tone'
  | 'recovery'

export interface ResourceLink {
  title: string
  url: string
  author: string
  kind: 'video' | 'article'
  minutes?: number
}

export interface PathWeek {
  /** 1-based node position on the path. */
  order: number
  theme: WeekTheme
  title: string
  subtitle: string
  /** 1–2 sentences shown on the week card: what to focus on. */
  focus: string
  /** A short line in the coach's voice — encouragement or the one cue that
   *  matters most this week. Rendered as a highlighted tip on the card. */
  coachNote?: string
  /** Concrete outcomes for the week. */
  goals: string[]
  /** In-app drills this week's daily sessions favour. */
  exercises: ExerciseType[]
  /** Warm-up pattern the guided warmup should use this week. */
  warmupPattern?: string
  /** Curated external links (official uploads only). */
  resources: ResourceLink[]
}

export const ASCENT_ID = 'ascent-foundations'
export const ASCENT_NAME = 'The Ascent'
export const DAYS_PER_WEEK = 7

export const ASCENT_WEEKS: PathWeek[] = [
  {
    order: 1,
    theme: 'foundations',
    title: 'Find Your Instrument',
    subtitle: 'Foundations',
    focus:
      'Gentle warm-ups that wake the voice without strain — lip rolls, sirens and steady tones. This week is about meeting your instrument, not pushing it.',
    coachNote:
      "If it feels effortless, you're doing it right. We're not chasing big notes yet — we're teaching your voice that singing can feel easy.",
    goals: [
      'Warm up daily with lip rolls and sirens',
      'Hold one steady, comfortable note for 6 seconds',
      'Learn what "easy" singing feels like',
    ],
    exercises: [EXERCISE_LONG_NOTE, EXERCISE_PITCH_HOLD, EXERCISE_SIREN],
    warmupPattern: 'lip-trill',
    resources: [
      {
        title: 'Easy Vocal Warm-Up',
        url: 'https://www.youtube.com/watch?v=UytojhIHRNA',
        author: 'Saher Galt',
        kind: 'video',
        minutes: 15,
      },
      {
        title: 'Daily Vocal Warm-Up Exercises',
        url: 'https://www.youtube.com/watch?v=YkXHQJc9L6s',
        author: 'Ken Tamplin Vocal Academy',
        kind: 'video',
        minutes: 8,
      },
    ],
  },
  {
    order: 2,
    theme: 'breath',
    title: 'Breath & Power',
    subtitle: 'Dynamics',
    focus:
      'The engine under every note. Build breath support, then shape it — swelling a note from soft to strong and back without losing pitch.',
    coachNote:
      'Power comes from steady air, never from squeezing the throat. Think of leaning on the breath, not pushing it out.',
    goals: [
      'Swell a note soft-loud-soft in one breath',
      'Keep pitch steady while volume changes',
      'Longer, calmer exhales day by day',
    ],
    exercises: [EXERCISE_DYNAMIC_SWELL, EXERCISE_LONG_NOTE, EXERCISE_SIREN],
    warmupPattern: 'sirens',
    resources: [
      {
        title: "Appoggio Breathing: Breath Support's Gold Standard",
        url: 'https://www.youtube.com/watch?v=oDrhkt8KIA4',
        author: 'New York Vocal Coaching',
        kind: 'video',
        minutes: 13,
      },
      {
        title: 'Better Breath Support (Aretha Franklin cues)',
        url: 'https://www.youtube.com/watch?v=xen8frkK6ok',
        author: 'Chris Liepe',
        kind: 'video',
        minutes: 14,
      },
    ],
  },
  {
    order: 3,
    theme: 'range',
    title: 'Reach New Notes',
    subtitle: 'Range',
    focus:
      'Extend your range the safe way — gliding sirens and small leaps that visit high and low notes lightly before you ever hold them.',
    coachNote:
      'Visit new notes like a guest — lightly, briefly. Range grows by touching the edges often, not by forcing them.',
    goals: [
      'Glide smoothly past your comfortable top note',
      'Land octave leaps without reaching or strain',
      'Touch one new note at each end of your range',
    ],
    exercises: [EXERCISE_SIREN, EXERCISE_ARPEGGIO_JUMPER, EXERCISE_SLIDE],
    warmupPattern: 'sirens',
    resources: [
      {
        title: 'Stop Straining on High Notes: 4 Exercises',
        url: 'https://www.youtube.com/watch?v=ak8P55m3rfw',
        author: 'Ramsey Voice Studio',
        kind: 'video',
        minutes: 24,
      },
      {
        title: 'Improve Your Vocal Range: Sing High Notes',
        url: 'https://www.youtube.com/watch?v=OKwWqNY687Y',
        author: 'Ken Tamplin Vocal Academy',
        kind: 'video',
        minutes: 7,
      },
    ],
  },
  {
    order: 4,
    theme: 'ear',
    title: 'Tuning & Ear',
    subtitle: 'Ear Training',
    focus:
      'Train the ear that steers the voice. Hear an interval, then sing it back true — scale degrees, fifths and echoes, tuned against a drone.',
    coachNote:
      'Your voice can only sing as true as your ear can hear. Listen all the way to the note, then let your voice match what you heard.',
    goals: [
      'Sing back intervals on the first try',
      'Hold your line against a drone',
      'Echo short phrases accurately',
    ],
    exercises: [
      EXERCISE_INTERVAL_TRAINER,
      EXERCISE_CALL_RESPONSE,
      EXERCISE_DRONE_INTONATION,
      EXERCISE_MIRROR_MELODY,
    ],
    warmupPattern: 'ascending-scale',
    resources: [
      {
        title: 'Identify Musical Intervals by Ear',
        url: 'https://www.youtube.com/watch?v=EBUJ0EJLrLU',
        author: 'Saher Galt',
        kind: 'video',
        minutes: 17,
      },
      {
        title: 'How to Fix Singing Out of Tune',
        url: 'https://www.youtube.com/watch?v=l3K-GrrtRyY',
        author: "Dr Dan's Voice Essentials",
        kind: 'video',
        minutes: 7,
      },
    ],
  },
  {
    order: 5,
    theme: 'agility',
    title: 'Flexibility & Runs',
    subtitle: 'Agility',
    focus:
      'Speed built on accuracy. Crisp staccato, clean scale runs and quick arpeggios — small patterns first, tempo only when every note lands.',
    coachNote:
      'Slow and clean beats fast and blurry every time. Earn each step up in tempo, and the speed will feel like it arrived on its own.',
    goals: [
      'Run a five-note scale cleanly at speed',
      'Keep staccato notes short and centred',
      'String two patterns together without smearing',
    ],
    exercises: [
      EXERCISE_SCALE_RUNNER,
      EXERCISE_STACCATO,
      EXERCISE_ARPEGGIO_JUMPER,
    ],
    warmupPattern: 'five-tone-descending',
    resources: [
      {
        title: 'Pentatonic Vocal Runs: Extra Practice',
        url: 'https://www.youtube.com/watch?v=c49vW-SQ9fg',
        author: 'Saher Galt',
        kind: 'video',
        minutes: 8,
      },
      {
        title: 'Vocal Agility Exercise Duet',
        url: 'https://www.youtube.com/watch?v=NO3Iw6bvYsQ',
        author: 'Cheryl Porter',
        kind: 'video',
        minutes: 2,
      },
    ],
  },
  {
    order: 6,
    theme: 'tone',
    title: 'Tone & Vibrato',
    subtitle: 'Expression',
    focus:
      'Colour, earned last for a reason — vibrato and dynamics only bloom on top of steady breath. Shape notes you can already hold.',
    coachNote:
      'Vibrato is the sign of a relaxed, well-supported note — never something to force. Set the note up, then let it shimmer.',
    goals: [
      'Let an even vibrato appear on a held note',
      'Shade one phrase from bright to warm',
      'Finish notes with intention, not collapse',
    ],
    exercises: [EXERCISE_VIBRATO, EXERCISE_DYNAMIC_SWELL, EXERCISE_LONG_NOTE],
    warmupPattern: 'lip-trill',
    resources: [
      {
        title: 'The Only Way to Find Natural Vibrato',
        url: 'https://www.youtube.com/watch?v=_n0tKwZGfcQ',
        author: 'Chris Liepe',
        kind: 'video',
        minutes: 10,
      },
      {
        title: 'Develop Your Vibrato (From Scratch)',
        url: 'https://www.youtube.com/watch?v=qC8zvN-iz7g',
        author: 'Studio West',
        kind: 'video',
        minutes: 10,
      },
    ],
  },
  {
    order: 7,
    theme: 'recovery',
    title: 'Recovery',
    subtitle: 'The Gentle Week',
    focus:
      'Rest is training too. Light, easy warm-ups, soft echoes, and time to listen back at how far your voice has climbed.',
    coachNote:
      'Rest is where the gains settle in. Sing for joy this week, look back at how far you have come, and arrive at the summit fresh.',
    goals: [
      'Keep every session light and easy',
      'Sing one favourite phrase from earlier weeks',
      "Arrive at week's end rested, not spent",
    ],
    exercises: [
      EXERCISE_LONG_NOTE,
      EXERCISE_MIRROR_MELODY,
      EXERCISE_SIGHT_SINGING,
    ],
    warmupPattern: 'lip-trill',
    resources: [
      {
        title: '5-Minute Vocal Cool-Down',
        url: 'https://www.youtube.com/watch?v=8LKO13c28hU',
        author: "Dr Dan's Voice Essentials",
        kind: 'video',
        minutes: 5,
      },
      {
        title: "Victoria's Gentle Vocal Workout",
        url: 'https://www.youtube.com/watch?v=9ovNiUEJtbQ',
        author: 'Healthy Vocal Technique',
        kind: 'video',
        minutes: 14,
      },
    ],
  },
]

export function getWeek(order: number): PathWeek | undefined {
  return ASCENT_WEEKS.find((w) => w.order === order)
}
