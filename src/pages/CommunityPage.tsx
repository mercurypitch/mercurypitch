import { lazy, Show, Suspense } from 'solid-js'
import { SkeletonCardGrid } from '@/components/Skeleton'
import { sharedRunRequest } from '@/features/community/shared-run-link'
import { SharedRunResult } from '@/features/community/SharedRunResult'
import { TAB_COMMUNITY } from '@/features/tabs/constants'
import { navigateTo } from '@/lib/hash-router'

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
        <Show when={sharedRunRequest()} fallback={<CommunityShare />}>
          {(request) => (
            <SharedRunResult
              request={request()}
              onClose={() => navigateTo({ type: 'tab', tab: TAB_COMMUNITY })}
            />
          )}
        </Show>
      </Suspense>
    </div>
  )
}
