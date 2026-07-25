import type { Setter } from 'solid-js'
import type { AudioEngine } from '@/lib/audio-engine'
import type { PlaybackRuntime } from '@/lib/playback-runtime'
import { exposeForE2E } from '@/lib/test-utils'
import type { appStore } from '@/stores'
import * as karaokePlaylistStore from '@/stores/karaoke-playlist-store'
import type { melodyStore } from '@/stores/melody-store'
import type { PlaybackMode } from '@/types'

export interface E2EBridgeDeps {
  appStore: typeof appStore
  melodyStore: typeof melodyStore
  playbackRuntime?: PlaybackRuntime
  /** Poly-voice probe: tests assert active voice counts and the cap. */
  audioEngine?: AudioEngine
  loadAndPlayMelodyForSession?: (id: string) => void
  playSessionSequence?: (ids: string[]) => void
  setPlayMode?: Setter<PlaybackMode>
}

declare global {
  interface Window {
    __pp?: Record<string, unknown>
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
    audioEngine,
    loadAndPlayMelodyForSession,
    playSessionSequence,
    setPlayMode,
  } = deps

  // Preferred namespacing — gated to test/E2E only
  exposeForE2E('__pp', {
    appStore: app,
    melodyStore: melody,
    playbackRuntime,
    audioEngine,
    loadAndPlayMelodyForSession,
    playSessionSequence,
    setPlayMode,
  })

  // Deprecated aliases for compatibility
  exposeForE2E('__appStore', app)
  exposeForE2E('__melodyStore', melody)
  if (playbackRuntime) exposeForE2E('__playbackRuntime', playbackRuntime)
  if (loadAndPlayMelodyForSession)
    exposeForE2E('__loadAndPlayMelodyForSession', loadAndPlayMelodyForSession)
  if (playSessionSequence)
    exposeForE2E('__playSessionSequence', playSessionSequence)
  if (setPlayMode) exposeForE2E('__setPlayMode', setPlayMode)

  // Karaoke playlist store — lets specs seed a playlist and read it back
  // without audio hardware or UVR sessions (e.g. the vocal-slider drag spec).
  exposeForE2E('__karaokePlaylists', karaokePlaylistStore)
}
