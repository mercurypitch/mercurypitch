// ============================================================
// Season 1 map — the lessons, their topics and what each builds on
// ============================================================
//
// Pure data and graph helpers, no DOM. The explorer's graph, its phone list
// and every card read these lists. EDGES is CURRICULUM § 3.3's prerequisite
// table, which already leaves out every edge implied through another
// prerequisite: "Builds on" names only the direct links, and the path
// helpers walk the rest.
//
// Practise links are same-origin and carry the lesson that sent the viewer
// (`?lesson=01`, before any hash route), so the app can tell where a session
// came from. The printed address (`addr`) stays the public one.
//
// A lesson has a `page` once its document is written, and every build
// carries every lesson page. Whether it is live is publish.ts's to say: a
// lesson the admin console holds back, or a draft (drafts.ts) where its
// environment holds drafts back, is coming later, exactly as a lesson with
// no page yet. So nothing here reads the build: the site worker reads this
// file as the pages do (src/lesson-gate.ts), and each page takes the season
// as its state shows it (page-state.ts `pageLessons`). Where a lesson
// stands for a viewer (done, in progress, up next) is lesson-state.ts's to
// say. A film is published once its sources are set in films.ts, which
// every entry's `film` reads, and only a published film ever offers "Watch
// the episode".
//
// Some fields are the team's and never drawn on a lesson page: the
// signature image (`sig`), the drill a practise link still needs
// (`pr.needs`), why a lesson has no drill (`pr.none`), a film that is made
// but not published (`film: 'production'`), a film's running time (`len`)
// and why a hook or tease variant exists (its `note`). They stay here for
// the team and the admin console. A note on a practise link
// (`pr.link.note`) is printed on the card, so it speaks to the learner:
// "then tap Scale Runner", never what the drill still lacks.
//
// A lesson's `hook` is its default hook, which its page's title and its
// documents quote. Its alternative hooks, its tease (the line the lesson
// before it draws above that hook) and the tease's alternatives are
// lesson-copy.ts's: LESSONS gives each entry its lesson's copy from there,
// and the page state picks among them (publish.ts `seasonFor`).

import type { FilmState } from './films'
import { filmState } from './films'
import type { CuriosityCopy } from './lesson-copy'
import { LESSON_COPY } from './lesson-copy'

export const TOPICS = {
  T01: 'Sound and pitch: vibration, frequency, hertz; high is not loud',
  T02: 'Octave and octave equivalence; seven letter names; octave numbers',
  T03: 'Twelve notes: semitones, tones, sharps and flats, keyboard',
  T04: 'Cents and "in tune"',
  T05: 'Pulse, beat and tempo',
  T06: 'Metre and bars; downbeat; backbeat',
  T09: 'Major scale; tonic as home',
  T10: 'Scale degrees and movable do',
  T11: 'Melody: contour, steps and leaps, transposition',
  T12: 'Intervals by size and by sound',
  T14: 'Major and minor third; major and minor triads by ear',
  T15: 'Minor scales (natural, in Season 1)',
  T19: 'Triads: major, minor, diminished, augmented',
  T20: 'Diatonic chords, Roman numerals, function',
  T21: 'Common progressions',
  T22: 'Phrases and cadences (light)',
  T28: 'Timbre, harmonics, overtones; spectrum',
  S01: 'How the voice makes pitch; vocal health basics',
  S02: 'Posture, alignment, tension release',
  S03: 'Breath: low, quiet inhale; managed exhale',
  S04: 'Onset and offset',
  S05: 'Pitch matching; octave counts',
  S06: 'Steady tone',
  S07: 'Glides, sirens, lip trills, "ng"',
  S08: 'Range and comfortable zone; voice types as labels',
  S09: 'Singing steps: five-note scales, then the octave',
  S10: 'Singing leaps: thirds, fifth, fourth, octave; arpeggios',
  S12: 'Registers: chest, head, falsetto; the break',
  S13: 'Resonance and brightness',
  S14: 'Vowels',
  S16: 'Legato and phrasing; breath planning',
  S17: 'Dynamics without pushing: messa di voce',
} as const

export type TopicId = keyof typeof TOPICS

/** Theory above, voice below; the trailer and the finale sit between them. */
export type Lane = 'theory' | 'voice' | 'both'

/** Where a lesson sends the viewer to practise, as its CURRICULUM card gives it. */
export interface Practise {
  /** A drill that exists today. */
  readonly link?: {
    /** Same-origin, carrying `?lesson=NN`. */
    readonly href: string
    /** The address as the card prints it. */
    readonly addr: string
    readonly label: string
    /** Printed after the label, in the learner's words: what to tap, or what the drill does. */
    readonly note?: string
  }
  /** The deep link the lesson's own drill still needs. Admin only, never drawn on a lesson page. */
  readonly needs?: string
  /** Why the lesson has no drill at all. Admin only, never drawn on a lesson page. */
  readonly none?: string
}

export interface Lesson extends CuriosityCopy {
  /** 0 is the trailer; LESSONS[n].n === n. */
  readonly n: number
  readonly lane: Lane
  readonly kind?: 'Trailer'
  readonly title: string
  /** The name on the map and in the links between cards. */
  readonly short: string
  readonly topics: readonly TopicId[]
  /** Its page's reading time in minutes, as its hero says; only a lesson with a page has one. */
  readonly minutes?: number
  /**
   * Its film's running time as made ("5:14"), or as planned for the
   * trailer. Admin only: a card shows a film's length only once that film
   * plays on its page, which reports it (explorer.ts `setLength`).
   */
  readonly len?: string
  /** Its own page on this site, once it is written: `/learn/01`. Live only where published (publish.ts). */
  readonly page?: string
  /**
   * Its film, from films.ts: 'published' once its sources are set there,
   * so it plays on its page and its card offers "Watch the episode";
   * 'production' while it is made but not uploaded, which is the team's and
   * never drawn on a lesson page. Absent while there is no film.
   */
  readonly film?: FilmState
  /** The question the lesson opens with: its default hook, variant id 'default' (lesson-copy.ts). */
  readonly hook: string
  /** The signature image, the team's shorthand for the lesson's look. Admin only, never drawn on a lesson page. */
  readonly sig: string
  readonly pr: Practise
  /** The figure beside its card; 'poster' shows the poster its page hands the explorer. */
  readonly fig?: 'poster' | 'metronome' | 'chladni'
  /** The poster's alt text, for a card whose figure is the poster. */
  readonly posterAlt?: string
}

/** The season's entries as written here, before each takes its lesson's copy. */
const ENTRIES: readonly Lesson[] = [
  {
    n: 0,
    lane: 'both',
    kind: 'Trailer',
    title: 'Find your pitch',
    short: 'Trailer',
    topics: [],
    len: '2 to 3 min',
    hook: 'What if you could see every note you sing?',
    sig: 'The promise, and a map of all fourteen hooks.',
    pr: { none: 'The trailer is the map; it has no drill of its own.' },
  },
  {
    n: 1,
    lane: 'theory',
    title: 'What is a note?',
    short: 'What is a note?',
    topics: ['T01', 'T02'],
    minutes: 10,
    len: '5:14',
    page: '/learn/01',
    film: filmState(1),
    hook: 'If 440 Hz shakes the air twice as fast as 220 Hz, why do musicians call them the same note?',
    sig: 'The pitch line winds into a spiral; the spiral unrolls into the keyboard.',
    pr: {
      link: {
        href: '/mirror?lesson=01',
        addr: 'mercurypitch.com/mirror',
        label: 'Voice Mirror',
        note: 'counts a match in any octave',
      },
    },
    fig: 'poster',
    posterAlt:
      'The title card: Find Your Pitch, Lesson 01, What is a note?, above a five-line staff',
  },
  {
    n: 2,
    lane: 'theory',
    title: 'Twelve notes',
    short: 'Twelve notes',
    topics: ['T03', 'T04'],
    minutes: 10,
    len: '7:11',
    page: '/learn/02',
    film: filmState(2),
    hook: 'Musicians only use seven letters, so where do the other five notes come from?',
    sig: 'The five "?" beads from Lesson 1\'s spiral light up; twelve equal steps multiply to exactly 2.',
    pr: {
      needs:
        'Ear Lab Leap with only minor and major 2nds (an ear-drill launch accepting a bank subset)',
      link: {
        href: '/ear-lab?lesson=02',
        addr: 'mercurypitch.com/ear-lab',
        label: 'Ear Lab',
        note: 'then tap Leap',
      },
    },
    fig: 'poster',
    posterAlt:
      'The title card: Find Your Pitch, Lesson 02, Twelve notes, above a glowing five-line staff with a blue note, an orange note, a chrome bead and chrome notes, one of them sharp',
  },
  {
    n: 3,
    lane: 'voice',
    title: 'Match a note',
    short: 'Match a note',
    topics: ['S01', 'S05'],
    // A draft until its sign-off (drafts.ts): built in every mode, and live
    // where the page state publishes it (publish.ts).
    minutes: 15,
    page: '/learn/03',
    hook: "Asked, most students said they couldn't copy a tune. What happened when researchers tested it?",
    sig: "The singer's line chasing Merc's target band, the gap shrinking in cents.",
    pr: {
      needs: 'Pitch Hold (a slug)',
      link: {
        href: '/mirror?lesson=03',
        addr: 'mercurypitch.com/mirror',
        label: 'Voice Mirror',
      },
    },
  },
  {
    n: 4,
    lane: 'theory',
    title: 'The major scale and home',
    short: 'Major scale',
    topics: ['T09', 'T10'],
    // A draft until the owner's go-ahead (drafts.ts); no film yet
    minutes: 10,
    page: '/learn/04',
    hook: 'Why does do-re-mi sound finished when it lands on do, and restless when it stops on ti?',
    sig: 'A staircase with two short steps that slides to start on any note.',
    pr: {
      needs: 'Scale Runner at a beginner tempo (a data-only slug)',
      link: {
        href: '/pitch-training?lesson=04',
        addr: 'mercurypitch.com/pitch-training',
        label: 'Exercises',
        note: 'then tap Scale Runner',
      },
    },
  },
  {
    n: 5,
    lane: 'voice',
    title: 'Breath and a steady note',
    short: 'Steady note',
    topics: ['S02', 'S03', 'S04', 'S06'],
    // A draft until its sign-off (drafts.ts), as Lesson 3 is.
    minutes: 17,
    page: '/learn/05',
    hook: "Singers are told to “support” a long note. If that doesn't mean pushing, what keeps it steady?",
    sig: 'The pitch line of a held note settling from a wobble into a narrow band.',
    pr: {
      needs: 'Long Note with a fixed 10 or 15 s length (durationSec)',
      link: {
        href: '/mirror?lesson=05',
        addr: 'mercurypitch.com/mirror',
        label: 'Voice Mirror',
        note: 'its Hold: a comfortable note, held steady',
      },
    },
  },
  {
    n: 6,
    lane: 'theory',
    title: 'Intervals: the distance between notes',
    short: 'Intervals',
    topics: ['T11', 'T12'],
    // A draft until the owner's review and the vocal coach's look at Sing it (drafts.ts).
    minutes: 15,
    page: '/learn/06',
    hook: 'Why can you start ‘Twinkle, Twinkle’ on any note and it is still the same tune?',
    sig: "A tune's contour lifted off the chart and slid up and down, keeping its shape.",
    pr: {
      needs:
        'Interval Trainer with the anchored intervals (the intervals launch field)',
      link: {
        href: '/ear-lab?lesson=06',
        addr: 'mercurypitch.com/ear-lab',
        label: 'Ear Lab',
        note: 'then tap Leap to name them',
      },
    },
  },
  {
    n: 7,
    lane: 'voice',
    title: 'Slides, sirens and your range',
    short: 'Your range',
    topics: ['S07', 'S08'],
    // A draft until the owner's review and the vocal coach's sign-off (drafts.ts).
    minutes: 16,
    page: '/learn/07',
    hook: 'Why is your comfortable middle worth more than your highest note?',
    sig: "A siren's line sweeping the chart, the comfortable band lit and the edges dimmed.",
    pr: {
      link: {
        href: '/vocal-range-test?lesson=07',
        addr: 'mercurypitch.com/vocal-range-test',
        label: 'Vocal Range Test',
      },
    },
  },
  {
    n: 8,
    lane: 'theory',
    title: 'Beat, tempo and the backbeat',
    short: 'Beat and tempo',
    topics: ['T05', 'T06'],
    hook: 'Why does the same song feel different when you clap on 2 and 4 instead of 1 and 3?',
    sig: 'A metronome whose arm becomes the beat grid of a step sequencer.',
    pr: {
      needs: 'Ear Lab Time (an ear-drill link)',
      link: {
        href: '/drum-night?lesson=08',
        addr: 'mercurypitch.com/drum-night',
        label: 'Drum Night',
      },
    },
    fig: 'metronome',
  },
  {
    n: 9,
    lane: 'voice',
    title: 'Landing a leap',
    short: 'Landing a leap',
    topics: ['S09', 'S10'],
    hook: 'How do you land a note you have to leap to?',
    sig: "The leap drawn as an arc whose landing zone is the target band (amber, the app's pitch-canvas colour); slow leaps first.",
    pr: {
      needs: 'Interval Trainer (sing) and Arpeggio Jumper',
      link: {
        href: '/pitch-training?lesson=09',
        addr: 'mercurypitch.com/pitch-training',
        label: 'Exercises',
        note: 'then tap Arpeggio Jumper',
      },
    },
  },
  {
    n: 10,
    lane: 'theory',
    title: 'Major and minor',
    short: 'Major and minor',
    topics: ['T14', 'T15', 'T19'],
    hook: 'Which single note turns a major chord into a minor one?',
    sig: "One bead, the third, sliding down one semitone and the chord's colour changing.",
    pr: { needs: 'Drone Intonation and Ear Lab Stack' },
  },
  {
    n: 11,
    lane: 'voice',
    title: 'Registers and the break',
    short: 'Registers',
    topics: ['S12'],
    hook: 'Why does your voice sometimes flip as you slide up?',
    sig: "The siren's line crossing a shaded seam, the seam narrowing over repetitions.",
    pr: { needs: 'siren and slide drills' },
  },
  {
    n: 12,
    lane: 'theory',
    title: 'Chords and the four-chord song',
    short: 'Chords',
    topics: ['T19', 'T20', 'T21'],
    hook: 'How can two songs share the same four chords and still sound different?',
    sig: 'Four chords as four rooms on the spiral; a melody walking through them.',
    pr: {
      needs:
        'Chord Stacker with major and minor triads (today it has only maj7, min7, dom7, dim7 and maj6)',
    },
  },
  {
    n: 13,
    lane: 'voice',
    title: 'Resonance and vowels',
    short: 'Vowels',
    topics: ['T28', 'S13', 'S14'],
    hook: 'If ‘ee’ and ‘ah’ sung on the same note draw the same pitch line, what makes them sound different?',
    sig: 'One pitch line over a harmonic spectrum whose peaks move as the vowel changes.',
    pr: { needs: 'Long Note on vowels' },
    fig: 'chladni',
  },
  {
    n: 14,
    lane: 'both',
    title: 'Phrasing: sing a whole song',
    short: 'Phrasing',
    topics: ['S16', 'S17', 'T22'],
    hook: 'If every note of a song is in tune, what is left to shape?',
    sig: "A whole song's pitch line with breath marks and a swell drawn in light.",
    pr: {
      link: {
        href: '/karaoke-night?lesson=14',
        addr: 'mercurypitch.com/karaoke-night',
        label: 'Karaoke Night',
      },
    },
  },
]

/** Every lesson, its alternative hooks and its tease from lesson-copy.ts. */
export const LESSONS: readonly Lesson[] = ENTRIES.map((L) => ({
  ...L,
  ...LESSON_COPY[L.n],
}))

/** A prerequisite: lesson `from` comes before lesson `to`. */
export type Edge = readonly [from: number, to: number]

export const EDGES: readonly Edge[] = [
  [1, 2],
  [1, 3],
  [2, 4],
  [2, 5],
  [3, 5],
  [4, 6],
  [3, 7],
  [3, 9],
  [6, 9],
  [6, 10],
  [7, 11],
  [10, 12],
  [11, 13],
  [5, 14],
  [8, 14],
  [9, 14],
  [12, 14],
]

/** Each lesson's direct prerequisites, in EDGES order; absent for a lesson that needs none. */
export const PREREQ: Readonly<Partial<Record<number, readonly number[]>>> =
  EDGES.reduce<Partial<Record<number, number[]>>>((out, [a, b]) => {
    ;(out[b] ??= []).push(a)
    return out
  }, {})

/** The lessons that name `n` as a direct prerequisite, in lesson order. */
export function unlocks(n: number): number[] {
  return Object.keys(PREREQ)
    .map(Number)
    .filter((k) => PREREQ[k]?.includes(n) === true)
}

/** Every lesson `n` builds on, directly or through another lesson: its path in. */
export function ancestors(n: number): Set<number> {
  const out = new Set<number>()
  const todo = [...(PREREQ[n] ?? [])]
  while (todo.length > 0) {
    const k = todo.pop()!
    if (out.has(k)) continue
    out.add(k)
    todo.push(...(PREREQ[k] ?? []))
  }
  return out
}

/**
 * An edge's part in a selected lesson's path: 'in' for its own
 * prerequisites, 'out' for the lessons it opens, 'path' for an edge further
 * back on its way in.
 */
export type EdgeRole = 'in' | 'out' | 'path'

export interface LessonPath {
  /** Every lesson the selected one builds on; their nodes take the 'anc' class. */
  readonly ancestors: ReadonlySet<number>
  /** One entry per EDGES item, in order: its role, or null for an edge off the path. */
  readonly roles: readonly (EdgeRole | null)[]
}

/**
 * What the explorer lights when lesson `n` is selected. Its own links lead;
 * an edge with both ends among its ancestors (or itself) is on its path in;
 * everything else stays faint, even a branch that leaves the path.
 */
export function lessonPath(n: number): LessonPath {
  const before = ancestors(n)
  const onPath = new Set([...before, n])
  const roles = EDGES.map(([a, b]): EdgeRole | null => {
    if (b === n) return 'in'
    if (a === n) return 'out'
    return onPath.has(a) && onPath.has(b) ? 'path' : null
  })
  return { ancestors: before, roles }
}
