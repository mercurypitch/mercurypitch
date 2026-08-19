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
import { GuideVocalMic } from '@/components/mobile/GuideVocalMic'
import { AutoplayIcon, ChevronLeftIcon, MicIcon, MusicLevelIcon, NextIcon, NoteGlyphIcon, PauseIcon, PlayGlyphIcon, PlayIcon, PrevIcon, SongListIcon, TextSizeIcon, } from '@/components/mobile/icons'
import { PillControl } from '@/components/mobile/PillControl'
import { Scrubber } from '@/components/mobile/Scrubber'
import { Sheet } from '@/components/mobile/Sheet'
import { StageShell } from '@/components/mobile/StageShell'
import { RestCountdownDots } from '@/components/RestCountdownDots'
import { PremiumBackgroundPicker } from '@/features/backgrounds/PremiumBackgroundPicker'
import { DEMO_SESSION_ID } from '@/features/karaoke-night/demo-song'
import type { WordSweepPoint } from '@/features/stem-mixer/types'
import type { StemLoadPhase } from '@/features/stem-mixer/useStemMixerAudioController'
import type { ZenLyricsSize } from '@/features/stem-mixer/zen-navigation'
import { cycleLyricsSize, orderedLibrarySessions, resolveBackIntent, stepLyricsSize, vocalDragUnmutes, ZEN_LYRICS_SCALE, } from '@/features/stem-mixer/zen-navigation'
import { buildWordNoteIndex, hasWordNotes, noteForWord, } from '@/features/stem-mixer/zen-note-glyphs'
import type { RibbonNote } from '@/features/stem-mixer/zen-pitch-ribbon'
import { useBackgroundSurfaceController } from '@/lib/backgrounds/background-surface'
import { getRestDotCount, leadInProgress } from '@/lib/canonical-lrc'
import { formatBytes } from '@/lib/fetch-progress'
import type { LyricsSearchMatch } from '@/lib/lyrics-service'
import type { DetectedPitch } from '@/lib/pitch-detector'
import type { AlignedWord } from '@/lib/pitch-word-alignment'
import { createPersistedSignal } from '@/lib/storage'
import { isNarrow } from '@/lib/use-viewport'
import { currentIndex, getPlaylistsReactive, isPlaylistActive, nextSong, perSongScores, queue, startPlaylist, } from '@/stores/karaoke-playlist-store'
import { getAllUvrSessionsReactive } from '@/stores/uvr-store'
import styles from './KaraokeMobileStage.module.css'
import { ZenPitchRibbon } from './ZenPitchRibbon'

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
  wordEndTimes?: number[]
  wordSweeps?: Record<number, WordSweepPoint[]>
  /** Start of this line's run-in cue, when the gap before it earns one. */
  leadInFrom?: number
}

export interface KaraokeMobileStageProps {
  songTitle: string
  onBack?: () => void

  // Audio (stem-mixer audio controller)
  playing: () => boolean
  loading: () => boolean
  loadError: () => string
  elapsed: () => number
  /** Output-device-aligned position used only for lyric highlighting. */
  lyricsElapsed?: () => number
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
    wordEndTimes?: number[],
    wordSweeps?: Record<number, WordSweepPoint[]>,
  ) => { activeUpTo: number; charProgress: number; fraction: number }
  onLineClick: (idx: number) => void

  // Playlist chrome (only the current playlist song drives the overlay)
  playlistOverlayActive: () => boolean
  onPlaylistStart: () => void
  onPlaylistSkip: () => void

  /** Stage another library song from the in-stage song sheet. */
  onPickSession?: (sessionId: string) => void
  /** Hide the embedded picker when the page shell owns stage settings. */
  showStageSettings?: boolean

  // Sing-this-note glyphs (chord-chart labels over the words). When the host
  // provides the alignment, the header shows the notes toggle; enabling it
  // with no notes yet asks the host to run the (denoised) pitch analysis.
  alignedWords?: () => AlignedWord[]
  onEnsureNotes?: () => void
  notesAnalyzing?: () => boolean
  notesProgress?: () => number

  // Live pitch coach: mic on/off plus the ribbon of target notes the
  // singer's pitch rides. All optional — hosts without a mic engine
  // simply don't get the button.
  micActive?: () => boolean
  onToggleMic?: () => void

  /** How loud the backing runs, and how to change it.
   *
   *  This sits beside the mic on purpose. Opening a mic on iOS switches the
   *  page to `playAndRecord` and the whole output drops — a platform
   *  behaviour the app cannot turn off — so the control that gets the level
   *  back belongs at the moment and the place the level goes. All three are
   *  optional together; a host without them simply has no button. */
  musicLevel?: () => number
  onMusicLevel?: (value: number) => void
  musicLevelRange?: {
    min: number
    max: number
    step: number
    defaultValue: number
  }
  micPitch?: () => DetectedPitch | null
  ribbonNotes?: () => RibbonNote[]

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

  /** Stem download progress, mirrored from the mixer's audio controller.
      Optional: a host that cannot measure the load still gets the overlay,
      just without the numbers. */
  loadProgress?: () => number
  loadPhase?: () => StemLoadPhase
  loadedBytes?: () => number
  totalBytes?: () => number | null
  /** Start the download over. A phone that locked its screen mid-load comes
      back to a dead session and a message about it; without this the only
      way on is the browser's own reload. Omit where a retry is meaningless
      (stems that were never remote in the first place). */
  onRetryLoad?: () => void
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
  const background = useBackgroundSurfaceController('karaoke')

  // ── Load progress ─────────────────────────────────────────────
  //
  // Mirrors the mixer's contract rather than inventing a second one: only the
  // download has a measurable share, so connecting and decoding run the
  // indeterminate stripe instead of parking a number that isn't moving. A host
  // that passes no progress at all lands on the same indeterminate path.
  const loadPct = (): number => props.loadProgress?.() ?? 0
  const loadPhase = (): StemLoadPhase => props.loadPhase?.() ?? 'connecting'
  const determinate = (): boolean =>
    loadPhase() === 'downloading' && (props.totalBytes?.() ?? null) !== null

  const loadHeadline = (): string => {
    if (loadPhase() === 'decoding') return 'Almost ready…'
    return 'Raising the curtain…'
  }

  const loadDetail = (): string => {
    if (loadPhase() === 'connecting') return 'Reaching the song library'
    if (loadPhase() === 'decoding') return 'Decoding audio'
    const total = props.totalBytes?.() ?? null
    const loaded = props.loadedBytes?.() ?? 0
    if (total !== null) return `${formatBytes(loaded)} of ${formatBytes(total)}`
    // No Content-Length: a climbing byte count still says "working".
    return loaded > 0 ? formatBytes(loaded) : 'Downloading'
  }

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
      props.lyricsElapsed?.() ?? props.elapsed(),
      entry.wordEndTimes,
      entry.wordSweeps,
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

  // Dragging the level up while muted brings the vocals back first — the
  // decision rule (and why) lives in zen-navigation with the other pure
  // transport decisions.
  const pillSetLevel = (v: number): void => {
    if (vocalDragUnmutes(props.vocal().muted, v)) props.onToggleVocal()
    props.onVocalVolume(v)
  }

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

  // ── Lyrics size presets (Smaller / Current / Bigger) ──────────
  // Cycled from the header button; Ctrl/Cmd+wheel (trackpad pinch) over the
  // lyrics steps through the same presets. Persisted per user.
  const [lyricsSize, setLyricsSize] = createPersistedSignal<ZenLyricsSize>(
    'sm-zen-lyrics-size',
    'current',
  )
  const lyricsSizeTitle = (): string =>
    ({
      smaller: 'Lyrics size: Smaller — click for Current',
      current: 'Lyrics size: Current — click for Bigger',
      bigger: 'Lyrics size: Bigger — click for Smaller',
    })[lyricsSize()]
  const handleLyricsZoomWheel = (e: WheelEvent): void => {
    if (!e.ctrlKey && !e.metaKey) return
    e.preventDefault()
    setLyricsSize(stepLyricsSize(lyricsSize(), e.deltaY < 0 ? 1 : -1))
  }

  // ── Sing-this-note glyphs ─────────────────────────────────────
  // Chord-chart labels over the words: the note the singer should hit,
  // from the denoised pitch alignment. Enabling with no notes yet asks
  // the host to run the analysis; glyphs fade in when it lands.
  const [noteGlyphsOn, setNoteGlyphsOn] = createPersistedSignal(
    'sm-zen-note-glyphs',
    false,
  )
  const wordNoteIndex = createMemo(() =>
    buildWordNoteIndex(props.alignedWords?.() ?? []),
  )
  const hasNoteData = (): boolean => hasWordNotes(wordNoteIndex())
  const toggleNoteGlyphs = (): void => {
    const next = !noteGlyphsOn()
    setNoteGlyphsOn(next)
    if (next && !hasNoteData()) props.onEnsureNotes?.()
  }
  // The line the singer reads ahead to — the first lyric line after the
  // current one (rests skipped). Before the first line it is the opener,
  // so the intro countdown already shows what the entry note will be.
  const nextLyricLineIdx = createMemo(() => {
    const current = props.currentLineIdx()
    for (const [idx, entry] of lines()) {
      if (idx > current && entry.words.length > 0) return idx
    }
    return -1
  })
  const glyphsForLine = (idx: number): boolean =>
    noteGlyphsOn() &&
    hasNoteData() &&
    (idx === props.currentLineIdx() || idx === nextLyricLineIdx())

  // Layout-shifting display toggles (note glyphs appearing, text-size
  // presets) reflow the whole lyric sheet — snap the follow back to the
  // target line so the singer never lands mid-verse somewhere else.
  // Deliberately overrides a manual scroll: the reflow just invalidated
  // that position anyway.
  const notedActive = (): boolean => noteGlyphsOn() && hasNoteData()
  createEffect(
    on([notedActive, lyricsSize], (_, prev) => {
      if (prev === undefined) return // mount — the line-follow effect owns it
      setUserScrolled(false)
      const idx = props.currentLineIdx()
      if (idx < 0) scrollLyricsToTop()
      else centerLine(idx, true)
    }),
  )

  // ── Live pitch coach (mic + ribbon) ───────────────────────────
  const micOn = (): boolean => props.micActive?.() === true
  const ribbonVisible = (): boolean =>
    micOn() && (props.ribbonNotes?.() ?? []).length > 0
  // The level is the same capsule the guide-vocal pill is: press it and a
  // vertical track slides out of the top, drag to set. It was a panel with a
  // range input in it for one release, and the report was blunt — "why make
  // up this new slider?" There was no reason. This is the control the stage
  // already had, pointed at a different number.
  const hasMusicLevel = (): boolean =>
    props.musicLevel !== undefined &&
    props.onMusicLevel !== undefined &&
    props.musicLevelRange !== undefined

  // Everything the pill shows is a percentage of the level the app has always
  // played at. 0.7 is what every mix sounded like before there was a control,
  // so it is the only honest 100%, and the store's bounds are round multiples
  // of it — half and triple — which is why these land on 50 and 300.
  const levelPercent = (): number =>
    Math.round(
      (props.musicLevel!() / props.musicLevelRange!.defaultValue) * 100,
    )
  const percentOf = (value: number): number =>
    Math.round((value / props.musicLevelRange!.defaultValue) * 100)
  const setLevelPercent = (percent: number): void => {
    const range = props.musicLevelRange!
    const bounded = Math.max(
      percentOf(range.min),
      Math.min(percentOf(range.max), percent),
    )
    // Rounded to a thousandth: the raw product carries a float tail — 160% of
    // 0.7 is 1.1200000000000001 — and that tail is what would be written to
    // storage, read back, and shown to the next pill as a percentage.
    props.onMusicLevel!(
      Math.round((bounded / 100) * range.defaultValue * 1000) / 1000,
    )
  }

  /** Where the level sits in its own range, 0..1, which is what fills the pill. */
  const levelFill = (): number => {
    const range = props.musicLevelRange!
    return (props.musicLevel!() - range.min) / (range.max - range.min)
  }
  const setLevelFromFill = (fill: number): void => {
    const range = props.musicLevelRange!
    const step = Math.max(1, percentOf(range.step))
    const span = percentOf(range.max) - percentOf(range.min)
    const raw = percentOf(range.min) + fill * span
    // Snapped to the store's own step, so the readout never shows a number
    // the slider could not have been left on.
    setLevelPercent(Math.round(raw / step) * step)
  }

  // Tap toggles back to normal and back again, the way the pill beside it
  // toggles the vocals. Nothing to return to on a first tap: the track still
  // slides out, which is the other half of what a tap is for here.
  const [levelBeforeNormal, setLevelBeforeNormal] = createSignal<number | null>(
    null,
  )
  const toggleNormalLevel = (): void => {
    const range = props.musicLevelRange!
    if (levelPercent() !== 100) {
      setLevelBeforeNormal(props.musicLevel!())
      props.onMusicLevel!(range.defaultValue)
      return
    }
    const previous = levelBeforeNormal()
    if (previous === null) return
    setLevelBeforeNormal(null)
    props.onMusicLevel!(previous)
  }

  const toggleMic = (): void => {
    // Turning the mic on with no analyzed notes yet: the ribbon needs
    // targets, so kick off the same denoised analysis the glyphs use.
    if (!micOn() && (props.ribbonNotes?.() ?? []).length === 0) {
      props.onEnsureNotes?.()
    }
    props.onToggleMic?.()
  }

  return (
    <StageShell
      class={styles.stage}
      style={background.resolvedStyle()}
      testId="karaoke-mobile-stage"
    >
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
        <div class={styles.headerActions}>
          <Show when={props.showStageSettings !== false}>
            <PremiumBackgroundPicker
              controller={background}
              label="Stage"
              iconOnly
            />
          </Show>
          <Show when={props.alignedWords}>
            <button
              class={styles.autoplayBtn}
              classList={{ [styles.autoplayBtnOn]: noteGlyphsOn() }}
              onClick={toggleNoteGlyphs}
              aria-pressed={noteGlyphsOn()}
              title={
                noteGlyphsOn()
                  ? 'Hide the notes to sing'
                  : 'Show the note to sing over each word'
              }
              aria-label="Toggle the sing-this-note labels"
            >
              <NoteGlyphIcon />
            </button>
          </Show>
          <button
            class={styles.autoplayBtn}
            classList={{
              [styles.autoplayBtnOn]: lyricsSize() !== 'current',
            }}
            onClick={() => setLyricsSize(cycleLyricsSize(lyricsSize()))}
            title={lyricsSizeTitle()}
            aria-label="Cycle the lyrics text size"
          >
            <TextSizeIcon />
          </button>
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

      {/* Analysis running for the note labels — quiet inline status. */}
      <Show when={(noteGlyphsOn() || micOn()) && props.notesAnalyzing?.()}>
        <p class={styles.notesHint}>
          Reading the vocal to find the notes —{' '}
          {Math.round(props.notesProgress?.() ?? 0)}%
        </p>
      </Show>

      {/* ── Live pitch ribbon — your voice riding the notes ── */}
      <Show when={ribbonVisible()}>
        <ZenPitchRibbon
          playing={props.playing}
          elapsed={props.elapsed}
          notes={props.ribbonNotes!}
          micPitch={props.micPitch ?? (() => null)}
        />
      </Show>

      {/* ── Lyrics ─────────────────────────────────────────── */}
      <div
        ref={scrollerRef}
        class={styles.lyrics}
        classList={{
          [styles.lyricsEmpty]: lines().length === 0,
          [styles.lyricsNoted]: noteGlyphsOn() && hasNoteData(),
        }}
        style={{ '--lyrics-scale': String(ZEN_LYRICS_SCALE[lyricsSize()]) }}
        onTouchMove={noteUserScroll}
        onWheel={(e) => {
          // Ctrl/Cmd+wheel (trackpad pinch) zooms the presets; it is not a
          // scroll-away, so it must not pause the lyrics auto-follow.
          if (e.ctrlKey || e.metaKey) handleLyricsZoomWheel(e)
          else noteUserScroll()
        }}
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
            {([idx, entry]) => {
              const isCurrent = () => idx === props.currentLineIdx()
              const isRest = entry.words.length === 0
              // The run-in: how far through the silence before this line the
              // playback has come, or null outside that window. Read per line
              // rather than off the current one — during a run-in the line
              // about to start is by definition not the current line yet.
              const leadIn = () =>
                leadInProgress(entry.leadInFrom, entry.time, props.elapsed())
              return (
                <p
                  ref={(el) => lineEls.set(idx, el)}
                  classList={{
                    [styles.line]: true,
                    [styles.current]: isCurrent(),
                    [styles.past]: idx < props.currentLineIdx(),
                  }}
                  onClick={() => seekToLine(idx)}
                >
                  <Show
                    when={!isRest}
                    fallback={
                      <RestCountdownDots
                        dotCount={getRestDotCount(entry.time, entry.endTime)}
                        elapsed={props.elapsed}
                        gapEnd={entry.endTime}
                        gapStart={entry.time}
                        onSeek={props.seekTo}
                        style={{
                          'justify-content': 'flex-start',
                          'margin-top': '0.5rem',
                          '--accent': '#ffffff',
                        }}
                      />
                    }
                  >
                    {/* A line only splits into word spans when something
                        needs to address a word: the sweep, the note glyphs,
                        or — the reason a line that is not current yet can
                        need them — the run-in cue on its first word. */}
                    <Show
                      when={
                        isCurrent() || leadIn() !== null || glyphsForLine(idx)
                      }
                      fallback={entry.words.join(' ')}
                    >
                      <For each={entry.words}>
                        {(word, i) => {
                          /** The cue rides the first word, and only it. */
                          const wordLeadIn = () => (i() === 0 ? leadIn() : null)
                          return (
                            <span
                              classList={{
                                [styles.word]: true,
                                [styles.wordLeadIn]: wordLeadIn() !== null,
                                [styles.wordSung]:
                                  isCurrent() && i() <= activeWord().activeUpTo,
                                [styles.wordActive]:
                                  isCurrent() &&
                                  i() === activeWord().activeUpTo + 1 &&
                                  activeWord().fraction > 0,
                              }}
                              style={{
                                ...(isCurrent() &&
                                i() === activeWord().activeUpTo + 1
                                  ? {
                                      '--sweep': `${(activeWord().fraction * 100).toFixed(1)}%`,
                                    }
                                  : {}),
                                ...(wordLeadIn() !== null
                                  ? { '--lead-in': wordLeadIn()!.toFixed(3) }
                                  : {}),
                              }}
                            >
                              <Show when={glyphsForLine(idx)}>
                                {(() => {
                                  // Overlap against the word's window, not a
                                  // start-time match: an uploaded sheet has no
                                  // per-word times at all, and the earlier
                                  // start-keyed lookups therefore drew nothing
                                  // on every line-timed song.
                                  const note = noteForWord(
                                    props.alignedWords?.() ?? [],
                                    entry,
                                    i(),
                                  )
                                  const glyph = note?.noteName ?? null
                                  return glyph === null ? null : (
                                    <i
                                      class={styles.noteGlyph}
                                      aria-hidden="true"
                                    >
                                      {glyph}
                                    </i>
                                  )
                                })()}
                              </Show>
                              {word}
                              {i() < entry.words.length - 1 ? ' ' : ''}
                              <Show when={wordLeadIn() !== null}>
                                <span
                                  aria-hidden="true"
                                  class={styles.leadInRule}
                                  data-lead-in-cue="true"
                                />
                              </Show>
                            </span>
                          )
                        }}
                      </For>
                    </Show>
                  </Show>
                </p>
              )
            }}
          </For>
        </Show>
      </div>

      {/* ── Sing pill (vocals on/off + level) ──────────────── */}
      <PillControl
        class={styles.singPill}
        level={pillLevel()}
        off={vocalsOff()}
        onTap={pillTapToggle}
        onLevel={pillSetLevel}
        title={
          vocalsOff() ? 'Bring the vocals back' : 'Sing it — mute the vocals'
        }
        ariaLabel="Toggle guide vocals (drag to set their level)"
      >
        <GuideVocalMic muted={vocalsOff()} />
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
          {/* Left slot: your mic. Lives in the bar with the other
              performance controls — never floating over the lyrics. */}
          <div class={styles.transportSide}>
            <Show when={props.onToggleMic}>
              <button
                class={styles.micBtn}
                classList={{ [styles.micBtnOn]: micOn() }}
                onClick={toggleMic}
                aria-pressed={micOn()}
                title={
                  micOn()
                    ? 'Mic is live — the ribbon follows your pitch. Tap to turn it off.'
                    : 'Sing with the mic and watch your pitch ride the notes'
                }
                aria-label="Toggle your microphone"
              >
                <MicIcon />
              </button>
            </Show>
          </div>
          <div class={styles.transportMain}>
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
              onClick={() =>
                props.playing() ? props.onPause() : props.onPlay()
              }
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
          {/* Right slot: the backing level, mirroring the mic so play stays
              dead centre. Empty and aria-hidden when the host cannot offer
              it, which keeps the transport symmetrical either way. */}
          <div
            class={`${styles.transportSide} ${styles.levelAnchor}`}
            aria-hidden={hasMusicLevel() ? undefined : 'true'}
          >
            <Show when={hasMusicLevel()}>
              {/* Absolutely placed inside the slot, and that is the fix
                  rather than a detail: the capsule grows upward when it
                  opens, and in the flow that growth would make the whole
                  bottom bar taller and push the transport off a short
                  screen. Out of the flow it rises over the lyrics instead —
                  the bar measures the same open or closed. */}
              <PillControl
                class={styles.levelPill}
                testId="mobile-music-level"
                level={levelFill()}
                off={false}
                onTap={toggleNormalLevel}
                onLevel={setLevelFromFill}
                valueLabel={`${levelPercent()}%`}
                valueText={`${levelPercent()} percent`}
                keyStep={
                  Math.max(1, percentOf(props.musicLevelRange!.step)) /
                  (percentOf(props.musicLevelRange!.max) -
                    percentOf(props.musicLevelRange!.min))
                }
                dragRange={120}
                ariaLabel="Music level"
                title="Music level — drag to turn the backing track back up if your phone quietened it"
              >
                <MusicLevelIcon />
              </PillControl>
            </Show>
          </div>
        </div>
      </div>

      {/* ── Load / error states ────────────────────────────── */}
      {/* On a phone this stage is the whole product — there is no mixer
          behind it showing the download. "Raising the curtain…" on its own
          was a spinner without a clock: on a slow link a demo song's stems
          are minutes, and a screen that says nothing for two of them reads
          as broken. Same byte-based numbers the mixer shows, same honesty
          about what cannot be measured. */}
      {/* The error wins: `loadStems` sets it and then carries on with the
          MIDI pass before clearing `loading`, so both used to be true at
          once and the phone stacked two blurred veils, the failure behind
          the curtain that had already failed. */}
      <Show when={props.loading() && props.loadError() === ''}>
        <div class={styles.stateOverlay}>
          <div class={styles.loadCard}>
            <p>{loadHeadline()}</p>
            <div
              class={styles.loadTrack}
              classList={{ [styles.loadTrackIndeterminate]: !determinate() }}
              role="progressbar"
              aria-label="Loading the song"
              aria-valuemin={determinate() ? 0 : undefined}
              aria-valuemax={determinate() ? 100 : undefined}
              aria-valuenow={determinate() ? loadPct() : undefined}
              aria-valuetext={loadDetail()}
            >
              <div
                class={styles.loadFill}
                style={determinate() ? { width: `${loadPct()}%` } : undefined}
              />
            </div>
            <p class={styles.loadDetail}>{loadDetail()}</p>
            {/* The way out, while it is still working. The header's back
                chevron is behind this overlay's blur, which on a download
                that runs for minutes reads as no way out at all. */}
            <Show when={props.onBack}>
              <div class={styles.stateActions}>
                <button
                  type="button"
                  class={styles.stateAction}
                  onClick={() => props.onBack?.()}
                >
                  Go back
                </button>
              </div>
            </Show>
          </div>
        </div>
      </Show>
      <Show when={props.loadError() !== ''}>
        <div class={styles.stateOverlay}>
          <div class={styles.loadCard} role="alert">
            <p>{props.loadError()}</p>
            <Show when={props.onRetryLoad ?? props.onBack}>
              <div class={styles.stateActions}>
                <Show when={props.onRetryLoad}>
                  <button
                    type="button"
                    class={`${styles.stateAction} ${styles.stateActionPrimary}`}
                    onClick={() => props.onRetryLoad?.()}
                  >
                    Try again
                  </button>
                </Show>
                <Show when={props.onBack}>
                  <button
                    type="button"
                    class={styles.stateAction}
                    onClick={() => props.onBack?.()}
                  >
                    Go back
                  </button>
                </Show>
              </div>
            </Show>
          </div>
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
