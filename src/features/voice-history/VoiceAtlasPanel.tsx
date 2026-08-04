// ============================================================
// Voice Atlas Panel — shared-time spectral cartography for two kept takes
// ============================================================
//
// Twin Trails never stretches one performance to resemble another. Pitch
// gaps stay gaps, energy only widens an observed trail, and subjective
// Reflection Beacons remain separate from the measured contour.

import type { JSX } from 'solid-js'
import { createEffect, createMemo, createSignal, createUniqueId, For, onCleanup, onMount, Show, } from 'solid-js'
import { Pencil, SlidersHorizontal } from '@/components/icons'
import { Sheet } from '@/components/mobile/Sheet'
import type { VoiceTakeRecord } from '@/db/entities'
import { createDprWatcher, createRedrawScheduler, syncCanvasBacking, } from '@/lib/canvas-size-sync'
import type { DecodedVoiceAtlasContour } from '@/lib/voice-contour'
import type { VoiceAtlasRenderModel, VoiceAtlasTrailModel, } from './voice-atlas-model'
import type { VoiceReflection, VoiceReflectionKind } from './voice-reflections'
import { voiceReflectionLabel } from './voice-reflections'
import { VoiceAtlasInspector } from './VoiceAtlasInspector'
import styles from './VoiceAtlasPanel.module.css'
import { VoiceAtlasTraits } from './VoiceAtlasTraits'
import { VoicePlaybackTransport } from './VoicePlaybackTransport'

const EARLIER_COLOR = '#2dd4bf'
const LATER_COLOR = '#bc8cff'

interface ReflectionMarker {
  reflection: VoiceReflection
  takeId: string
  trail: 'earlier' | 'later'
}

interface PlotRect {
  left: number
  right: number
  top: number
  bottom: number
  width: number
  height: number
}

export interface VoiceAtlasPanelProps {
  model: VoiceAtlasRenderModel
  earlier: VoiceTakeRecord | null
  later: VoiceTakeRecord | null
  earlierContour: DecodedVoiceAtlasContour | null
  laterContour: DecodedVoiceAtlasContour | null
  /** Take currently targeted by the shared playhead and Reflection Beacons. */
  selectedId: string | null
  activeId: string | null
  /** Normalized playback position for activeId. */
  progress: number
  playing: boolean
  /** Suppresses archival fallbacks while contour rows are resolving. */
  loading?: boolean
  earlierReflections: readonly VoiceReflection[]
  laterReflections: readonly VoiceReflection[]
  /** Existing page-owned take selector, rendered in the Earlier trail card. */
  earlierSelector?: JSX.Element
  /** Existing page-owned take selector, rendered in the Later trail card. */
  laterSelector?: JSX.Element
  totalTakeCount: number
  pairPreset: 'full-span' | 'latest' | 'custom'
  roomPanel: JSX.Element
  onChoosePairPreset: (preset: 'full-span' | 'latest') => void
  onSelect: (takeId: string) => void
  onPlay: (takeId: string) => void
  onSeek: (takeId: string, progress: number) => void
  onAddReflection: (
    takeId: string,
    kind: VoiceReflectionKind,
    position: number,
    note: string,
  ) => void
  onRemoveReflection: (takeId: string, reflectionId: string) => void
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(1, Math.max(0, value))
}

function formatClock(seconds: number): string {
  const safeSeconds = Number.isFinite(seconds) ? Math.max(0, seconds) : 0
  if (safeSeconds > 0 && safeSeconds < 10) return `${safeSeconds.toFixed(1)}s`
  const rounded = Math.round(safeSeconds)
  const minutes = Math.floor(rounded / 60)
  return `${minutes}:${String(rounded % 60).padStart(2, '0')}`
}

function formatDuration(milliseconds: number): string {
  return formatClock(milliseconds / 1000)
}

function takeDurationSeconds(take: VoiceTakeRecord | null): number {
  if (take === null || !Number.isFinite(take.durationMs)) return 0
  return Math.max(0, take.durationMs / 1000)
}

function sharedPositionForTake(
  take: VoiceTakeRecord,
  takeProgress: number,
  sharedDurationSeconds: number,
): number {
  if (sharedDurationSeconds <= 0) return 0
  return clamp01(
    (clamp01(takeProgress) * takeDurationSeconds(take)) / sharedDurationSeconds,
  )
}

function takePositionFromShared(
  take: VoiceTakeRecord,
  sharedProgress: number,
  sharedDurationSeconds: number,
): number {
  const duration = takeDurationSeconds(take)
  if (duration <= 0) return 0
  return clamp01((clamp01(sharedProgress) * sharedDurationSeconds) / duration)
}

function stateLabel(trail: VoiceAtlasTrailModel): string {
  if (trail.state === 'mapped') return 'Pitch + energy'
  if (trail.state === 'energy-only') return 'Energy only'
  if (trail.state === 'legacy') return 'Waveform archive'
  if (trail.state === 'unavailable') return 'Waveform; analysis unavailable'
  return 'Awaiting take'
}

function canvasSummary(
  model: VoiceAtlasRenderModel,
  loading: boolean,
  selectedTakeCount: number,
): string {
  if (loading) return 'Voice Atlas is mapping the selected takes.'
  const earlier = stateLabel(model.earlier)
  const later = stateLabel(model.later)
  const duration = formatClock(model.durationSeconds)
  const pitch =
    model.pitchTicks.length > 1
      ? ` The shared pitch axis runs from ${model.pitchTicks.at(-1)?.label ?? 'the lower bound'} to ${model.pitchTicks[0]?.label ?? 'the upper bound'}.`
      : ''
  const title = selectedTakeCount < 2 ? 'Take Topography' : 'Twin Trails'
  return `Voice Atlas ${title}. Earlier: ${earlier}. Later: ${later}. Shared real-time axis: ${duration}.${pitch} Unvoiced moments are shown as gaps.`
}

function plotRect(width: number, height: number): PlotRect {
  const left = 50
  const right = Math.max(left + 1, width - 18)
  const top = 18
  const bottom = Math.max(top + 1, height - 38)
  return {
    left,
    right,
    top,
    bottom,
    width: right - left,
    height: bottom - top,
  }
}

function drawGrid(
  context: CanvasRenderingContext2D,
  model: VoiceAtlasRenderModel,
  plot: PlotRect,
): void {
  context.save()
  context.font =
    '600 10px ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif'
  context.textBaseline = 'middle'

  for (const tick of model.pitchTicks) {
    const y = plot.top + tick.y * plot.height
    context.strokeStyle = 'rgba(138, 151, 166, 0.11)'
    context.lineWidth = 1
    context.beginPath()
    context.moveTo(plot.left, y)
    context.lineTo(plot.right, y)
    context.stroke()
    context.fillStyle = 'rgba(166, 179, 196, 0.62)'
    context.textAlign = 'right'
    context.fillText(tick.label, plot.left - 9, y)
  }

  context.textBaseline = 'top'
  for (const tick of model.timeTicks) {
    const x = plot.left + tick.x * plot.width
    context.strokeStyle = 'rgba(138, 151, 166, 0.08)'
    context.lineWidth = 1
    context.beginPath()
    context.moveTo(x, plot.top)
    context.lineTo(x, plot.bottom)
    context.stroke()
    context.fillStyle = 'rgba(166, 179, 196, 0.58)'
    context.textAlign =
      tick.x < 0.08 ? 'left' : tick.x > 0.92 ? 'right' : 'center'
    context.fillText(tick.label, x, plot.bottom + 11)
  }

  context.strokeStyle = 'rgba(203, 216, 232, 0.16)'
  context.beginPath()
  context.moveTo(plot.left, plot.bottom + 0.5)
  context.lineTo(plot.right, plot.bottom + 0.5)
  context.stroke()
  context.restore()
}

function pointCoordinates(
  point: VoiceAtlasTrailModel['points'][number],
  plot: PlotRect,
): { x: number; y: number } | null {
  if (point.y === null) return null
  return {
    x: plot.left + point.x * plot.width,
    y: plot.top + point.y * plot.height,
  }
}

function drawEnergyRibbon(
  context: CanvasRenderingContext2D,
  trail: VoiceAtlasTrailModel,
  plot: PlotRect,
  color: string,
): void {
  for (const segment of trail.segments) {
    const positioned = segment.points.flatMap((point) => {
      const coordinate = pointCoordinates(point, plot)
      if (coordinate === null) return []
      const halfWidth = 1.4 + point.level * (4.5 + point.confidence * 5.5)
      return [{ ...coordinate, halfWidth }]
    })
    if (positioned.length === 0) continue
    if (positioned.length === 1) {
      context.fillStyle = `${color}2f`
      context.beginPath()
      context.arc(
        positioned[0].x,
        positioned[0].y,
        positioned[0].halfWidth,
        0,
        Math.PI * 2,
      )
      context.fill()
      continue
    }

    const gradient = context.createLinearGradient(plot.left, 0, plot.right, 0)
    gradient.addColorStop(0, `${color}12`)
    gradient.addColorStop(0.5, `${color}36`)
    gradient.addColorStop(1, `${color}18`)
    context.fillStyle = gradient
    context.beginPath()
    positioned.forEach((point, index) => {
      if (index === 0) context.moveTo(point.x, point.y - point.halfWidth)
      else context.lineTo(point.x, point.y - point.halfWidth)
    })
    for (let index = positioned.length - 1; index >= 0; index -= 1) {
      const point = positioned[index]
      context.lineTo(point.x, point.y + point.halfWidth)
    }
    context.closePath()
    context.fill()
  }
}

function strokeTrail(
  context: CanvasRenderingContext2D,
  trail: VoiceAtlasTrailModel,
  plot: PlotRect,
  color: string,
  dashed: boolean,
): void {
  const drawPass = (lineWidth: number, alpha: number): void => {
    context.save()
    context.strokeStyle = color
    context.globalAlpha = alpha
    context.lineWidth = lineWidth
    context.lineCap = 'round'
    context.lineJoin = 'round'
    context.setLineDash(dashed ? [1.4, 6.2] : [])
    for (const segment of trail.segments) {
      context.beginPath()
      let started = false
      for (const point of segment.points) {
        const coordinate = pointCoordinates(point, plot)
        if (coordinate === null) continue
        if (!started) {
          context.moveTo(coordinate.x, coordinate.y)
          started = true
        } else {
          context.lineTo(coordinate.x, coordinate.y)
        }
      }
      if (started) context.stroke()
    }
    context.restore()
  }

  drawPass(dashed ? 5 : 6, dashed ? 0.1 : 0.11)
  drawPass(dashed ? 2.1 : 2.35, dashed ? 0.88 : 0.92)
}

function drawEnergyOnly(
  context: CanvasRenderingContext2D,
  trail: VoiceAtlasTrailModel,
  plot: PlotRect,
  color: string,
  lane: number,
): void {
  const points = trail.points
  if (points.length === 0) return
  const center = plot.top + plot.height * lane
  context.save()
  context.fillStyle = `${color}24`
  context.strokeStyle = `${color}a6`
  context.lineWidth = 1.5
  context.beginPath()
  points.forEach((point, index) => {
    const x = plot.left + point.x * plot.width
    const y = center - point.level * 17
    if (index === 0) context.moveTo(x, y)
    else context.lineTo(x, y)
  })
  for (let index = points.length - 1; index >= 0; index -= 1) {
    const point = points[index]
    context.lineTo(plot.left + point.x * plot.width, center + point.level * 17)
  }
  context.closePath()
  context.fill()
  context.beginPath()
  points.forEach((point, index) => {
    const x = plot.left + point.x * plot.width
    const y = center - point.level * 17
    if (index === 0) context.moveTo(x, y)
    else context.lineTo(x, y)
  })
  context.stroke()
  context.restore()
}

function drawFallbackPeaks(
  context: CanvasRenderingContext2D,
  take: VoiceTakeRecord | null,
  trail: VoiceAtlasTrailModel,
  plot: PlotRect,
  sharedDurationSeconds: number,
  color: string,
  lane: number,
  dashed: boolean,
): void {
  if (
    take === null ||
    (trail.state !== 'legacy' && trail.state !== 'unavailable') ||
    take.peaks.length === 0 ||
    sharedDurationSeconds <= 0
  ) {
    return
  }
  const takeWidth = Math.min(
    plot.width,
    plot.width * (takeDurationSeconds(take) / sharedDurationSeconds),
  )
  const pointCount = Math.min(take.peaks.length, 640)
  const center = plot.top + plot.height * lane
  const height = Math.min(28, plot.height * 0.13)
  const sampled = Array.from({ length: pointCount }, (_, index) => {
    const sourceIndex = Math.min(
      take.peaks.length - 1,
      Math.floor((index / Math.max(1, pointCount - 1)) * take.peaks.length),
    )
    return clamp01(Math.abs(take.peaks[sourceIndex] ?? 0))
  })
  context.save()
  context.fillStyle = `${color}18`
  context.strokeStyle = `${color}8f`
  context.lineWidth = 1.4
  context.lineCap = 'round'
  context.setLineDash(dashed ? [1.2, 5.2] : [])
  context.beginPath()
  sampled.forEach((peak, index) => {
    const x = plot.left + (index / Math.max(1, pointCount - 1)) * takeWidth
    const y = center - Math.max(1, peak * height)
    if (index === 0) context.moveTo(x, y)
    else context.lineTo(x, y)
  })
  for (let index = sampled.length - 1; index >= 0; index -= 1) {
    const peak = sampled[index]
    const x = plot.left + (index / Math.max(1, pointCount - 1)) * takeWidth
    context.lineTo(x, center + Math.max(1, peak * height))
  }
  context.closePath()
  context.fill()
  context.beginPath()
  sampled.forEach((peak, index) => {
    const x = plot.left + (index / Math.max(1, pointCount - 1)) * takeWidth
    const y = center - Math.max(1, peak * height)
    if (index === 0) context.moveTo(x, y)
    else context.lineTo(x, y)
  })
  context.stroke()
  context.restore()
}

function drawAtlas(
  canvas: HTMLCanvasElement,
  model: VoiceAtlasRenderModel,
  earlier: VoiceTakeRecord | null,
  later: VoiceTakeRecord | null,
): void {
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  syncCanvasBacking(canvas, dpr)
  const bounds = canvas.getBoundingClientRect()
  if (bounds.width <= 0 || bounds.height <= 0) return
  const context = canvas.getContext('2d')
  if (context === null) return
  context.setTransform(dpr, 0, 0, dpr, 0, 0)
  context.clearRect(0, 0, bounds.width, bounds.height)

  const plot = plotRect(bounds.width, bounds.height)
  drawGrid(context, model, plot)

  if (model.earlier.state === 'mapped') {
    drawEnergyRibbon(context, model.earlier, plot, EARLIER_COLOR)
  } else if (model.earlier.state === 'energy-only') {
    drawEnergyOnly(context, model.earlier, plot, EARLIER_COLOR, 0.4)
  }
  if (model.later.state === 'mapped') {
    drawEnergyRibbon(context, model.later, plot, LATER_COLOR)
  } else if (model.later.state === 'energy-only') {
    drawEnergyOnly(context, model.later, plot, LATER_COLOR, 0.6)
  }
  drawFallbackPeaks(
    context,
    earlier,
    model.earlier,
    plot,
    model.durationSeconds,
    EARLIER_COLOR,
    0.4,
    true,
  )
  drawFallbackPeaks(
    context,
    later,
    model.later,
    plot,
    model.durationSeconds,
    LATER_COLOR,
    0.6,
    false,
  )

  if (model.earlier.state === 'mapped') {
    strokeTrail(context, model.earlier, plot, EARLIER_COLOR, true)
  }
  if (model.later.state === 'mapped') {
    strokeTrail(context, model.later, plot, LATER_COLOR, false)
  }
}

interface TrailCardProps {
  label: 'Earlier' | 'Later'
  take: VoiceTakeRecord | null
  trail: VoiceAtlasTrailModel
  selected: boolean
  selector?: JSX.Element
  onSelect: (takeId: string) => void
}

function TrailCard(props: TrailCardProps): JSX.Element {
  const lowerLabel = (): 'earlier' | 'later' =>
    props.label === 'Earlier' ? 'earlier' : 'later'
  return (
    <article
      classList={{
        [styles.trailCard]: true,
        [styles.earlierCard]: props.label === 'Earlier',
        [styles.laterCard]: props.label === 'Later',
        [styles.selectedCard]: props.selected,
      }}
      data-testid={`voice-atlas-card-${lowerLabel()}`}
      data-selected={props.selected}
      onClick={(event) => {
        const target = event.target
        if (
          target instanceof Element &&
          target.closest('button, select, input, textarea, a') !== null
        ) {
          return
        }
        const takeId = props.take?.id
        if (takeId !== undefined) props.onSelect(takeId)
      }}
    >
      <button
        type="button"
        class={styles.trailIdentity}
        disabled={props.take === null}
        aria-label={`Select ${props.label} take for the playhead and reflections`}
        aria-pressed={props.selected}
        onClick={() => {
          const takeId = props.take?.id
          if (takeId !== undefined) props.onSelect(takeId)
        }}
      >
        <span class={styles.trailSwatch} aria-hidden="true" />
        <div>
          <span class={styles.trailLabel}>{props.label}</span>
          <strong>
            {props.take?.title ?? `Choose an ${lowerLabel()} take`}
          </strong>
          <small>{props.selected ? 'Selected' : 'Select take'}</small>
        </div>
      </button>
      <div class={styles.trailMeta}>
        <span>{stateLabel(props.trail)}</span>
        <Show when={props.take !== null}>
          <span>{formatDuration(props.take?.durationMs ?? 0)}</span>
        </Show>
      </div>
      <Show when={props.selector !== undefined}>
        <div class={styles.selectorSlot}>{props.selector}</div>
      </Show>
    </article>
  )
}

export function VoiceAtlasPanel(props: VoiceAtlasPanelProps): JSX.Element {
  let canvas: HTMLCanvasElement | undefined
  let roomButton: HTMLButtonElement | undefined
  let reflectionButton: HTMLButtonElement | undefined
  let resizeObserver: ResizeObserver | null = null
  let dprWatcher: ReturnType<typeof createDprWatcher> | null = null
  let redraw: ReturnType<typeof createRedrawScheduler> | null = null
  const titleId = createUniqueId()
  const noteId = createUniqueId()
  const inspectorId = createUniqueId()
  const [note, setNote] = createSignal('')
  const [selectedMarkerId, setSelectedMarkerId] = createSignal<string | null>(
    null,
  )
  const [inspector, setInspector] = createSignal<'reflection' | 'room' | null>(
    null,
  )
  const [mobileInspector, setMobileInspector] = createSignal(false)

  const closeInspector = (): void => {
    const current = inspector()
    setInspector(null)
    queueMicrotask(() => {
      if (current === 'room') roomButton?.focus()
      if (current === 'reflection') reflectionButton?.focus()
    })
  }

  const takeForId = (id: string | null): VoiceTakeRecord | null => {
    if (id === null) return null
    if (props.earlier?.id === id) return props.earlier
    if (props.later?.id === id) return props.later
    return null
  }
  const activeTake = (): VoiceTakeRecord | null => takeForId(props.activeId)
  const selectedTake = (): VoiceTakeRecord | null =>
    takeForId(props.selectedId) ?? props.earlier ?? props.later
  const seekTarget = (): VoiceTakeRecord | null => selectedTake()
  const currentProgress = (): number =>
    activeTake()?.id === selectedTake()?.id ? clamp01(props.progress) : 0
  const currentSeconds = (): number =>
    currentProgress() * takeDurationSeconds(selectedTake())
  const selectedTone = (): 'earlier' | 'later' =>
    props.later !== null && selectedTake()?.id === props.later.id
      ? 'later'
      : 'earlier'
  const selectedLabel = (): string =>
    selectedTone() === 'later' ? 'Later take' : 'Earlier take'
  const currentSharedProgress = (): number => {
    const take = selectedTake()
    if (take === null) return 0
    return sharedPositionForTake(
      take,
      currentProgress(),
      props.model.durationSeconds,
    )
  }

  const markers = createMemo<readonly ReflectionMarker[]>(() => {
    const output: ReflectionMarker[] = []
    const earlierId = props.earlier?.id
    const laterId = props.later?.id
    if (earlierId !== undefined) {
      output.push(
        ...props.earlierReflections.map((reflection) => ({
          reflection,
          takeId: earlierId,
          trail: 'earlier' as const,
        })),
      )
    }
    if (laterId !== undefined) {
      output.push(
        ...props.laterReflections.map((reflection) => ({
          reflection,
          takeId: laterId,
          trail: 'later' as const,
        })),
      )
    }
    return output
  })
  const selectedMarker = (): ReflectionMarker | null =>
    markers().find((marker) => marker.reflection.id === selectedMarkerId()) ??
    null
  const markerSharedPosition = (marker: ReflectionMarker): number => {
    const take = takeForId(marker.takeId)
    if (take === null) return 0
    return sharedPositionForTake(
      take,
      marker.reflection.position,
      props.model.durationSeconds,
    )
  }
  const selectedTakeCount = (): number =>
    Number(props.earlier !== null) + Number(props.later !== null)
  const atlasTitle = (): string =>
    selectedTakeCount() < 2 ? 'Take Topography' : 'Twin Trails'

  const availabilityCopy = (): string => {
    if (props.loading === true) {
      return 'Resolving the private contour stored with each selected take.'
    }
    if (props.model.availability === 'twin-trails') {
      return 'Same clock. Same pitch map. No time-stretching between performances.'
    }
    if (props.model.availability === 'single-trail') {
      if (selectedTakeCount() < 2) {
        return 'Your first Take Topography is mapped. Add another take to reveal Twin Trails.'
      }
      if (
        props.model.earlier.state === 'energy-only' ||
        props.model.later.state === 'energy-only'
      ) {
        return 'One pitch trail is mapped. The other preserves energy where pitch did not resolve.'
      }
      if (
        props.model.earlier.state === 'unavailable' ||
        props.model.later.state === 'unavailable'
      ) {
        return 'One trail is mapped. Analysis is unavailable for the other, whose waveform remains playable.'
      }
      return 'One trail is mapped. The other take remains playable as a waveform archive.'
    }
    if (props.model.availability === 'energy-only') {
      if (
        props.model.earlier.state === 'unavailable' ||
        props.model.later.state === 'unavailable'
      ) {
        return 'Energy remains visible for one selection; analysis is unavailable for the other waveform.'
      }
      return 'Pitch did not resolve confidently here. Energy remains visible without inventing a melody.'
    }
    if (props.model.availability === 'legacy') {
      return selectedTakeCount() < 2
        ? 'This take predates Voice Atlas. It still plays normally.'
        : 'These takes predate Voice Atlas. They still play normally.'
    }
    if (props.model.availability === 'unavailable') {
      return selectedTakeCount() < 2
        ? 'Pitch analysis is unavailable for this take. Its waveform still plays normally.'
        : 'Pitch analysis is unavailable for these selections. Their waveforms still play normally.'
    }
    return 'Keep a take to begin mapping this practice thread.'
  }
  const statusLabel = (): string => {
    if (props.loading === true) return 'Mapping takes'
    if (props.model.availability === 'twin-trails') return '2 / 2 mapped'
    if (props.model.availability === 'single-trail') {
      return selectedTakeCount() < 2 ? '1 mapped' : '1 / 2 mapped'
    }
    if (props.model.availability === 'energy-only') return 'Energy only'
    if (props.model.availability === 'legacy') return 'Waveform archive'
    if (props.model.availability === 'unavailable') {
      return 'Analysis unavailable'
    }
    return 'Awaiting take'
  }

  const seekSharedPosition = (progress: number): void => {
    const take = seekTarget()
    if (take === null) return
    props.onSeek(
      take.id,
      takePositionFromShared(take, progress, props.model.durationSeconds),
    )
  }
  const seekFromPointer = (event: PointerEvent): void => {
    const target = event.currentTarget as HTMLDivElement
    const bounds = target.getBoundingClientRect()
    if (bounds.width <= 0) return
    seekSharedPosition((event.clientX - bounds.left) / bounds.width)
  }
  const handleSliderKey = (event: KeyboardEvent): void => {
    const take = seekTarget()
    const duration = takeDurationSeconds(take)
    if (duration <= 0 || take === null) return
    const arrowStep = Math.min(1, duration) / duration
    const pageStep = Math.min(5, duration) / duration
    const current = currentProgress()
    const next =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? 1
          : event.key === 'ArrowLeft' || event.key === 'ArrowDown'
            ? current - arrowStep
            : event.key === 'ArrowRight' || event.key === 'ArrowUp'
              ? current + arrowStep
              : event.key === 'PageDown'
                ? current - pageStep
                : event.key === 'PageUp'
                  ? current + pageStep
                  : null
    if (next === null) return
    event.preventDefault()
    props.onSeek(take.id, clamp01(next))
  }

  const addReflection = (kind: VoiceReflectionKind): void => {
    const take = selectedTake()
    if (take === null) return
    props.onAddReflection(take.id, kind, currentProgress(), note().trim())
    setNote('')
  }

  const selectedReflectionSummary = () => {
    const marker = selectedMarker()
    if (marker === null) return null
    return {
      kind: marker.reflection.kind,
      note: marker.reflection.note,
      seconds:
        marker.reflection.position *
        takeDurationSeconds(takeForId(marker.takeId)),
    }
  }

  const inspectorContent = (mode: 'reflection' | 'room'): JSX.Element => {
    return (
      <VoiceAtlasInspector
        mode={mode}
        selectedTakeLabel={selectedTake() === null ? null : selectedLabel()}
        selectedSeconds={currentSeconds()}
        note={note()}
        noteInputId={noteId}
        selectedReflection={selectedReflectionSummary()}
        roomPanel={props.roomPanel}
        onClose={closeInspector}
        onNote={setNote}
        onAddReflection={addReflection}
        onRemoveSelectedReflection={() => {
          const selected = selectedMarker()
          if (selected === null) return
          props.onRemoveReflection(selected.takeId, selected.reflection.id)
          setSelectedMarkerId(null)
        }}
      />
    )
  }

  createEffect(() => {
    void props.model
    void props.loading
    void props.earlier
    void props.later
    redraw?.queue()
  })

  onMount(() => {
    const syncMobileInspector = (): void => {
      setMobileInspector(window.innerWidth <= 680)
    }
    syncMobileInspector()
    window.addEventListener('resize', syncMobileInspector)
    redraw = createRedrawScheduler(() => {
      if (canvas !== undefined) {
        drawAtlas(canvas, props.model, props.earlier, props.later)
      }
    })
    if (canvas !== undefined && typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => redraw?.queue())
      resizeObserver.observe(canvas)
    }
    if (typeof window.matchMedia === 'function') {
      dprWatcher = createDprWatcher(() => redraw?.queue())
    }
    redraw.queue()
    onCleanup(() => window.removeEventListener('resize', syncMobileInspector))
  })

  onCleanup(() => {
    resizeObserver?.disconnect()
    dprWatcher?.dispose()
    redraw?.cancel()
  })

  return (
    <section
      class={styles.atlas}
      classList={{
        [styles.inspectorOpen]: inspector() !== null && !mobileInspector(),
      }}
      aria-labelledby={titleId}
      aria-busy={props.loading === true}
      onKeyDown={(event) => {
        if (event.key !== 'Escape' || inspector() === null) return
        event.stopPropagation()
        closeInspector()
      }}
    >
      <div class={styles.heading}>
        <div>
          <span class={styles.kicker}>Voice Atlas</span>
          <h3 id={titleId}>{atlasTitle()}</h3>
          <p>
            {availabilityCopy()}{' '}
            <span>True time · pitch + energy · gaps preserved.</span>
          </p>
        </div>
        <output class={styles.status} aria-live="polite">
          <span aria-hidden="true" />
          {statusLabel()}
        </output>
      </div>

      <div class={styles.workspaceShell}>
        <div class={styles.canvasColumn}>
          <div class={styles.legend} aria-label={`${atlasTitle()} legend`}>
            <span class={styles.earlierLegend}>
              <i aria-hidden="true" /> Earlier
            </span>
            <Show when={props.later !== null}>
              <span class={styles.laterLegend}>
                <i aria-hidden="true" /> Later
              </span>
            </Show>
            <span class={styles.energyLegend}>
              <i aria-hidden="true" /> Relative energy
            </span>
          </div>

          <Show when={props.totalTakeCount > 2}>
            <div class={styles.pairBar}>
              <div>
                <span>Comparison pair</span>
                <strong>2 of {props.totalTakeCount} takes</strong>
                <p>Choose any earlier and later moment.</p>
              </div>
              <div
                class={styles.pairPresets}
                role="group"
                aria-label="Choose a comparison pair"
              >
                <button
                  type="button"
                  aria-pressed={props.pairPreset === 'full-span'}
                  onClick={() => props.onChoosePairPreset('full-span')}
                >
                  Full span
                </button>
                <button
                  type="button"
                  aria-pressed={props.pairPreset === 'latest'}
                  onClick={() => props.onChoosePairPreset('latest')}
                >
                  Latest two
                </button>
              </div>
            </div>
          </Show>

          <div
            class={styles.trailCards}
            classList={{ [styles.singleTrail]: props.later === null }}
          >
            <TrailCard
              label="Earlier"
              take={props.earlier}
              trail={props.model.earlier}
              selected={props.selectedId === props.earlier?.id}
              selector={props.earlierSelector}
              onSelect={props.onSelect}
            />
            <Show when={props.later !== null}>
              <TrailCard
                label="Later"
                take={props.later}
                trail={props.model.later}
                selected={props.selectedId === props.later?.id}
                selector={props.laterSelector}
                onSelect={props.onSelect}
              />
            </Show>
          </div>

          <div class={styles.plotFrame}>
            <canvas
              ref={canvas}
              class={styles.canvas}
              role="img"
              aria-label={canvasSummary(
                props.model,
                props.loading === true,
                selectedTakeCount(),
              )}
            />
            <div class={styles.plotBounds}>
              <div
                class={styles.slider}
                data-testid="voice-atlas-slider"
                role="slider"
                tabindex={seekTarget() === null ? -1 : 0}
                aria-label={`Seek ${seekTarget()?.title ?? 'selected Voice Atlas take'}`}
                aria-disabled={seekTarget() === null}
                aria-orientation="horizontal"
                aria-valuemin="0"
                aria-valuemax={takeDurationSeconds(seekTarget())}
                aria-valuenow={Number(currentSeconds().toFixed(2))}
                aria-valuetext={`${formatClock(currentSeconds())} of ${formatClock(takeDurationSeconds(seekTarget()))}`}
                onPointerDown={(event) => {
                  if (event.pointerType === 'mouse' && event.button !== 0)
                    return
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
                onKeyDown={handleSliderKey}
              />

              <Show when={selectedTake() !== null}>
                <div
                  class={styles.playhead}
                  classList={{
                    [styles.playheadMoving]:
                      props.playing && props.activeId === selectedTake()?.id,
                  }}
                  style={{
                    '--atlas-position': `${currentSharedProgress() * 100}%`,
                  }}
                  aria-hidden="true"
                >
                  <span />
                </div>
              </Show>

              <div
                class={styles.beaconLayer}
                aria-label="Saved reflection beacons"
              >
                <For each={markers()}>
                  {(marker) => (
                    <button
                      type="button"
                      classList={{
                        [styles.beaconMarker]: true,
                        [styles.earlierMarker]: marker.trail === 'earlier',
                        [styles.laterMarker]: marker.trail === 'later',
                        [styles.keepMarker]: marker.reflection.kind === 'keep',
                        [styles.curiousMarker]:
                          marker.reflection.kind === 'curious',
                        [styles.tryMarker]:
                          marker.reflection.kind === 'try-next',
                        [styles.selectedMarker]:
                          selectedMarkerId() === marker.reflection.id,
                      }}
                      style={{
                        '--atlas-position': `${markerSharedPosition(marker) * 100}%`,
                      }}
                      data-testid={`voice-atlas-marker-${marker.reflection.id}`}
                      data-voice-playback-seek
                      aria-label={`Seek to ${voiceReflectionLabel(marker.reflection.kind)} reflection at ${formatClock(marker.reflection.position * takeDurationSeconds(takeForId(marker.takeId)))}${marker.reflection.note === '' ? '' : `: ${marker.reflection.note}`}`}
                      aria-pressed={selectedMarkerId() === marker.reflection.id}
                      onClick={() => {
                        setSelectedMarkerId(marker.reflection.id)
                        setInspector('reflection')
                        props.onSeek(marker.takeId, marker.reflection.position)
                      }}
                    >
                      <span aria-hidden="true" />
                    </button>
                  )}
                </For>
              </div>
            </div>

            <Show when={props.loading === true}>
              <div class={styles.loadingVeil} aria-hidden="true">
                <span />
                <span />
                <span />
              </div>
            </Show>
          </div>

          <VoicePlaybackTransport
            take={selectedTake()}
            activeId={props.activeId}
            progress={props.progress}
            playing={props.playing}
            eyebrow={selectedLabel()}
            tone={selectedTone()}
            onPlay={(takeId) => {
              props.onSelect(takeId)
              props.onPlay(takeId)
            }}
            onSeek={(takeId, progress) => {
              props.onSelect(takeId)
              props.onSeek(takeId, progress)
            }}
            actions={
              <div class={styles.transportActions}>
                <button
                  ref={roomButton}
                  type="button"
                  class={styles.transportTool}
                  classList={{
                    [styles.transportToolActive]: inspector() === 'room',
                  }}
                  aria-controls={inspectorId}
                  aria-expanded={inspector() === 'room'}
                  onClick={() =>
                    setInspector((current) =>
                      current === 'room' ? null : 'room',
                    )
                  }
                >
                  <SlidersHorizontal aria-hidden="true" />
                  <span>Room</span>
                </button>
                <button
                  ref={reflectionButton}
                  type="button"
                  class={styles.transportTool}
                  classList={{
                    [styles.transportToolActive]: inspector() === 'reflection',
                  }}
                  aria-controls={inspectorId}
                  aria-expanded={inspector() === 'reflection'}
                  onClick={() =>
                    setInspector((current) =>
                      current === 'reflection' ? null : 'reflection',
                    )
                  }
                >
                  <Pencil aria-hidden="true" />
                  <span>Add reflection</span>
                </button>
              </div>
            }
          />

          <VoiceAtlasTraits
            earlier={props.earlier}
            later={props.later}
            earlierContour={props.earlierContour}
            laterContour={props.laterContour}
          />
        </div>

        <Show when={inspector()} keyed>
          {(mode) => (
            <Show
              when={mobileInspector()}
              fallback={
                <aside
                  id={inspectorId}
                  class={styles.inspector}
                  role="region"
                  aria-label="Listening tools"
                >
                  {inspectorContent(mode)}
                </aside>
              }
            >
              <Sheet
                isOpen={true}
                close={closeInspector}
                ariaLabel="Listening tools"
                snap="content"
                class={styles.mobileInspectorSheet}
              >
                <div id={inspectorId} class={styles.mobileInspectorContent}>
                  {inspectorContent(mode)}
                </div>
              </Sheet>
            </Show>
          )}
        </Show>
      </div>
    </section>
  )
}
