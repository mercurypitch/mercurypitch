// ============================================================
// Series blueprint — how every Find Your Pitch lesson is made, for the team
// ============================================================
//
// The words of the "For the team" section that closed Lesson 1's page, moved
// here unchanged when the owner asked that the plan stop reaching learners
// and be kept in the admin console instead. The Content Studio's Lessons
// page renders it; a lesson page never imports it.
//
// The copy is the series' own British English ("practise", "harmonise"), as
// the section printed it, not the admin's American English. BEATS and FILES
// are the arrays lesson-01/blueprint.ts drew; the rest was the section's
// markup in learn/01.html.

/** A panel's heading: the figure word and its gloss on the line above, then the title. */
export interface BlueprintHead {
  readonly fig: string
  readonly gloss: string
  /** A note at the end of the line above, as the beat sheet's "7:30, scaled per lesson". */
  readonly tempo?: string
  readonly title: string
}

/** The section's own heading. */
export const BLUEPRINT_HEAD = {
  tempo: 'For the team:',
  gloss: 'how every lesson is made, the plan compressed',
  title: 'Series blueprint',
} as const

export const PROMISE = {
  label: 'The promise',
  lead: '“Find your pitch.”',
  text: 'By the end of Season 1 a beginner can hear and explain what a note is, find any note on a keyboard, match a note with their own voice, sing a scale and a leap in tune, and understand the chords under a song they love.',
} as const

export const BEAT_SHEET: BlueprintHead & { readonly label: string } = {
  fig: 'Format',
  gloss: 'the episode beat sheet',
  tempo: '7:30, scaled per lesson',
  title: 'A question first, the term last',
  /** The beat bar's accessible name: it draws each beat to scale. */
  label: 'The ten beats of a 7 minute 30 episode, drawn to scale.',
}

/** [start, name, seconds, class]; 'pr' marks the predict beat. */
export const BEATS: readonly (readonly [string, string, number, string?])[] = [
  ['0:00', 'Cold open', 30],
  ['0:30', 'Title sting', 4],
  ['0:34', 'Promise', 26],
  ['1:00', 'Act 1: the concrete model', 90],
  ['2:30', 'Predict', 20, 'pr'],
  ['2:50', 'Act 2: the twist', 100],
  ['4:30', 'Act 3: name it', 60],
  ['5:30', 'Act 4: sing it', 60],
  ['6:30', 'Recap', 35],
  ['7:05', 'Next and end screen', 25],
]

export const PAGE_ANATOMY: BlueprintHead = {
  fig: 'Format',
  gloss: 'the page anatomy',
  title: 'Eleven parts, ten on this page',
}

/**
 * One part of a lesson page, in page order, with its bar in the small phone
 * drawing beside the list: `h` px tall, a toy, the sung checkpoint or the
 * quiz in their colours, a plain part at chrome opacity `o`, and a part the
 * page did not have yet (`later`) dashed.
 */
export interface AnatomyPart {
  readonly text: string
  readonly kind?: 'toy' | 'sing' | 'quiz' | 'later'
  readonly h: number
  readonly o?: number
}

export const ANATOMY: readonly AnatomyPart[] = [
  {
    text: 'Header: number, hook, time, prerequisite chips, promise',
    h: 16,
    o: 0.5,
  },
  { text: 'Sound gate', h: 8, o: 0.25 },
  {
    text: 'Warm-up retrieval: two earlier questions, asked afresh (from Lesson 2)',
    kind: 'later',
    h: 10,
  },
  { text: 'Cold-open toy: predict, then reveal', kind: 'toy', h: 26 },
  { text: 'Four to six steps, sticky figure', kind: 'toy', h: 44 },
  { text: 'The common mix-up card', h: 14, o: 0.35 },
  { text: 'Sung checkpoint, octave-tolerant', kind: 'sing', h: 20 },
  { text: 'Quick check: retrieval questions', kind: 'quiz', h: 18 },
  { text: 'Playground: the main toy, every control', kind: 'toy', h: 20 },
  { text: 'The episode, chapters, captions', h: 24, o: 0.45 },
  { text: 'Wrap, challenge, practise link, next hook', h: 12, o: 0.3 },
]

export const TEACHING: BlueprintHead = {
  fig: 'Teaching',
  gloss: 'the five that matter most',
  title: 'Five rules',
}

/** [the rule, in bold, then what it means and its evidence]. */
export const RULES: readonly (readonly [string, string])[] = [
  [
    'Voice the misconception, then refute it.',
    'Orange holds the plausible wrong belief; blue and the demonstration break it (Muller 2008, d = 0.83).',
  ],
  [
    'Orange asks deep questions.',
    'Why, how and what-if; never filler (Driscoll 2003; Craig 2006).',
  ],
  [
    'Predict before every reveal.',
    'A committed guess helps even when it is wrong (Richland 2009).',
  ],
  [
    'Sound before symbol.',
    'Hear it, sing it, name it; the staff waits for Season 2.',
  ],
  [
    'Retrieve at the end, and again later.',
    'A short quiz now, one question again in the next cold open (Roediger and Karpicke 2006).',
  ],
]

export const PIPELINE: BlueprintHead = {
  fig: 'Production',
  gloss: 'built in code, one clock',
  title: 'The pipeline in eight steps',
}

/** [the step, what it makes], in order. */
export const PIPELINE_STEPS: readonly (readonly [string, string])[] = [
  ['Brief and facts', 'Every claim sourced in FACTS.md'],
  ['Script', 'A typed event list; a script critic checks orange'],
  ['Voice and clock', 'Per-line voice; cues.json times everything'],
  ['Storyboard', 'Shot lines, handoffs, fresh critic rounds'],
  ['Merc performances', 'Rendered once per performance, straight alpha'],
  ['Scenes', 'Built in parallel, each proven in its lab'],
  ['Render and mix', 'A fresh critic per round until SHIP'],
  ['Deliver', 'Master, captions, chapters, this web lesson'],
]

export const ROADMAP: BlueprintHead = {
  fig: 'Roadmap',
  gloss: 'phases',
  title: 'Where the series stands',
}

/**
 * A roadmap phase, in the order the timeline drew them: Phases 0 to 3 and
 * 5 in a row, then Phase 4, which runs alongside from launch (`continuous`).
 * `now` marks the phase in progress.
 */
export interface Phase {
  readonly when: string
  readonly name: string
  readonly text: string
  readonly now?: true
  readonly continuous?: true
}

export const PHASES: readonly Phase[] = [
  {
    when: 'Phase 0 · in progress',
    name: 'Discovery and proof',
    text: 'Research, curriculum, playbook, hosts; Lesson 1 built. Done when its delivery master and LEDGER exist.',
    now: true,
  },
  {
    when: 'Phase 1 · ~3 weeks',
    name: 'Foundation',
    text: 'Voices cast, film kit, web toy kit, app deep links.',
  },
  {
    when: 'Phase 2 · ~7 weeks',
    name: 'Arc A, Hear it',
    text: 'Lessons 2 to 7 and the trailer, one a week after launch.',
  },
  {
    when: 'Phase 3 · ~7 weeks',
    name: 'Arc B, Shape it',
    text: 'Lessons 8 to 14: rhythm, leaps, chords, vowels, a whole song.',
  },
  {
    when: 'Phase 5',
    name: 'Season 2',
    text: 'Read it, harmonise it: the staff, keys, harmony singing.',
  },
  {
    when: 'Phase 4 · from launch, continuous',
    name: 'Measure and improve',
    text: 'Retrieval scores per question, retention, lesson-to-app conversions; re-cut what lags.',
    continuous: true,
  },
]

export const PLAN_FILES: BlueprintHead = {
  fig: 'Sources',
  gloss: 'docs/plans/find-your-pitch/ in the MercuryPitch repository',
  title: 'The plan files',
}

/** [path under docs/plans/find-your-pitch/, what it holds]; a trailing slash is a folder. */
export const FILES: readonly (readonly [string, string])[] = [
  ['MASTER-PLAN.md', 'Vision, decisions, formats, phases, risks'],
  ['CURRICULUM.md', 'Season 1 cards, the topic graph, Seasons 2 and 3'],
  ['TEACHING-PLAYBOOK.md', 'The 25 rules and their evidence'],
  ['MERC-BIBLE.md', 'The hosts: roles, looks, voices'],
  ['PRODUCTION-PIPELINE.md', 'Step by step, tool by tool'],
  [
    'lessons/01-what-is-a-note/',
    "Lesson 1: facts, script, storyboard, this page's copy",
  ],
]

export const REPO = 'https://github.com/mercurypitch/mercurypitch'

/** A plan file's address on main: a folder opens as a tree, a file as a blob. */
export function planFileUrl(path: string): string {
  const kind = path.endsWith('/') ? 'tree' : 'blob'
  return `${REPO}/${kind}/main/docs/plans/find-your-pitch/${path}`
}
