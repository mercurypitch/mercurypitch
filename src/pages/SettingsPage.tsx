// ============================================================
// SettingsPage — the Settings tab, and how it reaches the plan's section
// ============================================================
//
// A thin wrapper around SettingsPanel, and the host that hands it "Your plan"
// (src/features/plan/PlanSettings), the one section of Settings that is a
// feature's. SettingsPanel is a component and may not import a feature, so it
// draws whatever section it is given, where it belongs, after App Mode; App
// hands GuideSelection its plan row the same way.
//
// App draws this page on the web only, but imports it statically, so a static
// import of the plan here would put the plan's store, with the persisted
// signals it makes as it loads, in the native bundle, where there is no plan.
// So the constant picks a function that renders nothing before `lazy()` is
// ever written, as HomePlanCardMount.tsx does for Home's card: the native
// build has neither the call nor the chunk, and the plan's words and store
// stay out of Settings' first paint too (settings-plan-mount.test.ts reads
// this file for each). The import is of load-plan-settings.ts, which says
// why the extra step. The section draws inside a Suspense, so Settings does
// not wait for it, and inside an ErrorBoundary: a dead chunk (offline, or a
// deploy swapped the hashed assets) costs Settings the section and not the
// page.

import type { Component, JSX } from 'solid-js'
import { ErrorBoundary, lazy, Suspense } from 'solid-js'
import { SettingsPanel } from '@/components/SettingsPanel'
import { IS_NATIVE_BUILD } from '@/lib/native-build'

const PlanSettings: Component = IS_NATIVE_BUILD
  ? () => null
  : lazy(async () =>
      import('@/features/plan/load-plan-settings')
        .then(async (m) => m.loadPlanSettings())
        .then((section) => ({ default: section })),
    )

/** "Your plan", as the panel draws it: nothing until its chunk is in, and nothing if it never comes. */
function PlanSection(): JSX.Element {
  return (
    <ErrorBoundary
      fallback={(error: unknown) => {
        console.warn('[settings] The plan was left out of Settings:', error)
        return null
      }}
    >
      <Suspense fallback={null}>
        <PlanSettings />
      </Suspense>
    </ErrorBoundary>
  )
}

/** Settings tab (TAB_SETTINGS). */
export function SettingsPage(): JSX.Element {
  return (
    <div id="settings-panel">
      <SettingsPanel plan={IS_NATIVE_BUILD ? undefined : PlanSection} />
    </div>
  )
}
