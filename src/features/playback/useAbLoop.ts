// ============================================================
// useAbLoop — A-B Loop controller hook for transport playback
// ============================================================
//
// Owns loop state (A, B, enabled, manual-seek escape) and syncs
// with the active tab's transport (Singing, Compose, or Piano).
// Loop boundary and geometry rules come from @/lib/ab-loop.

import type { Accessor } from 'solid-js'
import { createEffect, createSignal } from 'solid-js'
import { TAB_PIANO } from '@/features/tabs/constants'
import { clampLoopB, isSeekOutsideLoop, shouldLoopBack } from '@/lib/ab-loop'

export const LOOP_MIN_GAP_BEATS = 0.25

export interface UseAbLoopDeps {
  activeTab: Accessor<string>
  currentBeat: Accessor<number>
  totalBeats: Accessor<number>
  seekToBeat: (beat: number) => void
  pianoTransport: {
    playheadBeat: Accessor<number>
    totalBeats: Accessor<number>
    seekToBeat: (beat: number) => void
  }
  fallingNotes: {
    setLoop: (a: number, b: number, enabled: boolean) => void
  }
  onLoopLap?: () => void
}

export interface UseAbLoopReturn {
  loopEnabled: Accessor<boolean>
  loopA: Accessor<number>
  loopB: Accessor<number>
  seekedOutsideLoop: Accessor<boolean>
  setLoopEnabled: (enabled: boolean | ((prev: boolean) => boolean)) => void
  setLoopA: (beat: number) => void
  setLoopB: (beat: number) => void
  handleSetLoopA: () => void
  handleSetLoopB: () => void
  handleToggleLoop: () => void
  handleClearLoop: () => void
  handleMoveLoopA: (beat: number) => void
  handleMoveLoopB: (beat: number) => void
  handleLoopSeek: (beat: number) => void
}

export function useAbLoop(deps: UseAbLoopDeps): UseAbLoopReturn {
  const [loopEnabled, setLoopEnabled] = createSignal(false)
  const [loopA, setLoopA] = createSignal(0)
  const [loopB, setLoopB] = createSignal(0)
  const [seekedOutsideLoop, setSeekedOutsideLoop] = createSignal(false)

  const loopTransport = (): {
    beat: () => number
    total: () => number
    seekTo: (beat: number) => void
  } => {
    if (deps.activeTab() === TAB_PIANO) {
      return {
        beat: deps.pianoTransport.playheadBeat,
        total: deps.pianoTransport.totalBeats,
        seekTo: deps.pianoTransport.seekToBeat,
      }
    }
    return {
      beat: deps.currentBeat,
      total: deps.totalBeats,
      seekTo: deps.seekToBeat,
    }
  }

  const handleSetLoopA = () => {
    const beat = loopTransport().beat()
    if (beat < 0) return
    setLoopA(Math.max(0, beat))
    if (loopB() > 0 && beat >= loopB()) {
      setLoopB(0)
      setLoopEnabled(false)
    }
  }

  const handleSetLoopB = () => {
    const t = loopTransport()
    const beat = clampLoopB(t.beat(), loopA(), t.total())
    if (beat <= loopA()) return
    setLoopB(beat)
    setSeekedOutsideLoop(false)
    setLoopEnabled(true)
  }

  const handleToggleLoop = () => {
    setLoopEnabled((v) => !v)
  }

  const handleClearLoop = () => {
    setLoopEnabled(false)
    setLoopA(0)
    setLoopB(0)
    setSeekedOutsideLoop(false)
  }

  const handleMoveLoopA = (beat: number) => {
    const b = loopB()
    const upper = b > 0 ? b - LOOP_MIN_GAP_BEATS : loopTransport().total()
    setLoopA(Math.max(0, Math.min(beat, upper)))
  }

  const handleMoveLoopB = (beat: number) => {
    const lower = loopA() + LOOP_MIN_GAP_BEATS
    setLoopB(Math.min(Math.max(beat, lower), loopTransport().total()))
  }

  const handleLoopSeek = (beat: number) => {
    setSeekedOutsideLoop(isSeekOutsideLoop(beat, loopA(), loopB()))
    loopTransport().seekTo(beat)
  }

  createEffect(() => {
    deps.fallingNotes.setLoop(loopA(), loopB(), loopEnabled())
  })

  createEffect(() => {
    const t = loopTransport()
    const beat = t.beat()
    if (
      seekedOutsideLoop() &&
      loopA() < loopB() &&
      beat >= loopA() &&
      beat < loopB()
    ) {
      setSeekedOutsideLoop(false)
    }
    if (deps.activeTab() === TAB_PIANO) return
    if (
      shouldLoopBack(beat, {
        enabled: loopEnabled(),
        a: loopA(),
        b: loopB(),
        seekedOutside: seekedOutsideLoop(),
      }) &&
      beat < t.total()
    ) {
      deps.onLoopLap?.()
      t.seekTo(loopA())
    }
  })

  return {
    loopEnabled,
    loopA,
    loopB,
    seekedOutsideLoop,
    setLoopEnabled,
    setLoopA,
    setLoopB,
    handleSetLoopA,
    handleSetLoopB,
    handleToggleLoop,
    handleClearLoop,
    handleMoveLoopA,
    handleMoveLoopB,
    handleLoopSeek,
  }
}
