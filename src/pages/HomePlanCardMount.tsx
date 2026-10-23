// ============================================================
// HomePlanCardMount — how Home reaches its "Your plan" card, and what Home does for it
// ============================================================
//
// "Your plan" is the first week's card (src/features/plan/HomePlanCard). Home
// renders on the web only, but App imports HomePage statically, so a static
// import of the card would put the plan's store, with the persisted signals it
// makes as it loads, in the native bundle, where there is no plan. So the
// constant picks a function that renders nothing before `lazy()` is ever
// written, as App does for First Light and the plan layer: the native build
// has neither the call nor the chunk. It also keeps the store and the plan's
// words out of Home's first paint.
//
// The card draws inside a Suspense, so Home does not wait for it and shows
// nothing in its place, and inside an ErrorBoundary: a dead chunk (offline, or
// a deploy swapped the hashed assets) or a card that breaks as it draws costs
// Home the card and not the page. The log does not say which, since the
// boundary cannot tell.
//
// This file is where Home reaches the card, so it is also where Home answers
// the one thing the card asks of it: the Start here row that is today's
// session, which is Home's own (`startPlannedSession`). It lives here and not
// in HomePage.tsx because a page that needs its whole world to render cannot
// be tested for what it does. Both are held by home-card-mount.test.ts
// (R30, read from source) and HomePlanCardMount.test.ts (run).

import type { Component, JSX } from 'solid-js'
import { ErrorBoundary, lazy, Suspense } from 'solid-js'
import type { HomePlanCardProps } from '@/features/plan/HomePlanCard'
import { IS_NATIVE_BUILD } from '@/lib/native-build'

const HomePlanCard: Component<HomePlanCardProps> = IS_NATIVE_BUILD
  ? () => null
  : lazy(async () =>
      import('@/features/plan/HomePlanCard').then((m) => ({
        default: m.HomePlanCard,
      })),
    )

/** Home's "Your plan" card, first in its grid; it draws nothing when there is nothing to say. */
export function HomePlanCardMount(props: HomePlanCardProps): JSX.Element {
  return (
    <ErrorBoundary
      fallback={(error: unknown) => {
        console.warn('[home] The plan card was left out of Home:', error)
        return null
      }}
    >
      <Suspense fallback={null}>
        <HomePlanCard onHomeSession={props.onHomeSession} />
      </Suspense>
    </ErrorBoundary>
  )
}

/** The two calls Home's session card is asked for here: is there a session (today's), and build one. */
export interface SessionRoutine {
  template: () => object | null
  generate: () => unknown
}

/**
 * What Home does when the plan's Start here is today's session: what its own
 * "Start today's session" does, and no more. With no session it builds one (the
 * card's own call, with the length the person picked there). With a session it
 * builds nothing: `generate()` starts the routine over and clears the segments
 * already done, so a session in progress is only taken to. Either way the
 * session card is brought into view, as little as will do, and the cursor goes
 * to its first button, which is the one that starts or resumes the segment, so
 * Enter picks the session up. The button is looked for after the build, since
 * building replaces what the card holds. Focus does not scroll again: the card
 * is already where it should be.
 */
export function startPlannedSession(
  routine: SessionRoutine,
  card: HTMLElement | undefined,
): void {
  if (routine.template() === null) routine.generate()
  card?.scrollIntoView?.({ block: 'nearest' })
  card?.querySelector('button')?.focus({ preventScroll: true })
}
