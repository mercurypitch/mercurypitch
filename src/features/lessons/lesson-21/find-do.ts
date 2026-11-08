// ============================================================
// Lesson 21 Find do — a key signature, and the house to place on do
// ============================================================
//
// Step 4's toy (WEB-SPEC, Toys 4): the learner's staff with a key signature
// and no notes, in six rounds in a fixed order, G, D and A major, then F, B
// flat and E flat major (FACTS 26). A tap on any of the staff's eleven
// places, its nine lines and spaces and the space just above and below,
// puts the house there and plays that place's note for 0.8 s as the
// signature has it; Step up and Step down and the arrow keys move the house
// a place. A place with do's letter, in either octave, is right: its line
// says why, do, mi and so play from the house, and Next round appears. Any
// other place names its note and gives the rule, and the next tap tries
// again; nothing is counted. After the sixth: "All six found." and Again,
// which starts at G again. The line is shown, and said with the place in
// the staff's live region, so a screen reader hears one sentence.

import { q } from '@/features/lessons/kit/dom'
import type { Spelled } from '@/features/lessons/kit/notes'
import { signName, signsHtml, wordName } from '@/features/lessons/kit/notes'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type { StaffState, StaffToy } from '@/features/lessons/kit/staff'
import { mountStaff } from '@/features/lessons/kit/staff'
import { keyWords } from '@/features/lessons/kit/staff-key'
import type { Clef } from '@/features/lessons/kit/staff-places'
import { sayPlace } from '@/features/lessons/kit/staff-places'
import type { Round } from './sounds'
import { ALL_FOUND, ANSWER_AFTER, answerOf, FIND_REACH, ROUNDS } from './sounds'

/** Find do's staff in `clef` for `round`: its signature, the house to place, the eleven places. */
export const findStaff = (clef: Clef, round: Round): StaffState => ({
  staff: 'single',
  clef,
  tap: 'place',
  key: round.key,
  keyRoom: 3,
  house: true,
  reach: FIND_REACH,
})

/** What a tap on `note` says in `round`: right, with the round's line, or the note and the rule. */
export function verdict(
  round: Round,
  note: Spelled,
): { readonly right: boolean; readonly line: string } {
  if (note.letter === round.do) return { right: true, line: round.right }
  const name = signName(note, { octave: false })
  return { right: false, line: `That's ${name}. ${round.rule}` }
}

/** A line with every sign spoken: "F sharp", not "F♯". */
const spoken = (line: string): string =>
  line.replace(/([A-G])([♯♭])/g, (_m, l: string, s: string) =>
    wordName(
      { letter: l as Spelled['letter'], alter: s === '♯' ? 1 : -1, octave: 4 },
      { octave: false },
    ),
  )

export interface FindDo {
  readonly staff: StaffToy
  readonly round: number
  /** The learner's clef: the round's signature in it, the house to place again. */
  setClef(clef: Clef): void
  /** Starts again at G. */
  again(): void
  stop(): void
}

export function mountFindDo(
  root: HTMLElement,
  o: { readonly clef: Clef },
): FindDo {
  const lineEl = q('[data-find-line]', root)
  const nextBtn = q<HTMLButtonElement>('[data-find-next]', root)
  const againBtn = q<HTMLButtonElement>('[data-find-again]', root)
  let clef = o.clef
  let at = 0
  let found = false
  // a tap's answer, waiting its 1.0 s
  let answer = 0

  const staff = mountStaff(root, {
    state: findStaff(clef, ROUNDS[0]),
    owner: NowPlaying,
    onPick: (n) => picked(n),
    onClef: (c) => setClef(c),
  })

  function show(line: string): void {
    lineEl.innerHTML = signsHtml(line)
  }

  function open(i: number): void {
    at = i
    found = false
    window.clearTimeout(answer)
    staff.setState(findStaff(clef, ROUNDS[at]))
    show('')
    nextBtn.hidden = true
    againBtn.hidden = true
  }

  function picked(n: Spelled): void {
    window.clearTimeout(answer)
    const round = ROUNDS[at]
    const v = verdict(round, n)
    show(v.line)
    staff.say(`${sayPlace(n, staff.kind)}. ${spoken(v.line)}`)
    if (!v.right) return
    found = true
    // do, mi and so from the house, after the tap's own note and a breath
    answer = window.setTimeout(() => {
      void staff.play({ show: 'run', notes: answerOf(n) })
    }, ANSWER_AFTER * 1000)
    const last = at === ROUNDS.length - 1
    nextBtn.hidden = last
    againBtn.hidden = !last
    if (last) {
      show(`${v.line} ${ALL_FOUND}`)
      staff.say(`${sayPlace(n, staff.kind)}. ${spoken(v.line)} ${ALL_FOUND}`)
    }
  }

  function setClef(c: Clef): void {
    clef = c
    window.clearTimeout(answer)
    staff.setState(findStaff(c, ROUNDS[at]))
    staff.say(c === 'treble' ? 'Treble clef.' : 'Bass clef.')
    if (!found) show('')
  }

  nextBtn.addEventListener('click', () => {
    open(Math.min(ROUNDS.length - 1, at + 1))
    // the new signature, as a reader needs it to find do
    staff.say(keyWords(ROUNDS[at].key))
  })
  againBtn.addEventListener('click', () => open(0))

  return {
    staff,
    get round() {
      return at
    },
    setClef(c) {
      // the switch's own path: the toy changes its clef and hands it over
      if (c !== staff.clef) staff.setClef(c)
    },
    again: () => open(0),
    stop() {
      window.clearTimeout(answer)
      staff.stop()
    },
  }
}
