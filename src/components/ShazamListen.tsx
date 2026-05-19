// ============================================================
// ShazamListen — Mic capture + live pitch visualization
// Phase 4 of Shazam Sing
//
// User taps the mic button, sings/hums, and the captured pitch
// contour is matched against the melody fingerprint index.
// ============================================================

import { createSignal, For, onCleanup, onMount, Show } from 'solid-js'
import { AudioEngine } from '@/lib/audio-engine'
import { audioRegistry } from '@/lib/audio-registry'
import { IS_DEV } from '@/lib/defaults'
import type { DetectedPitch } from '@/lib/pitch-detector'
import { LivePitchBuffer } from '@/lib/shazam/live-pitch-buffer'
import { matchPitchContourWithMeta } from '@/lib/shazam/melody-matcher'
import { detectOnsets, segmentNotes } from '@/lib/shazam/onset-detector'
import type { LivePitchContour, MatchCandidate, TimestampedPitch, } from '@/lib/shazam/types'
import type { SpeechRecognizer } from '@/lib/speech-recognition'
import { createSpeechRecognizer } from '@/lib/speech-recognition'
import { WhisperService } from '@/lib/whisper-service'
import { FingerprintInspector } from './FingerprintInspector'
import { LivePitchDebug } from './LivePitchDebug'
import styles from './ShazamListen.module.css'

interface ShazamListenProps {
  onMatch: (result: {
    candidates: MatchCandidate[]
    contour: LivePitchContour
    hummingNormalized: boolean
  }) => void
  onAutoJump?: (candidate: MatchCandidate) => void
  onCancel: () => void
  onSwitchToUpload: () => void
}

type ListenState = 'idle' | 'listening' | 'processing' | 'error'

export function ShazamListen(props: ShazamListenProps) {
  let audioEngine: AudioEngine | null = null
  let buffer: LivePitchBuffer | null = null
  let canvasRef: HTMLCanvasElement | undefined
  let ctx: CanvasRenderingContext2D | null = null
  let rafId: number | null = null
  let pitchHistory: Array<{ freq: number; clarity: number; time: number }> = []
  let liveMatchIntervalId: ReturnType<typeof setInterval> | null = null

  const [listenState, setListenState] = createSignal<ListenState>('idle')
  const [elapsed, setElapsed] = createSignal(0)
  const [errorMessage, setErrorMessage] = createSignal('')
  const [autoMode, setAutoMode] = createSignal(
    localStorage.getItem('pitchperfect_shazam_auto') === 'true',
  )
  const [autoThreshold, setAutoThreshold] = createSignal(
    Number(localStorage.getItem('pitchperfect_shazam_threshold')) || 85,
  )
  const [includeMelodies, setIncludeMelodies] = createSignal(
    localStorage.getItem('pitchperfect_shazam_include_melodies') !== 'false',
  )
  const [includeStems, setIncludeStems] = createSignal(
    localStorage.getItem('pitchperfect_shazam_include_stems') !== 'false',
  )
  const [latestFrame, setLatestFrame] = createSignal<DetectedPitch | null>(null)

  const debugEnabled = (): boolean =>
    IS_DEV || localStorage.getItem('pitchperfect_shazam_debug_force') === 'true'

  const [showDebug, setShowDebug] = createSignal(
    localStorage.getItem('pitchperfect_shazam_debug') === 'true',
  )

  function toggleDebug() {
    setShowDebug((v) => {
      const next = !v
      localStorage.setItem('pitchperfect_shazam_debug', String(next))
      return next
    })
  }

  const [frameCount, setFrameCount] = createSignal(0)
  const [liveMatches, setLiveMatches] = createSignal<Array<{
    name: string
    confidence: number
    breakdown: { pitch: number; interval: number; chroma: number; rhythm: number }
    notes: number
  }>>([])
  const [liveQueryNotes, setLiveQueryNotes] = createSignal(0)

  const speechSupported = (() => {
    const w = window as unknown as Record<string, unknown>
    const SR = w.SpeechRecognition ?? w.webkitSpeechRecognition
    return SR !== undefined
  })()

  const [speechEnabled, setSpeechEnabled] = createSignal(false)
  const [speechText, setSpeechText] = createSignal('')
  const [speechIsInterim, setSpeechIsInterim] = createSignal(false)
  let speechRecognizer: SpeechRecognizer | null = null

  const [speechEngine, setSpeechEngine] = createSignal<'web' | 'whisper'>('whisper')
  const [whisperStatus, setWhisperStatus] = createSignal('idle')
  let whisperService: WhisperService | null = null
  let whisperIntervalId: ReturnType<typeof setInterval> | null = null

  function toggleSpeech() {
    const next = !speechEnabled()
    setSpeechEnabled(next)
    setSpeechText('')
    
    if (next) {
      if (speechEngine() === 'whisper') {
        if (!whisperService) {
          whisperService = new WhisperService()
          whisperService.onStatusChange = setWhisperStatus
          whisperService.init()
        }
      } else if (speechSupported && listenState() === 'listening') {
        speechRecognizer = createSpeechRecognizer({
          onResult: (text, isFinal) => {
            setSpeechText(text)
            setSpeechIsInterim(!isFinal)
          },
          onError: (err) => console.warn('[speech]', err),
        })
        speechRecognizer.start()
      }
    } else {
      if (speechRecognizer) {
        speechRecognizer.stop()
        speechRecognizer = null
      }
      stopWhisperRecording()
    }
  }

  let whisperAudioCtx: AudioContext | null = null
  let whisperScriptNode: ScriptProcessorNode | null = null
  let whisperSource: MediaStreamAudioSourceNode | null = null
  let whisperAccumulated: Float32Array = new Float32Array(0)

  function stopWhisperRecording() {
    if (whisperScriptNode) {
      whisperScriptNode.disconnect()
      whisperScriptNode.onaudioprocess = null
      whisperScriptNode = null
    }
    if (whisperSource) {
      whisperSource.disconnect()
      whisperSource = null
    }
    if (whisperAudioCtx) {
      void whisperAudioCtx.close()
      whisperAudioCtx = null
    }
    if (whisperIntervalId) {
      clearInterval(whisperIntervalId)
      whisperIntervalId = null
    }
  }

  function startWhisperRecording() {
    stopWhisperRecording()
    const micStream = audioEngine?.getMicStream()
    if (!micStream) return
    
    whisperAccumulated = new Float32Array(0)
    
    // Browser automatically resamples to 16kHz
    whisperAudioCtx = new AudioContext({ sampleRate: 16000 })
    whisperSource = whisperAudioCtx.createMediaStreamSource(micStream)
    whisperScriptNode = whisperAudioCtx.createScriptProcessor(4096, 1, 1)
    
    whisperScriptNode.onaudioprocess = (e) => {
      const input = e.inputBuffer.getChannelData(0)
      const newBuffer = new Float32Array(whisperAccumulated.length + input.length)
      newBuffer.set(whisperAccumulated, 0)
      newBuffer.set(input, whisperAccumulated.length)
      whisperAccumulated = newBuffer
    }
    
    whisperSource.connect(whisperScriptNode)
    // Connect to destination to ensure onaudioprocess fires
    whisperScriptNode.connect(whisperAudioCtx.destination)

    // Transcribe every 5 seconds
    whisperIntervalId = setInterval(() => {
      void processWhisperChunks()
    }, 5000)
  }

  async function processWhisperChunks() {
    if (whisperAccumulated.length === 0 || !whisperService || whisperStatus() !== 'ready') return
    
    try {
      // Copy the accumulated data so we can transcribe without blocking
      const audioData = new Float32Array(whisperAccumulated)
      
      const result = await whisperService.transcribe(audioData)
      setSpeechText(result.text)
    } catch (err) {
      console.error('[Whisper] Transcribe error:', err)
    }
  }

  onMount(() => {
    audioEngine = new AudioEngine()
    audioEngine.init()
    audioRegistry.register(audioEngine)

    if (canvasRef) {
      ctx = canvasRef.getContext('2d')
      resizeCanvas()
      drawCanvas()
      const observer = new ResizeObserver(() => {
        resizeCanvas()
        drawCanvas()
      })
      observer.observe(canvasRef)
      onCleanup(() => observer.disconnect())
    }
  })

  onCleanup(() => {
    stopAll()
    stopWhisperRecording()
    if (whisperService) {
      whisperService.destroy()
      whisperService = null
    }
    if (audioEngine) {
      audioRegistry.unregister(audioEngine)
      audioEngine.destroy()
      audioEngine = null
    }
  })

  function resizeCanvas() {
    if (!canvasRef) return
    const rect = canvasRef.getBoundingClientRect()
    canvasRef.width = rect.width * window.devicePixelRatio
    canvasRef.height = rect.height * window.devicePixelRatio
    ctx = canvasRef.getContext('2d')
    if (ctx) {
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio)
    }
  }

  function stopAll() {
    if (buffer) {
      buffer.cancel()
      buffer = null
    }
    cancelAnimationLoop()
    stopLiveMatching()
  }

  function cancelAnimationLoop() {
    if (rafId !== null) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
  }

  async function handleStart() {
    if (!audioEngine || listenState() !== 'idle') return

    buffer = new LivePitchBuffer(audioEngine, {
      onFrame: handleFrame,
      onStateChange: (_state) => {
        // state changes handled by listenState signal
      },
      onAutoStop: () => {
        handleStop()
      },
    })

    const ok = await buffer.start()
    if (!ok) {
      buffer = null
      setErrorMessage(
        'Microphone access required. Please allow mic access in your browser settings and try again.',
      )
      setListenState('error')
      return
    }

    setListenState('listening')
    pitchHistory = []
    setSpeechText('')
    setLiveMatches([])
    startAnimationLoop()
    startLiveMatching()

    if (speechEnabled()) {
      if (speechEngine() === 'whisper') {
        startWhisperRecording()
      } else if (speechSupported) {
        // Stop any existing recognizer to prevent leaked instances
        // (e.g. if toggleSpeech was called before handleStart)
        if (speechRecognizer) {
          speechRecognizer.stop()
          speechRecognizer = null
        }
        speechRecognizer = createSpeechRecognizer({
          onResult: (text, isFinal) => {
            setSpeechText(text)
            setSpeechIsInterim(!isFinal)
          },
          onError: (err) => console.warn('[speech]', err),
        })
        speechRecognizer.start()
      }
    }
  }

  function handleFrame(frame: TimestampedPitch) {
    pitchHistory.push({
      freq: frame.pitch.frequency,
      clarity: frame.pitch.clarity,
      time: frame.time,
    })
    setFrameCount(pitchHistory.length)
    setLatestFrame(
      frame.pitch.frequency > 0 && frame.pitch.clarity > 0 ? frame.pitch : null,
    )
    // Keep last ~10 seconds of pitch history at ~60fps
    if (pitchHistory.length > 600) {
      pitchHistory = pitchHistory.slice(-600)
    }
  }

  function handleStop() {
    if (speechRecognizer) {
      const spoken = speechRecognizer.stop()
      speechRecognizer = null
      setSpeechText(spoken || '(no speech detected)')
      setSpeechIsInterim(false)
    }
    if (speechEngine() === 'whisper') {
      stopWhisperRecording()
      void processWhisperChunks()
    }
    if (!buffer) return
    const contour: LivePitchContour = buffer.stop()
    buffer = null
    cancelAnimationLoop()
    setListenState('processing')
    setErrorMessage('')

    if (contour.noteSequence.length === 0) {
      setErrorMessage('No melody detected. Try singing a few notes!')
      setListenState('error')
      return
    }

    // Defer matching to next microtask so the "processing" UI renders
    // before the CPU-bound DTW computation blocks the main thread.
    queueMicrotask(() => runMatching(contour))
  }

  function runMatching(contour: LivePitchContour) {
    const sourceFilter = !includeMelodies()
      ? 'stem'
      : !includeStems()
        ? 'melody'
        : undefined
    let candidates: MatchCandidate[]
    let hummingNormalized: boolean
    try {
      const result = matchPitchContourWithMeta(contour, {
        maxResults: 5,
        sourceFilter,
      })
      candidates = result.candidates
      hummingNormalized = result.hummingNormalized
    } catch (err) {
      console.error('[ShazamListen] match error:', err)
      setErrorMessage(
        'An error occurred while matching. Try singing a shorter phrase.',
      )
      setListenState('error')
      return
    }
    if (candidates.length === 0) {
      setErrorMessage(
        'No matches found. Try singing more clearly or a different melody.',
      )
      setListenState('error')
      return
    }

    // Auto-jump if auto-mode is on and top match meets threshold
    if (autoMode() && candidates[0].confidence >= autoThreshold()) {
      props.onAutoJump?.(candidates[0])
      return
    }

    props.onMatch({ candidates, contour, hummingNormalized })
  }

  function handleCancel() {
    if (speechRecognizer) {
      speechRecognizer.stop()
      speechRecognizer = null
      setSpeechText('')
    }
    stopAll()
    setListenState('idle')
    setErrorMessage('')
    pitchHistory = []
    props.onCancel()
  }

  function handleRetry() {
    setListenState('idle')
    setErrorMessage('')
    pitchHistory = []
    // Auto-start mic so the user can immediately sing again
    void handleStart()
  }

  // ── Canvas animation loop ──────────────────────────────────

  function startAnimationLoop() {
    const tick = () => {
      if (listenState() !== 'listening') return
      drawCanvas()
      setElapsed(buffer?.getElapsed() ?? 0)
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
  }

  // -- Live match preview (runs every ~2.5s during capture) ---

  const LIVE_MATCH_INTERVAL_MS = 2500
  const MIN_FRAMES_FOR_MATCH = 90 // ~1.5s at 60fps

  function startLiveMatching() {
    stopLiveMatching()
    liveMatchIntervalId = setInterval(runLiveMatch, LIVE_MATCH_INTERVAL_MS)
  }

  function stopLiveMatching() {
    if (liveMatchIntervalId !== null) {
      clearInterval(liveMatchIntervalId)
      liveMatchIntervalId = null
    }
  }

  function runLiveMatch() {
    if (listenState() !== 'listening' || !buffer) return

    const frames = buffer.getCurrentFrames()
    if (frames.length < MIN_FRAMES_FOR_MATCH) return

    try {
      const onsets = detectOnsets(frames)
      if (onsets.length < 3) {
        setLiveMatches([])
        return
      }
      const segmented = segmentNotes(frames, onsets)
      const durationSec = frames.length > 0 ? frames[frames.length - 1].time : 0

      const contour: LivePitchContour = {
        frames,
        onsets,
        durationSec,
        noteSequence: segmented.noteSequence,
        ioiSequence: segmented.ioiSequence,
        noteDurations: segmented.noteDurations,
      }

      const sourceFilter = !includeMelodies()
        ? ('stem' as const)
        : !includeStems()
          ? ('melody' as const)
          : undefined

      const result = matchPitchContourWithMeta(contour, {
        maxResults: 3,
        sourceFilter,
      })

      setLiveQueryNotes(contour.noteSequence.length)
      setLiveMatches(
        result.candidates.map((c) => ({
          name: c.name,
          confidence: c.confidence,
          breakdown: {
            pitch: Math.round((c.breakdown?.pitchScore ?? 0) * 100),
            interval: Math.round((c.breakdown?.intervalScore ?? 0) * 100),
            chroma: Math.round((c.breakdown?.chromaScore ?? 0) * 100),
            rhythm: Math.round((c.breakdown?.rhythmScore ?? 0) * 100),
          },
          notes: Math.round((c.breakdown?.lengthBonus ?? 0) * 100),
        })),
      )

      // Auto-jump during live matching if auto-mode is on and threshold is met
      if (
        autoMode() &&
        result.candidates.length > 0 &&
        result.candidates[0].confidence >= autoThreshold()
      ) {
        // Stop capturing immediately and jump
        if (buffer !== null) buffer.cancel()
        stopLiveMatching()
        props.onAutoJump?.(result.candidates[0])
      }
    } catch {
      // Silently ignore matching errors during live preview
    }
  }

  // Note names for canvas label rendering
  const CANVAS_NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

  function drawCanvas() {
    if (!canvasRef || !ctx) return
    const w = canvasRef.getBoundingClientRect().width
    const h = canvasRef.getBoundingClientRect().height
    ctx.clearRect(0, 0, w, h)

    const midiLow = 40
    const midiHigh = 84
    const midiRange = midiHigh - midiLow
    const topPad = 10
    const bottomPad = 10
    const plotH = h - topPad - bottomPad

    // Pitch trace fills 70% of canvas width; the remaining 30% is
    // reserved for the current-note label at the head of the line.
    const traceW = w * 0.7

    const midiToY = (midi: number): number => {
      const clamped = Math.max(midiLow, Math.min(midiHigh, midi))
      return h - bottomPad - ((clamped - midiLow) / midiRange) * plotH
    }

    const toY = (freq: number): number => {
      if (freq <= 0) return h - bottomPad
      const midi = 12 * Math.log2(freq / 440) + 69
      return midiToY(midi)
    }

    // ── Grid lines ──────────────────────────────────────────
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)'
    ctx.lineWidth = 1
    for (let midi = midiLow; midi <= midiHigh; midi++) {
      const y = midiToY(midi)
      const isOctave = midi % 12 === 0
      if (isOctave) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)'
      } else {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)'
      }
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(w, y)
      ctx.stroke()
    }

    // ── Octave labels ───────────────────────────────────────
    ctx.fillStyle = 'rgba(255, 255, 255, 0.25)'
    ctx.font = '10px monospace'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    for (let midi = midiLow - (midiLow % 12); midi <= midiHigh; midi += 12) {
      if (midi < midiLow) continue
      const y = midiToY(midi)
      const octave = Math.floor(midi / 12) - 1
      ctx.fillText(`C${octave}`, 4, y)
    }

    if (pitchHistory.length === 0) return

    // ── Pitch line ──────────────────────────────────────────
    ctx.lineWidth = 2
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'

    const totalFrames = pitchHistory.length
    let prevX = 0
    let prevY = 0
    let prevVoiced = false
    let lastVoicedX = 0
    let lastVoicedY = 0
    let lastVoicedFreq = 0
    for (let i = 0; i < totalFrames; i++) {
      const x = (i / Math.max(1, totalFrames - 1)) * traceW
      const point = pitchHistory[i]
      const isVoiced = point.freq > 0 && point.clarity > 0
      const y = isVoiced ? toY(point.freq) : h - bottomPad

      if (i > 0) {
        ctx.beginPath()
        ctx.moveTo(prevX, prevY)
        ctx.lineTo(x, y)
        if (isVoiced && prevVoiced) {
          const alpha = 0.3 + 0.7 * (i / totalFrames)
          ctx.strokeStyle = `rgba(74, 222, 128, ${alpha.toFixed(2)})`
        } else {
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)'
        }
        ctx.stroke()
      }

      if (isVoiced) {
        lastVoicedX = x
        lastVoicedY = y
        lastVoicedFreq = point.freq
      }

      prevX = x
      prevY = y
      prevVoiced = isVoiced
    }

    // ── Current note label at the head of the pitch line ───
    if (lastVoicedFreq > 0) {
      const midi = Math.round(12 * Math.log2(lastVoicedFreq / 440) + 69)
      const noteIdx = ((midi % 12) + 12) % 12
      const octave = Math.floor(midi / 12) - 1
      const label = `${CANVAS_NOTE_NAMES[noteIdx]}${octave}`

      // Glow dot at the line head
      ctx.beginPath()
      ctx.arc(lastVoicedX, lastVoicedY, 5, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(74, 222, 128, 0.9)'
      ctx.fill()
      ctx.beginPath()
      ctx.arc(lastVoicedX, lastVoicedY, 9, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(74, 222, 128, 0.2)'
      ctx.fill()

      // Note label to the right of the dot
      const labelX = lastVoicedX + 16
      const labelY = lastVoicedY

      // Background pill
      ctx.font = 'bold 16px monospace'
      ctx.textAlign = 'left'
      ctx.textBaseline = 'middle'
      const metrics = ctx.measureText(label)
      const pillW = metrics.width + 14
      const pillH = 24
      const pillX = labelX - 7
      const pillY = labelY - pillH / 2

      ctx.beginPath()
      ctx.roundRect(pillX, pillY, pillW, pillH, 6)
      ctx.fillStyle = 'rgba(0, 0, 0, 0.55)'
      ctx.fill()
      ctx.strokeStyle = 'rgba(74, 222, 128, 0.4)'
      ctx.lineWidth = 1
      ctx.stroke()

      // Text
      ctx.fillStyle = '#4ade80'
      ctx.fillText(label, labelX, labelY)
    }
  }

  // ── Render helpers ─────────────────────────────────────────

  function formatTime(sec: number): string {
    const m = Math.floor(sec / 60)
    const s = Math.floor(sec % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  return (
    <div class={styles.container} data-testid="shazam-listen">
      <div class={styles.headerRow}>
        <h3 class={styles.heading}>Shazam Sing</h3>
        <div class={styles.headerButtons}>
          <Show when={debugEnabled()}>
            <div class={styles.speechControls}>
              <button
                class={styles.speechToggle}
                classList={{ [styles.speechToggleOn!]: speechEnabled() }}
                onClick={toggleSpeech}
                data-testid="shazam-speech-toggle"
              >
                Speech
              </button>
              <Show when={speechEnabled()}>
                <select 
                   class={styles.engineSelect}
                   value={speechEngine()}
                   onChange={(e) => {
                     setSpeechEngine(e.currentTarget.value as 'web' | 'whisper')
                     toggleSpeech(); toggleSpeech(); // toggle off and on to reinit
                   }}
                >
                  <Show when={speechSupported}>
                    <option value="web">Web Speech API</option>
                  </Show>
                  <option value="whisper">Whisper (Offline)</option>
                </select>
                <Show when={speechEngine() === 'whisper' && whisperStatus() !== 'ready'}>
                  <span style={{ "font-size": "10px", "color": "#64748b" }}>{whisperStatus()}</span>
                </Show>
              </Show>
            </div>
            <button
              class={styles.debugToggle}
              classList={{ [styles.debugToggleOn!]: showDebug() }}
              onClick={toggleDebug}
              data-testid="shazam-listen-debug-toggle"
            >
              Debug
            </button>
          </Show>
        </div>
      </div>

      <button
        class={styles.micButton}
        classList={{ [styles.listening!]: listenState() === 'listening' }}
        onClick={() => {
          void handleStart()
        }}
        disabled={listenState() !== 'idle'}
        data-testid="shazam-mic-btn"
        aria-label="Start singing"
      >
        <MicIcon />
      </button>

      <p class={styles.hint}>
        {listenState() === 'listening'
          ? 'Singing...'
          : listenState() === 'processing'
            ? 'Matching your melody...'
            : 'Tap to start singing or humming'}
      </p>

      {/* Auto-mode toggle */}
      <div class={styles.autoMode}>
        <label class={styles.toggle}>
          <input
            type="checkbox"
            checked={autoMode()}
            onChange={(e) => {
              const v = e.currentTarget.checked
              setAutoMode(v)
              localStorage.setItem('pitchperfect_shazam_auto', String(v))
            }}
            data-testid="shazam-auto-toggle"
          />
          <span class={styles.toggleLabel}>Auto-select best match</span>
        </label>
        <Show when={autoMode()}>
          <div class={styles.thresholdRow}>
            <label class={styles.thresholdLabel}>
              Threshold: <strong>{autoThreshold()}%</strong>
            </label>
            <input
              type="range"
              class={styles.thresholdSlider}
              min="60"
              max="98"
              value={autoThreshold()}
              onInput={(e) => {
                const v = parseInt(e.currentTarget.value)
                setAutoThreshold(v)
                localStorage.setItem('pitchperfect_shazam_threshold', String(v))
              }}
              data-testid="shazam-auto-threshold"
            />
          </div>
        </Show>
      </div>

      {/* Source filter toggles */}
      <div class={styles.sourceFilters}>
        <label class={styles.toggle}>
          <input
            type="checkbox"
            checked={includeMelodies()}
            onChange={(e) => {
              const v = e.currentTarget.checked
              setIncludeMelodies(v)
              localStorage.setItem(
                'pitchperfect_shazam_include_melodies',
                String(v),
              )
            }}
            data-testid="shazam-include-melodies"
          />
          <span class={styles.toggleLabel}>Melodies</span>
        </label>
        <label class={styles.toggle}>
          <input
            type="checkbox"
            checked={includeStems()}
            onChange={(e) => {
              const v = e.currentTarget.checked
              setIncludeStems(v)
              localStorage.setItem(
                'pitchperfect_shazam_include_stems',
                String(v),
              )
            }}
            data-testid="shazam-include-stems"
          />
          <span class={styles.toggleLabel}>Stems</span>
        </label>
      </div>

      <canvas
        ref={canvasRef}
        class={styles.canvas}
        data-testid="shazam-canvas"
      />



      <Show when={speechEnabled() && listenState() === 'listening'}>
        <div class={styles.speechBox} data-testid="shazam-speech-text">
          <span class={styles.speechLabel}>
            {speechIsInterim() ? 'Hearing:' : 'Speech:'}
          </span>
          <span
            style={
              speechIsInterim()
                ? { opacity: '0.7', 'font-style': 'italic' }
                : undefined
            }
          >
            {speechText() || 'Listening...'}
          </span>
        </div>
      </Show>

      <Show when={debugEnabled() && showDebug()}>
        <div class={styles.debugPanels}>
          <LivePitchDebug
            latestFrame={latestFrame}
            elapsed={elapsed}
            frameCount={frameCount}
          />
          <FingerprintInspector />
        </div>
        <Show when={liveMatches().length > 0 && listenState() === 'listening'}>
          <div class={styles.liveMatchPanel} data-testid="shazam-live-matches">
            <h4 class={styles.liveMatchHeading}>Live Matches ({liveQueryNotes()} notes detected)</h4>
            <For each={liveMatches()}>
              {(match) => (
                <div>
                  <div class={styles.liveMatchRow}>
                    <span class={styles.liveMatchName}>{match.name}</span>
                    <span class={styles.liveMatchConf}>{match.confidence}%</span>
                  </div>
                  <div class={styles.liveMatchDetail}>
                    P:{match.breakdown.pitch} I:{match.breakdown.interval} C:{match.breakdown.chroma} R:{match.breakdown.rhythm} L:{match.notes}
                  </div>
                </div>
              )}
            </For>
          </div>
        </Show>
      </Show>

      <div class={styles.elapsed} data-testid="shazam-elapsed">
        {formatTime(elapsed())}
      </div>

      <Show when={listenState() === 'processing'}>
        <div class={styles.processingOverlay} data-testid="shazam-processing">
          <div class={styles.spinner} />
          <span>Matching your melody...</span>
        </div>
      </Show>

      <Show when={listenState() === 'error' && errorMessage() !== ''}>
        <p class={styles.error} data-testid="shazam-error">{errorMessage()}</p>
      </Show>

      <div class={styles.controls}>
        <button
          class={styles.stopBtn}
          onClick={handleStop}
          disabled={listenState() !== 'listening'}
          data-testid="shazam-stop-btn"
        >
          Stop & Match
        </button>
        <button
          class={styles.cancelBtn}
          onClick={handleCancel}
          disabled={listenState() === 'processing'}
          data-testid="shazam-cancel"
        >
          Cancel
        </button>
      </div>

      <Show when={listenState() === 'error'}>
        <button class={styles.retryBtn} onClick={handleRetry}
          data-testid="shazam-retry-btn">
          Try Again
        </button>
      </Show>

      <button
        class={styles.uploadLink}
        onClick={() => props.onSwitchToUpload()}
        data-testid="shazam-upload-link"
      >
        Upload audio instead
      </button>
    </div>
  )
}

function MicIcon() {
  return (
    <svg
      width="36"
      height="36"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="22" />
    </svg>
  )
}
