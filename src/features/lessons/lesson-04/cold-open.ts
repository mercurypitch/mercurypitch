// ============================================================
// Lesson 4 cold open — Merc stops on ti, and the predict moves the start
// ============================================================
//
// The bubbles, each with its Merc's still, beside the compact staircase, so
// the sound and the stairs are on screen together (playbook rule 10). Play
// from C and Land on do work from the start: orange's line answers them.
// Play from D waits for a guess, then slides the staircase up two rows,
// announced "Major scale from D", and climbs to ti in orange Merc's "ooh"
// (FACTS 59). Stopping on ti leaves the top stair an outline with the arrow
// up from ti; Land on do finishes whichever scale stopped last, the top
// stair filling and its house lit. The reveal follows Play from D once it
// has been heard, and orange celebrates once. The compact staircase takes
// no taps (the buttons carry every action), so its drawing is hidden from
// a screen reader and a polite live region speaks for it.

import { q, wait } from '@/features/lessons/kit/dom'
import { watch } from '@/features/lessons/kit/frame-loop'
import type { Which } from '@/features/lessons/kit/merc-duo'
import { mercCelebrate } from '@/features/lessons/kit/merc-duo'
import { COLOR } from '@/features/lessons/kit/notes'
import { mountPredict } from '@/features/lessons/kit/predict'
import { landOnDo, stopOnTi } from './examples'
import { singAlong } from './hero'
import { mountStairs } from './stairs-core'

const C4 = 60
const D4 = 62

const GUESS: Readonly<Record<string, string>> = {
  still: 'You said: still unfinished',
  'only-c': 'You said: only from C',
}

/** Who sings a start: blue Merc from C, orange Merc from D. */
const singer = (tonic: number): Which => (tonic === C4 ? 'blue' : 'orange')
const lightOf = (which: Which): string =>
  which === 'blue' ? COLOR.blue : COLOR.orange

export function initColdOpen(): void {
  const root = q('#predict')
  const said = q('[data-cold-said]', root)
  const box = q('#coldStairs')
  const stairs = mountStairs({
    canvas: q<HTMLCanvasElement>('canvas', box),
    compact: true,
    active: watch(box),
  })

  async function climb(tonic: number, audible: boolean): Promise<void> {
    if (stairs.tonic !== tonic) {
      stairs.setTonic(tonic)
      await wait(stairs.travel)
    }
    const which = singer(tonic)
    const sing = singAlong(which)
    const events = stopOnTi(tonic)
    stairs.set({ waiting: false, home: false })
    said.textContent = `Major scale from ${tonic === C4 ? 'C' : 'D'}`
    await stairs.play(events, audible, {
      kind: 'merc',
      color: lightOf(which),
      onNote: (e, i) => {
        sing(e, i, events.length)
        if (i !== events.length - 1) return
        stairs.set({ waiting: true })
        said.textContent = 'Stopped on ti. Land on do finishes the scale.'
      },
    })
  }

  async function land(audible: boolean): Promise<void> {
    const tonic = stairs.tonic
    const which = singer(tonic)
    const sing = singAlong(which)
    const events = landOnDo(tonic)
    await stairs.play(events, audible, {
      kind: 'merc',
      color: lightOf(which),
      onNote: (e, i) => {
        sing(e, i, events.length)
        if (i === events.length - 1) stairs.set({ waiting: false, home: true })
      },
    })
  }

  mountPredict(root, {
    play: (what, audible) => {
      if (what === 'land') return land(audible)
      return climb(what === 'from-d' ? D4 : C4, audible)
    },
    revealOn: ['from-d'],
    hints: {
      chosen:
        'Locked in. Play from D: Merc climbs the same steps from D and stops on ti.',
      silent:
        'Sound is off, so nothing played. Turn sound on to hear it, then press Play from D.',
      again: 'Press Land on do to finish it, or play either start again.',
    },
    guess: (choice) => GUESS[choice] ?? 'You said',
    onReveal: () => mercCelebrate('orange', 1600),
  })
}
