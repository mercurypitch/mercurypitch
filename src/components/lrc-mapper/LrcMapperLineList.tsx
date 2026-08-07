// ============================================================
// LrcMapperLineList — the mapper's lyric rows
// ============================================================
//
// The scrolling list you actually map against: one row per canonical line,
// each word a marker target carrying its own timestamp and sweep fill.
//
// Extracted from StemMixerLyricsPanelBody (Phase 2 of
// docs/plans/lrc-mapper-studio-plan.md) so the panel and the full-screen
// mapper stage render the same rows rather than two drifting copies. It owns
// the gestures that belong to the list itself — marker drag, pinch and
// ctrl-wheel zoom — and takes everything else as props.

import type { Accessor, Component, Setter } from 'solid-js'
import { For, onCleanup, onMount, Show } from 'solid-js'
import type { PreviewWordHighlight } from '@/features/stem-mixer/lrc-gen-passes'
import type { BlockInfo, BlockInstancesMap, GenViewLine, LrcGenInputMode, LyricsBlock, } from '@/features/stem-mixer/types'
import { RestCountdownDots } from '../RestCountdownDots'
import { LrcWordLetters } from './LrcWordLetters'
import { useLrcMarkerInput } from './useLrcMarkerInput'

/** Zoom bounds for the list's own font-size gestures. */
const MIN_FONT_REM = 0.45
const WHEEL_MAX_FONT_REM = 3
const PINCH_MAX_FONT_REM = 4
/** Pinch is dampened — raw ratios overshoot badly on a trackpad. */
const PINCH_DAMPENING = 0.3

export interface LrcMapperLineListProps {
  genViewData: Accessor<GenViewLine[]>
  blockInstances: Accessor<BlockInstancesMap>
  getBlockById: (blockId: string) => LyricsBlock | undefined
  getBlockColor: (blockId: string) => string
  formatTimeMs: (t: number) => string

  elapsed: Accessor<number>
  playing: Accessor<boolean>
  handlePlay: () => void
  /** Absent on surfaces with no transport — rest dots go non-interactive. */
  handleSeekToTime?: (t: number) => void

  highlightWord: Accessor<(PreviewWordHighlight & { lineIdx: number }) | null>
  previewLineIdx: Accessor<number | null>
  toggleLinePreview: (idx: number, loop: boolean) => boolean
  loopPreview: Accessor<boolean>
  handleLyricLineClick: (idx: number) => void

  lrcGenInputMode: Accessor<LrcGenInputMode>
  lrcGenLineIdx: Accessor<number>
  lrcGenWordIdx: Accessor<number>
  handleMarkerSample: (
    lineIdx: number,
    wordIdx: number,
    progress: number,
    elapsedTime: number,
    phase: 'start' | 'move' | 'end',
  ) => void

  lyricsFontSize: Accessor<number>
  setLyricsFontSize: Setter<number>

  /** Letter mode: clicking a word opens its glyph boundaries for timing. */
  letterMode: Accessor<boolean>
  letterTarget: Accessor<{ lineIdx: number; wordIdx: number } | null>
  openLetterTarget: (lineIdx: number, wordIdx: number) => void
  closeLetterTarget: () => void
  letterSplits: (lineIdx: number, wordIdx: number) => Record<number, number>
  setLetterSplit: (
    lineIdx: number,
    wordIdx: number,
    letterIdx: number,
    time: number,
  ) => void
  clearLetterSplit: (
    lineIdx: number,
    wordIdx: number,
    letterIdx: number,
  ) => void

  /** Extra classes on the scroll container, for the full-screen surface. */
  class?: string
}

/** A row is either a real line or a collapsed repeat of a mapped block. */
interface MapperRow {
  type: 'line' | 'placeholder'
  item: GenViewLine
  bi?: BlockInfo
  block?: LyricsBlock
  total?: number
}

export const LrcMapperLineList: Component<LrcMapperLineListProps> = (props) => {
  const marker = useLrcMarkerInput({
    elapsed: () => props.elapsed(),
    playing: () => props.playing(),
    handlePlay: () => props.handlePlay(),
    lrcGenInputMode: () => props.lrcGenInputMode(),
    lrcGenLineIdx: () => props.lrcGenLineIdx(),
    lrcGenWordIdx: () => props.lrcGenWordIdx(),
    handleMarkerSample: (lineIdx, wordIdx, progress, elapsedTime, phase) =>
      props.handleMarkerSample(lineIdx, wordIdx, progress, elapsedTime, phase),
  })

  // ── Pinch-to-zoom ────────────────────────────────────────────────
  // Registered by hand rather than via JSX: these must be non-passive to
  // preventDefault the browser's own page zoom.
  let linesRef: HTMLDivElement | undefined
  let pinchDist = 0
  let pinchStartSize = 0

  const onTouchStart = (e: TouchEvent) => {
    if (e.touches.length === 2) {
      pinchDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY,
      )
      pinchStartSize = props.lyricsFontSize()
    }
  }

  const onTouchMove = (e: TouchEvent) => {
    if (e.touches.length !== 2 || pinchDist === 0) return
    e.preventDefault()
    const dist = Math.hypot(
      e.touches[0].clientX - e.touches[1].clientX,
      e.touches[0].clientY - e.touches[1].clientY,
    )
    const ratio = 1 + (dist / pinchDist - 1) * PINCH_DAMPENING
    props.setLyricsFontSize(
      Math.min(
        PINCH_MAX_FONT_REM,
        Math.max(MIN_FONT_REM, pinchStartSize * ratio),
      ),
    )
  }

  const onTouchEnd = () => {
    pinchDist = 0
  }

  onMount(() => {
    const el = linesRef
    if (!el) return
    el.addEventListener('touchstart', onTouchStart, { passive: false })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd)
  })

  onCleanup(() => {
    const el = linesRef
    if (!el) return
    el.removeEventListener('touchstart', onTouchStart)
    el.removeEventListener('touchmove', onTouchMove)
    el.removeEventListener('touchend', onTouchEnd)
  })

  /**
   * Collapse each mapped block repeat into a single placeholder row. The
   * instance's remaining lines are skipped rather than filtered, because the
   * skip length comes from the instance range, not from the rows themselves.
   */
  const rows = (): MapperRow[] => {
    const items = props.genViewData()
    const out: MapperRow[] = []
    let skipUntil = -1
    for (let i = 0; i < items.length; i++) {
      if (i < skipUntil) continue
      const item = items[i]
      if (!item.isPlaceholder) {
        out.push({ type: 'line', item })
        continue
      }
      if (!item.isPlaceholderStart) continue
      const bi = item.blockInfo!
      const instances = props.blockInstances()[bi.blockId]
      skipUntil = instances?.[bi.instanceIdx]?.[1] ?? i + 1
      out.push({
        type: 'placeholder',
        item,
        bi,
        block: props.getBlockById(bi.blockId),
        total: instances?.length ?? 1,
      })
    }
    return out
  }

  return (
    <div
      ref={linesRef}
      class={`sm-lyrics-lines sm-lyrics-gen-lines${
        props.class !== undefined && props.class !== '' ? ` ${props.class}` : ''
      }`}
      style={{ 'font-size': `${props.lyricsFontSize()}rem` }}
      onWheel={(e) => {
        e.stopPropagation()
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault()
          props.setLyricsFontSize((prev) =>
            Math.min(
              WHEEL_MAX_FONT_REM,
              Math.max(MIN_FONT_REM, +(prev - e.deltaY * 0.001).toFixed(2)),
            ),
          )
        }
      }}
    >
      <For each={rows()}>
        {(row) => {
          if (row.type === 'placeholder') {
            const { item, bi, block, total } = row
            const instance =
              props.blockInstances()[bi!.blockId]?.[bi!.instanceIdx]
            return (
              <div
                class="sm-lyrics-gen-line sm-lyrics-gen-line-placeholder"
                data-lyrics-index={item.index}
                data-lyrics-end-index={(instance?.[1] ?? item.index + 1) - 1}
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

          // While previewing a line — or with Live highlight on — the
          // highlight follows the audio against the timings being edited, not
          // the mapping cursor, so the line renders exactly as it will at
          // runtime.
          const highlightHit = () => {
            const hit = props.highlightWord()
            return hit !== null && hit.lineIdx === item.index ? hit : null
          }
          const activeWordIdx = () =>
            highlightHit()?.wordIdx ?? item.activeWordIdx
          const isPreviewing = () => props.previewLineIdx() === item.index

          return (
            <div
              class={`sm-lyrics-gen-line${item.isCurrent ? ' sm-lyrics-gen-line-current' : ''}${item.isDone ? ' sm-lyrics-gen-line-done' : ''}${item.isFuture ? ' sm-lyrics-gen-line-future' : ''}${item.isMapped ? ' sm-lyrics-gen-line-mapped' : ''}${item.isSessionMapped ? ' sm-lyrics-gen-line-session' : ''}${item.blockInfo?.isTemplate === true ? ' sm-lyrics-gen-line-template' : ''}${item.isCurrent && props.lrcGenInputMode() === 'marker' ? ' sm-lyrics-gen-line-marker-mode' : ''}${highlightHit() !== null ? ' sm-lyrics-gen-line-lit' : ''}`}
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
                if (item.isCurrent && !props.letterMode())
                  marker.onPointerDown(e)
              }}
              onPointerMove={(e) => {
                if (item.isCurrent && !props.letterMode())
                  marker.onPointerMove(e)
              }}
              onPointerUp={(e) => {
                if (item.isCurrent && !props.letterMode()) marker.onPointerUp(e)
              }}
              onPointerCancel={(e) => {
                if (item.isCurrent && !props.letterMode()) marker.onPointerUp(e)
              }}
              onClick={() => {
                if (props.letterMode()) return
                if (!item.isCurrent || props.lrcGenInputMode() !== 'marker') {
                  props.handleLyricLineClick(item.index)
                }
              }}
            >
              <button
                classList={{
                  'sm-lyrics-gen-preview-btn': true,
                  'sm-lyrics-gen-preview-btn--on': isPreviewing(),
                }}
                disabled={item.lineTime === undefined}
                aria-pressed={isPreviewing()}
                title={
                  props.loopPreview()
                    ? 'Play this line on repeat with live highlighting'
                    : 'Play this line with live highlighting'
                }
                onClick={(e) => {
                  e.stopPropagation()
                  // The controller can seek but owns no transport, so starting
                  // playback is the caller's job — without this a preview from
                  // a paused song silently does nothing.
                  if (
                    props.toggleLinePreview(item.index, props.loopPreview())
                  ) {
                    if (!props.playing()) props.handlePlay()
                  }
                }}
              >
                <svg viewBox="0 0 24 24" width="10" height="10">
                  <Show
                    when={isPreviewing()}
                    fallback={<path fill="currentColor" d="M8 5v14l11-7z" />}
                  >
                    <path
                      fill="currentColor"
                      d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"
                    />
                  </Show>
                </svg>
              </button>
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
                        const lit = highlightHit()
                        if (lit !== null) {
                          return lit.wordIdx === wi
                            ? lit.progress
                            : lit.wordIdx > wi
                              ? 1
                              : 0
                        }
                        if (item.activeWordIdx === wi) {
                          const live = marker.markerVisual()
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
                      const isLetterTarget = () => {
                        const open = props.letterTarget()
                        return (
                          props.letterMode() &&
                          open !== null &&
                          open.lineIdx === item.index &&
                          open.wordIdx === wi
                        )
                      }
                      return (
                        <span
                          class={`sm-lyrics-gen-word${
                            activeWordIdx() === wi
                              ? ' sm-lyrics-gen-word-current'
                              : ''
                          }${
                            activeWordIdx() >= 0 && wi < activeWordIdx()
                              ? ' sm-lyrics-gen-word-done'
                              : ''
                          }${
                            highlightHit() !== null
                              ? ' sm-lyrics-gen-word-lit'
                              : ''
                          }${
                            item.isCurrent &&
                            highlightHit() === null &&
                            props.lrcGenInputMode() === 'marker'
                              ? ' sm-lyrics-gen-word-marker'
                              : ''
                          }${
                            props.letterMode()
                              ? ' sm-lyrics-gen-word-splittable'
                              : ''
                          }${
                            isLetterTarget() ? ' sm-lyrics-gen-word-split' : ''
                          }`}
                          data-marker-line={item.index}
                          data-marker-word={wi}
                          aria-current={
                            activeWordIdx() === wi ? 'true' : undefined
                          }
                          style={{
                            '--marker-progress': `${(progress() * 100).toFixed(
                              1,
                            )}%`,
                          }}
                          onClick={(e) => {
                            if (!props.letterMode()) return
                            e.stopPropagation()
                            // Click the open word again to collapse it: the
                            // expanded row is wide, and there is nowhere else
                            // obvious to click to be rid of it.
                            if (isLetterTarget()) props.closeLetterTarget()
                            else props.openLetterTarget(item.index, wi)
                          }}
                        >
                          <span class="sm-lyrics-gen-word-time">
                            {item.wordTimes?.[wi] !== undefined
                              ? props.formatTimeMs(item.wordTimes[wi])
                              : ''}
                          </span>
                          <Show
                            when={isLetterTarget()}
                            fallback={
                              <span class="sm-lyrics-gen-word-text">
                                {word}
                              </span>
                            }
                          >
                            <LrcWordLetters
                              word={word}
                              splits={() => props.letterSplits(item.index, wi)}
                              formatTimeMs={props.formatTimeMs}
                              onSet={(letterIdx) =>
                                props.setLetterSplit(
                                  item.index,
                                  wi,
                                  letterIdx,
                                  props.elapsed(),
                                )
                              }
                              onClear={(letterIdx) =>
                                props.clearLetterSplit(
                                  item.index,
                                  wi,
                                  letterIdx,
                                )
                              }
                            />
                          </Show>
                        </span>
                      )
                    })}
              </span>
            </div>
          )
        }}
      </For>
    </div>
  )
}
