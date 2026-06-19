// ============================================================
// KaraokePlaylistOverlay — "get ready" card + countdown before each song
// ============================================================

import type { Accessor, Component } from 'solid-js'
import { createEffect, createSignal, onCleanup, Show } from 'solid-js'
import { beginCurrentSong, currentIndex, currentSong, nextSong, phase, prev, queue, stopPlaylist, } from '@/stores/karaoke-playlist-store'
import { ChevronLeft, Mic, Play, SkipForward, X } from './icons'
import styles from './KaraokePlaylistOverlay.module.css'

interface KaraokePlaylistOverlayProps {
  /** Enable the mic (user gesture) then start the countdown. */
  onStart: () => void
  /** Skip the current song without playing it. */
  onSkip: () => void
  /** Duration of the loaded song in seconds, if known. */
  durationSec: Accessor<number>
  /** Whether stems are still loading (disables Start). */
  loading: Accessor<boolean>
}

function formatDuration(sec: number): string {
  if (!sec || !isFinite(sec)) return '--:--'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export const KaraokePlaylistOverlay: Component<KaraokePlaylistOverlayProps> = (
  props,
) => {
  const [count, setCount] = createSignal(4)
  let timer: ReturnType<typeof setInterval> | undefined

  const clearTimer = () => {
    if (timer) {
      clearInterval(timer)
      timer = undefined
    }
  }
  onCleanup(clearTimer)

  // Drive the 4-3-2-1-Go countdown whenever we enter the 'countdown' phase.
  createEffect(() => {
    if (phase() === 'countdown') {
      clearTimer()
      setCount(4)
      timer = setInterval(() => {
        setCount((c) => {
          if (c <= 1) {
            clearTimer()
            beginCurrentSong()
            return 0
          }
          return c - 1
        })
      }, 800)
    } else {
      clearTimer()
    }
  })

  return (
    <Show when={phase() === 'ready' || phase() === 'countdown'}>
      <div class={styles.overlay}>
        <div class={styles.card}>
          <button
            class={styles.closeBtn}
            title="Stop playlist"
            onClick={() => stopPlaylist()}
          >
            <X />
          </button>

          <Show
            when={phase() === 'ready'}
            fallback={
              <div class={styles.countdown}>
                <Show
                  when={currentSong()?.singerName}
                  fallback={<div class={styles.countReady}>Get ready!</div>}
                >
                  <div class={styles.countReady}>
                    Are you ready,{' '}
                    <span class={styles.countSinger}>
                      {currentSong()!.singerName}
                    </span>
                    ?
                  </div>
                </Show>
                <div class={styles.countNumber}>
                  {count() > 0 ? count() : 'Go!'}
                </div>
                <div class={styles.countSong}>{currentSong()?.songTitle}</div>
              </div>
            }
          >
            <div class={styles.position}>
              Song {currentIndex() + 1} of {queue().length}
            </div>

            {/* Thumbnail slot (placeholder for v1) */}
            <div class={styles.thumb} aria-hidden="true">
              <Mic />
            </div>

            <h2 class={styles.songTitle}>
              {currentSong()?.songTitle ?? 'Unknown'}
            </h2>

            <div class={styles.meta}>
              <Show when={currentSong()?.singerName}>
                <span class={styles.singer}>{currentSong()!.singerName}</span>
              </Show>
              <Show when={currentSong()?.groupName}>
                <span class={styles.group}>{currentSong()!.groupName}</span>
              </Show>
              <span class={styles.duration}>
                {formatDuration(props.durationSec())}
              </span>
            </div>

            <button
              class={styles.startBtn}
              disabled={props.loading()}
              onClick={() => props.onStart()}
            >
              <Show when={!props.loading()} fallback={'Loading…'}>
                <Play /> Start
              </Show>
            </button>

            <div class={styles.controls}>
              <button
                class={styles.secondaryBtn}
                disabled={currentIndex() === 0}
                onClick={() => prev()}
                title="Previous song"
              >
                <ChevronLeft /> Prev
              </button>
              <button
                class={styles.secondaryBtn}
                onClick={() => props.onSkip()}
                title="Skip this song"
              >
                Skip <SkipForward />
              </button>
            </div>

            <Show when={nextSong()}>
              <div class={styles.nextUp}>
                Next: <strong>{nextSong()!.songTitle}</strong>
                <Show when={nextSong()!.singerName}>
                  {' — '}
                  {nextSong()!.singerName}
                </Show>
              </div>
            </Show>
          </Show>
        </div>
      </div>
    </Show>
  )
}
