// ============================================================
// HomePlanCard — "Your plan" on Home: the stops to do, or the four taps to ask for
// ============================================================
//
// What Home shows a person in the week after the plan: the stops of the plan
// they answered, a tick on each they have done and a way into the next, or,
// for someone who skipped the questions or turned them down, Merc's line and
// a Start that opens the four taps. When there is nothing to say it draws
// nothing at all, so Home is as it was. Which of the three it is, and what a
// tick means, are plan-progress.ts's; this draws what that says.
//
// Five things are easy to break:
//
// - Home reaches this file only through a lazy import behind IS_NATIVE_BUILD
//   (src/pages/HomePlanCardMount.tsx, held by home-card-mount.test.ts): it
//   makes the plan's store and words part of Home's chunk, and the native
//   bundle has no plan.
// - It is one grid item of Home's grid, so it draws no wrapper of its own, and
//   an absent card leaves no hole: the Switch below renders nothing, not an
//   empty element.
// - A row opens its stop the way the plan layer does (the funnel told, the
//   stop marked opened, the menu made whole if it lacks the stop's room, then
//   enterStop) and never starts a tour: a tour is what "Show me around" asks
//   for. Whether a stop is then ticked is plan-progress.ts's: opening a room
//   that has a first value ticks nothing.
// - The Start here that is today's session is Home's own: the card is on Home,
//   so entering the Home tab would go nowhere. The card tells the funnel and
//   marks the stop as any row does, and hands the rest to Home (`onHomeSession`),
//   which builds the session or takes the person to the one in progress.
// - The X hides the card for good on this device. The signal hides it at once
//   and the key is written after, so a device that refuses the write still
//   loses the card for this visit, and a key that cannot be read is a card
//   that was not hidden. A stored value is a hiding only when it is `true`.
//   The X goes with the card, so the focus it had goes to the page's main
//   region, and a keyboard user is not dropped at the top of the page.
//
// The card follows the record, the menu and the stops opened, so it turns into
// the plan when the questions are answered behind it and loses a row the menu
// hides. It draws no Merc: the layer that the Start opens has the one Merc.

import type { JSX } from 'solid-js'
import { createMemo, createSignal, createUniqueId, Index, Match, Show, Switch, } from 'solid-js'
import { CheckSmall, X } from '@/components/icons'
import { trackGuide } from '@/lib/guide-funnel'
import { storageGet, storageSet } from '@/lib/storage'
import { practiceScope, uiMode } from '@/stores/settings-store'
import type { PlanStop } from './build-plan'
import { PLAN_DESTS } from './build-plan'
import { enterStop, widenMenuFor } from './enter-stop'
import styles from './HomePlanCard.module.css'
import { KICKER } from './plan-copy'
import { PLAN_CARD_DISMISSED_KEY } from './plan-keys'
import { homePlanCardState } from './plan-progress'
import { markStopOpened, openPlanLayer, planRecord } from './plan-store'
import { MERC_INTRO } from './questions'

interface Row {
  stop: PlanStop
  done: boolean
}

export interface HomePlanCardProps {
  /**
   * What Home does for the Start here row that is today's session: builds the
   * session, or takes the person to the one in progress, and never replaces it.
   * Home owns it because the session is Home's (HomePage.tsx).
   */
  onHomeSession: () => void
}

/** Has the person hidden the card on this device? Storage that cannot be read says no. */
const hiddenOnDevice = (): boolean =>
  storageGet<unknown>(PLAN_CARD_DISMISSED_KEY) === true

// ── Pieces of the card ─────────────────────────────────────────────────

/** The X that hides the card. A picture from the project's icons, named for a screen reader. */
function HideButton(props: { onHide: () => void }): JSX.Element {
  return (
    <button
      type="button"
      class={styles.hide}
      aria-label="Hide your plan"
      title="Hide your plan"
      onClick={() => props.onHide()}
    >
      <X />
    </button>
  )
}

/** One stop: what kind it is and where, what to do there, and a tick when it is done. */
function PlanRow(props: {
  row: Row
  onOpen: (stop: PlanStop) => void
}): JSX.Element {
  return (
    <li class={styles.item}>
      <button
        type="button"
        class={styles.row}
        data-kind={props.row.stop.kind}
        data-dest={props.row.stop.dest}
        data-done={props.row.done ? '' : undefined}
        onClick={() => props.onOpen(props.row.stop)}
      >
        <span class={styles.rowText}>
          <span class={styles.kicker}>
            <span data-part="kind">{KICKER[props.row.stop.kind]}</span>{' '}
            <span aria-hidden="true">·</span>{' '}
            <span data-part="room">{PLAN_DESTS[props.row.stop.dest].room}</span>
          </span>
          <span class={styles.rowTitle} data-part="title">
            {props.row.stop.title}
          </span>
        </span>
        <Show when={props.row.done}>
          <span
            class={styles.tick}
            role="img"
            aria-label="Done"
            data-part="tick"
          >
            <CheckSmall size={14} />
          </span>
        </Show>
      </button>
    </li>
  )
}

/** The answered plan: a row for each stop. */
function PlanCard(props: {
  rows: readonly Row[]
  onOpen: (stop: PlanStop) => void
  onHide: () => void
}): JSX.Element {
  const headingId = createUniqueId()
  return (
    <section
      class={styles.card}
      aria-labelledby={headingId}
      data-testid="home-plan-card"
    >
      <div class={styles.head}>
        <h2 id={headingId} class={styles.title}>
          Your plan
        </h2>
        <HideButton onHide={props.onHide} />
      </div>
      <ul class={styles.rows} role="list">
        {/* Index, not For: a tick changes a row that stays, and the row's
            button keeps its place, and the focus on it. */}
        <Index each={props.rows}>
          {(row) => <PlanRow row={row()} onOpen={props.onOpen} />}
        </Index>
      </ul>
    </section>
  )
}

/** For a skipper: Merc's line, and a Start that opens the four taps. */
function AskCard(props: { onHide: () => void }): JSX.Element {
  const headingId = createUniqueId()
  return (
    <section
      class={styles.card}
      aria-labelledby={headingId}
      data-testid="home-plan-card"
    >
      <div class={styles.head}>
        <h2 id={headingId} class={styles.title}>
          Your plan, in four taps
        </h2>
        <HideButton onHide={props.onHide} />
      </div>
      <div class={styles.ask}>
        <p class={styles.line}>{MERC_INTRO.q1}</p>
        <button
          type="button"
          class={styles.start}
          onClick={() => openPlanLayer('skipper')}
        >
          Start
        </button>
      </div>
    </section>
  )
}

// ── The card ───────────────────────────────────────────────────────────

export function HomePlanCard(props: HomePlanCardProps): JSX.Element {
  const [hidden, setHidden] = createSignal(hiddenOnDevice())

  const card = createMemo(() =>
    homePlanCardState({
      record: planRecord(),
      dismissed: hidden(),
      now: Date.now(),
      // The menu as it stands, so the rows are the ones the person can open.
      view: { scope: practiceScope(), mode: uiMode() },
    }),
  )
  const rows = (): readonly Row[] | null => {
    const state = card()
    return state?.kind === 'plan' ? state.stops : null
  }
  const asking = (): boolean => card()?.kind === 'ask'

  const hide = (): void => {
    setHidden(true)
    storageSet(PLAN_CARD_DISMISSED_KEY, true)
    // The X is gone with the card, and the focus it had would fall to the top
    // of the page: keep it in the page's main region, where it was.
    document.getElementById('main-content')?.focus({ preventScroll: true })
  }

  const open = (stop: PlanStop): void => {
    trackGuide(`plan_stop_${stop.kind}`)
    markStopOpened(stop.dest)
    if (stop.dest === 'homeSession') {
      props.onHomeSession()
      return
    }
    widenMenuFor(stop)
    enterStop(stop)
  }

  return (
    <Switch>
      <Match when={rows()}>
        {(stops) => <PlanCard rows={stops()} onOpen={open} onHide={hide} />}
      </Match>
      <Match when={asking()}>
        <AskCard onHide={hide} />
      </Match>
    </Switch>
  )
}
