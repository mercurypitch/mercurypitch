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
// Eight things are easy to break:
//
// - Home reaches this file only through a lazy import behind IS_NATIVE_BUILD
//   (src/pages/HomePlanCardMount.tsx, held by home-card-mount.test.ts): it
//   makes the plan's store and words part of Home's chunk, and the native
//   bundle has no plan.
// - Home keeps a slot for the card until this chunk is in, at the height the
//   card last drew at on this device (plan-card-slot.ts), so the card keeps
//   that height for Home's next load once it settles, and keeps 0 for a
//   record it draws nothing for (every stop done, or out of its week), or
//   Home would hold a slot open for a card that is not coming. A card the X
//   hid keeps the height it had: the hide alone keeps Home's slot shut, since
//   the slot reads it, and Settings' Show on Home then brings the card back
//   at that height, with no jump.
// - It is one grid item of Home's grid, so it draws no wrapper of its own, and
//   an absent card leaves no hole: the Switch below renders nothing, not an
//   empty element.
// - A row opens its stop the way the plan layer does (the funnel told, the
//   stop marked opened, the menu made whole if it lacks the stop's room, then
//   enterStop) and never starts a tour: a tour is what "Show me around" asks
//   for. Whether a stop is then ticked is plan-progress.ts's: opening a room
//   that has a first value ticks nothing.
// - The answered card ends with a quiet Change my answers, which opens the
//   plan layer on the four questions with the answers given picked (the
//   layer's `change`: a review, opened where its own Change my answers opens
//   it). So Not now goes back to the plan as it was, Done saves the new answers
//   and shows the new plan, which this card then draws, and nothing is told
//   to the funnel: a review tells nothing for answers. The ask has none; its
//   Start opens the four taps.
// - The Start here that is today's session is Home's own: the card is on Home,
//   so entering the Home tab would go nowhere. The card tells the funnel and
//   marks the stop as any row does, and hands the rest to Home (`onHomeSession`),
//   which builds the session or takes the person to the one in progress.
// - The X hides the card on this device for the plan it shows, not for good:
//   the store keeps that record's date (hidePlanCard, plan-store.ts), so a
//   plan answered again, here or on another device, has its card back for its
//   week, and the rule for which record a hide hides is plan-card-rules.ts's.
//   The store's signal hides it at once and the key is written after, so a
//   device that refuses the write still loses the card for this visit, and a
//   key that cannot be read is a card that was not hidden. The X goes with the
//   card, so the focus it had goes to the page's main region, and a keyboard
//   user is not dropped at the top of the page.
// - Then a toast says where the plan still is, with Undo, on a channel of its
//   own, so a second X replaces the first toast and never stands above it.
//   Undo clears the hide, the card is drawn again where it was, first in
//   Home's grid, and the focus goes to its X, which is where it was when the
//   card went: a keyboard user is back where they left off, inside the card,
//   and the next Tab reaches its rows. An Undo after Home has gone still
//   clears the hide, and the card comes back the next time Home draws.
//   Neither the X nor Undo tells the funnel anything.
//
// The card follows the record, the menu and the stops opened, so it turns into
// the plan when the questions are answered behind it and loses a row the menu
// hides. It draws no Merc: the layer that the Start opens has the one Merc.

import type { JSX } from 'solid-js'
import { createEffect, createMemo, createUniqueId, Index, Match, onCleanup, Show, Switch, untrack, } from 'solid-js'
import { CheckSmall, X } from '@/components/icons'
import { trackGuide } from '@/lib/guide-funnel'
import { showActionNotification } from '@/stores/notifications-store'
import { practiceScope, uiMode } from '@/stores/settings-store'
import type { PlanDest, PlanStop } from './build-plan'
import { PLAN_DESTS } from './build-plan'
import { enterStop, widenMenuFor } from './enter-stop'
import styles from './HomePlanCard.module.css'
import { PLAN_CARD_SLOT_SETTLE_MS, rememberPlanCardSlot, } from './plan-card-slot'
import { KICKER, PLAN_PLACES } from './plan-copy'
import { homePlanCardState } from './plan-progress'
import { hidePlanCard, markStopOpened, openPlanLayer, planCardHidden, planRecord, showPlanCard, } from './plan-store'
import { MERC_INTRO } from './questions'

interface Row {
  stop: PlanStop
  done: boolean
}

/** The toast the X raises is the only one on this channel, so a second X replaces it. */
const HIDDEN_CHANNEL = 'plan-card-hidden'

export interface HomePlanCardProps {
  /**
   * What Home does for the Start here row that is today's session: builds the
   * session, or takes the person to the one in progress, and never replaces it.
   * Home owns it because the session is Home's (HomePage.tsx).
   */
  onHomeSession: () => void
}

// ── Pieces of the card ─────────────────────────────────────────────────

/** The X that hides the card. A picture from the project's icons, named for a screen reader. */
function HideButton(props: {
  onHide: () => void
  keepX: (x: HTMLButtonElement) => void
}): JSX.Element {
  return (
    <button
      ref={(el) => props.keepX(el)}
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

/** The answered plan: a row for each stop, and a quiet way back to its questions. */
function PlanCard(props: {
  rows: readonly Row[]
  onOpen: (stop: PlanStop) => void
  onChange: () => void
  onHide: () => void
  keep: (card: HTMLElement) => void
  keepX: (x: HTMLButtonElement) => void
}): JSX.Element {
  const headingId = createUniqueId()
  return (
    <section
      ref={(el) => props.keep(el)}
      class={styles.card}
      aria-labelledby={headingId}
      data-testid="home-plan-card"
    >
      <div class={styles.head}>
        <h2 id={headingId} class={styles.title}>
          Your plan
        </h2>
        <HideButton onHide={props.onHide} keepX={props.keepX} />
      </div>
      <ul class={styles.rows} role="list">
        {/* Index, not For: a tick changes a row that stays, and the row's
            button keeps its place, and the focus on it. */}
        <Index each={props.rows}>
          {(row) => <PlanRow row={row()} onOpen={props.onOpen} />}
        </Index>
      </ul>
      <button
        type="button"
        class={styles.change}
        onClick={() => props.onChange()}
      >
        {PLAN_PLACES.changeAnswers}
      </button>
    </section>
  )
}

/** For a skipper: Merc's line, and a Start that opens the four taps. */
function AskCard(props: {
  onHide: () => void
  keep: (card: HTMLElement) => void
  keepX: (x: HTMLButtonElement) => void
}): JSX.Element {
  const headingId = createUniqueId()
  return (
    <section
      ref={(el) => props.keep(el)}
      class={styles.card}
      aria-labelledby={headingId}
      data-testid="home-plan-card"
    >
      <div class={styles.head}>
        <h2 id={headingId} class={styles.title}>
          Your plan, in four taps
        </h2>
        <HideButton onHide={props.onHide} keepX={props.keepX} />
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
  const card = createMemo(() =>
    homePlanCardState({
      record: planRecord(),
      dismissed: planCardHidden(),
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

  // The card's X as it is drawn now, for Undo to give the focus back to.
  let x: HTMLButtonElement | undefined
  const keepX = (el: HTMLButtonElement): void => {
    x = el
  }

  const undo = (): void => {
    // The card is drawn again at once, where it was (the Switch below follows
    // the hide), and its X with it. A Home that has gone has no X to focus:
    // the card is back the next time Home draws.
    showPlanCard()
    if (x?.isConnected === true) x.focus()
  }

  const hide = (): void => {
    hidePlanCard()
    // The X is gone with the card, and the focus it had would fall to the top
    // of the page: keep it in the page's main region, where it was.
    document.getElementById('main-content')?.focus({ preventScroll: true })
    showActionNotification(
      PLAN_PLACES.offHome,
      'info',
      { label: PLAN_PLACES.undo, onClick: undo },
      { channel: HIDDEN_CHANNEL },
    )
  }

  // What Home keeps for the card on its next load, before this chunk is in:
  // the height the card is drawn at, as it changes (a row the menu hides, a
  // font that lands), and 0 for a record it draws nothing for. A height is
  // kept once it has held for PLAN_CARD_SLOT_SETTLE_MS, so a window dragged
  // wider writes once and not once a frame; one not yet settled is kept as the
  // page goes away or Home does, unless the card has gone first (the X, which
  // keeps the height it had settled at, or its last stop done, which keeps its
  // 0). A card that is not laid out (a page that is not displayed) measures 0
  // and keeps nothing, so a hidden Home does not wipe what the card kept. Each
  // keeps it for the record the card drew, which a store write gives the card
  // before it is in storage.
  const drawnStops = (): PlanDest[] =>
    (untrack(rows) ?? []).map((row) => row.stop.dest)
  const drawnAt = (): string | undefined => untrack(planRecord)?.at
  const keep = (el: HTMLElement): void => {
    if (typeof ResizeObserver === 'undefined') return
    let settling: ReturnType<typeof setTimeout> | undefined
    let unkept: { height: number; width: number } | null = null
    const keepNow = (): void => {
      clearTimeout(settling)
      if (unkept === null || untrack(card) === null) return
      rememberPlanCardSlot(unkept.height, unkept.width, drawnStops(), drawnAt())
      unkept = null
    }
    const seen = new ResizeObserver(() => {
      const { height } = el.getBoundingClientRect()
      if (height <= 0) return
      unkept = { height, width: window.innerWidth }
      clearTimeout(settling)
      settling = setTimeout(keepNow, PLAN_CARD_SLOT_SETTLE_MS)
    })
    seen.observe(el)
    window.addEventListener('pagehide', keepNow)
    onCleanup(() => {
      seen.disconnect()
      window.removeEventListener('pagehide', keepNow)
      keepNow()
    })
  }
  createEffect(() => {
    const at = planRecord()?.at
    if (card() === null && !planCardHidden()) {
      rememberPlanCardSlot(0, window.innerWidth, [], at)
    }
  })

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
        {(stops) => (
          <PlanCard
            rows={stops()}
            onOpen={open}
            onChange={() => openPlanLayer('change')}
            onHide={hide}
            keep={keep}
            keepX={keepX}
          />
        )}
      </Match>
      <Match when={asking()}>
        <AskCard onHide={hide} keep={keep} keepX={keepX} />
      </Match>
    </Switch>
  )
}
