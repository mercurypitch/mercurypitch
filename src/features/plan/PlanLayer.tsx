// ============================================================
// PlanLayer: the four questions and the plan, as a layer of the app
// ============================================================
//
// The second host of the plan (First Light's BeatPlan is the first): a
// full-screen layer over the app, opened from Guide's first row, from
// `#/plan`, from Home's card and by the one takeover an existing user gets.
// It hosts one run of usePlanFlowController in the mode it is opened in, with
// Merc above the screens, which are the same two the beat hosts. App decides
// when it is open and hands the mode in; the layer closes itself only by
// telling App, through `onClose`.
//
// Four things are easy to break:
//
// - The box. The screens are laid out for a positioned, height-bounded flex
//   column that does not scroll and is not transformed: their Back and Not
//   now sit in its corners, and their roots scroll their own content
//   (PlanExits.tsx holds the contract). The layer is a fixed box of its own,
//   padded like First Light's frame, and the host box stands inside it with
//   `flex: 1 1 0; min-height: 0` and Merc `flex: none` directly above the
//   screens. The layer lends the screens its side and bottom padding, where
//   it clips nothing, through `--pc-overhang-side` and `--pc-overhang-end`,
//   so a picked card's glow and Next's shadow fade out at the window's edge
//   (PlanLayer.module.css). The box carries `data-beat="questions"` and
//   `data-phase`, as the beat's does, which the browser checks read.
// - The order of an exit. The layer closes first, and only then is the app
//   sent on: Home through the tab, the Map through its address, a stop
//   through enterStop, and "Show me around" to Merc's showcase
//   (runPlanShowcase), which opens Start here at its end. The Map is the
//   reason. The router holds the address
//   still while the layer is open and syncs it to the tab's own when the
//   layer closes; an address set before the close would be rewritten by that
//   sync, before the router read it, and the Map would never open. Closed
//   first, the sync has rewritten `#/plan` already and the new address
//   stands.
// - The mode is the run's. It says which greeting Merc opens with (an
//   existing user, to whom the plan is new, gets the line for them; a skipper,
//   who opens the four taps from Home or the Guide, and a review of answers
//   already given get the plain one, which is true for both) and what the
//   funnel is told as the run starts, which is the controller's to say and
//   not this file's. A review opens on the plan and is the one run that
//   offers "Change my answers", which opens the questions on the answers
//   given. `change` (Home's card, Settings) is that review opened on its
//   questions: the run is a review's, and the layer takes it to the questions
//   as the plan's own Change my answers does, so it tells the funnel nothing,
//   Not now goes back to the plan as it was, and Done saves the new answers
//   and shows the new plan. No voiceprint is passed (nothing was measured in
//   this run, and the controller falls back on the record's) and no gift
//   (without one the controller asks the server's featured promo itself).
// - Focus and keys. The layer says it is modal, so it holds focus: it opens on
//   the screen's heading, which a screen reader reads as where the person
//   landed, and Tab cycles inside. Keys stay inside it too (isolateKeyboard),
//   because the app's shortcuts listen on `window` and the layer opens over
//   live tabs: a Space would play or pause the singing behind it and swallow
//   the press that should activate a button, M would toggle the microphone,
//   and Escape would stop playback and close the sidebar. That holds only for
//   keys sent from inside, so the layer takes focus itself (tabindex -1, no
//   ring) when a press lands on its words: a press on content that cannot
//   take focus would drop it to the page, and Space and M would reach the
//   shortcuts again. A stopped keydown never reaches the document, where
//   Solid listens for delegated handlers, so nothing inside may use one: the
//   screens' only key handler (Enter puts the keyboard away, in
//   PlanQuestions) is bound natively for this, and a new one must be as well.
//   Escape is not wired: leaving is Not now, which says what it does (a
//   question's Not now turns the plan down, the plan's keeps the answers),
//   and a key that left without saying would be a third way out the funnel
//   could not tell.
//
// Merc's size and stills are plan-merc.ts's, shared with First Light's beat;
// the layer only hands them to MercPresence.

import type { JSX } from 'solid-js'
import { Match, Show, Switch, untrack } from 'solid-js'
import { MercPresence } from '@/components/room-kit/MercPresence'
import { TAB_HOME } from '@/features/tabs/constants'
import { navigateTo } from '@/lib/hash-router'
import { isolateKeys } from '@/lib/keyboard-isolation'
import { useFocusTrap } from '@/lib/use-focus-trap'
import { setActiveTab } from '@/stores/ui-store'
import { enterStop } from './enter-stop'
import { createMercSize, stillFor } from './plan-merc'
import { runPlanShowcase } from './plan-showcase'
import type { PlanLayerMode } from './plan-store'
import styles from './PlanLayer.module.css'
import { PlanQuestions } from './PlanQuestions'
import { PlanScreen } from './PlanScreen'
import type { PlanExit } from './usePlanFlowController'
import { usePlanFlowController } from './usePlanFlowController'

export interface PlanLayerProps {
  /** How the layer was opened, one to one with the run's mode. Read once: it is the run's. */
  mode: PlanLayerMode
  /** The run is over: App stops drawing the layer. Called before the app is sent on. */
  onClose: () => void
}

export function PlanLayer(props: PlanLayerProps): JSX.Element {
  const mode = untrack(() => props.mode)
  // A review, opened on the plan or on its questions.
  const review = mode === 'review' || mode === 'change'

  let layer: HTMLDivElement | undefined
  useFocusTrap(() => layer, {
    isOpen: () => true,
    isolateKeyboard: isolateKeys,
    initialFocus: () => layer?.querySelector<HTMLElement>('h1') ?? undefined,
  })

  const hand = (exit: PlanExit): void => {
    // The showcase holds the app's offers before the close lets them go; it
    // draws once the layer is gone (its code loads a microtask later at the
    // soonest).
    if (exit.to === 'showcase') runPlanShowcase(exit.plan, exit.begin)
    props.onClose()
    if (exit.to === 'home') setActiveTab(TAB_HOME)
    else if (exit.to === 'rooms') navigateTo({ type: 'onboarding-map' })
    else if (exit.to === 'stop') enterStop(exit.stop)
  }

  const c = usePlanFlowController({
    mode: mode === 'change' ? 'review' : mode,
    onExit: hand,
  })
  // Opened to change the answers: on the questions, as the plan's own Change
  // my answers opens them, before anything is drawn.
  if (mode === 'change') c.changeAnswers()

  // His size follows the phase, and a turn of the phone; it stops listening
  // when the layer goes.
  const mercSize = createMercSize(c.phase)

  return (
    <div
      ref={layer}
      class={styles.layer}
      role="dialog"
      aria-modal="true"
      aria-label="Your plan"
      // Takes focus from a press, never from Tab. A press on the layer's
      // words (not a control) would otherwise drop focus to the page, and a
      // key sent from there is not stopped by isolateKeyboard, which holds
      // only for keys sent from inside. No ring: `.layer:focus`.
      tabIndex={-1}
      // A stable hook for the E2E overlay helper: the class is a CSS module,
      // so its name is a build hash that nothing outside this file can match.
      data-plan-layer
    >
      <div class={styles.box} data-beat="questions" data-phase={c.phase()}>
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
              returning={mode === 'existing'}
              initial={c.choices()}
              initialTexts={c.texts()}
              onMercState={c.setMercState}
              onDone={c.done}
              onDecline={c.decline}
              onAnswering={c.answering}
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
                  onChangeAnswers={review ? c.changeAnswers : undefined}
                  onNotNow={c.notNow}
                />
              )}
            </Show>
          </Match>
        </Switch>
      </div>
    </div>
  )
}
