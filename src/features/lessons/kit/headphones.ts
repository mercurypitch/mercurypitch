// ============================================================
// Headphones — asked before holds that sound a drone under them
// ============================================================
//
// A take that keeps a drone sounding (kit/sound.ts, `Sound.hush` with a
// kept voice) needs headphones, or the microphone hears the drone. So the
// page asks first, in its own words: two buttons, "I have headphones on" and
// "No headphones" (Lesson 24 WEB-SPEC, Toys 6, state 4). "No headphones"
// opens the page's sing-along, which asks for no microphone. The answer
// holds for the visit, in memory, and is never stored: a return visit asks
// again, since the headphones may not be on then (Lesson 24 FACTS 51).
// Lesson 26 asks the same. Nothing here can tell whether headphones are
// really on; the quiet check (kit/quiet-check.ts) is the page's guard.

import { qa } from './dom'

/** The visit's answer: 'on', 'off', or null before it is asked. */
export type PhonesAnswer = 'on' | 'off'

let answer: PhonesAnswer | null = null

/** The visit's answer to the headphones check, in memory only. */
export const Headphones = {
  get answer(): PhonesAnswer | null {
    return answer
  },
  /** Forgets the answer, as a new visit does (tests). */
  reset(): void {
    answer = null
  },
}

/** What each answer opens: the page's next panel. */
export interface PhonesHandlers {
  readonly onOn: () => void
  readonly onOff: () => void
}

/** Wires the check's two buttons, `[data-phones="on"]` and `[data-phones="off"]`, under `root`. */
export function mountHeadphones(root: HTMLElement, on: PhonesHandlers): void {
  for (const b of qa<HTMLButtonElement>('[data-phones]', root))
    b.addEventListener('click', () => {
      answer = b.dataset.phones === 'off' ? 'off' : 'on'
      if (answer === 'off') on.onOff()
      else on.onOn()
    })
}
