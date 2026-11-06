// ============================================================
// Cast diagnostics — the meter and the device's capabilities, over the stage
// ============================================================
//
// With `diagnostics` on (control.ts) the receiver draws, in the stage's top
// corner inside its overscan margin, what a `probe` would answer: how the
// frames are going (frame-meter.ts) and what the device can do
// (capabilities.ts). On a Cast device there is no console to read; this is
// what the spike (P6, step 6.0) photographs.
//
// Tests: src/lib/cast-receiver/diagnostics-paint.test.ts.

import type { TvStageSize } from '@/lib/tv-stage/layout'
import type { CastCapabilities } from './capabilities'
import type { FrameMeterReading } from './frame-meter'

/** The lines the panel shows, top to bottom. */
export function castDiagnosticsLines(
  meter: FrameMeterReading,
  capabilities: CastCapabilities | null,
): string[] {
  const heap =
    meter.heapMb === null
      ? 'heap not reported'
      : `heap ${String(meter.heapMb)} of ${String(meter.heapLimitMb)} MB`
  const lines = [
    `${String(meter.fps)} fps, median ${String(meter.medianMs)} ms, p95 ${String(meter.p95Ms)} ms, ${String(meter.late)} late of ${String(meter.frames)}`,
    heap,
  ]
  if (capabilities === null) return [...lines, 'reading the device']
  const { screen, audio, network } = capabilities
  const memory =
    capabilities.deviceMemoryGb === null
      ? 'memory not reported'
      : `${String(capabilities.deviceMemoryGb)} GB`
  const latency =
    audio.latencySource === 'measured'
      ? audio.outputLatencyMs === null
        ? 'output latency not read, audio did not start'
        : `output latency ${String(audio.outputLatencyMs)} ms`
      : audio.latencySource === 'calibration'
        ? 'no output latency, calibration'
        : 'no Web Audio'
  return [
    ...lines,
    `${String(screen.width)}x${String(screen.height)} at ${String(screen.pixelRatio)}x, ${String(capabilities.cores ?? '?')} cores, ${memory}`,
    audio.context
      ? `audio ${String(audio.sampleRate)} Hz, ${latency}`
      : `audio: ${latency}`,
    `WebSocket ${network.webSocket ? 'yes' : 'no'}, data channel ${network.dataChannel ? 'yes' : 'no'}`,
  ]
}

/** Draws the panel over the stage. */
export function drawCastDiagnostics(
  ctx: CanvasRenderingContext2D,
  size: TvStageSize,
  meter: FrameMeterReading,
  capabilities: CastCapabilities | null,
): void {
  const lines = castDiagnosticsLines(meter, capabilities)
  const unit = size.height / 1080
  const fontPx = Math.round(24 * unit)
  const lineHeight = Math.round(fontPx * 1.35)
  const pad = Math.round(16 * unit)
  const left = Math.round(size.width * 0.05)
  const top = Math.round(size.height * 0.05)
  ctx.save()
  ctx.font = `500 ${String(fontPx)}px system-ui, sans-serif`
  const width =
    Math.max(...lines.map((line) => ctx.measureText(line).width)) + pad * 2
  ctx.fillStyle = 'rgba(5, 7, 12, 0.82)'
  ctx.fillRect(left, top, width, lines.length * lineHeight + pad * 2)
  ctx.fillStyle = '#e8ecf4'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  lines.forEach((line, index) => {
    ctx.fillText(line, left + pad, top + pad + index * lineHeight)
  })
  ctx.restore()
}
