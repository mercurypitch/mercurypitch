import { lazy, Suspense } from 'solid-js'
import { SkeletonList } from '@/components/Skeleton'

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
        <CommunityLeaderboard />
      </Suspense>
    </div>
  )
}
