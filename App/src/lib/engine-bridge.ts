// ============================================================
// Engine Bridge - Bridges component handlers to engines
// ============================================================

import { playback } from '@/stores/playback-store'
import type { AudioEngine } from './audio-engine'
import type { PlaybackRuntime } from './playback-runtime'
import type { PracticeEngine } from './practice-engine'

export type EngineCallbacks = {
  onPlay: () => void
  onPause: () => void
  onResume: () => void
  onStop: () => void
  onEditorPlay: () => void
  onEditorPause: () => void
  onEditorResume: () => void
  onEditorStop: () => void
  onVolumeChange: (vol: number) => void
  onSeekTo: (beat: number) => void
  onOctaveShift: (delta: number) => void
  onRecordToggle: () => void
  onMicToggle: () => void
  onWaveToggle: () => void
  onPracticeSubModeChange: (mode: string) => void
  onCyclesChange: (cycles: number) => void
}

let callbacks: EngineCallbacks | null = null

export function setEngineCallbacks(c: EngineCallbacks) {
  callbacks = c
}

export function play() {
  callbacks?.onPlay()
}

export function pause() {
  callbacks?.onPause()
}

export function resume() {
  callbacks?.onResume()
}

export function stop() {
  callbacks?.onStop()
  playback.resetPlayback()
}

export function editorPlay() {
  callbacks?.onEditorPlay()
}

export function editorPause() {
  callbacks?.onEditorPause()
}

export function editorResume() {
  callbacks?.onEditorResume()
}

export function editorStop() {
  callbacks?.onEditorStop()
}

export function seekTo(beat: number) {
  callbacks?.onSeekTo(beat)
}

export function octaveShift(delta: number) {
  callbacks?.onOctaveShift(delta)
}

export function recordToggle() {
  callbacks?.onRecordToggle()
}

export function micToggle() {
  callbacks?.onMicToggle()
}

export function waveToggle() {
  callbacks?.onWaveToggle()
}

export function practiceSubModeChange(mode: string) {
  callbacks?.onPracticeSubModeChange(mode)
}

export function cyclesChange(cycles: number) {
  callbacks?.onCyclesChange(cycles)
}
