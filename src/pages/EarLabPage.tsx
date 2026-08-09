// ============================================================
// EarLabPage — the Ear Lab tab: dashboard plus the selected
// drill. The 'calibration' view is the Hairline runner opened
// straight into its 3-track calibration mode (the dashboard's
// Calibrate CTA skips the drill's idle screen).
// ============================================================

import type { JSX } from 'solid-js'
import { createEffect, createSignal, Show } from 'solid-js'
import { ContourDrill } from '@/features/ear-lab/ContourDrill'
import type { EarLabView } from '@/features/ear-lab/EarLabDashboard'
import { EarLabDashboard } from '@/features/ear-lab/EarLabDashboard'
import { EarReport } from '@/features/ear-lab/EarReport'
import { GridDrill } from '@/features/ear-lab/GridDrill'
import { HairlineDrill } from '@/features/ear-lab/HairlineDrill'
import { HomeDrill } from '@/features/ear-lab/HomeDrill'
import { LeapDrill } from '@/features/ear-lab/LeapDrill'
import { StackDrill } from '@/features/ear-lab/StackDrill'
import { pendingEarDrill, setPendingEarDrill } from '@/stores/ui-store'

/** Drill ids do not all match their view names ('the-grid' → 'grid'). */
const VIEW_FOR_DRILL: Record<string, EarLabView> = {
  hairline: 'hairline',
  home: 'home',
  'the-grid': 'grid',
  leap: 'leap',
  stack: 'stack',
  contour: 'contour',
}

export function EarLabPage(): JSX.Element {
  const [view, setView] = createSignal<EarLabView>('dashboard')
  const back = () => setView('dashboard')

  // A drill asked for from elsewhere (The Ascent's ear week). Cleared
  // as it is consumed, so coming back to the tab later lands on the
  // dashboard rather than replaying the same request.
  createEffect(() => {
    const requested = pendingEarDrill()
    if (requested === null) return
    const target = VIEW_FOR_DRILL[requested]
    if (target) setView(target)
    setPendingEarDrill(null)
  })

  return (
    <div id="ear-lab-page">
      <Show when={view() === 'dashboard'}>
        <EarLabDashboard onNavigate={setView} />
      </Show>
      <Show when={view() === 'hairline'}>
        <HairlineDrill onBack={back} />
      </Show>
      <Show when={view() === 'calibration'}>
        <HairlineDrill onBack={back} autoStartMode="calibration" />
      </Show>
      <Show when={view() === 'home'}>
        <HomeDrill onBack={back} />
      </Show>
      <Show when={view() === 'grid'}>
        <GridDrill onBack={back} />
      </Show>
      <Show when={view() === 'leap'}>
        <LeapDrill onBack={back} />
      </Show>
      <Show when={view() === 'stack'}>
        <StackDrill onBack={back} />
      </Show>
      <Show when={view() === 'contour'}>
        <ContourDrill onBack={back} />
      </Show>
      <Show when={view() === 'report'}>
        <EarReport onBack={back} />
      </Show>
    </div>
  )
}
