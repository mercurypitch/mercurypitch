import type { Accessor } from 'solid-js'
import { lazy, Suspense } from 'solid-js'
import { SkeletonTabContent } from '@/components/Skeleton'
import type { UvrView } from '@/components/UvrPanel'
import { TAB_SINGING } from '@/features/tabs/constants'
import { setActiveTab } from '@/stores'
import { melodyStore } from '@/stores/melody-store'

const UvrPanel = lazy(async () =>
  import('@/components/UvrPanel').then((m) => ({ default: m.UvrPanel })),
)

interface KaraokePageProps {
  /** Initial view / session come from the hash router (deep links), owned by
   *  AppShell so the router can keep writing them. */
  initialView: Accessor<UvrView | null>
  initialSessionId: Accessor<string | null>
  onSessionChange: (sessionId: string | null) => void
  onViewChange: (view: UvrView) => void
}

/** Karaoke tab (TAB_KARAOKE): the UVR (vocal separation) panel. */
export function KaraokePage(props: KaraokePageProps) {
  return (
    <div id="uvr-panel">
      <Suspense fallback={<SkeletonTabContent />}>
        <UvrPanel
          initialView={props.initialView() ?? 'upload'}
          initialSessionId={props.initialSessionId() ?? undefined}
          onSessionChange={(sessionId) => props.onSessionChange(sessionId)}
          onViewChange={(view) => props.onViewChange(view)}
          onSelectMelody={(melodyId) => {
            melodyStore.loadMelody(melodyId)
            setActiveTab(TAB_SINGING)
          }}
          onPracticeStart={(mode) => {
            console.log('Starting practice with mode:', mode)
          }}
          onExport={(type) => {
            console.log('Exporting:', type)
          }}
          onSessionView={(sessionId) => {
            console.log('Viewing session:', sessionId)
          }}
        />
      </Suspense>
    </div>
  )
}
