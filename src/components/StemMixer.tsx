// ============================================================
// StemMixer — Play separated stems with volume control & pitch viz
// ============================================================

import type { Component } from 'solid-js'
import { createEffect, createSignal, For, onCleanup, onMount, Show } from 'solid-js'
import { PitchDetector, type DetectedPitch } from '@/lib/pitch-detector'
import { freqToNote } from '@/lib/scale-data'
import { ChevronLeft, Download, Ear, Midi, Pause, Play, SkipBack, Volume2, VolumeX } from './icons'
import { extractTitle, getCurrentLineIndex, getCurrentLrcIndex, parseLrcFile, parseTextLyrics, searchLyrics, type LrcLine } from '@/lib/lyrics-service'
import { LyricsUploader, type LyricsUploadResult } from './LyricsUploader'

// ── Types ──────────────────────────────────────────────────────

interface StemMixerProps {
  stems: {
    vocal?: string
    instrumental?: string
    vocalMidi?: string
  }
  sessionId: string
  songTitle?: string
  onBack?: () => void
}

interface StemTrack {
  label: string
  url: string
  color: string
  buffer: AudioBuffer | null
  gainNode: GainNode | null
  analyserNode: AnalyserNode | null
  sourceNode: AudioBufferSourceNode | null
  muted: boolean
  soloed: boolean
  volume: number
}

interface PitchNote {
  time: number
  noteName: string
  frequency: number
  octave: number
}

// ── Constants ──────────────────────────────────────────────────

const FFT_SIZE = 256
const PITCH_FFT_SIZE = 2048

// ── Component ──────────────────────────────────────────────────

export const StemMixer: Component<StemMixerProps> = (props) => {
  // ── State ────────────────────────────────────────────────────
  const [loading, setLoading] = createSignal(true)
  const [loadError, setLoadError] = createSignal('')
  const [loadProgress, setLoadProgress] = createSignal(0)
  const [playing, setPlaying] = createSignal(false)
  const [duration, setDuration] = createSignal(0)
  const [elapsed, setElapsed] = createSignal(0)
  const [currentPitch, setCurrentPitch] = createSignal<DetectedPitch | null>(null)
  const [anySoloed, setAnySoloed] = createSignal(false)

  // ── Lyrics state ──────────────────────────────────────────────
  const [lyricsLines, setLyricsLines] = createSignal<string[]>([])
  const [lrcLines, setLrcLines] = createSignal<LrcLine[]>([])
  const [currentLineIdx, setCurrentLineIdx] = createSignal(-1)
  const [lyricsSource, setLyricsSource] = createSignal<'api' | 'upload' | 'none'>('none')
  const [lyricsLoading, setLyricsLoading] = createSignal(false)
  const [windowDuration, setWindowDuration] = createSignal(30) // seconds, range 10-150
  const [windowStart, setWindowStart] = createSignal(0)

  // ── Workspace panel state ─────────────────────────────────────
  interface WorkspacePanel {
    id: 'overview' | 'live' | 'pitch' | 'controls' | 'lyrics'
    label: string
    order: number
    height: number | null  // null = auto (fit-content)
  }

  const [workspaceColumns, setWorkspaceColumns] = createSignal<1 | 2>(2)

  const [panels, setPanels] = createSignal<WorkspacePanel[]>([
    { id: 'overview', label: 'Waveform Overview', order: 0, height: 180 },
    { id: 'live', label: 'Live Waveform', order: 1, height: 180 },
    { id: 'pitch', label: 'Vocal Pitch', order: 2, height: 200 },
    { id: 'controls', label: 'Stem Controls', order: 3, height: null },
    { id: 'lyrics', label: 'Lyrics', order: 4, height: 160 },
  ])

  const reorderPanels = (fromId: string, toOrder: number) => {
    setPanels(prev => {
      const next = prev.map(p => ({ ...p }))
      const fromIdx = next.findIndex(p => p.id === fromId)
      if (fromIdx === -1) return prev
      const [moved] = next.splice(fromIdx, 1)
      next.splice(toOrder, 0, moved)
      return next.map((p, i) => ({ ...p, order: i }))
    })
  }

  // ── Drag state (module-level lets — no signals to avoid re-renders) ──
  let dragPanelId: string | null = null
  let dragStartOrder = -1
  let dragTargetOrder = -1
  let dragOffsetX = 0
  let dragOffsetY = 0

  // ── Resize drag state ──────────────────────────────────────────
  let resizePanelId: string | null = null
  let resizeStartY = 0
  let resizeStartHeight = 0

  // ── Refs ─────────────────────────────────────────────────────
  let audioCtx: AudioContext | null = null
  let mainGain: GainNode | null = null
  let vocalAnalyser: AnalyserNode | null = null
  let pitchDetector: PitchDetector | null = null
  let rafId = 0
  let startTime = 0
  let pauseOffset = 0
  let pitchHistory: PitchNote[] = []
  let waveformCanvasRef: HTMLCanvasElement | undefined
  let pitchCanvasRef: HTMLCanvasElement | undefined
  let liveWaveCanvasRef: HTMLCanvasElement | undefined
  let progressBarRef: HTMLDivElement | undefined
  let workspaceRef: HTMLDivElement | undefined

  // Cached canvas dimensions — updated only on resize, not every frame
  let overviewRect = { w: 0, h: 0 }
  let liveRect = { w: 0, h: 0 }
  let pitchRect = { w: 0, h: 0 }

  const vocalTrack = (): StemTrack => ({
    label: 'Vocal',
    url: props.stems.vocal || '',
    color: '#f59e0b',
    buffer: null,
    gainNode: null,
    analyserNode: null,
    sourceNode: null,
    muted: false,
    soloed: false,
    volume: 0.8,
  })

  const instTrack = (): StemTrack => ({
    label: 'Instrumental',
    url: props.stems.instrumental || '',
    color: '#3b82f6',
    buffer: null,
    gainNode: null,
    analyserNode: null,
    sourceNode: null,
    muted: false,
    soloed: false,
    volume: 0.8,
  })

  const [vocal, setVocal] = createSignal<StemTrack>(vocalTrack())
  const [instrumental, setInstrumental] = createSignal<StemTrack>(instTrack())

  const tracks = () => [vocal(), instrumental()].filter(t => t.url)

  // ── Audio Context ────────────────────────────────────────────
  const ensureAudioCtx = () => {
    if (!audioCtx) {
      audioCtx = new AudioContext()
      mainGain = audioCtx.createGain()
      mainGain.gain.value = 0.7
      mainGain.connect(audioCtx.destination)
      vocalAnalyser = audioCtx.createAnalyser()
      vocalAnalyser.fftSize = PITCH_FFT_SIZE
      vocalAnalyser.smoothingTimeConstant = 0.3
      pitchDetector = new PitchDetector({
        sampleRate: audioCtx.sampleRate,
        bufferSize: PITCH_FFT_SIZE,
        minConfidence: 0.4,
        minAmplitude: 0.02,
      })
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume()
    }
    return audioCtx
  }

  // ── Load Stems ───────────────────────────────────────────────
  const loadStems = async () => {
    setLoading(true)
    setLoadError('')
    setLoadProgress(0)

    const ctx = ensureAudioCtx()
    const urls = [props.stems.vocal, props.stems.instrumental].filter(Boolean) as string[]
    const total = urls.length
    let loaded = 0

    const loadOne = async (url: string): Promise<AudioBuffer> => {
      const resp = await fetch(url)
      if (!resp.ok) throw new Error(`HTTP ${resp.status} for ${url}`)
      const arrayBuf = await resp.arrayBuffer()
      const buf = await ctx.decodeAudioData(arrayBuf)
      loaded++
      setLoadProgress(Math.round((loaded / total) * 100))
      return buf
    }

    try {
      const results = await Promise.allSettled([
        props.stems.vocal ? loadOne(props.stems.vocal) : Promise.reject('no vocal'),
        props.stems.instrumental ? loadOne(props.stems.instrumental) : Promise.reject('no inst'),
      ])

      const [vocalResult, instResult] = results

      if (vocalResult.status === 'fulfilled') {
        setVocal(prev => ({ ...prev, buffer: vocalResult.value }))
        const d = vocalResult.value.duration
        if (d > duration()) setDuration(d)
      } else if (props.stems.vocal) {
        console.warn('Failed to load vocal stem:', vocalResult.reason)
      }

      if (instResult.status === 'fulfilled') {
        setInstrumental(prev => ({ ...prev, buffer: instResult.value }))
        const d = instResult.value.duration
        if (d > duration()) setDuration(d)
      } else if (props.stems.instrumental) {
        console.warn('Failed to load instrumental stem:', instResult.reason)
      }

      if (total > 0 && loaded === 0) {
        setLoadError('Failed to load any stems')
      }
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Failed to load stems')
    } finally {
      setLoading(false)
    }
  }

  // ── Lyrics Loading ────────────────────────────────────────────
  const loadLyrics = async () => {
    const rawInput = props.songTitle || props.sessionId || ''
    const title = extractTitle(rawInput)
    if (!title || title === 'Unknown') {
      setLyricsSource('none')
      return
    }

    setLyricsLoading(true)
    try {
      const text = await searchLyrics(title)
      if (text) {
        setLyricsLines(parseTextLyrics(text))
        setLyricsSource('api')
      } else {
        setLyricsSource('none')
      }
    } catch {
      setLyricsSource('none')
    } finally {
      setLyricsLoading(false)
    }
  }

  const handleLyricsUpload = (result: LyricsUploadResult) => {
    if (result.format === 'lrc') {
      setLrcLines(parseLrcFile(result.text))
      setLyricsLines([])
    } else {
      setLyricsLines(parseTextLyrics(result.text))
      setLrcLines([])
    }
    setLyricsSource('upload')
  }

  const updateCurrentLine = () => {
    if (lrcLines().length > 0) {
      setCurrentLineIdx(getCurrentLrcIndex(lrcLines(), elapsed()))
    } else if (lyricsLines().length > 0 && duration() > 0) {
      setCurrentLineIdx(getCurrentLineIndex(lyricsLines().length, elapsed(), duration()))
    }
  }

  const handleLyricLineClick = (idx: number) => {
    if (lrcLines().length > 0 && idx < lrcLines().length) {
      const time = lrcLines()[idx].time
      pauseOffset = Math.min(time, duration())
    } else if (lyricsLines().length > 0 && duration() > 0) {
      pauseOffset = (idx / lyricsLines().length) * duration()
    }
    setElapsed(pauseOffset)
    if (playing()) {
      disconnectSources()
      createSources(pauseOffset)
      startTime = audioCtx!.currentTime - pauseOffset
      pitchHistory = []
      pitchDetector?.resetHistory()
    }
  }

  // ── Create Source Nodes ──────────────────────────────────────
  const createSources = (offset: number) => {
    const ctx = audioCtx!
    const now = ctx.currentTime

    for (const track of tracks()) {
      if (!track.buffer) continue

      const isAudible = track.soloed || (!track.muted && !anySoloed())
      if (!isAudible) continue

      const src = ctx.createBufferSource()
      src.buffer = track.buffer

      const gain = ctx.createGain()
      gain.gain.value = track.volume

      const analyser = ctx.createAnalyser()
      analyser.fftSize = FFT_SIZE
      analyser.smoothingTimeConstant = 0.8

      src.connect(gain)
      gain.connect(analyser)
      analyser.connect(mainGain!)

      // Connect vocal to pitch analyser too
      if (track.label === 'Vocal' && vocalAnalyser) {
        gain.connect(vocalAnalyser)
      }

      src.start(now, offset)
      src.onended = () => {
        try { src.disconnect(); gain.disconnect(); analyser.disconnect() } catch (_) { /* already disconnected */ }
      }

      if (track.label === 'Vocal') {
        setVocal(prev => ({ ...prev, sourceNode: src, gainNode: gain, analyserNode: analyser }))
      } else {
        setInstrumental(prev => ({ ...prev, sourceNode: src, gainNode: gain, analyserNode: analyser }))
      }
    }
  }

  const disconnectSources = () => {
    for (const track of tracks()) {
      try { track.sourceNode?.stop() } catch (_) { /* already stopped */ }
      try { track.sourceNode?.disconnect() } catch (_) { /* */ }
      try { track.gainNode?.disconnect() } catch (_) { /* */ }
      try { track.analyserNode?.disconnect() } catch (_) { /* */ }
    }
    setVocal(prev => ({ ...prev, sourceNode: null, gainNode: null, analyserNode: null }))
    setInstrumental(prev => ({ ...prev, sourceNode: null, gainNode: null, analyserNode: null }))
  }

  // ── Transport ────────────────────────────────────────────────
  const handlePlay = () => {
    ensureAudioCtx()
    disconnectSources()
    createSources(pauseOffset)
    startTime = audioCtx!.currentTime - pauseOffset
    setPlaying(true)
    pitchHistory = []
    pitchDetector?.resetHistory()
    startRafLoop()
  }

  const handlePause = () => {
    pauseOffset = audioCtx!.currentTime - startTime
    disconnectSources()
    setPlaying(false)
    cancelAnimationFrame(rafId)
    syncCanvasSizes()
    drawWaveformOverview()
    drawPitchCanvas()
    drawLiveWaveform()
  }

  const handleStop = () => {
    pauseOffset = 0
    disconnectSources()
    setPlaying(false)
    setElapsed(0)
    setCurrentPitch(null)
    pitchHistory = []
    setWindowStart(0)
    cancelAnimationFrame(rafId)
    drawWaveformOverview()
    drawPitchCanvas()
    drawLiveWaveform()
  }

  const handleRestart = () => {
    pauseOffset = 0
    disconnectSources()
    setPlaying(false)
    setElapsed(0)
    setCurrentPitch(null)
    pitchHistory = []
    pitchDetector?.resetHistory()
    setWindowStart(0)
    cancelAnimationFrame(rafId)
    drawWaveformOverview()
    drawPitchCanvas()
    drawLiveWaveform()
    // Start playing from beginning
    handlePlay()
  }

  const handleSeek = (e: MouseEvent) => {
    if (!progressBarRef || !duration()) return
    const rect = progressBarRef.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    seekTo(ratio * duration())
  }

  const seekTo = (time: number) => {
    pauseOffset = Math.min(time, duration())
    setElapsed(pauseOffset)
    if (playing()) {
      disconnectSources()
      createSources(pauseOffset)
      startTime = audioCtx!.currentTime - pauseOffset
      pitchHistory = []
      pitchDetector?.resetHistory()
    }
  }

  const handleWaveformClick = (e: MouseEvent) => {
    const canvas = waveformCanvasRef
    if (!canvas || !duration()) return
    const rect = canvas.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    const winStart = windowStart()
    seekTo(winStart + ratio * windowDuration())
  }

  // ── Volume / Mute / Solo ─────────────────────────────────────
  const setTrackVolume = (label: string, volume: number) => {
    if (label === 'Vocal') {
      setVocal(prev => {
        if (prev.gainNode) prev.gainNode.gain.value = volume
        return { ...prev, volume }
      })
    } else {
      setInstrumental(prev => {
        if (prev.gainNode) prev.gainNode.gain.value = volume
        return { ...prev, volume }
      })
    }
  }

  const toggleMute = (label: string) => {
    if (label === 'Vocal') {
      setVocal(prev => {
        const muted = !prev.muted
        const isAudible = prev.soloed || (!muted && !anySoloed())
        if (prev.gainNode) prev.gainNode.gain.value = isAudible ? prev.volume : 0
        return { ...prev, muted }
      })
    } else {
      setInstrumental(prev => {
        const muted = !prev.muted
        const isAudible = prev.soloed || (!muted && !anySoloed())
        if (prev.gainNode) prev.gainNode.gain.value = isAudible ? prev.volume : 0
        return { ...prev, muted }
      })
    }
  }

  const toggleSolo = (label: string) => {
    if (label === 'Vocal') {
      setVocal(prev => {
        const soloed = !prev.soloed
        const newAnySoloed = soloed || instrumental().soloed
        setAnySoloed(newAnySoloed)

        if (prev.gainNode) prev.gainNode.gain.value = soloed ? prev.volume : (prev.muted || newAnySoloed ? 0 : prev.volume)
        const inst = instrumental()
        if (inst.gainNode) inst.gainNode.gain.value = (inst.soloed || (!inst.muted && !soloed)) ? inst.volume : 0
        return { ...prev, soloed }
      })
    } else {
      setInstrumental(prev => {
        const soloed = !prev.soloed
        const newAnySoloed = soloed || vocal().soloed
        setAnySoloed(newAnySoloed)

        if (prev.gainNode) prev.gainNode.gain.value = soloed ? prev.volume : (prev.muted || newAnySoloed ? 0 : prev.volume)
        const voc = vocal()
        if (voc.gainNode) voc.gainNode.gain.value = (voc.soloed || (!voc.muted && !soloed)) ? voc.volume : 0
        return { ...prev, soloed }
      })
    }
  }

  const handleDownload = async (track: StemTrack) => {
    if (!track.url) return
    try {
      const resp = await fetch(track.url)
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      const blob = await resp.blob()
      const blobUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = blobUrl
      a.download = `${track.label.toLowerCase()}_stem.wav`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000)
    } catch (err) {
      console.error('Download failed:', err)
    }
  }

  // ── RAF Loop ─────────────────────────────────────────────────
  const startRafLoop = () => {
    const tick = () => {
      if (!audioCtx || !playing()) return

      const now = audioCtx.currentTime
      const elapsedTime = now - startTime
      setElapsed(Math.min(elapsedTime, duration()))

      // Pitch detection from vocal analyser
      if (vocalAnalyser && vocal().buffer) {
        const timeData = new Float32Array(PITCH_FFT_SIZE)
        vocalAnalyser.getFloatTimeDomainData(timeData)
        const pitch = pitchDetector!.detect(timeData)
        setCurrentPitch(pitch.frequency > 0 ? pitch : null)

        if (pitch.frequency > 0) {
          pitchHistory.push({
            time: elapsedTime,
            noteName: pitch.noteName,
            frequency: pitch.frequency,
            octave: pitch.octave,
          })
        }
      }

      // Continuous-scroll time window: keep playhead at 30% from left
      const newStart = elapsedTime - windowDuration() * 0.3
      setWindowStart(Math.max(0, newStart))

      syncCanvasSizes()
      drawWaveformOverview()
      drawPitchCanvas()
      drawLiveWaveform()
      updateCurrentLine()

      if (elapsedTime >= duration()) {
        handleStop()
        return
      }

      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
  }

  // ── Canvas Sizing ───────────────────────────────────────────
  // Only set canvas dimensions when they actually change — avoids per-frame
  // reflow that caused vertical squishing in the flex layout during playback.
  const syncCanvasSizes = () => {
    const dpr = window.devicePixelRatio || 1
    for (const ref of [waveformCanvasRef, pitchCanvasRef, liveWaveCanvasRef]) {
      if (!ref) continue
      const rect = ref.getBoundingClientRect()
      const w = Math.round(rect.width * dpr)
      const h = Math.round(rect.height * dpr)
      if (ref.width !== w || ref.height !== h) {
        ref.width = w
        ref.height = h
        // Lock CSS size to match internal buffer so DPR-scaled draws
        // fill every physical pixel — prevents stripe artifacts.
        ref.style.width = `${Math.round(rect.width)}px`
        ref.style.height = `${Math.round(rect.height)}px`
      }
    }
  }

  // ── Canvas Drawing ───────────────────────────────────────────
  const drawWaveformOverview = () => {
    const canvas = waveformCanvasRef
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    const w = Math.round(rect.width)
    const h = Math.round(rect.height)
    if (h <= 0) { overviewRect = { w, h }; return }
    overviewRect = { w, h }
    const ctx = canvas.getContext('2d')!
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    ctx.clearRect(0, 0, w, h)

    const activeTracks = tracks().filter(t => t.buffer)
    if (activeTracks.length === 0) return

    const trackHeight = h / activeTracks.length
    const totalDur = duration() || 1
    const winStart = windowStart()
    const winEnd = winStart + windowDuration()

    for (let ti = 0; ti < activeTracks.length; ti++) {
      const track = activeTracks[ti]
      const buffer = track.buffer!
      const data = buffer.getChannelData(0)
      const totalSamples = data.length

      // Only iterate samples within the visible window
      const visibleStart = Math.floor((winStart / totalDur) * totalSamples)
      const visibleEnd = Math.min(totalSamples, Math.floor((winEnd / totalDur) * totalSamples))
      const visibleSamples = visibleEnd - visibleStart
      const step = Math.max(1, Math.floor(visibleSamples / w))
      const yOff = ti * trackHeight

      // Center line
      const midY = yOff + trackHeight / 2
      ctx.strokeStyle = track.color + '40'
      ctx.lineWidth = 0.5
      ctx.beginPath()
      ctx.moveTo(0, midY)
      ctx.lineTo(w, midY)
      ctx.stroke()

      // Waveform
      ctx.strokeStyle = track.color
      ctx.lineWidth = 1
      ctx.beginPath()
      for (let x = 0; x < w; x++) {
        const start = visibleStart + Math.floor(x * step)
        let min = 1, max = -1
        const end = Math.min(Math.floor(start + step), visibleEnd)
        for (let s = start; s < end; s++) {
          const v = data[s]
          if (v < min) min = v
          if (v > max) max = v
        }
        const amp = trackHeight * 0.35
        ctx.moveTo(x, midY + min * amp)
        ctx.lineTo(x, midY + max * amp)
      }
      ctx.stroke()

      // Playhead
      if (elapsed() >= winStart && elapsed() <= winEnd) {
        const px = ((elapsed() - winStart) / windowDuration()) * w
        ctx.strokeStyle = 'rgba(255,255,255,0.5)'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(px, yOff)
        ctx.lineTo(px, yOff + trackHeight)
        ctx.stroke()
      }

      // Label
      ctx.fillStyle = track.color
      ctx.font = '10px monospace'
      ctx.fillText(track.label, 6, yOff + 14)
    }
  }

  const drawLiveWaveform = () => {
    const canvas = liveWaveCanvasRef
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    const w = Math.round(rect.width)
    const h = Math.round(rect.height)
    if (h <= 0) { liveRect = { w, h }; return }
    liveRect = { w, h }
    const ctx = canvas.getContext('2d')!
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    ctx.clearRect(0, 0, w, h)

    // Background
    ctx.fillStyle = '#0d1117'
    ctx.fillRect(0, 0, w, h)

    const activeTracks = tracks().filter(t => t.analyserNode)
    if (activeTracks.length === 0) return

    const trackHeight = h / activeTracks.length

    for (let ti = 0; ti < activeTracks.length; ti++) {
      const track = activeTracks[ti]
      const analyser = track.analyserNode!
      const data = new Uint8Array(analyser.frequencyBinCount)
      analyser.getByteTimeDomainData(data)
      const yOff = ti * trackHeight
      const midY = yOff + trackHeight / 2

      ctx.strokeStyle = track.color
      ctx.lineWidth = 1.5
      ctx.beginPath()
      for (let i = 0; i < data.length; i++) {
        const x = (i / data.length) * w
        const y = midY + ((data[i] / 128) - 1) * (trackHeight * 0.4)
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()

      // Track label
      ctx.fillStyle = track.color + '80'
      ctx.font = '9px monospace'
      ctx.fillText(track.label, 4, yOff + 12)
    }
  }

  const drawPitchCanvas = () => {
    const canvas = pitchCanvasRef
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    const w = Math.round(rect.width)
    const h = Math.round(rect.height)
    if (h <= 0) { pitchRect = { w, h }; return }
    pitchRect = { w, h }
    const ctx = canvas.getContext('2d')!
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    ctx.clearRect(0, 0, w, h)

    // Background
    ctx.fillStyle = '#0d1117'
    ctx.fillRect(0, 0, w, h)

    if (!vocal().buffer) {
      ctx.fillStyle = '#484f58'
      ctx.font = '12px monospace'
      ctx.textAlign = 'center'
      ctx.fillText('No vocal stem — pitch display unavailable', w / 2, h / 2)
      ctx.textAlign = 'start'
      return
    }

    // Grid lines for note rows (C through B)
    const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
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

    // Note labels
    ctx.fillStyle = '#484f58'
    ctx.font = '9px monospace'
    for (let i = 0; i < 12; i++) {
      const note = notes[11 - i] // C at bottom, B at top
      ctx.fillText(note, 3, i * rowH + rowH * 0.65 + rowH)
    }

    // Pitch history — consolidated into Melodyne-style pills
    const winStart = windowStart()
    const winEnd = winStart + windowDuration()
    const winDur = windowDuration()
    if (pitchHistory.length > 0) {
      const pillGroups: { noteIdx: number; startTime: number; endTime: number }[] = []
      let cur = {
        noteIdx: notes.indexOf(pitchHistory[0].noteName.replace(/\d/g, '')),
        startTime: pitchHistory[0].time,
        endTime: pitchHistory[0].time,
      }
      for (let i = 1; i < pitchHistory.length; i++) {
        const pn = pitchHistory[i]
        const noteIdx = notes.indexOf(pn.noteName.replace(/\d/g, ''))
        if (noteIdx === cur.noteIdx) {
          cur.endTime = pn.time
        } else {
          if (cur.noteIdx >= 0) pillGroups.push({ ...cur })
          cur = { noteIdx, startTime: pn.time, endTime: pn.time }
        }
      }
      if (cur.noteIdx >= 0) pillGroups.push({ ...cur })

      for (const g of pillGroups) {
        if (g.endTime < winStart || g.startTime > winEnd) continue
        const x1 = Math.max(0, ((g.startTime - winStart) / winDur) * w)
        const x2 = Math.min(w, ((g.endTime - winStart) / winDur) * w)
        const pillW = Math.max(x2 - x1, 3)
        const y = (11 - g.noteIdx) * rowH + rowH * 0.16
        const pillH = rowH * 0.68
        const r = Math.min(pillH / 2, 3)

        ctx.fillStyle = 'rgba(245, 158, 11, 0.5)'
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
        ctx.fill()
      }
    }

    // Current pitch highlight
    const cp = currentPitch()
    if (cp && cp.frequency > 0) {
      const elapsedTime = elapsed()
      const noteIdx = notes.indexOf(cp.noteName.replace(/\d/g, ''))
      if (noteIdx >= 0 && elapsedTime >= winStart && elapsedTime <= winEnd) {
        const x = ((elapsedTime - winStart) / winDur) * w
        const y = (11 - noteIdx) * rowH + rowH * 0.5

        // Glow
        ctx.shadowColor = '#f59e0b'
        ctx.shadowBlur = 12
        ctx.fillStyle = '#f59e0b'
        ctx.beginPath()
        ctx.arc(x, y, 6, 0, Math.PI * 2)
        ctx.fill()
        ctx.shadowBlur = 0

        // Note label
        ctx.fillStyle = '#fff'
        ctx.font = 'bold 11px monospace'
        ctx.fillText(`${cp.noteName}${cp.octave}`, Math.min(x + 10, w - 40), y + 4)
      }
    }

    // Playhead
    const elapsedTime = elapsed()
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

  // ── Resize handling ──────────────────────────────────────────
  let resizeObserver: ResizeObserver | null = null

  onMount(() => {
    loadStems()
    loadLyrics()

    resizeObserver = new ResizeObserver(() => {
      syncCanvasSizes()
      drawWaveformOverview()
      drawLiveWaveform()
      drawPitchCanvas()
    })

    if (waveformCanvasRef) resizeObserver.observe(waveformCanvasRef)
    if (liveWaveCanvasRef) resizeObserver.observe(liveWaveCanvasRef)
    if (pitchCanvasRef) resizeObserver.observe(pitchCanvasRef)

    // Initial canvas draws after a frame
    requestAnimationFrame(() => {
      syncCanvasSizes()
      drawWaveformOverview()
      drawLiveWaveform()
      drawPitchCanvas()
    })

    // Keyboard shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore when typing in inputs
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      if (e.code === 'Space') {
        e.preventDefault()
        if (loading() || loadError()) return
        playing() ? handlePause() : handlePlay()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    ;(window as any).__smKeydown = handleKeyDown

    // Resize document-level listeners
    const handleResizeDocMove = (e: PointerEvent) => { handleResizeMove(e) }
    const handleResizeDocEnd = (e: PointerEvent) => { handleResizeEnd(e) }
    document.addEventListener('pointermove', handleResizeDocMove)
    document.addEventListener('pointerup', handleResizeDocEnd)
    ;(window as any).__smResizeMove = handleResizeDocMove
    ;(window as any).__smResizeEnd = handleResizeDocEnd
  })

  createEffect(() => {
    if (!loading()) {
      requestAnimationFrame(() => {
        syncCanvasSizes()
        drawWaveformOverview()
        drawLiveWaveform()
        drawPitchCanvas()
      })
    }
  })

  onCleanup(() => {
    disconnectSources()
    cancelAnimationFrame(rafId)
    resizeObserver?.disconnect()
    if ((window as any).__smKeydown) {
      window.removeEventListener('keydown', (window as any).__smKeydown)
      delete (window as any).__smKeydown
    }
    if ((window as any).__smResizeMove) {
      document.removeEventListener('pointermove', (window as any).__smResizeMove)
      delete (window as any).__smResizeMove
    }
    if ((window as any).__smResizeEnd) {
      document.removeEventListener('pointerup', (window as any).__smResizeEnd)
      delete (window as any).__smResizeEnd
    }
    if (audioCtx) {
      audioCtx.close().catch(() => { /* */ })
    }
  })

  // ── Helpers ──────────────────────────────────────────────────
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60)
    const s = Math.floor(secs % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  const getPanel = (id: string) => panels().find(p => p.id === id)!
  const panelStyle = (id: string) => {
    const p = getPanel(id)
    return {
      order: p.order,
      ...(p.height !== null ? { height: `${p.height}px` } : {}),
    }
  }

  // ── Drag-to-reorder ──────────────────────────────────────────
  const handlePanelDragStart = (panelId: string, panelOrder: number, e: PointerEvent) => {
    if (!(e.target instanceof HTMLElement)) return
    const header = e.target.closest('.sm-panel-header') as HTMLElement | null
    if (!header) return

    e.preventDefault()
    header.setPointerCapture(e.pointerId)

    dragPanelId = panelId
    dragStartOrder = panelOrder
    dragTargetOrder = panelOrder
    dragOffsetX = e.clientX
    dragOffsetY = e.clientY
  }

  const handlePanelDragMove = (e: PointerEvent) => {
    if (!dragPanelId) return
    e.preventDefault()

    // Find the panel under the pointer
    const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null
    if (!el) return
    const panel = el.closest('.sm-workspace-panel') as HTMLElement | null
    if (!panel) return

    const targetId = panel.dataset.panelId
    if (!targetId || targetId === dragPanelId) return

    const targetOrder = panels().find(p => p.id === targetId)?.order
    if (targetOrder !== undefined && targetOrder !== dragTargetOrder) {
      dragTargetOrder = targetOrder
    }
  }

  const handlePanelDragEnd = (e: PointerEvent) => {
    if (!dragPanelId) return
    e.preventDefault()

    if (dragTargetOrder !== dragStartOrder) {
      reorderPanels(dragPanelId, dragTargetOrder)
      // Redraw canvases after grid reflow settles
      requestAnimationFrame(() => {
        syncCanvasSizes()
        drawWaveformOverview()
        drawLiveWaveform()
        drawPitchCanvas()
      })
    }

    dragPanelId = null
    dragStartOrder = -1
    dragTargetOrder = -1
  }

  // Redraw canvases after layout change (column toggle, etc.)
  const queueCanvasRedraw = () => {
    requestAnimationFrame(() => {
      syncCanvasSizes()
      drawWaveformOverview()
      drawLiveWaveform()
      drawPitchCanvas()
    })
  }

  // ── Resize handlers ──────────────────────────────────────────
  const handleResizeStart = (panelId: string, e: PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const panel = panels().find(p => p.id === panelId)
    if (!panel) return

    const panelEl = document.querySelector(`[data-panel-id="${panelId}"]`) as HTMLElement | null
    resizePanelId = panelId
    resizeStartY = e.clientY
    resizeStartHeight = panel.height ?? (panelEl?.getBoundingClientRect().height ?? 200)

    // Prevent canvas from capturing pointer during resize
    const canvas = panelEl?.querySelector('canvas') as HTMLElement | null
    if (canvas) canvas.style.pointerEvents = 'none'

    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  const handleResizeMove = (e: PointerEvent) => {
    if (!resizePanelId || !workspaceRef) return
    e.preventDefault()
    const delta = e.clientY - resizeStartY
    const maxH = workspaceRef.clientHeight - 60
    const newHeight = Math.max(40, Math.min(maxH, resizeStartHeight + delta))
    setPanels(prev => prev.map(p =>
      p.id === resizePanelId ? { ...p, height: newHeight } : p
    ))
  }

  const handleResizeEnd = (_e: PointerEvent) => {
    if (!resizePanelId) return
    const panelEl = document.querySelector(`[data-panel-id="${resizePanelId}"]`)
    const canvas = panelEl?.querySelector('canvas') as HTMLElement | null
    if (canvas) canvas.style.pointerEvents = ''
    resizePanelId = null
    syncCanvasSizes()
    drawWaveformOverview()
    drawLiveWaveform()
    drawPitchCanvas()
  }

  // ── Render ───────────────────────────────────────────────────
  return (
    <div class="stem-mixer">
      {/* Header */}
      <div class="sm-header">
        <div class="sm-header-left">
          <Show when={props.onBack}>
            <button class="sm-back-btn" onClick={props.onBack} title="Back">
              <ChevronLeft />
            </button>
          </Show>
          <h2>Stem Mixer</h2>
          <span class="sm-session-id">{props.sessionId.slice(0, 8)}</span>
        </div>
      </div>

        {/* Loading / Error */}
        <Show when={loading()}>
          <div class="sm-loading">
            <div class="sm-loading-spinner" />
            <span>Loading stems... {loadProgress()}%</span>
          </div>
        </Show>

        <Show when={loadError()}>
          <div class="sm-error">
            <span>{loadError()}</span>
            <button class="sm-error-retry" onClick={loadStems}>Retry</button>
          </div>
        </Show>

        <Show when={!loading() && !loadError()}>
          {/* Transport Bar — top */}
          <div class="sm-transport">
            <div class="sm-transport-controls">
              <button class="sm-transport-btn" onClick={handleStop} title="Stop">
                <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>
              </button>
              <button class="sm-transport-btn" onClick={handleRestart} title="Restart (play from beginning)">
                <SkipBack />
              </button>
              <button
                class="sm-transport-btn sm-transport-play"
                onClick={playing() ? handlePause : handlePlay}
              >
                {playing() ? <Pause /> : <Play />}
              </button>

              <div class="sm-col-toggle">
                <button
                  class={`sm-col-btn${workspaceColumns() === 1 ? ' sm-col-active' : ''}`}
                  onClick={() => { setWorkspaceColumns(1); queueCanvasRedraw() }}
                  title="Single column"
                >
                  <svg viewBox="0 0 24 24" width="12" height="12"><rect x="4" y="4" width="16" height="16" rx="1" fill="currentColor"/></svg>
                </button>
                <button
                  class={`sm-col-btn${workspaceColumns() === 2 ? ' sm-col-active' : ''}`}
                  onClick={() => { setWorkspaceColumns(2); queueCanvasRedraw() }}
                  title="Two columns"
                >
                  <svg viewBox="0 0 24 24" width="12" height="12"><rect x="3" y="4" width="8" height="16" rx="1" fill="currentColor"/><rect x="13" y="4" width="8" height="16" rx="1" fill="currentColor"/></svg>
                </button>
              </div>

              <div class="sm-zoom-control">
                <button class="sm-zoom-btn" onClick={() => setWindowDuration(prev => Math.max(10, prev - 5))} title="Zoom in (shorter window)">−</button>
                <span class="sm-zoom-value">{windowDuration()}s</span>
                <button class="sm-zoom-btn" onClick={() => setWindowDuration(prev => Math.min(150, prev + 5))} title="Zoom out (longer window)">+</button>
              </div>
            </div>

            <div class="sm-progress-area">
              <span class="sm-time">{formatTime(elapsed())}</span>
              <div
                ref={progressBarRef}
                class="sm-progress-bar"
                onClick={handleSeek}
              >
                <div
                  class="sm-progress-fill"
                  style={{
                    width: `${duration() > 0 ? (elapsed() / duration()) * 100 : 0}%`,
                  }}
                />
              </div>
              <span class="sm-time">{formatTime(duration())}</span>
            </div>

          </div>

          <div
            ref={workspaceRef}
            class="sm-workspace"
            style={{ 'grid-template-columns': workspaceColumns() === 1 ? '1fr' : '1fr 1fr' }}
            onWheel={(e) => { e.preventDefault(); setWindowDuration(prev => Math.min(150, Math.max(10, prev + (e.deltaY > 0 ? 5 : -5)))) }}
          >
            {/* Panel: Waveform Overview */}
            <div
              class="sm-workspace-panel"
              style={panelStyle('overview')}
              data-panel-id="overview"
            >
              <div
                class="sm-panel-header"
                onPointerDown={(e) => handlePanelDragStart('overview', getPanel('overview').order, e)}
                onPointerMove={handlePanelDragMove}
                onPointerUp={handlePanelDragEnd}
                onPointerCancel={handlePanelDragEnd}
              >
                <svg viewBox="0 0 24 24" width="10" height="10" class="sm-drag-icon"><path fill="currentColor" d="M20 9H4v2h16V9zM4 15h16v-2H4v2z"/></svg>
                Waveform Overview
              </div>
              <canvas ref={waveformCanvasRef} class="sm-canvas sm-canvas-overview" onClick={handleWaveformClick} />
              <div
                class="sm-resize-handle"
                onPointerDown={(e) => handleResizeStart('overview', e)}
              />
            </div>

            {/* Panel: Live Waveform */}
            <div
              class="sm-workspace-panel"
              style={panelStyle('live')}
              data-panel-id="live"
            >
              <div
                class="sm-panel-header"
                onPointerDown={(e) => handlePanelDragStart('live', getPanel('live').order, e)}
                onPointerMove={handlePanelDragMove}
                onPointerUp={handlePanelDragEnd}
                onPointerCancel={handlePanelDragEnd}
              >
                <svg viewBox="0 0 24 24" width="10" height="10" class="sm-drag-icon"><path fill="currentColor" d="M20 9H4v2h16V9zM4 15h16v-2H4v2z"/></svg>
                Live Waveform
              </div>
              <canvas ref={liveWaveCanvasRef} class="sm-canvas sm-canvas-live" />
              <div
                class="sm-resize-handle"
                onPointerDown={(e) => handleResizeStart('live', e)}
              />
            </div>

            {/* Panel: Vocal Pitch */}
            <div
              class="sm-workspace-panel"
              style={panelStyle('pitch')}
              data-panel-id="pitch"
            >
              <div
                class="sm-panel-header"
                onPointerDown={(e) => handlePanelDragStart('pitch', getPanel('pitch').order, e)}
                onPointerMove={handlePanelDragMove}
                onPointerUp={handlePanelDragEnd}
                onPointerCancel={handlePanelDragEnd}
              >
                <svg viewBox="0 0 24 24" width="10" height="10" class="sm-drag-icon"><path fill="currentColor" d="M20 9H4v2h16V9zM4 15h16v-2H4v2z"/></svg>
                Vocal Pitch
              </div>
              <canvas ref={pitchCanvasRef} class="sm-canvas sm-canvas-pitch" />
              <div
                class="sm-resize-handle"
                onPointerDown={(e) => handleResizeStart('pitch', e)}
              />
            </div>

            {/* Panel: Stem Controls */}
            <div
              class="sm-workspace-panel"
              style={panelStyle('controls')}
              data-panel-id="controls"
            >
              <div
                class="sm-panel-header"
                onPointerDown={(e) => handlePanelDragStart('controls', getPanel('controls').order, e)}
                onPointerMove={handlePanelDragMove}
                onPointerUp={handlePanelDragEnd}
                onPointerCancel={handlePanelDragEnd}
              >
                <svg viewBox="0 0 24 24" width="10" height="10" class="sm-drag-icon"><path fill="currentColor" d="M20 9H4v2h16V9zM4 15h16v-2H4v2z"/></svg>
                Stem Controls
              </div>
              <div class="sm-strips-row">
                {vocal().url && (
                  <div class="sm-stem-strip">
                    <div class="sm-stem-header">
                      <span
                        class="sm-stem-dot"
                        style={{ background: vocal().color }}
                      />
                      <span class="sm-stem-label">{vocal().label}</span>
                      <span class="sm-stem-vol-pct">
                        {Math.round((vocal().muted || (anySoloed() && !vocal().soloed)) ? 0 : vocal().volume * 100)}%
                      </span>
                    </div>
                    <div class="sm-stem-actions">
                      <button
                        class={`sm-action-btn ${vocal().soloed ? 'sm-active' : ''}`}
                        onClick={() => toggleSolo('Vocal')}
                        title="Solo"
                        style={{ color: vocal().soloed ? vocal().color : '' }}
                      >
                        <Ear />
                      </button>
                      <button
                        class={`sm-action-btn ${vocal().muted ? 'sm-muted' : ''}`}
                        onClick={() => toggleMute('Vocal')}
                        title="Mute"
                      >
                        {vocal().muted ? <VolumeX /> : <Volume2 />}
                      </button>
                      <button
                        class="sm-action-btn"
                        onClick={() => handleDownload(vocal())}
                        title="Download"
                      >
                        <Download />
                      </button>
                    </div>
                    <input
                      type="range"
                      class="sm-volume-slider"
                      min="0"
                      max="100"
                      value={Math.round(vocal().volume * 100)}
                      onInput={(e) =>
                        setTrackVolume('Vocal', parseInt(e.currentTarget.value) / 100)
                      }
                    />
                  </div>
                )}

                {props.stems.vocalMidi && (
                  <div class="sm-midi-substem">
                    <span class="sm-midi-icon"><Midi /></span>
                    <span class="sm-midi-label">MIDI</span>
                    <button
                      class="sm-midi-dl-btn"
                      onClick={() => {
                        const a = document.createElement("a");
                        a.href = props.stems.vocalMidi!;
                        a.download = "vocal_midi.mid";
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                      }}
                      title="Download MIDI"
                    >
                      <Download />
                    </button>
                  </div>
                )}

                {instrumental().url && (
                  <div class="sm-stem-strip">
                    <div class="sm-stem-header">
                      <span
                        class="sm-stem-dot"
                        style={{ background: instrumental().color }}
                      />
                      <span class="sm-stem-label">{instrumental().label}</span>
                      <span class="sm-stem-vol-pct">
                        {Math.round((instrumental().muted || (anySoloed() && !instrumental().soloed)) ? 0 : instrumental().volume * 100)}%
                      </span>
                    </div>
                    <div class="sm-stem-actions">
                      <button
                        class={`sm-action-btn ${instrumental().soloed ? 'sm-active' : ''}`}
                        onClick={() => toggleSolo('Instrumental')}
                        title="Solo"
                        style={{ color: instrumental().soloed ? instrumental().color : '' }}
                      >
                        <Ear />
                      </button>
                      <button
                        class={`sm-action-btn ${instrumental().muted ? 'sm-muted' : ''}`}
                        onClick={() => toggleMute('Instrumental')}
                        title="Mute"
                      >
                        {instrumental().muted ? <VolumeX /> : <Volume2 />}
                      </button>
                      <button
                        class="sm-action-btn"
                        onClick={() => handleDownload(instrumental())}
                        title="Download"
                      >
                        <Download />
                      </button>
                    </div>
                    <input
                      type="range"
                      class="sm-volume-slider"
                      min="0"
                      max="100"
                      value={Math.round(instrumental().volume * 100)}
                      onInput={(e) =>
                        setTrackVolume('Instrumental', parseInt(e.currentTarget.value) / 100)
                      }
                    />
                  </div>
                )}
              </div>
              <div
                class="sm-resize-handle"
                onPointerDown={(e) => handleResizeStart('controls', e)}
              />
            </div>

            {/* Panel: Lyrics */}
            <div
              class="sm-workspace-panel"
              style={panelStyle('lyrics')}
              data-panel-id="lyrics"
            >
              <div
                class="sm-panel-header"
                onPointerDown={(e) => handlePanelDragStart('lyrics', getPanel('lyrics').order, e)}
                onPointerMove={handlePanelDragMove}
                onPointerUp={handlePanelDragEnd}
                onPointerCancel={handlePanelDragEnd}
              >
                <svg viewBox="0 0 24 24" width="10" height="10" class="sm-drag-icon"><path fill="currentColor" d="M20 9H4v2h16V9zM4 15h16v-2H4v2z"/></svg>
                Lyrics
                <Show when={lyricsSource() === 'api'}>
                  <span class="sm-lyrics-source">found</span>
                </Show>
                <Show when={lyricsSource() === 'upload'}>
                  <span class="sm-lyrics-source sm-lyrics-source-upload">uploaded</span>
                </Show>
              </div>
              <Show when={lyricsLoading()}>
                <div class="sm-lyrics-loading">Searching...</div>
              </Show>
              <Show when={!lyricsLoading() && lyricsSource() !== 'none'}>
                <div class="sm-lyrics-lines">
                  <Show when={lrcLines().length > 0}>
                    <For each={lrcLines()}>
                      {(line, idx) => (
                        <span
                          class={`sm-lyrics-line${idx() === currentLineIdx() ? ' sm-lyrics-line-active' : ''}`}
                          onClick={() => handleLyricLineClick(idx())}
                        >
                          {line.text}
                        </span>
                      )}
                    </For>
                  </Show>
                  <Show when={lrcLines().length === 0 && lyricsLines().length > 0}>
                    <For each={lyricsLines()}>
                      {(line, idx) => (
                        <span
                          class={`sm-lyrics-line${idx() === currentLineIdx() ? ' sm-lyrics-line-active' : ''}`}
                          onClick={() => handleLyricLineClick(idx())}
                        >
                          {line}
                        </span>
                      )}
                    </For>
                  </Show>
                </div>
              </Show>
              <Show when={!lyricsLoading() && lyricsSource() === 'none'}>
                <LyricsUploader
                  onUpload={handleLyricsUpload}
                  suggestion={props.songTitle}
                />
              </Show>
              <div
                class="sm-resize-handle"
                onPointerDown={(e) => handleResizeStart('lyrics', e)}
              />
            </div>
          </div>
        </Show>
    </div>
  )
}

// ============================================================
// CSS Styles
// ============================================================

export const StemMixerStyles: string = `
.stem-mixer {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-secondary, #161b22);
  overflow: hidden;
}

/* Header */
.sm-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.875rem 1.25rem;
  background: var(--bg-primary, #0d1117);
  border-bottom: 1px solid var(--border, #30363d);
  flex-shrink: 0;
}

.sm-header-left {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.sm-header-left h2 {
  margin: 0;
  font-size: 1.05rem;
  color: var(--fg-primary, #c9d1d9);
}

.sm-session-id {
  font-size: 0.7rem;
  color: var(--fg-tertiary, #484f58);
  background: var(--bg-tertiary, #21262d);
  padding: 0.15rem 0.5rem;
  border-radius: 0.3rem;
  font-family: monospace;
}

.sm-back-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  padding: 0;
  background: var(--bg-tertiary, #21262d);
  border: 1px solid var(--border, #30363d);
  border-radius: 0.4rem;
  color: var(--fg-secondary, #8b949e);
  cursor: pointer;
  transition: all 0.15s;
  flex-shrink: 0;
}

.sm-back-btn:hover {
  background: var(--bg-hover, #30363d);
  color: var(--fg-primary, #c9d1d9);
}

.sm-back-btn svg {
  width: 0.9rem;
  height: 0.9rem;
}

/* Loading */
.sm-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  flex: 1;
  color: var(--fg-secondary, #8b949e);
  font-size: 0.9rem;
}

.sm-loading-spinner {
  width: 2rem;
  height: 2rem;
  border: 2px solid var(--border, #30363d);
  border-top-color: var(--accent, #58a6ff);
  border-radius: 50%;
  animation: sm-spin 0.8s linear infinite;
}

@keyframes sm-spin {
  to { transform: rotate(360deg); }
}

/* Error */
.sm-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  flex: 1;
  color: var(--error, #f85149);
  font-size: 0.9rem;
}

.sm-error-retry {
  padding: 0.5rem 1.25rem;
  background: var(--accent, #58a6ff);
  color: var(--bg-primary, #0d1117);
  border: none;
  border-radius: 0.4rem;
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
}

.sm-error-retry:hover {
  opacity: 0.85;
}

/* Workspace grid */
.sm-workspace {
  display: grid;
  grid-auto-rows: auto;
  align-content: start;
  gap: 0.5rem;
  flex: 1;
  overflow: hidden;
  padding: 0.5rem;
  min-height: 0;
}

.sm-workspace-panel {
  display: flex;
  flex-direction: column;
  position: relative;
  background: var(--bg-primary, #0d1117);
  border-radius: 0.5rem;
  overflow: hidden;
  min-height: 0;
  transition: box-shadow 0.15s ease;
}

.sm-workspace-panel.dragging {
  opacity: 0.5;
  box-shadow: 0 0 0 2px var(--accent, #58a6ff);
}

/* Drag handle header */
.sm-panel-header {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.65rem;
  color: var(--fg-tertiary, #484f58);
  padding: 0.3rem 0.6rem;
  background: var(--bg-tertiary, #21262d);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  flex-shrink: 0;
  cursor: grab;
  user-select: none;
}

.sm-panel-header:active {
  cursor: grabbing;
}

.sm-drag-icon {
  flex-shrink: 0;
  opacity: 0.5;
  color: var(--fg-tertiary, #484f58);
}

.sm-canvas {
  height: 100%;
  width: 100%;
  min-height: 0;
}

.sm-resize-handle {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 4px;
  cursor: ns-resize;
  background: transparent;
  z-index: 5;
  transition: background 0.15s;
}
.sm-resize-handle:hover {
  background: var(--accent, #58a6ff);
}

/* Controls content */
.sm-strips-row {
  display: flex;
  gap: 0.5rem;
}

.sm-stem-strip {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  flex: 1;
  padding: 0.75rem 0.4rem;
  background: var(--bg-primary, #0d1117);
  border-radius: 0.6rem;
}

.sm-stem-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.2rem;
}

.sm-stem-dot {
  width: 0.65rem;
  height: 0.65rem;
  border-radius: 50%;
}

.sm-stem-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--fg-primary, #c9d1d9);
}

.sm-stem-vol-pct {
  font-size: 0.65rem;
  color: var(--fg-tertiary, #484f58);
}

.sm-stem-actions {
  display: flex;
  gap: 0.15rem;
}

.sm-action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.65rem;
  height: 1.65rem;
  padding: 0;
  background: var(--bg-tertiary, #21262d);
  border: 1px solid var(--border, #30363d);
  border-radius: 0.35rem;
  color: var(--fg-secondary, #8b949e);
  cursor: pointer;
  transition: all 0.15s;
}

.sm-action-btn svg {
  width: 0.8rem;
  height: 0.8rem;
}

.sm-action-btn:hover {
  background: var(--bg-hover, #30363d);
  color: var(--fg-primary, #c9d1d9);
}

.sm-action-btn.sm-active {
  background: rgba(245, 158, 11, 0.15);
  border-color: rgba(245, 158, 11, 0.3);
}

.sm-action-btn.sm-muted {
  color: var(--error, #f85149);
}

.sm-volume-slider {
  writing-mode: vertical-lr;
  direction: rtl;
  -webkit-appearance: none;
  appearance: none;
  width: 4px;
  height: 100px;
  background: var(--bg-tertiary, #21262d);
  border-radius: 2px;
  outline: none;
  cursor: pointer;
}

.sm-volume-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 14px;
  height: 14px;
  background: var(--accent, #58a6ff);
  border-radius: 50%;
  cursor: pointer;
  border: 2px solid var(--bg-primary, #0d1117);
}

.sm-volume-slider::-moz-range-thumb {
  width: 14px;
  height: 14px;
  background: var(--accent, #58a6ff);
  border-radius: 50%;
  cursor: pointer;
  border: 2px solid var(--bg-primary, #0d1117);
}


  /* MIDI sub-stem */
  .sm-midi-substem {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.3rem 0.5rem;
    margin: -0.25rem 0.25rem 0.25rem 1rem;
    background: rgba(245, 158, 11, 0.06);
    border: 1px solid rgba(245, 158, 11, 0.15);
    border-radius: 0.35rem;
    font-size: 0.65rem;
  }

  .sm-midi-icon {
    display: flex;
    align-items: center;
    color: rgba(245, 158, 11, 0.7);
  }

  .sm-midi-icon svg {
    width: 0.75rem;
    height: 0.75rem;
  }

  .sm-midi-label {
    color: rgba(245, 158, 11, 0.8);
    font-weight: 500;
    font-size: 0.6rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .sm-midi-dl-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.2rem;
    height: 1.2rem;
    padding: 0;
    margin-left: auto;
    background: transparent;
    border: 1px solid rgba(245, 158, 11, 0.2);
    border-radius: 0.25rem;
    color: rgba(245, 158, 11, 0.6);
    cursor: pointer;
    transition: all 0.15s;
  }

  .sm-midi-dl-btn:hover {
    background: rgba(245, 158, 11, 0.15);
    color: rgba(245, 158, 11, 0.9);
  }

  .sm-midi-dl-btn svg {
    width: 0.6rem;
    height: 0.6rem;
  }
.sm-lyrics-source {
  font-size: 0.55rem;
  padding: 0.05rem 0.3rem;
  border-radius: 0.2rem;
  background: rgba(34, 197, 94, 0.15);
  color: #22c55e;
  text-transform: none;
  letter-spacing: 0;
}

.sm-lyrics-source-upload {
  background: rgba(139, 92, 246, 0.15);
  color: #8b5cf6;
}

.sm-lyrics-loading {
  padding: 0.5rem;
  font-size: 0.62rem;
  color: var(--fg-tertiary, #484f58);
  text-align: center;
}

.sm-lyrics-lines {
  flex: 1;
  overflow-y: auto;
  padding: 0.35rem 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.sm-lyrics-line {
  font-size: 0.65rem;
  color: var(--fg-tertiary, #484f58);
  padding: 0.12rem 0.3rem;
  border-radius: 0.2rem;
  cursor: pointer;
  transition: all 0.1s;
  line-height: 1.3;
}

.sm-lyrics-line:hover {
  color: var(--fg-secondary, #8b949e);
  background: var(--bg-tertiary, #21262d);
}

.sm-lyrics-line-active {
  color: var(--accent, #58a6ff);
  background: rgba(88, 166, 255, 0.1);
  font-weight: 500;
}

/* Column toggle */
.sm-col-toggle {
  display: flex;
  gap: 2px;
  background: var(--bg-tertiary, #21262d);
  border-radius: 0.3rem;
  padding: 2px;
  margin: 0 0.5rem;
}
.sm-col-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.5rem;
  height: 1.25rem;
  padding: 0;
  background: transparent;
  border: none;
  border-radius: 0.2rem;
  color: var(--fg-tertiary, #484f58);
  cursor: pointer;
  transition: all 0.15s;
}
.sm-col-btn:hover {
  color: var(--fg-secondary, #8b949e);
}
.sm-col-active {
  background: var(--accent, #58a6ff);
  color: var(--bg-primary, #0d1117);
}
.sm-col-active:hover {
  color: var(--bg-primary, #0d1117);
}

/* Transport */
.sm-transport {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.75rem 1.25rem;
  background: var(--bg-primary, #0d1117);
  border-top: 1px solid var(--border, #30363d);
  flex-shrink: 0;
}

.sm-transport-controls {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  flex-shrink: 0;
}

.sm-transport-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  padding: 0;
  background: var(--bg-tertiary, #21262d);
  border: 1px solid var(--border, #30363d);
  border-radius: 0.4rem;
  color: var(--fg-secondary, #8b949e);
  cursor: pointer;
  transition: all 0.15s;
}

.sm-transport-btn svg {
  width: 0.85rem;
  height: 0.85rem;
}

.sm-transport-btn:hover:not(:disabled) {
  background: var(--bg-hover, #30363d);
  color: var(--fg-primary, #c9d1d9);
}

.sm-transport-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.sm-transport-play {
  width: 2.5rem;
  height: 2.5rem;
  background: var(--accent, #58a6ff);
  border-color: var(--accent, #58a6ff);
  color: var(--bg-primary, #0d1117);
  border-radius: 50%;
}

.sm-transport-play:hover:not(:disabled) {
  opacity: 0.85;
  color: var(--bg-primary, #0d1117);
}

.sm-zoom-control {
  display: flex;
  align-items: center;
  gap: 0.2rem;
  margin: 0 0.5rem;
}

.sm-zoom-btn {
  width: 1.35rem;
  height: 1.35rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-tertiary, #21262d);
  border: 1px solid var(--border-primary, #30363d);
  color: var(--fg-secondary, #8b949e);
  border-radius: 0.25rem;
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 600;
  line-height: 1;
  padding: 0;
}

.sm-zoom-btn:hover {
  background: var(--bg-secondary, #161b22);
  color: var(--fg-primary, #c9d1d9);
}

.sm-zoom-value {
  font-size: 0.65rem;
  color: var(--fg-tertiary, #484f58);
  font-family: monospace;
  min-width: 28px;
  text-align: center;
}

.sm-progress-area {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.sm-time {
  font-size: 0.7rem;
  color: var(--fg-tertiary, #484f58);
  font-family: monospace;
  min-width: 32px;
  flex-shrink: 0;
}

.sm-time:last-child {
  text-align: right;
}

.sm-progress-bar {
  flex: 1;
  height: 0.35rem;
  background: var(--bg-tertiary, #21262d);
  border-radius: 0.2rem;
  cursor: pointer;
  position: relative;
  overflow: hidden;
}

.sm-progress-bar:hover {
  height: 0.5rem;
}

.sm-progress-fill {
  height: 100%;
  background: var(--accent, #58a6ff);
  border-radius: 0.2rem;
  transition: width 0.1s linear;
}

`
