// ============================================================
// usePlanFlowController — one run of the plan, wherever it is hosted
// ============================================================
//
// The four questions, the plan they make and every way off the plan, as one
// run with one set of rules. A host (First Light's questions beat, the plan
// layer in the app) owns the screens and the places they lead to; this owns
// what a tap means: what is saved (and sent on to the account, for a singer
// who holds one), what the funnel is told, what happens to the person's menu,
// and where the host is sent. The host draws the phase it is given, gives the
// screens the callbacks below and answers an exit.
//
// Five things are easy to break:
//
// - The answers are told once per run. The first `done` sends them with
//   `plan_done`; Back then Done, and Change my answers then Done, send
//   nothing more, and a Not now after that reports only the Not now. A
//   review sends nothing for answers at all: the plan was counted when it
//   was first answered.
// - The plan is built once, when the answers are in, from the menu as it
//   stands then, and is not rebuilt as the menu changes. The switch narrows
//   the menu, and a plan that followed it would lose the switch (the offer
//   is withheld once the menu is that narrow) while the person is still
//   looking at it. Answers changed with the switch on build for the menu
//   the person had before it, so the switch is still there to turn off.
// - A stop the menu hides is not opened onto a menu that lacks it. The menu
//   shows every room again first, with a notice, and only then is the host
//   told. Only the scope is blamed: where Simple mode hides the room,
//   showing every room would not bring it back, so nothing is changed or
//   said. A stop that is a page is outside the menu.
// - The credits line is worked out only for a plan that has a Karaoke Night
//   card, and never blocks it: a signed-in singer's balance and the cheapest
//   pack are fetched once, after the plan shows, and a failure, a build that
//   cannot take payment or a balance that cannot be read leaves no line.
//   `fetchPricing` throws on a bad answer; that is swallowed here.
// - Review's answers are not the host's. A reviewed plan is built from the
//   record, which keeps where a voiceprint pointed (never why), and answered
//   again it keeps that finding unless the host has a live one, or the new
//   plan would lose its voiceprint-led Start here.
//
// What the host sees: `phase` says which screen to draw; `plan`, `credits`,
// `scopeOn`, `pills`, `choices` and `texts` are what the screens take;
// `mercState` is the pose the host's one Merc is in. Every way off is one
// `onExit`, once.

import type { Accessor } from 'solid-js'
import { batch, createEffect, createMemo, createSignal, onCleanup, untrack, } from 'solid-js'
import { accountHeld } from '@/db/services/auth-service'
import { fetchBillingMe, fetchPricing } from '@/db/services/billing-service'
import type { GuideFunnelEvent } from '@/lib/funnel-event-catalog'
import { trackGuide } from '@/lib/guide-funnel'
import { askHomeForTodaysSession } from '@/lib/home-session-ask'
import type { MercState } from '@/lib/merc/constants'
import { CAN_TAKE_PAYMENT } from '@/lib/native-build'
import { loadFeaturedPromo, offeredPromo } from '@/stores/promo-store'
import { practiceScope, setPracticeScope, uiMode, } from '@/stores/settings-store'
import type { Plan, PlanStop, VoiceprintStop } from './build-plan'
import { buildPlan, planStops } from './build-plan'
import { widenMenuFor } from './enter-stop'
import type { CreditsInput, CreditsLine } from './plan-credits'
import { planCreditsLine } from './plan-credits'
import { planDeclinedEvents, planDoneEvents } from './plan-events'
import type { PlanTexts, PlanVia } from './plan-record'
import { readPlanTexts } from './plan-record'
import { declinePlan, markPlanShown, markStopOpened, planRecord, savePlanAnswers, } from './plan-store'
import type { PlanChoices, QuestionId } from './questions'
import { EMPTY_CHOICES } from './questions'
import { syncPlanForAccount } from './sync-for-account'

/**
 * How a run was opened. `new` is the questions inside First Light's walk;
 * `existing` is the one takeover somebody who knew the app before the plan
 * gets; `skipper` opens the questions from Home or the Guide; `review` opens
 * an answered plan on the plan.
 */
export type PlanFlowMode = 'new' | 'existing' | 'skipper' | 'review'

/** Where the run hands over to its host. */
export type PlanExit =
  | { to: 'home' }
  | { to: 'rooms' }
  | { to: 'stop'; stop: PlanStop; tour: boolean }

export type PlanPhase = 'questions' | 'plan'

export interface PlanFlowOptions {
  mode: PlanFlowMode
  /**
   * What the voiceprint found, read when the answers are in. Leave it out
   * where nothing was measured in this run: a plan then falls back on what
   * the record kept.
   */
  voiceprint?: () => VoiceprintStop | null
  /** The launch gift for the credits line; the server's featured promo when not given. */
  gift?: () => { credits: number } | null
  /** Where the run is sent when it ends. */
  onExit: (e: PlanExit) => void
}

export interface PlanFlowController {
  phase: Accessor<PlanPhase>
  /** The answers the screens open on: the record's when it is answered, else none. */
  choices: Accessor<PlanChoices>
  /** The lines typed under "Something else" and "Another app". */
  texts: Accessor<PlanTexts>
  /** The plan, once there are answers to build it from. */
  plan: Accessor<Plan | null>
  /** The line for the Karaoke Night card; null when there is none to show. */
  credits: Accessor<CreditsLine | null>
  /** Is the menu switch on? */
  scopeOn: Accessor<boolean>
  /** The pose of the host's one Merc, as the screens last asked for it. */
  mercState: Accessor<MercState>
  setMercState: (s: MercState) => void
  /** Where each answer from the last question sat on screen, for the chips to fly from. */
  pills: Accessor<ReadonlyMap<string, DOMRect>>
  /** The last question is done: save, build the plan, show it. */
  done: (
    c: PlanChoices,
    t: PlanTexts,
    pills: ReadonlyMap<string, DOMRect>,
  ) => void
  /** Not now on a question, with the answers so far. */
  decline: (on: QuestionId, c: PlanChoices) => void
  /** Back from the plan to the questions, on the answers given. */
  changeAnswers: () => void
  setScope: (on: boolean) => void
  openStop: (stop: PlanStop) => void
  showMeAround: () => void
  seeEveryRoom: () => void
  notNow: () => void
}

/** How the plan was first shown, and what that is called in the funnel. */
const SHOWN: Record<
  Exclude<PlanFlowMode, 'review'>,
  { via: PlanVia; event: GuideFunnelEvent }
> = {
  new: { via: 'first-light', event: 'plan_shown_new' },
  existing: { via: 'layer', event: 'plan_shown_existing' },
  skipper: { via: 'layer', event: 'plan_shown_skipper' },
}

/** A plan opened without the questions before it: nothing to fly from. */
const NO_PILLS: ReadonlyMap<string, DOMRect> = new Map()

// ── What a signed-in singer's credits line needs ───────────────────────

interface AccountFacts {
  balance: number | null
  cheapestPack: CreditsInput['cheapestPack']
}

/** The cheapest pack on sale: one that can be bought, with a price. */
async function cheapestPack(): Promise<AccountFacts['cheapestPack']> {
  try {
    const pricing = await fetchPricing()
    let cheapest: AccountFacts['cheapestPack'] = null
    for (const pack of pricing?.packs ?? []) {
      if (!pack.purchasable || pack.amount === null || pack.amount <= 0)
        continue
      if (cheapest === null || pack.amount < cheapest.amount) {
        cheapest = { amount: pack.amount, currency: pack.currency }
      }
    }
    return cheapest
  } catch {
    // fetchPricing throws on a bad answer, and a plan shows without a price.
    return null
  }
}

/**
 * The balance, and, for a balance of none, the pack to start from (a balance
 * the line states needs no price). Never rejects: what cannot be read is
 * null, and the line says nothing for it.
 */
async function loadAccountFacts(): Promise<AccountFacts> {
  try {
    const me = await fetchBillingMe()
    const balance = me === null ? null : me.creditBalance
    return {
      balance,
      cheapestPack: balance === 0 ? await cheapestPack() : null,
    }
  } catch {
    return { balance: null, cheapestPack: null }
  }
}

// ── The controller ─────────────────────────────────────────────────────

export function usePlanFlowController(o: PlanFlowOptions): PlanFlowController {
  const record = untrack(planRecord)
  const answered = record?.status === 'answered' ? record : null

  const [choices, setChoices] = createSignal<PlanChoices>(
    answered?.choices ?? EMPTY_CHOICES,
  )
  const [texts, setTexts] = createSignal<PlanTexts>(untrack(readPlanTexts))
  const [pills, setPills] = createSignal<ReadonlyMap<string, DOMRect>>(NO_PILLS)
  const [plan, setPlan] = createSignal<Plan | null>(null)
  const [phase, setPhase] = createSignal<PlanPhase>('questions')
  const [scopeOn, setScopeOn] = createSignal(false)
  const [mercState, setMercState] = createSignal<MercState>('idle')

  /** The menu's scope before the switch went on; null while it is off. */
  let before: ReturnType<typeof practiceScope> | null = null
  /** Have the answers been told? Once per run, never in a review. */
  let reported = o.mode === 'review'
  let accepted = false

  const send = (events: readonly GuideFunnelEvent[]): void => {
    for (const event of events) trackGuide(event)
  }
  const exit = (e: PlanExit): void => o.onExit(e)

  // ── Building the plan ──

  /** What the voiceprint found: the host's live finding, else the record's. */
  const found = (): VoiceprintStop | null => {
    const live = untrack(() => o.voiceprint?.() ?? null)
    if (live !== null) return live
    const kept = untrack(planRecord)?.voiceprint
    return kept === undefined ? null : { room: kept.room, detail: kept.detail }
  }

  const planFor = (c: PlanChoices): Plan =>
    buildPlan(c, {
      voiceprint: found(),
      // The menu as it stands, or as it stood before the switch narrowed it.
      view: {
        scope: before ?? untrack(practiceScope),
        mode: untrack(uiMode),
      },
    })

  // ── The credits line ──

  // A host that brings its own gift owns the rule for it, and loads whatever
  // that rule reads; without one the server's featured promo is the gift, and
  // this asks for it.
  const gift = o.gift ?? offeredPromo
  const [account, setAccount] = createSignal<AccountFacts | null>(null)
  const hasKaraokeNight = createMemo(() => {
    const p = plan()
    return p !== null && planStops(p).some((s) => s.dest === 'karaokeNight')
  })

  createEffect(() => {
    if (!CAN_TAKE_PAYMENT || !hasKaraokeNight()) return
    if (!accountHeld()) {
      if (o.gift === undefined) void untrack(loadFeaturedPromo)
      return
    }
    let current = true
    onCleanup(() => {
      current = false
    })
    void untrack(loadAccountFacts).then((facts) => {
      if (current) setAccount(facts)
    })
  })

  const credits = createMemo((): CreditsLine | null => {
    if (!hasKaraokeNight()) return null
    const facts = account()
    return planCreditsLine({
      canTakePayment: CAN_TAKE_PAYMENT,
      signedIn: accountHeld(),
      gift: gift(),
      balance: facts?.balance ?? null,
      cheapestPack: facts?.cheapestPack ?? null,
    })
  })

  // ── How the run begins ──

  if (o.mode === 'review') {
    if (answered !== null) {
      setPlan(planFor(answered.choices))
      setPhase('plan')
    }
  } else {
    const shown = SHOWN[o.mode]
    markPlanShown(shown.via)
    // A new visitor and an existing user are each counted once, when the
    // shown record is first written. First Light mounts this again behind the
    // auth modal and after a Google resume, and the takeover is mounted again
    // by the same, or by a reload in the middle of it; the record is already
    // there each time. A skipper is counted at every opening: each one is a
    // tap, and the skip at the welcome leaves a record, so a skipper's first
    // opening of the questions finds one too.
    const wrote = record === null && untrack(planRecord) !== null
    if (o.mode === 'skipper' || wrote) send([shown.event])
  }

  // ── The screens' callbacks ──

  const done: PlanFlowController['done'] = (c, t, from) => {
    savePlanAnswers(c, t, found())
    // A singer who already holds an account has no sign-in coming that would
    // send these answers, so they go now, through the one gate
    // (sync-for-account.ts, R85). It loads and sends nothing for anyone else,
    // and never rejects, so nothing waits on it.
    void syncPlanForAccount()
    batch(() => {
      setChoices(c)
      setTexts(t)
      setPills(from)
      setPlan(planFor(c))
      setPhase('plan')
    })
    if (reported) return
    reported = true
    send(planDoneEvents(c))
  }

  const decline: PlanFlowController['decline'] = (on, c) => {
    if (o.mode === 'review') {
      // Not now on a changed answer: back to the plan as it was.
      if (plan() === null) exit({ to: 'home' })
      else setPhase('plan')
      return
    }
    declinePlan(c)
    send(reported ? [`plan_declined_${on}`] : planDeclinedEvents(c, on))
    exit({ to: 'home' })
  }

  const changeAnswers = (): void => {
    setPhase('questions')
  }

  const setScope = (on: boolean): void => {
    if (on === untrack(scopeOn)) return
    if (!on) {
      setPracticeScope(before ?? 'all')
      before = null
      setScopeOn(false)
      return
    }
    const offer = untrack(plan)?.scope
    if (offer === null || offer === undefined) return
    before = untrack(practiceScope)
    setPracticeScope(offer.scope)
    setScopeOn(true)
    if (accepted) return
    accepted = true
    send(['scope_offer_accept'])
  }

  /**
   * Starts a stop: counted, marked opened, and handed to the host, with the
   * menu whole first if it lacks the stop. Today's session is Home's to
   * build, and the host only switches to Home, so Home is asked for it too
   * (src/lib/home-session-ask.ts). Not with the tour: the tour leads the room.
   */
  const enter = (stop: PlanStop, tour: boolean): void => {
    send([`plan_stop_${stop.kind}`])
    markStopOpened(stop.dest)
    widenMenuFor(stop)
    if (stop.dest === 'homeSession' && !tour) askHomeForTodaysSession()
    exit({ to: 'stop', stop, tour })
  }

  const openStop = (stop: PlanStop): void => {
    enter(stop, false)
  }

  // Interim, until the tour is built (Plan 1B): the Start here stop, with
  // the tour where its room has one. It starts the stop as its card does.
  const showMeAround = (): void => {
    const current = untrack(plan)
    if (current !== null) enter(current.start, true)
  }

  const seeEveryRoom = (): void => {
    send(['plan_rooms'])
    exit({ to: 'rooms' })
  }

  const notNow = (): void => {
    send(['plan_skipped_plan'])
    exit({ to: 'home' })
  }

  return {
    phase,
    choices,
    texts,
    plan,
    credits,
    scopeOn,
    mercState,
    setMercState,
    pills,
    done,
    decline,
    changeAnswers,
    setScope,
    openStop,
    showMeAround,
    seeEveryRoom,
    notNow,
  }
}
