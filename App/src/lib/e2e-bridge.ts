import { exposeForE2E } from '@/lib/test-utils'
import { appStore } from '@/stores'
import { melodyStore } from '@/stores/melody-store'
import { PlaybackRuntime } from '@/lib/playback-runtime'
import { type PlaybackMode } from '@/types'
import { type Setter } from 'solid-js'

export interface E2EBridgeDeps {
  appStore: typeof appStore
  melodyStore: typeof melodyStore
  playbackRuntime?: PlaybackRuntime
  loadAndPlayMelodyForSession?: (id: string) => void
  playSessionSequence?: (ids: string[]) => void
  setPlayMode?: Setter<PlaybackMode>
}

declare global {
  interface Window {
    __pp?: Record<string, any>
    __appStore?: typeof appStore
    __melodyStore?: typeof melodyStore
    __playbackRuntime?: PlaybackRuntime
    __loadAndPlayMelodyForSession?: (id: string) => void
    __playSessionSequence?: (ids: string[]) => void
    __setPlayMode?: Setter<PlaybackMode>
  }
}

export function registerE2EBridge(deps: E2EBridgeDeps): void {
  const {
    appStore: app,
    melodyStore: melody,
    playbackRuntime,
    loadAndPlayMelodyForSession,
    playSessionSequence,
    setPlayMode,
  } = deps

  // Preferred namespacing
  window.__pp = {
    appStore: app,
    melodyStore: melody,
    playbackRuntime,
    loadAndPlayMelodyForSession,
    playSessionSequence,
    setPlayMode,
  }

  // Deprecated aliases for compatibility
  exposeForE2E('__appStore', app)
  exposeForE2E('__melodyStore', melody)
  if (playbackRuntime) exposeForE2E('__playbackRuntime', playbackRuntime)
  if (loadAndPlayMelodyForSession)
    exposeForE2E('__loadAndPlayMelodyForSession', loadAndPlayMelodyForSession)
  if (playSessionSequence)
    exposeForE2E('__playSessionSequence', playSessionSequence)
  if (setPlayMode) exposeForE2E('__setPlayMode', setPlayMode)
}
