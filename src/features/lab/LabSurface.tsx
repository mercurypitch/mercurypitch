// ============================================================
// Lab — hidden audio-research surface
//
// Not in TAB_GROUPS, so it never appears in the tab bar. Reached by hash
// routes (five tool-specific hashes, including #lab) after a server-held grant
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

import type { Component, JSX, ParentComponent } from 'solid-js'
import { createEffect, createSignal, ErrorBoundary, For, lazy, on, Show, Suspense, } from 'solid-js'
import { AlertTriangle, ChevronLeft, Cpu, FileText, Flask, Mic, Split, WaveformBars, } from '@/components/icons'
import { SkeletonTabContent } from '@/components/Skeleton'
import type { ActiveTab } from '@/features/tabs/constants'
import { TAB_ANALYSIS, TAB_LAB, TAB_LAB_DIFF, TAB_LAB_TRANSCRIBE, TAB_PITCH_ALGO, TAB_PITCH_TEST, } from '@/features/tabs/constants'
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
// Lazy for the usual reason and one extra: picking the SwiftF0 source pulls in
// the ONNX runtime, and nobody opening the spectral workbench should pay for it.
const TranscriptionBench = lazy(async () =>
  import('./TranscriptionBench').then((m) => ({
    default: m.TranscriptionBench,
  })),
)

export type LabTab =
  | 'workbench'
  | 'detection'
  | 'algorithms'
  | 'lrc-diff'
  | 'transcribe'

interface LabTool {
  id: LabTab
  label: string
  description: string
  icon: () => JSX.Element
  route: ActiveTab
}

const TABS: LabTool[] = [
  {
    id: 'workbench',
    label: 'Capture & inspect',
    description: 'Capture a signal, inspect its spectrum, and run transforms.',
    icon: () => <WaveformBars />,
    route: TAB_LAB,
  },
  {
    id: 'detection',
    label: 'Tune detector',
    description: 'Compare detector behavior against live or imported audio.',
    icon: () => <Mic />,
    route: TAB_PITCH_TEST,
  },
  {
    id: 'algorithms',
    label: 'Benchmark algorithms',
    description: 'Measure accuracy and latency across representative signals.',
    icon: () => <Cpu />,
    route: TAB_PITCH_ALGO,
  },
  {
    id: 'transcribe',
    label: 'Transcribe stem',
    description:
      'Turn an isolated stem into editable notes and score a reference.',
    icon: () => <FileText />,
    route: TAB_LAB_TRANSCRIBE,
  },
  {
    id: 'lrc-diff',
    label: 'Compare mappings',
    description:
      'Inspect timing and content differences between two lyric maps.',
    icon: () => <Split />,
    route: TAB_LAB_DIFF,
  },
]

const LabToolBoundary: ParentComponent<{
  label: string
  onBack: () => void
}> = (props) => (
  <ErrorBoundary
    fallback={(_error, reset) => (
      <div class={styles.toolError} role="alert">
        <span class={styles.toolErrorIcon} aria-hidden="true">
          <AlertTriangle />
        </span>
        <div>
          <h2>{props.label} stopped unexpectedly</h2>
          <p>
            The rest of Lab is still available. Retry this tool or return to the
            workbench without reloading the app.
          </p>
          <div class={styles.toolErrorActions}>
            <button type="button" class={styles.primaryAction} onClick={reset}>
              Try again
            </button>
            <button
              type="button"
              class={styles.secondaryAction}
              onClick={props.onBack}
            >
              Back to workbench
            </button>
          </div>
        </div>
      </div>
    )}
  >
    {props.children}
  </ErrorBoundary>
)

export const LabSurface: Component<{ initialTab?: LabTab }> = (props) => {
  const initial = props.initialTab ?? 'workbench'
  const [tab, setTab] = createSignal<LabTab>(initial)
  let pageRoot: HTMLDivElement | undefined
  const tabButtons: Partial<Record<LabTab, HTMLButtonElement>> = {}
  const backToAnalysis = () => setActiveTab(TAB_ANALYSIS)

  const showTool = (next: LabTab, syncRoute = true): void => {
    setTab(next)
    if (syncRoute) {
      const entry = TABS.find((candidate) => candidate.id === next)
      if (entry !== undefined) setActiveTab(entry.route)
    }

    // Each tool owns audio, microphone, timers, and global keyboard handlers.
    // Inactive tools must unmount so their cleanup runs before another tool
    // becomes interactive. Notify the newly mounted canvas of its dimensions.
    queueMicrotask(() => {
      pageRoot?.scrollIntoView?.({ block: 'start' })
      window.dispatchEvent(new Event('resize'))
    })
  }

  const activeTool = (): LabTool =>
    TABS.find((entry) => entry.id === tab()) ?? TABS[0]

  const handleTabKeyDown = (
    event: KeyboardEvent,
    currentIndex: number,
  ): void => {
    let nextIndex: number | null = null
    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % TABS.length
    else if (event.key === 'ArrowLeft')
      nextIndex = (currentIndex - 1 + TABS.length) % TABS.length
    else if (event.key === 'Home') nextIndex = 0
    else if (event.key === 'End') nextIndex = TABS.length - 1
    if (nextIndex === null) return

    event.preventDefault()
    const next = TABS[nextIndex]
    showTool(next.id)
    queueMicrotask(() => tabButtons[next.id]?.focus())
  }

  // Every Lab tool route resolves to this component, so a route change while
  // it stays mounted has to move the tab. Without this the signal keeps
  // whichever tool the Lab was first opened on.
  createEffect(
    on(
      () => props.initialTab,
      (next) => {
        if (next !== undefined) showTool(next, false)
      },
      { defer: true },
    ),
  )

  return (
    <div
      ref={(element) => {
        pageRoot = element
      }}
      class={styles.page}
    >
      <section class={styles.header} aria-labelledby="lab-title">
        <span class={styles.mark} aria-hidden="true">
          <Flask />
        </span>
        <div class={styles.identity}>
          <p class={styles.eyebrow}>Focused research workspace</p>
          <h1 class={styles.title} id="lab-title">
            Lab
          </h1>
          <p class={styles.subtitle}>
            Capture, measure, and compare audio without leaving your working
            context.
          </p>
        </div>
        <button
          type="button"
          class={styles.exitButton}
          onClick={backToAnalysis}
        >
          <ChevronLeft />
          Exit Lab
        </button>
      </section>

      <div class={styles.tabs} role="tablist" aria-label="Lab tools">
        <For each={TABS}>
          {(entry, index) => (
            <button
              ref={(element) => {
                tabButtons[entry.id] = element
              }}
              type="button"
              role="tab"
              id={`lab-tab-${entry.id}`}
              aria-controls={`lab-panel-${entry.id}`}
              aria-selected={tab() === entry.id}
              tabindex={tab() === entry.id ? 0 : -1}
              class={styles.tab}
              classList={{ [styles.tabActive]: tab() === entry.id }}
              onClick={() => showTool(entry.id)}
              onKeyDown={(event) => handleTabKeyDown(event, index())}
            >
              <span aria-hidden="true">{entry.icon()}</span>
              {entry.label}
            </button>
          )}
        </For>
      </div>

      <label class={styles.mobilePicker}>
        <span>Lab tool</span>
        <select
          value={tab()}
          onChange={(event) => showTool(event.currentTarget.value as LabTab)}
        >
          <For each={TABS}>
            {(entry) => <option value={entry.id}>{entry.label}</option>}
          </For>
        </select>
      </label>

      <p class={styles.toolDescription} id="lab-tool-description">
        {activeTool().description}
      </p>

      <div class={styles.panels}>
        <Show when={tab() === 'workbench'}>
          <section
            class={styles.panel}
            id="lab-panel-workbench"
            role="tabpanel"
            aria-labelledby="lab-tab-workbench"
            aria-describedby="lab-tool-description"
          >
            <LabToolBoundary
              label="Capture & inspect"
              onBack={() => showTool('workbench')}
            >
              <SpectralWorkbench />
            </LabToolBoundary>
          </section>
        </Show>
        <Show when={tab() === 'detection'}>
          <section
            class={styles.panel}
            id="lab-panel-detection"
            role="tabpanel"
            aria-labelledby="lab-tab-detection"
            aria-describedby="lab-tool-description"
          >
            <LabToolBoundary
              label="Tune detector"
              onBack={() => showTool('workbench')}
            >
              <Suspense fallback={<SkeletonTabContent />}>
                <PitchTestingTab onClose={backToAnalysis} />
              </Suspense>
            </LabToolBoundary>
          </section>
        </Show>
        <Show when={tab() === 'algorithms'}>
          <section
            class={styles.panel}
            id="lab-panel-algorithms"
            role="tabpanel"
            aria-labelledby="lab-tab-algorithms"
            aria-describedby="lab-tool-description"
          >
            <LabToolBoundary
              label="Benchmark algorithms"
              onBack={() => showTool('workbench')}
            >
              <Suspense fallback={<SkeletonTabContent />}>
                <PitchAlgorithmTester onClose={backToAnalysis} />
              </Suspense>
            </LabToolBoundary>
          </section>
        </Show>
        <Show when={tab() === 'transcribe'}>
          <section
            class={styles.panel}
            id="lab-panel-transcribe"
            role="tabpanel"
            aria-labelledby="lab-tab-transcribe"
            aria-describedby="lab-tool-description"
          >
            <LabToolBoundary
              label="Transcribe stem"
              onBack={() => showTool('workbench')}
            >
              <Suspense fallback={<SkeletonTabContent />}>
                <TranscriptionBench />
              </Suspense>
            </LabToolBoundary>
          </section>
        </Show>
        <Show when={tab() === 'lrc-diff'}>
          <section
            class={styles.panel}
            id="lab-panel-lrc-diff"
            role="tabpanel"
            aria-labelledby="lab-tab-lrc-diff"
            aria-describedby="lab-tool-description"
          >
            <LabToolBoundary
              label="Compare mappings"
              onBack={() => showTool('workbench')}
            >
              <Suspense fallback={<SkeletonTabContent />}>
                <LrcDiffTool />
              </Suspense>
            </LabToolBoundary>
          </section>
        </Show>
      </div>
    </div>
  )
}
