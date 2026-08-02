import { PITCH_VISUAL_COLORS } from '@/features/stem-mixer/pitch-canvas-visuals'
import type { ResolvedZenTarget, ZenPitchPoint, ZenTargetHighlight, ZenTargetVisibility, ZenViewport, } from './types'

export interface ZenCanvasRenderModel {
  durationSec: number
  elapsedSec: number
  /** Optional musical grid step. Challenge stages use one beat here so the
   *  canvas lines agree with authored note timing instead of dividing an
   *  arbitrary loop duration into equal visual slices. */
  timeGridIntervalSec?: number
  viewport: ZenViewport
  targets: readonly ResolvedZenTarget[]
  targetVisibility: ZenTargetVisibility
  showPlayhead: boolean
  points: readonly ZenPitchPoint[]
  previousPoints?: readonly ZenPitchPoint[]
  /**
   * Optional per-target emphasis keyed by target id (challenge stage: notes
   * shine while sung and stay lit once cleared). Absent = plain zen look.
   */
  targetHighlights?: ReadonlyMap<string, ZenTargetHighlight>
}

export interface ZenCanvasLayout {
  gutter: number
  top: number
  right: number
  bottom: number
  plotWidth: number
  plotHeight: number
  timeToX: (seconds: number) => number
  midiToY: (midi: number) => number
}

const NOTE_NAMES = [
  'C',
  'C♯',
  'D',
  'D♯',
  'E',
  'F',
  'F♯',
  'G',
  'G♯',
  'A',
  'A♯',
  'B',
] as const

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value))

/** Resolve the vertical time grid. Plain Zen keeps its quiet 4/8-way visual
 * grid; authored stages may supply a musical interval so notes and lines share
 * the same clock. The loop seam is always included. */
export function resolveZenTimeGrid(
  durationSec: number,
  width: number,
  intervalSec?: number,
): number[] {
  const duration = Math.max(0.001, durationSec)
  if (
    intervalSec !== undefined &&
    Number.isFinite(intervalSec) &&
    intervalSec > 0
  ) {
    const times: number[] = []
    for (let time = 0; time < duration - 0.0001; time += intervalSec) {
      times.push(time)
    }
    times.push(duration)
    return times
  }

  const divisions = width < 620 ? 4 : 8
  return Array.from(
    { length: divisions + 1 },
    (_, division) => (duration * division) / divisions,
  )
}

export function createZenCanvasLayout(
  width: number,
  height: number,
  model: Pick<ZenCanvasRenderModel, 'durationSec' | 'viewport'>,
): ZenCanvasLayout {
  const gutter = width < 520 ? 34 : 46
  const top = 16
  const right = 14
  const bottom = 24
  const plotWidth = Math.max(1, width - gutter - right)
  const plotHeight = Math.max(1, height - top - bottom)
  const duration = Math.max(0.001, model.durationSec)
  const span = Math.max(1, model.viewport.maxMidi - model.viewport.minMidi)

  return {
    gutter,
    top,
    right,
    bottom,
    plotWidth,
    plotHeight,
    timeToX: (seconds) => gutter + clamp(seconds / duration, 0, 1) * plotWidth,
    midiToY: (midi) =>
      top +
      ((model.viewport.maxMidi -
        clamp(midi, model.viewport.minMidi, model.viewport.maxMidi)) /
        span) *
        plotHeight,
  }
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2))
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + width - r, y)
  ctx.quadraticCurveTo(x + width, y, x + width, y + r)
  ctx.lineTo(x + width, y + height - r)
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height)
  ctx.lineTo(x + r, y + height)
  ctx.quadraticCurveTo(x, y + height, x, y + height - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

function drawGrid(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  model: ZenCanvasRenderModel,
  layout: ZenCanvasLayout,
): void {
  const gradient = ctx.createLinearGradient(0, 0, 0, height)
  gradient.addColorStop(0, '#0b1019')
  gradient.addColorStop(1, '#070a10')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, width, height)

  const min = Math.floor(model.viewport.minMidi)
  const max = Math.ceil(model.viewport.maxMidi)
  ctx.textAlign = 'right'
  ctx.textBaseline = 'middle'
  ctx.font = '600 9px ui-monospace, SFMono-Regular, Menlo, monospace'

  for (let midi = min; midi <= max; midi += 1) {
    const y = layout.midiToY(midi)
    const pitchClass = ((midi % 12) + 12) % 12
    const isC = pitchClass === 0
    ctx.strokeStyle = isC
      ? 'rgba(118, 137, 165, 0.3)'
      : 'rgba(80, 96, 122, 0.14)'
    ctx.lineWidth = isC ? 1 : 0.65
    ctx.beginPath()
    ctx.moveTo(layout.gutter, Math.round(y) + 0.5)
    ctx.lineTo(width - layout.right, Math.round(y) + 0.5)
    ctx.stroke()

    if (isC || width >= 760) {
      const octave = Math.floor(midi / 12) - 1
      ctx.fillStyle = isC
        ? 'rgba(181, 194, 214, 0.72)'
        : 'rgba(133, 148, 171, 0.42)'
      ctx.fillText(`${NOTE_NAMES[pitchClass]}${octave}`, layout.gutter - 7, y)
    }
  }

  const gridTimes = resolveZenTimeGrid(
    model.durationSec,
    width,
    model.timeGridIntervalSec,
  )
  for (const time of gridTimes) {
    const x = layout.timeToX(time)
    const isLoopSeam = Math.abs(time - model.durationSec) < 0.0001
    ctx.strokeStyle = isLoopSeam
      ? 'rgba(245, 158, 11, 0.28)'
      : 'rgba(80, 96, 122, 0.14)'
    ctx.lineWidth = isLoopSeam ? 1.2 : 0.7
    ctx.beginPath()
    ctx.moveTo(Math.round(x) + 0.5, layout.top)
    ctx.lineTo(Math.round(x) + 0.5, height - layout.bottom)
    ctx.stroke()
  }

  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = 'rgba(142, 154, 174, 0.72)'
  ctx.font = '600 9px ui-monospace, SFMono-Regular, Menlo, monospace'
  ctx.fillText('0', layout.gutter, height - 7)
  ctx.textAlign = 'right'
  ctx.fillText(
    `${model.durationSec.toFixed(model.durationSec < 10 ? 1 : 0)}s`,
    width - layout.right,
    height - 7,
  )
}

function drawTargets(
  ctx: CanvasRenderingContext2D,
  model: ZenCanvasRenderModel,
  layout: ZenCanvasLayout,
): void {
  if (model.targetVisibility === 'off') return
  const alpha = model.targetVisibility === 'dim' ? 0.26 : 0.92
  const rowHeight =
    layout.plotHeight /
    Math.max(1, model.viewport.maxMidi - model.viewport.minMidi)

  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  for (const target of model.targets) {
    const highlight = model.targetHighlights?.get(target.id)
    // Missed notes recede so the shining ones read as the story of the run;
    // they stay visible enough to show what was asked.
    ctx.globalAlpha = highlight?.missed === true ? alpha * 0.42 : alpha
    const x1 = layout.timeToX(target.startSec)
    const x2 = layout.timeToX(target.endSec)
    const y1 = layout.midiToY(target.startMidi)
    const y2 = layout.midiToY(target.endMidi)
    const isGlide = Math.abs(target.endMidi - target.startMidi) > 0.01

    if (isGlide) {
      ctx.shadowColor = PITCH_VISUAL_COLORS.reference
      ctx.shadowBlur = model.targetVisibility === 'on' ? 10 : 0
      ctx.strokeStyle = PITCH_VISUAL_COLORS.referenceBright
      ctx.lineWidth = Math.max(5, Math.min(10, rowHeight * 0.55))
      ctx.beginPath()
      ctx.moveTo(x1, y1)
      ctx.lineTo(x2, y2)
      ctx.stroke()
      ctx.shadowBlur = 0
    } else {
      const height = Math.max(12, Math.min(22, rowHeight * 0.72))
      const width = Math.max(8, x2 - x1)
      roundedRect(ctx, x1, y1 - height / 2, width, height, height / 2)
      ctx.fillStyle = PITCH_VISUAL_COLORS.referenceFill
      ctx.fill()
      ctx.strokeStyle = PITCH_VISUAL_COLORS.referenceBright
      ctx.lineWidth = 1
      ctx.stroke()

      if (highlight !== undefined) {
        drawTargetShine(ctx, highlight, x1, y1, width, height)
      }
    }

    if (target.showCue !== false && target.cue.trim() !== '') {
      const labelX = Math.min(x1 + 7, layout.gutter + layout.plotWidth - 28)
      const labelY = isGlide ? y1 - 10 : y1
      ctx.shadowBlur = 0
      ctx.fillStyle = highlight?.cleared === true ? '#fffaf0' : '#fff1d2'
      ctx.font = '700 10px Inter, system-ui, sans-serif'
      ctx.textAlign = 'left'
      ctx.textBaseline = isGlide ? 'bottom' : 'middle'
      ctx.fillText(target.cue, labelX, labelY)
    }
  }
  ctx.restore()
}

/**
 * The challenge stage's "note lights up" pass, layered over the plain pill.
 * Live glow tracks how close the singer is right now; a cleared note keeps a
 * steady shine so the run reads as a trail of lit notes.
 */
function drawTargetShine(
  ctx: CanvasRenderingContext2D,
  highlight: ZenTargetHighlight,
  x: number,
  centreY: number,
  width: number,
  height: number,
): void {
  const glow = clamp(highlight.glow, 0, 1)
  if (glow <= 0.01 && !highlight.cleared) return

  const previousAlpha = ctx.globalAlpha

  // Hot core: the pill itself brightens with the glow.
  roundedRect(ctx, x, centreY - height / 2, width, height, height / 2)
  ctx.globalAlpha = Math.min(1, 0.28 + glow * 0.62)
  ctx.shadowColor = PITCH_VISUAL_COLORS.referenceBright
  ctx.shadowBlur = 8 + glow * 16
  ctx.fillStyle = PITCH_VISUAL_COLORS.referenceBright
  ctx.fill()
  ctx.shadowBlur = 0

  if (highlight.cleared) {
    // A settled halo ring marks the note as won.
    const inset = 2.5
    roundedRect(
      ctx,
      x - inset,
      centreY - height / 2 - inset,
      width + inset * 2,
      height + inset * 2,
      (height + inset * 2) / 2,
    )
    ctx.globalAlpha = 0.5 + glow * 0.3
    ctx.strokeStyle = '#fff4df'
    ctx.lineWidth = 1.4
    ctx.shadowColor = PITCH_VISUAL_COLORS.reference
    ctx.shadowBlur = 12
    ctx.stroke()
    ctx.shadowBlur = 0
  }

  ctx.globalAlpha = previousAlpha
}

function drawTrace(
  ctx: CanvasRenderingContext2D,
  points: readonly ZenPitchPoint[],
  layout: ZenCanvasLayout,
  options: { ghost: boolean },
): void {
  if (points.length === 0) return
  const baseAlpha = options.ghost ? 0.2 : 0.9
  const width = options.ghost ? 2 : 2.8

  const stroke = (lineWidth: number, alpha: number): void => {
    ctx.beginPath()
    let open = false
    for (const point of points) {
      if (
        point.midi === null ||
        point.midi < layoutMidiMin ||
        point.midi > layoutMidiMax
      ) {
        open = false
        continue
      }
      const x = layout.timeToX(point.timeSec)
      const y = layout.midiToY(point.midi)
      if (!open) {
        ctx.moveTo(x, y)
        open = true
      } else {
        ctx.lineTo(x, y)
      }
    }
    ctx.globalAlpha = alpha
    ctx.lineWidth = lineWidth
    ctx.stroke()
  }

  // These values are attached temporarily by renderZenPitchCanvas so trace
  // clipping remains cheap without widening the public layout contract.
  const layoutMidiMin = (layout as ZenCanvasLayout & { midiMin: number })
    .midiMin
  const layoutMidiMax = (layout as ZenCanvasLayout & { midiMax: number })
    .midiMax

  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.strokeStyle = PITCH_VISUAL_COLORS.singer
  if (!options.ghost) {
    ctx.shadowColor = PITCH_VISUAL_COLORS.singer
    ctx.shadowBlur = 12
    stroke(width + 5, 0.12)
    ctx.shadowBlur = 0
  }
  stroke(width, baseAlpha)
  ctx.restore()
}

function drawEdgeIndicators(
  ctx: CanvasRenderingContext2D,
  model: ZenCanvasRenderModel,
  layout: ZenCanvasLayout,
): void {
  const voiced = model.points.filter(
    (point): point is ZenPitchPoint & { midi: number } => point.midi !== null,
  )
  const hasHigh = voiced.some((point) => point.midi > model.viewport.maxMidi)
  const hasLow = voiced.some((point) => point.midi < model.viewport.minMidi)
  if (!hasHigh && !hasLow) return

  ctx.save()
  ctx.fillStyle = PITCH_VISUAL_COLORS.singerBright
  ctx.shadowColor = PITCH_VISUAL_COLORS.singer
  ctx.shadowBlur = 9
  ctx.textAlign = 'center'
  ctx.font = '700 15px Inter, system-ui, sans-serif'
  if (hasHigh) ctx.fillText('↑', layout.gutter + layout.plotWidth - 12, 28)
  if (hasLow) {
    ctx.fillText(
      '↓',
      layout.gutter + layout.plotWidth - 12,
      layout.top + layout.plotHeight - 8,
    )
  }
  ctx.restore()
}

export function renderZenPitchCanvas(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  model: ZenCanvasRenderModel,
): void {
  const layout = createZenCanvasLayout(
    width,
    height,
    model,
  ) as ZenCanvasLayout & {
    midiMin: number
    midiMax: number
  }
  layout.midiMin = model.viewport.minMidi
  layout.midiMax = model.viewport.maxMidi

  ctx.clearRect(0, 0, width, height)
  drawGrid(ctx, width, height, model, layout)

  ctx.save()
  ctx.beginPath()
  ctx.rect(layout.gutter, layout.top, layout.plotWidth, layout.plotHeight)
  ctx.clip()
  drawTargets(ctx, model, layout)
  if (model.previousPoints !== undefined) {
    drawTrace(ctx, model.previousPoints, layout, { ghost: true })
  }
  drawTrace(ctx, model.points, layout, { ghost: false })

  if (model.showPlayhead) {
    const x = layout.timeToX(model.elapsedSec)
    ctx.strokeStyle = PITCH_VISUAL_COLORS.playhead
    ctx.shadowColor = PITCH_VISUAL_COLORS.playhead
    ctx.shadowBlur = 10
    ctx.lineWidth = 1.25
    ctx.beginPath()
    ctx.moveTo(x, layout.top)
    ctx.lineTo(x, layout.top + layout.plotHeight)
    ctx.stroke()
  }
  ctx.restore()

  drawEdgeIndicators(ctx, model, layout)

  const progress = clamp(
    model.elapsedSec / Math.max(0.001, model.durationSec),
    0,
    1,
  )
  ctx.fillStyle = 'rgba(96, 165, 250, 0.14)'
  ctx.fillRect(layout.gutter, 0, layout.plotWidth, 2)
  ctx.fillStyle = PITCH_VISUAL_COLORS.singer
  ctx.fillRect(layout.gutter, 0, layout.plotWidth * progress, 2)
}
