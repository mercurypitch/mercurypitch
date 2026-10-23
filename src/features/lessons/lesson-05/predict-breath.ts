// ============================================================
// Lesson 5 Step 2 predict — after a big breath, a quiet note: push or hold?
// ============================================================
//
// The lesson's second predict (LESSON.md, Step 2). It needs no sound: the
// reveal comes with the choice, then Tavi's one line, a bubble with
// Tavi's still, as the cold open's bubbles sit by Merc and Tavi. It never
// calls a choice wrong. The gauge beside it then shows what the reveal
// says: first the body holds back, then it adds.

import { q } from '@/features/lessons/kit/dom'
import { reducedMotion } from '@/features/lessons/kit/motion-switch'
import { mountPredict } from '@/features/lessons/kit/predict'

const GUESS: Readonly<Record<string, string>> = {
  push: 'You said: push it out',
  hold: 'You said: hold it back',
}

export function initBreathPredict(): void {
  const root = q('#breathPredict')
  const reveal = q('.reveal', root)
  const says = q('[data-orange-says]', root)
  const hint = q('.lock-hint', root)
  mountPredict(root, {
    // the answer needs no sound: it comes with the choice
    play: () => Promise.resolve(),
    plays: [],
    reveal: [],
    hints: { chosen: '', silent: '', again: '' },
    onChoice: (choice) => {
      hint.hidden = true
      q('.mono', reveal).textContent = GUESS[choice] ?? 'You said'
      for (const el of [reveal, says]) {
        el.hidden = false
        if (!reducedMotion())
          el.animate(
            [
              { transform: 'translateY(10px)', opacity: 0 },
              { transform: 'none', opacity: 1 },
            ],
            { duration: 600, easing: 'cubic-bezier(.16, 1, .3, 1)' },
          )
      }
      // the pressed choice is now disabled: keep the keyboard's place on what it revealed
      reveal.tabIndex = -1
      reveal.focus({ preventScroll: true })
    },
  })
}
