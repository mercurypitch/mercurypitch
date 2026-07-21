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
//
// Built on the mobile kit (docs/plans/mobile-native/mobile-kit.md):
// StageShell owns the viewport mechanics + scroll lock, Sheet/PillControl/
// Scrubber carry the touch behavior, and this file keeps only the karaoke
// skin (purple stage tokens in the module CSS) and the lyrics logic.

import type { Component } from 'solid-js'
import { createEffect, createMemo, createSignal, For, on, onCleanup, Show, } from 'solid-js'
import { KaraokePlaylistOverlay } from '@/components/KaraokePlaylistOverlay'
import { KaraokePlaylistSummary } from '@/components/KaraokePlaylistSummary'
import { LyricsSongPicker } from '@/components/LyricsSongPicker'
import type { LyricsUploadResult } from '@/components/LyricsUploader'
import { LyricsUploader, LyricsUploaderStyles, } from '@/components/LyricsUploader'
import { AutoplayIcon, ChevronLeftIcon, MicSparkleIcon, NextIcon, PauseIcon, PlayGlyphIcon, PlayIcon, PrevIcon, SongListIcon, } from '@/components/mobile/icons'
import { PillControl } from '@/components/mobile/PillControl'
import { Scrubber } from '@/components/mobile/Scrubber'
import { Sheet } from '@/components/mobile/Sheet'
import { StageShell } from '@/components/mobile/StageShell'
import { DEMO_SESSION_ID } from '@/features/karaoke-night/demo-song'
import { orderedLibrarySessions, resolveBackIntent, } from '@/features/stem-mixer/zen-navigation'
import type { LyricsSearchMatch } from '@/lib/lyrics-service'
import { isNarrow } from '@/lib/use-viewport'
import { currentIndex, getPlaylistsReactive, isPlaylistActive, nextSong, perSongScores, queue, startPlaylist, } from '@/stores/karaoke-playlist-store'
import { getAllUvrSessionsReactive } from '@/stores/uvr-store'
import styles from './KaraokeMobileStage.module.css'

// The uploader's CSS is a plain string injected once. The standalone host
// injects it too (same key → deduped); this covers the in-app karaoke tab,
// where the zen stage renders without that host.
if (
  typeof document !== 'undefined' &&
  document.head.querySelector('style[data-kn="lyrics-uploader"]') === null
) {
  const el = document.createElement('style')
  el.setAttribute('data-kn', 'lyrics-uploader')
  el.textContent = LyricsUploaderStyles
  document.head.appendChild(el)
}

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
  /** Seek the current song to its start (the back control's first press). */
  onSeekToStart: () => void
  seekTo: (t: number) => void

  // Song navigation — spans the active playlist/group or the whole library.
  /** A previous item exists to step back to (drives the back-then-prev gesture). */
  hasPrevItem: () => boolean
  /** A next item exists (enables the next button). */
  hasNextItem: () => boolean
  /** Go to the previous item (playlist prev, or previous library song). */
  onPrevItem: () => void
  /** Go to the next item (playlist advance, or next library song). */
  onNextItem: () => void
  /** Autoplay: when on, the next item plays automatically at end-of-song. */
  autoplayEnabled: () => boolean
  onToggleAutoplay: () => void

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
  ) => { activeUpTo: number; charProgress: number; fraction: number }
  onLineClick: (idx: number) => void

  // Playlist chrome (only the current playlist song drives the overlay)
  playlistOverlayActive: () => boolean
  onPlaylistStart: () => void
  onPlaylistSkip: () => void

  /** Stage another library song from the in-stage song sheet. */
  onPickSession?: (sessionId: string) => void

  /** Attach user-supplied lyrics when none were found (paste or file).
      Reuses the studio's lyrics controller, so they parse, sync, persist,
      and show in the studio too. When omitted, the no-lyrics state is a
      plain message (e.g. read-only contexts). */
  onUploadLyrics?: (result: LyricsUploadResult) => void
  lyricsSuggestion?: () => string
  lrclibSearchUrl?: () => string

  /** LRCLIB search wiring. When present, the no-lyrics state shows the same
      inline search + match list the studio uses (always visible, even with no
      matches), with the manual uploader beneath it. Omit for a plain prompt. */
  songMatches?: () => LyricsSearchMatch[]
  songPickerQuery?: () => string
  onSongPickerQuery?: (v: string) => void
  onSongPickerRefine?: () => void
  onSongPick?: (match: LyricsSearchMatch) => void
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

  const scrollLyricsToTop = (): void => {
    scrollerRef?.scrollTo({
      top: 0,
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
    })
  }

  createEffect(
    on(
      () => props.currentLineIdx(),
      (idx, prev) => {
        if (userScrolled()) return
        // Before the first line (restart, scrub back into the intro) there is
        // no element to centre — glide the whole sheet back to the top.
        if (idx < 0) {
          scrollLyricsToTop()
          return
        }
        centerLine(idx, prev !== undefined)
      },
    ),
  )

  // Back-to-beginning control (position-based, like a phone music player): a
  // first press seeks the current song to its start; a second press while
  // already near the start steps to the previous item. See resolveBackIntent.
  // The seek path also clears any manual-scroll override and glides the sheet
  // up immediately — the currentLineIdx effect alone can't cover a seek while
  // paused (no RAF tick to change the index).
  const handleBack = (): void => {
    if (resolveBackIntent(props.elapsed(), props.hasPrevItem()) === 'prev') {
      props.onPrevItem()
      return
    }
    props.onSeekToStart()
    if (scrollIdleTimer) clearTimeout(scrollIdleTimer)
    setUserScrolled(false)
    scrollLyricsToTop()
  }

  // Word-level progress for the current line only.
  const activeWord = createMemo(() => {
    const entry = props.parsedLyrics().get(props.currentLineIdx())
    if (!entry) return { activeUpTo: -1, charProgress: 0, fraction: 0 }
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

  // ── Vocal pill (kit PillControl; toggle semantics stay here) ──
  const vocalsOff = (): boolean =>
    props.vocal().muted || props.vocal().volume === 0

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

  const pillLevel = (): number => (vocalsOff() ? 0 : props.vocal().volume)

  // ── Progress / transport ──────────────────────────────────────
  // Mirrors the Scrubber's preview so the time readouts track the finger.
  const [scrub, setScrub] = createSignal<number | null>(null)

  const remaining = (): number =>
    Math.max(0, props.duration() - (scrub() ?? props.elapsed()))

  const displayTitle = (): string =>
    (props.songTitle ?? '').replace(/\.[^.]+$/, '').trim() || 'Your song'

  // ── In-stage song sheet ───────────────────────────────────────
  const [sheetOpen, setSheetOpen] = createSignal(false)

  // ── Add-lyrics fallback sheet (shown from the no-lyrics state) ──
  const [addLyricsOpen, setAddLyricsOpen] = createSignal(false)

  // The library in display order — shared with StemMixer's prev/next stepping
  // (zen-navigation.ts) so the song sheet and the transport agree on order.
  const librarySongs = createMemo(() =>
    orderedLibrarySessions(getAllUvrSessionsReactive(), DEMO_SESSION_ID),
  )

  const pickSession = (sessionId: string): void => {
    setSheetOpen(false)
    props.onPickSession?.(sessionId)
  }

  const pickPlaylist = (id: string): void => {
    setSheetOpen(false)
    startPlaylist(id)
  }

  // ── Desktop-zen playlist card ─────────────────────────────────
  // Only on a wide screen (there's a gutter beside the lyric column); on a
  // phone the existing overlay/summary carry playlist chrome.
  const nowEntry = () => queue()[currentIndex()] ?? null
  const nextEntry = () => queue()[currentIndex() + 1] ?? null
  const prevEntry = () =>
    currentIndex() > 0 ? (queue()[currentIndex() - 1] ?? null) : null
  const prevScore = () =>
    currentIndex() > 0 ? (perSongScores()[currentIndex() - 1] ?? null) : null
  const singerOf = (
    e: { singerName?: string; songTitle: string } | null,
  ): string => {
    const name = e?.singerName?.trim()
    return name !== undefined && name !== '' ? name : (e?.songTitle ?? '—')
  }
  const gradeColor = (g: string): string =>
    ({
      S: '#ffd479',
      A: '#7ee0a0',
      B: '#8fb8ff',
      C: '#ffcf8f',
      D: '#f8a0a0',
    })[g] ?? '#e8dcfa'
  const showPlaylistCard = () =>
    !isNarrow() && isPlaylistActive() && queue().length > 0

  return (
    <StageShell class={styles.stage} testId="karaoke-mobile-stage">
      {/* ── Header ─────────────────────────────────────────── */}
      <div class={styles.header}>
        <Show when={props.onBack}>
          <button
            class={styles.backBtn}
            onClick={() => props.onBack?.()}
            title="Back to Karaoke Night"
            aria-label="Back"
          >
            <ChevronLeftIcon />
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
        <Show when={props.onPickSession}>
          <button
            class={styles.autoplayBtn}
            classList={{ [styles.autoplayBtnOn]: props.autoplayEnabled() }}
            onClick={() => props.onToggleAutoplay()}
            aria-pressed={props.autoplayEnabled()}
            title={
              props.autoplayEnabled()
                ? 'Autoplay is on — the next song plays automatically'
                : 'Autoplay is off — turn on to keep playing song after song'
            }
            aria-label="Toggle autoplay"
          >
            <AutoplayIcon />
          </button>
          <button
            class={styles.listBtn}
            onClick={() => setSheetOpen(true)}
            title="Songs and playlists"
            aria-label="Open the song list"
          >
            <SongListIcon />
          </button>
        </Show>
      </div>

      {/* ── Desktop-zen playlist card (uses the side gutter) ── */}
      <Show when={showPlaylistCard()}>
        <aside class={styles.playlistCard} aria-label="Playlist status">
          <p class={styles.plKicker}>Playlist</p>

          <div class={styles.plNow}>
            <span class={styles.plLabel}>Now singing</span>
            <div class={styles.plSingerRow}>
              <span class={styles.plDot} />
              <span class={styles.plName}>{singerOf(nowEntry())}</span>
            </div>
            <p class={styles.plSong}>{nowEntry()?.songTitle}</p>
          </div>

          <Show when={nextEntry()}>
            <div class={styles.plRow}>
              <span class={styles.plLabel}>Up next</span>
              <span class={styles.plName}>{singerOf(nextEntry())}</span>
              <p class={styles.plSong}>{nextEntry()!.songTitle}</p>
            </div>
          </Show>

          <Show when={prevEntry()}>
            <div class={styles.plRow}>
              <div class={styles.plPrevHead}>
                <span class={styles.plLabel}>Last up</span>
                <Show when={prevScore()}>
                  <span class={styles.plScore}>
                    <span
                      class={styles.plGrade}
                      style={{ color: gradeColor(prevScore()!.grade) }}
                    >
                      {prevScore()!.grade}
                    </span>
                    {Math.round(prevScore()!.accuracyPct)}%
                  </span>
                </Show>
              </div>
              <span class={styles.plName}>{singerOf(prevEntry())}</span>
              <p class={styles.plSong}>{prevEntry()!.songTitle}</p>
            </div>
          </Show>
        </aside>
      </Show>

      {/* ── Lyrics ─────────────────────────────────────────── */}
      <div
        ref={scrollerRef}
        class={styles.lyrics}
        classList={{ [styles.lyricsEmpty]: lines().length === 0 }}
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
                <Show
                  when={props.songMatches !== undefined}
                  fallback={
                    <>
                      <p>No synced lyrics for this song yet.</p>
                      <p class={styles.noLyricsSub}>
                        The music still plays — sing it your way.
                      </p>
                      <Show when={props.onUploadLyrics}>
                        <button
                          class={styles.addLyricsBtn}
                          onClick={() => setAddLyricsOpen(true)}
                        >
                          Add lyrics
                        </button>
                      </Show>
                    </>
                  }
                >
                  <div class={styles.finder}>
                    <div class={styles.finderHead}>
                      <p>No synced lyrics yet</p>
                      <p class={styles.noLyricsSub}>
                        Find them on LRCLIB, or add your own.
                      </p>
                    </div>
                    <LyricsSongPicker
                      variant="inline"
                      matches={props.songMatches!()}
                      query={props.songPickerQuery?.() ?? ''}
                      onQueryChange={(v) => props.onSongPickerQuery?.(v)}
                      onPick={(m) => props.onSongPick?.(m)}
                      onRefine={() => props.onSongPickerRefine?.()}
                    />
                    <Show when={props.onUploadLyrics}>
                      <div class={styles.finderOr}>or add your own</div>
                      <LyricsUploader
                        compact
                        suggestion={props.lyricsSuggestion?.()}
                        searchUrl={props.lrclibSearchUrl?.()}
                        onUpload={(result) => props.onUploadLyrics?.(result)}
                      />
                    </Show>
                  </div>
                </Show>
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
                          [styles.wordActive]:
                            i() === activeWord().activeUpTo + 1 &&
                            activeWord().fraction > 0,
                        }}
                        style={
                          i() === activeWord().activeUpTo + 1
                            ? {
                                '--sweep': `${(activeWord().fraction * 100).toFixed(1)}%`,
                              }
                            : undefined
                        }
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
      <PillControl
        class={styles.singPill}
        level={pillLevel()}
        off={vocalsOff()}
        onTap={pillTapToggle}
        onLevel={props.onVocalVolume}
        title={
          vocalsOff() ? 'Bring the vocals back' : 'Sing it — mute the vocals'
        }
        ariaLabel="Toggle guide vocals (drag to set their level)"
      >
        <MicSparkleIcon />
      </PillControl>

      {/* ── Bottom bar ─────────────────────────────────────── */}
      <div class={styles.bottomBar}>
        <Scrubber
          value={props.elapsed()}
          duration={props.duration()}
          onSeek={props.seekTo}
          onScrub={setScrub}
        />
        <div class={styles.times}>
          <span>{formatTime(scrub() ?? props.elapsed())}</span>
          <span>-{formatTime(remaining())}</span>
        </div>
        <div class={styles.transport}>
          <button
            class={styles.sideBtn}
            onClick={handleBack}
            title="Back to start (press again to go to the previous song)"
            aria-label="Back to the start of the song"
          >
            <PrevIcon />
          </button>
          <button
            class={styles.playBtn}
            onClick={() => (props.playing() ? props.onPause() : props.onPlay())}
            disabled={props.loading()}
            title={props.playing() ? 'Pause' : 'Play'}
            aria-label={props.playing() ? 'Pause' : 'Play'}
          >
            <Show when={props.playing()} fallback={<PlayIcon />}>
              <PauseIcon />
            </Show>
          </button>
          <button
            class={styles.sideBtn}
            onClick={() => props.onNextItem()}
            disabled={!props.hasNextItem()}
            title="Next song"
            aria-label="Next song"
          >
            <NextIcon />
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

      {/* ── Song sheet ─────────────────────────────────────── */}
      <Sheet
        isOpen={sheetOpen()}
        close={() => setSheetOpen(false)}
        ariaLabel="Songs and playlists"
      >
        <Show when={librarySongs().length > 0}>
          <p class={styles.sheetKicker}>Your library</p>
          <ul class={styles.sheetList}>
            <For each={librarySongs()}>
              {(s) => (
                <li>
                  <button
                    class={styles.sheetRow}
                    onClick={() => pickSession(s.sessionId)}
                  >
                    {s.originalFile?.name ?? s.sessionId}
                  </button>
                </li>
              )}
            </For>
          </ul>
        </Show>
        <Show when={getPlaylistsReactive().length > 0}>
          <p class={styles.sheetKicker}>Your playlists</p>
          <ul class={styles.sheetList}>
            <For each={getPlaylistsReactive()}>
              {(p) => (
                <li>
                  <button
                    class={styles.sheetRow}
                    onClick={() => pickPlaylist(p.id)}
                  >
                    <PlayGlyphIcon class={styles.sheetPlay} />
                    {p.name}
                  </button>
                </li>
              )}
            </For>
          </ul>
        </Show>
        <Show
          when={
            librarySongs().length === 0 && getPlaylistsReactive().length === 0
          }
        >
          <p class={styles.sheetEmpty}>
            Nothing else on this device yet — go back to add a song you own.
          </p>
        </Show>
      </Sheet>

      {/* ── Add-lyrics fallback (paste text / load a .lrc or .txt) ── */}
      <Show when={props.onUploadLyrics}>
        <Sheet
          isOpen={addLyricsOpen()}
          close={() => setAddLyricsOpen(false)}
          ariaLabel="Add lyrics"
        >
          <LyricsUploader
            suggestion={props.lyricsSuggestion?.()}
            searchUrl={props.lrclibSearchUrl?.()}
            onUpload={(result) => {
              props.onUploadLyrics?.(result)
              setAddLyricsOpen(false)
            }}
            onDismiss={() => setAddLyricsOpen(false)}
          />
        </Sheet>
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
    </StageShell>
  )
}
