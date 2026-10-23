// ============================================================
// Plan questions — what each instrument is asked
// ============================================================
//
// Pins the approved copy and the rules around it. The approved lines are
// the source of truth, so every label and line that changes with the
// instrument is checked word for word, and one that drifts fails here: a
// wording change is made on purpose, in questions.ts and in this file. The
// rules are which options each instrument is offered and what a new first
// answer does to the picks already made. Every label and line of every
// column, shared ones included, is also held to the owner's two copy rules:
// no em dash, and "practice", never "practise". Two blocks guard what a
// later edit could break without a screen showing it: the shared empty
// choice and the storage keys. The import boundaries are in
// pure-modules.test.ts.

import { existsSync } from 'node:fs'
import { createStore } from 'solid-js/store'
import { describe, expect, it } from 'vitest'
import { PLAN_CARD_DISMISSED_KEY, PLAN_OPENED_KEY, PLAN_RECORD_KEY, PLAN_TEXT_KEY, } from './plan-keys'
import type { PlanChoices, PlanOption, Q1Answer, Q2Id } from './questions'
import { EMPTY_CHOICES, EVERYTHING, INSTRUMENTS, MERC_INTRO, planColumn, pruneChoices, q1Label, q2Options, Q3_MAX, q3Options, q4Options, } from './questions'

/** Every first answer, a skipped Q1 included. */
const Q1_ANSWERS: readonly (Q1Answer | null)[] = [
  'singing',
  'guitar',
  'piano',
  'ear',
  'everything',
  null,
]

/** The three option lists, so one check can run on each of them. */
const OPTION_LISTS: [string, (q1: Q1Answer | null) => PlanOption<string>[]][] =
  [
    ['Q2', q2Options],
    ['Q3', q3Options],
    ['Q4', q4Options],
  ]

const lineOf = (options: PlanOption<string>[], id: string): string =>
  options.find((o) => o.id === id)!.line

describe('the first question', () => {
  it('offers the four instruments in order, then "A bit of everything"', () => {
    expect(INSTRUMENTS.map((i) => i.id)).toEqual([
      'singing',
      'guitar',
      'piano',
      'ear',
    ])
    expect(EVERYTHING.id).toBe('everything')
  })

  it('names each answer', () => {
    expect(
      (['singing', 'guitar', 'piano', 'ear', 'everything'] as const).map((q1) =>
        q1Label(q1),
      ),
    ).toEqual([
      'Singing',
      'Guitar',
      'Piano',
      'Ear training',
      'A bit of everything',
    ])
  })

  it('sends "A bit of everything" and a skipped answer down the Singing column', () => {
    expect(Q1_ANSWERS.map((q1) => planColumn(q1))).toEqual([
      'singing',
      'guitar',
      'piano',
      'ear',
      'singing',
      'singing',
    ])
  })

  it('points every instrument at a painting that is in public/', () => {
    const missing = INSTRUMENTS.filter((i) => !existsSync(`public${i.art}`))
    expect(missing.map((i) => i.art)).toEqual([])
  })

  it('greets a returning visitor with a line of their own', () => {
    expect(MERC_INTRO.q1Returning).toBe(
      "New in Mercury Pitch: four taps and I'll show you what fits.",
    )
    expect(MERC_INTRO.q1Returning).not.toBe(MERC_INTRO.q1)
  })

  it('lets a person name two things that get in the way', () => {
    expect(Q3_MAX).toBe(2)
  })
})

describe('the empty choice', () => {
  it('starts with nothing picked', () => {
    expect(EMPTY_CHOICES).toEqual({ q1: null, q2: null, q3: [], q4: [] })
  })

  it('is frozen, arrays included, so one caller cannot change it for the rest', () => {
    expect(Object.isFrozen(EMPTY_CHOICES)).toBe(true)
    expect(Object.isFrozen(EMPTY_CHOICES.q3)).toBe(true)
    expect(Object.isFrozen(EMPTY_CHOICES.q4)).toBe(true)
  })

  // A Solid store writes into the object it is handed, unless that object is
  // frozen: then it copies it. An index write reaches into an array, so it
  // covers a q4 that is frozen less deeply than the object around it.
  it('lets a Solid store start from it without being written into', () => {
    const [choices, setChoices] = createStore(EMPTY_CHOICES)

    setChoices('q1', 'guitar')
    setChoices('q3', ['what'])
    setChoices('q3', (picks) => [...picks, 'time'])
    setChoices('q4', 0, 'video')

    expect(choices).toEqual({
      q1: 'guitar',
      q2: null,
      q3: ['what', 'time'],
      q4: ['video'],
    })
    expect(EMPTY_CHOICES).toEqual({ q1: null, q2: null, q3: [], q4: [] })
  })
})

describe('the options per column', () => {
  it('gives the ear column its own goals', () => {
    expect(q2Options('ear').map((o) => o.id)).toEqual([
      'tune',
      'intervals',
      'exam',
      'by_ear',
      'curious',
    ])
    expect(q2Options('guitar').map((o) => o.id)).toEqual([
      'song',
      'together',
      'audition',
      'basics',
      'fun',
    ])
  })

  it('lists the hardest parts per column', () => {
    expect(q3Options('singing').map((o) => o.id)).toEqual([
      'time',
      'progress',
      'what',
      'tune',
      'setup',
      'shy',
      'other',
    ])
    expect(q3Options('ear').map((o) => o.id)).toEqual([
      'time',
      'progress',
      'what',
      'difference',
      'setup',
      'alone',
      'other',
    ])
    expect(q3Options('piano').map((o) => o.id)).toEqual([
      'time',
      'progress',
      'what',
      'tempo',
      'setup',
      'alone',
      'other',
    ])
    expect(q3Options('everything')).toEqual(q3Options('singing'))
  })

  it('lists guitar like piano', () => {
    expect(q3Options('guitar').map((o) => o.id)).toEqual(
      q3Options('piano').map((o) => o.id),
    )
  })

  it.each(OPTION_LISTS)(
    'asks %s of a skipped first answer as it asks Singing',
    (_, options) => {
      expect(options(null)).toEqual(options('singing'))
    },
  )

  it('gives every option an id, a label and a line, and no id twice', () => {
    const problems = Q1_ANSWERS.flatMap((q1) =>
      OPTION_LISTS.flatMap(([name, options]) => {
        const list = options(q1)
        const ids = list.map((o) => o.id)
        const where = `${name} for ${String(q1)}`
        return [
          ...(new Set(ids).size === ids.length
            ? []
            : [`${where} repeats an id`]),
          ...list
            .filter((o) => o.label.trim() === '' || o.line.trim() === '')
            .map((o) => `${where}: ${o.id} has no label or line`),
        ]
      }),
    )
    expect(problems).toEqual([])
  })

  it('hands out a new list every time, so one caller cannot change another', () => {
    for (const [, options] of OPTION_LISTS) {
      const first = options('guitar')
      first.pop()
      expect(options('guitar')).toHaveLength(first.length + 1)
    }
  })
})

describe('where the wording follows the instrument', () => {
  // Q2 as the approved mockup has it: ear training has five goals of its
  // own, and every other first answer shares one list in which only "other
  // people" follows the instrument.
  const EAR_GOALS: PlanOption<Q2Id>[] = [
    {
      id: 'tune',
      label: 'Singing in tune',
      line: 'Hearing a note right is half of singing it.',
    },
    {
      id: 'intervals',
      label: 'Hearing intervals and chords',
      line: 'Intervals first, then chords.',
    },
    {
      id: 'exam',
      label: 'A music exam or course',
      line: 'Then a little every day, so it sticks.',
    },
    {
      id: 'by_ear',
      label: 'Playing by ear',
      line: 'That starts with hearing where a note goes.',
    },
    {
      id: 'curious',
      label: 'Just curious',
      line: "Good. Let's find out what you can hear.",
    },
  ]
  const sharedGoals = (together: string): PlanOption<Q2Id>[] => [
    {
      id: 'song',
      label: 'A song I love',
      line: "Then we'll work toward that song.",
    },
    {
      id: 'together',
      label: together,
      line: "Then we'll get you ready for that.",
    },
    {
      id: 'audition',
      label: 'A performance or audition',
      line: "Then we'll rehearse it and keep your takes.",
    },
    {
      id: 'basics',
      label: 'Strong basics',
      line: 'Basics first, then songs.',
    },
    { id: 'fun', label: 'Just for fun', line: 'Fun it is. Songs first.' },
  ]

  it.each<[string, Q1Answer | null, PlanOption<Q2Id>[]]>([
    ['ear training', 'ear', EAR_GOALS],
    ['singing', 'singing', sharedGoals('Singing with other people')],
    [
      '"A bit of everything"',
      'everything',
      sharedGoals('Singing with other people'),
    ],
    ['a skipped first answer', null, sharedGoals('Singing with other people')],
    ['guitar', 'guitar', sharedGoals('Playing with other people')],
    ['piano', 'piano', sharedGoals('Playing with other people')],
  ])('offers %s the approved goals, word for word', (_, q1, goals) => {
    expect(q2Options(q1)).toEqual(goals)
  })

  it('words the sing-along answer for the instrument', () => {
    const along = (q1: Q1Answer | null) =>
      q4Options(q1).find((o) => o.id === 'along')!.label
    expect([
      along('guitar'),
      along('ear'),
      along('everything'),
      along('singing'),
      along(null),
    ]).toEqual([
      'I played along to songs',
      'I sang or played along to songs',
      'I sang or played along to songs',
      'I sang along to songs',
      'I sang along to songs',
    ])
  })

  it('names the Night that fits the instrument, and trains the ear on songs', () => {
    const along = (q1: Q1Answer | null) => lineOf(q4Options(q1), 'along')
    expect([
      along('guitar'),
      along('piano'),
      along('singing'),
      along('everything'),
      along(null),
      along('ear'),
    ]).toEqual([
      "Then you'll like Guitar Night.",
      "Then you'll like Piano Night.",
      "Then you'll like Karaoke Night.",
      "Then you'll like Karaoke Night.",
      "Then you'll like Karaoke Night.",
      'Good. Songs train ears too.',
    ])
  })

  it('starts a beginner on the twelve notes for an instrument, and on what a note is for a voice', () => {
    const starting = (q1: Q1Answer | null) => lineOf(q4Options(q1), 'starting')
    expect(
      [
        starting('guitar'),
        starting('piano'),
        starting('singing'),
        starting('ear'),
        starting('everything'),
        starting(null),
      ].map((line) => line.replace('Then we start with ', '')),
    ).toEqual([
      'the twelve notes.',
      'the twelve notes.',
      'what a note is.',
      'what a note is.',
      'what a note is.',
      'what a note is.',
    ])
  })

  it('promises guitar and piano a score, not Progress', () => {
    expect(q3Options('guitar').find((o) => o.id === 'progress')!.line).toBe(
      "Then we'll keep score, song by song.",
    )
    expect(lineOf(q3Options('piano'), 'progress')).toBe(
      "Then we'll keep score, song by song.",
    )
  })

  it('promises singing its takes in Progress and the ear one number', () => {
    expect(lineOf(q3Options('singing'), 'progress')).toBe(
      "Then you'll see every take in Progress.",
    )
    expect(lineOf(q3Options('ear'), 'progress')).toBe(
      'Then you get one number to watch.',
    )
  })

  it('says what setting up costs in each column', () => {
    const setup = (q1: Q1Answer) => lineOf(q3Options(q1), 'setup')
    expect([
      setup('singing'),
      setup('guitar'),
      setup('piano'),
      setup('ear'),
    ]).toEqual([
      "Then it's one tap. Just the mic.",
      "Then it's one song, one tap.",
      "Then it's one song, one tap.",
      "Then it's one drill, one tap.",
    ])
  })

  it('answers practicing alone with a band, or one drill at a time', () => {
    const alone = (q1: Q1Answer) => q3Options(q1).find((o) => o.id === 'alone')
    const band = {
      id: 'alone',
      label: 'Practicing alone',
      line: "Then you'll have a band behind you.",
    }
    expect([alone('guitar'), alone('piano'), alone('ear')]).toEqual([
      band,
      band,
      { ...band, line: "Then we'll go one drill at a time." },
    ])
  })

  it('tells a shy singer that only they can hear them', () => {
    expect(q3Options('singing').find((o) => o.id === 'shy')).toEqual({
      id: 'shy',
      label: 'Feeling shy about my voice',
      line: 'Only you can hear you.',
    })
  })

  it('names the hard part only each column has', () => {
    const part = (q1: Q1Answer, id: string) =>
      q3Options(q1).find((o) => o.id === id)
    const tempo = {
      id: 'tempo',
      label: 'Keeping time with the music',
      line: "Then you'll play along with the song itself.",
    }
    expect([
      part('singing', 'tune'),
      part('ear', 'difference'),
      part('guitar', 'tempo'),
      part('piano', 'tempo'),
    ]).toEqual([
      {
        id: 'tune',
        label: "Hearing if I'm in tune",
        line: "Then you'll see your pitch while you sing.",
      },
      {
        id: 'difference',
        label: 'Hearing the difference',
        line: "Then we'll train exactly that.",
      },
      tempo,
      tempo,
    ])
  })
})

describe('pruneChoices', () => {
  it('drops picks a new first answer no longer offers', () => {
    expect(
      pruneChoices({ q1: 'guitar', q2: 'tune', q3: ['shy', 'time'], q4: [] }),
    ).toEqual({ q1: 'guitar', q2: null, q3: ['time'], q4: [] })
  })

  it('keeps a goal the new first answer still offers', () => {
    expect(
      pruneChoices({ ...EMPTY_CHOICES, q1: 'guitar', q2: 'song' }).q2,
    ).toBe('song')
  })

  it('judges the picks against Singing when the first answer is skipped', () => {
    expect(
      pruneChoices({ ...EMPTY_CHOICES, q2: 'intervals', q3: ['shy', 'alone'] }),
    ).toEqual({ ...EMPTY_CHOICES, q3: ['shy'] })
  })

  it('keeps two hardest parts at most, in the order tapped', () => {
    expect(
      pruneChoices({ ...EMPTY_CHOICES, q3: ['what', 'time', 'setup'] }).q3,
    ).toEqual(['what', 'time'])
  })

  it('counts only the hardest parts still offered before it keeps two', () => {
    expect(
      pruneChoices({
        ...EMPTY_CHOICES,
        q1: 'guitar',
        q3: ['shy', 'time', 'what', 'setup'],
      }).q3,
    ).toEqual(['time', 'what'])
  })

  it('counts a pick once, at its first tap, before it keeps two', () => {
    expect(
      pruneChoices({
        q1: null,
        q2: null,
        q3: ['time', 'time', 'what'],
        q4: ['video', 'video'],
      }),
    ).toEqual({ q1: null, q2: null, q3: ['time', 'what'], q4: ['video'] })
    expect(
      pruneChoices({ ...EMPTY_CHOICES, q3: ['what', 'time', 'what'] }).q3,
    ).toEqual(['what', 'time'])
  })

  it('lets "Nothing yet" stand alone', () => {
    expect(
      pruneChoices({ ...EMPTY_CHOICES, q4: ['video', 'starting'] }).q4,
    ).toEqual(['starting'])
    expect(
      pruneChoices({ ...EMPTY_CHOICES, q4: ['starting', 'teacher'] }).q4,
    ).toEqual(['teacher'])
  })

  it('lets the last tap win when "Nothing yet" has company', () => {
    const q4 = (picks: PlanChoices['q4']) =>
      pruneChoices({ ...EMPTY_CHOICES, q4: picks }).q4
    expect(q4(['video', 'teacher', 'starting'])).toEqual(['starting'])
    expect(q4(['starting', 'video', 'teacher'])).toEqual(['video', 'teacher'])
    expect(q4(['starting'])).toEqual(['starting'])
    expect(q4(['along', 'app'])).toEqual(['along', 'app'])
    expect(q4([])).toEqual([])
  })

  it('hands back new arrays and leaves what it was given alone', () => {
    const given: PlanChoices = {
      q1: 'guitar',
      q2: 'tune',
      q3: ['shy', 'time'],
      q4: ['video', 'starting'],
    }
    const before = structuredClone(given)

    const pruned = pruneChoices(given)

    expect(given).toEqual(before)
    expect(pruned.q3).not.toBe(given.q3)
    expect(pruned.q4).not.toBe(given.q4)
    const fromEmpty = pruneChoices(EMPTY_CHOICES)
    expect(fromEmpty.q3).not.toBe(EMPTY_CHOICES.q3)
    expect(fromEmpty.q4).not.toBe(EMPTY_CHOICES.q4)
  })
})

interface CopyLine {
  where: string
  text: string
}

const EM_DASH = '\u2014'

/** Every label and line the questions can show, and where it comes from. */
function everyLine(): CopyLine[] {
  const lines: CopyLine[] = []
  const add = (where: string, option: PlanOption<string>) => {
    lines.push(
      { where: `${where} ${option.id} label`, text: option.label },
      { where: `${where} ${option.id} line`, text: option.line },
    )
  }
  for (const option of INSTRUMENTS) add('INSTRUMENTS', option)
  add('EVERYTHING', EVERYTHING)
  for (const q1 of Q1_ANSWERS) {
    for (const [name, options] of OPTION_LISTS) {
      for (const option of options(q1)) {
        add(`${name} for ${String(q1)}:`, option)
      }
    }
  }
  for (const [key, text] of Object.entries(MERC_INTRO)) {
    lines.push({ where: `MERC_INTRO.${key}`, text })
  }
  return lines
}

/** The lines that break a copy rule: an em dash, or the British "practise". */
function offenders(lines: CopyLine[]): string[] {
  return lines
    .filter(({ text }) => text.includes(EM_DASH) || /practis/iu.test(text))
    .map(({ where, text }) => `${where}: ${text}`)
}

describe('the copy rules', () => {
  it('writes no em dash and never "practise", in any label or line of any column', () => {
    const lines = everyLine()

    // 220 today. A scan that read nothing would pass, so it must read at
    // least what is there; it may read more when an option is added.
    expect(lines.length).toBeGreaterThanOrEqual(220)
    expect(offenders(lines)).toEqual([])
  })

  it('catches an em dash and "practise" when one slips in', () => {
    expect(
      offenders([
        { where: 'a', text: `Fast ${EM_DASH} and easy` },
        { where: 'b', text: 'Time to Practise' },
        { where: 'c', text: 'Time to practice' },
      ]),
    ).toEqual([`a: Fast ${EM_DASH} and easy`, 'b: Time to Practise'])
  })
})

describe('the storage keys', () => {
  // A rename strands what people have already saved, and a `pitchperfect_`
  // prefix on the text key would sync what they typed to the account.
  it('syncs the record to the account and keeps every other plan key on the device', () => {
    expect(PLAN_RECORD_KEY).toBe('pitchperfect_plan_v1')
    expect([PLAN_TEXT_KEY, PLAN_CARD_DISMISSED_KEY, PLAN_OPENED_KEY]).toEqual([
      'mp.plan.text.v1',
      'mp.plan.card.dismissed.v1',
      'mp.plan.opened.v1',
    ])
  })
})
