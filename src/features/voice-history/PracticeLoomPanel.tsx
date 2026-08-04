// ============================================================
// Practice Loom Panel — scrub-ready history across several matched takes
// ============================================================
//
// Every row keeps real time and one shared pitch domain. The Loom reveals
// recurring shapes without aligning phrases, ranking takes, or inventing a
// trend from microphone-sensitive measurements.

import type { Component, JSX } from 'solid-js'
import { createEffect, createMemo, createSignal, createUniqueId, For, onCleanup, onMount, Show, } from 'solid-js'
import { VoiceTakeWaveform } from '@/components/VoiceTakeWaveform'
import type { VoiceTakeRecord } from '@/db/entities'
import { createDprWatcher, createRedrawScheduler, syncCanvasBacking, } from '@/lib/canvas-size-sync'
import styles from './PracticeLoomPanel.module.css'
import type { PracticeLoomRenderModel, PracticeLoomRowModel, } from './voice-atlas-model'
import { VoicePlaybackTransport } from './VoicePlaybackTransport'

const INITIAL_VISIBLE_ROWS = 8
const EARLIER_RGB = [45, 212, 191] as const
const LATER_RGB = [188, 140, 255] as const

export interface PracticeLoomPanelProps {
  model: PracticeLoomRenderModel
  takes: readonly VoiceTakeRecord[]
  activeId: string | null
  earlierId: string | null
  laterId: string | null
  progress: number
  playing: boolean
  loading?: boolean
  onSelect: (takeId: string) => void
  onPlay: (takeId: string) => void
  onSeek: (takeId: string, progress: number) => void
}

interface LoomEntry {
  take: VoiceTakeRecord
  row: PracticeLoomRowModel
  index: number
  color: string
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(1, value))
}

function formatClock(seconds: number): string {
  const safe = Number.isFinite(seconds) ? Math.max(0, seconds) : 0
  if (safe > 0 && safe < 10) return `${safe.toFixed(1)}s`
  const rounded = Math.round(safe)
  return `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, '0')}`
}

function formatDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Unknown date'
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year:
      date.getFullYear() === new Date().getFullYear() ? undefined : 'numeric',
  }).format(date)
}

function rowColor(index: number, count: number): string {
  const mix = count <= 1 ? 0 : index / (count - 1)
  const channel = (from: number, to: number): number =>
    Math.round(from + (to - from) * mix)
  return `rgb(${channel(EARLIER_RGB[0], LATER_RGB[0])} ${channel(EARLIER_RGB[1], LATER_RGB[1])} ${channel(EARLIER_RGB[2], LATER_RGB[2])})`
}

function stateLabel(row: PracticeLoomRowModel): string {
  if (row.state === 'mapped') return 'Pitch + energy'
  if (row.state === 'energy-only') return 'Energy only'
  if (row.state === 'legacy') return 'Waveform archive'
  if (row.state === 'unavailable') return 'Analysis unavailable'
  return 'Awaiting take'
}

function drawLane(
  canvas: HTMLCanvasElement,
  row: PracticeLoomRowModel,
  model: PracticeLoomRenderModel,
  color: string,
): void {
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  syncCanvasBacking(canvas, dpr)
  const bounds = canvas.getBoundingClientRect()
  if (bounds.width <= 0 || bounds.height <= 0) return
  const context = canvas.getContext('2d')
  if (context === null) return
  context.setTransform(dpr, 0, 0, dpr, 0, 0)
  context.clearRect(0, 0, bounds.width, bounds.height)

  context.save()
  for (const tick of model.timeTicks) {
    const x = tick.x * bounds.width
    context.strokeStyle = 'rgba(141, 184, 255, 0.07)'
    context.lineWidth = 1
    context.beginPath()
    context.moveTo(x, 5)
    context.lineTo(x, bounds.height - 5)
    context.stroke()
  }
  context.strokeStyle = 'rgba(141, 184, 255, 0.09)'
  context.beginPath()
  context.moveTo(0, bounds.height / 2)
  context.lineTo(bounds.width, bounds.height / 2)
  context.stroke()

  if (row.state === 'energy-only') {
    for (const point of row.points) {
      const height = 2 + point.level * (bounds.height * 0.58)
      context.strokeStyle = color
      context.globalAlpha = 0.2 + point.level * 0.42
      context.lineWidth = Math.max(
        1,
        bounds.width / Math.max(80, row.points.length),
      )
      context.beginPath()
      context.moveTo(point.x * bounds.width, (bounds.height - height) / 2)
      context.lineTo(point.x * bounds.width, (bounds.height + height) / 2)
      context.stroke()
    }
    context.restore()
    return
  }

  for (const segment of row.segments) {
    if (segment.points.length === 1) {
      const point = segment.points[0]!
      if (point.y !== null) {
        context.fillStyle = color
        context.globalAlpha = 0.72
        context.beginPath()
        context.arc(
          point.x * bounds.width,
          5 + point.y * (bounds.height - 10),
          1.5 + point.level * 2.5,
          0,
          Math.PI * 2,
        )
        context.fill()
      }
      continue
    }
    for (let index = 1; index < segment.points.length; index += 1) {
      const previous = segment.points[index - 1]!
      const point = segment.points[index]!
      if (previous.y === null || point.y === null) continue
      context.strokeStyle = color
      context.globalAlpha = 0.13 + ((previous.level + point.level) / 2) * 0.2
      context.lineWidth = 2 + ((previous.level + point.level) / 2) * 6
      context.lineCap = 'round'
      context.beginPath()
      context.moveTo(
        previous.x * bounds.width,
        5 + previous.y * (bounds.height - 10),
      )
      context.lineTo(point.x * bounds.width, 5 + point.y * (bounds.height - 10))
      context.stroke()
    }

    context.strokeStyle = color
    context.globalAlpha = 0.88
    context.lineWidth = 1.35
    context.lineJoin = 'round'
    context.lineCap = 'round'
    context.beginPath()
    segment.points.forEach((point, index) => {
      if (point.y === null) return
      const x = point.x * bounds.width
      const y = 5 + point.y * (bounds.height - 10)
      if (index === 0) context.moveTo(x, y)
      else context.lineTo(x, y)
    })
    context.stroke()
  }
  context.restore()
}

const LoomLane: Component<{
  entry: LoomEntry
  model: PracticeLoomRenderModel
  active: boolean
  progress: number
  playing: boolean
  onSeek: (progress: number) => void
}> = (props) => {
  let canvas: HTMLCanvasElement | undefined
  let resizeObserver: ResizeObserver | null = null
  let dprWatcher: ReturnType<typeof createDprWatcher> | null = null
  let redraw: ReturnType<typeof createRedrawScheduler> | null = null

  const currentProgress = (): number =>
    props.active ? clamp01(props.progress) : 0
  const currentSeconds = (): number =>
    currentProgress() * props.entry.row.durationSeconds
  const sharedPosition = (): number => {
    if (props.model.durationSeconds <= 0) return 0
    return clamp01(currentSeconds() / props.model.durationSeconds)
  }
  const seekFromPointer = (event: PointerEvent): void => {
    const surface = event.currentTarget as HTMLDivElement
    const bounds = surface.getBoundingClientRect()
    if (bounds.width <= 0 || props.entry.row.durationSeconds <= 0) return
    const sharedSeconds =
      clamp01((event.clientX - bounds.left) / bounds.width) *
      props.model.durationSeconds
    props.onSeek(clamp01(sharedSeconds / props.entry.row.durationSeconds))
  }
  const watchCanvas = (): void => {
    resizeObserver?.disconnect()
    resizeObserver = null
    if (canvas !== undefined && typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => redraw?.queue())
      resizeObserver.observe(canvas)
    }
    redraw?.queue()
  }

  createEffect(() => {
    void props.entry.row
    void props.model.durationSeconds
    void props.model.timeTicks
    void props.entry.color
    redraw?.queue()
  })

  onMount(() => {
    redraw = createRedrawScheduler(() => {
      if (canvas !== undefined) {
        drawLane(canvas, props.entry.row, props.model, props.entry.color)
      }
    })
    watchCanvas()
    if (typeof window.matchMedia === 'function') {
      dprWatcher = createDprWatcher(() => redraw?.queue())
    }
    redraw.queue()
  })

  onCleanup(() => {
    resizeObserver?.disconnect()
    dprWatcher?.dispose()
    redraw?.cancel()
  })

  return (
    <div
      class={styles.lane}
      classList={{ [styles.laneActive]: props.active }}
      style={{ '--loom-color': props.entry.color }}
    >
      <Show
        when={props.entry.row.points.length > 0}
        fallback={
          <VoiceTakeWaveform
            class={styles.waveform}
            peaks={props.entry.take.peaks}
            progress={currentProgress()}
            playing={props.active && props.playing}
            showPlayhead={false}
          />
        }
      >
        <canvas
          ref={(element) => {
            canvas = element
            watchCanvas()
          }}
          class={styles.canvas}
          aria-hidden="true"
        />
      </Show>
      <div
        class={styles.laneSlider}
        data-testid={`practice-loom-lane-${props.entry.take.id}`}
        role="slider"
        tabindex="0"
        aria-label={`Seek Take ${props.entry.index + 1} in Practice Loom`}
        aria-valuemin="0"
        aria-valuemax={props.entry.row.durationSeconds}
        aria-valuenow={Number(currentSeconds().toFixed(2))}
        aria-valuetext={`${formatClock(currentSeconds())} of ${formatClock(props.entry.row.durationSeconds)}`}
        onPointerDown={(event) => {
          if (event.pointerType === 'mouse' && event.button !== 0) return
          event.currentTarget.setPointerCapture(event.pointerId)
          seekFromPointer(event)
        }}
        onPointerMove={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            seekFromPointer(event)
          }
        }}
        onPointerUp={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            seekFromPointer(event)
            event.currentTarget.releasePointerCapture(event.pointerId)
          }
        }}
        onPointerCancel={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId)
          }
        }}
        onKeyDown={(event) => {
          const duration = props.entry.row.durationSeconds
          if (duration <= 0) return
          const step = Math.min(1, duration) / duration
          const next =
            event.key === 'Home'
              ? 0
              : event.key === 'End'
                ? 1
                : event.key === 'ArrowLeft' || event.key === 'ArrowDown'
                  ? currentProgress() - step
                  : event.key === 'ArrowRight' || event.key === 'ArrowUp'
                    ? currentProgress() + step
                    : null
          if (next === null) return
          event.preventDefault()
          props.onSeek(clamp01(next))
        }}
      />
      <Show when={props.active}>
        <div
          class={styles.playhead}
          classList={{ [styles.playheadMoving]: props.playing }}
          style={{ '--loom-position': `${sharedPosition() * 100}%` }}
          aria-hidden="true"
        >
          <span />
        </div>
      </Show>
    </div>
  )
}

export function PracticeLoomPanel(props: PracticeLoomPanelProps): JSX.Element {
  const titleId = createUniqueId()
  const [showAll, setShowAll] = createSignal(false)
  const initialSelection = (): string | null => {
    const ids = new Set(props.takes.map((take) => take.id))
    if (props.activeId !== null && ids.has(props.activeId)) {
      return props.activeId
    }
    if (props.laterId !== null && ids.has(props.laterId)) return props.laterId
    return props.takes[0]?.id ?? null
  }
  const [selectedId, setSelectedId] = createSignal<string | null>(
    initialSelection(),
  )
  const selectEntry = (id: string): void => {
    setSelectedId(id)
    props.onSelect(id)
  }
  const entries = createMemo<readonly LoomEntry[]>(() => {
    const rows = new Map(props.model.rows.map((row) => [row.id, row]))
    return props.takes.flatMap((take, index) => {
      const row = rows.get(take.id)
      return row === undefined
        ? []
        : [
            {
              take,
              row,
              index,
              color: rowColor(index, props.takes.length),
            },
          ]
    })
  })
  const hiddenCount = (): number =>
    Math.max(0, entries().length - INITIAL_VISIBLE_ROWS)
  const visibleEntries = createMemo<readonly LoomEntry[]>(() => {
    const all = entries()
    if (showAll() || all.length <= INITIAL_VISIBLE_ROWS) return all
    return [all[0]!, ...all.slice(-(INITIAL_VISIBLE_ROWS - 1))]
  })
  const selectedEntry = createMemo<LoomEntry | null>(() => {
    const id = selectedId()
    if (id === null) return null
    return entries().find((entry) => entry.take.id === id) ?? null
  })
  const selectedTone = (): 'earlier' | 'later' | 'neutral' => {
    const id = selectedId()
    if (id !== null && id === props.earlierId) return 'earlier'
    if (id !== null && id === props.laterId) return 'later'
    return 'neutral'
  }
  let observedActiveId: string | null | undefined

  createEffect(() => {
    const all = entries()
    const activeId = props.activeId
    const activeChanged = activeId !== observedActiveId
    observedActiveId = activeId

    if (
      activeChanged &&
      activeId !== null &&
      all.some((entry) => entry.take.id === activeId)
    ) {
      setSelectedId(activeId)
      return
    }

    const currentId = selectedId()
    if (
      currentId !== null &&
      all.some((entry) => entry.take.id === currentId)
    ) {
      return
    }

    const fallbackId =
      props.laterId !== null &&
      all.some((entry) => entry.take.id === props.laterId)
        ? props.laterId
        : (all[0]?.take.id ?? null)
    setSelectedId(fallbackId)
  })
  const availabilityCopy = (): string => {
    if (props.loading === true) {
      return 'Weaving the private contours stored with this practice thread.'
    }
    if (props.model.voicedRowCount === props.model.rows.length) {
      return 'One clock and one pitch map across every attempt. No take is time-stretched.'
    }
    if (props.model.voicedRowCount > 0) {
      return 'Mapped takes share one clock; older or uncertain rows remain playable as waveforms.'
    }
    return 'These takes remain playable while their pitch maps are unavailable.'
  }

  return (
    <section
      class={styles.loom}
      aria-labelledby={titleId}
      aria-busy={props.loading === true}
    >
      <div class={styles.heading}>
        <div>
          <span>Practice Loom</span>
          <h3 id={titleId}>Hear the pattern across attempts.</h3>
          <p>{availabilityCopy()}</p>
        </div>
        <output aria-live="polite">
          {props.loading === true
            ? 'Weaving takes'
            : `${props.model.rows.length} takes woven`}
        </output>
      </div>

      <div class={styles.legend} aria-label="Practice Loom legend">
        <span>
          <i class={styles.threadLegend} aria-hidden="true" /> Pitch path
        </span>
        <span>
          <i class={styles.energyLegend} aria-hidden="true" /> Relative energy
        </span>
        <span>
          <i class={styles.playheadLegend} aria-hidden="true" /> Listening
          position
        </span>
        <span>Gaps stay unvoiced</span>
      </div>

      <VoicePlaybackTransport
        take={selectedEntry()?.take ?? null}
        activeId={props.activeId}
        progress={props.progress}
        playing={props.playing}
        eyebrow={
          selectedEntry() === null
            ? 'Practice Loom'
            : `Take ${selectedEntry()!.index + 1} · ${formatDate(selectedEntry()!.take.capturedAt)}`
        }
        tone={selectedTone()}
        compact={true}
        onPlay={(takeId) => {
          selectEntry(takeId)
          props.onPlay(takeId)
        }}
        onSeek={(takeId, nextProgress) => {
          selectEntry(takeId)
          props.onSeek(takeId, nextProgress)
        }}
      />

      <div class={styles.rows}>
        <For each={visibleEntries()}>
          {(entry, visibleIndex) => (
            <>
              <Show
                when={!showAll() && hiddenCount() > 0 && visibleIndex() === 1}
              >
                <div class={styles.omission}>
                  <span>
                    {hiddenCount()} middle{' '}
                    {hiddenCount() === 1 ? 'take' : 'takes'} folded
                  </span>
                  <button type="button" onClick={() => setShowAll(true)}>
                    Show all
                  </button>
                </div>
              </Show>
              <article
                class={styles.row}
                classList={{
                  [styles.rowSelected]: selectedId() === entry.take.id,
                }}
                style={{ '--loom-color': entry.color }}
                data-selected={selectedId() === entry.take.id}
                onClick={() => selectEntry(entry.take.id)}
              >
                <button
                  type="button"
                  class={styles.rowSelect}
                  aria-label={`Select Take ${entry.index + 1} in Practice Loom`}
                  aria-pressed={selectedId() === entry.take.id}
                  onClick={() => selectEntry(entry.take.id)}
                >
                  <div class={styles.rowIdentity}>
                    <span>{formatDate(entry.take.capturedAt)}</span>
                    <strong>Take {entry.index + 1}</strong>
                    <small>
                      {formatClock(entry.row.durationSeconds)} ·{' '}
                      {stateLabel(entry.row)}
                    </small>
                    <div class={styles.comparisonTags}>
                      <Show when={props.earlierId === entry.take.id}>
                        <span class={styles.earlierTag}>Earlier</span>
                      </Show>
                      <Show when={props.laterId === entry.take.id}>
                        <span class={styles.laterTag}>Later</span>
                      </Show>
                    </div>
                  </div>
                </button>
                <LoomLane
                  entry={entry}
                  model={props.model}
                  active={props.activeId === entry.take.id}
                  progress={props.progress}
                  playing={props.playing}
                  onSeek={(nextProgress) => {
                    selectEntry(entry.take.id)
                    props.onSeek(entry.take.id, nextProgress)
                  }}
                />
              </article>
            </>
          )}
        </For>
      </div>

      <div class={styles.ruler} aria-hidden="true">
        <span />
        <div>
          <For each={props.model.timeTicks}>
            {(tick) => (
              <i style={{ '--loom-position': `${tick.x * 100}%` }}>
                {tick.label}
              </i>
            )}
          </For>
        </div>
      </div>

      <Show when={showAll() && hiddenCount() > 0}>
        <button
          type="button"
          class={styles.foldButton}
          onClick={() => setShowAll(false)}
        >
          Fold middle takes
        </button>
      </Show>

      <p class={styles.note}>
        Each row uses true time and the same pitch map. Energy is relative
        within each take, not comparable loudness.
      </p>
    </section>
  )
}
