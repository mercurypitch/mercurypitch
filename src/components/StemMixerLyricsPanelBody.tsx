// ============================================================
// StemMixerLyricsPanelBody — shared lyrics body content (used by both layouts)
// ============================================================

import type { Accessor, Component, Setter } from 'solid-js'
import { createEffect, createSignal, For, on, onCleanup, onMount, Show, } from 'solid-js'
import { SafeSelect } from '@/components/shared/SafeSelect'
import type { BlockInfo, BlockInstancesMap, BlockStartsInfo, CanonicalLrcEntry, DisplayLine, GenViewLine, LrcGenInputMode, LyricsBlock, WordSweepPoint, WordTimingsMap, } from '@/features/stem-mixer/types'
import type { LyricsAlign } from '@/features/stem-mixer/useStemMixerLyricsController'
import type { LyricsSearchMatch } from '@/lib/lyrics-service'
import { buildForwardMarkerPath } from '@/lib/marker-path'
import type { AlignmentResult } from '@/lib/pitch-word-alignment'
import { formatPlaybackSpeed, STEM_MIXER_PLAYBACK_SPEEDS, } from '@/lib/playback-speed-options'
import { LyricsSongPicker } from './LyricsSongPicker'
import type { LyricsUploadResult } from './LyricsUploader'
import { LyricsUploader } from './LyricsUploader'
import { RestCountdownDots } from './RestCountdownDots'

interface ParsedLyric {
  key: string
  time: number
  endTime: number
  words: string[]
  wordTimes?: number[]
  wordEndTimes?: number[]
  wordSweeps?: Record<number, WordSweepPoint[]>
}

export interface StemMixerLyricsPanelBodyProps {
  // State signals
  lyricsSource: Accessor<string>
  lyricsLoading: Accessor<boolean>
  showSongPicker: Accessor<boolean>
  setShowSongPicker: Setter<boolean>
  songPickerQuery: Accessor<string>
  setSongPickerQuery: Setter<string>
  songMatches: Accessor<LyricsSearchMatch[]>
  lyricsFontSize: Accessor<number>
  setLyricsFontSize: Setter<number>
  lyricsColumns: Accessor<1 | 2>
  setLyricsColumns: Setter<1 | 2>
  lyricsAlign: Accessor<LyricsAlign>
  editMode: Accessor<boolean>
  setEditMode: Setter<boolean>
  setEditBuffer: Setter<WordTimingsMap>
  editPopover: Accessor<{
    lineIdx: number
    wordIdx: number
    word: string
  } | null>
  lrcGenMode: Accessor<boolean>
  lrcGenLineIdx: Accessor<number>
  lrcGenWordIdx: Accessor<number>
  lrcGenInputMode: Accessor<LrcGenInputMode>
  setLrcGenInputMode: Setter<LrcGenInputMode>
  lrcTimingOffsetMs: Accessor<number>
  setLrcTimingOffsetMs: Setter<number>
  blocks: Accessor<LyricsBlock[]>
  blockInstances: Accessor<BlockInstancesMap>
  blockMarkMode: Accessor<boolean>
  setBlockMarkMode: Setter<boolean>
  markStartLine: Accessor<number | null>
  setMarkStartLine: Setter<number | null>
  markEndLine: Accessor<number | null>
  setMarkEndLine: Setter<number | null>
  blockEditTarget: Accessor<string | null>
  setBlockEditTarget: Setter<string | null>
  currentLineIdx: Accessor<number>
  handleSeekToTime?: (time: number) => void
  lyricsLines: Accessor<string[]>
  lrcLines: Accessor<{ text: string; time: number }[]>

  // Memos
  canonicalLrcLines: Accessor<CanonicalLrcEntry[]>
  stableParsedLyrics: Accessor<Map<number, ParsedLyric>>
  blockStarts: Accessor<Map<number, BlockStartsInfo>>
  displayLines: Accessor<DisplayLine[]>
  genViewData: Accessor<GenViewLine[]>
  hasMultipleSections: Accessor<boolean>

  // Actions
  handleNextLine: () => void
  handleNextWord: () => void
  handleMarkerSample: (
    lineIdx: number,
    wordIdx: number,
    progress: number,
    elapsedTime: number,
    phase: 'start' | 'move' | 'end',
  ) => void
  handleRedoCurrentLine: () => void
  handleLrcGenFinish: () => void
  handleLrcGenReset: () => void
  handleSaveEdits: () => void
  handleLineTimeEdit: (idx: number, value: string) => void
  getEditWordTime: (lineIdx: number, wordIdx: number) => number
  getEditLineTime: (lineIdx: number) => number
  openWordPopover: (
    lineIdx: number,
    wordIdx: number,
    word: string,
    e: MouseEvent,
  ) => void
  closeWordPopover: () => void
  commitPopoverValue: (value: string) => void
  formatTimeMs: (ms: number) => string
  handleLyricLineClick: (idx: number) => void
  handleMarkBlock: (label: string, repeat: number) => void
  handleUnlinkInstance: (blockId: string, instanceIdx: number) => void
  handleDeleteBlock: (blockId: string) => void
  handleAddInstance: (
    blockId: string,
    startLine: number,
    endLine: number,
  ) => void
  handleEditBlock: (blockId: string, label: string, repeat: number) => void
  getBlockColor: (blockId: string) => string
  getBlockById: (blockId: string) => LyricsBlock | undefined
  getBlockForLine: (lineIdx: number) => BlockInfo | null
  computeActiveWord: (
    words: string[],
    lineTime: number,
    endTime: number,
    wordTimes: number[] | undefined,
    elapsed: number,
    wordEndTimes?: number[],
    wordSweeps?: Record<number, WordSweepPoint[]>,
  ) => { activeUpTo: number; charProgress: number; fraction: number }
  getGenLines: () => string[]

  // Audio
  playing: Accessor<boolean>
  elapsed: Accessor<number>
  playbackSpeed: Accessor<number>
  setPlaybackSpeed: (speed: number) => void
  handlePlay: () => void
  handlePause: () => void

  // Canvas
  formatTime: (t: number) => string

  // Misc
  songTitle: string
  lrclibSearchUrl: Accessor<string | undefined>
  cancelSearch: () => void
  handleLyricsUpload: (result: LyricsUploadResult) => void
  handleSongPick: (match: LyricsSearchMatch) => Promise<void>
  handleSongPickerRefine: () => Promise<void>
  idSuffix?: string
  triggerChangeFile?: () => void

  // Note labels on words
  showLyricNoteLabels: Accessor<boolean>
  alignmentResult: Accessor<AlignmentResult>

  // Loop lyric marking
  loopStartLyricIdx: Accessor<number | null>
  loopEndLyricIdx: Accessor<number | null>
  onSetLoopLyric: (idx: number) => void
}

export const StemMixerLyricsPanelBody: Component<
  StemMixerLyricsPanelBodyProps
> = (props) => {
  const sfx = () => props.idSuffix ?? ''

  interface MarkerTarget {
    lineIdx: number
    wordIdx: number
    progress: number
  }

  const [markerVisual, setMarkerVisual] = createSignal<MarkerTarget | null>(
    null,
  )
  let markerPointerId: number | null = null
  let latestMarkerTarget: MarkerTarget | null = null
  let latestMarkerElapsed: number | null = null
  let latestElapsed = 0

  // Pointer callbacks read a plain clock snapshot so reactive values never
  // escape the component's tracked root.
  createEffect(() => {
    latestElapsed = props.elapsed()
  })

  const markerTargetAt = (
    clientX: number,
    clientY: number,
  ): MarkerTarget | null => {
    let wordEl = document
      .elementFromPoint(clientX, clientY)
      ?.closest<HTMLElement>('[data-marker-word]')
    if (!wordEl) {
      const candidates = [
        ...document.querySelectorAll<HTMLElement>(
          '.sm-lyrics-gen-line-current [data-marker-word]',
        ),
      ]
      wordEl =
        candidates
          .filter((candidate) => {
            const rect = candidate.getBoundingClientRect()
            return clientY >= rect.top - 24 && clientY <= rect.bottom + 24
          })
          .sort((a, b) => {
            const distance = (candidate: HTMLElement) => {
              const rect = candidate.getBoundingClientRect()
              if (clientX < rect.left) return rect.left - clientX
              if (clientX > rect.right) return clientX - rect.right
              return 0
            }
            return distance(a) - distance(b)
          })[0] ?? undefined
    }
    if (wordEl === undefined) return null
    const lineIdx = Number(wordEl.dataset.markerLine)
    const wordIdx = Number(wordEl.dataset.markerWord)
    if (!Number.isInteger(lineIdx) || !Number.isInteger(wordIdx)) return null
    const rect =
      wordEl
        .querySelector<HTMLElement>('.sm-lyrics-gen-word-text')
        ?.getBoundingClientRect() ?? wordEl.getBoundingClientRect()
    const progress =
      rect.width > 0
        ? Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
        : 0
    return { lineIdx, wordIdx, progress }
  }

  const updateMarkerVisual = (target: MarkerTarget | null) => {
    latestMarkerTarget = target
    setMarkerVisual(target)
  }

  const sendMarkerPath = (target: MarkerTarget, phase: 'move' | 'end') => {
    const previous = latestMarkerTarget
    if (
      previous !== null &&
      previous.lineIdx === target.lineIdx &&
      target.wordIdx < previous.wordIdx
    ) {
      return
    }

    if (previous !== null && latestMarkerElapsed !== null) {
      const samples = buildForwardMarkerPath(
        previous,
        target,
        latestMarkerElapsed,
        latestElapsed,
      )
      for (const [index, sample] of samples.entries()) {
        props.handleMarkerSample(
          sample.target.lineIdx,
          sample.target.wordIdx,
          sample.target.progress,
          sample.elapsed,
          index === samples.length - 1 ? phase : 'move',
        )
      }
      latestMarkerElapsed = samples.at(-1)?.elapsed ?? latestElapsed
    } else {
      props.handleMarkerSample(
        target.lineIdx,
        target.wordIdx,
        target.progress,
        latestElapsed,
        phase,
      )
      latestMarkerElapsed = latestElapsed
    }

    updateMarkerVisual(target)
  }

  const startMarkerGesture = (e: PointerEvent) => {
    if (props.lrcGenInputMode() !== 'marker') return
    const target = markerTargetAt(e.clientX, e.clientY)
    if (!target || target.lineIdx !== props.lrcGenLineIdx()) return
    if (target.wordIdx !== props.lrcGenWordIdx()) return

    e.preventDefault()
    e.stopPropagation()
    markerPointerId = e.pointerId
    updateMarkerVisual(target)
    latestMarkerElapsed = latestElapsed
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    if (!props.playing()) props.handlePlay()
    props.handleMarkerSample(
      target.lineIdx,
      target.wordIdx,
      target.progress,
      latestElapsed,
      'start',
    )
  }

  const moveMarkerGesture = (e: PointerEvent) => {
    if (markerPointerId !== e.pointerId) return
    e.preventDefault()
    const samples =
      typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : [e]
    const sample = samples.at(-1) ?? e
    const target = markerTargetAt(sample.clientX, sample.clientY)
    if (!target || target.lineIdx !== props.lrcGenLineIdx()) return
    sendMarkerPath(target, 'move')
  }

  const endMarkerGesture = (e: PointerEvent) => {
    if (markerPointerId !== e.pointerId) return
    e.preventDefault()
    e.stopPropagation()
    const target =
      markerTargetAt(e.clientX, e.clientY) ?? latestMarkerTarget ?? undefined
    if (target) {
      sendMarkerPath(target, 'move')
      sendMarkerPath(target, 'end')
    }
    if ((e.currentTarget as HTMLElement).hasPointerCapture(e.pointerId)) {
      ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
    }
    markerPointerId = null
    updateMarkerVisual(null)
    latestMarkerElapsed = null
  }

  // Pinch-to-zoom font size state
  let lyricsLinesRef: HTMLDivElement | undefined
  let lyricsPinchDist = 0
  let lyricsPinchStartSize = 0

  const handleLyricsTouchStart = (e: TouchEvent) => {
    if (e.touches.length === 2) {
      lyricsPinchDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY,
      )
      lyricsPinchStartSize = props.lyricsFontSize()
    }
  }

  const handleLyricsTouchMove = (e: TouchEvent) => {
    if (e.touches.length !== 2 || lyricsPinchDist === 0) return
    e.preventDefault()
    const curDist = Math.hypot(
      e.touches[0].clientX - e.touches[1].clientX,
      e.touches[0].clientY - e.touches[1].clientY,
    )
    const ratio = curDist / lyricsPinchDist
    const dampenedRatio = 1 + (ratio - 1) * 0.3
    const newSize = Math.min(
      4,
      Math.max(0.45, lyricsPinchStartSize * dampenedRatio),
    )
    props.setLyricsFontSize(newSize)
  }

  const handleLyricsTouchEnd = () => {
    lyricsPinchDist = 0
  }

  onMount(() => {
    const el = lyricsLinesRef
    if (!el) return
    el.addEventListener('touchstart', handleLyricsTouchStart, {
      passive: false,
    })
    el.addEventListener('touchmove', handleLyricsTouchMove, { passive: false })
    el.addEventListener('touchend', handleLyricsTouchEnd)
  })

  onCleanup(() => {
    const el = lyricsLinesRef
    if (!el) return
    el.removeEventListener('touchstart', handleLyricsTouchStart)
    el.removeEventListener('touchmove', handleLyricsTouchMove)
    el.removeEventListener('touchend', handleLyricsTouchEnd)
  })

  // Auto-scroll LRC generator view to the currently active line
  createEffect(
    on(
      () => props.lrcGenLineIdx(),
      () => {
        if (props.lrcGenMode() && props.playing()) {
          requestAnimationFrame(() => {
            const el = document.querySelector('.sm-lyrics-gen-line-current')
            if (el) {
              el.scrollIntoView({ behavior: 'smooth', block: 'center' })
            }
          })
        }
      },
    ),
  )

  // Look up the mapped note for a word by temporal overlap with alignment data
  const getWordNote = (
    parsedLyric: ParsedLyric,
    wi: number,
  ): { noteName: string; midi: number } | null => {
    if (!props.showLyricNoteLabels()) return null
    const result = props.alignmentResult()
    if (result.alignedWords.length === 0) return null

    const wordTimes = parsedLyric.wordTimes
    let wordStart: number
    let wordEnd: number
    if (wordTimes && wordTimes.length > 0 && wordTimes[wi] !== undefined) {
      wordStart = wordTimes[wi]
      wordEnd =
        parsedLyric.wordEndTimes?.[wi] ??
        (wi + 1 < wordTimes.length ? wordTimes[wi + 1] : parsedLyric.endTime)
    } else {
      const wordCount = parsedLyric.words.length
      const duration = parsedLyric.endTime - parsedLyric.time
      const perWord = Math.max(0.05, duration / wordCount)
      wordStart = parsedLyric.time + wi * perWord
      wordEnd = wordStart + perWord
    }

    let best: { noteName: string; midi: number } | null = null
    let bestOverlap = 0
    for (const aw of result.alignedWords) {
      if (aw.midi == null) continue
      const overlap = Math.max(
        0,
        Math.min(wordEnd, aw.endSec) - Math.max(wordStart, aw.startSec),
      )
      if (overlap > bestOverlap) {
        bestOverlap = overlap
        best = { noteName: aw.noteName!, midi: aw.midi }
      }
    }
    return best
  }

  return (
    <>
      <Show when={props.lyricsLoading()}>
        <div class="sm-lyrics-loading">
          <div class="sm-lyrics-loading-inner">
            <div class="sm-lyrics-loading-spinner" />
            <div class="sm-lyrics-loading-text">Searching for lyrics...</div>
            <div class="sm-lyrics-loading-actions">
              <button
                class="sm-lyrics-loading-btn sm-lyrics-loading-cancel"
                onClick={() => props.cancelSearch()}
              >
                Cancel
              </button>
              <button
                class="sm-lyrics-loading-btn sm-lyrics-loading-upload"
                onClick={() => {
                  props.cancelSearch()
                  props.triggerChangeFile?.()
                }}
              >
                Upload LRC / TXT
              </button>
            </div>
          </div>
        </div>
      </Show>

      <Show
        when={
          !props.lyricsLoading() &&
          props.lyricsSource() !== 'none' &&
          !props.showSongPicker()
        }
      >
        {/* ── LRC Generator toolbar ─────────────────────── */}
        <Show when={props.lrcGenMode()}>
          <div class="sm-lyrics-gen-toolbar">
            <Show when={!props.playing()}>
              <button
                class="sm-lyrics-gen-play-btn"
                onClick={() => props.handlePlay()}
                title="Play"
              >
                <svg viewBox="0 0 24 24" width="12" height="12">
                  <path fill="currentColor" d="M8 5v14l11-7z" />
                </svg>
              </button>
            </Show>
            <Show when={props.playing()}>
              <button
                class="sm-lyrics-gen-pause-btn"
                onClick={() => props.handlePause()}
                title="Pause"
              >
                <svg viewBox="0 0 24 24" width="12" height="12">
                  <path
                    fill="currentColor"
                    d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"
                  />
                </svg>
              </button>
            </Show>
            <span class="sm-lyrics-gen-progress">
              {Math.min(props.lrcGenLineIdx(), props.getGenLines().length)}/
              {props.getGenLines().length}
              {(() => {
                const lines = props.getGenLines()
                const idx = props.lrcGenLineIdx()
                if (idx < lines.length) {
                  const wc = lines[idx]
                    .split(/\s+/)
                    .filter((w: string) => w.length > 0).length
                  return (
                    <>
                      {' '}
                      w{Math.min(props.lrcGenWordIdx(), wc)}/{wc}
                    </>
                  )
                }
                return null
              })()}
            </span>
            <div
              class="sm-lyrics-gen-mode-switch"
              role="group"
              aria-label="Lyric mapping input"
            >
              <button
                classList={{
                  'sm-lyrics-gen-mode-btn': true,
                  'sm-lyrics-gen-mode-btn--active':
                    props.lrcGenInputMode() === 'marker',
                }}
                aria-pressed={props.lrcGenInputMode() === 'marker'}
                onClick={() => props.setLrcGenInputMode('marker')}
              >
                Marker
              </button>
              <button
                classList={{
                  'sm-lyrics-gen-mode-btn': true,
                  'sm-lyrics-gen-mode-btn--active':
                    props.lrcGenInputMode() === 'tap',
                }}
                aria-pressed={props.lrcGenInputMode() === 'tap'}
                onClick={() => props.setLrcGenInputMode('tap')}
              >
                Tap
              </button>
            </div>
            <label class="sm-lyrics-gen-speed">
              <span>Speed</span>
              <SafeSelect
                class="sm-lyrics-gen-speed-select"
                value={String(props.playbackSpeed())}
                onChange={(e) =>
                  props.setPlaybackSpeed(Number(e.currentTarget.value))
                }
                aria-label="Mapping playback speed"
              >
                <For each={STEM_MIXER_PLAYBACK_SPEEDS}>
                  {(speed) => (
                    <option value={speed}>{formatPlaybackSpeed(speed)}</option>
                  )}
                </For>
              </SafeSelect>
            </label>
            <label class="sm-lyrics-gen-offset">
              <span>Reaction</span>
              <input
                type="number"
                min="0"
                max="500"
                step="10"
                value={props.lrcTimingOffsetMs()}
                onChange={(e) => {
                  const value = Number(e.currentTarget.value)
                  props.setLrcTimingOffsetMs(
                    Number.isFinite(value)
                      ? Math.max(0, Math.min(500, value))
                      : 0,
                  )
                }}
                aria-label="Reaction correction in milliseconds"
              />
              <span>ms</span>
            </label>
            {(() => {
              const idx = props.lrcGenLineIdx()
              const lines = props.getGenLines()
              if (idx < lines.length) {
                const bi = props.getBlockForLine(idx)
                if (bi) {
                  const block = props.getBlockById(bi.blockId)
                  const total = props.blockInstances()[bi.blockId]?.length ?? 1
                  if (block) {
                    return (
                      <span class="sm-lyrics-gen-instance-badge">
                        {block.label} ({bi.instanceIdx + 1}/{total})
                      </span>
                    )
                  }
                }
              }
              return null
            })()}
            <Show when={props.lrcGenInputMode() === 'tap'}>
              <button
                class="sm-lyrics-gen-nextword-btn"
                onClick={() => props.handleNextWord()}
                title="Stamp the next word onset [W]"
              >
                Next Word
              </button>
              <button
                class="sm-lyrics-gen-nextline-btn"
                onClick={() => props.handleNextLine()}
                title="Stamp the next line onset [L]"
              >
                Next Line
              </button>
            </Show>
            <button
              class="sm-lyrics-gen-redo-btn"
              onClick={() => props.handleRedoCurrentLine()}
              title="Clear and replay the current line"
            >
              Redo line
            </button>
            <button
              class="sm-lyrics-gen-finish-btn"
              onClick={() => props.handleLrcGenFinish()}
              title="Save LRC"
            >
              Finish
            </button>
            <button
              class="sm-lyrics-gen-reset-btn"
              onClick={() => props.handleLrcGenReset()}
              title="Restore the lyrics and timings from before this mapping session"
            >
              Discard changes
            </button>
          </div>
          <div class="sm-lyrics-gen-guidance" role="note">
            <Show
              when={props.lrcGenInputMode() === 'marker'}
              fallback={
                <>
                  Tap at the first audible sound of each word, not after the
                  singer finishes it. Use Next Line only to skip the remaining
                  words.
                </>
              }
            >
              Press the highlighted word when its first sound begins, then drag
              through the text as it is sung. Hold still on long vowels and lift
              at a pause or after the final sound.
            </Show>
            <span class="sm-lyrics-gen-guidance-performance">
              Pitch and live monitors pause for smoother input; the vocal
              overview stays active. Discard changes restores your pre-mapping
              snapshot.
            </span>
          </div>
        </Show>

        {/* ── LRC Generator view ────────────────────────── */}
        <Show when={props.lrcGenMode()}>
          <div
            class="sm-lyrics-lines sm-lyrics-gen-lines"
            style={{ 'font-size': `${props.lyricsFontSize()}rem` }}
            onWheel={(e) => {
              e.stopPropagation()
              if (e.ctrlKey || e.metaKey) {
                e.preventDefault()
                props.setLyricsFontSize((prev) =>
                  Math.min(
                    3,
                    Math.max(0.45, +(prev - e.deltaY * 0.001).toFixed(2)),
                  ),
                )
              }
            }}
          >
            <For
              each={(() => {
                const items = props.genViewData()
                const out: {
                  type: 'line' | 'placeholder'
                  item: GenViewLine
                  bi?: BlockInfo
                  block?: LyricsBlock
                  total?: number
                }[] = []
                let skipUntil = -1
                for (let i = 0; i < items.length; i++) {
                  if (i < skipUntil) continue
                  const item = items[i]
                  if (item.isPlaceholder) {
                    if (item.isPlaceholderStart) {
                      const bi = item.blockInfo!
                      const block = props.getBlockById(bi.blockId)
                      const total =
                        props.blockInstances()[bi.blockId]?.length ?? 1
                      const instance =
                        props.blockInstances()[bi.blockId]?.[bi.instanceIdx]
                      skipUntil = instance?.[1] ?? i + 1
                      out.push({ type: 'placeholder', item, bi, block, total })
                    }
                  } else {
                    out.push({ type: 'line', item })
                  }
                }
                return out
              })()}
            >
              {(row) => {
                if (row.type === 'placeholder') {
                  const { item, bi, block, total } = row
                  const instance =
                    props.blockInstances()[bi!.blockId]?.[bi!.instanceIdx]
                  return (
                    <div
                      class="sm-lyrics-gen-line sm-lyrics-gen-line-placeholder"
                      data-lyrics-index={item.index}
                      data-lyrics-end-index={
                        (instance?.[1] ?? item.index + 1) - 1
                      }
                      style={{
                        '--block-color': props.getBlockColor(bi!.blockId),
                        cursor: 'pointer',
                      }}
                      onClick={() => props.handleLyricLineClick(item.index)}
                    >
                      <span class="sm-lyrics-gen-line-time">
                        {item.lineTime !== undefined
                          ? props.formatTimeMs(item.lineTime)
                          : '--:--'}
                      </span>
                      <span class="sm-lyrics-gen-placeholder-text">
                        {block?.label ?? 'Block'} (repeat {bi!.instanceIdx + 1}/
                        {total}) — timings copied from template
                      </span>
                    </div>
                  )
                }

                const item = row.item
                if (item.isRest) {
                  const gapStart = item.restGapStart ?? 0
                  const gapEnd = item.restGapEnd ?? gapStart
                  const dotCount = item.restDotCount ?? 0
                  if (dotCount <= 0 || gapEnd <= gapStart) return null
                  return (
                    <div
                      class="sm-lyrics-gen-line sm-lyrics-gen-line-rest"
                      data-lyrics-index={item.index}
                    >
                      <span class="sm-lyrics-gen-line-time">
                        {props.formatTimeMs(gapStart)}
                      </span>
                      <span class="sm-lyrics-gen-line-text">
                        <RestCountdownDots
                          dotCount={dotCount}
                          elapsed={props.elapsed}
                          gapEnd={gapEnd}
                          gapStart={gapStart}
                          onSeek={props.handleSeekToTime}
                        />
                      </span>
                    </div>
                  )
                }
                return (
                  <div
                    class={`sm-lyrics-gen-line${item.isCurrent ? ' sm-lyrics-gen-line-current' : ''}${item.isDone ? ' sm-lyrics-gen-line-done' : ''}${item.isFuture ? ' sm-lyrics-gen-line-future' : ''}${item.blockInfo?.isTemplate === true ? ' sm-lyrics-gen-line-template' : ''}${item.isCurrent && props.lrcGenInputMode() === 'marker' ? ' sm-lyrics-gen-line-marker-mode' : ''}`}
                    data-lyrics-index={item.index}
                    style={
                      item.blockInfo?.isTemplate === true
                        ? {
                            '--block-color': props.getBlockColor(
                              item.blockInfo.blockId,
                            ),
                            cursor: 'pointer',
                          }
                        : { cursor: 'pointer' }
                    }
                    onPointerDown={(e) => {
                      if (item.isCurrent) startMarkerGesture(e)
                    }}
                    onPointerMove={(e) => {
                      if (item.isCurrent) moveMarkerGesture(e)
                    }}
                    onPointerUp={(e) => {
                      if (item.isCurrent) endMarkerGesture(e)
                    }}
                    onPointerCancel={(e) => {
                      if (item.isCurrent) endMarkerGesture(e)
                    }}
                    onClick={() => {
                      if (
                        !item.isCurrent ||
                        props.lrcGenInputMode() !== 'marker'
                      ) {
                        props.handleLyricLineClick(item.index)
                      }
                    }}
                  >
                    <span class="sm-lyrics-gen-line-time">
                      {item.lineTime !== undefined
                        ? props.formatTimeMs(item.lineTime)
                        : '--:--'}
                    </span>
                    <span class="sm-lyrics-gen-line-text">
                      {item.words.length === 0
                        ? item.line
                        : item.words.map((word: string, wi: number) => {
                            const progress = () => {
                              if (item.activeWordIdx === wi) {
                                const live = markerVisual()
                                if (
                                  live?.lineIdx === item.index &&
                                  live.wordIdx === wi
                                ) {
                                  return live.progress
                                }
                              }
                              const points = item.wordSweeps?.[wi]
                              return points?.[points.length - 1]?.progress ?? 0
                            }
                            return (
                              <span
                                class={`sm-lyrics-gen-word${
                                  item.activeWordIdx === wi
                                    ? ' sm-lyrics-gen-word-current'
                                    : ''
                                }${
                                  item.activeWordIdx >= 0 &&
                                  wi < item.activeWordIdx
                                    ? ' sm-lyrics-gen-word-done'
                                    : ''
                                }${
                                  item.isCurrent &&
                                  props.lrcGenInputMode() === 'marker'
                                    ? ' sm-lyrics-gen-word-marker'
                                    : ''
                                }`}
                                data-marker-line={item.index}
                                data-marker-word={wi}
                                aria-current={
                                  item.activeWordIdx === wi ? 'true' : undefined
                                }
                                style={{
                                  '--marker-progress': `${(
                                    progress() * 100
                                  ).toFixed(1)}%`,
                                }}
                              >
                                <span class="sm-lyrics-gen-word-time">
                                  {item.wordTimes?.[wi] !== undefined
                                    ? props.formatTimeMs(item.wordTimes[wi])
                                    : ''}
                                </span>
                                <span class="sm-lyrics-gen-word-text">
                                  {word}
                                </span>
                              </span>
                            )
                          })}
                    </span>
                  </div>
                )
              }}
            </For>
          </div>
        </Show>

        {/* ── Edit mode toolbar ────────────────────────── */}
        <Show when={props.editMode()}>
          <div class="sm-lyrics-edit-toolbar">
            <button
              class="sm-lyrics-save-btn"
              onClick={() => props.handleSaveEdits()}
            >
              Save
            </button>
            <button
              class="sm-lyrics-cancel-btn"
              onClick={() => {
                props.setEditBuffer({})
                props.setEditMode(false)
              }}
            >
              Cancel
            </button>
          </div>
        </Show>

        {/* ── Edit mode view ───────────────────────────── */}
        <Show when={props.editMode()}>
          <div
            class="sm-lyrics-lines sm-lyrics-lines-edit"
            style={{ 'font-size': `${props.lyricsFontSize()}rem` }}
            onWheel={(e) => {
              e.stopPropagation()
              if (e.ctrlKey || e.metaKey) {
                e.preventDefault()
                props.setLyricsFontSize((prev) =>
                  Math.min(
                    3,
                    Math.max(0.45, +(prev - e.deltaY * 0.001).toFixed(2)),
                  ),
                )
              }
            }}
          >
            <For each={props.canonicalLrcLines()}>
              {(entry) => {
                if (entry.type === 'rest') {
                  return (
                    <div class="sm-lyrics-line-edit sm-lyrics-line-rest">
                      <span class="sm-lyrics-time-input sm-time-display">
                        {props.formatTimeMs(entry.time)}
                      </span>
                      <span class="sm-lyrics-rest-label">~Rest~</span>
                    </div>
                  )
                }
                const lineIdx = entry.lrcIndex
                return (
                  <div class="sm-lyrics-line-edit">
                    <input
                      class="sm-lyrics-time-input"
                      type="text"
                      value={props.formatTimeMs(props.getEditLineTime(lineIdx))}
                      onChange={(e) =>
                        props.handleLineTimeEdit(lineIdx, e.currentTarget.value)
                      }
                    />
                    <For each={entry.words}>
                      {(word, wi) => (
                        <span class="sm-lyrics-word-edit">
                          <span class="sm-lyrics-word-text">{word}</span>
                          <span
                            class="sm-lyrics-word-time-label"
                            onClick={(e) =>
                              props.openWordPopover(lineIdx, wi(), word, e)
                            }
                          >
                            {props.formatTimeMs(
                              props.getEditWordTime(lineIdx, wi()),
                            )}
                          </span>
                        </span>
                      )}
                    </For>
                  </div>
                )
              }}
            </For>
          </div>

          {/* ── Word time edit popover ──────────────── */}
          <Show when={props.editPopover() !== null}>
            <div
              class="sm-lyrics-popover-backdrop"
              onClick={() => props.closeWordPopover()}
            >
              <div
                class="sm-lyrics-popover-card"
                onClick={(e) => e.stopPropagation()}
              >
                <div class="sm-lyrics-popover-word">
                  {props.editPopover()!.word}
                </div>
                <input
                  class="sm-lyrics-popover-input"
                  type="text"
                  value={
                    props.editPopover()
                      ? props.formatTimeMs(
                          props.getEditWordTime(
                            props.editPopover()!.lineIdx,
                            props.editPopover()!.wordIdx,
                          ),
                        )
                      : ''
                  }
                  onChange={(e) =>
                    props.commitPopoverValue(e.currentTarget.value)
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') props.closeWordPopover()
                    if (e.key === 'Enter')
                      props.commitPopoverValue(e.currentTarget.value)
                  }}
                  ref={(el) => {
                    setTimeout(() => (el as HTMLInputElement)?.select(), 10)
                  }}
                />
                <div class="sm-lyrics-popover-hint">
                  Enter time (MM:SS) – press Enter or click outside to save
                </div>
              </div>
            </div>
          </Show>
        </Show>

        {/* ── Normal view ──────────────────────────────── */}
        <Show when={!props.editMode() && !props.lrcGenMode()}>
          {/* ── Block edit popover ─────────────────────── */}
          <Show when={props.blockEditTarget() !== null}>
            <div class="sm-lyrics-block-edit-popover">
              {(() => {
                const b = props.getBlockById(props.blockEditTarget()!)
                if (!b) return null
                return (
                  <>
                    <input
                      type="text"
                      class="sm-lyrics-block-form-label"
                      value={b.label}
                      id={`block-edit-label-input${sfx()}`}
                    />
                    <input
                      type="number"
                      class="sm-lyrics-block-form-repeat"
                      value={b.repeatCount}
                      min="1"
                      max="20"
                      id={`block-edit-repeat-input${sfx()}`}
                      title="Repeat count"
                    />
                    <button
                      class="sm-lyrics-block-form-btn"
                      onClick={() => {
                        const label =
                          (
                            document.getElementById(
                              `block-edit-label-input${sfx()}`,
                            ) as HTMLInputElement
                          )?.value?.trim() || b.label
                        const repeat = parseInt(
                          (
                            document.getElementById(
                              `block-edit-repeat-input${sfx()}`,
                            ) as HTMLInputElement
                          )?.value || '1',
                          10,
                        )
                        props.handleEditBlock(b.id, label, repeat)
                      }}
                    >
                      Save
                    </button>
                    <button
                      class="sm-lyrics-block-form-cancel"
                      onClick={() => props.setBlockEditTarget(null)}
                    >
                      Cancel
                    </button>
                    <button
                      class="sm-lyrics-block-delete-btn"
                      onClick={() => props.handleDeleteBlock(b.id)}
                      title="Delete block"
                    >
                      <svg viewBox="0 0 24 24" width="10" height="10">
                        <path
                          fill="currentColor"
                          d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"
                        />
                      </svg>
                    </button>
                  </>
                )
              })()}
            </div>
          </Show>

          {/* ── Mark mode toolbar ─────────────────────── */}
          <Show when={props.blockMarkMode()}>
            <div class="sm-lyrics-mark-toolbar">
              <span class="sm-lyrics-mark-status">
                {props.markStartLine() === null
                  ? 'Select a range of lines'
                  : props.markEndLine() === null
                    ? `Line ${props.markStartLine()! + 1} — click end line`
                    : `${props.markEndLine()! - props.markStartLine()!} line${props.markEndLine()! - props.markStartLine()! !== 1 ? 's' : ''} selected`}
              </span>
              <Show
                when={
                  props.markStartLine() !== null && props.markEndLine() !== null
                }
              >
                <div class="sm-lyrics-mark-actions">
                  <input
                    type="text"
                    class="sm-lyrics-block-form-label"
                    placeholder="Chorus, Verse 1..."
                    id={`block-label-input${sfx()}`}
                  />
                  <input
                    type="number"
                    class="sm-lyrics-block-form-repeat"
                    value="1"
                    min="1"
                    max="20"
                    id={`block-repeat-input${sfx()}`}
                    title="Repeat count"
                  />
                  <button
                    class="sm-lyrics-block-form-btn"
                    onClick={() => {
                      const label =
                        (
                          document.getElementById(
                            `block-label-input${sfx()}`,
                          ) as HTMLInputElement
                        )?.value?.trim() || 'Block'
                      const repeat = parseInt(
                        (
                          document.getElementById(
                            `block-repeat-input${sfx()}`,
                          ) as HTMLInputElement
                        )?.value || '1',
                        10,
                      )
                      props.handleMarkBlock(label, repeat)
                    }}
                  >
                    Mark as New Block
                  </button>
                  <Show when={props.blocks().length > 0}>
                    <SafeSelect
                      class="sm-lyrics-mark-add-select"
                      onChange={(e) => {
                        const val = e.currentTarget.value
                        if (val)
                          props.handleAddInstance(
                            val,
                            props.markStartLine()!,
                            props.markEndLine()!,
                          )
                      }}
                    >
                      <option value="">Add to existing block...</option>
                      <For each={props.blocks()}>
                        {(b) => <option value={b.id}>{b.label}</option>}
                      </For>
                    </SafeSelect>
                  </Show>
                </div>
              </Show>
              <button
                class="sm-lyrics-mark-toolbar-cancel"
                onClick={() => {
                  props.setMarkStartLine(null)
                  props.setMarkEndLine(null)
                  props.setBlockMarkMode(false)
                }}
              >
                Cancel
              </button>
            </div>
          </Show>

          <div
            class="sm-lyrics-lines"
            classList={{
              'sm-lyrics-columns-2': props.lyricsColumns() === 2,
              'sm-lyrics-lines--marking': props.blockMarkMode(),
            }}
            style={{
              'font-size': `${props.lyricsFontSize()}rem`,
              'text-align': props.lyricsAlign(),
            }}
            onContextMenu={(e) => e.preventDefault()}
            onWheel={(e) => {
              e.stopPropagation()
              if (e.ctrlKey || e.metaKey) {
                e.preventDefault()
                props.setLyricsFontSize((prev) =>
                  Math.min(
                    4,
                    Math.max(0.45, +(prev - e.deltaY * 0.001).toFixed(2)),
                  ),
                )
              }
            }}
            ref={lyricsLinesRef}
          >
            <For each={props.displayLines()}>
              {(dl: DisplayLine) => {
                if (dl.isBlank) {
                  return (
                    <div
                      class="sm-lyrics-line-spacer"
                      style={{ height: `${props.lyricsFontSize() * 0.5}rem` }}
                    />
                  )
                }

                if (dl.isRest) {
                  const gapStart = dl.restGapStart ?? 0
                  const gapEnd = dl.restGapEnd ?? 0
                  const dotCount = dl.restDotCount ?? 0
                  // Countdown only for a real, sized gap (word-level timing);
                  // otherwise keep the simple rest marker.
                  if (dotCount > 0 && gapEnd > gapStart) {
                    const active = () =>
                      props.elapsed() >= gapStart && props.elapsed() < gapEnd
                    return (
                      <div
                        class="sm-lyrics-rest"
                        data-lyrics-index={dl.lyricsIndex}
                        classList={{ 'sm-lyrics-rest--active': active() }}
                        style={{
                          'font-size': `${props.lyricsFontSize()}rem`,
                          'justify-content':
                            props.lyricsAlign() === 'center'
                              ? 'center'
                              : props.lyricsAlign() === 'right'
                                ? 'flex-end'
                                : 'flex-start',
                        }}
                      >
                        <RestCountdownDots
                          dotCount={dotCount}
                          elapsed={props.elapsed}
                          gapEnd={gapEnd}
                          gapStart={gapStart}
                          onSeek={props.handleSeekToTime}
                        />
                      </div>
                    )
                  }
                  return (
                    <div
                      class="sm-lyrics-rest"
                      data-lyrics-index={dl.lyricsIndex}
                      style={{
                        'font-size': `${props.lyricsFontSize()}rem`,
                        'justify-content':
                          props.lyricsAlign() === 'center'
                            ? 'center'
                            : props.lyricsAlign() === 'right'
                              ? 'flex-end'
                              : 'flex-start',
                      }}
                    >
                      <span
                        class="sm-lyrics-rest-dots"
                        aria-label="Rest"
                        role="img"
                      >
                        <span
                          class="sm-lyrics-rest-dot"
                          style={{ '--fill': '0%' }}
                        />
                      </span>
                    </div>
                  )
                }

                const idx = dl.lyricsIndex
                const parsedLyric = props.stableParsedLyrics().get(idx)
                if (!parsedLyric) return null

                const blockInfo = () => props.blockStarts().get(idx)
                const blockForLine = () => props.getBlockForLine(idx)
                const blockColor = () =>
                  blockForLine()
                    ? props.getBlockColor(blockForLine()!.blockId)
                    : undefined
                const isMarkSelected = () =>
                  props.blockMarkMode() &&
                  props.markStartLine() !== null &&
                  props.markEndLine() !== null &&
                  idx >= props.markStartLine()! &&
                  idx < props.markEndLine()!

                const isLoopA = () => props.loopStartLyricIdx() === idx
                const isLoopB = () => props.loopEndLyricIdx() === idx
                const isLoopRange = () => {
                  const a = props.loopStartLyricIdx()
                  const b = props.loopEndLyricIdx()
                  return a !== null && b !== null && idx > a && idx < b
                }

                const isActive = () => idx === props.currentLineIdx()
                const activeWordInfo = () =>
                  isActive()
                    ? props.computeActiveWord(
                        parsedLyric.words,
                        parsedLyric.time,
                        parsedLyric.endTime,
                        parsedLyric.wordTimes,
                        props.elapsed(),
                        parsedLyric.wordEndTimes,
                        parsedLyric.wordSweeps,
                      )
                    : { activeUpTo: -1, charProgress: 0, fraction: 0 }

                return (
                  <>
                    {blockInfo() && (
                      <div
                        class={`sm-lyrics-block-badge ${blockInfo()!.isTemplate ? 'sm-lyrics-block-badge--template' : 'sm-lyrics-block-badge--instance'}`}
                        style={{
                          '--block-color': blockInfo()!.color,
                          'margin-top': '0.4rem',
                        }}
                        onClick={(e) => {
                          e.stopPropagation()
                          if (!props.blockMarkMode()) {
                            props.setBlockEditTarget(blockInfo()!.blockId)
                          }
                        }}
                      >
                        {blockInfo()!.label}
                        {blockInfo()!.isTemplate &&
                          blockInfo()!.repeatCount > 1 && (
                            <span class="sm-lyrics-block-repeat">
                              x{blockInfo()!.repeatCount}
                            </span>
                          )}
                        {!blockInfo()!.isTemplate && (
                          <span
                            class="sm-lyrics-block-unlink"
                            onClick={(e) => {
                              e.stopPropagation()
                              props.handleUnlinkInstance(
                                blockInfo()!.blockId,
                                blockInfo()!.instanceIdx,
                              )
                            }}
                            title="Unlink this instance"
                          >
                            x
                          </span>
                        )}
                      </div>
                    )}
                    <span
                      class={`sm-lyrics-line${isActive() ? ' sm-lyrics-line-active' : ''}${blockForLine() ? ' sm-lyrics-line--blocked' : ''}${blockForLine() && !blockForLine()!.isTemplate ? ' sm-lyrics-line--block-instance' : ''}${props.blockMarkMode() ? ' sm-lyrics-line-markable' : ''}${isMarkSelected() ? ' sm-lyrics-line-mark-selected' : ''}${isLoopA() ? ' sm-lyrics-line--loop-a' : ''}${isLoopB() ? ' sm-lyrics-line--loop-b' : ''}${isLoopRange() ? ' sm-lyrics-line--loop-range' : ''}`}
                      data-lyrics-index={idx}
                      style={
                        blockColor() !== undefined
                          ? { '--block-color': blockColor() }
                          : {}
                      }
                      onClick={() => {
                        if (props.blockMarkMode()) {
                          const start = props.markStartLine()
                          if (start === null) {
                            props.setMarkStartLine(idx)
                            props.setMarkEndLine(null)
                          } else if (props.markEndLine() !== null) {
                            props.setMarkStartLine(idx)
                            props.setMarkEndLine(null)
                          } else {
                            if (idx > start) {
                              props.setMarkEndLine(idx + 1)
                            } else if (idx < start) {
                              props.setMarkStartLine(idx)
                              props.setMarkEndLine(start + 1)
                            } else {
                              props.setMarkEndLine(start + 1)
                            }
                          }
                        } else {
                          props.handleLyricLineClick(idx)
                        }
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault()
                        if (!props.blockMarkMode()) {
                          props.onSetLoopLyric(idx)
                        }
                      }}
                    >
                      {isLoopA() && (
                        <span class="sm-lyrics-loop-badge sm-lyrics-loop-badge--a">
                          A
                        </span>
                      )}
                      {isLoopB() && (
                        <span class="sm-lyrics-loop-badge sm-lyrics-loop-badge--b">
                          B
                        </span>
                      )}
                      {blockForLine() && !blockForLine()!.isTemplate && (
                        <span
                          class="sm-lyrics-block-unlink"
                          onClick={(e) => {
                            e.stopPropagation()
                            props.handleUnlinkInstance(
                              blockForLine()!.blockId,
                              blockForLine()!.instanceIdx,
                            )
                          }}
                          title="Unlink this instance"
                        >
                          x
                        </span>
                      )}
                      <span class="sm-lyrics-time">
                        {props.formatTime(parsedLyric.time)}
                      </span>
                      {parsedLyric.words.length === 0
                        ? parsedLyric.key.startsWith('lrc-')
                          ? props.lrcLines()[idx]?.text || ''
                          : props.lyricsLines()[idx] || ''
                        : parsedLyric.words.map((word, wi) => {
                            const noteInfo = getWordNote(parsedLyric, wi)
                            const noteLabel = noteInfo ? (
                              <span class="sm-lyrics-word-note">
                                {noteInfo.noteName}
                              </span>
                            ) : (
                              <span class="sm-lyrics-word-note sm-lyrics-word-note-spacer">
                                {'\u00A0'}
                              </span>
                            )
                            if (wi <= activeWordInfo().activeUpTo) {
                              return (
                                <>
                                  <span class="sm-lyrics-word-with-note">
                                    {noteLabel}
                                    <span class="sm-lyrics-word sm-lyrics-word-done">
                                      {word}
                                    </span>
                                  </span>{' '}
                                </>
                              )
                            }
                            if (
                              wi === activeWordInfo().activeUpTo + 1 &&
                              activeWordInfo().fraction > 0
                            ) {
                              return (
                                <>
                                  <span class="sm-lyrics-word-with-note">
                                    {noteLabel}
                                    <span
                                      class="sm-lyrics-word sm-lyrics-word-current"
                                      style={{
                                        '--word-progress': `${(
                                          activeWordInfo().fraction * 100
                                        ).toFixed(1)}%`,
                                      }}
                                    >
                                      {word}
                                    </span>
                                  </span>{' '}
                                </>
                              )
                            }
                            return (
                              <>
                                <span class="sm-lyrics-word-with-note">
                                  {noteLabel}
                                  <span class="sm-lyrics-word">{word}</span>
                                </span>{' '}
                              </>
                            )
                          })}
                    </span>
                  </>
                )
              }}
            </For>
          </div>
        </Show>
      </Show>

      <Show
        when={
          !props.lyricsLoading() &&
          (props.lyricsSource() === 'none' || props.showSongPicker())
        }
      >
        <Show
          when={props.showSongPicker()}
          fallback={
            <LyricsUploader
              onUpload={props.handleLyricsUpload}
              suggestion={props.songTitle}
              searchUrl={props.lrclibSearchUrl()}
            />
          }
        >
          <LyricsSongPicker
            variant="panel"
            autoFocus
            matches={props.songMatches()}
            query={props.songPickerQuery()}
            onQueryChange={props.setSongPickerQuery}
            onPick={(m) => {
              void props.handleSongPick(m)
            }}
            onRefine={() => {
              void props.handleSongPickerRefine()
            }}
            onUploadFile={() => {
              props.triggerChangeFile?.()
            }}
            onPasteText={(text, isLrc) => {
              const baseName = props.songTitle
                ? props.songTitle.replace(/[^a-zA-Z0-9_-]/g, '_')
                : 'clipboard'
              props.handleLyricsUpload({
                text,
                format: isLrc ? 'lrc' : 'txt',
                filename: `${baseName}.${isLrc ? 'lrc' : 'txt'}`,
              })
            }}
            onCancel={() => props.setShowSongPicker(false)}
          />
        </Show>
      </Show>
    </>
  )
}
