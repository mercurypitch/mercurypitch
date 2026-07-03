// ============================================================
// SingingStatusBar — the singing page's slim glass strip above
// the canvas: scale + melody + tempo + bar.beat on the left, the
// live session/playback state in the middle (absorbing the old
// green SessionPlayer banner: elapsed time, session item
// progress, skip/end), and import actions on the right. Shares
// the visual language (and stylesheet) of the Piano/Guitar bars.
// ============================================================

import type { Component } from 'solid-js'
import { createEffect, createSignal, on, onCleanup, Show } from 'solid-js'
import barStyles from '@/components/shared/status-bar/SongStatusBar.module.css'
import { getCurrentSessionItem, practiceSession, sessionActive, sessionItemIndex, sessionMode, } from '@/stores'

interface SingingStatusBarProps {
  keyName: () => string
  scaleType: () => string
  melodyName: () => string | null
  bpm: () => number
  currentBeat: () => number
  /** Live singing-playback signal (the controller's, not the dead store one). */
  isPlaying: () => boolean
  onImportMidi: () => void
  onSessionSkip: () => void
  onSessionEnd: () => void
}

const titleCase = (s: string): string =>
  s.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

// 0-based float beat → 1-based "bar.beat" (4/4), like Guitar 3D's Tab3DHud.
const barBeat = (b: number): string => {
  const beat = Math.max(0, b)
  return `${Math.floor(beat / 4) + 1}.${Math.floor(beat % 4) + 1}`
}

const formatElapsed = (s: number): string => {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${sec.toString().padStart(2, '0')}`
}

const ClockIcon = () => (
  <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true">
    <path
      fill="currentColor"
      d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"
    />
  </svg>
)

export const SingingStatusBar: Component<SingingStatusBarProps> = (props) => {
  const scaleLabel = () => `${props.keyName()} ${titleCase(props.scaleType())}`
  const session = () => practiceSession()
  const isSequence = () => sessionMode()
  const currentItem = () => getCurrentSessionItem()

  // Wall-clock elapsed while a session/playback run is live (the old
  // SessionPlayer banner's timer, folded into the bar).
  const [elapsed, setElapsed] = createSignal(0)
  let timer: ReturnType<typeof setInterval> | undefined
  createEffect(
    on(sessionActive, (active) => {
      if (timer !== undefined) clearInterval(timer)
      timer = undefined
      setElapsed(0)
      if (active) {
        const startTime = Date.now()
        timer = setInterval(() => {
          setElapsed(Math.floor((Date.now() - startTime) / 1000))
        }, 1000)
      }
    }),
  )
  onCleanup(() => {
    if (timer !== undefined) clearInterval(timer)
  })

  return (
    <div
      class={barStyles.bar}
      classList={{ [barStyles.dimmed]: props.isPlaying() && !sessionActive() }}
      data-testid="singing-status-bar"
    >
      <div class={barStyles.info} title={scaleLabel()}>
        <span>{scaleLabel()}</span>
        <Show when={props.melodyName()}>
          {(name) => (
            <>
              <span class={barStyles.infoDot}>·</span>
              <span class={barStyles.infoSecondary} title={name()}>
                {name()}
              </span>
            </>
          )}
        </Show>
      </div>
      <div class={barStyles.infoMeta}>
        <span>{props.bpm()} BPM</span>
        <span class={barStyles.infoDot}>·</span>
        <span class={barStyles.infoPos}>{barBeat(props.currentBeat())}</span>
      </div>

      {/* Live session / playback cluster (the old green banner). */}
      <Show when={sessionActive()}>
        <div class={barStyles.sessionCluster} data-testid="session-player">
          <span
            class={barStyles.sessionTitle}
            data-testid="session-player-title"
          >
            <ClockIcon />
            {isSequence()
              ? (session()?.name ?? 'Session')
              : (props.melodyName() ?? 'Melody')}
          </span>
          <Show when={isSequence() && session()}>
            <span
              class={barStyles.sessionMeta}
              data-testid="session-player-progress"
            >
              Item {sessionItemIndex() + 1} of {session()!.items.length}
            </span>
          </Show>
          <Show when={isSequence()}>
            <span
              class={barStyles.sessionItem}
              classList={{
                [barStyles.sessionItemRest]: currentItem()?.type === 'rest',
              }}
              data-testid="session-player-item"
            >
              {currentItem()?.type === 'rest'
                ? `Rest — ${currentItem()?.label ?? 'pause'}`
                : (currentItem()?.label ?? 'Loading...')}
            </span>
          </Show>
          <span class={barStyles.sessionElapsed} data-testid="session-elapsed">
            {formatElapsed(elapsed())}
          </span>
          <Show when={isSequence()}>
            <button
              class={barStyles.chipBtn}
              data-testid="session-skip-btn"
              onClick={() => props.onSessionSkip()}
              title="Skip this item"
            >
              Skip
            </button>
            <button
              class={barStyles.chipBtn}
              data-testid="session-end-btn"
              onClick={() => props.onSessionEnd()}
              title="End the session"
            >
              End
            </button>
          </Show>
        </div>
      </Show>

      <div class={barStyles.actions}>
        <button
          class={barStyles.chipBtn}
          onClick={() => props.onImportMidi()}
          title="Import a MIDI melody (or drop a .mid file on the canvas)"
        >
          Import MIDI
        </button>
      </div>
    </div>
  )
}
