// ============================================================
// Lab — hidden audio-research surface
//
// Not in TAB_GROUPS, so it never appears in the tab bar. Reached by hash
// route (#lab, #pitch-test, #pitch-algo) after a server-held supporter grant
// in every environment. Everything here used to sit on the user-facing
// Analysis page. Server-backed Lab capabilities must enforce the same grant.
//
// VISUAL LANGUAGE — the Lab is an instrument panel. Its private palette
// (`--lab-void`/`panel`/`raised`/`line`/`ink`/`muted`, plus the `--lab-signal`
// and `--lab-measured` accent pair) is declared once on `.page` in
// Lab.module.css and inherits into every tab's own stylesheet, including
// PitchTestingTab's and PitchAlgorithmTester's. Two rules keep it coherent:
// every name is derived from a global token, because a hardcoded hex breaks 7
// of the 8 themes; and `signal` dresses controls the Lab owns while
// `measured` dresses numbers that came out of a capture.
// ============================================================

import type { Component, JSX } from 'solid-js'
import { createEffect, createSignal, For, lazy, on, Show, Suspense, } from 'solid-js'
import { Cpu, Flask, Mic, Split, WaveformBars } from '@/components/icons'
import { SkeletonTabContent } from '@/components/Skeleton'
import { TAB_ANALYSIS } from '@/features/tabs/constants'
import { setActiveTab } from '@/stores'
import styles from './Lab.module.css'
import { SpectralWorkbench } from './SpectralWorkbench'

const PitchTestingTab = lazy(async () =>
  import('@/components/PitchTestingTab').then((m) => ({
    default: m.PitchTestingTab,
  })),
)
const PitchAlgorithmTester = lazy(async () =>
  import('@/components/PitchAlgorithmTester').then((m) => ({
    default: m.PitchAlgorithmTester,
  })),
)
const LrcDiffTool = lazy(async () =>
  import('./LrcDiffTool').then((m) => ({ default: m.LrcDiffTool })),
)

export type LabTab = 'workbench' | 'detection' | 'algorithms' | 'lrc-diff'

const TABS: Array<{ id: LabTab; label: string; icon: () => JSX.Element }> = [
  {
    id: 'workbench',
    label: 'Spectral workbench',
    icon: () => <WaveformBars />,
  },
  { id: 'detection', label: 'Pitch detection', icon: () => <Mic /> },
  { id: 'algorithms', label: 'Pitch algorithms', icon: () => <Cpu /> },
  { id: 'lrc-diff', label: 'Mapping differ', icon: () => <Split /> },
]

export const LabSurface: Component<{ initialTab?: LabTab }> = (props) => {
  const [tab, setTab] = createSignal<LabTab>(props.initialTab ?? 'workbench')
  const backToAnalysis = () => setActiveTab(TAB_ANALYSIS)

  // #/lab, #/pitch-test and #/pitch-algo all resolve to this component, so a
  // route change while it stays mounted has to move the tab. Without this the
  // signal keeps whichever tool the Lab was first opened on.
  createEffect(
    on(
      () => props.initialTab,
      (next) => {
        if (next !== undefined) setTab(next)
      },
      { defer: true },
    ),
  )

  return (
    <div class={styles.page}>
      <header class={styles.header}>
        <span class={styles.mark} aria-hidden="true">
          <Flask />
        </span>
        <div class={styles.identity}>
          <p class={styles.eyebrow}>Research surface</p>
          <h1 class={styles.title}>Lab</h1>
          <p class={styles.subtitle}>
            Spectral tooling and detector benchmarks. Not part of the Analysis
            page — results here are for development, not practice feedback.
          </p>
        </div>
        <div class={styles.headerMeta}>
          <span>{TABS.length} tools</span>
          <span>Local only</span>
        </div>
      </header>

      <div class={styles.tabs} role="tablist" aria-label="Lab tools">
        <For each={TABS}>
          {(entry) => (
            <button
              type="button"
              role="tab"
              id={`lab-tab-${entry.id}`}
              aria-controls="lab-panel"
              aria-selected={tab() === entry.id}
              class={styles.tab}
              classList={{ [styles.tabActive]: tab() === entry.id }}
              onClick={() => setTab(entry.id)}
            >
              <span aria-hidden="true">{entry.icon()}</span>
              {entry.label}
            </button>
          )}
        </For>
      </div>

      <div
        class={styles.panel}
        id="lab-panel"
        role="tabpanel"
        aria-labelledby={`lab-tab-${tab()}`}
      >
        <Show when={tab() === 'workbench'}>
          <SpectralWorkbench />
        </Show>
        <Show when={tab() === 'detection'}>
          <Suspense fallback={<SkeletonTabContent />}>
            <PitchTestingTab onClose={backToAnalysis} />
          </Suspense>
        </Show>
        <Show when={tab() === 'algorithms'}>
          <Suspense fallback={<SkeletonTabContent />}>
            <PitchAlgorithmTester onClose={backToAnalysis} />
          </Suspense>
        </Show>
        <Show when={tab() === 'lrc-diff'}>
          <Suspense fallback={<SkeletonTabContent />}>
            <LrcDiffTool />
          </Suspense>
        </Show>
      </div>
    </div>
  )
}
