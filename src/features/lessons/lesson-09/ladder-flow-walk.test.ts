// ============================================================
// Lesson 9 ladder flow walk — every route a visit to Sing it can take
// ============================================================
//
// A walk over every sequence of takes, their outcomes, the ladders chosen,
// the answers, Done for today, a lost microphone and the sound turned off
// while Merc sings, from every way a visit opens. At every step of every
// route it holds the card to what the spec forbids and to what it asks for.
// Never a fourth take or a third sung ladder (FACTS 78), the full ladder
// after a sung smaller one, a second Again, Again or Start after
// "Effortful" or "Uncomfortable", a feeling question with no ladder read,
// an answer that can change, a take offered after Done for today, a take
// counted that never ended, or the wrong card in the Wrap. Always the
// feeling question after a sung ladder, Start again after a take with no
// voice and Start after an abandoned one while takes remain, Again (and
// Again smaller after the full ladder) after "Easy" or "Workable" while the
// one Again is unused, Merc's one celebration where it was earned, and,
// after the sound went off while Merc sang, the card as it stood before the
// button, with that button's hint. Every state reached is held to the rules
// that do not depend on the route: an event the card does not offer leaves
// the visit as it was, no take begins with the sound off and the hint names
// the button pressed, nothing is offered during a take, and a card always
// has a way on. The storage clause is the page's: this rule touches none.
//
// The oracle reads what each route has done from the route's steps rather
// than from the visit, so that the rule is never its own witness.

import { isDeepStrictEqual } from 'node:util'
import { describe, expect, it } from 'vitest'
import type { Feeling } from '@/features/lessons/kit/comfort'
import { FEELINGS } from '@/features/lessons/kit/comfort'
import type { LadderId } from './ladder-data'
import type { LadderEvent, LadderOffers, LadderVisit, SoundHint, TakeKind, } from './ladder-flow'
import { LADDER_ORDER, next, offers, openVisit } from './ladder-flow'
import { begin, DONE, feel, HIGHER, KINDS, LISTEN, NOMIC, run, SILENCED, SING, SOUND_OFF, SOUND_ON, took, } from './ladder-flow.test-fixtures'

/** The buttons that begin a take. */
type Button = 'start' | 'startAgain' | 'again'

type Label =
  | Button
  | 'comfort'
  | 'voice'
  | 'took'
  | 'nomic'
  | 'silenced'
  | 'soundOn'
  | 'feel'
  | 'done'

interface Step {
  readonly label: Label
  readonly events: readonly LadderEvent[]
}

/** What a route has done so far, read from its steps alone, never from the visit's own record. */
interface Route {
  readonly takes: number
  readonly sung: number
  readonly smallerSung: boolean
  readonly hard: boolean
  readonly listen: boolean
  readonly agains: number
  /** An Again sung, or a ladder abandoned after its voice. */
  readonly againGone: boolean
  /** The open take's ladder, from its button to its end. */
  readonly opening: LadderId | null
  /** The button that began the latest take, ended or not. */
  readonly button: Button | null
  /** The ladder the latest take sang, and what it came to. */
  readonly ladder: LadderId | null
  readonly lastTake: TakeKind | null
  readonly last: Label | null
  /** Done for today pressed. */
  readonly finished: boolean
  /** The latest answer, cleared by the next take. */
  readonly feeling: Feeling | null
  /** The take Merc earned his one celebration on: the visit's first with every heard note landed, answered "Easy" or "Workable". */
  readonly celebrated: number | null
  /** A take ended by the sound going off while Merc sang. */
  readonly silenced: boolean
}

const START: Route = {
  takes: 0,
  sung: 0,
  smallerSung: false,
  hard: false,
  listen: false,
  agains: 0,
  againGone: false,
  opening: null,
  button: null,
  ladder: null,
  lastTake: null,
  last: null,
  finished: false,
  feeling: null,
  celebrated: null,
  silenced: false,
}

/** Every step the page can take from here that changes the visit's course. */
function steps(v: LadderVisit, r: Route): Step[] {
  const o = offers(v)
  const out: Step[] = []
  const step = (label: Label, ...events: LadderEvent[]) =>
    out.push({ label, events })
  if (!v.sound) {
    // the sound went off while Merc sang: it comes back on, or the visit
    // ends as it stands
    step('soundOn', SOUND_ON)
    if (o.done) step('done', DONE)
    return out
  }
  if (o.stage === 'comfort') {
    step('comfort', SING)
    step('comfort', LISTEN)
  }
  if (o.stage === 'voice') step('voice', HIGHER)
  if (o.stage === 'take') {
    for (const k of KINDS) step('took', took(k))
    step('nomic', NOMIC)
    // once a route, to keep the walk bounded
    if (!r.silenced) step('silenced', SOUND_OFF, SILENCED)
  }
  // a ladder pressed, then Start or Start again on it
  for (const l of o.ladders) {
    if (o.start) step('start', { type: 'ladder', ladder: l }, begin(l))
    if (o.startAgain)
      step('startAgain', { type: 'ladder', ladder: l }, begin(l))
  }
  for (const l of o.again) step('again', begin(l))
  if (o.ask && !o.locked) for (const f of FEELINGS) step('feel', feel(f))
  if (o.done) step('done', DONE)
  return out
}

function along(r: Route, s: Step): Route {
  const e = s.events[s.events.length - 1]
  const at: Route = { ...r, last: s.label }
  switch (e.type) {
    case 'comfort':
      return { ...at, listen: !e.sing }
    case 'begin':
      return { ...at, opening: e.ladder, button: s.label as Button }
    case 'silenced':
      return { ...at, opening: null, silenced: true }
    case 'nomic':
      return { ...at, opening: null }
    case 'took': {
      const voiced = e.kind !== 'none' && e.kind !== 'leftSilent'
      const again = r.button === 'again'
      return {
        ...at,
        opening: null,
        ladder: r.opening,
        takes: r.takes + 1,
        sung: r.sung + (voiced ? 1 : 0),
        smallerSung: r.smallerSung || (voiced && r.opening === 'smaller'),
        agains: r.agains + (again ? 1 : 0),
        againGone: r.againGone || again || e.kind === 'leftVoiced',
        lastTake: e.kind,
        feeling: null,
      }
    }
    case 'feel': {
      const easy = e.feeling === 'easy' || e.feeling === 'workable'
      return {
        ...at,
        hard:
          r.hard || e.feeling === 'effortful' || e.feeling === 'uncomfortable',
        feeling: e.feeling,
        celebrated:
          r.celebrated === null && easy && r.lastTake === 'all'
            ? r.takes - 1
            : r.celebrated,
      }
    }
    case 'done':
      return { ...at, finished: true }
    default:
      return at
  }
}

/** FACTS 78's numbers, the spec's rather than the module's: three takes a visit, two sung ladders. */
const TAKES = 3
const SUNG = 2

/** The hint each button shows when the sound is off: the spec's words name it (WEB-SPEC, state 5). */
const HINTS: Readonly<Record<Button, SoundHint>> = {
  start: 'soundOff',
  startAgain: 'soundOffStartAgain',
  again: 'soundOffAgain',
}

/** The rules every route keeps, at every point along it. */
function routeProblems(v: LadderVisit, o: LadderOffers, r: Route): string[] {
  const out: string[] = []
  const takesOn = o.start || o.startAgain || o.again.length > 0
  if (r.takes > TAKES || (r.takes === TAKES && takesOn))
    out.push('a fourth take')
  if (r.sung > SUNG || (r.sung === SUNG && takesOn))
    out.push('a third sung ladder')
  if (r.smallerSung && (o.ladders.includes('full') || o.again.includes('full')))
    out.push('the full ladder after a sung smaller one')
  if (r.hard && (takesOn || o.ladders.length > 0 || o.moveDo))
    out.push('Again after "Effortful" or "Uncomfortable"')
  if (r.agains > 1 || (r.againGone && o.again.length > 0))
    out.push('a second Again')
  const abandoned = r.lastTake === 'leftSilent' || r.lastTake === 'leftVoiced'
  if ((r.lastTake === 'none' || abandoned) && o.ask)
    out.push('a feeling question with no ladder read')
  if ((o.card === 'rest') !== (r.listen || r.hard))
    out.push('the wrong card in the Wrap')
  if (
    r.last === 'feel' &&
    !(o.locked && FEELINGS.every((f) => next(v, feel(f)) === v))
  )
    out.push('an answer that can change')
  if (v.takes.length !== r.takes) out.push('a take counted that never ended')
  // what the card must offer, not only what it must not
  const left = !r.finished && r.takes < TAKES && r.sung < SUNG
  const sang =
    r.lastTake === 'unsteady' || r.lastTake === 'some' || r.lastTake === 'all'
  if (r.last === 'took' && sang && !(o.ask && !o.locked))
    out.push('no feeling question after a sung ladder')
  if (r.last === 'took' && r.lastTake === 'none' && left && !o.startAgain)
    out.push('no Start again after a take with no voice')
  if (r.last === 'took' && abandoned && left && !o.start)
    out.push('no Start after an abandoned take')
  const easy = r.feeling === 'easy' || r.feeling === 'workable'
  const agains: readonly LadderId[] =
    r.ladder === 'full' ? ['full', 'smaller'] : ['smaller']
  if (
    r.last === 'feel' &&
    easy &&
    left &&
    !r.againGone &&
    agains.some((l) => !o.again.includes(l))
  )
    out.push('no Again after "Easy" or "Workable"')
  if (r.finished && (takesOn || o.ladders.length > 0 || o.moveDo || o.done))
    out.push('a take offered after Done for today')
  // the reading it was earned on, answered, or that card back after the
  // sound went off while Merc sang an Again
  const earned =
    r.celebrated !== null &&
    r.celebrated === r.takes - 1 &&
    (r.last === 'feel' ||
      r.last === 'done' ||
      r.last === 'silenced' ||
      r.last === 'soundOn')
  if (o.celebrate !== earned) out.push('a celebration not earned, or missing')
  if (r.last === 'silenced' && r.button !== null && o.hint !== HINTS[r.button])
    out.push('no hint naming the button after the sound went off')
  return out
}

/** Whether the card offers an event: one it does not must leave the visit as it was. */
function offered(v: LadderVisit, o: LadderOffers, e: LadderEvent): boolean {
  switch (e.type) {
    case 'comfort':
      return o.stage === 'comfort'
    case 'voice':
      return o.voiceChoice
    case 'sound':
      return true
    case 'ladder':
      return o.ladders.includes(e.ladder)
    case 'move':
      return o.moveDo
    case 'play':
      return o.playMerc
    case 'begin':
      return (
        ((o.start || o.startAgain) && o.ladders.includes(e.ladder)) ||
        o.again.includes(e.ladder)
      )
    case 'nomic':
    case 'took':
      return o.stage === 'take'
    case 'silenced':
      return o.stage === 'take' && !v.sound
    case 'feel':
      return o.ask && !o.locked
    case 'done':
      return o.done
  }
}

const EVERY_EVENT: readonly LadderEvent[] = [
  SING,
  HIGHER,
  ...LADDER_ORDER.map((ladder): LadderEvent => ({ type: 'ladder', ladder })),
  { type: 'move', step: -1 },
  { type: 'move', step: 1 },
  { type: 'play' },
  ...LADDER_ORDER.map(begin),
  NOMIC,
  SILENCED,
  ...KINDS.map(took),
  ...FEELINGS.map(feel),
  DONE,
]

/** The rules every visit keeps, however it was reached. */
function stateProblems(v: LadderVisit, o: LadderOffers): string[] {
  const out: string[] = []
  if (EVERY_EVENT.some((e) => !offered(v, o, e) && next(v, e) !== v))
    out.push('an event the card does not offer changed the visit')
  const silent = { ...v, sound: false }
  for (const l of LADDER_ORDER) {
    if (!offered(v, o, begin(l))) continue
    const pressed = next(silent, begin(l))
    const hint = o.again.includes(l)
      ? HINTS.again
      : o.startAgain
        ? HINTS.startAgain
        : HINTS.start
    if (pressed.taking !== null || pressed.takes !== v.takes)
      out.push('a take begun with the sound off')
    if (offers(pressed).hint !== hint)
      out.push('a sound-off hint that names another button')
  }
  const controls = [
    o.voiceChoice,
    o.warmUp,
    o.moveDo,
    o.playMerc,
    o.start,
    o.startAgain,
    o.done,
    o.ask,
  ]
  if (
    o.stage === 'take' &&
    (controls.some(Boolean) || o.ladders.length + o.again.length > 0)
  )
    out.push('a control during a take')
  if (o.ladders.length > 0 && !o.ladders.includes(o.pressed))
    out.push('a pressed ladder not on offer')
  const singing =
    o.stage === 'briefing' ||
    o.stage === 'noVoice' ||
    o.stage === 'reading' ||
    o.stage === 'spent'
  const wayOn =
    o.start ||
    o.startAgain ||
    o.again.length > 0 ||
    o.done ||
    (o.ask && !o.locked) ||
    o.closing === 'enough'
  if (singing && !v.finished && !wayOn) out.push('a card with no way on')
  return out
}

describe('every route a visit can take', () => {
  it('offers what the spec asks for, and nothing it forbids, at every step', () => {
    // Arrange: every way a visit opens; a route ends where no step is left,
    // and the bound only proves that every route did
    const BOUND = 16
    const problems = new Set<string>()
    const seen = new Set<string>()
    let routes = 0
    let cut = 0
    localStorage.clear()
    sessionStorage.clear()

    /** `pressed`: the visit as it stood when the open take's button was pressed. */
    function walk(
      v: LadderVisit,
      r: Route,
      pressed: LadderVisit | null,
      depth: number,
    ): void {
      const o = offers(v)
      for (const p of routeProblems(v, o, r)) problems.add(p)
      const key = JSON.stringify(v)
      if (!seen.has(key)) {
        seen.add(key)
        for (const p of stateProblems(v, o)) problems.add(p)
      }
      const ways = steps(v, r)
      if (ways.length === 0) routes++
      else if (depth === 0) cut++
      else
        for (const s of ways) {
          const after = run(s.events, v)
          const begun = s.events[s.events.length - 1].type === 'begin'
          if (
            s.label === 'silenced' &&
            !isDeepStrictEqual(after, {
              ...pressed,
              sound: false,
              silentPress: true,
            })
          )
            problems.add('the card changed by a take the sound cut off')
          walk(
            after,
            along(r, s),
            begun ? run(s.events.slice(0, -1), v) : pressed,
            depth - 1,
          )
        }
    }

    // Act
    for (const voice of [null, 'lower'] as const)
      for (const webAudio of [true, false])
        walk(openVisit({ voice, sound: true, webAudio }), START, null, BOUND)

    // Assert
    expect([...problems]).toEqual([])
    expect(cut).toBe(0)
    // 44,686 routes over 9,854 states: a floor near them catches a walk
    // that a rule has cut short
    expect(routes).toBeGreaterThan(40_000)
    expect(seen.size).toBeGreaterThan(9_000)
    expect([localStorage.length, sessionStorage.length]).toEqual([0, 0])
  })
})
