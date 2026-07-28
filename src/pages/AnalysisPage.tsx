import { lazy, Suspense } from 'solid-js'
import { SkeletonTabContent } from '@/components/Skeleton'

const AnalysisDashboard = lazy(async () =>
  import('@/features/analysis/AnalysisDashboard').then((m) => ({
    default: m.AnalysisDashboard,
  })),
)

/** One dashboard at every width. The dense audio-research workbenches
 *  (spectral tooling, detector benchmarks) live on the Lab surface. */
export function AnalysisPage() {
  return (
    <Suspense fallback={<SkeletonTabContent />}>
      <AnalysisDashboard />
    </Suspense>
  )
}
