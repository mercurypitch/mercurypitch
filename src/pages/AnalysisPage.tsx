import type { Component } from 'solid-js'
import { createSignal, lazy, Show, Suspense } from 'solid-js'
import { AnalysisMobileOverview } from '@/components/AnalysisMobileOverview'
import styles from '@/components/App.module.css'
import { Cpu, Ear, Voice } from '@/components/icons'
import { SkeletonTabContent } from '@/components/Skeleton'
import { TAB_SINGING } from '@/features/tabs/constants'
import { isNarrow } from '@/lib/use-viewport'
import { setActiveTab } from '@/stores'
import pageStyles from './AnalysisPage.module.css'

const PitchAlgorithmTester = lazy(async () =>
  import('@/components/PitchAlgorithmTester').then((m) => ({
    default: m.PitchAlgorithmTester,
  })),
)
const PitchTestingTab = lazy(async () =>
  import('@/components/PitchTestingTab').then((m) => ({
    default: m.PitchTestingTab,
  })),
)
const VocalAnalysis = lazy(async () =>
  import('@/components/VocalAnalysis').then((m) => ({
    default: m.VocalAnalysis,
  })),
)

type AnalysisSubTab = 'vocal' | 'detection' | 'algorithms'

const DesktopAnalysisWorkspace: Component = () => {
  const [analysisSubTab, setAnalysisSubTab] =
    createSignal<AnalysisSubTab>('vocal')

  return (
    <>
      <div
        class={pageStyles.desktopTabs}
        data-tour="analysis.subtabs"
        role="tablist"
        aria-label="Analysis tools"
      >
        <button
          type="button"
          role="tab"
          class={styles.viewBtn}
          classList={{
            [styles.activeViewBtn]: analysisSubTab() === 'vocal',
          }}
          onClick={() => setAnalysisSubTab('vocal')}
          aria-selected={analysisSubTab() === 'vocal'}
          aria-label="Vocal Analysis"
          title="Vocal Analysis"
        >
          <Voice /> Vocal Analysis
        </button>
        <button
          type="button"
          role="tab"
          class={styles.viewBtn}
          classList={{
            [styles.activeViewBtn]: analysisSubTab() === 'detection',
          }}
          onClick={() => setAnalysisSubTab('detection')}
          aria-selected={analysisSubTab() === 'detection'}
          aria-label="Pitch Detection"
          title="Pitch Detection"
        >
          <Ear /> Pitch Detection
        </button>
        <button
          type="button"
          role="tab"
          class={styles.viewBtn}
          classList={{
            [styles.activeViewBtn]: analysisSubTab() === 'algorithms',
          }}
          onClick={() => setAnalysisSubTab('algorithms')}
          aria-selected={analysisSubTab() === 'algorithms'}
          aria-label="Pitch Algorithms"
          title="Pitch Algorithms"
        >
          <Cpu /> Pitch Algorithms
        </button>
      </div>

      <div class={pageStyles.desktopContent}>
        <Show when={analysisSubTab() === 'vocal'}>
          <div class={pageStyles.desktopPanel} data-tour="analysis.vocal">
            <Suspense fallback={<SkeletonTabContent />}>
              <VocalAnalysis />
            </Suspense>
          </div>
        </Show>
        <Show when={analysisSubTab() === 'detection'}>
          <div class={pageStyles.desktopPanel} data-tour="analysis.detection">
            <PitchTestingTab onClose={() => setActiveTab(TAB_SINGING)} />
          </div>
        </Show>
        <Show when={analysisSubTab() === 'algorithms'}>
          <div class={pageStyles.desktopPanel} data-tour="analysis.algorithms">
            <PitchAlgorithmTester onClose={() => setActiveTab(TAB_SINGING)} />
          </div>
        </Show>
      </div>
    </>
  )
}

/** Analysis is a focused UVR voiceprint on phones. The dense live, tuning and
 * benchmark workspaces remain available on larger screens. */
export function AnalysisPage() {
  return (
    <div class={pageStyles.page}>
      <Show when={isNarrow()} fallback={<DesktopAnalysisWorkspace />}>
        <AnalysisMobileOverview />
      </Show>
    </div>
  )
}
