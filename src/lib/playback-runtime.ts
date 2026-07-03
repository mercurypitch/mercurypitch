// ============================================================
// PlaybackRuntime - Unified playback orchestrator
// Manages audio timing and syncs with PianoRollEditor
// ============================================================

import type { MelodyItem } from '@/types'
import type { InstrumentType } from './audio-engine'
import { AudioEngine } from './audio-engine'
import { melodyIndicesAtBeat } from './scale-data'

export type PlaybackState = 'stopped' | 'playing' | 'paused'
export interface PlaybackEvent {
  type:
    | 'state'
    | 'beat'
    | 'noteStart'
    | 'noteEnd'
    | 'complete'
    | 'countIn'
    | 'countInComplete'
    | 'metronome'
  state?: PlaybackState
  beat?: number
  note?: MelodyItem
  index?: number
  countIn?: number
  isDownbeat?: boolean
  isCountIn?: boolean
}

export interface PlaybackRuntimeCallbacks {
  onEvent?: (event: PlaybackEvent) => void
  onNoteStart?: (note: MelodyItem, index: number) => void
  onNoteEnd?: (note: MelodyItem, index: number) => void
  onBeatUpdate?: (beat: number) => void
  onComplete?: () => void
}

export interface PlaybackRuntimeOptions {
  /** Existing AudioEngine instance (BPM managed by appStore) */
  audioEngine?: AudioEngine
  metronomeEnabled?: () => boolean
  instrumentType?: InstrumentType
  onEvent?: (event: PlaybackEvent) => void
  onNoteStart?: (note: MelodyItem, index: number) => void
  onNoteEnd?: (note: MelodyItem, index: number) => void
  onBeatUpdate?: (beat: number) => void
  onComplete?: () => void
}

export class PlaybackRuntime {
  private audioEngine: AudioEngine
  private ownsAudioEngine: boolean
  private callbacks: PlaybackRuntimeCallbacks
  private isPlaying = false
  private isPaused = false
  private currentBeat = 0
  private currentNoteIndices: Set<number> = new Set()
  private onEventCallbacks = new Map<string, Set<(e: unknown) => void>>()
  private animationFrameId: number | null = null
  private playStartTime = 0
  private pauseOffset = 0
  private pauseStartTime = 0
  // A seek made while stopped: consumed as the start position by start().
  private pendingStartBeat = 0
  private _countInBeats = 0
  private countInBeat = 0
  private metronomeEnabled?: () => boolean
  private metronomeLastBeat = -1
  private metronomeLastCountInBeat = -1
  private _melody: MelodyItem[] = []
  private _durationBeats = 0
  private countInCompleteEmitted = false
  private _lastBpm = 120
  // Open-ended mode: while true, playback never auto-stops at the end of the
  // arrangement — used for free-form recording where the take length is
  // whatever the user sings until they stop. Always cleared on stop().
  private _openEnded = false

  private _getTotalBeats(melody: MelodyItem[]): number {
    let max = 0
    for (const item of melody) {
      const end = item.startBeat + item.duration
      if (end > max) max = end
    }
    return max
  }

  /**
   * Initialize with AudioEngine (BPM should be set via appStore)
   */
  constructor(options: PlaybackRuntimeOptions) {
    this.audioEngine = options.audioEngine ?? new AudioEngine()
    this.ownsAudioEngine = options.audioEngine === undefined
    this.audioEngine.setInstrument(options.instrumentType ?? 'sine')
    this.callbacks = options
    this.metronomeEnabled = options.metronomeEnabled
    this._lastBpm = this.getBPM()
  }

  // ── Subscription API ─────────────────────────────────────

  on(event: 'state', handler: (state: PlaybackState) => void): void
  on(event: 'beat', handler: (e: { beat: number }) => void): void
  on(
    event: 'noteStart',
    handler: (e: { note: MelodyItem; index: number }) => void,
  ): void
  on(
    event: 'noteEnd',
    handler: (e: { note: MelodyItem; index: number }) => void,
  ): void
  on(event: 'complete', handler: () => void): void
  on(event: 'countIn', handler: (e: { countIn: number }) => void): void
  on(event: 'countInComplete', handler: () => void): void
  on(
    event: 'metronome',
    handler: (e: { beat: number; isDownbeat: boolean }) => void,
  ): void
  on(event: PlaybackEvent['type'], handler: unknown): void {
    const _handler = handler as (e: unknown) => void
    if (!this.onEventCallbacks.has(event)) {
      this.onEventCallbacks.set(event, new Set())
    }
    this.onEventCallbacks.get(event)!.add(_handler)
  }

  off(event: PlaybackEvent['type'], handler: unknown): void {
    const _handler = handler as (e: unknown) => void
    this.onEventCallbacks.get(event)?.delete(_handler)
  }

  // ── State ─────────────────────────────────────────────────

  getIsPlaying(): boolean {
    return this.isPlaying
  }

  getIsPaused(): boolean {
    return this.isPaused
  }

  getCurrentBeat(): number {
    return this.currentBeat
  }

  getCurrentNoteIndex(): number {
    for (const idx of this.currentNoteIndices) return idx
    return -1
  }

  getPlaybackState(): PlaybackState {
    if (this.isPaused) return 'paused'
    if (this.isPlaying) return 'playing'
    return 'stopped'
  }

  // ── Playback Control ───────────────────────────────────────

  start(countInBeats: number = 0): void {
    if (this.isPlaying) {
      return
    }

    if (!this.audioEngine.getIsInitialized()) {
      this.audioEngine
        .init()
        .catch((err) => console.error('Audio init error:', err))
    }

    // Track if we're resuming from pause (not stopping)
    const wasPaused = this.isPaused
    const isResuming = wasPaused && this.pauseOffset > 0

    this.isPlaying = true

    if (isResuming) {
      // For resuming, continue from paused position
      // Don't reset countInBeat - preserve where we left off
      this.currentBeat = Math.max(0, this.currentBeat)
    } else {
      // Fresh start - initialize count-in from top
      this.currentBeat = 0
      this.currentNoteIndices.clear()
      this._countInBeats = countInBeats
      this.countInBeat = countInBeats
      this.countInCompleteEmitted = false
      this.pauseOffset = 0
      // Set playStartTime for fresh starts (not resuming)
      this.playStartTime = performance.now()
    }

    if (isResuming) {
      this.pauseOffset +=
        this.pauseStartTime > 0 ? performance.now() - this.pauseStartTime : 0
    }
    this.pauseStartTime = 0

    this._emit({ type: 'state', state: 'playing' })

    this._startAnimationLoop()

    // Consume a seek made while stopped: jump there the moment playback
    // begins. The playing-state seek rebases past the count-in, so a
    // mid-song start skips the count-in runway.
    if (!isResuming && this.pendingStartBeat > 0) {
      const target = this.pendingStartBeat
      this.pendingStartBeat = 0
      this.seekTo(target)
    }
  }

  pause(): boolean {
    if (!this.isPlaying || this.isPaused) return true

    // Record the time when pause started - this will be used to calculate pause duration
    if (this.playStartTime > 0) {
      this.pauseStartTime = performance.now()
      this.isPaused = true
      // Keep isPlaying=true so resume() can proceed - we're in "paused but playing" state
      this._emit({ type: 'state', state: 'paused' })
      this._stopAnimationLoop()
    }
    return this.isPlaying
  }

  resume(): void {
    if (!this.isPaused) return

    this.pauseOffset +=
      this.pauseStartTime > 0 ? performance.now() - this.pauseStartTime : 0
    this.pauseStartTime = 0
    this.isPaused = false
    this.isPlaying = true

    // Clear active note tracking so the animation loop re-triggers
    // noteStart events for notes that are still in-range after the
    // pause. Without this, notes active before the pause stay silent
    // because the set-diff sees them as "already playing".
    this.currentNoteIndices.clear()

    this._emit({ type: 'state', state: 'playing' })
    this._startAnimationLoop()
  }

  /**
   * Enable/disable open-ended playback. While enabled, the animation loop will
   * not auto-stop when the playhead passes the arrangement end — it keeps
   * advancing until an explicit stop(). Used by free-form recording so the
   * user records for as long as they like. Cleared automatically on stop().
   */
  setOpenEnded(openEnded: boolean): void {
    this._openEnded = openEnded
  }

  stop(): void {
    this._stopAnimationLoop()
    this.audioEngine.stopAllNotes()
    this.isPlaying = false
    this.isPaused = false
    this._openEnded = false
    this.pendingStartBeat = 0

    // Reset pause tracking so a fresh start() after stop isn't poisoned
    this.pauseStartTime = 0
    this.pauseOffset = 0

    // During precount, only reset playback state, not count-in state
    if (this._countInBeats > 0) {
      // Preserve countInBeat so precount doesn't reset to 0
      this.currentBeat = 0
      this.currentNoteIndices.clear()
      this.playStartTime = 0
      this.metronomeLastBeat = -1
      this.metronomeLastCountInBeat = -1
    } else {
      // Fresh stop - reset everything
      this.currentBeat = 0
      this.currentNoteIndices.clear()
      this.playStartTime = 0
      this.countInBeat = 0
      this._countInBeats = 0
      this.countInCompleteEmitted = false
    }

    this._emit({ type: 'state', state: 'stopped' })
  }

  seekTo(beat: number): void {
    // Clamp to melody end so the user can't drag the playhead past the
    // last note (caller may also pre-clamp, but we defensively re-clamp
    // here so external callers like the piano-roll's ruler can rely on
    // sane bounds).
    const melodyEnd = this._getTotalBeats(this._melody)
    const upperBound = Math.max(this._durationBeats, melodyEnd)
    const target = Math.max(
      0,
      upperBound > 0 ? Math.min(beat, upperBound) : beat,
    )
    const beatDuration = 60000 / this._bpm
    const countInMs = (this._countInBeats || 0) * beatDuration

    if (this.isPlaying && !this.isPaused) {
      // PLAYING → stop audio, rebase the wall-clock origin so the next
      // animation tick computes elapsed = target*beatDuration (i.e.
      // resumes mid-melody at `target`), then restart the animation
      // loop without the fresh-start branch in start() (which would
      // zero everything out).
      this._stopAnimationLoop()
      this.audioEngine.stopAllNotes()
      this.currentBeat = target
      this.currentNoteIndices.clear()
      // Pretend playback started in the past so `now - playStartTime
      // - pauseOffset === target*beatDuration + countInMs`.
      this.playStartTime =
        performance.now() - (target * beatDuration + countInMs)
      this.pauseOffset = 0
      this.pauseStartTime = 0
      this.metronomeLastBeat = -1
      this._emit({ type: 'beat', beat: target })
      this._startAnimationLoop()
      return
    }

    if (this.isPaused) {
      // PAUSED → also rebase playStartTime so when the user hits
      // resume() (which computes pauseOffset from pauseStartTime), the
      // animation tick produces elapsed=target*beatDuration. Without
      // this rebase the playhead jumped back to the pre-seek position
      // on resume — exact bug the user reported.
      this.currentBeat = target
      this.currentNoteIndices.clear()
      const now = performance.now()
      // Effective elapsed when paused = pauseStartTime - playStartTime
      //                                  - pauseOffset
      // We want that to equal target*beatDuration + countInMs. Solve
      // for playStartTime, treating pauseStartTime as "now" for the
      // purposes of this snapshot (we leave pauseOffset unchanged so
      // the eventual resume math still works).
      this.pauseStartTime = now
      this.playStartTime =
        now - (target * beatDuration + countInMs) - this.pauseOffset
      this.metronomeLastBeat = -1
      this._emit({ type: 'beat', beat: target })
      return
    }

    // Stopped: relocate the head — and remember it as the start position
    // for the next start(), which would otherwise snap back to beat 0
    // (mirrors the Piano/Guitar seek-then-play behaviour).
    this.currentBeat = target
    this.pendingStartBeat = target
    this._emit({ type: 'beat', beat: target })
  }

  /**
   * Set count-in beats (0-4). Count-in is shown before playback starts.
   */
  setCountIn(beats: number): void {
    this._countInBeats = Math.max(0, Math.min(4, beats))
  }

  getCountIn(): number {
    return this._countInBeats
  }

  /**
   * Check if BPM has changed and adjust playStartTime to maintain beat position.
   * This prevents the playhead from jumping when the BPM slider is changed during playback.
   */
  private _handleBpmChange(): void {
    const newBpm = this.getBPM()
    if (newBpm === this._lastBpm) return

    // Only adjust if we're playing and not in count-in phase
    if (!this.isPlaying || this.isPaused || this._countInBeats > 0) {
      this._lastBpm = newBpm
      return
    }

    // We're in the melody playback phase and BPM has changed.
    // Adjust playStartTime to maintain the same beat position.
    const now = performance.now()
    const beatDurationOld = 60000 / this._lastBpm
    const beatDurationNew = 60000 / newBpm

    // Current elapsed time (playing time only, not including count-in)
    const elapsedMs = now - this.playStartTime - this.pauseOffset

    // Current beat position (before count-in adjustment)
    const currentBeat = elapsedMs / beatDurationOld

    // Calculate new playStartTime to keep currentBeat the same with new BPM
    // beat = (now - newPlayStartTime - pauseOffset) / beatDurationNew
    // newPlayStartTime = now - pauseOffset - beat * beatDurationNew
    const countInMsAdjusted = (this._countInBeats || 0) * beatDurationNew
    this.playStartTime =
      now - this.pauseOffset - countInMsAdjusted - currentBeat * beatDurationNew

    this._lastBpm = newBpm
  }

  /**
   * Sync BPM from AudioEngine and handle playback timing adjustments
   */
  private _syncBpm(): void {
    const newBpm = this.getBPM()
    if (newBpm !== this._lastBpm) {
      this._handleBpmChange()
    }
  }

  setMetronomeEnabled(enabled: () => boolean): void {
    this.metronomeEnabled = enabled
  }

  setMelody(melody: MelodyItem[]): void {
    // Create shallow copy to prevent mutation cascade.
    // NOTE: deliberately does NOT clear pendingStartBeat — the play path
    // re-sets the (same) melody right before start(), which must still
    // honour a seek made while stopped. Callers that genuinely swap songs
    // use clearPendingStart().
    this._melody = [...melody]
  }

  /** Drop a stopped-state seek position (the loaded song changed). */
  clearPendingStart(): void {
    this.pendingStartBeat = 0
  }

  setDurationBeats(beats: number): void {
    this._durationBeats = Math.max(0, beats)
  }

  /**
   * Get current BPM from AudioEngine (which reads from appStore)
   */
  getBPM(): number {
    return this.audioEngine.getBpm?.() || 120
  }

  getMelody(): MelodyItem[] {
    return this._melody
  }

  // ── Private Implementation ─────────────────────────────────

  private _startAnimationLoop(): void {
    const countIn = this._countInBeats > 0 ? this._countInBeats : 0

    const animate = () => {
      if (!this.isPlaying || this.isPaused) return

      // Check for BPM changes and adjust playStartTime if needed
      this._syncBpm()

      const now = performance.now()
      const beatDuration = 60000 / this._bpm
      // Calculate elapsed time, freezing during pauses by subtracting the
      // accumulated pause duration from the wall-clock delta.
      //
      // BUG FIX: previously this used `+ pauseOffset`, which made elapsed
      // jump *forward* by the duration of every pause on resume — i.e.
      // playback continued from "too far" after Play -> Pause -> wait ->
      // Resume. The correct sign is `-`: pauseOffset stores the total
      // milliseconds spent paused; subtracting it from (now - playStartTime)
      // gives the actual playing-time elapsed.
      const elapsed = now - this.playStartTime - this.pauseOffset

      // Count-in phase: play count-in beats before actual melody
      if (countIn > 0 && elapsed < countIn * beatDuration) {
        const elapsedBeats = elapsed / beatDuration
        const currentBeat = countIn - Math.floor(elapsedBeats)
        const currentInt = Math.floor(currentBeat)

        // Emit the initial count-in value (at start) and then each countdown step
        // Don't emit 0 so the UI shows 4-3-2-1 then disappears
        if (currentInt !== this.countInBeat || elapsed === 0) {
          this.countInBeat = currentInt
          // Only emit if countIn > 0 (so we show 4-3-2-1, not 0)
          if (currentInt > 0) {
            this._emit({ type: 'countIn', countIn: currentInt })
          }
        }

        // Emit continuous negative beat value on every frame during count-in
        // so the piano roll playhead smoothly approaches from the left (Issue #31).
        this._emit({ type: 'beat', beat: elapsedBeats - countIn })

        // Play metronome click during count-in (4, 3, 2, 1)
        // Precount is a metronome feature - always play regardless of metronome setting
        const isDownbeat = currentInt % 4 === 0
        // Only play metronome if countIn > 0
        if (currentInt > 0 && currentInt !== this.metronomeLastCountInBeat) {
          this.metronomeLastCountInBeat = currentInt
          // Emit metronome event for UI feedback
          this._emit({
            type: 'metronome',
            beat: currentInt,
            isDownbeat,
            isCountIn: true,
          })
        }

        this.animationFrameId = requestAnimationFrame(animate)
      } else {
        // Count-in phase finished - emit completion event
        if (countIn > 0 && !this.countInCompleteEmitted) {
          this.countInCompleteEmitted = true
          this._emit({ type: 'countInComplete' })
        }

        const melodyElapsed = Math.max(0, elapsed - countIn * beatDuration)
        const beat = melodyElapsed / beatDuration

        const intBeat = Math.floor(beat)

        // Check if metronome click should play
        const shouldPlayMetronome = this.metronomeEnabled?.() ?? false
        const isDownbeat = intBeat % 4 === 0

        if (
          intBeat !== this.metronomeLastBeat &&
          this.metronomeLastBeat >= 0 &&
          shouldPlayMetronome
        ) {
          this._emit({
            type: 'metronome',
            beat: intBeat,
            isDownbeat,
            isCountIn: false,
          })
        }
        this.metronomeLastBeat = intBeat

        const melody = this._melody ?? []
        const newIndices = new Set(melodyIndicesAtBeat(melody, beat))

        // Emit noteEnd for notes that are no longer active
        for (const idx of this.currentNoteIndices) {
          if (!newIndices.has(idx)) {
            const item = melody[idx]
            if (item != null && item.isRest !== true) {
              this._emit({
                type: 'noteEnd',
                note: item,
                index: idx,
              })
              this._playNoteEnd()
            }
          }
        }

        // Emit noteStart for newly active notes
        for (const idx of newIndices) {
          if (!this.currentNoteIndices.has(idx)) {
            const item = melody[idx]
            if (item != null && item.isRest !== true) {
              this._emit({
                type: 'noteStart',
                note: item,
                index: idx,
              })
              this._playNoteStart()
            }
          }
        }

        this.currentNoteIndices = newIndices

        this.currentBeat = beat
        this._emit({ type: 'beat', beat })

        const totalBeats = Math.max(
          this._durationBeats,
          this._getTotalBeats(melody),
        )
        // In open-ended (recording) mode the playhead keeps advancing past the
        // arrangement end until the user explicitly stops.
        if (!this._openEnded && beat >= totalBeats) {
          this._emit({ type: 'complete' })
          this.stop()
          return
        }

        this.animationFrameId = requestAnimationFrame(animate)
      }
    }

    this.animationFrameId = requestAnimationFrame(animate)
  }

  private _stopAnimationLoop(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId)
      this.animationFrameId = null
    }
  }

  private _emit(event: PlaybackEvent): void {
    this.callbacks.onEvent?.(event)
    this.onEventCallbacks.get(event.type)?.forEach((h) => h(event as never))

    switch (event.type) {
      case 'state':
        break
      case 'beat':
        this.callbacks.onBeatUpdate?.(event.beat!)
        break
      case 'noteStart':
        this.callbacks.onNoteStart?.(event.note!, event.index!)
        break
      case 'noteEnd':
        this.callbacks.onNoteEnd?.(event.note!, event.index!)
        break
      case 'complete':
        this.callbacks.onComplete?.()
        break
    }
  }

  // Note audio is handled via event handlers in App.tsx — do not call
  // audioEngine.playTone/stopTone here to avoid duplicate playback
  private _playNoteStart(): void {
    // State tracking only — audio triggered by noteStart event in App.tsx
  }

  private _playNoteEnd(): void {
    // State tracking only — audio stopped by noteEnd event in App.tsx
  }

  // ── Config Accessors ───────────────────────────────────────

  get _bpm(): number {
    const bpm = this.audioEngine.getBpm?.()
    return bpm !== undefined && bpm > 0 ? bpm : 120
  }

  set _bpm(bpm: number) {
    const audioEngine = this.audioEngine as unknown as {
      setBpm?: (bpm: number) => void
    }
    audioEngine.setBpm?.(bpm)
  }

  // ── Cleanup ───────────────────────────────────────────────

  destroy(): void {
    this.stop()
    if (this.ownsAudioEngine) {
      this.audioEngine.destroy()
    }
  }
}
