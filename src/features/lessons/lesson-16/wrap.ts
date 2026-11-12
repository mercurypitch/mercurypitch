// ============================================================
// Lesson 16 wrap — the practice card's rest line, free play, the tease still
// ============================================================
//
// The practice card is Sight-Singing's; after "Effortful", "Uncomfortable"
// or "Just listen today" in Sing it it shows the rest line above its text
// (FACTS 52). The ending is held in memory for the visit (kit/comfort.ts
// `VisitEnding`), never stored, so a new visit opens with no rest line.
//
// Free play is the steps' staff toy once more (WEB-SPEC, Toys 2): the
// learner's staff with every play from the steps, Hear it inside, Names
// on · off, the clef and the pitch line, following Sing it's voice choice
// at once. It is not counted. Leaving it stops what it plays.
//
// The tease still (Toys 7) sits in the next-lesson card's slot: Lesson
// 17's stage before its first play, Lesson 8's four beat pads numbered 1
// to 4, an empty line above them and an empty stopwatch strip under them,
// nothing written and nothing lit (FACTS 5). It is drawn once, after first
// paint, from the rhythm kit (tease.ts), so the page's first paint carries
// none of it; it plays nothing, since the card is a link.

import { VisitEnding } from '@/features/lessons/kit/comfort'
import { q, qa } from '@/features/lessons/kit/dom'
import { onLeave } from '@/features/lessons/kit/leave'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import { playLights } from '@/features/lessons/kit/play-lights'
import type { StaffToy } from '@/features/lessons/kit/staff'
import { mountStaff } from '@/features/lessons/kit/staff'
import type { Clef } from '@/features/lessons/kit/staff-places'
import { VoiceChoice } from '@/features/lessons/kit/voice-choice'
import type { StepPlay } from './sounds'
import { staffState, stepPlay } from './sounds'
import { HearInside, learnerClef } from './steps'

/** Free play: the steps' staff toy and its plays, in the learner's clef. */
export function initFreePlay(): StaffToy {
  const light = playLights()
  const root = q('#freePlay')
  let clef: Clef = learnerClef()
  const toy = mountStaff(root, {
    state: staffState(clef, true),
    owner: NowPlaying,
    onClef: (c) => setClef(c),
  })

  function setClef(c: Clef): void {
    clef = c
    toy.setState(staffState(c, toy.names))
  }

  for (const b of qa<HTMLButtonElement>('button[data-staff-play]', root)) {
    const name = b.dataset.staffPlay as StepPlay
    b.addEventListener('click', () =>
      light(b, toy.play(stepPlay(name, clef, HearInside.on))),
    )
  }
  // the staff follows Sing it's voice choice at once
  VoiceChoice.subscribe(() => {
    const c = learnerClef()
    if (c !== clef) setClef(c)
  })
  onLeave(root, () => toy.stop())
  return toy
}

export function initWrap(): StaffToy {
  const rest = q('#practiseCard [data-ending="rest"]')
  VisitEnding.subscribe((ending) => {
    rest.hidden = ending !== 'rest'
  })
  const tease = document.querySelector<SVGSVGElement>(
    '.l16-tease svg[data-tease-pads]',
  )
  if (tease !== null)
    void import('./tease').then(
      ({ drawTease }) => drawTease(tease),
      () => undefined,
    )
  return initFreePlay()
}
