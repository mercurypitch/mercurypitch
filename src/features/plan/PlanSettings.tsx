// ============================================================
// PlanSettings — "Your plan" in Settings: the plan, its answers, and Home's card back
// ============================================================
//
// Home's card is the plan's way back to a person for a week, and its X hides
// it. This is the way back that does not go: a section of Settings' General
// tab, after App Mode. With an answered plan it offers the plan (See my plan,
// the review the Guide's row opens) and its questions (Change my answers, as
// Home's card offers them); without one (none, shown, skipped or turned down)
// it offers the four taps, as the skipper's card does. While Home's card is
// hidden on this device and would otherwise show, Show on Home brings it back.
//
// Four things are easy to break:
//
// - Settings reaches this file only through a lazy import behind
//   IS_NATIVE_BUILD (src/pages/SettingsPage.tsx, held by
//   settings-plan-mount.test.ts): it brings the plan's store and words, and
//   the native bundle has no plan. SettingsPanel is a component and may not
//   import a feature, so its host hands the section to it (`plan`), as App
//   hands GuideSelection its plan row.
// - Show on Home shows only while the card is hidden and would otherwise
//   show. Hidden is the store's (planCardHidden), which the card and Merc's
//   hand-over read too, so the three never disagree; would show is the card's
//   own state (homePlanCardState) with no hide, for the menu as it stands:
//   inside the record's week, and, for a plan, a stop not done. It clears the
//   hide in the store, so a card that is drawn shows at once, and one that is
//   not shows the next time Home draws it.
// - Show on Home goes with the hide it clears, and the focus it had would fall
//   to the top of the page: it goes to the section's first way in instead, so
//   a keyboard user stays where they were.
// - Each way in tells the funnel what the same way in tells it elsewhere, and
//   nothing more: See my plan and Change my answers are reviews, which tell
//   nothing (usePlanFlowController.ts), and Answer the four questions is the
//   skipper's Start, which tells `plan_shown_skipper` as its run opens. Show on
//   Home tells nothing.
//
// Every word is plan-copy.ts's (PLAN_PLACES), for the copy pass. The section
// wears Settings' own classes, so it reads as one of Settings' sections, and
// adds only the press each button takes under a finger
// (PlanSettings.module.css).

import type { JSX } from 'solid-js'
import { createMemo, Show } from 'solid-js'
import panel from '@/components/SettingsPanel.module.css'
import { practiceScope, uiMode } from '@/stores/settings-store'
import { PLAN_PLACES } from './plan-copy'
import { homePlanCardState } from './plan-progress'
import { openPlanLayer, planCardHidden, planRecord, showPlanCard, } from './plan-store'
import styles from './PlanSettings.module.css'

/** A way in: Settings' own button, with the press a finger needs. */
function Way(props: { onPress: () => void; children: string }): JSX.Element {
  return (
    <button
      type="button"
      class={`${panel.settingsActionBtn} ${styles.way}`}
      onClick={() => props.onPress()}
    >
      {props.children}
    </button>
  )
}

/** "Your plan", in Settings' General tab. */
export function PlanSettings(): JSX.Element {
  let ways: HTMLDivElement | undefined

  const answered = (): boolean => planRecord()?.status === 'answered'

  // Would Home show its card, were it not hidden? The card's own state, with
  // no hide, for the menu as it stands.
  const dueOnHome = createMemo(
    () =>
      homePlanCardState({
        record: planRecord(),
        dismissed: false,
        now: Date.now(),
        view: { scope: practiceScope(), mode: uiMode() },
      }) !== null,
  )
  const offerHome = (): boolean => planCardHidden() && dueOnHome()

  const showOnHome = (): void => {
    showPlanCard()
    // The button went with the hide: keep the focus in the section.
    ways?.querySelector('button')?.focus()
  }

  return (
    <div class={panel.settingsSection} data-testid="settings-plan">
      <h3 class={panel.settingsSectionTitle}>{PLAN_PLACES.title}</h3>
      <div class={panel.settingsDivider} />
      <p class={panel.settingsDesc}>
        {answered() ? PLAN_PLACES.answeredLine : PLAN_PLACES.askLine}
      </p>
      <div ref={ways} class={panel.settingsActionRow}>
        <Show
          when={answered()}
          fallback={
            <Way onPress={() => openPlanLayer('skipper')}>
              {PLAN_PLACES.answer}
            </Way>
          }
        >
          <Way onPress={() => openPlanLayer('review')}>
            {PLAN_PLACES.seePlan}
          </Way>
          <Way onPress={() => openPlanLayer('change')}>
            {PLAN_PLACES.changeAnswers}
          </Way>
        </Show>
        <Show when={offerHome()}>
          <Way onPress={showOnHome}>{PLAN_PLACES.showOnHome}</Way>
        </Show>
      </div>
    </div>
  )
}
