// ============================================================
// Build plan — from four answers to up to three real stops
// ============================================================
//
// Pins what the plan says and where each stop goes. The tables and the copy
// are the approved mockup's, except the guitar and piano "progress" cells
// (spec 5.1, corrected 20 Oct), and every Start-here cell, Learn card and Play
// card is checked word for word: a line that drifts fails here, and a change
// of wording is made on purpose, in plan-copy.ts (the Learn cards: in
// build-plan.ts) and in this file. The rules are which stop an answer picks,
// how the voiceprint and the answers share Start here, and how the person's
// own menu trims the plan. The last blocks build a plan for every answer a
// person can give, under three menus, and hold each one to the honesty rules:
// a stop is a real tab or page, the menu switch is offered only when every
// stop stays in it, and no card repeats another.
//
// It runs past the 600 lines TESTING.md 3.5 allows without a reason, and this
// is the reason: it is the one test file for one module and the words that
// module speaks, and it holds ten blocks, each pinning one promise the plan
// makes: the approved plans, Start here, Learn and Play (each a table of
// cases), the voiceprint (when it leads, and that its reason is said once),
// the menu (what a narrower menu drops, when the switch is offered), the plan
// as a value (nothing written to, new objects each time), where the stops go
// (real tabs, pages and covers), every answer (the honesty rules over all of
// them) and the store build (no store-only words in the plan, and the plan's
// own words held to the plan, which the native check rejects). About 490 lines
// are the approved copy as rows of data, which pin every line of it.

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { DRAFT_LESSONS } from '@/features/lessons/kit/drafts'
import type { FirstStop } from '@/features/onboarding/first-stop'
import { pickFirstStop } from '@/features/onboarding/first-stop'
import type { ActiveTab } from '@/features/tabs/constants'
import { isTabVisible, TAB_ORDER } from '@/features/tabs/constants'
import type { MirrorResult } from '@/lib/mirror/metrics'
import { ENTRY_PAGES } from '@/seo/entry-pages'
import type { Plan, PlanDest, PlanStop, PlanView } from './build-plan'
import { buildPlan, PLAN_DESTS, planStops } from './build-plan'
import type { Instrument, PlanChoices, Q1Answer, Q3Id, Q4Id } from './questions'
import { EMPTY_CHOICES, INSTRUMENTS, q2Options, Q3_MAX, q3Options, } from './questions'

/** Choices with only the fields a case cares about; the rest stay empty. */
const choices = (c: Partial<PlanChoices>): PlanChoices => ({
  ...EMPTY_CHOICES,
  q3: [],
  q4: [],
  ...c,
})

const build = (
  c: Partial<PlanChoices>,
  opts?: Parameters<typeof buildPlan>[1],
): Plan => buildPlan(choices(c), opts)

/** What pickFirstStop returns for each finding, worded as first-stop.ts words it. */
const LONG_NOTE: FirstStop = {
  room: 'exercises',
  detail: 'Long Note',
  reason: "Your tone wavers when you hold. Let's steady it.",
}
const RANGE_WEEK: FirstStop = {
  room: 'ascent',
  detail: 'Range week',
  reason: "There's more voice up there than you're using.",
}
const SONG_READY: FirstStop = {
  room: 'karaoke',
  detail: null,
  reason: "That was solid. You're ready to sing a real song.",
}
/** Nothing measured: the default stop, which is not a finding. */
const NO_FINDING: FirstStop = pickFirstStop(null)

const FINDINGS = [LONG_NOTE, RANGE_WEEK, SONG_READY]

const ADVANCED: PlanView = { scope: 'all', mode: 'advanced' }
const SIMPLE: PlanView = { scope: 'all', mode: 'simple' }
const GUITAR_ONLY: PlanView = { scope: 'guitar', mode: 'advanced' }
const VIEWS = [ADVANCED, SIMPLE, GUITAR_ONLY]

/** The tab a destination opens, or null for a page. */
function tabOf(dest: PlanDest): ActiveTab | null {
  const { target } = PLAN_DESTS[dest]
  return target.kind === 'tab' ? target.tab : null
}

describe('the approved plans', () => {
  type Sample = [
    name: string,
    c: PlanChoices,
    want: [
      start: PlanDest,
      learn: PlanDest | null,
      play: PlanDest | null,
      scope: string | null,
    ],
  ]

  const AUDITION: PlanChoices = {
    q1: 'singing',
    q2: 'audition',
    q3: ['progress', 'tune'],
    q4: ['teacher'],
  }
  const GUITAR: PlanChoices = {
    q1: 'guitar',
    q2: 'song',
    q3: ['time'],
    q4: ['app'],
  }
  const SHY: PlanChoices = {
    q1: 'singing',
    q2: 'fun',
    q3: ['shy'],
    q4: ['along'],
  }
  const EAR: PlanChoices = {
    q1: 'ear',
    q2: 'tune',
    q3: ['difference'],
    q4: ['starting'],
  }
  const PIANO: PlanChoices = {
    q1: 'piano',
    q2: 'basics',
    q3: ['what'],
    q4: ['video'],
  }
  const FRIENDS: PlanChoices = {
    q1: 'everything',
    q2: 'together',
    q3: ['time'],
    q4: ['starting'],
  }

  const SAMPLES: Sample[] = [
    ['audition', AUDITION, ['sing', 'hearYourself', 'karaokeNight', 'singing']],
    ['guitar', GUITAR, ['guitar', null, 'guitarNight', 'guitar']],
    ['shy', SHY, ['sing', null, 'karaokeNight', 'singing']],
    ['ear', EAR, ['earLab', 'lesson1', null, null]],
    ['piano', PIANO, ['ascent', 'lesson2', null, 'piano']],
    ['friends', FRIENDS, ['homeSession', 'lesson1', 'jam', null]],
  ]

  it.each(SAMPLES)('builds the approved %s plan', (_, c, want) => {
    const p = buildPlan(c)

    expect([
      p.start.dest,
      p.learn?.dest ?? null,
      p.play?.dest ?? null,
      p.scope?.scope ?? null,
    ]).toEqual(want)
  })

  it('rehearses the audition singer at Karaoke Night, and says why Start here', () => {
    const p = buildPlan(AUDITION)

    expect(p.play?.title).toBe('Rehearse it, scored')
    expect(p.start.why).toBe(
      "You said telling if you're getting better is the hard part. Every take lands in Progress, so you can watch the line move.",
    )
  })

  it('sings the shy karaoke fan along', () => {
    expect(buildPlan(SHY).play?.title).toBe('Sing along, scored')
  })

  it('hands every card exactly the stop it opens, in order', () => {
    const p = buildPlan(AUDITION)

    expect(p.start).toEqual({
      kind: 'start',
      dest: 'sing',
      title: 'One take, then see it in Progress',
      why: "You said telling if you're getting better is the hard part. Every take lands in Progress, so you can watch the line move.",
      chips: ["Telling if I'm getting better"],
    })
    expect(p.learn).toEqual({
      kind: 'learn',
      dest: 'hearYourself',
      title: 'Keep a take for your teacher',
      why: 'You have a teacher. Keep takes to play them at your next lesson.',
      chips: ['A teacher'],
    })
    expect(p.play).toEqual({
      kind: 'play',
      dest: 'karaokeNight',
      title: 'Rehearse it, scored',
      why: 'You have a performance coming. Rehearse it with the band and see how you score.',
      chips: ['A performance or audition'],
    })
    expect(p.scope).toEqual({
      scope: 'singing',
      label: 'Show only singing in the menu',
    })
  })

  it('lists the stops in order and skips the ones the plan lacks', () => {
    const dests = (p: Plan) => planStops(p).map((s) => s.dest)

    expect(dests(buildPlan(AUDITION))).toEqual([
      'sing',
      'hearYourself',
      'karaokeNight',
    ])
    expect(dests(buildPlan(EAR))).toEqual(['earLab', 'lesson1'])
    expect(dests(build({ q1: 'guitar' }))).toEqual(['guitar'])
    expect(planStops(build({})).map((s) => s.kind)).toEqual(['start'])
  })

  it('titles the plan from the first and second answers', () => {
    expect(buildPlan(AUDITION).headline).toEqual({
      lead: 'Singing, ',
      lit: 'for the audition',
    })
    expect(buildPlan(FRIENDS).headline).toEqual({
      lead: 'A bit of everything, ',
      lit: 'with other people',
    })
    expect(build({}).headline).toEqual({
      lead: 'Your plan, ',
      lit: 'starting today',
    })
    expect(build({ q1: 'ear' }).headline.lead).toBe('Ear training, ')
  })

  it.each([
    ['singing', 'song', 'for the song you love'],
    ['singing', 'together', 'with other people'],
    ['singing', 'audition', 'for the audition'],
    ['singing', 'basics', 'from the basics up'],
    ['singing', 'fun', 'for the fun of it'],
    ['ear', 'tune', 'for singing in tune'],
    ['ear', 'intervals', 'for intervals and chords'],
    ['ear', 'exam', 'for the exam'],
    ['ear', 'by_ear', 'for playing by ear'],
    ['ear', 'curious', 'out of curiosity'],
  ] as const)('words a %s goal of %s as "%s"', (q1, q2, lit) => {
    expect(build({ q1, q2 }).headline.lit).toBe(lit)
  })
})

describe('Start here', () => {
  /** [first answer, hardest part, stop, title, why]: every cell of the approved table. */
  const START_CELLS: [
    q1: Instrument,
    pick: Q3Id | null,
    dest: PlanDest,
    title: string,
    why: string,
  ][] = [
    [
      'singing',
      'time',
      'homeSession',
      "Start today's session",
      "You said finding the time is the hard part. Today's session is one short guided workout, and Home keeps your streak.",
    ],
    [
      'singing',
      'progress',
      'sing',
      'One take, then see it in Progress',
      "You said telling if you're getting better is the hard part. Every take lands in Progress, so you can watch the line move.",
    ],
    [
      'singing',
      'what',
      'ascent',
      "Start this week's climb",
      'You said knowing what to practice is the hard part. The Ascent sets out each week, so you only have to start.',
    ],
    [
      'singing',
      'tune',
      'sing',
      'Sing and watch the pitch line',
      "You said hearing if you're in tune is the hard part. The line shows your pitch against the note while you sing.",
    ],
    [
      'singing',
      'setup',
      'sing',
      'Tap, sing, done',
      'You said setting up is the hard part. Sing needs your mic and one tap.',
    ],
    [
      'singing',
      'shy',
      'sing',
      'Sing where only you can hear',
      'You said you feel shy about your voice. Only you can hear you.',
    ],
    [
      'singing',
      null,
      'sing',
      'Sing one note, see the line',
      'Start where you can hear yourself.',
    ],
    [
      'guitar',
      'time',
      'guitar',
      'Play one song along',
      'You said finding the time is the hard part. One song is a whole session.',
    ],
    [
      'guitar',
      'progress',
      'guitarNight',
      'Play a song through, see the score',
      "You said telling if you're getting better is the hard part. Guitar Night scores every song you play through.",
    ],
    [
      'guitar',
      'what',
      'ascent',
      "Start this week's climb",
      'You said knowing what to practice is the hard part. The Ascent sets out each week, so you only have to start.',
    ],
    [
      'guitar',
      'tempo',
      'guitarNight',
      'Play a song through, see the score',
      'You said keeping time is the hard part. Guitar Night plays the band with you and scores the song.',
    ],
    [
      'guitar',
      'setup',
      'guitar',
      'Load a song and play',
      "You said setting up is the hard part. Load a song and play. That's the setup.",
    ],
    [
      'guitar',
      'alone',
      'guitarNight',
      'A song with its backing band',
      'You said practicing alone is the hard part. Guitar Night puts a band behind you.',
    ],
    [
      'guitar',
      null,
      'guitar',
      'Play one song along',
      'Start with one song you like.',
    ],
    [
      'piano',
      'time',
      'piano',
      'One song, falling notes',
      'You said finding the time is the hard part. One song is a whole session.',
    ],
    [
      'piano',
      'progress',
      'pianoNight',
      'Play a song through, see the score',
      "You said telling if you're getting better is the hard part. Piano Night scores every song you play through.",
    ],
    [
      'piano',
      'what',
      'ascent',
      "Start this week's climb",
      'You said knowing what to practice is the hard part. The Ascent sets out each week, so you only have to start.',
    ],
    [
      'piano',
      'tempo',
      'pianoNight',
      'Play a song through, see the score',
      'You said keeping time is the hard part. Piano Night plays the band with you and scores the song.',
    ],
    [
      'piano',
      'setup',
      'piano',
      'Load a song and play',
      "You said setting up is the hard part. Load a song and play. That's the setup.",
    ],
    [
      'piano',
      'alone',
      'pianoNight',
      'A song with its backing band',
      'You said practicing alone is the hard part. Piano Night puts a band behind you.',
    ],
    [
      'piano',
      null,
      'piano',
      'One song, falling notes',
      'Start with one song you like.',
    ],
    [
      'ear',
      'time',
      'earLab',
      "Today's regulation",
      "You said finding the time is the hard part. One short round a day: today's regulation.",
    ],
    [
      'ear',
      'progress',
      'earLab',
      'Your Mercury Index',
      "You said telling if you're getting better is the hard part. Ear Lab gives your ear one number, the Mercury Index, so you can watch it move.",
    ],
    [
      'ear',
      'what',
      'earLab',
      'Follow the Ear Path',
      'You said knowing what to practice is the hard part. The Ear Path puts the drills in order, so you only have to start.',
    ],
    [
      'ear',
      'difference',
      'earLab',
      'One drill',
      'You said hearing the difference is the hard part. One drill trains exactly that.',
    ],
    [
      'ear',
      'setup',
      'earLab',
      'One drill, one tap',
      'You said setting up is the hard part. A drill starts with one tap.',
    ],
    [
      'ear',
      'alone',
      'earLab',
      'One short drill',
      'You said practicing alone is the hard part. Start with one short drill.',
    ],
    [
      'ear',
      null,
      'earLab',
      'One drill',
      'Start with one drill and see what you hear.',
    ],
  ]

  it.each(START_CELLS)(
    'starts a %s question about "%s" at %s',
    (q1, pick, dest, title, why) => {
      const p = build({ q1, q3: pick ? [pick] : [] })

      expect(p.start).toMatchObject({ kind: 'start', dest, title, why })
    },
  )

  it('has a cell for every hardest part each column offers, and no other', () => {
    const cells = new Map(
      START_CELLS.map(([q1, pick, dest]) => [`${q1}/${pick}`, dest]),
    )
    const offered = (['singing', 'guitar', 'piano', 'ear'] as const).flatMap(
      (q1) =>
        [...q3Options(q1).map((o) => o.id), null]
          .filter((id) => id !== 'other')
          .map((id) => `${q1}/${id}`),
    )

    expect([...cells.keys()].sort()).toEqual(offered.sort())
  })

  it("names the answer that decided it as the card's chip", () => {
    expect(build({ q1: 'singing', q3: ['tune'] }).start.chips).toEqual([
      "Hearing if I'm in tune",
    ])
    expect(build({ q1: 'ear' }).start.chips).toEqual(['Ear training'])
    expect(build({ q1: 'everything' }).start.chips).toEqual([
      'A bit of everything',
    ])
    expect(build({}).start.chips).toEqual([])
  })

  it('sends a skipped first answer and "A bit of everything" down the Singing column', () => {
    for (const q1 of [null, 'everything'] as const) {
      expect(build({ q1, q3: ['shy'] }).start.title).toBe(
        'Sing where only you can hear',
      )
      expect(build({ q1 }).start.dest).toBe('sing')
    }
  })

  it('decides from the first hardest part, in the order tapped', () => {
    expect(build({ q1: 'singing', q3: ['what', 'time'] }).start.dest).toBe(
      'ascent',
    )
    expect(build({ q1: 'singing', q3: ['time', 'what'] }).start.dest).toBe(
      'homeSession',
    )
  })

  it('sends a guitarist who wants to see progress to Guitar Night', () => {
    const guitar = build({ q1: 'guitar', q3: ['progress'] })
    const piano = build({ q1: 'piano', q3: ['progress'] })

    expect(guitar.start.dest).toBe('guitarNight')
    expect(guitar.start.why).toMatch(
      /Guitar Night scores every song you play through\.$/u,
    )
    expect(piano.start.dest).toBe('pianoNight')
    expect(piano.start.why).toMatch(
      /Piano Night scores every song you play through\.$/u,
    )
  })

  it('never lets "Something else" decide', () => {
    expect(build({ q1: 'singing', q3: ['other', 'shy'] }).start.title).toBe(
      'Sing where only you can hear',
    )
    expect(build({ q1: 'singing', q3: ['other'] }).start.title).toBe(
      'Sing one note, see the line',
    )
  })

  it('counts a pick the first answer does not offer for nothing', () => {
    // 'shy' is for singers and 'tempo' for players: neither is offered to the ear.
    expect(build({ q1: 'ear', q3: ['shy', 'tempo', 'time'] }).start.title).toBe(
      "Today's regulation",
    )
    expect(build({ q1: 'guitar', q3: ['shy'] }).start.title).toBe(
      'Play one song along',
    )
  })
})

describe('Learn', () => {
  type Card = Pick<PlanStop, 'dest' | 'title' | 'why' | 'chips'> | null

  const LESSON_1_STARTING: Card = {
    dest: 'lesson1',
    title: 'What is a note?',
    why: "You're just starting, so start at the first note.",
    chips: ["Nothing yet, I'm just starting"],
  }
  const LESSON_1_VIDEO: Card = {
    dest: 'lesson1',
    title: 'What is a note?',
    why: 'You learn from video lessons. Ours are short films with Merc, and the first one starts at the first note.',
    chips: ['A video lesson'],
  }
  const TWELVE_NOTES = (chip: string): Card => ({
    dest: 'lesson2',
    title: 'Twelve notes',
    why: 'The notes every instrument shares, in one short film with Merc.',
    chips: [chip],
  })
  const CLIMB_FOR_WHAT: Card = {
    dest: 'ascent',
    title: "This week's climb",
    why: 'You said knowing what to practice is hard. The Ascent sets out each week.',
    chips: ['Knowing what to practice'],
  }
  const LESSON_1_BASICS: Card = {
    dest: 'lesson1',
    title: 'What is a note?',
    why: 'You want strong basics. Lesson 1 starts at the first note.',
    chips: ['Strong basics'],
  }
  const CLIMB_FOR_BASICS: Card = {
    dest: 'ascent',
    title: "This week's climb",
    why: 'You want strong basics. The Ascent builds them a week at a time.',
    chips: ['Strong basics'],
  }
  const TEACHER: Card = {
    dest: 'hearYourself',
    title: 'Keep a take for your teacher',
    why: 'You have a teacher. Keep takes to play them at your next lesson.',
    chips: ['A teacher'],
  }

  const CASES: [string, Partial<PlanChoices>, Card][] = [
    [
      'rule 1: a singer just starting',
      { q1: 'singing', q4: ['starting'] },
      LESSON_1_STARTING,
    ],
    [
      'rule 1: a singer who learns from video',
      { q1: 'singing', q4: ['video'] },
      LESSON_1_VIDEO,
    ],
    [
      'rule 1: ear training learns like a singer',
      { q1: 'ear', q4: ['video'] },
      LESSON_1_VIDEO,
    ],
    [
      'rule 1: "a bit of everything" learns like a singer',
      { q1: 'everything', q4: ['starting'] },
      LESSON_1_STARTING,
    ],
    [
      'rule 1: a skipped first answer learns like a singer',
      { q1: null, q4: ['starting'] },
      LESSON_1_STARTING,
    ],
    [
      'rule 2: a guitarist just starting',
      { q1: 'guitar', q4: ['starting'] },
      TWELVE_NOTES("Nothing yet, I'm just starting"),
    ],
    [
      'rule 2: a pianist who learns from video',
      { q1: 'piano', q4: ['video'] },
      TWELVE_NOTES('A video lesson'),
    ],
    [
      'rule 3: knowing what to practice, a singer',
      { q1: 'singing', q3: ['time', 'what'] },
      CLIMB_FOR_WHAT,
    ],
    [
      'rule 3: knowing what to practice, a guitarist',
      { q1: 'guitar', q3: ['time', 'what'] },
      CLIMB_FOR_WHAT,
    ],
    [
      'rule 3 over rule 4: what to practice outranks strong basics, a singer',
      { q1: 'singing', q2: 'basics', q3: ['time', 'what'] },
      CLIMB_FOR_WHAT,
    ],
    [
      'rule 3 over rule 4: what to practice outranks strong basics, a guitarist',
      { q1: 'guitar', q2: 'basics', q3: ['time', 'what'] },
      CLIMB_FOR_WHAT,
    ],
    [
      'rule 3 over rule 5: what to practice outranks a teacher',
      { q1: 'piano', q3: ['time', 'what'], q4: ['teacher'] },
      CLIMB_FOR_WHAT,
    ],
    [
      'rule 4: strong basics, a singer',
      { q1: 'singing', q2: 'basics' },
      LESSON_1_BASICS,
    ],
    [
      'rule 4: strong basics, a guitarist',
      { q1: 'guitar', q2: 'basics' },
      CLIMB_FOR_BASICS,
    ],
    ['rule 5: a teacher', { q1: 'piano', q4: ['teacher'] }, TEACHER],
    [
      'rule 6: nothing asks for one',
      { q1: 'singing', q2: 'fun', q4: ['app'] },
      null,
    ],
  ]

  it.each(CASES)('gives %s', (_, c, card) => {
    const learn = build(c).learn

    expect(learn).toEqual(card && { kind: 'learn', ...card })
  })

  it('reads the rules in order, and the first that fits wins', () => {
    const all: Partial<PlanChoices> = {
      q1: 'singing',
      q2: 'basics',
      q3: ['time', 'what'],
      q4: ['video', 'teacher'],
    }
    const chipsOf = (c: Partial<PlanChoices>) => build(c).learn?.chips

    // Each answer is taken away in turn, and the next rule in line wins.
    expect(chipsOf(all)).toEqual(['A video lesson'])
    expect(chipsOf({ ...all, q4: ['teacher'] })).toEqual([
      'Knowing what to practice',
    ])
    expect(chipsOf({ ...all, q3: ['time'], q4: ['teacher'] })).toEqual([
      'Strong basics',
    ])
    expect(
      chipsOf({ ...all, q2: 'fun', q3: ['time'], q4: ['teacher'] }),
    ).toEqual(['A teacher'])
    // Rule 3 does not fit, the Ascent being Start here, so rule 4 wins.
    expect(chipsOf({ ...all, q3: ['what'], q4: ['teacher'] })).toEqual([
      'Strong basics',
    ])
  })

  it('leaves out an Ascent card when the Ascent is already Start here', () => {
    expect(build({ q1: 'singing', q3: ['what'] }).learn).toBeNull()
    expect(build({ q1: 'guitar', q2: 'basics', q3: ['what'] }).learn).toBeNull()
  })

  it('reads on past an Ascent card the Ascent already covers', () => {
    expect(
      build({ q1: 'guitar', q2: 'basics', q3: ['what'], q4: ['teacher'] }).learn
        ?.dest,
    ).toBe('hearYourself')
  })
})

describe('Play', () => {
  type Card = Pick<PlanStop, 'dest' | 'title' | 'why' | 'chips'>

  const CASES: [string, Partial<PlanChoices>, Card][] = [
    [
      'an audition, singing',
      { q1: 'singing', q2: 'audition' },
      {
        dest: 'karaokeNight',
        title: 'Rehearse it, scored',
        why: 'You have a performance coming. Rehearse it with the band and see how you score.',
        chips: ['A performance or audition'],
      },
    ],
    [
      'a song, singing',
      { q1: 'singing', q2: 'song' },
      {
        dest: 'karaokeNight',
        title: 'Your song, scored',
        why: "You're working toward a song you love. Karaoke Night scores every note you sing.",
        chips: ['A song I love'],
      },
    ],
    [
      'just for fun, singing',
      { q1: 'singing', q2: 'fun' },
      {
        dest: 'karaokeNight',
        title: 'Sing along, scored',
        why: 'Sing your favorite songs at Karaoke Night and see how you score.',
        chips: ['Just for fun'],
      },
    ],
    [
      'singing along, singing',
      { q1: 'singing', q4: ['along'] },
      {
        dest: 'karaokeNight',
        title: 'Sing along, scored',
        why: 'Sing your favorite songs at Karaoke Night and see how you score.',
        chips: ['I sang along to songs'],
      },
    ],
    [
      'other people, singing',
      { q1: 'singing', q2: 'together' },
      {
        dest: 'jam',
        title: 'Sing with a friend',
        why: 'You want to sing with other people. Jam is for singing with a friend.',
        chips: ['Singing with other people'],
      },
    ],
    [
      'other people, everything',
      { q1: 'everything', q2: 'together' },
      {
        dest: 'jam',
        title: 'Sing with a friend',
        why: 'You want to sing with other people. Jam is for singing with a friend.',
        chips: ['Singing with other people'],
      },
    ],
    [
      'an audition, guitar',
      { q1: 'guitar', q2: 'audition' },
      {
        dest: 'guitarNight',
        title: 'Rehearse with the band',
        why: 'You have a performance coming. Rehearse with the band and see your score.',
        chips: ['A performance or audition'],
      },
    ],
    [
      'a song, guitar',
      { q1: 'guitar', q2: 'song' },
      {
        dest: 'guitarNight',
        title: 'A song with its backing band',
        why: "You're working toward a song you love. Guitar Night gives each song its band.",
        chips: ['A song I love'],
      },
    ],
    [
      'practicing alone, guitar',
      { q1: 'guitar', q3: ['time', 'alone'] },
      {
        dest: 'guitarNight',
        title: 'A song with its backing band',
        why: 'You said practicing alone is the hard part. Guitar Night puts a band behind you.',
        chips: ['Practicing alone'],
      },
    ],
    [
      'just for fun, guitar',
      { q1: 'guitar', q2: 'fun' },
      {
        dest: 'guitarNight',
        title: 'A song with its backing band',
        why: 'Guitar Night puts a band behind you and scores the song.',
        chips: ['Just for fun'],
      },
    ],
    [
      'playing along, guitar',
      { q1: 'guitar', q4: ['along'] },
      {
        dest: 'guitarNight',
        title: 'A song with its backing band',
        why: 'Guitar Night puts a band behind you and scores the song.',
        chips: ['I played along to songs'],
      },
    ],
    [
      'an audition, piano',
      { q1: 'piano', q2: 'audition' },
      {
        dest: 'pianoNight',
        title: 'Rehearse with the band',
        why: 'You have a performance coming. Rehearse with the band and see your score.',
        chips: ['A performance or audition'],
      },
    ],
    [
      'a song, piano',
      { q1: 'piano', q2: 'song' },
      {
        dest: 'pianoNight',
        title: 'A song with its backing band',
        why: "You're working toward a song you love. Piano Night gives each song its band.",
        chips: ['A song I love'],
      },
    ],
    [
      'practicing alone, piano',
      { q1: 'piano', q3: ['setup', 'alone'] },
      {
        dest: 'pianoNight',
        title: 'A song with its backing band',
        why: 'You said practicing alone is the hard part. Piano Night puts a band behind you.',
        chips: ['Practicing alone'],
      },
    ],
    [
      'just for fun, piano',
      { q1: 'piano', q2: 'fun' },
      {
        dest: 'pianoNight',
        title: 'A song with its backing band',
        why: 'Piano Night puts a band behind you and scores the song.',
        chips: ['Just for fun'],
      },
    ],
    [
      'playing along, piano',
      { q1: 'piano', q4: ['along'] },
      {
        dest: 'pianoNight',
        title: 'A song with its backing band',
        why: 'Piano Night puts a band behind you and scores the song.',
        chips: ['I played along to songs'],
      },
    ],
  ]

  it.each(CASES)('gives %s', (_, c, card) => {
    expect(build(c).play).toEqual({ kind: 'play', ...card })
  })

  it('reads the triggers in order: the goal, then practicing alone, then fun, then the sing-along', () => {
    expect(
      build({ q1: 'singing', q2: 'together', q4: ['along'] }).play?.dest,
    ).toBe('jam')
    expect(
      build({ q1: 'guitar', q2: 'song', q3: ['time', 'alone'] }).play?.chips,
    ).toEqual(['A song I love'])
    expect(
      build({ q1: 'singing', q2: 'fun', q4: ['along'] }).play?.chips,
    ).toEqual(['Just for fun'])
    expect(
      build({ q1: 'guitar', q2: 'fun', q3: ['time', 'alone'], q4: ['along'] })
        .play?.chips,
    ).toEqual(['Practicing alone'])
  })

  it('reads on past a "none" cell', () => {
    expect(
      build({ q1: 'guitar', q2: 'together', q4: ['along'] }).play?.dest,
    ).toBe('guitarNight')
    expect(build({ q1: 'guitar', q2: 'together' }).play).toBeNull()
  })

  it('has no Play card for ear training', () => {
    expect(
      build({ q1: 'ear', q2: 'tune', q3: ['alone'], q4: ['along'] }).play,
    ).toBeNull()
  })

  it('leaves out a Play card that repeats Start here', () => {
    expect(build({ q1: 'guitar', q2: 'song', q3: ['tempo'] }).play).toBeNull()
    expect(build({ q1: 'piano', q2: 'fun', q3: ['alone'] }).play).toBeNull()
  })
})

describe('the voiceprint', () => {
  it('takes the stops pickFirstStop really returns', () => {
    const solid = {
      accuracy: { score: 90 },
      steadiness: { score: 90 },
      range: { semitones: 18 },
    }
    const measured = (over: object) => ({ ...solid, ...over }) as MirrorResult

    expect(pickFirstStop(measured({ steadiness: { score: 40 } }))).toEqual(
      LONG_NOTE,
    )
    expect(pickFirstStop(measured({ range: { semitones: 8 } }))).toEqual(
      RANGE_WEEK,
    )
    expect(pickFirstStop(measured({}))).toEqual(SONG_READY)
    expect(NO_FINDING.room).toBe('practice')
  })

  it('lets the voiceprint lead a voice question', () => {
    const p = build({ q1: 'singing', q3: ['tune'] }, { voiceprint: LONG_NOTE })

    expect(p.start.dest).toBe('exercises')
    expect(p.start.title).toBe('Long Note')
    expect(p.start.why).toBe(
      "Your tone wavers when you hold. Let's steady it. You said hearing if you're in tune is the hard part.",
    )
    expect(p.start.chips).toEqual(['Your voiceprint', "Hearing if I'm in tune"])
  })

  it.each([['progress'], ['what'], ['tune']] as const)(
    'leads a question about "%s"',
    (pick) => {
      expect(
        build({ q1: 'singing', q3: [pick] }, { voiceprint: LONG_NOTE }).start
          .dest,
      ).toBe('exercises')
    },
  )

  it('leads when nothing was picked, and says only what it found', () => {
    const p = build({ q1: 'singing' }, { voiceprint: LONG_NOTE })

    expect(p.start).toEqual({
      kind: 'start',
      dest: 'exercises',
      title: 'Long Note',
      why: "Your tone wavers when you hold. Let's steady it.",
      chips: ['Your voiceprint'],
    })
  })

  it('leads past "Something else", which never decides', () => {
    expect(
      build({ q1: 'singing', q3: ['other'] }, { voiceprint: LONG_NOTE }).start
        .dest,
    ).toBe('exercises')
  })

  it('opens the Ascent for a narrow range and Karaoke Night for a solid voice', () => {
    const range = build({ q1: 'singing' }, { voiceprint: RANGE_WEEK })
    const ready = build({ q1: 'singing' }, { voiceprint: SONG_READY })

    expect([range.start.dest, range.start.title]).toEqual([
      'ascent',
      'Range week',
    ])
    expect([ready.start.dest, ready.start.title]).toEqual([
      'karaokeNight',
      'Sing along, scored',
    ])
    expect(ready.start.why).toBe(
      "That was solid. You're ready to sing a real song.",
    )
  })

  it('moves the voiceprint to the Learn card for a habit question', () => {
    const p = build(
      { q1: 'singing', q3: ['time'], q4: ['starting'] },
      { voiceprint: LONG_NOTE },
    )

    expect(p.start.dest).toBe('homeSession')
    expect(p.learn?.why).toBe(
      "You're just starting, so start at the first note. Your tone wavers when you hold. Let's steady it.",
    )
    expect(p.learn?.why).toMatch(/Let's steady it\.$/u)
  })

  it.each([['time'], ['setup'], ['shy']] as const)(
    'lets the table win a question about "%s"',
    (pick) => {
      const withVoiceprint = build(
        { q1: 'singing', q3: [pick] },
        { voiceprint: LONG_NOTE },
      )

      expect(withVoiceprint.start).toEqual(
        build({ q1: 'singing', q3: [pick] }).start,
      )
    },
  )

  it('moves it to the Play card when there is no Learn card', () => {
    const p = build(
      { q1: 'singing', q2: 'fun', q3: ['shy'] },
      { voiceprint: LONG_NOTE },
    )

    expect(p.learn).toBeNull()
    expect(p.play?.dest).toBe('karaokeNight')
    expect(p.play?.why).toBe(
      "Sing your favorite songs at Karaoke Night and see how you score. Your tone wavers when you hold. Let's steady it.",
    )
  })

  it('drops it when the plan has neither card', () => {
    const p = build({ q1: 'singing', q3: ['setup'] }, { voiceprint: LONG_NOTE })

    expect([p.learn, p.play]).toEqual([null, null])
    expect(JSON.stringify(p)).not.toContain('steady')
  })

  it('puts it on the Learn card, not on both', () => {
    const p = build(
      { q1: 'singing', q2: 'fun', q3: ['time'], q4: ['starting'] },
      { voiceprint: LONG_NOTE },
    )

    expect(p.learn?.why).toContain('steady')
    expect(p.play?.why).not.toContain('steady')
  })

  it('counts for "A bit of everything" and for a skipped first answer, which read the Singing column', () => {
    for (const q1 of ['everything', null] as const) {
      expect(build({ q1 }, { voiceprint: LONG_NOTE }).start.dest).toBe(
        'exercises',
      )
    }
  })

  it('ignores the voiceprint for guitar, piano and ear', () => {
    for (const q1 of ['guitar', 'piano', 'ear'] as const) {
      for (const pick of [null, 'progress', 'what', 'time'] as const) {
        // Ear training has goals of its own: "A song I love" is not one.
        const c: Partial<PlanChoices> = {
          q1,
          q2: q1 === 'ear' ? 'tune' : 'song',
          q3: pick ? [pick] : [],
          q4: ['starting'],
        }
        for (const voiceprint of FINDINGS) {
          expect(build(c, { voiceprint })).toEqual(build(c))
        }
      }
    }
  })

  it('ignores a voiceprint with no finding', () => {
    const c: Partial<PlanChoices> = {
      q1: 'singing',
      q2: 'song',
      q3: ['progress'],
      q4: ['starting'],
    }

    expect(build(c, { voiceprint: NO_FINDING })).toEqual(build(c))
    expect(build(c, { voiceprint: null })).toEqual(build(c))
    expect(
      build({ q1: 'singing' }, { voiceprint: NO_FINDING }).start.dest,
    ).toBe('sing')
  })

  it('does not ask for a Karaoke Night Play card when Karaoke Night is Start here', () => {
    const p = build({ q1: 'singing', q2: 'song' }, { voiceprint: SONG_READY })

    expect(p.start.dest).toBe('karaokeNight')
    expect(p.play).toBeNull()
    expect(
      build(
        { q1: 'singing', q2: 'fun', q4: ['along'] },
        { voiceprint: SONG_READY },
      ).play,
    ).toBeNull()
  })

  it('still offers Jam beside a Karaoke Night start', () => {
    expect(
      build({ q1: 'singing', q2: 'together' }, { voiceprint: SONG_READY }).play
        ?.dest,
    ).toBe('jam')
  })

  it('reads Learn against the stop Start here really is', () => {
    const asked: Partial<PlanChoices> = { q1: 'singing', q3: ['what'] }

    // A narrow range opens the Ascent itself, so there is no Ascent card too.
    expect(build(asked, { voiceprint: RANGE_WEEK }).start.dest).toBe('ascent')
    expect(build(asked, { voiceprint: RANGE_WEEK }).learn).toBeNull()
    // Anything else leaves the question unanswered, so the Ascent comes as Learn.
    expect(build(asked, { voiceprint: LONG_NOTE }).start.dest).toBe('exercises')
    expect(build(asked, { voiceprint: LONG_NOTE }).learn?.dest).toBe('ascent')
    // It led, so what it found is on Start here and not on the Learn card too.
    expect(build(asked, { voiceprint: LONG_NOTE }).learn?.why).toBe(
      'You said knowing what to practice is hard. The Ascent sets out each week.',
    )
  })

  it.each<[when: string, q3: Q3Id[]]>([
    ['a voice question', ['tune']],
    ['no question', []],
  ])(
    'says what it found once: a Play card keeps its own line when it leads on %s',
    (_, q3) => {
      const p = build(
        { q1: 'singing', q2: 'fun', q3 },
        { voiceprint: LONG_NOTE },
      )

      expect(p.start.title).toBe('Long Note')
      expect(p.learn).toBeNull()
      expect(p.play?.why).toBe(
        'Sing your favorite songs at Karaoke Night and see how you score.',
      )
    },
  )

  it('does not change a plan the voiceprint left to the table', () => {
    expect(
      build({ q1: 'singing', q3: ['time'] }, { voiceprint: SONG_READY }),
    ).toEqual(build({ q1: 'singing', q3: ['time'] }))
  })
})

describe('the menu', () => {
  it('offers the one instrument the first answer names, and no other', () => {
    const offer = (q1: Q1Answer | null) => build({ q1 }).scope

    expect(offer('guitar')).toEqual({
      scope: 'guitar',
      label: 'Show only guitar in the menu',
    })
    expect(offer('piano')?.label).toBe('Show only piano in the menu')
    expect(offer('singing')?.label).toBe('Show only singing in the menu')
    expect(offer('ear')).toBeNull()
    expect(offer('everything')).toBeNull()
    expect(offer(null)).toBeNull()
  })

  it('does not offer the menu the person already has', () => {
    const view: PlanView = { scope: 'guitar', mode: 'advanced' }

    expect(build({ q1: 'guitar' }, { view }).scope).toBeNull()
    expect(build({ q1: 'piano' }, { view }).scope?.scope).toBe('piano')
  })

  it('drops a Jam stop that Simple mode hides', () => {
    const friends = choices({
      q1: 'everything',
      q2: 'together',
      q3: ['time'],
      q4: ['starting'],
    })

    expect(buildPlan(friends).play?.dest).toBe('jam')
    expect(buildPlan(friends, { view: SIMPLE }).play).toBeNull()
  })

  it('drops a Jam stop a narrower menu hides, and keeps it under Singing', () => {
    const together = choices({ q1: 'singing', q2: 'together' })

    expect(buildPlan(together, { view: GUITAR_ONLY }).play).toBeNull()
    expect(
      buildPlan(together, { view: { scope: 'singing', mode: 'advanced' } }).play
        ?.dest,
    ).toBe('jam')
  })

  it('keeps a page stop under every menu, since a page is not in the menu', () => {
    const night = choices({ q1: 'singing', q2: 'fun' })

    for (const view of VIEWS) {
      expect(buildPlan(night, { view }).play?.dest).toBe('karaokeNight')
    }
  })

  it('never drops Start here: the screen opens it by widening the menu', () => {
    const c = choices({ q1: 'singing', q3: ['tune'] })

    expect(buildPlan(c, { view: GUITAR_ONLY }).start.dest).toBe('sing')
    expect(buildPlan(c, { view: SIMPLE }).start.dest).toBe('sing')
  })

  it('offers the switch beside a dropped stop when the rest stay in the menu', () => {
    const p = buildPlan(choices({ q1: 'singing', q2: 'together' }), {
      view: GUITAR_ONLY,
    })

    expect(p.play).toBeNull()
    expect(p.scope?.scope).toBe('singing')
  })

  it('carries the voiceprint to the card that is left, not the one the menu dropped', () => {
    const c = choices({ q1: 'singing', q2: 'together', q3: ['setup'] })
    const shown = buildPlan(c, { voiceprint: LONG_NOTE })
    const trimmed = buildPlan(c, { voiceprint: LONG_NOTE, view: SIMPLE })

    expect(shown.play?.why).toContain('steady')
    expect(trimmed.play).toBeNull()
    expect(JSON.stringify(trimmed)).not.toContain('steady')
  })
})

describe('the plan as a value', () => {
  /** Freezes a value and everything inside it, so a write throws. */
  function deepFreeze<T>(value: T): T {
    if (typeof value === 'object' && value !== null) {
      Object.values(value).forEach(deepFreeze)
      Object.freeze(value)
    }
    return value
  }

  it('builds from the empty choice, which is frozen', () => {
    const p = buildPlan(EMPTY_CHOICES)

    expect(p.start.dest).toBe('sing')
    expect(p.learn).toBeNull()
    expect(p.play).toBeNull()
    expect(p.scope).toBeNull()
  })

  it('never writes to what it is given', () => {
    const given = deepFreeze({
      c: choices({
        q1: 'singing',
        q2: 'audition',
        q3: ['progress', 'tune'],
        q4: ['teacher'],
      }),
      voiceprint: { ...LONG_NOTE },
      view: { ...ADVANCED },
    })
    const before = JSON.stringify(given)

    expect(() =>
      buildPlan(given.c, { voiceprint: given.voiceprint, view: given.view }),
    ).not.toThrow()
    expect(JSON.stringify(given)).toBe(before)
  })

  it('hands out new objects each time, so a screen can edit its plan', () => {
    const c = choices({ q1: 'singing', q3: ['tune'] })
    const first = buildPlan(c)

    first.start.chips.push('edited')
    first.start.title = 'edited'

    expect(buildPlan(c).start.chips).toEqual(["Hearing if I'm in tune"])
    expect(buildPlan(c).start.title).toBe('Sing and watch the pitch line')
  })

  it('hands out a new, empty chip list for a card nothing was said to make', () => {
    buildPlan(EMPTY_CHOICES).start.chips.push('edited')

    expect(buildPlan(EMPTY_CHOICES).start.chips).toEqual([])
  })

  it('reads a choice with fields left out the way the questions settle it', () => {
    const partial = { q1: 'guitar', q3: ['progress'] } as PlanChoices

    expect(buildPlan(partial).start.dest).toBe('guitarNight')
  })

  it('does not stop at an answer the first answer no longer offers', () => {
    const stale: PlanChoices = {
      q1: 'ear',
      q2: 'basics',
      q3: ['shy', 'other'],
      q4: ['along'],
    }

    expect(() => buildPlan(stale)).not.toThrow()
    expect(buildPlan(stale).start.title).toBe('One drill')
  })
})

describe('where the stops go', () => {
  /** A released lesson: `learn/NN.html` is on disk and NN is not a draft. */
  function releasedLesson(
    href: string,
    drafts: Readonly<Partial<Record<number, string>>> = DRAFT_LESSONS,
  ): boolean {
    const number = /^\/learn\/(\d{2})$/u.exec(href)?.[1]
    return (
      number !== undefined &&
      existsSync(`learn/${number}.html`) &&
      drafts[Number(number)] === undefined
    )
  }

  const PAGES = ENTRY_PAGES.flatMap((page) => [...page.paths])

  it('points every stop at a real tab or page', () => {
    const wrong = Object.entries(PLAN_DESTS).flatMap(([dest, d]) => {
      const { target } = d
      const found: string[] = []
      if (target.kind === 'tab' && !TAB_ORDER.includes(target.tab)) {
        found.push(`${dest}: ${target.tab} is not a tab in the menu`)
      }
      if (
        target.kind === 'page' &&
        !PAGES.includes(target.href) &&
        !releasedLesson(target.href)
      ) {
        found.push(`${dest}: ${target.href} is not a page`)
      }
      if (!existsSync(`public${d.cover}`)) {
        found.push(`${dest}: ${d.cover} is not in public/`)
      }
      return found
    })

    expect(wrong).toEqual([])
  })

  it('names the rooms as the approved plan does', () => {
    expect(
      Object.fromEntries(
        Object.entries(PLAN_DESTS).map(([dest, d]) => [dest, d.room]),
      ),
    ).toEqual({
      homeSession: 'Home',
      sing: 'Sing',
      exercises: 'Exercises',
      ascent: 'The Ascent',
      guitar: 'Guitar',
      piano: 'Piano',
      guitarNight: 'Guitar Night',
      pianoNight: 'Piano Night',
      earLab: 'Ear Lab',
      karaokeNight: 'Karaoke Night',
      jam: 'Jam',
      lesson1: 'Lesson 1',
      lesson2: 'Lesson 2',
      hearYourself: 'Hear Yourself',
    })
  })

  it('opens the tabs and pages the plan table says', () => {
    expect(
      Object.fromEntries(
        Object.entries(PLAN_DESTS).map(([dest, d]) => [
          dest,
          d.target.kind === 'tab' ? d.target.tab : d.target.href,
        ]),
      ),
    ).toEqual({
      homeSession: 'home',
      sing: 'singing',
      exercises: 'exercises',
      ascent: 'path',
      guitar: 'guitar',
      piano: 'piano',
      earLab: 'ear-lab',
      jam: 'jam',
      hearYourself: 'voice-history',
      guitarNight: '/guitar-night',
      pianoNight: '/piano-night',
      karaokeNight: '/karaoke',
      lesson1: '/learn/01',
      lesson2: '/learn/02',
    })
  })

  it('pictures a stop with the Map room where there is one, then the first-question card, then its own art', () => {
    expect(
      Object.fromEntries(
        Object.entries(PLAN_DESTS).map(([dest, d]) => [dest, d.cover]),
      ),
    ).toEqual({
      homeSession: '/onboarding/rooms/practice-800.webp',
      sing: '/onboarding/rooms/practice-800.webp',
      exercises: '/onboarding/rooms/exercises-800.webp',
      ascent: '/onboarding/rooms/ascent-800.webp',
      guitar: '/onboarding/plan/q1-guitar.webp',
      piano: '/onboarding/plan/q1-piano.webp',
      earLab: '/onboarding/plan/q1-ear.webp',
      jam: '/onboarding/rooms/jam-800.webp',
      hearYourself: '/home/hear-yourself-tease.webp',
      guitarNight: '/guitar-night/velvet-rehearsal-card-880.webp',
      pianoNight: '/piano-night/afterglow-studio-landscape-card-880.webp',
      karaokeNight: '/onboarding/rooms/karaoke-800.webp',
      lesson1: '/learn/lesson-01-og.jpg',
      lesson2: '/learn/lesson-02-og.jpg',
    })
  })

  it('uses the same card for an instrument as its first question does', () => {
    const art = (id: Instrument) => INSTRUMENTS.find((i) => i.id === id)?.art

    expect([
      PLAN_DESTS.guitar.cover,
      PLAN_DESTS.piano.cover,
      PLAN_DESTS.earLab.cover,
    ]).toEqual([art('guitar'), art('piano'), art('ear')])
  })

  it('tells a released lesson from a draft, a missing one and another page', () => {
    expect(releasedLesson('/learn/01')).toBe(true)
    expect(releasedLesson('/learn/01', { 1: 'waiting on a sign-off' })).toBe(
      false,
    )
    expect(releasedLesson('/learn/99')).toBe(false)
    expect(releasedLesson('/guitar-night')).toBe(false)
    expect(releasedLesson('/learn/1')).toBe(false)
  })

  it('does not point at a draft lesson', () => {
    const drafts = Object.keys(DRAFT_LESSONS).map((n) => n.padStart(2, '0'))
    const hrefs = Object.values(PLAN_DESTS).flatMap((d) =>
      d.target.kind === 'page' ? [d.target.href] : [],
    )

    expect(
      hrefs.filter((href) => drafts.some((n) => href === `/learn/${n}`)),
    ).toEqual([])
  })
})

/** Every ordered selection of up to `max` different ids, none included. */
function selections<T>(ids: readonly T[], max: number): T[][] {
  if (max === 0) return [[]]
  const shorter = selections(ids, max - 1)
  const longer = shorter
    .filter((picked) => picked.length === max - 1)
    .flatMap((picked) =>
      ids.filter((id) => !picked.includes(id)).map((id) => [...picked, id]),
    )
  return [...shorter, ...longer]
}

/** Every mix of the ids, the empty one first. */
function subsets<T>(ids: readonly T[]): T[][] {
  return ids.reduce<T[][]>(
    (mixes, id) => [...mixes, ...mixes.map((mix) => [...mix, id])],
    [[]],
  )
}

/**
 * Q4 as a person can leave it: any mix of four answers, or "Nothing yet"
 * alone. The plan's rules do not read the order of Q4's taps, so each mix is
 * listed once.
 */
const Q4_SETS: Q4Id[][] = [
  ...subsets<Q4Id>(['video', 'teacher', 'app', 'along']),
  ['starting'],
]

const Q1_ANSWERS: (Q1Answer | null)[] = [
  null,
  'singing',
  'guitar',
  'piano',
  'ear',
  'everything',
]

/** Every answer a person can give: Q1 or skipped, each Q2 or skipped, Q3 up to its limit, any Q4. */
function everyAnswer(): PlanChoices[] {
  return Q1_ANSWERS.flatMap((q1) =>
    [null, ...q2Options(q1).map((o) => o.id)].flatMap((q2) =>
      selections(
        q3Options(q1).map((o) => o.id),
        Q3_MAX,
      ).flatMap((q3) => Q4_SETS.map((q4) => ({ q1, q2, q3, q4 }))),
    ),
  )
}

describe('every answer', () => {
  /** What is wrong with a plan, in words, or nothing. */
  function problemsWith(c: PlanChoices, view: PlanView, p: Plan): string[] {
    const found: string[] = []
    const stops = planStops(p)
    const tabs = (stop: PlanStop) => tabOf(stop.dest)
    const hiddenUnder = (
      stop: PlanStop,
      scope: PlanView['scope'],
      mode: PlanView['mode'],
    ) => {
      const tab = tabs(stop)
      return tab !== null && !isTabVisible(tab, scope, mode)
    }

    for (const stop of [p.learn, p.play]) {
      if (stop && hiddenUnder(stop, view.scope, view.mode)) {
        found.push(`${stop.kind} ${stop.dest} is hidden by the menu`)
      }
    }
    if (hiddenUnder(p.start, 'all', view.mode)) {
      found.push(`start ${p.start.dest} is hidden in ${view.mode} mode`)
    }
    if (p.scope) {
      for (const stop of stops) {
        if (hiddenUnder(stop, p.scope.scope, view.mode)) {
          found.push(`${stop.dest} leaves the menu under ${p.scope.scope}`)
        }
      }
    }
    if (
      (c.q1 === 'guitar' || c.q1 === 'piano' || c.q1 === 'ear') &&
      stops.some((s) =>
        ['sing', 'exercises', 'jam', 'karaokeNight'].includes(s.dest),
      )
    ) {
      found.push(`${c.q1} is sent to a singing room`)
    }
    if (new Set(stops.map((s) => s.dest)).size !== stops.length) {
      found.push('two cards open the same stop')
    }
    const offered =
      (c.q1 === 'singing' || c.q1 === 'guitar' || c.q1 === 'piano') &&
      view.scope !== c.q1
    if (offered !== (p.scope !== null)) {
      found.push(
        offered ? 'the switch was not offered' : 'the switch was offered',
      )
    }
    return found
  }

  it('offers the scope switch only when every stop stays in the menu', () => {
    // Today every tab a plan opens is in its own instrument's menu, so the
    // switch is offered whenever the person's menu is wider. When a tab moves
    // out of an instrument's scope, this is the test that names the plans
    // that change.
    const answers = everyAnswer()
    const wrong: string[] = []

    for (const view of VIEWS) {
      for (const c of answers) {
        const problems = problemsWith(c, view, buildPlan(c, { view }))
        if (problems.length > 0) {
          wrong.push(
            `${JSON.stringify(c)} under ${JSON.stringify(view)}: ${problems.join('; ')}`,
          )
        }
      }
    }

    // The answers are all different, and there are many of them.
    expect(new Set(answers.map((c) => JSON.stringify(c))).size).toBe(
      answers.length,
    )
    expect(answers.length).toBeGreaterThan(30000)
    expect(wrong.slice(0, 10)).toEqual([])
  })

  it('holds with a voiceprint beside the answers, and reaches every stop', () => {
    const reached = new Set<PlanDest>()
    const wrong: string[] = []

    for (const voiceprint of [...FINDINGS, NO_FINDING]) {
      for (const view of [ADVANCED, SIMPLE]) {
        for (const c of everyAnswer()) {
          const p = buildPlan(c, { voiceprint, view })
          planStops(p).forEach((s) => reached.add(s.dest))
          const problems = problemsWith(c, view, p)
          if (problems.length > 0) {
            wrong.push(
              `${JSON.stringify(c)} with ${voiceprint.room} under ${view.mode}: ${problems.join('; ')}`,
            )
          }
        }
      }
    }

    expect(wrong.slice(0, 10)).toEqual([])
    expect([...reached].sort()).toEqual(Object.keys(PLAN_DESTS).sort())
  })

  it('keeps every word the plan says to the copy rules', () => {
    const words = new Set<string>()
    for (const view of [ADVANCED, GUITAR_ONLY]) {
      for (const c of everyAnswer()) {
        for (const voiceprint of [undefined, ...FINDINGS]) {
          const p = buildPlan(c, { voiceprint, view })
          words.add(p.headline.lead)
          words.add(p.headline.lit)
          if (p.scope) words.add(p.scope.label)
          for (const s of planStops(p)) {
            words.add(s.title)
            words.add(s.why)
            s.chips.forEach((chip) => words.add(chip))
          }
        }
      }
    }
    const all = [...words]

    expect(all.length).toBeGreaterThan(150)
    expect(all.filter((w) => w.includes('—'))).toEqual([])
    expect(all.filter((w) => /practis/iu.test(w))).toEqual([])
    expect(all.filter((w) => w.trim() === '' && w !== '')).toEqual([])
  })

  it('gives every card a title and a reason', () => {
    const empty = everyAnswer().flatMap((c) =>
      planStops(buildPlan(c, { voiceprint: LONG_NOTE })).filter(
        (s) => s.title === '' || s.why === '',
      ),
    )

    expect(empty).toEqual([])
  })
})

describe('the store build', () => {
  /** The words assert-bundle.mjs rejects from a store binary, read from it. */
  const checker = readFileSync(
    'apps/mercurypitch/scripts/assert-bundle.mjs',
    'utf8',
  )

  function listed(name: 'FORBIDDEN' | 'LAUNCH_OFFER' | 'PLAN_WORDS'): string[] {
    const body =
      new RegExp(`const ${name} = \\[([\\s\\S]*?)\\n\\]`, 'u').exec(
        checker,
      )?.[1] ?? ''
    return [...body.matchAll(/^\s*\[\s*'([^']+)'/gmu)].map((m) => m[1])
  }
  const STORE_ONLY = [...listed('FORBIDDEN'), ...listed('LAUNCH_OFFER')]
  const found = (text: string) =>
    STORE_ONLY.filter((word) => text.includes(word))

  it('reads all ten words the store check rejects', () => {
    expect(STORE_ONLY).toEqual(
      expect.arrayContaining([
        'Stripe',
        'credit packs',
        'extra credits',
        'Karaoke Night credits',
        'stripe.com',
        'ko-fi.com',
        'github.com/sponsors',
        'mp.launchGift',
        'Try one in Karaoke Night',
        'mp.launchOffer',
      ]),
    )
    expect(STORE_ONLY.length).toBeGreaterThanOrEqual(10)
  })

  it('knows a store-only word when it sees one', () => {
    expect(found('Buy extra credits with Stripe')).toEqual(
      expect.arrayContaining(['Stripe', 'extra credits']),
    )
    expect(found('Sing along, scored')).toEqual([])
  })

  // The plan's words are the other list: the plan has them, and the native
  // bundle, which has no plan, must not (assert-bundle.mjs, PLAN_WORDS).
  describe('the plan words', () => {
    const PLAN_WORDS = listed('PLAN_WORDS')

    const planSources = () =>
      readdirSync('src/features/plan')
        .filter(
          (name) =>
            /\.(tsx?|css)$/u.test(name) &&
            !/\.(test|fixture)\.tsx?$/u.test(name),
        )
        .map((name) => readFileSync(`src/features/plan/${name}`, 'utf8'))

    /** What a build could carry from outside the plan: not a test, a spec or a fixture, and not the plan. */
    function outsideThePlan(): string[] {
      return ['src', 'apps/mercurypitch/src'].flatMap((root) =>
        readdirSync(root, { recursive: true, encoding: 'utf8' })
          .filter(
            (name) =>
              /\.(tsx?|css|json|md|vtt|svg|html)$/u.test(name) &&
              !/\.(test|spec|fixture)\./u.test(name) &&
              !`${root}/${name}`.startsWith('src/features/plan/') &&
              !`${root}/${name}`.startsWith('src/e2e/'),
          )
          .map((name) => `${root}/${name}`)
          .filter((file) => statSync(file).isFile()),
      )
    }

    it('are the three the native check rejects, read from it', () => {
      expect(PLAN_WORDS).toEqual([
        'mp.plan.text.v1',
        'Change my answers',
        'Four quick questions',
      ])
    })

    it('are checked: a loop over the list stands in the checker', () => {
      expect(checker).toMatch(/for \(const \[needle, what\] of PLAN_WORDS\)/u)
    })

    it('are each in the plan, so the list cannot guard a word that was renamed away', () => {
      const plan = planSources().join('\n')

      expect(PLAN_WORDS.length).toBeGreaterThan(0)
      expect(PLAN_WORDS.filter((word) => !plan.includes(word))).toEqual([])
    })

    it('are in nothing outside the plan, so a native bundle that holds one holds the plan', () => {
      const files = outsideThePlan()
      const wrong = files.flatMap((file) => {
        const text = readFileSync(file, 'utf8')
        return PLAN_WORDS.filter((word) => text.includes(word)).map(
          (word) => `${file} says "${word}"`,
        )
      })

      expect(PLAN_WORDS.length).toBeGreaterThan(0)
      expect(files.length).toBeGreaterThan(1000)
      expect(files).toContain('src/components/GuideSelection.tsx')
      expect(wrong).toEqual([])
    })
  })

  it('keeps store-only words out of the plan copy', () => {
    const sources = readdirSync('src/features/plan').filter(
      (name) => /\.(tsx?|css)$/u.test(name) && !/\.test\.tsx?$/u.test(name),
    )
    const wrong = sources.flatMap((name) =>
      found(readFileSync(`src/features/plan/${name}`, 'utf8')).map(
        (word) => `${name} says "${word}"`,
      ),
    )

    expect(sources).toEqual(
      expect.arrayContaining([
        'build-plan.ts',
        'plan-copy.ts',
        'questions.ts',
        'plan-keys.ts',
      ]),
    )
    expect(wrong).toEqual([])
  })
})
