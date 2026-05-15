// ============================================================
// FocusMode — full-screen minimal practice UI (GH #123)
// ============================================================

import type { Component } from 'solid-js'
import { createMemo, Show } from 'solid-js'
import { PitchCanvas } from '@/components/PitchCanvas'
import { PrecCountButton } from '@/components/PrecCountButton'
import { Tooltip } from '@/components/Tooltip'
import { melodyTotalBeats } from '@/lib/scale-data'
import { countIn, currentSessionItemRepeat, exitFocusMode, keyName, playbackSpeed, scaleType, sessionActive, sessionItemIndex, setPlaybackSpeed, settings, } from '@/stores'
import { melodyStore } from '@/stores/melody-store'
import { setTonicAnchor } from '@/stores/settings-store'
import type { MelodyItem, PitchSample } from '@/types'
import type { NoteResult, PitchResult, PracticeResult } from '@/types'

interface FocusModeProps {
  isPlaying: () => boolean
  isPaused: () => boolean
  currentPitch: () => PitchResult | null
  pitchHistory: () => PitchSample[]
  noteResults: () => NoteResult[]
  practiceResult: () => PracticeResult | null
  liveScore: () => number | null
  countInBeat: () => number
  isCountingIn: () => boolean
  currentBeat: () => number
  currentNoteIndex?: () => number
  melody: () => MelodyItem[]
  onPlay: () => void
  onPause: () => void
  onResume: () => void
  onStop: () => void
}

const SPEED_STEPS = [0.25, 0.5, 0.75, 1.0, 1.5, 2.0]

export const FocusMode: Component<FocusModeProps> = (props) => {
  const keyDisplay = createMemo(() => `${keyName()} ${scaleType()}`)

  const totalBeats = createMemo(() => melodyTotalBeats(props.melody()))
  const totalBars = createMemo(() => Math.ceil(totalBeats() / 4))
  const currentBar = createMemo(() => {
    const beat = Math.max(1, props.currentBeat())
    const bar = Math.floor(beat / 4) + 1
    return Math.min(bar, totalBars())
  })
  const progress = createMemo(() => {
    const beats = props.currentBeat()
    const total = totalBeats()
    return total > 0 ? Math.min(100, (beats / total) * 100) : 0
  })

  // Reactive playhead position to ensure smooth updates during playback
  const playheadPosition = createMemo(() => {
    const total = Math.max(1, totalBeats())
    const cBeat = props.currentBeat()
    const ci = countIn()

    // Same smooth count-in transition as PitchCanvas beatToX
    const TRANSITION_ZONE = 0.5
    let effectiveCi = ci
    if (ci > 0) {
      if (cBeat <= -TRANSITION_ZONE) {
        effectiveCi = ci
      } else if (cBeat >= TRANSITION_ZONE) {
        effectiveCi = 0
      } else {
        const t = (cBeat + TRANSITION_ZONE) / (2 * TRANSITION_ZONE)
        const eased = 1 - Math.pow(1 - t, 3)
        effectiveCi = ci * (1 - eased)
      }
    }

    const rangeStart = -effectiveCi
    const rangeBeats = total - rangeStart
    const xPct = ((cBeat - rangeStart) / Math.max(1, rangeBeats)) * 100

    return Math.max(0, Math.min(100, xPct))
  })

  // Session info
  const isSession = createMemo(() => sessionActive())
  const sessionItem = createMemo(() => sessionItemIndex())
  const sessionRepeat = createMemo(() => currentSessionItemRepeat())

  // Calculate pitch dot position based on current pitch frequency
  const pitchDotPosition = createMemo(() => {
    const pitch = props.currentPitch()
    if (pitch && pitch.freq && pitch.freq > 0) {
      // Use freqToY-like calculation to get normalized position (0-100)
      const scale = melodyStore.currentScale()
      if (scale.length > 0) {
        const minFreq = Math.min(...scale.map((n) => n.freq)) * 0.82
        const maxFreq = Math.max(...scale.map((n) => n.freq)) * 1.22
        const logMin = Math.log2(minFreq)
        const logMax = Math.log2(maxFreq)
        const logFreq = Math.log2(pitch.freq)
        const pct = (logFreq - logMin) / (logMax - logMin)
        return Math.max(0, Math.min(100, pct * 100))
      }
    }
    // Return middle position when no active pitch
    return 50
  })

  // Playback speed
  const currentSpeedIndex = createMemo(() => {
    const speed = playbackSpeed()
    const idx = SPEED_STEPS.indexOf(speed)
    return idx >= 0 ? idx : 3 // default to 1.0x
  })

  const speedUp = () => {
    const idx = currentSpeedIndex()
    if (idx < SPEED_STEPS.length - 1) {
      setPlaybackSpeed(SPEED_STEPS[idx + 1])
    }
  }

  const speedDown = () => {
    const idx = currentSpeedIndex()
    if (idx > 0) {
      setPlaybackSpeed(SPEED_STEPS[idx - 1])
    }
  }

  return (
    <div class="focus-mode">
      {/* Top stats bar */}
      <div class="focus-topbar">
        <div class="focus-topbar-left">
          <span class="focus-key-badge">{keyDisplay()}</span>
          <Show when={isSession()}>
            <span class="focus-session-badge">
              Run {sessionItem() + 1}
              <Show when={sessionRepeat() > 0}>
                <span class="focus-repeat-count"> ×{sessionRepeat() + 1}</span>
              </Show>
            </span>
          </Show>
        </div>

        <div class="focus-topbar-center">
          <div class="focus-progress-container">
            <div class="focus-progress-bar">
              <div
                class="focus-progress-fill"
                style={{ width: `${progress()}%` }}
              />
            </div>
            <span class="focus-progress-label">
              Bar {Math.max(1, currentBar())} / {totalBars()}
            </span>
          </div>
        </div>

        <div class="focus-topbar-right">
          <Show when={props.liveScore() !== null}>
            <span class="focus-score">
              {Math.round(props.liveScore() ?? 0)}
              <span class="focus-score-unit">pts</span>
            </span>
          </Show>
        </div>
      </div>

      {/* History canvas — thin strip below top bar */}
      <div id="history-container" class="focus-history" />

      {/* Main pitch canvas fills remaining space */}
      <div class="focus-canvas">
        <PitchCanvas
          melody={props.melody}
          scale={() => melodyStore.currentScale()}
          totalBeats={totalBeats}
          currentBeat={props.currentBeat}
          pitchHistory={props.pitchHistory}
          currentNoteIndex={props.currentNoteIndex ?? (() => 0)}
          isPlaying={props.isPlaying}
          isPaused={props.isPaused}
          isScrolling={() => false}
          countInBeats={() => countIn()}
          targetPitch={() => {
            const idx = props.currentNoteIndex?.() ?? 0
            const items = props.melody()
            if (idx >= 0 && idx < items.length) {
              return items[idx].note.freq
            }
            return null
          }}
        />
        <div
          id="playhead"
          class="focus-playhead"
          style={{
            display: props.isPlaying() || props.isPaused() ? 'block' : 'none',
            left: `${playheadPosition()}%`,
          }}
        >
          {/* Glowing pitch dot with dynamic vertical position */}
          <div
            class="focus-pitch-dot"
            style={{ '--pitch-position': `${pitchDotPosition()}%` }}
          />
        </div>
      </div>

      {/* Bottom floating toolbar */}
      <div class="focus-toolbar">
        {/* Exit button */}
        <button
          class="focus-exit"
          onClick={() => {
            exitFocusMode()
          }}
          title="Exit Focus Mode"
          aria-label="Exit Focus Mode"
        >
          <svg viewBox="0 0 24 24" width="20" height="20">
            <path
              fill="currentColor"
              d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
            />
          </svg>
        </button>

        {/* Play/Pause — shown when stopped */}
        <Show when={!props.isPlaying() && !props.isPaused()}>
          <button
            class="focus-play"
            onClick={() => props.onPlay()}
            title="Play"
            aria-label="Play"
          >
            <svg viewBox="0 0 24 24" width="24" height="24">
              <path fill="currentColor" d="M8 5v14l11-7z" />
            </svg>
          </button>
        </Show>

        <Show when={props.isPlaying()}>
          <button
            class="focus-play"
            onClick={() => props.onPause()}
            title="Pause"
            aria-label="Pause"
          >
            <svg viewBox="0 0 24 24" width="24" height="24">
              <path fill="currentColor" d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
            </svg>
          </button>
        </Show>

        <Show when={props.isPaused()}>
          <button
            class="focus-play"
            onClick={() => props.onResume()}
            title="Continue"
            aria-label="Continue"
          >
            <svg viewBox="0 0 24 24" width="24" height="24">
              <path fill="currentColor" d="M8 5v14l11-7z" />
            </svg>
          </button>
        </Show>

        {/* Precount + Anchor Tone */}
        <div
          class="focus-toggles"
          style={{
            display: 'flex',
            gap: '0.5rem',
            'align-items': 'center',
            'margin-left': '1rem',
            'margin-right': 'auto',
          }}
        >
          <PrecCountButton />
          <Tooltip text="Anchor Tone">
            <button
              class={`ctrl-btn anchor-tone-btn ${settings().tonicAnchor === true ? 'active' : ''}`}
              onClick={() => setTonicAnchor(settings().tonicAnchor !== true)}
              title={
                settings().tonicAnchor === true
                  ? 'Anchor Tone: On'
                  : 'Anchor Tone: Off'
              }
              aria-label={
                settings().tonicAnchor === true
                  ? 'Anchor Tone: On'
                  : 'Anchor Tone: Off'
              }
            >
              <svg viewBox="0 0 24 24" width="16" height="16">
                <path
                  fill="currentColor"
                  d="M12 3l-8 13h16L12 3zm0 3.5L17.5 13h-11L12 6.5z"
                />
                <circle cx="12" cy="14" r="1" fill="currentColor" />
              </svg>
            </button>
          </Tooltip>
        </div>

        {/* Playback speed controls */}
        <div class="focus-speed-controls">
          <button
            class="focus-speed-btn"
            onClick={speedUp}
            disabled={currentSpeedIndex() === SPEED_STEPS.length - 1}
            title="Faster"
            aria-label="Faster"
          >
            <svg viewBox="0 0 24 24" width="16" height="16">
              <path
                fill="currentColor"
                d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z"
              />
            </svg>
          </button>
          <span class="focus-speed-label">{playbackSpeed().toFixed(2)}x</span>
          <button
            class="focus-speed-btn"
            onClick={speedDown}
            disabled={currentSpeedIndex() === 0}
            title="Slower"
            aria-label="Slower"
          >
            <svg viewBox="0 0 24 24" width="16" height="16">
              <path
                fill="currentColor"
                d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
