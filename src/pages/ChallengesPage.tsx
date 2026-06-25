import { lazy, Suspense } from 'solid-js'
import { SkeletonCardGrid } from '@/components/Skeleton'

const VocalChallenges = lazy(async () =>
  import('@/components/VocalChallenges').then((m) => ({
    default: m.VocalChallenges,
  })),
)

/** Challenges tab (TAB_CHALLENGES). */
export function ChallengesPage() {
  return (
    <div class="vocal-challenges-panel">
      <Suspense fallback={<SkeletonCardGrid count={6} />}>
        <VocalChallenges />
      </Suspense>
    </div>
  )
}
