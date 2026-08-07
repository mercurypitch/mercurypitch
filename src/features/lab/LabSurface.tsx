// ============================================================
// Lab — hidden audio-research surface
//
// Not in TAB_GROUPS, so it never appears in the tab bar. Reached by hash
// route (#lab, #pitch-test, #pitch-algo) after a server-held supporter grant
// in every environment. Everything here used to sit on the user-facing
// Analysis page. Server-backed Lab capabilities must enforce the same grant.
// ============================================================

import type { Component } from 'solid-js'
import { createEffect, createSignal, For, lazy, on, Show, Suspense, } from 'solid-js'
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

const TABS: Array<{ id: LabTab; label: string }> = [
  { id: 'workbench', label: 'Spectral workbench' },
  { id: 'detection', label: 'Pitch detection' },
  { id: 'algorithms', label: 'Pitch algorithms' },
  { id: 'lrc-diff', label: 'Mapping differ' },
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
        <h1 class={styles.title}>Lab</h1>
        <p class={styles.subtitle}>
          Spectral tooling and detector benchmarks. Not part of the Analysis
          page — results here are for development, not practice feedback.
        </p>
      </header>

      <div class={styles.tabs} role="tablist" aria-label="Lab tools">
        <For each={TABS}>
          {(entry) => (
            <button
              type="button"
              role="tab"
              aria-selected={tab() === entry.id}
              class={styles.tab}
              classList={{ [styles.tabActive]: tab() === entry.id }}
              onClick={() => setTab(entry.id)}
            >
              {entry.label}
            </button>
          )}
        </For>
      </div>

      <div class={styles.panel}>
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
