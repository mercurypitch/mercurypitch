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
// The card draws inside a Suspense, so Home does not wait for it, and inside
// an ErrorBoundary: a dead chunk (offline, or a deploy swapped the hashed
// assets) or a card that breaks as it draws costs Home the card and not the
// page. The log does not say which, since the boundary cannot tell.
//
// Until the chunk is in, the Suspense keeps a slot for the card, so a card
// that lands after Home's first paint does not push Home down (the PR 1.3
// gate's H-4: the session card moved 273 px on a phone, a layout shift of 0.23
// for a budget of 0.1). Whether a card is due, and how tall it last drew here,
// is read at once from plan-card-slot.ts, the one plan module Home takes at
// run time (it and the card's rules it reads make no signal and say no
// words), in the branch a web build keeps, and inside a guard: a read that
// throws costs Home the slot and not the page, as the boundary below does for
// the card. The slot is the card's frame, empty, at that height, or at the
// height this sheet guesses for its kind; when no card is due it is nothing.
//
// This file is where Home reaches the card, so it is also where Home answers
// the one thing the card asks of it: the Start here row that is today's
// session, which is Home's own (`startPlannedSession`). First Light and the
// plan layer ask the same from outside Home (src/lib/home-session-ask.ts), and
// the mount answers them with the card's own handler while Home is drawn. It
// lives here and not in HomePage.tsx because a page that needs its whole world
// to render cannot be tested for what it does. Both are held by
// home-card-mount.test.ts (R30, read from source) and
// HomePlanCardMount.test.ts (run).

import type { Component, JSX } from 'solid-js'
import { ErrorBoundary, lazy, onCleanup, onMount, Show, Suspense, } from 'solid-js'
import type { HomePlanCardProps } from '@/features/plan/HomePlanCard'
import type { PlanCardSlot } from '@/features/plan/plan-card-slot'
import { readPlanCardSlot } from '@/features/plan/plan-card-slot'
import { answerHomeSessionAsks } from '@/lib/home-session-ask'
import { IS_NATIVE_BUILD } from '@/lib/native-build'
import styles from './HomePlanCardMount.module.css'

const HomePlanCard: Component<HomePlanCardProps> = IS_NATIVE_BUILD
  ? () => null
  : lazy(async () =>
      import('@/features/plan/HomePlanCard').then((m) => ({
        default: m.HomePlanCard,
      })),
    )

/** The card's slot while its chunk is on the way: its empty frame, or nothing when no card is due. */
function CardSlot(props: { slot: PlanCardSlot | null }): JSX.Element {
  return (
    <Show when={props.slot}>
      {(slot) => (
        <div
          class={styles.slot}
          data-kind={slot().kind}
          data-testid="home-plan-slot"
          aria-hidden="true"
          style={
            slot().height === null
              ? undefined
              : { height: `${slot().height}px` }
          }
        />
      )}
    </Show>
  )
}

/**
 * The slot Home keeps for the card as it is drawn: none in the native build,
 * and none, said once, when the read throws (storage holding what no card
 * wrote), so Home is drawn whatever is stored.
 */
function slotNow(): PlanCardSlot | null {
  try {
    return IS_NATIVE_BUILD
      ? null
      : readPlanCardSlot(Date.now(), window.innerWidth)
  } catch (error: unknown) {
    console.warn('[home] Home kept no slot for the plan card:', error)
    return null
  }
}

/** Home's "Your plan" card, first in its grid; it draws nothing when there is nothing to say. */
export function HomePlanCardMount(props: HomePlanCardProps): JSX.Element {
  // Read once, as Home is drawn.
  const slot = slotNow()
  onMount(() => onCleanup(answerHomeSessionAsks(props.onHomeSession)))
  return (
    <ErrorBoundary
      fallback={(error: unknown) => {
        console.warn('[home] The plan card was left out of Home:', error)
        return null
      }}
    >
      <Suspense fallback={<CardSlot slot={slot} />}>
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
