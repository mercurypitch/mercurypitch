import { createSignal } from 'solid-js'
import type { MelodyItem } from '@/types'

// Single source of truth for playback state across the app.
export type PlaybackState = 'playing' | 'paused' | 'stopped'

export const [playbackState, setPlaybackState] = createSignal<PlaybackState>('stopped')
export const [currentBeat, setCurrentBeat] = createSignal<number>(0)
export const [currentNoteIndex, setCurrentNoteIndex] = createSignal<number>(-1)

export const [playbackDisplayMelody, setPlaybackDisplayMelody] = createSignal<MelodyItem[] | null>(null)
export const [playbackDisplayBeats, setPlaybackDisplayBeats] = createSignal<number | null>(null)

export const isPlaying = () => playbackState() === 'playing'
export const isPaused = () => playbackState() === 'paused'
export const isStopped = () => playbackState() === 'stopped'

export function resetPlaybackState(): void {
  setPlaybackState('stopped')
  setCurrentBeat(0)
  setCurrentNoteIndex(-1)
  setPlaybackDisplayMelody(null)
  setPlaybackDisplayBeats(null)
}
