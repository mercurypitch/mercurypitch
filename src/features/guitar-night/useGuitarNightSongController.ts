// Guitar Night song controller preserves route history over shared selection mechanics.
// ============================================================

import { onCleanup, onMount } from 'solid-js'
import type { PlayAlongLibraryState, PlayAlongSelectionState, } from '@/features/play-along/useSongController'
import { usePlayAlongSongController } from '@/features/play-along/useSongController'
import { readGuitarNightSession, withGuitarNightSession } from './session-link'
import type { GuitarNightBackingLease, GuitarNightSongPort } from './song-port'

export type GuitarNightLibraryState = PlayAlongLibraryState
export type GuitarNightSelectionState = PlayAlongSelectionState<'guitar'>

interface GuitarNightSongControllerOptions {
  loadSongPort?: () => Promise<GuitarNightSongPort>
  onRouteSession?: (sessionId: string) => void
  onBackingWillRelease?: (lease: GuitarNightBackingLease) => void
}

export async function loadDefaultGuitarNightSongPort(): Promise<GuitarNightSongPort> {
  const [device, demo, ports] = await Promise.all([
    import('./uvr-song-port'),
    import('./demo-song-port'),
    import('./song-port'),
  ])
  return ports.composeGuitarNightSongPorts(
    device.createUvrGuitarNightSongPort(),
    demo.createDemoGuitarNightSongPort(),
  )
}

function writeSessionToHistory(
  sessionId: string | null,
  mode: 'push' | 'replace',
): void {
  const href = withGuitarNightSession(window.location.href, sessionId)
  if (mode === 'replace') window.history.replaceState(null, '', href)
  else window.history.pushState(null, '', href)
}

export function useGuitarNightSongController(
  options: GuitarNightSongControllerOptions = {},
) {
  const controller = usePlayAlongSongController<'guitar'>({
    loadSongPort: options.loadSongPort ?? loadDefaultGuitarNightSongPort,
    initialSessionId: readGuitarNightSession(),
    writeSession: writeSessionToHistory,
    onBackingWillRelease: options.onBackingWillRelease,
  })

  onMount(() => {
    const initialSessionId = controller.routeSessionId()
    if (initialSessionId !== null) {
      options.onRouteSession?.(initialSessionId)
      void controller.stageSession(initialSessionId, 'none')
    }

    const handlePopState = () => {
      const nextSessionId = readGuitarNightSession()
      if (nextSessionId === null) {
        controller.clearSession('none')
        return
      }
      options.onRouteSession?.(nextSessionId)
      void controller.stageSession(nextSessionId, 'none')
    }
    window.addEventListener('popstate', handlePopState)
    onCleanup(() => window.removeEventListener('popstate', handlePopState))
  })

  return controller
}
