// ============================================================
// StemMixer Canvas Controller — canvas refs, drawing, handlers, observer
// ============================================================

import type { Accessor, Setter } from 'solid-js'
import { onCleanup } from 'solid-js'
import { createDprWatcher, createRedrawScheduler, syncCanvasBacking, } from '@/lib/canvas-size-sync'
import type { MergedNote, MidiNoteEvent, PitchDetection, } from '@/lib/midi-generator'
import { DEFAULT_BPM, mergeConsecutiveNotes, TICKS_PER_BEAT, } from '@/lib/midi-generator'
import { foldCentsToOctave } from '@/lib/pitch-compare-engine'
import type { DetectedPitch } from '@/lib/pitch-detector'
import type { AlignedWord } from '@/lib/pitch-word-alignment'
import { freqToMidi, midiToNote } from '@/lib/scale-data'
import type { WaveformPeakCache } from '@/lib/waveform-peak-cache'
import { buildWaveformPeakCache, queryWaveformPeakRange, } from '@/lib/waveform-peak-cache'
import type { PitchCanvasScale } from './pitch-canvas-visuals'
import { createPitchCanvasScale, midiToPitchCanvasRow, PITCH_VISUAL_COLORS, pitchCanvasRowToMidi, } from './pitch-canvas-visuals'
import type { EditableNote } from './pitch-edit-model'
import type { PitchNote } from './types'

// ── Types ──────────────────────────────────────────────────────

interface StemTrackView {
  label: string
  color: string
  buffer: AudioBuffer | null
  analyserNode: AnalyserNode | null
}

export interface StemMixerCanvasDeps {
  duration: Accessor<number>
  elapsed: Accessor<number>
  windowStart: Accessor<number>
  windowDuration: Accessor<number>
  tracks: Accessor<StemTrackView[]>
  vocal: Accessor<{ buffer: AudioBuffer | null }>
  getPitchHistory: () => PitchNote[]
  getMicPitchHistory: () => PitchNote[]
  micActive: Accessor<boolean>
  currentPitch: Accessor<DetectedPitch | null>
  midiNotes: Accessor<MidiNoteEvent[]>
  showNoteLabels: Accessor<boolean>
  showLyricLabels: Accessor<boolean>
  showMicLine: Accessor<boolean>
  showUserNoteLabels: Accessor<boolean>
  /** Scoring diff bars (sung↔reference verticals) — debug visual, off by
   *  default. */
  showScoreDiffBars: Accessor<boolean>
  alignedWords: Accessor<AlignedWord[]>
  seekTo: (time: number) => void
  setWindowStart: Setter<number>
  setWindowDuration: Setter<number>
  PITCH_WINDOW_FILL_RATIO: number
  // Loop
  loopEnabled: Accessor<boolean>
  loopStart: Accessor<number>
  loopEnd: Accessor<number>
  setLoopStart: Setter<number>
  setLoopEnd: Setter<number>
  // Touch callbacks
  onCanvasVerticalPinch?: (canvasId: string, deltaY: number) => void
  // Pitch edit mode
  editMode?: Accessor<boolean>
  editableNotes?: Accessor<EditableNote[]>
  /** Original (algorithm) notes — drawn as a faded ghost in 'both' view. */
  baseNotes?: Accessor<EditableNote[]>
  pitchView?: Accessor<'edited' | 'original' | 'both'>
  selectedNoteId?: Accessor<string | null>
  onSelectNote?: (id: string | null) => void
  onBeginEdit?: () => void
  onPreviewEdit?: (
    note: EditableNote,
    patch: Partial<Pick<EditableNote, 'startBeat' | 'endBeat' | 'midi'>>,
  ) => void
  onEndEdit?: () => void
}

export interface StemMixerCanvasController {
  setCanvasRef: (id: string) => (el: HTMLCanvasElement) => void
  formatTime: (secs: number) => string
  syncCanvasSizes: () => void
  drawWaveformOverview: () => void
  drawLiveWaveform: () => void
  drawPitchCanvas: () => void
  drawMidiCanvas: () => void
  redrawAll: () => void
  queueCanvasRedraw: () => void
  handleCanvasWheel: (e: WheelEvent) => void
  handleCanvasTouchStart: (e: TouchEvent) => void
  handleCanvasTouchMove: (e: TouchEvent) => void
  handleCanvasTouchEnd: (e: TouchEvent) => void
  handleCanvasPointerDown: (e: PointerEvent) => void
  handleCanvasPointerMove: (e: PointerEvent) => void
  handleCanvasPointerUp: (e: PointerEvent) => void
  isUserPanning: () => boolean
  initObserver: () => ResizeObserver
  reconnectObserver: () => void
  disconnectObserver: () => void
}

// ── Controller ─────────────────────────────────────────────────

export const useStemMixerCanvasController = (
  deps: StemMixerCanvasDeps,
): StemMixerCanvasController => {
  // ── Unified canvas ref map ───────────────────────────────────
  // Single source of truth — SolidJS ref callbacks update the
  // correct entry regardless of which Show block renders them.
  const canvasRefs: Record<string, HTMLCanvasElement | undefined> = {
    overview: undefined,
    live: undefined,
    pitch: undefined,
    midi: undefined,
  }

  // Declared ahead of setCanvasRef, which (un)observes canvases as SolidJS
  // swaps them in and out of the DOM. Created by initObserver on mount.
  let observer: ResizeObserver | null = null

  const setCanvasRef = (id: string) => (el: HTMLCanvasElement | null) => {
    // Clean up previous listener when SolidJS calls ref(null) on unmount/change
    if (el === null) {
      const prev = canvasRefs[id]
      if (prev) {
        prev.removeEventListener('wheel', handleCanvasWheel)
        prev.removeEventListener('touchstart', handleCanvasTouchStart)
        prev.removeEventListener('touchmove', handleCanvasTouchMove)
        prev.removeEventListener('touchend', handleCanvasTouchEnd)
        observer?.unobserve(prev)
      }
      canvasRefs[id] = undefined
      return
    }
    canvasRefs[id] = el
    el.addEventListener('wheel', handleCanvasWheel, { passive: false })
    el.addEventListener('touchstart', handleCanvasTouchStart, {
      passive: false,
    })
    el.addEventListener('touchmove', handleCanvasTouchMove, { passive: false })
    el.addEventListener('touchend', handleCanvasTouchEnd)
    // Canvases mount/unmount independently of the workspace (Show blocks for
    // karaoke focus, layout switches, HMR) — observe each one as it appears
    // or the observer keeps watching a detached element and this one never
    // triggers a resize redraw.
    if (observer) {
      observer.observe(el)
      queueCanvasRedraw()
    }
  }

  // ── Sizing ───────────────────────────────────────────────────
  // CSS owns the layout size (.sm-canvas is width:100% + flex:1); this only
  // maintains the device-pixel backing stores. See canvas-size-sync.ts for
  // the rules (never pin style.width — it deadlocks the ResizeObserver).
  const syncCanvasSizes = () => {
    const dpr = window.devicePixelRatio || 1
    for (const ref of Object.values(canvasRefs)) {
      if (ref) syncCanvasBacking(ref, dpr)
    }
  }

  // ── Drawing helpers ──────────────────────────────────────────

  const peakCache = new Map<AudioBuffer, WaveformPeakCache>()
  const liveWaveformData = new WeakMap<AnalyserNode, Uint8Array<ArrayBuffer>>()

  const getPeaks = (buffer: AudioBuffer): WaveformPeakCache => {
    if (peakCache.has(buffer)) return peakCache.get(buffer)!
    const data = buffer.getChannelData(0)
    const peaks = buildWaveformPeakCache(data)
    peakCache.set(buffer, peaks)
    return peaks
  }

  const drawWaveformOverview = () => {
    const canvas = canvasRefs.overview
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    const w = canvas.width / dpr
    const h = canvas.height / dpr
    if (h <= 0) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    ctx.clearRect(0, 0, w, h)

    const activeTracks = deps.tracks().filter((t) => t.buffer)
    if (activeTracks.length === 0) return

    const trackHeight = h / activeTracks.length
    const totalDur = deps.duration() || 1
    const winStart = deps.windowStart()
    const winEnd = winStart + deps.windowDuration()

    for (let ti = 0; ti < activeTracks.length; ti++) {
      const track = activeTracks[ti]
      const buffer = track.buffer!
      const data = buffer.getChannelData(0)
      const peaks = getPeaks(buffer)
      const totalSamples = data.length

      const visibleStart = Math.floor((winStart / totalDur) * totalSamples)
      const visibleEnd = Math.min(
        totalSamples,
        Math.floor((winEnd / totalDur) * totalSamples),
      )
      const visibleSamples = visibleEnd - visibleStart
      const samplesPerPixel = visibleSamples / w
      const yOff = ti * trackHeight

      // Center line
      const midY = yOff + trackHeight / 2
      ctx.strokeStyle = `${track.color}40`
      ctx.lineWidth = 0.5
      ctx.beginPath()
      ctx.moveTo(0, midY)
      ctx.lineTo(w, midY)
      ctx.stroke()

      // Exact ranges keep transient peaks in the correct column, so the
      // waveform cannot develop moving moiré as the window scrolls. The
      // segment-tree cache avoids the former two raw 256-sample edge scans per
      // column, which multiplied into tens of millions of operations/second.
      const amp = trackHeight * 0.35
      ctx.strokeStyle = track.color
      ctx.lineWidth = 1
      ctx.beginPath()
      for (let x = 0; x < w; x++) {
        const sStart = visibleStart + Math.floor(x * samplesPerPixel)
        const sEnd = Math.min(
          visibleStart + Math.floor((x + 1) * samplesPerPixel),
          visibleEnd,
        )
        const { min, max } = queryWaveformPeakRange(data, peaks, sStart, sEnd)
        ctx.moveTo(x, midY + min * amp)
        ctx.lineTo(x, midY + max * amp)
      }
      ctx.stroke()

      // Playhead
      const elapsed = deps.elapsed()
      if (elapsed >= winStart && elapsed <= winEnd) {
        const px = ((elapsed - winStart) / deps.windowDuration()) * w
        // Glow effect
        ctx.save()
        ctx.shadowColor = 'rgba(56, 189, 248, 0.6)'
        ctx.shadowBlur = 6
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.85)'
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.moveTo(px, yOff)
        ctx.lineTo(px, yOff + trackHeight)
        ctx.stroke()
        ctx.restore()
        // Triangle head (drawn once on first track)
        if (ti === 0) {
          ctx.fillStyle = 'rgba(56, 189, 248, 0.95)'
          ctx.beginPath()
          ctx.moveTo(px - 4, 0)
          ctx.lineTo(px + 4, 0)
          ctx.lineTo(px, 7)
          ctx.closePath()
          ctx.fill()
        }
      }

      // Loop markers (first track only, to avoid double-rendering). Drawn as
      // soon as A is set — waiting for B (the old `loopEnd() > 0` gate) meant
      // clicking A showed nothing until B closed the region. A alone draws a
      // single marker; A+B draws the shaded region plus both boundaries.
      if (ti === 0 && (deps.loopStart() > 0 || deps.loopEnd() > 0)) {
        const ls = deps.loopStart()
        const le = deps.loopEnd()
        const winDurLocal = deps.windowDuration()
        const xOf = (t: number) => ((t - winStart) / winDurLocal) * w
        const drawMarker = (t: number, color: string, label: string) => {
          const x = xOf(t)
          if (x < -2 || x > w + 2) return
          const cx = Math.max(0, Math.min(w, x))
          ctx.strokeStyle = color
          ctx.lineWidth = 1.5
          ctx.beginPath()
          ctx.moveTo(cx, 0)
          ctx.lineTo(cx, h)
          ctx.stroke()
          ctx.fillStyle = color
          ctx.font = 'bold 10px monospace'
          ctx.fillText(label, label === 'B' ? cx - 10 : cx + 3, 12)
        }

        // Region shade only once both ends exist.
        if (le > 0) {
          const lx1 = xOf(ls)
          const lx2 = xOf(le)
          if (lx2 > 0 && lx1 < w) {
            ctx.fillStyle = 'rgba(88, 166, 255, 0.08)'
            const cX1 = Math.max(0, lx1)
            ctx.fillRect(cX1, 0, Math.min(w, lx2) - cX1, h)
          }
        }
        // Boundary lines: the enabled A+B loop keeps its bright markers; an
        // A-only (or not-yet-enabled) selection shows dimmer "pending" ones so
        // the click registers visually without implying an active loop.
        const active = deps.loopEnabled() && le > 0
        if (ls > 0) {
          drawMarker(
            ls,
            active ? 'rgba(88,166,255,0.9)' : 'rgba(88,166,255,0.5)',
            'A',
          )
        }
        if (le > 0) {
          drawMarker(
            le,
            active ? 'rgba(255,123,114,0.9)' : 'rgba(255,123,114,0.5)',
            'B',
          )
        }
      }

      // Label
      ctx.fillStyle = track.color
      ctx.font = '10px monospace'
      ctx.fillText(track.label, 6, yOff + 14)
    }
  }

  const drawLiveWaveform = () => {
    const canvas = canvasRefs.live
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    const w = canvas.width / dpr
    const h = canvas.height / dpr
    if (h <= 0) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    // Background comes from .sm-canvas CSS (var(--bg-primary)) so the
    // karaoke page's stage-glass translucency applies to these panels too.
    ctx.clearRect(0, 0, w, h)

    const activeTracks = deps.tracks().filter((t) => t.analyserNode)
    if (activeTracks.length === 0) return

    const trackHeight = h / activeTracks.length

    for (let ti = 0; ti < activeTracks.length; ti++) {
      const track = activeTracks[ti]
      const analyser = track.analyserNode!
      let data = liveWaveformData.get(analyser)
      if (data?.length !== analyser.frequencyBinCount) {
        data = new Uint8Array(analyser.frequencyBinCount)
        liveWaveformData.set(analyser, data)
      }
      analyser.getByteTimeDomainData(data)
      const yOff = ti * trackHeight
      const midY = yOff + trackHeight / 2

      ctx.strokeStyle = track.color
      ctx.lineWidth = 1.5
      ctx.beginPath()
      for (let i = 0; i < data.length; i++) {
        const x = (i / data.length) * w
        const y = midY + (data[i] / 128 - 1) * (trackHeight * 0.4)
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()

      ctx.fillStyle = `${track.color}80`
      ctx.font = '9px monospace'
      ctx.fillText(track.label, 4, yOff + 12)
    }
  }

  const drawPitchCanvas = () => {
    const canvas = canvasRefs.pitch
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    const w = canvas.width / dpr
    const h = canvas.height / dpr
    if (h <= 0 || w <= 0) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)

    if (!deps.vocal().buffer) {
      ctx.fillStyle = '#6f7a8e'
      ctx.font = '12px ui-monospace, monospace'
      ctx.textAlign = 'center'
      ctx.fillText('No vocal stem — pitch display unavailable', w / 2, h / 2)
      ctx.textAlign = 'start'
      return
    }

    const pitchHistory = deps.getPitchHistory()
    const micHistory = deps.getMicPitchHistory()
    const editable = deps.editableNotes?.() ?? []
    const editor = deps.editMode?.() === true
    const scaleValues =
      editable.length > 0
        ? editable.map((note) => note.midi)
        : [...pitchHistory, ...micHistory].map((note) =>
            freqToMidi(note.frequency),
          )
    const scale = createPitchCanvasScale(editor, scaleValues)
    const rowH = h / scale.rowCount
    const midiToY = (midi: number): number =>
      midiToPitchCanvasRow(midi, scale) * rowH + rowH * 0.5

    const winStart = deps.windowStart()
    const winDur = deps.windowDuration()
    if (winDur <= 0) return
    const winEnd = winStart + winDur

    // Pitch lanes become a true octave-aware piano roll in Pitch Studio.
    for (let row = 0; row < scale.rowCount; row++) {
      const midi = scale.octaveAware ? scale.maxMidi - row : 11 - row
      const note = midiToNote(midi)
      if (note.name.includes('#')) {
        ctx.fillStyle = 'rgba(148, 163, 184, 0.025)'
        ctx.fillRect(0, row * rowH, w, rowH)
      }
      ctx.strokeStyle =
        scale.octaveAware && note.name === 'C' ? '#344056' : '#202838'
      ctx.lineWidth = note.name === 'C' ? 0.9 : 0.55
      ctx.beginPath()
      ctx.moveTo(0, row * rowH)
      ctx.lineTo(w, row * rowH)
      ctx.stroke()

      const showLabel = !scale.octaveAware || rowH >= 15 || note.name === 'C'
      if (showLabel) {
        ctx.fillStyle =
          scale.octaveAware && note.name === 'C' ? '#93a4bd' : '#5f6c80'
        ctx.font = `${note.name === 'C' ? '600 ' : ''}9px ui-monospace, monospace`
        ctx.fillText(
          scale.octaveAware ? `${note.name}${note.octave}` : note.name,
          5,
          row * rowH + Math.min(rowH * 0.68, rowH - 2),
        )
      }
    }
    ctx.strokeStyle = '#202838'
    ctx.beginPath()
    ctx.moveTo(0, h - 0.5)
    ctx.lineTo(w, h - 0.5)
    ctx.stroke()

    // Vertical ruler uses musical-editor density rather than arbitrary pixels.
    const timeSteps = [0.5, 1, 2, 5, 10, 15, 30, 60]
    const targetStep = winDur / Math.max(5, Math.floor(w / 130))
    const timeStep =
      timeSteps.find((candidate) => candidate >= targetStep) ??
      timeSteps[timeSteps.length - 1]
    const firstGuide = Math.ceil(winStart / timeStep) * timeStep
    ctx.font = '9px ui-monospace, monospace'
    for (let time = firstGuide; time <= winEnd; time += timeStep) {
      const x = ((time - winStart) / winDur) * w
      ctx.strokeStyle = 'rgba(96, 116, 145, 0.2)'
      ctx.lineWidth = 0.6
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, h)
      ctx.stroke()
      if (editor) {
        ctx.fillStyle = '#66758b'
        ctx.fillText(`${time.toFixed(timeStep < 1 ? 1 : 0)}s`, x + 4, 12)
      }
    }

    const toDetections = (history: PitchNote[]): PitchDetection[] =>
      history.map((pitch) => ({
        midi: freqToMidi(pitch.frequency),
        noteName: pitch.noteName,
        timeSec: pitch.time,
      }))

    const drawPill = (
      x1: number,
      x2: number,
      y: number,
      pillH: number,
      radius: number,
    ): void => {
      const pillW = Math.max(x2 - x1, 3)
      ctx.beginPath()
      ctx.moveTo(x1 + radius, y)
      ctx.lineTo(x1 + pillW - radius, y)
      ctx.arcTo(x1 + pillW, y, x1 + pillW, y + radius, radius)
      ctx.lineTo(x1 + pillW, y + pillH - radius)
      ctx.arcTo(x1 + pillW, y + pillH, x1 + pillW - radius, y + pillH, radius)
      ctx.lineTo(x1 + radius, y + pillH)
      ctx.arcTo(x1, y + pillH, x1, y + pillH - radius, radius)
      ctx.lineTo(x1, y + radius)
      ctx.arcTo(x1, y, x1 + radius, y, radius)
      ctx.closePath()
    }

    const drawMergedNotes = (
      merged: MergedNote[],
      fillStyle: string,
      strokeStyle: string,
      userNotes = false,
    ): void => {
      for (const note of merged) {
        if (note.endSec < winStart || note.startSec > winEnd) continue
        const x1 = Math.max(0, ((note.startSec - winStart) / winDur) * w)
        const x2 = Math.min(w, ((note.endSec - winStart) / winDur) * w)
        const y = midiToY(note.midi) - rowH * 0.34
        const pillH = rowH * 0.68
        const radius = Math.min(pillH / 2, editor ? 5 : 3)
        const pillW = Math.max(x2 - x1, 3)
        drawPill(x1, x2, y, pillH, radius)
        ctx.fillStyle = fillStyle
        ctx.fill()
        ctx.strokeStyle = strokeStyle
        ctx.lineWidth = userNotes ? 1.6 : 1.2
        ctx.stroke()

        const pitch = midiToNote(note.midi)
        const noteLabel = scale.octaveAware
          ? `${pitch.name}${pitch.octave}`
          : note.noteName
        if (userNotes && deps.showUserNoteLabels() && pillW > 14) {
          ctx.fillStyle = PITCH_VISUAL_COLORS.singerBright
          ctx.font = '700 8px ui-monospace, monospace'
          ctx.textAlign = 'left'
          ctx.fillText(noteLabel, x1 + 2, Math.max(9, y - 3))
          ctx.textAlign = 'start'
        }
        if (pillW <= 24) continue

        const showNotes = deps.showNoteLabels() || editor
        const showLyrics = deps.showLyricLabels()
        const baseY = y + pillH / 2 + 3
        if (showNotes) {
          ctx.fillStyle = '#fff8eb'
          ctx.font = '700 9px ui-monospace, monospace'
          ctx.textAlign = 'center'
          ctx.fillText(noteLabel, x1 + pillW / 2, baseY)
          ctx.textAlign = 'start'
        }

        if (showLyrics) {
          const words = deps
            .alignedWords()
            .filter(
              (word) =>
                word.midi != null &&
                word.startSec < note.endSec &&
                word.endSec > note.startSec,
            )
          if (words.length > 0) {
            const wordText = words
              .map((word) => word.word)
              .join(' ')
              .slice(0, 20)
            ctx.font = '7px ui-monospace, monospace'
            ctx.fillStyle = 'rgba(255, 255, 255, 0.72)'
            ctx.textAlign = 'center'
            ctx.fillText(
              wordText,
              x1 + pillW / 2,
              showNotes ? baseY + 10 : baseY,
            )
            ctx.textAlign = 'start'
          }
        }
      }
    }

    const vocalPills = mergeConsecutiveNotes(toDetections(pitchHistory))
    drawMergedNotes(
      vocalPills,
      PITCH_VISUAL_COLORS.referenceFill,
      PITCH_VISUAL_COLORS.referenceBright,
    )

    if (deps.micActive() && micHistory.length > 0) {
      const micPills = mergeConsecutiveNotes(toDetections(micHistory))
      drawMergedNotes(
        micPills,
        PITCH_VISUAL_COLORS.singerFill,
        PITCH_VISUAL_COLORS.singerBright,
        true,
      )
    }

    // The singer owns one visual language: violet notes plus a continuous
    // violet trace. Silence and implausible jumps break the trace cleanly.
    if (deps.showMicLine() && deps.micActive() && micHistory.length > 1) {
      ctx.save()
      ctx.strokeStyle = PITCH_VISUAL_COLORS.singer
      ctx.shadowColor = PITCH_VISUAL_COLORS.singer
      ctx.shadowBlur = 5
      ctx.lineWidth = editor ? 2.2 : 1.8
      ctx.lineJoin = 'round'
      ctx.lineCap = 'round'
      ctx.beginPath()
      let drawing = false
      let prevTime = 0
      let prevY = 0
      for (const pitch of micHistory) {
        if (
          pitch.frequency <= 0 ||
          pitch.time < winStart ||
          pitch.time > winEnd
        ) {
          drawing = false
          continue
        }
        const x = ((pitch.time - winStart) / winDur) * w
        const y = midiToY(freqToMidi(pitch.frequency))
        const gap = pitch.time - prevTime > 0.18
        const jump = Math.abs(y - prevY) > rowH * 8
        if (!drawing || gap || jump) {
          ctx.moveTo(x, y)
          drawing = true
        } else {
          ctx.lineTo(x, y)
        }
        prevTime = pitch.time
        prevY = y
      }
      ctx.stroke()
      ctx.restore()
    }

    // Optional accuracy connectors retain their score colors; their vertical
    // endpoints now follow the same octave-aware geometry as the notes.
    const TOLERANCE_CENTS = 50
    if (
      deps.showScoreDiffBars() &&
      deps.micActive() &&
      pitchHistory.length > 0 &&
      micHistory.length > 0
    ) {
      let vocalIndex = 0
      let micIndex = 0
      let lastDiffX = -999
      while (vocalIndex < pitchHistory.length && micIndex < micHistory.length) {
        const vocal = pitchHistory[vocalIndex]
        const singer = micHistory[micIndex]
        if (Math.abs(vocal.time - singer.time) < 0.06) {
          if (
            vocal.time >= winStart &&
            vocal.time <= winEnd &&
            vocal.frequency > 0 &&
            singer.frequency > 0
          ) {
            const x = ((vocal.time - winStart) / winDur) * w
            if (x - lastDiffX > 3) {
              lastDiffX = x
              const vocalY = midiToY(freqToMidi(vocal.frequency))
              const micY = midiToY(freqToMidi(singer.frequency))
              const centsOff = foldCentsToOctave(
                1200 * Math.log2(singer.frequency / vocal.frequency),
              )
              const absOff = Math.abs(centsOff)
              ctx.strokeStyle =
                absOff <= TOLERANCE_CENTS
                  ? 'rgba(96, 208, 128, 0.55)'
                  : absOff <= TOLERANCE_CENTS * 2
                    ? 'rgba(224, 192, 80, 0.5)'
                    : 'rgba(248, 81, 73, 0.45)'
              ctx.lineWidth = 1.2
              ctx.beginPath()
              ctx.moveTo(x, Math.min(vocalY, micY))
              ctx.lineTo(x, Math.max(vocalY, micY))
              ctx.stroke()
            }
          }
          vocalIndex++
          micIndex++
        } else if (vocal.time < singer.time) {
          vocalIndex++
        } else {
          micIndex++
        }
      }
    }

    const current = deps.currentPitch()
    const elapsedTime = deps.elapsed()
    if (
      current &&
      current.frequency > 0 &&
      elapsedTime >= winStart &&
      elapsedTime <= winEnd
    ) {
      const x = ((elapsedTime - winStart) / winDur) * w
      const y = midiToY(freqToMidi(current.frequency))
      ctx.shadowColor = PITCH_VISUAL_COLORS.reference
      ctx.shadowBlur = 14
      ctx.fillStyle = PITCH_VISUAL_COLORS.reference
      ctx.beginPath()
      ctx.arc(x, y, editor ? 6.5 : 5.5, 0, Math.PI * 2)
      ctx.fill()
      ctx.shadowBlur = 0
      ctx.fillStyle = '#fff8eb'
      ctx.font = '700 11px ui-monospace, monospace'
      ctx.fillText(
        `${current.noteName}${current.octave}`,
        Math.min(x + 10, w - 42),
        y + 4,
      )
    }

    if (deps.pitchView?.() === 'both') {
      ctx.save()
      ctx.strokeStyle = 'rgba(178, 190, 208, 0.58)'
      ctx.lineWidth = 1
      ctx.setLineDash([3, 3])
      for (const note of deps.baseNotes?.() ?? []) {
        if (note.endBeat < winStart || note.startBeat > winEnd) continue
        const x1 = Math.max(0, ((note.startBeat - winStart) / winDur) * w)
        const x2 = Math.min(w, ((note.endBeat - winStart) / winDur) * w)
        const yTop = midiToY(note.midi) - rowH * 0.34
        ctx.strokeRect(x1, yTop, Math.max(2, x2 - x1), rowH * 0.68)
      }
      ctx.restore()
    }

    if (editor) {
      const selectedId = deps.selectedNoteId?.() ?? null
      for (const note of editable) {
        if (note.endBeat < winStart || note.startBeat > winEnd) continue
        const x1 = Math.max(0, ((note.startBeat - winStart) / winDur) * w)
        const x2 = Math.min(w, ((note.endBeat - winStart) / winDur) * w)
        const yTop = midiToY(note.midi) - rowH * 0.39
        const selected = note.id === selectedId
        ctx.strokeStyle = selected
          ? PITCH_VISUAL_COLORS.selection
          : 'rgba(255, 193, 90, 0.58)'
        ctx.lineWidth = selected ? 2 : 1
        ctx.setLineDash(selected ? [] : [4, 3])
        ctx.strokeRect(x1, yTop, Math.max(2, x2 - x1), rowH * 0.78)
        ctx.setLineDash([])
        if (selected) {
          ctx.fillStyle = PITCH_VISUAL_COLORS.selection
          ctx.fillRect(x1 - 2, yTop + rowH * 0.19, 4, rowH * 0.4)
          ctx.fillRect(x2 - 2, yTop + rowH * 0.19, 4, rowH * 0.4)
        }
      }
    }

    if (elapsedTime >= winStart && elapsedTime <= winEnd) {
      const x = ((elapsedTime - winStart) / winDur) * w
      ctx.save()
      ctx.strokeStyle = PITCH_VISUAL_COLORS.playhead
      ctx.shadowColor = PITCH_VISUAL_COLORS.playhead
      ctx.shadowBlur = editor ? 8 : 4
      ctx.lineWidth = editor ? 1.5 : 1
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, h)
      ctx.stroke()
      ctx.fillStyle = PITCH_VISUAL_COLORS.playhead
      ctx.beginPath()
      ctx.moveTo(x - 5, 0)
      ctx.lineTo(x + 5, 0)
      ctx.lineTo(x, 7)
      ctx.closePath()
      ctx.fill()
      ctx.restore()
    }
  }

  const drawMidiCanvas = () => {
    const canvas = canvasRefs.midi
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    const w = canvas.width / dpr
    const h = canvas.height / dpr
    if (h <= 0) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    // Background comes from .sm-canvas CSS (var(--bg-primary)) so the
    // karaoke page's stage-glass translucency applies to these panels too.
    ctx.clearRect(0, 0, w, h)

    const notes = deps.midiNotes()
    if (notes.length === 0) {
      ctx.fillStyle = '#484f58'
      ctx.font = '12px monospace'
      ctx.textAlign = 'center'
      ctx.fillText('MIDI notes will appear here', w / 2, h / 2)
      ctx.textAlign = 'start'
      return
    }

    const noteNames = [
      'C',
      'C#',
      'D',
      'D#',
      'E',
      'F',
      'F#',
      'G',
      'G#',
      'A',
      'A#',
      'B',
    ]
    const rowH = h / 13
    ctx.strokeStyle = '#21262d'
    ctx.lineWidth = 0.5
    for (let i = 0; i <= 13; i++) {
      const y = i * rowH
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(w, y)
      ctx.stroke()
    }

    ctx.fillStyle = '#484f58'
    ctx.font = '9px monospace'
    for (let i = 0; i < 12; i++) {
      const note = noteNames[11 - i]
      ctx.fillText(note, 3, i * rowH + rowH * 0.65 + rowH)
    }

    const midiMin = 38
    const midiMax = 96
    const midiRange = midiMax - midiMin

    const midiToY = (midi: number): number => {
      const t = (midi - midiMin) / midiRange
      return (1 - t) * (h - rowH) + rowH * 0.5
    }

    const dur = deps.duration()
    if (dur <= 0) return

    const winStart = deps.windowStart()
    const winEnd = winStart + deps.windowDuration()
    const winDur = deps.windowDuration()

    type Pill = { midi: number; startSec: number; endSec: number }
    const pills: Pill[] = []
    if (notes.length > 0) {
      const ticksPerSec = TICKS_PER_BEAT * (DEFAULT_BPM / 60)
      let cur: Pill = {
        midi: notes[0].midi,
        startSec: notes[0].tickOn / ticksPerSec,
        endSec: notes[0].tickOff / ticksPerSec,
      }
      for (let i = 1; i < notes.length; i++) {
        const s = notes[i].tickOn / ticksPerSec
        const e = notes[i].tickOff / ticksPerSec
        if (notes[i].midi === cur.midi && s - cur.endSec < 0.02) {
          cur.endSec = e
        } else {
          pills.push({ ...cur })
          cur = { midi: notes[i].midi, startSec: s, endSec: e }
        }
      }
      pills.push({ ...cur })
    }

    for (const p of pills) {
      if (p.endSec < winStart || p.startSec > winEnd) continue
      const x1 = Math.max(0, ((p.startSec - winStart) / winDur) * w)
      const x2 = Math.min(w, ((p.endSec - winStart) / winDur) * w)
      const pillW = Math.max(x2 - x1, 3)
      const y = midiToY(p.midi) - rowH * 0.34
      const pillH = rowH * 0.68
      const r = Math.min(pillH / 2, 3)

      ctx.beginPath()
      ctx.moveTo(x1 + r, y)
      ctx.lineTo(x1 + pillW - r, y)
      ctx.arcTo(x1 + pillW, y, x1 + pillW, y + r, r)
      ctx.lineTo(x1 + pillW, y + pillH - r)
      ctx.arcTo(x1 + pillW, y + pillH, x1 + pillW - r, y + pillH, r)
      ctx.lineTo(x1 + r, y + pillH)
      ctx.arcTo(x1, y + pillH, x1, y + pillH - r, r)
      ctx.lineTo(x1, y + r)
      ctx.arcTo(x1, y, x1 + r, y, r)
      ctx.closePath()
      ctx.fillStyle = 'rgba(139, 92, 246, 0.55)'
      ctx.fill()

      if (pillW > 24) {
        const noteInfo = midiToNote(p.midi)
        ctx.fillStyle = '#fff'
        ctx.font = 'bold 9px monospace'
        ctx.textAlign = 'center'
        const label = `${noteInfo.name}${noteInfo.octave}`
        ctx.fillText(label, x1 + pillW / 2, y + pillH / 2 + 3)
        ctx.textAlign = 'start'
      }
    }

    // Playhead
    const elapsedTime = deps.elapsed()
    if (elapsedTime >= winStart && elapsedTime <= winEnd) {
      const px = ((elapsedTime - winStart) / winDur) * w
      ctx.strokeStyle = 'rgba(255,255,255,0.6)'
      ctx.lineWidth = 1
      ctx.setLineDash([4, 4])
      ctx.beginPath()
      ctx.moveTo(px, 0)
      ctx.lineTo(px, h)
      ctx.stroke()
      ctx.setLineDash([])
    }
  }

  // ── Public draw orchestration ─────────────────────────────────

  const redrawAll = () => {
    syncCanvasSizes()
    drawWaveformOverview()
    drawLiveWaveform()
    drawPitchCanvas()
    drawMidiCanvas()
  }

  // Coalesced: resize storms (window drags, panel resizes, observer bursts)
  // collapse to one full redraw per animation frame.
  const redrawScheduler = createRedrawScheduler(redrawAll)
  const queueCanvasRedraw = () => {
    redrawScheduler.queue()
  }

  // ── Loop marker drag state (mutable refs — no rendering) ─────

  const LOOP_HIT_PX = 8 // pixel tolerance for hit-testing markers
  const LOOP_MIN_GAP = 0.1 // minimum seconds between A and B
  let loopDragTarget: 'A' | 'B' | null = null

  let mousePanActive = false
  let mouseDidPan = false
  let mousePanStartX = 0
  let mousePanStartWin = 0
  let activePanCanvas: HTMLCanvasElement | null = null

  // Pitch edit drag (move / resize / retune). `startTime` is the time under the
  // pointer at drag start, used to compute the time delta for body moves.
  const EDIT_EDGE_PX = 6
  const EDIT_MIN_DUR = 0.05
  let editDrag: {
    note: EditableNote
    zone: 'body' | 'start' | 'end'
    startTime: number
    startRow: number
    scale: PitchCanvasScale
  } | null = null

  /** Convert clientX on the overview canvas to a time value. */
  const clientXToTime = (
    clientX: number,
    canvas: HTMLCanvasElement,
  ): number => {
    const rect = canvas.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    return deps.windowStart() + ratio * deps.windowDuration()
  }

  /** Hit-test: is clientX within LOOP_HIT_PX of the A or B marker? */
  const getLoopMarkerAtX = (
    clientX: number,
    canvas: HTMLCanvasElement,
  ): 'A' | 'B' | null => {
    if (deps.loopEnd() <= 0) return null
    const rect = canvas.getBoundingClientRect()
    const winStart = deps.windowStart()
    const winDur = deps.windowDuration()
    const w = rect.width

    const axPx = ((deps.loopStart() - winStart) / winDur) * w + rect.left
    const bxPx = ((deps.loopEnd() - winStart) / winDur) * w + rect.left

    // Prefer whichever is closer if both are within tolerance
    const distA = Math.abs(clientX - axPx)
    const distB = Math.abs(clientX - bxPx)

    if (distA <= LOOP_HIT_PX && distA <= distB) return 'A'
    if (distB <= LOOP_HIT_PX) return 'B'
    return null
  }

  /** Edit mode: the editable note under the pointer on the pitch lane, if any.
   *  Pitch Studio uses octave-aware rows, matching the rendered piano roll. */
  const getEditableNoteAtPoint = (
    clientX: number,
    clientY: number,
    canvas: HTMLCanvasElement,
  ): EditableNote | null => {
    const editable = deps.editableNotes?.()
    if (editable === undefined || editable.length === 0) return null
    const rect = canvas.getBoundingClientRect()
    const time = clientXToTime(clientX, canvas)
    const scale = createPitchCanvasScale(
      true,
      editable.map((note) => note.midi),
    )
    const rowH = rect.height / scale.rowCount
    const row = Math.floor((clientY - rect.top) / rowH)
    for (const note of editable) {
      if (time < note.startBeat || time > note.endBeat) continue
      if (midiToPitchCanvasRow(note.midi, scale) === row) return note
    }
    return null
  }

  const handleCanvasPointerDown = (e: PointerEvent) => {
    const canvas = e.currentTarget as HTMLCanvasElement
    if (!deps.duration()) return

    // Pitch edit mode: grab a note to select + drag it (move / resize /
    // retune); empty click deselects (then falls through to pan).
    if (canvas === canvasRefs.pitch && deps.editMode?.() === true) {
      const note = getEditableNoteAtPoint(e.clientX, e.clientY, canvas)
      if (note !== null) {
        const rect = canvas.getBoundingClientRect()
        const winStart = deps.windowStart()
        const winDur = deps.windowDuration()
        const x1 =
          rect.left + ((note.startBeat - winStart) / winDur) * rect.width
        const x2 = rect.left + ((note.endBeat - winStart) / winDur) * rect.width
        const zone: 'body' | 'start' | 'end' =
          Math.abs(e.clientX - x1) <= EDIT_EDGE_PX
            ? 'start'
            : Math.abs(e.clientX - x2) <= EDIT_EDGE_PX
              ? 'end'
              : 'body'
        const editable = deps.editableNotes?.() ?? []
        const scale = createPitchCanvasScale(
          true,
          editable.map((editableNote) => editableNote.midi),
        )
        const startRow = Math.floor(
          (e.clientY - rect.top) / (rect.height / scale.rowCount),
        )
        editDrag = {
          note,
          zone,
          startTime: clientXToTime(e.clientX, canvas),
          startRow,
          scale,
        }
        deps.onSelectNote?.(note.id)
        deps.onBeginEdit?.()
        canvas.setPointerCapture(e.pointerId)
        queueCanvasRedraw()
        e.preventDefault()
        e.stopPropagation()
        return
      }
      deps.onSelectNote?.(null)
      queueCanvasRedraw()
    }

    const isOverview = canvas === canvasRefs.overview
    const hit = isOverview ? getLoopMarkerAtX(e.clientX, canvas) : null

    if (hit && deps.loopEnabled()) {
      e.preventDefault()
      e.stopPropagation()
      loopDragTarget = hit
      canvas.setPointerCapture(e.pointerId)
      return
    }

    // Initiate mouse pan
    mousePanActive = true
    mouseDidPan = false
    mousePanStartX = e.clientX
    mousePanStartWin = deps.windowStart()
    userPanning = true
    activePanCanvas = canvas
    canvas.setPointerCapture(e.pointerId)
  }

  const handleCanvasPointerMove = (e: PointerEvent) => {
    const canvas = e.currentTarget as HTMLCanvasElement

    // Pitch edit drag in progress: live-preview move / resize / retune.
    if (editDrag !== null) {
      e.preventDefault()
      const { note, zone, startTime, startRow, scale } = editDrag
      const time = clientXToTime(e.clientX, canvas)
      if (zone === 'start') {
        deps.onPreviewEdit?.(note, {
          startBeat: Math.min(time, note.endBeat - EDIT_MIN_DUR),
        })
      } else if (zone === 'end') {
        deps.onPreviewEdit?.(note, {
          endBeat: Math.max(time, note.startBeat + EDIT_MIN_DUR),
        })
      } else {
        // Body: move in time and retune by the number of lanes the pointer has
        // moved. Pitch Studio rows are octave-aware, so the note can cross an
        // octave boundary without being folded back to its pitch class.
        const dt = time - startTime
        const rect = canvas.getBoundingClientRect()
        const row = Math.floor(
          (e.clientY - rect.top) / (rect.height / scale.rowCount),
        )
        const rowDelta = row - startRow
        const startMidi = pitchCanvasRowToMidi(startRow, scale)
        const nextMidi = pitchCanvasRowToMidi(startRow + rowDelta, scale)
        deps.onPreviewEdit?.(note, {
          startBeat: note.startBeat + dt,
          endBeat: note.endBeat + dt,
          midi: note.midi + (nextMidi - startMidi),
        })
      }
      return
    }

    if (loopDragTarget && canvas === canvasRefs.overview) {
      // Active drag — update loop boundary
      e.preventDefault()
      const time = clientXToTime(e.clientX, canvas)
      const clamped = Math.max(0, Math.min(deps.duration(), time))

      if (loopDragTarget === 'A') {
        if (clamped > deps.loopEnd() - LOOP_MIN_GAP) {
          // Cross over: old B becomes A, and we are now dragging B
          deps.setLoopStart(deps.loopEnd() - LOOP_MIN_GAP)
          deps.setLoopEnd(clamped + LOOP_MIN_GAP)
          loopDragTarget = 'B'
        } else {
          deps.setLoopStart(clamped)
        }
      } else {
        if (clamped < deps.loopStart() + LOOP_MIN_GAP) {
          // Cross over: old A becomes B, and we are now dragging A
          deps.setLoopEnd(deps.loopStart() + LOOP_MIN_GAP)
          deps.setLoopStart(Math.max(0, clamped - LOOP_MIN_GAP))
          loopDragTarget = 'A'
        } else {
          deps.setLoopEnd(clamped)
        }
      }
      redrawAll()
    } else if (mousePanActive && activePanCanvas === canvas) {
      e.preventDefault()
      const deltaX = e.clientX - mousePanStartX
      if (Math.abs(deltaX) > 3) {
        mouseDidPan = true
      }
      if (mouseDidPan) {
        const rect = canvas.getBoundingClientRect()
        const pxPerSec = rect.width / deps.windowDuration()
        const deltaTime = deltaX / pxPerSec
        const newStart = Math.max(
          0,
          Math.min(
            deps.duration() - deps.windowDuration(),
            mousePanStartWin - deltaTime,
          ),
        )
        deps.setWindowStart(newStart)
        redrawAll()
      }
    } else {
      // Hover — update cursor
      const isOverview = canvas === canvasRefs.overview
      if (isOverview && deps.loopEnabled() && deps.loopEnd() > 0) {
        const hit = getLoopMarkerAtX(e.clientX, canvas)
        canvas.style.cursor = hit ? 'ew-resize' : 'pointer'
      } else {
        canvas.style.cursor = 'pointer'
      }
    }
  }

  const handleCanvasPointerUp = (e: PointerEvent) => {
    const canvas = e.currentTarget as HTMLCanvasElement

    // Finish a pitch edit drag.
    if (editDrag !== null) {
      editDrag = null
      deps.onEndEdit?.()
      try {
        canvas.releasePointerCapture(e.pointerId)
      } catch {
        // pointer may already be released
      }
      e.preventDefault()
      return
    }

    if (loopDragTarget && canvas === canvasRefs.overview) {
      canvas.releasePointerCapture(e.pointerId)
      loopDragTarget = null
    } else if (mousePanActive && activePanCanvas === canvas) {
      canvas.releasePointerCapture(e.pointerId)
      mousePanActive = false
      userPanning = false
      activePanCanvas = null

      if (!mouseDidPan) {
        // It was a click, not a drag. Seek!
        const rect = canvas.getBoundingClientRect()
        const ratio = Math.max(
          0,
          Math.min(1, (e.clientX - rect.left) / rect.width),
        )
        const newTime = deps.windowStart() + ratio * deps.windowDuration()
        deps.seekTo(newTime)
      }
    }
  }

  // ── Interaction handlers ──────────────────────────────────────

  const handleCanvasWheel = (e: WheelEvent) => {
    e.preventDefault()
    const canvas = e.currentTarget as HTMLCanvasElement
    const rect = canvas.getBoundingClientRect()
    const mouseX = Math.max(
      0,
      Math.min(1, (e.clientX - rect.left) / rect.width),
    )
    const mouseTime = deps.windowStart() + mouseX * deps.windowDuration()
    const delta = e.deltaY > 0 ? 5 : -5
    const newDuration = Math.max(
      10,
      Math.min(150, deps.windowDuration() + delta),
    )
    if (newDuration === deps.windowDuration()) return
    const newStart = Math.max(0, mouseTime - mouseX * newDuration)
    deps.setWindowDuration(newDuration)
    deps.setWindowStart(newStart)
    redrawAll()
  }

  // ── Touch state (not signals — not rendered) ──────────────────

  interface ActiveTouch {
    id: number
    startX: number
    startY: number
    clientX: number
    clientY: number
  }

  let activeTouches: ActiveTouch[] = []
  let pinchStartDistance = 0
  let pinchStartWindowStart = 0
  let pinchStartWindowDuration = 0
  let userPanning = false

  const getTouchDistance = (t1: ActiveTouch, t2: ActiveTouch): number =>
    Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY)

  const handleCanvasTouchStart = (e: TouchEvent) => {
    const touches = Array.from(e.changedTouches)
    for (const t of touches) {
      const existing = activeTouches.find((at) => at.id === t.identifier)
      if (!existing) {
        activeTouches.push({
          id: t.identifier,
          startX: t.clientX,
          startY: t.clientY,
          clientX: t.clientX,
          clientY: t.clientY,
        })
      }
    }
    userPanning = true
    // Capture initial pinch state
    if (activeTouches.length >= 2) {
      pinchStartDistance = getTouchDistance(activeTouches[0], activeTouches[1])
      pinchStartWindowStart = deps.windowStart()
      pinchStartWindowDuration = deps.windowDuration()
    }
  }

  const handleCanvasTouchMove = (e: TouchEvent) => {
    e.preventDefault()

    // Update tracked touch positions
    for (const t of Array.from(e.changedTouches)) {
      const at = activeTouches.find((a) => a.id === t.identifier)
      if (at) {
        at.clientX = t.clientX
        at.clientY = t.clientY
      }
    }

    if (activeTouches.length === 1) {
      // One-finger pan: scroll horizontally without changing playback
      const touch = activeTouches[0]
      const canvas = e.currentTarget as HTMLCanvasElement
      const rect = canvas.getBoundingClientRect()
      const deltaX = touch.startX - touch.clientX
      const pxPerSec = rect.width / deps.windowDuration()
      const deltaTime = (deltaX / pxPerSec) * 0.6
      const newStart = Math.max(
        0,
        Math.min(
          deps.duration() - deps.windowDuration(),
          deps.windowStart() + deltaTime,
        ),
      )
      deps.setWindowStart(newStart)
      // Incremental tracking: re-baseline so sensitivity stays consistent
      touch.startX = touch.clientX
      redrawAll()
    } else if (activeTouches.length >= 2) {
      const curDist = getTouchDistance(activeTouches[0], activeTouches[1])
      const dx =
        activeTouches[0].clientX -
        activeTouches[0].startX +
        (activeTouches[1].clientX - activeTouches[1].startX)
      const dy =
        activeTouches[0].clientY -
        activeTouches[0].startY +
        (activeTouches[1].clientY - activeTouches[1].startY)
      const absDx = Math.abs(dx)
      const absDy = Math.abs(dy)

      if (absDy > absDx * 1.5 && deps.onCanvasVerticalPinch) {
        // Primarily vertical pinch — delegate to layout resize
        deps.onCanvasVerticalPinch(
          (e.currentTarget as HTMLCanvasElement).dataset.canvasId ?? '',
          dy * 0.15,
        )
        // Re-baseline for incremental resize
        for (const at of activeTouches) {
          at.startX = at.clientX
          at.startY = at.clientY
        }
      } else if (pinchStartDistance > 0) {
        // Horizontal pinch — zoom (dampened for smooth scaling)
        const ratio = curDist / pinchStartDistance
        const dampenedRatio = 1 + (ratio - 1) * 0.35
        const newDuration = Math.max(
          10,
          Math.min(150, pinchStartWindowDuration / dampenedRatio),
        )
        if (newDuration !== deps.windowDuration()) {
          // Keep midpoint stable
          const canvas = e.currentTarget as HTMLCanvasElement
          const rect = canvas.getBoundingClientRect()
          const midX =
            (activeTouches[0].clientX + activeTouches[1].clientX) / 2 -
            rect.left
          const midRatio = midX / rect.width
          const midTime =
            pinchStartWindowStart + midRatio * pinchStartWindowDuration
          const newStart = Math.max(
            0,
            Math.min(
              deps.duration() - newDuration,
              midTime - midRatio * newDuration,
            ),
          )
          deps.setWindowDuration(newDuration)
          deps.setWindowStart(newStart)
          redrawAll()
        }
      }
    }
  }

  const handleCanvasTouchEnd = (e: TouchEvent) => {
    const endedIds = new Set(
      Array.from(e.changedTouches).map((t) => t.identifier),
    )
    activeTouches = activeTouches.filter((at) => !endedIds.has(at.id))

    // Re-baseline for remaining touches
    if (activeTouches.length === 1) {
      activeTouches[0].startX = activeTouches[0].clientX
      activeTouches[0].startY = activeTouches[0].clientY
    } else if (activeTouches.length >= 2) {
      for (const at of activeTouches) {
        at.startX = at.clientX
        at.startY = at.clientY
      }
      pinchStartDistance = getTouchDistance(activeTouches[0], activeTouches[1])
      pinchStartWindowStart = deps.windowStart()
      pinchStartWindowDuration = deps.windowDuration()
    } else {
      pinchStartDistance = 0
      userPanning = false
    }
  }

  // ── Formatting ────────────────────────────────────────────────

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60)
    const s = Math.floor(secs % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  // ── ResizeObserver lifecycle ──────────────────────────────────

  const initObserver = (): ResizeObserver => {
    observer = new ResizeObserver(queueCanvasRedraw)
    for (const ref of Object.values(canvasRefs)) {
      if (ref) observer.observe(ref)
    }
    return observer
  }

  const reconnectObserver = () => {
    if (!observer) return
    observer.disconnect()
    // Double-rAF ensures the browser has completed layout and
    // SolidJS ref callbacks have fired before we measure and redraw.
    const obs = observer
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        for (const ref of Object.values(canvasRefs)) {
          if (ref) obs.observe(ref)
        }
        redrawAll()
      })
    })
  }

  const disconnectObserver = () => {
    observer?.disconnect()
    observer = null
  }

  // Browser zoom / moving the window between monitors changes the device
  // pixel ratio without necessarily resizing any element — resync the
  // backing stores or everything renders blurry (or at the wrong scale).
  const dprWatcher = createDprWatcher(queueCanvasRedraw)
  onCleanup(() => {
    dprWatcher.dispose()
    redrawScheduler.cancel()
    disconnectObserver()
  })

  return {
    setCanvasRef,
    formatTime,
    syncCanvasSizes,
    drawWaveformOverview,
    drawLiveWaveform,
    drawPitchCanvas,
    drawMidiCanvas,
    redrawAll,
    queueCanvasRedraw,
    handleCanvasWheel,
    handleCanvasTouchStart,
    handleCanvasTouchMove,
    handleCanvasTouchEnd,
    handleCanvasPointerDown,
    handleCanvasPointerMove,
    handleCanvasPointerUp,
    isUserPanning: () => userPanning,
    initObserver,
    reconnectObserver,
    disconnectObserver,
  }
}
