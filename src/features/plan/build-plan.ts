// ============================================================
// Build plan — the four answers become up to three real stops
// ============================================================
//
// Start here, Learn and Play: each stop is a shipped surface of the web app,
// picked by rule from what the person said. The rules are here; the tables
// and the Play copy are in plan-copy.ts: the approved mockup's, except the
// guitar and piano "progress" cells (spec 5.1, corrected 20 Oct). Three things
// sit on top of the tables, and each is easy to break:
//
// - The voiceprint speaks only for the voice: the Singing column, which "a
//   bit of everything" and a skipped first answer share. It speaks only when
//   it found something; a `practice` room is pickFirstStop's default, not a
//   finding. It leads Start here when the hardest part is about the voice or
//   was not picked. For a habit (time, setup, shy) the table leads, and the
//   finding moves to the Learn card's line, or the Play card's. When it leads
//   "telling if you're getting better", its card still ends with the table's
//   answer, Progress, but only on a stop whose runs land there.
// - Learn's rules and Play's repeat check read the Start here that was
//   finally chosen, the voiceprint's included, so no card repeats another.
// - The person's own menu. A Learn or Play card on a tab their menu hides is
//   dropped. Start here never is: every Start-here tab is in the You or
//   Practice group, which Simple mode keeps, and only the scope can hide it
//   (opening it widens the scope). The menu switch is offered only when every
//   card that is left stays in the menu under it.
//
// The choices are read as questions.ts settles them (pruneChoices), so an id
// the first answer does not offer counts for nothing and a stale record never
// throws. Nothing it is given is written to (EMPTY_CHOICES is frozen): every
// plan is made of new objects. It imports no store; whoever builds a plan
// passes the voiceprint and the person's menu in.

import type { RoomId } from '@/features/onboarding/rooms'
import type { ActiveTab, PracticeScope, UiMode, } from '@/features/tabs/constants'
import { isTabVisible, TAB_EAR_LAB, TAB_EXERCISES, TAB_GUITAR, TAB_HOME, TAB_JAM, TAB_PATH, TAB_PIANO, TAB_SINGING, TAB_VOICE_HISTORY, } from '@/features/tabs/constants'
import type { HardPart, PlayCopy, PlayTrigger, StartCell, StartRow, } from './plan-copy'
import { GOAL, JAM_COPY, karaokeCopy, nightCopy, SAID, SING_ALONG_TITLE, START, VOICEPRINT_CHIP, } from './plan-copy'
import type { Instrument, PlanChoices, PlanOption, Q1Answer, Q2Id, Q3Id, Q4Id, } from './questions'
import { planColumn, pruneChoices, q1Label, q2Options, q3Options, q4Options, } from './questions'

// ── Where a stop goes ──────────────────────────────────────────────────

/** A tab of the app, or a page of its own (the Nights and the lessons). */
export type PlanTarget =
  | { kind: 'tab'; tab: ActiveTab }
  | { kind: 'page'; href: string }

const tabTarget = (tab: ActiveTab): PlanTarget => ({ kind: 'tab', tab })
const pageTarget = (href: string): PlanTarget => ({ kind: 'page', href })

/** The Map's cover for a room, cut for a card (the Map shows these at 800 px). */
const mapCover = (room: RoomId): string => `/onboarding/rooms/${room}-800.webp`

/**
 * Every place a stop can send someone: the room's name on a card, the picture
 * over it and where it opens. A cover is the Map's where the Map has one, the
 * approved first-question card for the instrument's own rooms, and the room's
 * own art otherwise (Home has none of its own, so it wears the Sing room, as
 * the mockup has it).
 */
export const PLAN_DESTS = {
  homeSession: {
    room: 'Home',
    cover: mapCover('practice'),
    target: tabTarget(TAB_HOME),
  },
  sing: {
    room: 'Sing',
    cover: mapCover('practice'),
    target: tabTarget(TAB_SINGING),
  },
  exercises: {
    room: 'Exercises',
    cover: mapCover('exercises'),
    target: tabTarget(TAB_EXERCISES),
  },
  ascent: {
    room: 'The Ascent',
    cover: mapCover('ascent'),
    target: tabTarget(TAB_PATH),
  },
  guitar: {
    room: 'Guitar',
    cover: '/onboarding/plan/q1-guitar.webp',
    target: tabTarget(TAB_GUITAR),
  },
  piano: {
    room: 'Piano',
    cover: '/onboarding/plan/q1-piano.webp',
    target: tabTarget(TAB_PIANO),
  },
  earLab: {
    room: 'Ear Lab',
    cover: '/onboarding/plan/q1-ear.webp',
    target: tabTarget(TAB_EAR_LAB),
  },
  jam: {
    room: 'Jam',
    cover: mapCover('jam'),
    target: tabTarget(TAB_JAM),
  },
  hearYourself: {
    room: 'Hear Yourself',
    cover: '/home/hear-yourself-tease.webp',
    target: tabTarget(TAB_VOICE_HISTORY),
  },
  guitarNight: {
    room: 'Guitar Night',
    cover: '/guitar-night/velvet-rehearsal-card-880.webp',
    target: pageTarget('/guitar-night'),
  },
  pianoNight: {
    room: 'Piano Night',
    cover: '/piano-night/afterglow-studio-landscape-card-880.webp',
    target: pageTarget('/piano-night'),
  },
  karaokeNight: {
    room: 'Karaoke Night',
    cover: mapCover('karaoke'),
    target: pageTarget('/karaoke'),
  },
  lesson1: {
    room: 'Lesson 1',
    cover: '/learn/lesson-01-og.jpg',
    target: pageTarget('/learn/01'),
  },
  lesson2: {
    room: 'Lesson 2',
    cover: '/learn/lesson-02-og.jpg',
    target: pageTarget('/learn/02'),
  },
} as const satisfies Record<
  string,
  { room: string; cover: string; target: PlanTarget }
>

/** Where a stop goes: a key of PLAN_DESTS. */
export type PlanDest = keyof typeof PLAN_DESTS

// ── The plan ───────────────────────────────────────────────────────────

/** One card of the plan: where it goes, what to do there, and why. */
export interface PlanStop {
  kind: 'start' | 'learn' | 'play'
  dest: PlanDest
  title: string
  /** The reason, often in the person's own words. */
  why: string
  /** The answers that made the card, in the words the person tapped. */
  chips: string[]
}

/** The switch that narrows the app's menu to the one instrument. */
export interface ScopeOffer {
  scope: 'singing' | 'guitar' | 'piano'
  label: string
}

/** The menu the person has now: the practice scope and the UI mode. */
export interface PlanView {
  scope: PracticeScope
  mode: UiMode
}

/**
 * What the voiceprint found. `FirstStop` (first-stop.ts) is assignable to it,
 * so a caller passes pickFirstStop's answer as it is.
 */
export interface VoiceprintStop {
  room: RoomId
  detail: string | null
  reason?: string
}

export interface Plan {
  /** The line over the cards: `lead` plainly, then `lit` in the accent. */
  headline: { lead: string; lit: string }
  start: PlanStop
  learn: PlanStop | null
  play: PlanStop | null
  scope: ScopeOffer | null
}

/** The menu of someone who has not narrowed it: every room, the full app. */
const DEFAULT_VIEW: PlanView = { scope: 'all', mode: 'advanced' }

// ── The words ──────────────────────────────────────────────────────────

/** The words a person tapped for an id, or '' for an id the list lacks. */
function labelOf<Id extends string>(
  options: readonly PlanOption<Id>[],
  id: Id,
): string {
  return options.find((option) => option.id === id)?.label ?? ''
}

const goalLabel = (c: PlanChoices, id: Q2Id) => labelOf(q2Options(c.q1), id)
const hardLabel = (c: PlanChoices, id: Q3Id) => labelOf(q3Options(c.q1), id)
const triedLabel = (c: PlanChoices, id: Q4Id) => labelOf(q4Options(c.q1), id)

/** Sentences joined into one line, skipping the ones there are none of. */
function joined(...sentences: (string | undefined)[]): string {
  return sentences.filter((s) => s !== undefined && s !== '').join(' ')
}

// ── Start here ─────────────────────────────────────────────────────────

/** The hard part that decided, and the table's cell for it. */
interface Decision {
  pick: HardPart | null
  cell: StartCell<PlanDest>
}

/**
 * The first hard part the column has a cell for, in the order tapped.
 * "Something else" never decides, and nothing picked takes the column's
 * default.
 */
function decide(c: PlanChoices, column: Instrument): Decision {
  const row: StartRow<PlanDest> = START[column]
  for (const id of c.q3) {
    if (id === 'other') continue
    const cell = row[id]
    if (cell !== undefined) return { pick: id, cell }
  }
  return { pick: null, cell: row.none }
}

/** What a skipped hard part leaves on the card: the instrument, if one was named. */
function firstAnswerChips(c: PlanChoices): string[] {
  return c.q1 === null ? [] : [q1Label(c.q1)]
}

/** Start here from the table, with the person's own words handed back. */
function tableStart(c: PlanChoices, { pick, cell }: Decision): PlanStop {
  const [dest, title, why] = cell
  return {
    kind: 'start',
    dest,
    title,
    why: pick === null ? why : `You said ${SAID[pick]}. ${why}`,
    chips: pick === null ? firstAnswerChips(c) : [hardLabel(c, pick)],
  }
}

/** The voiceprint's rooms that mean it found something, and the stop each opens. */
const FINDING_DEST: Readonly<Partial<Record<RoomId, PlanDest>>> = {
  exercises: 'exercises',
  ascent: 'ascent',
  karaoke: 'karaokeNight',
}

interface Finding {
  dest: PlanDest
  stop: VoiceprintStop
}

/** The voiceprint's finding, when this column listens to it and there is one. */
function findingOf(
  voiceprint: VoiceprintStop | null | undefined,
  column: Instrument,
): Finding | null {
  if (!voiceprint || column !== 'singing') return null
  const dest = FINDING_DEST[voiceprint.room]
  return dest === undefined ? null : { dest, stop: voiceprint }
}

/** The hard parts that are about the voice, which the voiceprint answers better. */
const VOICE_PICKS: readonly Q3Id[] = ['tune', 'progress', 'what']

/** Does the voiceprint lead? It does for a voice question, or when none was picked. */
function voiceLeads(pick: HardPart | null): boolean {
  return pick === null || VOICE_PICKS.includes(pick)
}

/**
 * The voiceprint's stops whose runs land in Progress. A drill in Exercises is
 * recorded as an Exercise run (exercise-history-store.ts), and the Ascent's
 * daily session runs those same drills. Karaoke Night writes no run: a take
 * there is kept in Hear Yourself, so its card does not promise Progress.
 */
const LANDS_IN_PROGRESS: ReadonlySet<PlanDest> = new Set<PlanDest>([
  'exercises',
  'ascent',
])

/**
 * The table's answer the voiceprint's card keeps: Progress, for "telling if
 * you're getting better", where the stop's runs land there. "Knowing what to
 * practice" is answered by the finding itself, which names the drill, and
 * the table's line for "in tune" describes Sing's own line, so neither adds one.
 */
function answerKept(dest: PlanDest, pick: HardPart | null): string {
  return pick === 'progress' && LANDS_IN_PROGRESS.has(dest)
    ? START.singing.progress[2]
    : ''
}

/** Start here as the voiceprint sees it: its drill, its reason, then the person's words. */
function voiceprintStart(
  c: PlanChoices,
  { dest, stop }: Finding,
  pick: HardPart | null,
): PlanStop {
  const fallback =
    dest === 'karaokeNight' ? SING_ALONG_TITLE : PLAN_DESTS[dest].room
  return {
    kind: 'start',
    dest,
    title: stop.detail ?? fallback,
    why: joined(
      stop.reason,
      pick === null ? '' : `You said ${SAID[pick]}.`,
      answerKept(dest, pick),
    ),
    chips:
      pick === null ? [VOICEPRINT_CHIP] : [VOICEPRINT_CHIP, hardLabel(c, pick)],
  }
}

/** Start here, and the voiceprint's reason when the table won and it has a word to add. */
interface StartHere {
  stop: PlanStop
  carried: string | undefined
}

function chooseStart(
  c: PlanChoices,
  decision: Decision,
  finding: Finding | null,
): StartHere {
  if (finding !== null && voiceLeads(decision.pick)) {
    return {
      stop: voiceprintStart(c, finding, decision.pick),
      carried: undefined,
    }
  }
  return { stop: tableStart(c, decision), carried: finding?.stop.reason }
}

// ── Learn ──────────────────────────────────────────────────────────────

interface LearnContext {
  c: PlanChoices
  /** Singers, ear training, everything and a skipped first answer: they start from the first note. */
  sings: boolean
  /** Start here as finally chosen, so a card never repeats it. */
  start: PlanDest
}

function learnStop(
  dest: PlanDest,
  title: string,
  why: string,
  chip: string,
): PlanStop {
  return { kind: 'learn', dest, title, why, chips: [chip] }
}

/** The answer that asks for a film: "Nothing yet" outranks "A video lesson". */
function filmAnswer(q4: readonly Q4Id[]): 'starting' | 'video' | null {
  if (q4.includes('starting')) return 'starting'
  return q4.includes('video') ? 'video' : null
}

/** Rules 1 and 2: someone just starting, or who learns from video, gets a film. */
function lessonFromFilm({ c, sings }: LearnContext): PlanStop | null {
  const said = filmAnswer(c.q4)
  if (said === null) return null
  const chip = triedLabel(c, said)
  if (!sings) {
    return learnStop(
      'lesson2',
      'Twelve notes',
      'The notes every instrument shares, in one short film with Merc.',
      chip,
    )
  }
  const why =
    said === 'starting'
      ? "You're just starting, so start at the first note."
      : 'You learn from video lessons. Ours are short films with Merc, and the first one starts at the first note.'
  return learnStop('lesson1', 'What is a note?', why, chip)
}

/** Rule 3: not knowing what to practice, unless the Ascent is where they start. */
function climbForWhat({ c, start }: LearnContext): PlanStop | null {
  if (!c.q3.includes('what') || start === 'ascent') return null
  return learnStop(
    'ascent',
    "This week's climb",
    'You said knowing what to practice is hard. The Ascent sets out each week.',
    hardLabel(c, 'what'),
  )
}

/** Rule 4: strong basics, from the first note or, for a player, from the Ascent. */
function lessonForBasics({ c, sings, start }: LearnContext): PlanStop | null {
  if (c.q2 !== 'basics') return null
  const chip = goalLabel(c, 'basics')
  if (sings) {
    return learnStop(
      'lesson1',
      'What is a note?',
      'You want strong basics. Lesson 1 starts at the first note.',
      chip,
    )
  }
  if (start === 'ascent') return null
  return learnStop(
    'ascent',
    "This week's climb",
    'You want strong basics. The Ascent builds them a week at a time.',
    chip,
  )
}

/** Rule 5: a teacher is kept in mind with takes to play them. */
function takeForTeacher({ c }: LearnContext): PlanStop | null {
  if (!c.q4.includes('teacher')) return null
  return learnStop(
    'hearYourself',
    'Keep a take for your teacher',
    'You have a teacher. Keep takes to play them at your next lesson.',
    triedLabel(c, 'teacher'),
  )
}

/** Learn's rules in the order they are read; the first that fits wins, and rule 6 is none. */
const LEARN_RULES: readonly ((x: LearnContext) => PlanStop | null)[] = [
  lessonFromFilm,
  climbForWhat,
  lessonForBasics,
  takeForTeacher,
]

function learnFor(x: LearnContext): PlanStop | null {
  for (const rule of LEARN_RULES) {
    const stop = rule(x)
    if (stop !== null) return stop
  }
  return null
}

// ── Play ───────────────────────────────────────────────────────────────

/** Each column's Night. Ear training has none. */
const NIGHT_OF: Readonly<Record<Exclude<Instrument, 'ear'>, PlanDest>> = {
  singing: 'karaokeNight',
  guitar: 'guitarNight',
  piano: 'pianoNight',
}

interface PlayHit {
  dest: PlanDest
  trigger: PlayTrigger
  /** The words the person tapped for it. */
  chip: string
}

/**
 * The first answer that asks for a Night or Jam. A cell that does not apply
 * reads on to the next, so a guitarist who plays with others can still get
 * Guitar Night from "I played along to songs".
 */
function playHit(
  c: PlanChoices,
  column: Exclude<Instrument, 'ear'>,
): PlayHit | null {
  const night = NIGHT_OF[column]
  if (c.q2 === 'song' || c.q2 === 'audition') {
    return { dest: night, trigger: c.q2, chip: goalLabel(c, c.q2) }
  }
  if (c.q2 === 'together' && column === 'singing') {
    return { dest: 'jam', trigger: 'together', chip: goalLabel(c, 'together') }
  }
  if (c.q3.includes('alone')) {
    return { dest: night, trigger: 'alone', chip: hardLabel(c, 'alone') }
  }
  if (c.q2 === 'fun') {
    return { dest: night, trigger: 'fun', chip: goalLabel(c, 'fun') }
  }
  if (c.q4.includes('along')) {
    return { dest: night, trigger: 'along', chip: triedLabel(c, 'along') }
  }
  return null
}

function playCopy(dest: PlanDest, trigger: PlayTrigger): PlayCopy {
  if (dest === 'jam') return JAM_COPY
  if (dest === 'karaokeNight') return karaokeCopy(trigger)
  return nightCopy(trigger, PLAN_DESTS[dest].room)
}

/** Play: at most one card, and none that repeats Start here. */
function playFor(
  c: PlanChoices,
  column: Instrument,
  start: PlanDest,
): PlanStop | null {
  if (column === 'ear') return null
  const hit = playHit(c, column)
  if (hit === null || hit.dest === start) return null
  const [title, why] = playCopy(hit.dest, hit.trigger)
  return { kind: 'play', dest: hit.dest, title, why, chips: [hit.chip] }
}

// ── The person's menu ──────────────────────────────────────────────────

/** Does a stop open inside the menu a scope and mode leave? A page is not in the menu. */
function opensInMenu(
  dest: PlanDest,
  scope: PracticeScope,
  mode: UiMode,
): boolean {
  const { target } = PLAN_DESTS[dest]
  return target.kind === 'page' || isTabVisible(target.tab, scope, mode)
}

/** A card the person's menu hides is dropped. */
function keepInMenu(stop: PlanStop | null, view: PlanView): PlanStop | null {
  return stop !== null && opensInMenu(stop.dest, view.scope, view.mode)
    ? stop
    : null
}

function isScoped(q1: Q1Answer | null): q1 is ScopeOffer['scope'] {
  return q1 === 'singing' || q1 === 'guitar' || q1 === 'piano'
}

/**
 * The switch that narrows the menu to the first answer's instrument. It is
 * not offered for ear training (the app has no ear-only menu), for no single
 * instrument, when the menu is already that narrow, or when a card would
 * leave the menu under it.
 */
function scopeOffer(
  q1: Q1Answer | null,
  stops: readonly PlanStop[],
  view: PlanView,
): ScopeOffer | null {
  if (!isScoped(q1) || view.scope === q1) return null
  const staysIn = stops.every((stop) => opensInMenu(stop.dest, q1, view.mode))
  return staysIn ? { scope: q1, label: `Show only ${q1} in the menu` } : null
}

// ── Putting it together ────────────────────────────────────────────────

/** "Singing, for the audition": the first answer, then what it is for. */
function headlineOf(c: PlanChoices): Plan['headline'] {
  return {
    lead: `${c.q1 === null ? 'Your plan' : q1Label(c.q1)}, `,
    lit: c.q2 === null ? 'starting today' : GOAL[c.q2],
  }
}

/** The voiceprint's reason, added to the card the person reads after Start here. */
function carryReason(
  reason: string | undefined,
  learn: PlanStop | null,
  play: PlanStop | null,
): Pick<Plan, 'learn' | 'play'> {
  if (reason === undefined) return { learn, play }
  if (learn !== null) {
    return { learn: { ...learn, why: joined(learn.why, reason) }, play }
  }
  return { learn, play: play && { ...play, why: joined(play.why, reason) } }
}

/** The stops of a plan in the order they are read, without the ones it lacks. */
export function planStops(p: Plan): PlanStop[] {
  return [p.start, p.learn, p.play].filter(
    (stop): stop is PlanStop => stop !== null,
  )
}

/**
 * Turns the answers into a plan: Start here, and a Learn and a Play card when
 * the answers ask for them. `voiceprint` is what the voiceprint found, if
 * anything; `view` is the menu the person has now.
 */
export function buildPlan(
  choices: PlanChoices,
  opts: { voiceprint?: VoiceprintStop | null; view?: PlanView } = {},
): Plan {
  const c = pruneChoices(choices)
  const view = opts.view ?? DEFAULT_VIEW
  const column = planColumn(c.q1)
  const decision = decide(c, column)
  const { stop: start, carried } = chooseStart(
    c,
    decision,
    findingOf(opts.voiceprint, column),
  )
  const learn = learnFor({
    c,
    sings: column === 'singing' || column === 'ear',
    start: start.dest,
  })
  const play = playFor(c, column, start.dest)
  const cards = carryReason(
    carried,
    keepInMenu(learn, view),
    keepInMenu(play, view),
  )
  const plan: Plan = {
    headline: headlineOf(c),
    start,
    ...cards,
    scope: null,
  }
  return { ...plan, scope: scopeOffer(c.q1, planStops(plan), view) }
}
