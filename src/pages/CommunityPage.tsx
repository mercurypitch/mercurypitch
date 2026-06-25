import { lazy, Suspense } from 'solid-js'
import { SkeletonCardGrid } from '@/components/Skeleton'

const CommunityShare = lazy(async () =>
  import('@/components/CommunityShare').then((m) => ({
    default: m.CommunityShare,
  })),
)

/** Community tab (TAB_COMMUNITY). */
export function CommunityPage() {
  return (
    <div class="community-panel">
      <Suspense fallback={<SkeletonCardGrid count={6} />}>
        <CommunityShare />
      </Suspense>
    </div>
  )
}
