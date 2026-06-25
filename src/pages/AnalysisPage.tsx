import { createSignal, lazy, Show, Suspense } from 'solid-js'
import styles from '@/components/App.module.css'
import { Cpu, Ear, Voice } from '@/components/icons'
import { SkeletonTabContent } from '@/components/Skeleton'
import { TAB_SINGING } from '@/features/tabs/constants'
import { setActiveTab } from '@/stores'

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

/** Analysis tab (TAB_ANALYSIS): vocal analysis / pitch detection / algorithms.
 *  The sub-tab selection is local to this page. */
export function AnalysisPage() {
  const [analysisSubTab, setAnalysisSubTab] = createSignal<
    'vocal' | 'detection' | 'algorithms'
  >('vocal')

  return (
    <div
      class="analysis-container"
      style="display: flex; flex-direction: column; width: 100%; height: 100%;"
    >
      <div
        class="analysis-tabs"
        data-tour="analysis.subtabs"
        style="display: flex; gap: 1rem; padding: 1rem; background: var(--bg-secondary); border-bottom: 1px solid var(--border-color);"
      >
        <button
          class={styles.viewBtn}
          classList={{
            [styles.activeViewBtn]: analysisSubTab() === 'vocal',
          }}
          onClick={() => setAnalysisSubTab('vocal')}
          aria-label="Vocal Analysis"
          title="Vocal Analysis"
        >
          <Voice /> Vocal Analysis
        </button>
        <button
          class={styles.viewBtn}
          classList={{
            [styles.activeViewBtn]: analysisSubTab() === 'detection',
          }}
          onClick={() => setAnalysisSubTab('detection')}
          aria-label="Pitch Detection"
          title="Pitch Detection"
        >
          <Ear /> Pitch Detection
        </button>
        <button
          class={styles.viewBtn}
          classList={{
            [styles.activeViewBtn]: analysisSubTab() === 'algorithms',
          }}
          onClick={() => setAnalysisSubTab('algorithms')}
          aria-label="Pitch Algorithms"
          title="Pitch Algorithms"
        >
          <Cpu /> Pitch Algorithms
        </button>
      </div>

      <div
        class="analysis-content"
        style="flex: 1; overflow: hidden; position: relative;"
      >
        <Show when={analysisSubTab() === 'vocal'}>
          <div
            class="vocal-analysis-panel"
            data-tour="analysis.vocal"
            style="width: 100%; height: 100%;"
          >
            <Suspense fallback={<SkeletonTabContent />}>
              <VocalAnalysis />
            </Suspense>
          </div>
        </Show>
        <Show when={analysisSubTab() === 'detection'}>
          <div
            class="pitch-detection-panel"
            data-tour="analysis.detection"
            style="width: 100%; height: 100%;"
          >
            <PitchTestingTab onClose={() => setActiveTab(TAB_SINGING)} />
          </div>
        </Show>
        <Show when={analysisSubTab() === 'algorithms'}>
          <div
            class="pitch-algorithms-panel"
            data-tour="analysis.algorithms"
            style="width: 100%; height: 100%;"
          >
            <PitchAlgorithmTester onClose={() => setActiveTab(TAB_SINGING)} />
          </div>
        </Show>
      </div>
    </div>
  )
}
