// ============================================================
// EarLabPage — the Ear Lab tab: the Regulator Room around the bench
// and every drill stage. The room (session bar, rack, bridge) lives
// here so opening a drill never leaves it: the bench's bridge steps
// aside for the drill's console and comes back with the bench. The
// 'calibration' view is the Hairline stage opened in its sealed
// protocol (the bench's amber control). The Ear Report is a stage
// of its own inside the same room.
// ============================================================

import type { JSX } from 'solid-js'
import { createEffect, createSignal, Show } from 'solid-js'
import { BeatHuntDrill } from '@/features/ear-lab/BeatHuntDrill'
import { ContourDrill } from '@/features/ear-lab/ContourDrill'
import { DriftDrill } from '@/features/ear-lab/DriftDrill'
import { VIEW_FOR_DRILL } from '@/features/ear-lab/drill-views'
import type { EarLabView } from '@/features/ear-lab/EarLabDashboard'
import { EarLabDashboard } from '@/features/ear-lab/EarLabDashboard'
import { EarReport } from '@/features/ear-lab/EarReport'
import { EarRoomShell } from '@/features/ear-lab/EarRoomShell'
import { EchoDrill } from '@/features/ear-lab/EchoDrill'
import { GridDrill } from '@/features/ear-lab/GridDrill'
import { HairlineDrill } from '@/features/ear-lab/HairlineDrill'
import { HomeDrill } from '@/features/ear-lab/HomeDrill'
import { LeapDrill } from '@/features/ear-lab/LeapDrill'
import { PulseDrill } from '@/features/ear-lab/PulseDrill'
import { SpanDrill } from '@/features/ear-lab/SpanDrill'
import { StackDrill } from '@/features/ear-lab/StackDrill'
import { pendingEarDrill, setPendingEarDrill } from '@/stores/ui-store'

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
      <EarRoomShell onNavigate={setView} bridge={view() === 'dashboard'}>
        <Show when={view() === 'dashboard'}>
          <EarLabDashboard onNavigate={setView} />
        </Show>
        <Show when={view() === 'hairline'}>
          <HairlineDrill onBack={back} />
        </Show>
        <Show when={view() === 'calibration'}>
          <HairlineDrill onBack={back} ritual />
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
        <Show when={view() === 'pulse'}>
          <PulseDrill onBack={back} />
        </Show>
        <Show when={view() === 'echo'}>
          <EchoDrill onBack={back} />
        </Show>
        <Show when={view() === 'span'}>
          <SpanDrill onBack={back} />
        </Show>
        <Show when={view() === 'beat-hunt'}>
          <BeatHuntDrill onBack={back} />
        </Show>
        <Show when={view() === 'drift'}>
          <DriftDrill onBack={back} />
        </Show>
        <Show when={view() === 'report'}>
          <EarReport onBack={back} />
        </Show>
      </EarRoomShell>
    </div>
  )
}
