// ============================================================
// Season 2 map — Read it, harmonise it: Lessons 15 to 28, their topics and edges
// ============================================================
//
// Season 2 in Season 1's form (season.ts): its entries, its topics, the
// edges into its lessons, its two arcs and the close Lesson 28's page draws.
// A Season 1 page never loads this module: its first paint would grow by
// all of it (scripts/assert-first-paint-budgets.mjs fails a Season 1 page
// that carries it). A Season 1 page's explorer loads it on demand, when its
// Season 2 tab opens; a Season 2 page imports it and carries it
// (page-state.ts `carrySeason`); what lists every season reads seasons.ts.
//
// Lessons are numbered on from Season 1, so an edge from a Season 1 lesson
// (Lesson 16 needs Lesson 9) is a plain edge, and the explorer draws it as
// a line in from the season before.
//
// Lessons 15 to 19 and 21 to 24 have their pages, drafts (drafts.ts); every other
// lesson is coming later, with no page, no reading time and no film, as
// Lesson 14 was before its page. A lesson's page, its reading time, its
// tease and its figure land with the page. Each entry takes its lesson's copy from lesson-copy.ts, as
// Season 1's do, so Lesson 16's tease, set on Lesson 16, shows on Lesson
// 15's next-lesson card. Its practise link (`pr.link`) is drawn on its card
// from now on, marked with its lesson as every practise link is
// (src/lib/lesson-marker.ts reads 15 to 28).

import { LESSON_COPY } from './lesson-copy'
import type { Arc, Edge, Lesson, Season, SeasonClose } from './season'
import { prereqOf } from './season'
import { SEASON_2_FIGURES } from './season-2-figures'

/** Season 2's topics by id, as SEASON-2 § 4.1 names them. */
export const TOPICS_2: Readonly<Record<string, string>> = {
  T07: 'Note values, rests, dots, ties, subdivision',
  T08: 'Simple and compound metre; triplets; syncopation',
  T13: 'Interval quality: major, minor, perfect; tritone; inversion',
  T15b: 'Harmonic and melodic minor; relative keys',
  T16: 'Pentatonic and blues scales',
  T17: 'Keys, key signatures, transposition',
  T18: 'Circle of fifths',
  T22: 'Phrases and cadences',
  T23: 'Chord tones and non-chord tones',
  T24: 'Seventh chords',
  T25: 'Inversions and voicing',
  T29: 'Tuning systems: why twelve, equal temperament',
  T30: 'Staff notation: staff, clefs, ledger lines, grand staff',
  T31: 'Song form',
  T32: 'Dynamics and articulation terms',
  S11a: 'Sight-singing pitch: steps and the tonic triad from the staff, after do',
  S11b: 'Sight-singing in time: short melodies with rhythm',
  S18: 'Agility: staccato, runs, pentatonic patterns',
  S19: 'Vibrato',
  S20a: 'Hold a part against a drone; beats',
  S20b: 'Sing a second part with a melody',
}

/** Season 2's entries as written here, before each takes its lesson's copy. */
const ENTRIES_2: readonly Lesson[] = [
  {
    n: 15,
    lane: 'theory',
    title: 'The staff: where notes sit',
    short: 'The staff',
    topics: ['T30'],
    // A draft until the vocal coach's look at Sing it (drafts.ts).
    minutes: 15,
    page: '/learn/15',
    hook: 'A piano has 88 keys. How can five lines write down every one of them?',
    pr: {
      needs:
        'A note-reading drill: a note on the treble or bass staff, up to two ledger lines, answered on a keyboard or by letter',
      link: {
        href: '/?lesson=15#/compose',
        addr: 'mercurypitch.com/#/compose',
        label: 'Compose',
        note: 'then choose Sheet Music',
      },
    },
  },
  {
    n: 16,
    lane: 'voice',
    title: 'Sing what you see',
    short: 'Sight-singing',
    topics: ['S11a'],
    // A draft until Lessons 9 and 15 are live and the vocal coach's sign-off
    // (drafts.ts).
    minutes: 15,
    page: '/learn/16',
    hook: "Can you sing a tune you've never heard, just by reading it?",
    pr: {
      needs:
        'Sight-Singing for the lessons: fixed phrases, a hear-do start, the bass clef, names off and octave-folded scoring (SEASON-2 § 5.2 item 10)',
      link: {
        href: '/pitch-training?lesson=16',
        addr: 'mercurypitch.com/pitch-training',
        label: 'Exercises',
        note: 'then tap Sight-Singing',
      },
    },
  },
  {
    n: 17,
    lane: 'theory',
    title: 'How long is a note?',
    short: 'Note lengths',
    topics: ['T07'],
    // A draft until Lesson 8's page is live and the vocal coach has looked
    // at the sung part (drafts.ts).
    minutes: 16,
    page: '/learn/17',
    hook: 'Why is a quarter note not a quarter of a second?',
    fig: 'rhythm',
    pr: {
      needs: 'The Chart without triplets or sixteenths (an ear-drill link)',
      link: {
        href: '/ear-lab?lesson=17',
        addr: 'mercurypitch.com/ear-lab',
        label: 'Ear Lab',
        note: 'then tap The Chart',
      },
    },
  },
  {
    n: 18,
    lane: 'voice',
    title: 'Read and sing a whole line',
    short: 'Reading in time',
    topics: ['S11b', 'T32'],
    // A draft until Lessons 16 and 17 are live and the vocal coach's
    // sign-off (drafts.ts).
    minutes: 16,
    page: '/learn/18',
    hook: "How do singers read a tune they've never heard without stopping on every note?",
    pr: {
      needs:
        'Sight-singing in time: a count-in, a click and notes that move on the beat, pitch scored per note (SEASON-2 § 5.2 item 11)',
      link: {
        href: '/pitch-training?lesson=18',
        addr: 'mercurypitch.com/pitch-training',
        label: 'Exercises',
        note: 'then tap Sight-Singing',
      },
    },
  },
  {
    n: 19,
    lane: 'theory',
    title: 'Threes, offbeats and syncopation',
    short: 'Threes and offbeats',
    topics: ['T08'],
    // A draft until Lesson 17's page is live (drafts.ts); nothing on it is
    // sung, so it waits on no vocal coach.
    minutes: 12,
    page: '/learn/19',
    // six pads in a row, ungrouped, nothing written (season-2-figures.ts)
    fig: 'pads',
    hook: 'Six notes in a bar, grouped two ways: why does one feel like two beats and the other like three?',
    pr: {
      needs: 'Subdivide with only 3/4 and 6/8 (an ear-drill link)',
      link: {
        href: '/ear-lab?lesson=19',
        addr: 'mercurypitch.com/ear-lab',
        label: 'Ear Lab',
        note: 'then tap Subdivide',
      },
    },
  },
  {
    n: 20,
    lane: 'voice',
    title: 'Runs and the pentatonic scale',
    short: 'Runs',
    topics: ['S18', 'T16'],
    hook: 'How do singers sing a fast run without the notes smudging together?',
    pr: {
      needs:
        "Scale Runner's Pentatonic by launch, and a drill that sings a run continuously",
      link: {
        href: '/pitch-training?lesson=20',
        addr: 'mercurypitch.com/pitch-training',
        label: 'Exercises',
        note: 'then tap Scale Runner',
      },
    },
  },
  {
    n: 21,
    lane: 'theory',
    title: 'Keys and the circle of fifths',
    short: 'Circle of fifths',
    topics: ['T17', 'T18', 'T29'],
    // A draft until Lessons 6 and 15 are live and the vocal coach's look at
    // Sing it (drafts.ts).
    minutes: 15,
    page: '/learn/21',
    hook: 'G major needs one sharp and D major two. Why does each key a fifth up keep its sharps and add one?',
    pr: {
      needs:
        'A note-reading drill that reads key signatures, and Sight-Singing that spells by key',
      link: {
        href: '/?lesson=21#/compose',
        addr: 'mercurypitch.com/#/compose',
        label: 'Compose',
        note: 'then choose Sheet Music',
      },
    },
  },
  {
    n: 22,
    lane: 'voice',
    title: 'Vibrato',
    short: 'Vibrato',
    topics: ['S19'],
    // A draft until its sign-off (drafts.ts), as Lesson 5 is.
    minutes: 15,
    page: '/learn/22',
    hook: "If a singer's held note swings up and down six times a second, why do we still hear one note?",
    pr: {
      needs:
        "The Vibrato exercise's copy and default (SEASON-2 § 5.2 item 14), before any link to it",
      link: {
        href: '/mirror?lesson=22',
        addr: 'mercurypitch.com/mirror',
        label: 'Voice Mirror',
        note: 'its Hold: a vibrato reported, never scored',
      },
    },
  },
  {
    n: 23,
    lane: 'theory',
    title: 'Perfect, major, minor and the tritone',
    short: 'Interval quality',
    topics: ['T13'],
    // A draft until Lesson 6's page is live and the vocal coach has looked
    // at Sing it (drafts.ts).
    minutes: 14,
    page: '/learn/23',
    hook: 'Which interval splits the octave exactly in half, and why does it want to move?',
    pr: {
      needs:
        'Leap with only the perfect intervals and the tritone (the ear-drill launch kind)',
      link: {
        href: '/ear-lab?lesson=23',
        addr: 'mercurypitch.com/ear-lab',
        label: 'Ear Lab',
        note: 'then tap Leap',
      },
    },
  },
  {
    n: 24,
    lane: 'voice',
    title: 'Harmony against a drone',
    short: 'Drone harmony',
    topics: ['S20a'],
    // A draft until the lab's two tests and the vocal coach's sign-off
    // (drafts.ts).
    minutes: 16,
    page: '/learn/24',
    hook: 'Hold a note against a drone: how can you hear when the two are in tune?',
    pr: {
      needs:
        'The fifth, third and octave slug and a pure-tuning option (SEASON-2 § 5.2 item 15); a drone with harmonics',
      link: {
        href: '/exercises/thirds-on-a-drone?lesson=24',
        addr: 'mercurypitch.com/exercises/thirds-on-a-drone',
        label: 'Drone Intonation',
        note: 'the two thirds',
      },
    },
  },
  {
    n: 25,
    lane: 'theory',
    title: 'Minor, properly',
    short: 'Minor, properly',
    topics: ['T15b'],
    hook: 'Why does a minor key often raise one note just before it comes home?',
    pr: {
      needs:
        "Gravity with only Te and Ti (the ear-drill launch kind); Scale Runner's harmonic and melodic minor; Sight-Singing with a key launch, a hear-do start, the bass clef, letter names off and octave-folded scoring",
      link: {
        href: '/ear-lab?lesson=25',
        addr: 'mercurypitch.com/ear-lab',
        label: 'Ear Lab',
        note: 'then tap Gravity',
      },
    },
  },
  {
    n: 26,
    lane: 'voice',
    title: 'A second voice',
    short: 'Second voice',
    topics: ['S20b', 'T23'],
    hook: 'Can you make a harmony by singing the tune a third higher?',
    pr: {
      needs: 'The harmony-line drill (SEASON-2 § 5.2 item 17)',
      link: {
        href: '/jam?lesson=26',
        addr: 'mercurypitch.com/jam',
        label: 'Harmony Stack',
        note: 'with a friend: the host picks Harmony Stack',
      },
    },
  },
  {
    n: 27,
    lane: 'theory',
    title: 'Seventh chords and inversions',
    short: 'Sevenths',
    topics: ['T24', 'T25'],
    hook: 'Add one note to the V chord and it pulls towards home. Which note, and why?',
    pr: {
      needs:
        'Chord Stacker opening on the dominant seventh, with triads and inversions (today it shuffles maj7, min7, dom7, dim7 and maj6); Stack with major against dominant seventh alone (the ear-drill launch kind)',
      link: {
        href: '/pitch-training?lesson=27',
        addr: 'mercurypitch.com/pitch-training',
        label: 'Exercises',
        note: 'then tap Chord Stacker',
      },
    },
  },
  {
    n: 28,
    lane: 'both',
    title: 'Cadences, form and a song in two parts',
    short: 'Cadences',
    topics: ['T22', 'T31'],
    hook: "How can a song sound as if it's ending, then keep going?",
    pr: {
      needs:
        'A cadence-type ear drill (SEASON-2 § 5.2 item 19); the harmony-line drill (item 17)',
      link: {
        href: '/karaoke-night?lesson=28',
        addr: 'mercurypitch.com/karaoke-night',
        label: 'Karaoke Night',
      },
    },
  },
]

/** Season 2's lessons, in order, each with its alternative hooks and its tease from lesson-copy.ts. */
export const LESSONS_2: readonly Lesson[] = ENTRIES_2.map((L) => ({
  ...L,
  ...LESSON_COPY[L.n],
}))

/**
 * SEASON-2 § 4.3's prerequisite table, which leaves out every edge implied
 * through another; an edge from a lesson under 15 comes from Season 1.
 */
export const EDGES_2: readonly Edge[] = [
  [2, 15],
  [9, 16],
  [15, 16],
  [8, 17],
  [16, 18],
  [17, 18],
  [17, 19],
  [5, 20],
  [9, 20],
  [10, 20],
  [6, 21],
  [15, 21],
  [14, 22],
  [6, 23],
  [5, 24],
  [10, 24],
  [23, 24],
  [10, 25],
  [21, 25],
  [23, 25],
  [12, 26],
  [24, 26],
  [12, 27],
  [23, 27],
  [18, 28],
  [26, 28],
]

/** Season 2's two arcs. */
export const ARCS_2: readonly Arc[] = [
  ['Read it', 'Lessons 15 to 21', 15, 21],
  ['Harmonise it', 'Lessons 22 to 28', 22, 28],
]

/** The close Lesson 28's page draws: Season 2's last answer, and the same two ways on as Season 1's. */
export const SEASON_2_END: SeasonClose = {
  eyebrow: 'End of Season 2',
  line: "You've read a song in two parts. Now sing a whole song.",
  rest: "You've read a song in two parts.",
  song: { label: 'Karaoke Night', path: '/karaoke-night' },
  map: { label: 'See the season map', href: '#explorer' },
}

/** Season 2: Lessons 15 to 28. Its trailer has no number, so it has no entry. */
export const SEASON_2: Season = {
  n: 2,
  name: 'Read it, harmonise it',
  lessons: LESSONS_2,
  edges: EDGES_2,
  prereq: prereqOf(EDGES_2),
  topics: TOPICS_2,
  arcs: ARCS_2,
  last: 28,
  close: SEASON_2_END,
  figures: SEASON_2_FIGURES,
}
