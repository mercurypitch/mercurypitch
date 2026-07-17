// ============================================================
// KaraokeMobileStage — zen full-screen karaoke for phones
// ============================================================
//
// The Apple-Music-style presentation of the stem mixer: auto-scrolling
// synced lyrics fill the screen, a bottom bar carries the basic transport,
// and a vertical "sing" pill (tap = vocals on/off, drag = vocal level)
// floats above it. Rendered by StemMixer INSTEAD of its desktop tree when
// the karaoke page is viewed on a mobile screen — it reuses the mixer's
// audio + lyrics controllers, so playlists, hydration and demo tracking
// keep working unchanged. No mic/scoring in v1 (the pitch overlay comes
// later); playlists simply advance song to song.

import type { Component } from 'solid-js'
import { createEffect, createMemo, createSignal, For, on, onCleanup, Show, } from 'solid-js'
import { KaraokePlaylistOverlay } from '@/components/KaraokePlaylistOverlay'
import { KaraokePlaylistSummary } from '@/components/KaraokePlaylistSummary'
import { isPlaylistActive, nextSong } from '@/stores/karaoke-playlist-store'
import styles from './KaraokeMobileStage.module.css'

interface ParsedLine {
  time: number
  endTime: number
  words: string[]
  key: string
  wordTimes?: number[]
}

export interface KaraokeMobileStageProps {
  songTitle: string
  onBack?: () => void

  // Audio (stem-mixer audio controller)
  playing: () => boolean
  loading: () => boolean
  loadError: () => string
  elapsed: () => number
  duration: () => number
  onPlay: () => void
  onPause: () => void
  onRestart: () => void
  seekTo: (t: number) => void

  // Vocal pill
  vocal: () => { muted: boolean; volume: number }
  onToggleVocal: () => void
  onVocalVolume: (v: number) => void

  // Lyrics (stem-mixer lyrics controller)
  parsedLyrics: () => Map<number, ParsedLine>
  currentLineIdx: () => number
  lyricsLoading: () => boolean
  computeActiveWord: (
    words: string[],
    startTime: number,
    endTime: number,
    wordTimes: number[] | undefined,
    elapsedTime: number,
  ) => { activeUpTo: number; charProgress: number }
  onLineClick: (idx: number) => void

  // Playlist chrome (only the current playlist song drives the overlay)
  playlistOverlayActive: () => boolean
  onPlaylistStart: () => void
  onPlaylistSkip: () => void
}

const DEFAULT_VOCAL_VOLUME = 0.8

function formatTime(sec: number): string {
  if (!isFinite(sec) || sec < 0) sec = 0
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export const KaraokeMobileStage: Component<KaraokeMobileStageProps> = (
  props,
) => {
  // ── Lyrics ────────────────────────────────────────────────────
  const lines = createMemo(() =>
    [...props.parsedLyrics().entries()].sort((a, b) => a[0] - b[0]),
  )

  let scrollerRef: HTMLDivElement | undefined
  const lineEls = new Map<number, HTMLParagraphElement>()
  onCleanup(() => lineEls.clear())

  // Manual scrolling pauses auto-follow, then it re-locks after a beat.
  const [userScrolled, setUserScrolled] = createSignal(false)
  let scrollIdleTimer: ReturnType<typeof setTimeout> | undefined
  const noteUserScroll = (): void => {
    setUserScrolled(true)
    if (scrollIdleTimer) clearTimeout(scrollIdleTimer)
    scrollIdleTimer = setTimeout(() => setUserScrolled(false), 3500)
  }
  onCleanup(() => {
    if (scrollIdleTimer) clearTimeout(scrollIdleTimer)
  })

  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  const centerLine = (idx: number, smooth: boolean): void => {
    const el = lineEls.get(idx)
    el?.scrollIntoView({
      block: 'center',
      behavior: smooth && !prefersReducedMotion ? 'smooth' : 'auto',
    })
  }

  createEffect(
    on(
      () => props.currentLineIdx(),
      (idx, prev) => {
        if (userScrolled()) return
        centerLine(idx, prev !== undefined)
      },
    ),
  )

  // Word-level progress for the current line only.
  const activeWord = createMemo(() => {
    const entry = props.parsedLyrics().get(props.currentLineIdx())
    if (!entry) return { activeUpTo: -1, charProgress: 0 }
    return props.computeActiveWord(
      entry.words,
      entry.time,
      entry.endTime,
      entry.wordTimes,
      props.elapsed(),
    )
  })

  const seekToLine = (idx: number): void => {
    setUserScrolled(false)
    props.onLineClick(idx)
  }

  // ── Vocal pill (tap = toggle, vertical drag = level) ──────────
  const vocalsOff = (): boolean =>
    props.vocal().muted || props.vocal().volume === 0

  let pillRef: HTMLButtonElement | undefined
  let pillPointerId: number | null = null
  let pillStartY = 0
  let pillStartVolume = 0
  let pillDragged = false

  const pillTapToggle = (): void => {
    const v = props.vocal()
    if (v.muted || v.volume === 0) {
      // Bring the vocals back — restore a sane level if they were dragged out.
      if (v.volume < 0.05) props.onVocalVolume(DEFAULT_VOCAL_VOLUME)
      else props.onToggleVocal()
    } else {
      props.onToggleVocal()
    }
  }

  const onPillPointerDown = (e: PointerEvent): void => {
    pillPointerId = e.pointerId
    pillStartY = e.clientY
    pillStartVolume = vocalsOff() ? 0 : props.vocal().volume
    pillDragged = false
    try {
      pillRef?.setPointerCapture(e.pointerId)
    } catch {
      /* pointer already gone — the move/up guards still match by id */
    }
  }

  const onPillPointerMove = (e: PointerEvent): void => {
    if (pillPointerId !== e.pointerId || !pillRef) return
    const dy = pillStartY - e.clientY
    if (!pillDragged && Math.abs(dy) < 7) return
    pillDragged = true
    const range = pillRef.getBoundingClientRect().height
    const next = Math.max(0, Math.min(1, pillStartVolume + dy / range))
    props.onVocalVolume(next)
  }

  const onPillPointerUp = (e: PointerEvent): void => {
    if (pillPointerId !== e.pointerId) return
    pillPointerId = null
    try {
      pillRef?.releasePointerCapture(e.pointerId)
    } catch {
      /* capture never took */
    }
    if (!pillDragged) pillTapToggle()
  }

  const pillLevel = (): number => (vocalsOff() ? 0 : props.vocal().volume)

  // ── Progress / transport ──────────────────────────────────────
  const [scrub, setScrub] = createSignal<number | null>(null)
  let progressRef: HTMLDivElement | undefined
  let progressPointerId: number | null = null

  const progressPct = (): number => {
    const d = props.duration()
    if (d <= 0) return 0
    const t = scrub() ?? props.elapsed()
    return Math.max(0, Math.min(100, (t / d) * 100))
  }

  const timeFromPointer = (e: PointerEvent): number => {
    const rect = progressRef!.getBoundingClientRect()
    const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left))
    return (x / rect.width) * props.duration()
  }

  const onProgressDown = (e: PointerEvent): void => {
    if (props.duration() <= 0) return
    progressPointerId = e.pointerId
    setScrub(timeFromPointer(e))
    try {
      progressRef?.setPointerCapture(e.pointerId)
    } catch {
      /* pointer already gone — the move/up guards still match by id */
    }
  }
  const onProgressMove = (e: PointerEvent): void => {
    if (progressPointerId !== e.pointerId) return
    setScrub(timeFromPointer(e))
  }
  const onProgressUp = (e: PointerEvent): void => {
    if (progressPointerId !== e.pointerId) return
    progressPointerId = null
    try {
      progressRef?.releasePointerCapture(e.pointerId)
    } catch {
      /* capture never took */
    }
    const t = scrub()
    setScrub(null)
    if (t !== null) props.seekTo(t)
  }

  const remaining = (): number =>
    Math.max(0, props.duration() - (scrub() ?? props.elapsed()))

  const displayTitle = (): string =>
    (props.songTitle ?? '').replace(/\.[^.]+$/, '').trim() || 'Your song'

  return (
    <div class={styles.stage} data-testid="karaoke-mobile-stage">
      {/* ── Header ─────────────────────────────────────────── */}
      <div class={styles.header}>
        <Show when={props.onBack}>
          <button
            class={styles.backBtn}
            onClick={() => props.onBack?.()}
            title="Back to Karaoke Night"
            aria-label="Back"
          >
            <svg
              viewBox="0 0 24 24"
              width="18"
              height="18"
              fill="none"
              stroke="currentColor"
              stroke-width="2.4"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M15 5l-7 7 7 7" />
            </svg>
          </button>
        </Show>
        <div class={styles.titleWrap}>
          <p class={styles.title}>{displayTitle()}</p>
          <Show when={isPlaylistActive() && nextSong()}>
            <p class={styles.subtitle}>
              Up next: {nextSong()!.songTitle}
              <Show when={nextSong()!.singerName}>
                {' '}
                ({nextSong()!.singerName})
              </Show>
            </p>
          </Show>
        </div>
      </div>

      {/* ── Lyrics ─────────────────────────────────────────── */}
      <div
        ref={scrollerRef}
        class={styles.lyrics}
        onTouchMove={noteUserScroll}
        onWheel={noteUserScroll}
      >
        <Show
          when={lines().length > 0}
          fallback={
            <div class={styles.noLyrics}>
              <Show
                when={!props.lyricsLoading()}
                fallback={<p>Finding the lyrics…</p>}
              >
                <p>No synced lyrics for this song yet.</p>
                <p class={styles.noLyricsSub}>
                  The music still plays — sing it your way.
                </p>
              </Show>
            </div>
          }
        >
          <For each={lines()}>
            {([idx, entry]) => (
              <p
                ref={(el) => lineEls.set(idx, el)}
                classList={{
                  [styles.line]: true,
                  [styles.current]: idx === props.currentLineIdx(),
                  [styles.past]: idx < props.currentLineIdx(),
                }}
                onClick={() => seekToLine(idx)}
              >
                <Show
                  when={idx === props.currentLineIdx()}
                  fallback={entry.words.join(' ')}
                >
                  <For each={entry.words}>
                    {(word, i) => (
                      <span
                        classList={{
                          [styles.word]: true,
                          [styles.wordSung]: i() <= activeWord().activeUpTo,
                        }}
                      >
                        {word}
                        {i() < entry.words.length - 1 ? ' ' : ''}
                      </span>
                    )}
                  </For>
                </Show>
              </p>
            )}
          </For>
        </Show>
      </div>

      {/* ── Sing pill (vocals on/off + level) ──────────────── */}
      <button
        ref={pillRef}
        class={styles.pill}
        classList={{ [styles.pillOff]: vocalsOff() }}
        onPointerDown={onPillPointerDown}
        onPointerMove={onPillPointerMove}
        onPointerUp={onPillPointerUp}
        onPointerCancel={onPillPointerUp}
        title={
          vocalsOff() ? 'Bring the vocals back' : 'Sing it — mute the vocals'
        }
        aria-label="Toggle guide vocals (drag to set their level)"
        aria-pressed={vocalsOff()}
      >
        <div class={styles.pillTrack}>
          <div
            class={styles.pillFill}
            style={{ height: `${Math.round(pillLevel() * 100)}%` }}
          />
        </div>
        <div class={styles.pillBase}>
          <svg
            viewBox="0 0 24 24"
            width="17"
            height="17"
            aria-hidden="true"
            fill="none"
            stroke="currentColor"
            stroke-width="1.9"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <rect x="9" y="2.5" width="6" height="11" rx="3" />
            <path d="M5.5 11a6.5 6.5 0 0 0 13 0" />
            <path d="M12 17.5V21" />
            <path
              d="M19.5 3.2l.5 1.3 1.3.5-1.3.5-.5 1.3-.5-1.3-1.3-.5 1.3-.5z"
              fill="currentColor"
              stroke="none"
            />
            <path
              d="M3.4 15.6l.4 1 1 .4-1 .4-.4 1-.4-1-1-.4 1-.4z"
              fill="currentColor"
              stroke="none"
            />
          </svg>
        </div>
      </button>

      {/* ── Bottom bar ─────────────────────────────────────── */}
      <div class={styles.bottomBar}>
        <div
          ref={progressRef}
          class={styles.progress}
          onPointerDown={onProgressDown}
          onPointerMove={onProgressMove}
          onPointerUp={onProgressUp}
          onPointerCancel={onProgressUp}
        >
          <div class={styles.progressTrack}>
            <div
              class={styles.progressFill}
              style={{ width: `${progressPct()}%` }}
            />
          </div>
        </div>
        <div class={styles.times}>
          <span>{formatTime(scrub() ?? props.elapsed())}</span>
          <span>-{formatTime(remaining())}</span>
        </div>
        <div class={styles.transport}>
          <button
            class={styles.sideBtn}
            onClick={() => props.onRestart()}
            title="Restart"
            aria-label="Restart the song"
          >
            <svg
              viewBox="0 0 24 24"
              width="22"
              height="22"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M6 6h2v12H6zM18 6l-8.5 6L18 18z" />
            </svg>
          </button>
          <button
            class={styles.playBtn}
            onClick={() => (props.playing() ? props.onPause() : props.onPlay())}
            disabled={props.loading()}
            title={props.playing() ? 'Pause' : 'Play'}
            aria-label={props.playing() ? 'Pause' : 'Play'}
          >
            <Show
              when={props.playing()}
              fallback={
                <svg
                  viewBox="0 0 24 24"
                  width="28"
                  height="28"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M8 5v14l11-7z" />
                </svg>
              }
            >
              <svg
                viewBox="0 0 24 24"
                width="28"
                height="28"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
              </svg>
            </Show>
          </button>
          <button
            class={styles.sideBtn}
            style={{ visibility: isPlaylistActive() ? 'visible' : 'hidden' }}
            onClick={() => props.onPlaylistSkip()}
            title="Next song"
            aria-label="Next song"
          >
            <svg
              viewBox="0 0 24 24"
              width="22"
              height="22"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M6 6l8.5 6L6 18zM16 6h2v12h-2z" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Load / error states ────────────────────────────── */}
      <Show when={props.loading()}>
        <div class={styles.stateOverlay}>
          <p>Raising the curtain…</p>
        </div>
      </Show>
      <Show when={props.loadError() !== ''}>
        <div class={styles.stateOverlay}>
          <p>{props.loadError()}</p>
        </div>
      </Show>

      {/* ── Playlist chrome (store-driven, self-gating) ────── */}
      <Show when={props.playlistOverlayActive()}>
        <KaraokePlaylistOverlay
          onStart={() => props.onPlaylistStart()}
          onSkip={() => props.onPlaylistSkip()}
          durationSec={props.duration}
          loading={props.loading}
        />
      </Show>
      <KaraokePlaylistSummary />
    </div>
  )
}
