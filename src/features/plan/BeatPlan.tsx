// ============================================================
// BeatPlan — the four questions and the plan, as a beat of First Light
// ============================================================
//
// The beat that comes after the account ask and before the Map. It hosts one
// run of the plan (usePlanFlowController, in its `new` mode): Merc above, and
// under him the question screens, then the plan. It owns the one Merc, which
// stays through the questions and the plan, wearing the pose the screens ask
// for; the screens mount none. The flow's own words about where to go next
// are its three props: Home (out of First Light, into the app), the Map's
// grid, and a stop of the plan.
//
// Three things are easy to break:
//
// - The box. The screens are laid out for a positioned, height-bounded flex
//   column that does not scroll and is not transformed: their Back and Not
//   now sit in its corners, their roots scroll their own content, and the
//   question root pulls itself 14px up over Merc (PlanExits.tsx holds the
//   contract). So the host is the beat's own box, a direct child of First
//   Light's frame, and NOT a `.beat` (the frame scrolls, and `.beat` runs a
//   transform entrance): `flex: 1 1 0; min-height: 0` makes its height
//   definite from the overlay's, and Merc sits `flex: none` directly above
//   the screens inside it. On a phone the frame gives its bottom padding up
//   to the screens (onboarding.module.css, next to the twin's), so the box
//   reaches the frame's bottom edge and adds no padding or inset of its own.
//   The host carries `data-beat="questions"`, which that rule and First
//   Light's heading focus read. The frame also lends the screens its padding
//   beside and below the box, where it clips nothing (`--pc-overhang-side`
//   22px, `--pc-overhang-end` 40px and 0px on a phone, set next to that rule;
//   PlanExits.tsx holds the contract), so a picked card's glow and Next's
//   shadow fade out at the screen's edge instead of stopping at a line 6px
//   from them. The box itself sets none.
// - Merc's size is the host's to hand over, in pixels, because MercPresence
//   sets his box inline and a class could not win. The questions and the plan
//   have their own sizes, each smaller on a phone, so the first question
//   still fits above the fold. The sizes and the phone match are in
//   plan-merc.ts, shared with the app's layer.
// - The gift on the credits line is handed in, and is the one the Map offers
//   (First Light's mapGift: a refused microphone hears no offer). There is one
//   rule for the gift, and asking the server for it is First Light's too.
//
// Merc's still follows his pose where he cannot be drawn live, so a phone
// without a GPU shows the listening Merc on Q3 and the cheering one on the
// plan, as the live one would (plan-merc.ts holds which still goes with which
// pose).

import type { JSX } from 'solid-js'
import { Match, Show, Switch } from 'solid-js'
import { MercPresence } from '@/components/room-kit/MercPresence'
import styles from './BeatPlan.module.css'
import type { PlanStop, VoiceprintStop } from './build-plan'
import { createMercSize, stillFor } from './plan-merc'
import { PlanQuestions } from './PlanQuestions'
import { PlanScreen } from './PlanScreen'
import type { PlanExit, PlanFlowOptions } from './usePlanFlowController'
import { usePlanFlowController } from './usePlanFlowController'

/**
 * What First Light's "are you sure?" says before a question's Not now turns
 * the plan down (owner copy, 23 Oct 2026). Here rather than in First Light:
 * "Four quick questions" is one of the words that mark the plan in a bundle
 * (apps/mercurypitch/scripts/assert-bundle.mjs PLAN_WORDS), so it is said only
 * inside the plan.
 */
export const PLAN_SKIP_ASK = {
  title: 'Skip your plan?',
  body: 'Four quick questions, and Merc lays out where to start, what to learn and what to play.',
} as const

export interface BeatPlanProps {
  /** What the voiceprint found, as the Map names its first stop. */
  voiceprint: () => VoiceprintStop | null
  /** The launch gift on offer, for the credits line: the one rule the Map follows. */
  gift: NonNullable<PlanFlowOptions['gift']>
  /** Out of First Light and into the app: Not now, on a question or on the plan. */
  onHome: () => void
  /** See every room: the Map's grid. */
  onRooms: () => void
  /** A stop was opened; `tour` asks for its room's spotlight tour as well. */
  onEnterStop: (stop: PlanStop, tour: boolean) => void
  /** First Light asks before a question's Not now turns the plan down
   *  (PlanQuestions' `askBeforeDecline`); the plan's own Not now asks nothing.
   *  `stillTrue` holds while the questions show: the account's plan can take
   *  their place while it asks. */
  askBeforeDecline?: (decline: () => void, stillTrue: () => boolean) => void
}

export function BeatPlan(props: BeatPlanProps): JSX.Element {
  const hand = (exit: PlanExit): void => {
    if (exit.to === 'home') props.onHome()
    else if (exit.to === 'rooms') props.onRooms()
    else props.onEnterStop(exit.stop, exit.tour)
  }

  const c = usePlanFlowController({
    mode: 'new',
    voiceprint: () => props.voiceprint(),
    gift: () => props.gift(),
    onExit: hand,
  })

  // His size follows the phase, and a turn of the phone; it stops listening
  // when the beat goes.
  const mercSize = createMercSize(c.phase)

  return (
    <div class={styles.host} data-beat="questions" data-phase={c.phase()}>
      <MercPresence
        class={styles.merc}
        state={c.mercState}
        stillSrc={stillFor(c.mercState())}
        size={mercSize()}
        testId="plan-merc"
      />
      <Switch>
        <Match when={c.phase() === 'questions'}>
          <PlanQuestions
            returning={false}
            initial={c.choices()}
            initialTexts={c.texts()}
            onMercState={c.setMercState}
            onDone={c.done}
            onDecline={c.decline}
            onAnswering={c.answering}
            askBeforeDecline={
              props.askBeforeDecline === undefined
                ? undefined
                : (decline) =>
                    props.askBeforeDecline?.(
                      decline,
                      () => c.phase() === 'questions',
                    )
            }
          />
        </Match>
        <Match when={c.phase() === 'plan'}>
          <Show when={c.plan()}>
            {(plan) => (
              <PlanScreen
                plan={plan()}
                credits={c.credits()}
                scopeOn={c.scopeOn()}
                fromPills={c.pills()}
                onScopeChange={c.setScope}
                onMercState={c.setMercState}
                onShowMeAround={c.showMeAround}
                onOpenStop={c.openStop}
                onSeeEveryRoom={c.seeEveryRoom}
                onNotNow={c.notNow}
              />
            )}
          </Show>
        </Match>
      </Switch>
    </div>
  )
}
