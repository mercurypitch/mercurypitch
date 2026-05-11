// ============================================================
// TransportControls — Play/Reset buttons
// ============================================================

import type { Component } from 'solid-js'
import { createMemo } from 'solid-js'
import { playback } from '@/stores/playback-store'

interface TransportControlsProps {
  onPlay: () => void
  onReset: () => void
  disabled?: boolean
}

export const TransportControls: Component<TransportControlsProps> = (props) => {
  const handlePlayClick = () => {
    if (props.disabled != null) return
    const state = playback.state()
    if (state === 'stopped') {
      playback.startPlayback()
    } else if (state === 'playing') {
      playback.pausePlayback()
    } else {
      playback.continuePlayback()
    }
    props.onPlay()
  }

  const handleResetClick = () => {
    playback.resetPlayback()
    props.onReset()
  }

  const playLabel = createMemo(() => playback.playButtonLabel())
  const resetEnabled = createMemo(() => playback.resetEnabled())

  return (
    <>
      <button
        id="btn-play"
        class="ctrl-btn"
        onClick={handlePlayClick}
        disabled={props.disabled}
        title={`${playLabel()} playback`}
      >
        {playLabel() === 'Pause' ? (
          <svg viewBox="0 0 24 24" width="18" height="18">
            <path fill="currentColor" d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" width="18" height="18">
            <path fill="currentColor" d="M8 5v14l11-7z" />
          </svg>
        )}
        <span>{playLabel()}</span>
      </button>
      <button
        id="btn-reset"
        class="ctrl-btn"
        onClick={handleResetClick}
        disabled={!resetEnabled() || props.disabled}
        title="Reset playback"
      >
        <svg viewBox="0 0 24 24" width="18" height="18">
          <path fill="currentColor" d="M6 6h12v12H6z" />
        </svg>
        <span>Reset</span>
      </button>
    </>
  )
}
