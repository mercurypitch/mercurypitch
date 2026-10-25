// ============================================================
// home-session-ask: today's session, asked of Home from outside it
// ============================================================
//
// The plan's Start here can be today's session, which is Home's own: Home
// builds it, brings its card into view and puts the cursor on it
// (`startPlannedSession`, in src/pages/HomePlanCardMount.tsx). Home's plan
// card calls that itself. First Light and the plan layer only switch to the
// Home tab, so a session picked there landed on Home with nothing built and
// the cursor nowhere. They ask here instead, and Home's card mount answers.
//
// It is a module of its own, with no imports, because Home may take nothing
// of the plan at run time (home-card-mount.test.ts): a static import rides
// into the native bundle.
//
// An ask waits for a Home that is not drawn yet, since switching to the tab
// draws Home in the same task. The answer comes a microtask after the ask, or
// after Home is drawn, so the layer or First Light has closed and its focus
// trap has put the focus back before Home moves it to the session. Each ask
// is answered once. One that no Home answers in five seconds is dropped: only
// a Home that failed to draw leaves one, and a later visit to Home must not
// jump to the session on its own.

/** How long an ask waits for a Home to answer it. */
const ASK_WAITS_MS = 5000

/** When the ask that is waiting was made, or null when none is. */
let askedAt: number | null = null

/** What each Home that is drawn does on hearing an ask. */
const homes = new Set<() => void>()

/** Asks Home for today's session: built if there is none, in view, the cursor on it. */
export function askHomeForTodaysSession(): void {
  askedAt = Date.now()
  for (const hear of homes) hear()
}

/**
 * Answers asks with `answer` until the function it returns is called: an ask
 * that is waiting, and every one made after. Each ask is answered once.
 */
export function answerHomeSessionAsks(answer: () => void): () => void {
  let drawn = true
  const hear = (): void => {
    queueMicrotask(() => {
      // A Home that went before the microtask leaves the ask for the next.
      if (!drawn || askedAt === null) return
      const waited = Date.now() - askedAt
      askedAt = null
      if (waited <= ASK_WAITS_MS) answer()
    })
  }
  homes.add(hear)
  if (askedAt !== null) hear()
  return () => {
    drawn = false
    homes.delete(hear)
  }
}
