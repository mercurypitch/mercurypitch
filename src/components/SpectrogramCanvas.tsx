import type { Component } from 'solid-js'
import { createEffect, createSignal, onCleanup, onMount } from 'solid-js'
import type { ColourMapId } from '@/lib/colour-maps'
import { getColourMap } from '@/lib/colour-maps'

export type NormalizeMode = 'column' | 'view' | 'hybrid'

interface SpectrogramCanvasProps {
  magnitudeSpectrum: Float32Array | null
  isActive: boolean
  /** Sample rate for frequency-to-pitch mapping. Default 44100. */
  sampleRate?: number
  /** Show piano keyboard overlay on Y-axis. Default true. */
  showPianoKeys?: boolean
  /** Colour map to use. Default 'viridis'. */
  colourMap?: ColourMapId
  /** Show only spectral peaks (bins higher than both neighbours). Default false. */
  peakBinsOnly?: boolean
  /** Phase spectrum (-π to π per bin). Used when colourMap is 'phase'. */
  phaseSpectrum?: Float32Array | null
  /** Normalization mode. Default 'column'. */
  normalizeMode?: NormalizeMode
  /** Colour rotation offset (0-1). Shifts the colour map threshold. Default 0. */
  colourRotation?: number
  /** Show harmonic cursor on hover. Default false. */
  showHarmonicCursor?: boolean
  /** Callback with frequency under cursor on hover. */
  onHoverFrequency?: (freq: number | null) => void
  /** Minimum visible frequency (Hz). Below this renders as background. */
  freqMin?: number
  /** Maximum visible frequency (Hz). Above this renders as background. */
  freqMax?: number
}

// ── Magnitude normalization ────────────────────────────────────

/** Clamp and normalize magnitude to 0-1 based on typical STFT range. */
function normalizeMag(mag: number): number {
  return Math.max(0, Math.min(1, mag / 50))
}

/** Convert phase angle (-π to π) to a cyclic hue-based RGB colour. */
function phaseToColor(phase: number): [number, number, number] {
  // Map [-π, π] to [0, 1]
  const hue = (phase + Math.PI) / (2 * Math.PI)
  // HSV → RGB: hue determines colour, fixed saturation/value
  const h = hue * 6
  const c = 220 // chroma
  const x = c * (1 - Math.abs((h % 2) - 1))
  const m = 15
  let r = 0,
    g = 0,
    b = 0
  if (h < 1) {
    r = c
    g = x
  } else if (h < 2) {
    r = x
    g = c
  } else if (h < 3) {
    g = c
    b = x
  } else if (h < 4) {
    g = x
    b = c
  } else if (h < 5) {
    r = x
    b = c
  } else {
    r = c
    b = x
  }
  return [Math.round(r + m), Math.round(g + m), Math.round(b + m)]
}

// ── Piano keyboard helpers ─────────────────────────────────────

const PIANO_KEY_WIDTH = 36
const MIDI_C2 = 36
const MIDI_C7 = 96
const IS_BLACK = [
  false,
  true,
  false,
  true,
  false,
  false,
  true,
  false,
  true,
  false,
  true,
  false,
]

/** Convert MIDI note number to frequency in Hz (A4=440 equal temperament). */
function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12)
}

// Log-frequency Y axis spanning exactly C2 (bottom) → C7 (top), so the
// piano keys fill the whole canvas height and align with spectrogram rows.
const FREQ_MIN = midiToFreq(MIDI_C2) // ~65.4 Hz
const FREQ_MAX = midiToFreq(MIDI_C7) // ~2093 Hz
const LOG_FREQ_MIN = Math.log(FREQ_MIN)
const LOG_FREQ_RANGE = Math.log(FREQ_MAX) - LOG_FREQ_MIN

/** Map a frequency to its Y position on the spectrogram canvas. */
function freqToY(freq: number, h: number): number {
  const t = (Math.log(freq) - LOG_FREQ_MIN) / LOG_FREQ_RANGE
  return (1 - t) * h
}

/** Inverse of freqToY: the frequency shown at pixel row y. */
function yToFreq(y: number, h: number): number {
  const t = 1 - y / h
  return Math.exp(LOG_FREQ_MIN + t * LOG_FREQ_RANGE)
}

/** Draw piano key backgrounds and C-note shading lines onto the spectrogram. */
function drawPianoOverlay(ctx: CanvasRenderingContext2D, w: number, h: number) {
  // Piano key column background
  ctx.fillStyle = 'rgba(8, 12, 20, 0.85)'
  ctx.fillRect(0, 0, PIANO_KEY_WIDTH, h)

  for (let midi = MIDI_C2; midi < MIDI_C7; midi++) {
    // Each key spans from its own pitch up to the next semitone
    const yBot = freqToY(midiToFreq(midi), h)
    const yTop = freqToY(midiToFreq(midi + 1), h)
    const keyH = Math.max(1, yBot - yTop)

    const noteIdx = midi % 12
    const isBlack = IS_BLACK[noteIdx]

    if (isBlack) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)'
      ctx.fillRect(0, yTop, PIANO_KEY_WIDTH * 0.6, keyH)
    } else {
      // White key with subtle border
      ctx.fillStyle = 'rgba(30, 36, 50, 0.7)'
      ctx.fillRect(0, yTop, PIANO_KEY_WIDTH, keyH)
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)'
      ctx.lineWidth = 0.5
      ctx.beginPath()
      ctx.moveTo(0, yTop)
      ctx.lineTo(PIANO_KEY_WIDTH, yTop)
      ctx.stroke()
    }

    // C-note label and shading line
    if (noteIdx === 0) {
      // Label on the key
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'
      ctx.font = '9px sans-serif'
      ctx.textAlign = 'right'
      ctx.textBaseline = 'middle'
      const octave = Math.floor(midi / 12) - 1
      ctx.fillText(`C${octave}`, PIANO_KEY_WIDTH - 6, yTop + keyH / 2)

      // Subtle grey line across the full spectrogram
      ctx.strokeStyle = 'rgba(128, 128, 128, 0.08)'
      ctx.lineWidth = 0.5
      ctx.beginPath()
      ctx.moveTo(PIANO_KEY_WIDTH, yBot)
      ctx.lineTo(w, yBot)
      ctx.stroke()
    }
  }
}

export const SpectrogramCanvas: Component<SpectrogramCanvasProps> = (props) => {
  let canvasRef: HTMLCanvasElement | undefined
  let offscreenCanvas: HTMLCanvasElement | undefined
  let offscreenCtx: CanvasRenderingContext2D | null = null
  let mainCtx: CanvasRenderingContext2D | null = null
  let pianoOverlayCanvas: HTMLCanvasElement | undefined
  let _globalMax = 0 // rolling global max for view/hybrid normalization
  let _hoverFreq: number | null = null // current hover frequency

  const [w, setW] = createSignal(800)
  const [h, setH] = createSignal(200)
  const sr = () => props.sampleRate ?? 44100
  const showKeys = () => props.showPianoKeys ?? true

  /** Pre-render the piano overlay at current canvas dimensions. */
  const buildPianoOverlay = () => {
    const cw = w()
    const ch = h()
    pianoOverlayCanvas = document.createElement('canvas')
    pianoOverlayCanvas.width = cw
    pianoOverlayCanvas.height = ch
    const pctx = pianoOverlayCanvas.getContext('2d', { alpha: true })
    if (!pctx) return
    drawPianoOverlay(pctx, cw, ch)
  }

  const setupOffscreen = () => {
    const cw = w()
    const ch = h()
    offscreenCanvas = document.createElement('canvas')
    offscreenCanvas.width = cw
    offscreenCanvas.height = ch
    offscreenCtx = offscreenCanvas.getContext('2d', {
      alpha: false,
      willReadFrequently: true,
    })
    if (offscreenCtx) {
      offscreenCtx.fillStyle = '#0f172a'
      offscreenCtx.fillRect(0, 0, cw, ch)
    }
    if (showKeys()) buildPianoOverlay()
  }

  onMount(() => {
    if (!canvasRef) return
    mainCtx = canvasRef.getContext('2d', { alpha: false })

    // Read actual canvas dimensions
    const cw = canvasRef.clientWidth
    const ch = canvasRef.clientHeight
    if (cw > 0 && ch > 0) {
      setW(cw)
      setH(ch)
    }

    setupOffscreen()

    // Watch for container resize
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry === undefined) return
      const nw = entry.contentRect.width
      const nh = entry.contentRect.height
      if (nw > 0 && nh > 0 && (nw !== w() || nh !== h())) {
        setW(nw)
        setH(nh)
        setupOffscreen()
      }
    })
    ro.observe(canvasRef)
    onCleanup(() => ro.disconnect())
  })

  createEffect(() => {
    if (
      !props.isActive ||
      !props.magnitudeSpectrum ||
      !mainCtx ||
      !offscreenCtx ||
      !offscreenCanvas ||
      !canvasRef
    )
      return

    const spec = props.magnitudeSpectrum
    if (spec.length === 0) return

    // Shift offscreen canvas left by 1px
    offscreenCtx.drawImage(
      offscreenCanvas,
      1,
      0,
      w() - 1,
      h(),
      0,
      0,
      w() - 1,
      h(),
    )

    // Draw new column on the right edge
    const cw = w()
    const ch = h()
    // Spectrum is a half-spectrum (nFft/2 + 1 bins, DC..Nyquist)
    const maxBin = spec.length - 1
    const nFft = 2 * (spec.length - 1)
    const srate = sr()

    const imgData = offscreenCtx.createImageData(1, ch)
    const peakOnly = props.peakBinsOnly === true
    const isPhase = props.colourMap === 'phase' && props.phaseSpectrum != null
    const phaseSpec = props.phaseSpectrum
    const colourFn = getColourMap(
      isPhase ? 'viridis' : (props.colourMap ?? 'viridis'),
    )
    const bgR = 15,
      bgG = 23,
      bgB = 42 // #0f172a background
    const normMode = props.normalizeMode ?? 'column'
    const rotation = props.colourRotation ?? 0

    // Compute column max for normalization
    let columnMax = 0
    if (normMode !== 'column') {
      for (let y = 0; y < ch; y++) {
        const freq = yToFreq(y + 0.5, ch)
        const binIdx = Math.max(
          0,
          Math.min(maxBin, Math.round((freq * nFft) / srate)),
        )
        const m = spec[binIdx] ?? 0
        if (m > columnMax) columnMax = m
      }
    }
    // For view/hybrid mode, use a rolling global max
    if (normMode === 'view' || normMode === 'hybrid') {
      const stored = _globalMax
      _globalMax = stored > 0 ? stored * 0.995 + columnMax * 0.005 : columnMax
    }

    const applyNorm = (mag: number): number => {
      if (mag <= 0) return 0
      if (normMode === 'column') return Math.min(1, mag / 50)
      if (normMode === 'view') {
        const denom = Math.max(0.01, _globalMax)
        return Math.min(1, mag / denom)
      }
      // hybrid: column-normalized with global floor
      const colNorm = columnMax > 0 ? mag / columnMax : 0
      const viewNorm = _globalMax > 0 ? mag / _globalMax : 0
      return colNorm * 0.7 + viewNorm * 0.3
    }

    const applyColour = (norm: number): [number, number, number] => {
      if (rotation <= 0) return colourFn(norm)
      // Shift the threshold: values below rotation are pushed to 0
      const adjusted = Math.max(
        0,
        Math.min(1, (norm - rotation) / (1 - rotation + 0.001)),
      )
      return colourFn(adjusted)
    }

    for (let y = 0; y < ch; y++) {
      const freq = yToFreq(y + 0.5, ch)
      const binIdx = Math.max(
        0,
        Math.min(maxBin, Math.round((freq * nFft) / srate)),
      )
      const pxIdx = y * 4

      // Frequency range filter: outside range → background
      const freqMin = props.freqMin ?? 0
      const freqMax = props.freqMax ?? 1e6
      if (freq < freqMin || freq > freqMax) {
        imgData.data[pxIdx] = bgR
        imgData.data[pxIdx + 1] = bgG
        imgData.data[pxIdx + 2] = bgB
        imgData.data[pxIdx + 3] = 255
        continue
      }

      if (isPhase && phaseSpec) {
        // Phase mode: colour by phase angle
        const phase = phaseSpec[binIdx] ?? 0
        const [r, g, b] = phaseToColor(phase)
        imgData.data[pxIdx] = r
        imgData.data[pxIdx + 1] = g
        imgData.data[pxIdx + 2] = b
        imgData.data[pxIdx + 3] = 255
      } else if (peakOnly) {
        const mag = spec[binIdx] || 0
        const magAbove = binIdx < maxBin - 1 ? (spec[binIdx + 1] ?? 0) : 0
        const magBelow = binIdx > 0 ? (spec[binIdx - 1] ?? 0) : 0
        const isPeak = mag > magAbove && mag > magBelow

        if (isPeak) {
          const norm = applyNorm(mag)
          const [r, g, b] = applyColour(norm)
          imgData.data[pxIdx] = r
          imgData.data[pxIdx + 1] = g
          imgData.data[pxIdx + 2] = b
        } else {
          imgData.data[pxIdx] = bgR
          imgData.data[pxIdx + 1] = bgG
          imgData.data[pxIdx + 2] = bgB
        }
        imgData.data[pxIdx + 3] = 255
      } else {
        const mag = spec[binIdx] || 0
        const norm = normalizeMag(mag)
        const [r, g, b] = colourFn(norm)
        imgData.data[pxIdx] = r
        imgData.data[pxIdx + 1] = g
        imgData.data[pxIdx + 2] = b
        imgData.data[pxIdx + 3] = 255
      }
    }

    offscreenCtx.putImageData(imgData, cw - 1, 0)

    // Render offscreen to main canvas
    mainCtx.drawImage(offscreenCanvas, 0, 0)

    // Overlay piano keyboard (pre-rendered, just blit)
    if (showKeys() && pianoOverlayCanvas) {
      mainCtx.drawImage(pianoOverlayCanvas, 0, 0)
    }

    // Harmonic cursor overlay
    if (props.showHarmonicCursor === true && _hoverFreq !== null) {
      const f0 = _hoverFreq
      const harmonics = [2, 3, 4, 5, 6, 8]
      const cursorX = cw - 2 // near the right edge of scrolling view
      for (const mult of harmonics) {
        const hFreq = f0 * mult
        const y = freqToY(hFreq, ch)
        if (y >= 0 && y < ch) {
          // Tick mark
          mainCtx.strokeStyle = `rgba(255, 255, 255, ${0.6 - mult * 0.07})`
          mainCtx.lineWidth = 1
          mainCtx.beginPath()
          mainCtx.moveTo(cursorX - 10, y)
          mainCtx.lineTo(cursorX + 2, y)
          mainCtx.stroke()
          // Label
          mainCtx.fillStyle = `rgba(255, 255, 255, ${0.5 - mult * 0.06})`
          mainCtx.font = '8px monospace'
          mainCtx.textAlign = 'right'
          mainCtx.fillText(`${mult}×`, cursorX - 12, y + 3)
        }
      }
    }
  })

  onCleanup(() => {
    offscreenCanvas = undefined
    offscreenCtx = null
    mainCtx = null
    pianoOverlayCanvas = undefined
  })

  return (
    <canvas
      ref={canvasRef}
      width={w()}
      height={h()}
      onMouseMove={(e) => {
        if (props.showHarmonicCursor !== true) return
        const rect = canvasRef?.getBoundingClientRect()
        if (rect === undefined) return
        const y = ((e.clientY - rect.top) / rect.height) * h()
        const freq = yToFreq(y, h())
        _hoverFreq = freq
        props.onHoverFrequency?.(freq)
      }}
      onMouseLeave={() => {
        _hoverFreq = null
        props.onHoverFrequency?.(null)
      }}
      style={{
        width: '100%',
        height: '100%',
        'border-radius': '8px',
        border: '1px solid rgba(255,255,255,0.1)',
        background: '#0f172a',
      }}
    />
  )
}
