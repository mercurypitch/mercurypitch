// ============================================================
// Lesson 18 choice — whether the predict's answer is in, for the locks
// ============================================================
//
// Step 1's two reads, in the step and in the Wrap's free play, stay locked
// until the predict's choice (WEB-SPEC, Toys 2): the cold open says the
// choice is in, and each lock listens, free play's too, which loads later
// as its own chunk. The kit's predict stores no choice, so a visit starts
// locked again; a lesson already marked done opens unlocked (`Done.has`).

type Listener = () => void

let made = false
const listeners = new Set<Listener>()

export const Choice = {
  get made(): boolean {
    return made
  },
  /** The predict's choice is in: every lock opens. */
  make(): void {
    if (made) return
    made = true
    for (const fn of listeners) fn()
  },
  /** Calls `fn` once the choice is in: at once if it is already. */
  whenMade(fn: Listener): void {
    if (made) fn()
    else listeners.add(fn)
  },
}

/** For the tests: a visit afresh. */
export function resetChoice(): void {
  made = false
  listeners.clear()
}
