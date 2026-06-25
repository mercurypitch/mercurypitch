import { lazy, Suspense } from 'solid-js'
import { SkeletonList } from '@/components/Skeleton'
import { TAB_CHALLENGES } from '@/features/tabs/constants'
import { setActiveTab } from '@/stores'

const CommunityLeaderboard = lazy(async () =>
  import('@/components/CommunityLeaderboard').then((m) => ({
    default: m.CommunityLeaderboard,
  })),
)

/** Leaderboard tab (TAB_LEADERBOARD). */
export function LeaderboardPage() {
  return (
    <div class="leaderboard-panel">
      <Suspense fallback={<SkeletonList rows={5} />}>
        <CommunityLeaderboard
          onOpenChallenges={() => setActiveTab(TAB_CHALLENGES)}
        />
      </Suspense>
    </div>
  )
}
