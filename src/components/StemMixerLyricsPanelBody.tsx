// ============================================================
// StemMixerLyricsPanelBody — shared lyrics body content (used by both layouts)
// ============================================================

import type { Accessor, Component, Setter } from 'solid-js'
import { createEffect, For, on, onCleanup, onMount, Show } from 'solid-js'
import { SafeSelect } from '@/components/shared/SafeSelect'
import type { BlockInfo, BlockInstancesMap, BlockStartsInfo, CanonicalLrcEntry, DisplayLine, GenViewLine, LyricsBlock, WordTimingsMap, } from '@/features/stem-mixer/types'
import { computeRestProgress } from '@/lib/canonical-lrc'
import type { LyricsSearchMatch } from '@/lib/lyrics-service'
import type { AlignmentResult } from '@/lib/pitch-word-alignment'
import { MagnifyingGlass } from './icons'
import type { LyricsUploadResult } from './LyricsUploader'
import { LyricsUploader } from './LyricsUploader'

interface ParsedLyric {
  key: string
  time: number
  endTime: number
  words: string[]
  wordTimes?: number[]
}

interface SongPickerProps {
  matches: LyricsSearchMatch[]
  query: string
  onQueryChange: (v: string) => void
  onPick: (match: LyricsSearchMatch) => void
  onRefine: () => void
  onUploadFile: () => void
  onPasteText?: (text: string, isLrc: boolean) => void
  onCancel: () => void
}

const SongPicker = (p: SongPickerProps) => {
  let inputRef: HTMLInputElement | undefined

  const lrclibQueryUrl = () => {
    const q = p.query?.trim()
    if (!q) return 'https://lrclib.net'
    return `https://lrclib.net/search/${encodeURIComponent(q)}`
  }

  onMount(() => {
    const handleGlobalPaste = (e: ClipboardEvent) => {
      // Don't intercept if user is typing in an input box
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return
      }

      const text = e.clipboardData?.getData('text')
      if (text !== undefined && text !== '' && text.trim().length > 0) {
        e.preventDefault()
        const isLrc = /^\[\d{1,3}:\d{2}/.test(text.trim())
        p.onPasteText?.(text, isLrc)
      }
    }

    document.addEventListener('paste', handleGlobalPaste)
    onCleanup(() => document.removeEventListener('paste', handleGlobalPaste))
  })

  return (
    <div class="sm-song-picker">
      <div class="sm-song-picker-header">Search Lyrics Online</div>
      <div class="sm-song-picker-search">
        <input
          ref={inputRef}
          type="text"
          class="sm-song-picker-input"
          value={p.query}
          onInput={(e) => p.onQueryChange(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') p.onRefine()
          }}
          placeholder="Artist - Title"
        />
        <button
          class="sm-song-picker-search-btn sm-btn sm-btn-secondary"
          onClick={() => p.onRefine()}
          title="Search"
        >
          Search
        </button>
        <Show when={p.onPasteText}>
          <button
            class="sm-song-picker-paste-btn sm-btn sm-btn-secondary"
            onClick={() => {
              void (async () => {
                try {
                  const text = await navigator.clipboard.readText()
                  if (text && text.trim().length > 0) {
                    const isLrc = /^\[\d{1,3}:\d{2}/.test(text.trim())
                    p.onPasteText?.(text, isLrc)
                  }
                } catch (err) {
                  console.warn('Clipboard paste failed', err)
                  // If browser blocks the API, prompt them to use Ctrl+V
                  import('@/stores/notifications-store').then(
                    ({ showNotification }) => {
                      showNotification(
                        'Browser blocked clipboard access. Please press Ctrl+V to paste instead.',
                        'warning',
                      )
                    },
                  )
                }
              })()
            }}
            title="Paste lyrics from clipboard"
          >
            Paste
          </button>
        </Show>
      </div>

      <Show
        when={p.matches.length > 0}
        fallback={
          <div class="sm-song-picker-no-results">
            <span class="sm-song-picker-no-results-title">
              No matching songs found
            </span>
            <span class="sm-song-picker-no-results-hint">
              Try refining your search terms above or search on LRCLIB.
            </span>
            <a
              class="sm-song-picker-lrclib-link"
              href={lrclibQueryUrl()}
              target="_blank"
              rel="noopener noreferrer"
            >
              <MagnifyingGlass />
              Search on LRCLIB
            </a>
          </div>
        }
      >
        <div
          class="sm-song-picker-header-count"
          style={{
            'font-size': '0.75rem',
            'font-weight': '500',
            color: 'var(--fg-secondary, #8b949e)',
            'margin-top': '0.25rem',
          }}
        >
          Found {p.matches.length} matching songs:
        </div>
        <div class="sm-song-picker-list">
          <For each={p.matches}>
            {(m) => (
              <button class="sm-song-picker-row" onClick={() => p.onPick(m)}>
                <span class="sm-song-picker-artist">{m.artist}</span>
                <span class="sm-song-picker-sep"> - </span>
                <span class="sm-song-picker-title">{m.title}</span>
                {m.syncedLyrics !== undefined && (
                  <span class="sm-song-picker-badge">LRC</span>
                )}
              </button>
            )}
          </For>
        </div>
      </Show>

      <div class="sm-song-picker-footer-actions">
        <button
          class="sm-btn sm-btn-secondary"
          onClick={() => p.onCancel()}
          style={{ 'font-size': '0.75rem', padding: '0.35rem 0.75rem' }}
        >
          Cancel
        </button>
        <button
          class="sm-btn sm-btn-primary"
          onClick={() => p.onUploadFile()}
          style={{
            'font-size': '0.75rem',
            padding: '0.35rem 0.75rem',
            gap: '0.35rem',
          }}
        >
          <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
            <path d="M9 16h6v-6h4l-7-7-7 7h4v6zm-4 2h14v2H5v-2z" />
          </svg>
          Upload LRC / TXT File
        </button>
      </div>
    </div>
  )
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
  ) => { activeUpTo: number; charProgress: number }
  getGenLines: () => string[]

  // Audio
  playing: Accessor<boolean>
  elapsed: Accessor<number>
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
      3,
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
        wi + 1 < wordTimes.length ? wordTimes[wi + 1] : parsedLyric.endTime
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
            <button
              class="sm-lyrics-gen-nextword-btn"
              onClick={() => props.handleNextWord()}
              title="Mark next word time [W]"
            >
              Next Word
            </button>
            <button
              class="sm-lyrics-gen-nextline-btn"
              onClick={() => props.handleNextLine()}
              title="Mark next line time [L]"
            >
              Next Line
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
              title="Reset all timings"
            >
              Reset
            </button>
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
                  return (
                    <div
                      class="sm-lyrics-gen-line sm-lyrics-gen-line-placeholder"
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
                return (
                  <div
                    class={`sm-lyrics-gen-line${item.isCurrent ? ' sm-lyrics-gen-line-current' : ''}${item.isDone ? ' sm-lyrics-gen-line-done' : ''}${item.isFuture ? ' sm-lyrics-gen-line-future' : ''}${item.blockInfo?.isTemplate === true ? ' sm-lyrics-gen-line-template' : ''}`}
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
                    onClick={() => props.handleLyricLineClick(item.index)}
                  >
                    <span class="sm-lyrics-gen-line-time">
                      {item.lineTime !== undefined
                        ? props.formatTimeMs(item.lineTime)
                        : '--:--'}
                    </span>
                    <span class="sm-lyrics-gen-line-text">
                      {item.words.length === 0
                        ? item.line
                        : item.words.map((word: string, wi: number) => (
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
                              }`}
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
                          ))}
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
            style={{ 'font-size': `${props.lyricsFontSize()}rem` }}
            onContextMenu={(e) => e.preventDefault()}
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
                    const progress = () =>
                      computeRestProgress(
                        gapStart,
                        gapEnd,
                        dotCount,
                        props.elapsed(),
                      )
                    const active = () =>
                      props.elapsed() >= gapStart && props.elapsed() < gapEnd
                    return (
                      <div
                        class="sm-lyrics-rest"
                        classList={{ 'sm-lyrics-rest--active': active() }}
                        style={{ 'font-size': `${props.lyricsFontSize()}rem` }}
                      >
                        <div class="sm-lyrics-rest-dots" aria-hidden="true">
                          <For each={Array.from({ length: dotCount })}>
                            {(_, i) => {
                              const fill = () => {
                                const p = progress()
                                if (i() < p.filledDots) return 1
                                if (i() === p.filledDots)
                                  return p.currentDotFrac
                                return 0
                              }
                              return (
                                <span
                                  class="sm-lyrics-rest-dot"
                                  style={{
                                    '--fill': `${Math.round(fill() * 100)}%`,
                                  }}
                                />
                              )
                            }}
                          </For>
                        </div>
                        <span class="sm-lyrics-rest-label">
                          {active() ? 'Get ready…' : '~Rest~'}
                        </span>
                      </div>
                    )
                  }
                  return (
                    <div
                      class="sm-lyrics-rest"
                      style={{ 'font-size': `${props.lyricsFontSize()}rem` }}
                    >
                      <span class="sm-lyrics-rest-pulse" />
                      <span class="sm-lyrics-rest-label">~Rest~</span>
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
                      )
                    : { activeUpTo: -1, charProgress: 0 }

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
                              activeWordInfo().charProgress > 0
                            ) {
                              return (
                                <>
                                  <span class="sm-lyrics-word-with-note">
                                    {noteLabel}
                                    <span class="sm-lyrics-word sm-lyrics-word-current">
                                      <span class="sm-lyrics-char-done">
                                        {word.slice(
                                          0,
                                          activeWordInfo().charProgress,
                                        )}
                                      </span>
                                      <span class="sm-lyrics-char-remaining">
                                        {word.slice(
                                          activeWordInfo().charProgress,
                                        )}
                                      </span>
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
          <SongPicker
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
