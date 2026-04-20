// ============================================================
// Playback Store — Transport and playback state
// ============================================================

import { createSignal } from 'solid-js'
import type { TransportState } from '@/types'
import { appStore } from './app-store'

export type PlayButtonLabel = 'Start' | 'Pause' | 'Continue'

const [playbackState, setPlaybackState] =
  createSignal<TransportState>('stopped')
const [playButtonLabel, setPlayButtonLabel] =
  createSignal<PlayButtonLabel>('Start')
const [resetEnabled, setResetEnabled] = createSignal<boolean>(false)

/** Start playback — called when Play button is clicked while stopped */
export function startPlayback(): void {
  setPlaybackState('playing')
  setPlayButtonLabel('Pause')
  setResetEnabled(true)
}

/** Pause playback — called when Play button is clicked while playing */
export function pausePlayback(): void {
  setPlaybackState('paused')
  setPlayButtonLabel('Continue')
  setResetEnabled(true)
}

/** Continue playback — called when Play button is clicked while paused */
export function continuePlayback(): void {
  setPlaybackState('playing')
  setPlayButtonLabel('Pause')
  setResetEnabled(true)
}

/** Stop/reset playback — called when Reset button is clicked */
export function resetPlayback(): void {
  setPlaybackState('stopped')
  setPlayButtonLabel('Start')
  setResetEnabled(false)
}

export const playback = {
  state: playbackState,
  playButtonLabel,
  resetEnabled,
  startPlayback,
  pausePlayback,
  continuePlayback,
  resetPlayback,
  isPlaying: () => playbackState() === 'playing',
  isPaused: () => playbackState() === 'paused',
  isStopped: () => playbackState() === 'stopped',
}

/** Playback speed accessor function (for compatibility with EditorTabHeader) */
export function getPlaybackSpeed(): number {
  return appStore.playbackSpeed()
}
