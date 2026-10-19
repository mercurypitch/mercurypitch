// ============================================================
// Lesson 1 spiral toy — Figs. 5 and 6, the pitch spiral and its keyboard
// ============================================================
//
// The kit's spiral (kit/spiral.ts) on step 5's stage, which step 6 shares:
// there the controls swap to the keyboard's, the full names sit beside the
// beads, the spiral stops turning by itself and may unroll. The five notes
// between the letters stay unnamed here: naming them is Lesson 2.

import { q } from '@/features/lessons/kit/dom'
import { fmtHz, hz, nameOf } from '@/features/lessons/kit/notes'
import { Sound } from '@/features/lessons/kit/sound'
import { mountSpiral } from '@/features/lessons/kit/spiral'
import type { StepDeck } from '@/features/lessons/kit/step-deck'
import { registerToy } from '@/features/lessons/kit/step-deck'

const say = (m: number): string =>
  `${nameOf(m) ?? 'A note without a letter of its own (Lesson 2)'}, ${fmtHz(hz(m))} hertz`

export function initSpiralToy(deck: StepDeck): void {
  let step6 = false
  const spiral = mountSpiral(q('[data-toy="5"]'), {
    active: deck.toyActive(5),
    span: 'A3 to A4: seven white keys',
    valueText: say,
    tag: (m) => `${nameOf(m) ?? 'unnamed (Lesson 2)'} · ${fmtHz(hz(m))} Hz`,
    hint: ({ focused, unrolled }) =>
      focused
        ? unrolled
          ? 'Arrows pick a key · Enter plays it'
          : 'Arrows pick a note · Enter plays · Shift+arrows turn'
        : unrolled
          ? 'Tap any key to hear it'
          : step6
            ? 'Unroll it, or tap a bead'
            : 'Drag to turn · tap a bead to hear it',
  })

  let asBusy = false

  async function playEveryA(): Promise<void> {
    if (asBusy) return
    asBusy = true
    const audible = Sound.canPlay()
    for (const m of [45, 57, 69, 81])
      await spiral.play(m, { audible, dur: 0.62 })
    asBusy = false
  }
  q('#playAs').addEventListener('click', () => void playEveryA())

  registerToy({
    onStep(n) {
      const six = n === 6
      if (six === step6) return
      step6 = six
      q('#spiralControls').hidden = six
      q('#keysControls').hidden = !six
      q('#keyTickets').hidden = !six
      spiral.setLabels(six ? 'name' : 'letter')
      spiral.setTurning(!six)
      if (!six) spiral.setUnrolled(false)
      q('#spiralEyebrow').innerHTML = six
        ? '<span class="fig">Fig. 6</span> The spiral, unrolled'
        : '<span class="fig">Fig. 5</span> The pitch spiral'
      spiral.refresh()
    },
  })
}
