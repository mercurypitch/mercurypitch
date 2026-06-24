// ============================================================
// TranscriptionTrainerState — load audio, slow down, transcribe
// ============================================================

import type { Accessor } from 'solid-js'
import { createSignal, onCleanup } from 'solid-js'
import type { AudioEngine } from '@/lib/audio-engine'

export interface TranscriptionTrainerState {
  phase: Accessor<'idle' | 'loaded' | 'playing' | 'paused'>
  audioBuffer: Accessor<AudioBuffer | null>
  playbackRate: Accessor<number>
  loopStart: Accessor<number>
  loopEnd: Accessor<number>
  loopEnabled: Accessor<boolean>
  currentTime: Accessor<number>
  duration: Accessor<number>
  foundNotes: Accessor<number[]>
  loadAudio: (file: File) => Promise<void>
  play: () => void
  pause: () => void
  stop: () => void
  setPlaybackRate: (rate: number) => void
  setLoopStart: (s: number) => void
  setLoopEnd: (s: number) => void
  toggleLoop: () => void
  handleFretNotePlayed: (midi: number) => void
  clearFoundNotes: () => void
}

export function createTranscriptionTrainer(
  audioEngine: AudioEngine,
): TranscriptionTrainerState {
  const [phase, setPhase] = createSignal<
    'idle' | 'loaded' | 'playing' | 'paused'
  >('idle')
  const [audioBuffer, setAudioBuffer] = createSignal<AudioBuffer | null>(null)
  const [playbackRate, setPlaybackRate] = createSignal(1)
  const [loopStart, setLoopStart] = createSignal(0)
  const [loopEnd, setLoopEnd] = createSignal(0)
  const [loopEnabled, setLoopEnabled] = createSignal(false)
  const [currentTime, setCurrentTime] = createSignal(0)
  const [duration, setDuration] = createSignal(0)
  const [foundNotes, setFoundNotes] = createSignal<number[]>([])

  let sourceNode: AudioBufferSourceNode | null = null
  let startTime = 0
  let pauseOffset = 0
  let rafId: number | null = null

  const updateTime = () => {
    const ctx = audioEngine.audioCtx
    if (!ctx) return
    if (sourceNode && phase() === 'playing') {
      const elapsed =
        (ctx.currentTime - startTime) * playbackRate() + pauseOffset
      const dur = duration()
      if (loopEnabled() && elapsed >= loopEnd()) {
        // Jump back to loop start
        pauseOffset = loopStart()
        restartSource()
        return
      }
      setCurrentTime(Math.min(elapsed, dur))
    }
    rafId = requestAnimationFrame(updateTime)
  }

  const restartSource = () => {
    if (sourceNode) {
      try {
        sourceNode.stop()
      } catch {
        /* already stopped */
      }
      sourceNode.disconnect()
      sourceNode = null
    }

    const buf = audioBuffer()
    if (!buf) return

    const ctx = audioEngine.audioCtx
    if (!ctx) return
    sourceNode = ctx.createBufferSource()
    sourceNode.buffer = buf
    sourceNode.playbackRate.value = playbackRate()
    sourceNode.connect(ctx.destination)

    const offset = pauseOffset
    if (loopEnabled()) {
      sourceNode.loop = true
      sourceNode.loopStart = loopStart()
      sourceNode.loopEnd = loopEnd()
      sourceNode.start(0, offset)
    } else {
      sourceNode.start(0, offset)
    }

    startTime = ctx.currentTime
    setPhase('playing')
    if (rafId === null) {
      rafId = requestAnimationFrame(updateTime)
    }
  }

  const loadAudio = async (file: File): Promise<void> => {
    stop()
    const ctx = audioEngine.audioCtx
    if (!ctx) return
    const arrayBuf = await file.arrayBuffer()
    const decoded = await ctx.decodeAudioData(arrayBuf)
    setAudioBuffer(decoded)
    setDuration(decoded.duration)
    setLoopEnd(decoded.duration)
    setLoopStart(0)
    pauseOffset = 0
    setCurrentTime(0)
    setFoundNotes([])
    setPhase('loaded')
  }

  const play = () => {
    if (phase() === 'playing') return
    if (phase() === 'paused') {
      restartSource()
      return
    }
    if (pauseOffset >= duration()) {
      pauseOffset = 0
    }
    restartSource()
  }

  const pause = () => {
    if (phase() !== 'playing') return
    const ctx = audioEngine.audioCtx
    if (!ctx) return
    setPhase('paused')
    const elapsed = (ctx.currentTime - startTime) * playbackRate() + pauseOffset
    pauseOffset = elapsed
    setCurrentTime(elapsed)
    if (sourceNode) {
      try {
        sourceNode.stop()
      } catch {
        /* ok */
      }
      sourceNode.disconnect()
      sourceNode = null
    }
  }

  const stop = () => {
    if (rafId !== null) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
    if (sourceNode) {
      try {
        sourceNode.stop()
      } catch {
        /* ok */
      }
      sourceNode.disconnect()
      sourceNode = null
    }
    setPhase((p) => (p === 'idle' ? 'idle' : 'loaded'))
    pauseOffset = 0
    setCurrentTime(0)
  }

  const handleFretNotePlayed = (midi: number) => {
    setFoundNotes((prev) => [...prev, midi % 12])
  }

  const clearFoundNotes = () => {
    setFoundNotes([])
  }

  const toggleLoop = () => {
    setLoopEnabled((l) => !l)
    if (phase() === 'playing') {
      const ctx = audioEngine.audioCtx
      if (!ctx) return
      // Restart to apply loop
      const elapsed =
        (ctx.currentTime - startTime) * playbackRate() + pauseOffset
      pauseOffset = elapsed
      restartSource()
    }
  }

  let _rate = 1
  const setRate = (rate: number) => {
    _rate = Math.max(0.25, Math.min(2, rate))
    setPlaybackRate(_rate)
    if (sourceNode) {
      sourceNode.playbackRate.value = _rate
    }
  }

  const setLS = (s: number) =>
    setLoopStart(Math.max(0, Math.min(s, loopEnd() - 0.5)))
  const setLE = (s: number) =>
    setLoopEnd(Math.max(loopStart() + 0.5, Math.min(s, duration())))

  onCleanup(() => {
    stop()
  })

  return {
    phase,
    audioBuffer,
    playbackRate,
    loopStart,
    loopEnd,
    loopEnabled,
    currentTime,
    duration,
    foundNotes,
    loadAudio,
    play,
    pause,
    stop,
    setPlaybackRate: setRate,
    setLoopStart: setLS,
    setLoopEnd: setLE,
    toggleLoop,
    handleFretNotePlayed,
    clearFoundNotes,
  }
}
