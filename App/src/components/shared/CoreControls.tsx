// ============================================================
// CoreControls - Shared playback control buttons (play, pause, stop)
// ============================================================

import type { Component } from 'solid-js'
import type { PlayButtonLabel } from '@/stores/playback-store'

interface CoreControlsProps {
  isPlaying: () => boolean
  isPaused: () => boolean
  onPlay: () => void
  onPause: () => void
  onResume: () => void
  onStop: () => void
  playButtonLabel: () => PlayButtonLabel
}

export const CoreControls: Component<CoreControlsProps> = (props) => {
  const isActive = () => props.isPlaying() || props.isPaused()
  const isStopped = () => !props.isPlaying() && !props.isPaused()

  const handlePlayClick = () => {
    if (isStopped()) {
      props.onPlay()
    } else if (props.isPlaying()) {
      props.onPause()
    } else {
      props.onResume()
    }
  }

  const handleStopClick = () => {
    props.onStop()
  }

  const playLabel = props.playButtonLabel()

  return (
    <div class="essential-control-group">
      <Show when={isStopped()}>
        <button
          class="ctrl-btn play-btn"
          onClick={handlePlayClick}
          title="Play"
        >
          <svg viewBox="0 0 24 24" width="16" height="16">
            <path fill="currentColor" d="M8 5v14l11-7z" />
          </svg>
          {playLabel}
        </button>
      </Show>

      <Show when={props.isPlaying()}>
        <button
          class="ctrl-btn stop-btn"
          onClick={handlePlayClick}
          title="Pause"
        >
          <svg viewBox="0 0 24 24" width="16" height="16">
            <path fill="currentColor" d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
          </svg>
          Pause
        </button>
      </Show>

      <Show when={props.isPaused()}>
        <button
          class="ctrl-btn play-btn"
          onClick={handlePlayClick}
          title="Continue"
        >
          <svg viewBox="0 0 24 24" width="16" height="16">
            <path fill="currentColor" d="M8 5v14l11-7z" />
          </svg>
          Continue
        </button>
      </Show>

      <button
        class={`ctrl-btn stop-btn stop ${isActive() ? '' : 'inactive'}`}
        onClick={handleStopClick}
        title="Stop"
      >
        <svg viewBox="0 0 24 24" width="16" height="16">
          <path fill="currentColor" d="M6 6h12v12H6z" />
        </svg>
        Stop
      </button>
    </div>
  )
}
