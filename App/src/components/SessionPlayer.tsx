// ============================================================
// SessionPlayer — Inline session progress UI
// Shows session name, item progress, elapsed time, skip/end controls
// ============================================================

import type { Component } from 'solid-js'
import { createSignal, onCleanup, onMount, Show } from 'solid-js'
import { appStore } from '@/stores/app-store'

interface SessionPlayerProps {
  onSkip: () => void
  onEnd: () => void
}

export const SessionPlayer: Component<SessionPlayerProps> = (props) => {
  const [elapsed, setElapsed] = createSignal(0)
  let startTime = Date.now()
  let timer: ReturnType<typeof setInterval> | undefined

  const startTimer = () => {
    startTime = Date.now()
    setElapsed(0)
    timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000))
    }, 1000)
  }

  onMount(() => {
    startTimer()
  })

  onCleanup(() => {
    if (timer) clearInterval(timer)
  })

  const session = () => appStore.practiceSession()
  const itemIndex = () => appStore.sessionItemIndex()
  const currentItem = () => appStore.getCurrentSessionItem()

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  return (
    <div class="session-player">
      <div class="session-player-header">
        <div class="session-player-title">
          <svg viewBox="0 0 24 24" width="16" height="16">
            <path
              fill="currentColor"
              d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"
            />
          </svg>
          {session()?.name ?? 'Session'}
        </div>
        <Show when={session()}>
          <span class="session-player-progress">
            Item {itemIndex() + 1} of {session()!.items.length}
          </span>
        </Show>
      </div>

      <div class="session-player-item">
        <div class="session-item-icon">
          <svg viewBox="0 0 24 24" width="14" height="14">
            <path
              fill="currentColor"
              d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"
            />
          </svg>
        </div>
        <span class="session-item-label">
          {currentItem()?.label ?? 'Loading...'}
        </span>
      </div>

      <div class="session-player-timer">
        <span class="session-elapsed">{formatTime(elapsed())}</span>
      </div>

      <div class="session-player-controls">
        <button
          class="ctrl-btn session-skip-btn"
          onClick={props.onSkip}
          title="Skip this item"
        >
          Skip
        </button>
        <button
          class="ctrl-btn session-end-btn"
          onClick={props.onEnd}
          title="End session"
        >
          End
        </button>
      </div>
    </div>
  )
}
