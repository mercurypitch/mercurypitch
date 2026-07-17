// ============================================================
// Glass — the shattering voice mirror (P2: self-voice loop).
//
// Landing → mic (trust copy + silence probe) → calibration glide
// (with one retry, audible siren example) → target announce (the
// glass hums its note) → the rep loop: sing into the live mirror
// (Canvas2D renderer behind the GlassRenderer seam; TypeGPU lands
// in P3) with resonance/fatigue physics → hear your OWN recorded
// take through the FX rack (echo/reverb/hall, cosmic presets) →
// retry — until the glass shatters (burst animation lands in P4)
// or the singer ends the session.
//
// Audio never leaves the device: takes are recorded on-device,
// played back once, then dropped. Hardened mic handling (probe +
// rebuild + generation tokens) is ported from the Voice Mirror.
// ============================================================

import type { Component } from 'solid-js'
import { createEffect, createSignal, For, onCleanup, Show } from 'solid-js'
import type { CardFormat } from '@/features/mirror/card-renderer'
import { cardToPngBlob, copyCardToClipboard, copyOutcomeMessage, datedFilename, shareCard, supportsImageClipboard, } from '@/features/mirror/card-renderer'
import type { DemoSound } from '@/lib/demo-audio'
import { playApproachAndLock, playSirenSweep, playTargetHum, } from '@/lib/demo-audio'
import { formatGlassDelta, loadGlassBaseline, saveGlassBaseline, } from '@/lib/glass/baseline'
import { GLASS_CONFIG } from '@/lib/glass/config'
import { computeShatterTimeline } from '@/lib/glass/fracture'
import type { RepMetrics } from '@/lib/glass/metrics'
import { computeEpicness, computeRepMetrics, lockWindowMeanAbs, } from '@/lib/glass/metrics'
import type { GlassPhysicsState } from '@/lib/glass/resonance'
import { initialPhysics, shatterReady, startRep, tickPhysics, } from '@/lib/glass/resonance'
import type { GlassEvent, GlassSessionState } from '@/lib/glass/session'
import { initialSessionState, reduceSession } from '@/lib/glass/session'
import { computeTarget } from '@/lib/glass/target'
import type { MicError } from '@/lib/mic-manager'
import { listAudioInputs, micManager } from '@/lib/mic-manager'
import { CONF_MIN, hzToCents } from '@/lib/mirror/metrics'
import { midiToNoteNameOctave } from '@/lib/note-utils'
import type { F0Stream, PitchFrame } from '@/lib/pitch-f0-stream'
import { createF0Stream } from '@/lib/pitch-f0-stream'
import { renderShatterCard } from './card-renderer'
import { trackGlass } from './funnel'
import type { FxRack as FxAudio, FxSettings } from './fx-rack'
import { createFxRack, DEFAULT_FX } from './fx-rack'
import { FxRackPanel } from './FxRackPanel'
import { IconGlide, IconReplay, IconShatter } from './icons'
// Type-only: the renderer module (and typegpu behind it) loads lazily at
// Start so the landing ships zero renderer bytes.
import type { GlassRenderer } from './renderer/GlassRenderer'
import { playGlassShatter } from './sfx'
import type { TakeRecorder } from './take-recorder'
import { createTakeRecorder } from './take-recorder'
import type { GlassTake } from './take-strip'
import { computePeaks, TakeStrip } from './take-strip'

const MIC_CONSUMER_ID = 'glass'
// A live mic never reads exactly zero (room noise floors ~1e-3); dead zeros
// mean the capture graph is broken (iOS WebKit) or the mic is OS-muted.
const SILENCE_RMS = 1e-6
// The flow gate. A WRONG device (webcam across the room, a virtual input)
// is usually not dead-zero — it carries faint noise that sails past the
// dead-graph check, so the flow used to start against an inaudible mic
// ("the app cannot hear me" with no explanation). Below this peak level
// during the say-"ahh" probe, stay on the mic panel and offer the picker.
const QUIET_RMS = 0.004
const CAL_BRIEF_SEC = 3
const CAL_PREP_SEC = 2
const REP_BRIEF_SEC = 2

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms))

const round2 = (value: number): number => Math.round(value * 100) / 100

const midiToHz = (midi: number): number => 440 * Math.pow(2, (midi - 69) / 12)

// Raw AGC-off mic RMS is tiny (~0.02-0.12 for honest singing); normalize to
// the house full-scale (0.12, same as the level bars) so gameplay physics
// and visuals run at designed rates on real microphones.
const normLevel = (rms: number): number => Math.min(1, rms / 0.12)

const FX_STORAGE_KEY = 'glass.fx.v1'

function loadFxSettings(): FxSettings {
  try {
    const raw = localStorage.getItem(FX_STORAGE_KEY)
    if (raw === null || raw === '') return { ...DEFAULT_FX }
    const parsed = JSON.parse(raw) as Partial<FxSettings>
    const clampFx = (value: unknown): number =>
      typeof value === 'number' ? Math.max(0, Math.min(100, value)) : 0
    return {
      echo: clampFx(parsed.echo),
      reverb: clampFx(parsed.reverb),
      hall: clampFx(parsed.hall),
    }
  } catch {
    return { ...DEFAULT_FX }
  }
}

function saveFxSettings(settings: FxSettings): void {
  try {
    localStorage.setItem(FX_STORAGE_KEY, JSON.stringify(settings))
  } catch {
    // No storage — the room just resets next visit.
  }
}

// The live monitor's feedback guard: sustained near-clipping input while
// monitoring means the output is feeding the mic (speakers, not headphones).
const RUNAWAY_RMS = 0.32
const RUNAWAY_HOLD_SEC = 0.7

interface LiveReadout {
  offCents: number | null
  resonance: number
  fatigue: number
  lockRun: number
}

const IDLE_READOUT: LiveReadout = {
  offCents: null,
  resonance: 0,
  fatigue: 0,
  lockRun: 0,
}

export const GlassApp: Component = () => {
  const [session, setSession] = createSignal<GlassSessionState>(
    initialSessionState(),
  )
  const [previewOpen, setPreviewOpen] = createSignal(false)
  const [subPhase, setSubPhase] = createSignal<'brief' | 'active'>('brief')
  const [remaining, setRemaining] = createSignal(0)
  const [live, setLive] = createSignal<LiveReadout>(IDLE_READOUT)
  const [micError, setMicError] = createSignal<string | null>(null)
  const [micChecking, setMicChecking] = createSignal(false)
  const [micSilent, setMicSilent] = createSignal(false)
  // Input picker on the mic panel: the browser's default device is often NOT
  // the mic in front of the singer (headsets, interfaces, webcams) — with
  // AGC off a wrong device reads ~0 and looks "broken". Labels exist only
  // after permission, so this populates post-grant.
  const [micDevices, setMicDevices] = createSignal<MediaDeviceInfo[]>([])
  const [activeMicId, setActiveMicId] = createSignal('')
  const [activeMicLabel, setActiveMicLabel] = createSignal('')
  const [calRetry, setCalRetry] = createSignal(false)
  const [fxSettings, setFxSettings] = createSignal<FxSettings>(loadFxSettings())
  const [monitorOn, setMonitorOn] = createSignal(false)
  const [monitorConfirming, setMonitorConfirming] = createSignal(false)
  const [monitorNotice, setMonitorNotice] = createSignal<string | null>(null)
  const [sinceLine, setSinceLine] = createSignal<string | null>(null)
  const [cardFormat, setCardFormat] = createSignal<CardFormat>('square')
  const [shareStatus, setShareStatus] = createSignal<string | null>(null)
  // The glide brief waits on an I'm-ready click so users can read + watch
  // the demo; false once they commit (then a short prep count-in runs).
  const [awaitingReady, setAwaitingReady] = createSignal(false)
  // Reviewable takes (session-only, in-memory — the privacy contract).
  const [takes, setTakes] = createSignal<GlassTake[]>([])
  const [playingTakeId, setPlayingTakeId] = createSignal<number | null>(null)
  const [takeProgress, setTakeProgress] = createSignal(0)

  let audioContext: AudioContext | null = null
  let f0: F0Stream | null = null
  let recorder: TakeRecorder | null = null
  let fxAudio: FxAudio | null = null
  let renderer: GlassRenderer | null = null
  let playbackSource: AudioBufferSourceNode | null = null
  let playbackElement: HTMLAudioElement | null = null
  let playbackUrl: string | null = null
  let monitorSource: MediaStreamAudioSourceNode | null = null
  // Only ONE guided-demo sound plays at a time — a new one (or a take
  // starting) stops the previous, so nothing overlaps or bleeds into the
  // live sing.
  let activeDemo: DemoSound | null = null
  let stageHost: HTMLElement | null = null
  let rendererLoading = false
  let cancelled = false
  // Generation token: each start/reset bumps it, so an orphaned flow dies at
  // its next checkpoint instead of clobbering the new run (mirror pattern).
  let flowGen = 0
  let starting = false
  let readyResolve: (() => void) | null = null
  // Physics persists ACROSS reps within one glass (fatigue is cumulative).
  let physics: GlassPhysicsState = initialPhysics()
  // The burst's seed — the share card reproduces THIS run's exact break.
  let burstSeed = 1
  let cardGeneratedSent = false
  // Take review player — its OWN output context + FX rack so takes stay
  // playable on the results screen after teardownAudio() closed the mic
  // context. Decoded PCM (AudioBuffer) is context-independent.
  let takeIdSeq = 1
  const takeBuffers = new Map<number, AudioBuffer>()
  let takeCtx: AudioContext | null = null
  let takeFx: FxAudio | null = null
  let takeSource: AudioBufferSourceNode | null = null
  let takeRaf = 0

  const dispatch = (event: GlassEvent): GlassSessionState => {
    const next = reduceSession(session(), event)
    setSession(next)
    return next
  }

  onCleanup(() => {
    cancelled = true
    flowGen++
    releaseReadyGate()
    teardownAudio()
    disposeTakes()
    renderer?.dispose()
    renderer = null
  })

  // Any phase/sub-phase transition silences take review — a take must never
  // bleed into a countdown, a live rep or the auto-replay.
  let lastPhase: GlassSessionState['phase'] = 'idle'
  createEffect(() => {
    const current = session().phase
    void subPhase()
    stopTakePlayback()
    // New screen starts at the top — results/gap otherwise inherit the
    // scroll of the tall sing screen and open with the pane above the fold.
    if (current !== lastPhase) {
      lastPhase = current
      window.scrollTo({ top: 0 })
    }
  })

  function releaseReadyGate(): void {
    readyResolve?.()
    readyResolve = null
  }

  function stopPlaybackAudio(): void {
    try {
      playbackSource?.stop()
    } catch {
      // Already stopped/never started — fine.
    }
    playbackSource?.disconnect()
    playbackSource = null
    playbackElement?.pause()
    playbackElement = null
    if (playbackUrl !== null) {
      URL.revokeObjectURL(playbackUrl)
      playbackUrl = null
    }
  }

  function disableMonitor(notice: string | null = null): void {
    monitorSource?.disconnect()
    monitorSource = null
    if (monitorOn()) {
      setMonitorOn(false)
      trackGlass('glass_monitor_off')
    }
    setMonitorConfirming(false)
    setMonitorNotice(notice)
  }

  // Silence the live monitor DURING playback (you're listening to your take,
  // not singing) without forgetting the preference; resumed for the next sing.
  function pauseMonitor(): void {
    monitorSource?.disconnect()
  }

  function resumeMonitor(): void {
    if (monitorOn() && monitorSource !== null && fxAudio !== null) {
      monitorSource.connect(fxAudio.wetInput)
    }
  }

  // ── take review player ──────────────────────────────────────

  /** Register a finished rep's recording and decode its waveform. */
  async function addTake(
    rep: number,
    blob: Blob,
    shattered: boolean,
  ): Promise<void> {
    const id = takeIdSeq++
    setTakes((prev) => [
      ...prev,
      { id, rep, blob, durationSec: 0, peaks: null, shattered },
    ])
    // Decode NOW, while the session context is alive — the PCM buffer
    // outlives the context, so results-screen review needs no mic revival.
    if (audioContext === null) return
    try {
      const buffer = await audioContext.decodeAudioData(await blob.arrayBuffer())
      takeBuffers.set(id, buffer)
      setTakes((prev) =>
        prev.map((t) =>
          t.id === id
            ? { ...t, durationSec: buffer.duration, peaks: computePeaks(buffer) }
            : t,
        ),
      )
    } catch {
      // Decode failed — the card stays (placeholder wave); playback will
      // retry the decode on tap via the player's own context.
    }
  }

  /** The player's output graph, created lazily on the first tap. */
  function ensureTakeAudio(): { ctx: AudioContext; fx: FxAudio } {
    if (takeCtx === null || takeCtx.state === 'closed') {
      takeCtx = new AudioContext()
      takeFx = createFxRack(takeCtx)
    }
    takeFx?.setSettings(fxSettings())
    void takeCtx.resume().catch(() => undefined)
    return { ctx: takeCtx, fx: takeFx as FxAudio }
  }

  function stopTakePlayback(): void {
    cancelAnimationFrame(takeRaf)
    const source = takeSource
    takeSource = null
    if (source !== null) {
      try {
        source.stop()
      } catch {
        // Already stopped/never started — fine.
      }
      source.disconnect()
    }
    setPlayingTakeId(null)
    setTakeProgress(0)
  }

  function startTakeSource(id: number, buffer: AudioBuffer): void {
    const { ctx, fx } = ensureTakeAudio()
    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.connect(fx.input)
    const startedAt = ctx.currentTime
    source.onended = () => {
      if (takeSource === source) stopTakePlayback()
    }
    source.start()
    takeSource = source
    setPlayingTakeId(id)
    setTakeProgress(0)
    const tick = (): void => {
      if (takeSource !== source) return
      setTakeProgress(Math.min(1, (ctx.currentTime - startedAt) / buffer.duration))
      takeRaf = requestAnimationFrame(tick)
    }
    takeRaf = requestAnimationFrame(tick)
  }

  /** Tap a take card: play it through the FX rack, or pause if playing. */
  function toggleTake(id: number): void {
    if (playingTakeId() === id) {
      stopTakePlayback()
      return
    }
    // ONE sound at a time (the overlap rule): a take starting silences the
    // demo, the live monitor and the rep auto-replay's audio.
    stopTakePlayback()
    stopDemo()
    pauseMonitor()
    stopPlaybackAudio()
    const take = takes().find((t) => t.id === id)
    if (take === undefined) return
    const cached = takeBuffers.get(id)
    if (cached !== undefined) {
      startTakeSource(id, cached)
      return
    }
    // In-session decode failed (or never ran) — retry on this tap.
    const { ctx } = ensureTakeAudio()
    void take.blob
      .arrayBuffer()
      .then((bytes) => ctx.decodeAudioData(bytes))
      // playingTakeId() below is a resolution-time guard (don't autoplay if
      // something else started meanwhile), not a subscription.
      // eslint-disable-next-line solid/reactivity
      .then((buffer) => {
        takeBuffers.set(id, buffer)
        setTakes((prev) =>
          prev.map((t) =>
            t.id === id
              ? {
                  ...t,
                  durationSec: buffer.duration,
                  peaks: computePeaks(buffer),
                }
              : t,
          ),
        )
        if (playingTakeId() === null) startTakeSource(id, buffer)
      })
      .catch(() => undefined)
  }

  /** Drop a take's audio; metrics and the on-device delta are untouched. */
  function removeTake(id: number): void {
    if (playingTakeId() === id) stopTakePlayback()
    takeBuffers.delete(id)
    setTakes((prev) => prev.filter((t) => t.id !== id))
  }

  function disposeTakes(): void {
    stopTakePlayback()
    takeBuffers.clear()
    setTakes([])
    takeIdSeq = 1
    takeFx?.dispose()
    takeFx = null
    void takeCtx?.close().catch(() => undefined)
    takeCtx = null
  }

  function enableMonitor(): void {
    const stream = micManager.getStream()
    if (audioContext === null || fxAudio === null || stream === null) return
    monitorSource?.disconnect()
    // Wet-only: in headphones you already hear yourself — the monitor adds
    // the room, never a dry copy (and never touches the analysis path).
    monitorSource = audioContext.createMediaStreamSource(stream)
    monitorSource.connect(fxAudio.wetInput)
    setMonitorOn(true)
    setMonitorConfirming(false)
    setMonitorNotice(null)
    trackGlass('glass_monitor_on')
  }

  function playDemo(next: DemoSound): void {
    activeDemo?.stop()
    activeDemo = next
  }

  function stopDemo(): void {
    activeDemo?.stop()
    activeDemo = null
  }

  function teardownAudio(): void {
    stopDemo()
    stopPlaybackAudio()
    disableMonitor()
    recorder?.dispose()
    recorder = null
    fxAudio?.dispose()
    fxAudio = null
    f0?.dispose()
    f0 = null
    micManager.release(MIC_CONSUMER_ID)
    void audioContext?.close().catch(() => undefined)
    audioContext = null
  }

  function resetAll(): void {
    teardownAudio()
    disposeTakes() // a new session is a new glass — old takes go with it
    flowGen++
    releaseReadyGate()
    starting = false
    physics = initialPhysics()
    stopDemo()
    // A new session is a NEW glass — fresh pane, no inherited cracks.
    renderer?.dispose()
    renderer = null
    stageHost = null
    setSession(initialSessionState())
    setPreviewOpen(false)
    setSubPhase('brief')
    setRemaining(0)
    setLive(IDLE_READOUT)
    setMicError(null)
    setMicChecking(false)
    setMicSilent(false)
    setCalRetry(false)
    setMonitorNotice(null)
    setSinceLine(null)
    setShareStatus(null)
    setAwaitingReady(false)
    burstSeed = 1
    cardGeneratedSent = false
  }

  /** Mount point shared by the calibrate/sing/playback stages — the renderer
   *  survives phase changes (cracks persist per glass) and moves its canvas.
   *  A GPU failure AT MOUNT (iOS null webgpu context) swaps to the lite
   *  backend in place. */
  function mountStage(host: HTMLElement): void {
    stageHost = host
    if (renderer === null) return
    try {
      renderer.mount(host)
    } catch (err) {
      console.warn('[glass] GPU mount failed — Canvas2D fallback:', err)
      renderer.dispose()
      renderer = null
      void initRenderer({ forceCanvas: true })
    }
  }

  /** Load the renderer stack (lazy chunk; TypeGPU → Canvas2D fallback). */
  async function initRenderer(options?: {
    forceCanvas?: boolean
  }): Promise<void> {
    if (renderer !== null || rendererLoading) return
    rendererLoading = true
    try {
      const { createGlassRenderer } = await import('./renderer/GlassRenderer')
      const created = await createGlassRenderer(options)
      if (cancelled) {
        created.dispose()
        return
      }
      renderer = created
      console.info('[glass] renderer backend:', created.backend)
      if (stageHost !== null) mountStage(stageHost)
    } catch (err) {
      console.warn('[glass] renderer init failed:', err)
    } finally {
      rendererLoading = false
    }
  }

  const rendererMetric = (): number => (renderer?.backend === 'typegpu' ? 1 : 0)

  function applyFxSettings(settings: FxSettings): void {
    setFxSettings(settings)
    fxAudio?.setSettings(settings)
    // The take player mirrors the rack live — sliders stay tweakable while
    // a take replays (one audio path per the design interview).
    takeFx?.setSettings(settings)
  }

  function commitFxSettings(settings: FxSettings): void {
    saveFxSettings(settings)
    trackGlass('glass_fx_change', {
      echo: settings.echo,
      reverb: settings.reverb,
      hall: settings.hall,
    })
  }

  /** Countdown driving `remaining`; aborts when the flow generation moves. */
  async function countdown(seconds: number): Promise<void> {
    const gen = flowGen
    const start = performance.now()
    setRemaining(seconds)
    while (!cancelled && gen === flowGen) {
      const left = seconds - (performance.now() - start) / 1000
      if (left <= 0) break
      setRemaining(left)
      await sleep(100)
    }
    setRemaining(0)
  }

  /** Highest input level over a short probe window. */
  async function probeLevel(ms: number): Promise<number> {
    if (!f0) return 0
    f0.startTask()
    await sleep(ms)
    f0.takeFrames()
    return f0?.maxLevel() ?? 0
  }

  /**
   * Rebuild the audio graph with a fresh AudioContext created AFTER capture
   * is live — the iOS WebKit silent-graph fix (see MirrorApp.rebuildAudio).
   */
  async function rebuildAudio(): Promise<void> {
    const stream = micManager.getStream()
    stopPlaybackAudio()
    disableMonitor()
    fxAudio?.dispose()
    fxAudio = null
    f0?.dispose()
    f0 = null
    await audioContext?.close().catch(() => undefined)
    audioContext = new AudioContext()
    if (audioContext.state === 'suspended') {
      await audioContext.resume().catch(() => undefined)
    }
    if (stream) f0 = createF0Stream(audioContext, stream)
    fxAudio = createFxRack(audioContext)
    fxAudio.setSettings(fxSettings())
  }

  /** Quiet check with one automatic graph rebuild for dead-zero inputs. */
  async function probeMic(): Promise<boolean> {
    setMicChecking(true)
    try {
      const level = await probeLevel(900)
      if (level > QUIET_RMS) return true
      // Dead zero = broken graph (iOS WebKit) — rebuild before re-probing.
      // Merely quiet = likely the wrong device; the retry gives the singer
      // one more beat to speak up before the panel offers the picker.
      if (level <= SILENCE_RMS) await rebuildAudio()
      return (await probeLevel(900)) > QUIET_RMS
    } finally {
      setMicChecking(false)
    }
  }

  /** Refresh the input list + the label of the device actually capturing. */
  async function refreshMicDevices(): Promise<void> {
    try {
      const track = micManager.getStream()?.getAudioTracks()[0]
      setActiveMicLabel(track?.label ?? '')
      setActiveMicId(track?.getSettings().deviceId ?? '')
      setMicDevices(await listAudioInputs())
    } catch {
      // Enumeration unavailable — the picker simply doesn't render.
    }
  }

  /**
   * Capture from a different input. The wrong-default-mic fix: preview/new
   * origins reset the browser's device choice, and with AGC off a distant
   * or virtual device probes ~0 ("the app cannot hear me").
   */
  async function switchMicDevice(deviceId: string): Promise<void> {
    if (starting || micChecking()) return
    setMicSilent(false)
    setMicChecking(true)
    try {
      await micManager.setPreferredDevice(deviceId === '' ? null : deviceId)
      // setPreferredDevice drops the open handle; re-acquire opens the new
      // device, then the graph + recorder re-wire onto the fresh stream.
      const stream = await micManager.acquire(MIC_CONSUMER_ID)
      recorder?.dispose()
      recorder = createTakeRecorder(stream)
      await rebuildAudio()
      await refreshMicDevices()
      setMicError(null)
    } catch (err) {
      const message = (err as MicError | null)?.message
      setMicError(
        message !== undefined && message !== ''
          ? message
          : 'Could not open that microphone.',
      )
      return
    } finally {
      setMicChecking(false)
    }
    if (!(await probeMic())) setMicSilent(true)
  }

  function beginFlow(): void {
    if (starting || micChecking()) return
    setMicSilent(false)
    dispatch({ type: 'mic-granted' })
    void runFlow()
  }

  async function retryMicCheck(): Promise<void> {
    if (starting || micChecking()) return
    setMicChecking(true)
    try {
      await rebuildAudio()
    } finally {
      setMicChecking(false)
    }
    if (await probeMic()) beginFlow()
  }

  /** Mic + AudioContext are created inside this tap handler (iOS Safari). */
  async function start(): Promise<void> {
    if (starting) return
    starting = true
    dispatch({ type: 'start' })
    // Kick the renderer chunk (TypeGPU when available) in parallel with the
    // mic acquisition — both ride the same user gesture.
    void initRenderer()
    try {
      audioContext = new AudioContext()
      if (audioContext.state === 'suspended') await audioContext.resume()
      const stream = await micManager.acquire(MIC_CONSUMER_ID)
      f0 = createF0Stream(audioContext, stream)
      // On-device take recording (progressive enhancement, plan §8) and the
      // FX rack the playback + monitor route through.
      recorder = createTakeRecorder(stream)
      fxAudio = createFxRack(audioContext)
      fxAudio.setSettings(fxSettings())
      trackGlass('glass_mic_granted')
      setMicError(null)
      void refreshMicDevices()
      starting = false
      if (await probeMic()) {
        beginFlow()
      } else {
        setMicSilent(true)
      }
    } catch (err) {
      starting = false
      // Without this every denied attempt leaks an AudioContext and the
      // hardware-context cap eventually blocks 'Try again'.
      teardownAudio()
      trackGlass('glass_mic_denied')
      const message = (err as MicError | null)?.message
      setMicError(
        message !== undefined && message !== ''
          ? message
          : 'Microphone access was denied. Allow mic access to continue.',
      )
      dispatch({ type: 'mic-denied' })
    }
  }

  /** Calibration take: frames only, no physics — the mirror wakes up and
   *  dances to whatever is sung (no target yet). */
  async function recordCalibration(seconds: number): Promise<PitchFrame[]> {
    if (!f0) return []
    const gen = flowGen
    setSubPhase('active')
    stopDemo()
    f0.startTask()
    renderer?.beginTake()
    const start = performance.now()
    while (!cancelled && gen === flowGen) {
      const elapsed = (performance.now() - start) / 1000
      const left = seconds - elapsed
      setRemaining(Math.max(0, left))
      const frame = f0.latestSmoothed()
      const voiced = frame !== null && frame.f0 > 0 && frame.conf >= CONF_MIN
      renderer?.update({
        mode: 'calibrate',
        offCents: voiced ? hzToCents(frame.f0) : null,
        level: normLevel(f0.latestLevel()),
        resonance: 0,
        fatigue: physics.fatigue,
        crackStep: physics.crackStep,
        targetLabel: '',
      })
      if (left <= 0) break
      await sleep(30)
    }
    setRemaining(0)
    if (cancelled || gen !== flowGen) return []
    return f0?.takeFrames() ?? []
  }

  interface RepResult {
    frames: PitchFrame[]
    shattered: boolean
    peakResonance: number
    /** The rep's recorded voice (null: unsupported/failed/shattered). */
    takeBlob: Blob | null
  }

  /**
   * A rep take with the physics ticking live: resonance/fatigue update every
   * ~30 ms from the freshest frame, and the take ends EARLY the moment the
   * shatter condition is met.
   */
  async function recordRep(seconds: number): Promise<RepResult> {
    const target = session().targetMidi
    if (!f0 || target === null)
      return { frames: [], shattered: false, peakResonance: 0, takeBlob: null }
    const gen = flowGen
    setSubPhase('active')
    stopDemo()
    resumeMonitor()
    f0.startTask()
    recorder?.start()
    renderer?.beginTake()
    const start = performance.now()
    let lastTick = start
    let peak = 0
    let runawaySec = 0
    while (!cancelled && gen === flowGen) {
      const now = performance.now()
      const elapsed = (now - start) / 1000
      const left = seconds - elapsed
      setRemaining(Math.max(0, left))
      const dt = Math.min(0.1, (now - lastTick) / 1000)
      lastTick = now
      const frame = f0.latestSmoothed()
      const voiced =
        frame !== null &&
        frame.f0 > 0 &&
        frame.conf >= CONF_MIN &&
        elapsed > 0.1
      const offCents = voiced ? hzToCents(frame.f0) - target * 100 : null
      const rawRms = f0.latestLevel()
      const level = normLevel(rawRms)
      physics = tickPhysics(physics, { offCents, level, dt })
      peak = Math.max(peak, physics.resonance)
      setLive({
        offCents,
        resonance: physics.resonance,
        fatigue: physics.fatigue,
        lockRun: physics.lockRun,
      })
      renderer?.update({
        mode: 'live',
        offCents,
        level,
        resonance: physics.resonance,
        fatigue: physics.fatigue,
        crackStep: physics.crackStep,
        targetLabel: targetLabel(),
      })
      // Feedback guard: sustained near-clipping input while monitoring means
      // speakers are looping into the mic — kill the monitor and say why.
      if (monitorOn()) {
        runawaySec = rawRms > RUNAWAY_RMS ? runawaySec + dt : 0
        if (runawaySec > RUNAWAY_HOLD_SEC) {
          disableMonitor(
            'That was starting to feed back, so live monitoring turned itself off. Headphones fix it.',
          )
        }
      }
      if (shatterReady(physics)) {
        // No playback BEAT after the burst (the burst is the payoff), but
        // the winning take is kept for the review strip — with the wait
        // capped so a slow MediaRecorder can never delay the shatter.
        const winningBlob =
          recorder === null
            ? null
            : await Promise.race([
                recorder.stop(),
                sleep(400).then(() => null),
              ])
        return {
          frames: f0.takeFrames(),
          shattered: true,
          peakResonance: peak,
          takeBlob: winningBlob,
        }
      }
      if (left <= 0) break
      await sleep(30)
    }
    if (cancelled || gen !== flowGen) {
      recorder?.discard()
      return {
        frames: [],
        shattered: false,
        peakResonance: peak,
        takeBlob: null,
      }
    }
    const frames = f0?.takeFrames() ?? []
    const takeBlob = (await recorder?.stop()) ?? null
    return { frames, shattered: false, peakResonance: peak, takeBlob }
  }

  /**
   * The listen-back beat: the singer's REAL recorded voice plays through the
   * FX rack (echo/reverb/hall — the recorded blob itself stays dry) while
   * the mirror re-dances to the recorded frames in gold. Falls back to the
   * silent contour replay when recording is unsupported or decode fails.
   */
  async function playbackPhase(
    frames: PitchFrame[],
    takeBlob: Blob | null,
  ): Promise<void> {
    const target = session().targetMidi ?? 0
    const gen = flowGen
    const duration = Math.min(
      frames.length > 0 ? frames[frames.length - 1].t : 0,
      GLASS_CONFIG.reps.playbackMaxSeconds,
    )

    // Start the voice — decode path first (sample-accurate, FX-routed),
    // <audio> element through the rack as the Safari-webm fallback.
    pauseMonitor()
    stopPlaybackAudio()
    if (takeBlob !== null && audioContext !== null && fxAudio !== null) {
      try {
        const buffer = await audioContext.decodeAudioData(
          await takeBlob.arrayBuffer(),
        )
        if (cancelled || gen !== flowGen) return
        const source = audioContext.createBufferSource()
        source.buffer = buffer
        source.connect(fxAudio.input)
        source.start(0, 0, duration)
        playbackSource = source
        console.info('[glass] take playback', `${duration.toFixed(1)}s`)
      } catch {
        try {
          playbackUrl = URL.createObjectURL(takeBlob)
          playbackElement = new Audio(playbackUrl)
          const elementSource =
            audioContext.createMediaElementSource(playbackElement)
          elementSource.connect(fxAudio.input)
          void playbackElement.play().catch(() => undefined)
          console.info('[glass] take playback (element fallback)')
        } catch {
          stopPlaybackAudio() // silent contour replay only
        }
      }
    }

    renderer?.beginTake()
    const start = performance.now()
    let index = 0
    while (!cancelled && gen === flowGen) {
      const elapsed = (performance.now() - start) / 1000
      if (elapsed >= duration) break
      setRemaining(Math.max(0, duration - elapsed))
      while (index < frames.length - 1 && frames[index].t < elapsed) index++
      const frame = frames[index]
      const voiced =
        frame !== undefined && frame.f0 > 0 && frame.conf >= CONF_MIN
      const offCents = voiced ? hzToCents(frame.f0) - target * 100 : null
      setLive((prev) => ({ ...prev, offCents }))
      renderer?.update({
        mode: 'playback',
        offCents,
        level: normLevel(frame?.rms ?? 0),
        resonance: 0,
        fatigue: physics.fatigue,
        crackStep: physics.crackStep,
        targetLabel: targetLabel(),
      })
      await sleep(30)
    }
    stopPlaybackAudio() // the blob is dropped with its take — never persisted
    setRemaining(0)
  }

  function readyGate(gen: number): Promise<void> {
    if (cancelled || gen !== flowGen) return Promise.resolve()
    return new Promise<void>((resolve) => {
      readyResolve = resolve
    })
  }

  async function runFlow(): Promise<void> {
    const gen = ++flowGen
    const alive = (): boolean => !cancelled && gen === flowGen
    physics = initialPhysics()
    setLive(IDLE_READOUT)

    // Calibration, with one reducer-driven retry. The brief PLAYS the siren
    // example (decision 18) — hear what to do, don't just read it.
    while (alive() && session().phase === 'calibrate') {
      setSubPhase('brief')
      setAwaitingReady(true)
      if (audioContext !== null) playDemo(playSirenSweep(audioContext))
      // Wait for the singer to read the instruction + watch the glide demo,
      // then commit with "I'm ready".
      await readyGate(gen)
      if (!alive()) return
      setAwaitingReady(false)
      // A short breath before the glide records — replay the siren so it's
      // fresh right as they start.
      if (audioContext !== null) playDemo(playSirenSweep(audioContext))
      await countdown(CAL_PREP_SEC)
      if (!alive()) return
      const frames = await recordCalibration(
        GLASS_CONFIG.calibration.glideSeconds,
      )
      if (!alive()) return
      const cal = computeTarget(frames)
      const next = dispatch({
        type: 'calibrate-done',
        ok: cal.ok,
        ceilingMidi: cal.ceilingMidi,
        targetMidi: cal.targetMidi,
        fallbackTargetMidi: cal.fallbackTargetMidi,
      })
      if (next.phase === 'calibrate') setCalRetry(true)
    }
    if (!alive()) return
    const announced = session()
    if (announced.phase === 'calibrate-failed') {
      teardownAudio()
      return
    }
    if (announced.phase !== 'announce') return
    trackGlass('glass_calibrate_done', {
      ceilingMidi: announced.ceilingMidi,
      targetMidi: announced.targetMidi,
      usedFallback: announced.usedFallback ? 1 : 0,
      renderer: rendererMetric(),
    })

    // "This glass rings at G4 — your G4." The pane HUMS its note while the
    // announce shows it; waits for the I'm-ready tap.
    if (audioContext !== null && announced.targetMidi !== null) {
      playDemo(playTargetHum(audioContext, midiToHz(announced.targetMidi)))
    }
    await readyGate(gen)
    if (!alive()) return
    dispatch({ type: 'announce-done' })

    // The rep loop — runs until the glass gives way or the singer ends it.
    while (alive() && session().phase === 'sing') {
      const rep = session().rep
      physics = startRep(physics)
      setSubPhase('brief')
      // Before the first rep: an audible sketch of the win — wander, settle
      // on the target, bloom (decision 18).
      if (rep === 1 && audioContext !== null && session().targetMidi !== null) {
        playDemo(
          playApproachAndLock(
            audioContext,
            midiToHz(session().targetMidi ?? 69),
          ),
        )
      }
      await countdown(rep === 1 ? CAL_BRIEF_SEC : REP_BRIEF_SEC)
      if (!alive()) return
      const take = await recordRep(GLASS_CONFIG.reps.singSeconds)
      if (!alive()) return
      const target = session().targetMidi ?? 0
      const metrics = computeRepMetrics(
        take.frames,
        target,
        rep,
        take.peakResonance,
      )
      if (take.shattered) {
        // The drama is earned (§17.3): epicness from the winning lock's
        // cleanliness, the rep it took, and how much fatigue helped.
        const lockMean = lockWindowMeanAbs(take.frames, target)
        const epicness = computeEpicness({
          shatterRep: rep,
          fatigue: physics.fatigue,
          lockMeanAbsCents: lockMean,
        })
        const reduceMotion = window.matchMedia(
          '(prefers-reduced-motion: reduce)',
        ).matches
        const timeline = computeShatterTimeline(epicness, GLASS_CONFIG, {
          reduceMotion,
        })
        const seed = rep * 7919 + target * 131
        burstSeed = seed
        // Snapshot + burst BEFORE the panel swap so the pane's final frame
        // (ribbon at the lock) is what fractures.
        renderer?.shatter({ epicness, seed })
        if (audioContext !== null) playGlassShatter(audioContext, epicness)
        if (take.takeBlob !== null) void addTake(rep, take.takeBlob, true)
        dispatch({ type: 'shattered', metrics })
        trackGlass('glass_shatter', {
          rep,
          fatigue: round2(physics.fatigue),
          epicness: round2(epicness),
        })
        await sleep(timeline.totalSeconds * 1000)
        if (!alive()) return
        dispatch({ type: 'shatter-done' })
        finishRun()
        return
      }
      dispatch({ type: 'sing-done', metrics })
      trackGlass('glass_rep_done', {
        rep,
        meanAbsCents:
          metrics.meanAbsCents === null
            ? null
            : Math.round(metrics.meanAbsCents),
        bestLockMs: Math.round(metrics.bestLockSec * 1000),
        inBandPct: round2(metrics.inBandPct),
      })
      if (take.takeBlob !== null) void addTake(rep, take.takeBlob, false)
      await playbackPhase(take.frames, take.takeBlob)
      if (!alive()) return
      dispatch({ type: 'playback-done' })
      trackGlass('glass_playback_done')
      // Clean pane for the rest screen (drop the frozen playback trail).
      renderer?.beginTake()
      // No auto-advance: the singer reviews takes / plays with the room and
      // commits to the next rep with a tap. This is also the natural stop
      // for a silent input — no more infinite reps against a dead mic.
      await readyGate(gen)
      if (!alive()) return
      dispatch({ type: 'gap-done' })
    }
  }

  function finishRun(): void {
    teardownAudio()
    const state = session()
    const last = state.repMetrics[state.repMetrics.length - 1]

    // Cross-visit baseline: honest "since last time" delta, then replace.
    if (state.targetMidi !== null) {
      try {
        const storage = window.localStorage
        const current = {
          targetMidi: state.targetMidi,
          shatterRep: state.shatterRep ?? 0,
          bestLockMs:
            last === undefined ? 0 : Math.round(last.bestLockSec * 1000),
          precisionCents:
            last?.meanAbsCents == null ? null : Math.round(last.meanAbsCents),
        }
        const previous = loadGlassBaseline(storage)
        setSinceLine(
          previous === null ? null : formatGlassDelta(previous, current),
        )
        saveGlassBaseline(storage, current)
      } catch {
        // Storage blocked — no delta, nothing else changes.
      }
    }

    trackGlass('glass_results_view', {
      ceilingMidi: state.ceilingMidi,
      targetMidi: state.targetMidi,
      shatterRep: state.shatterRep ?? 0,
      reps: state.repMetrics.length,
      bestLockMs:
        last === undefined ? null : Math.round(last.bestLockSec * 1000),
      precisionCents:
        last?.meanAbsCents == null ? null : Math.round(last.meanAbsCents),
      fatigue: round2(physics.fatigue),
      renderer: rendererMetric(),
    })

    // The results live ON the glass now — the shattered (or cracked-but-
    // standing) pane stays mounted under the results overlay, so the
    // renderer is intentionally kept alive here. resetAll()/onCleanup still
    // dispose it (a new session is a new glass). Clear any frozen ribbon
    // trail (a no-op for the shard burst — that runs its own state).
    renderer?.beginTake()
  }

  /** The singer bails mid-loop: orphan the flow, honest results. */
  function endSession(): void {
    flowGen++
    releaseReadyGate()
    teardownAudio()
    dispatch({ type: 'end-session' })
    finishRun()
  }

  /** The artifact's live coaching line — precise, encouraging, never shaming. */
  const liveCoach = (): string => {
    const off = live().offCents
    if (off === null) return 'Take a breath — the glass is listening.'
    if (Math.abs(off) <= GLASS_CONFIG.target.tolCents) {
      return live().resonance > 0.55
        ? 'Locked. Keep pouring into it.'
        : 'There — hold it steady.'
    }
    if (Math.abs(off) > 140) {
      return off < 0
        ? 'Slide up to the gold line.'
        : 'Come down to the gold line.'
    }
    return `You're ${Math.abs(Math.round(off))}¢ ${off < 0 ? 'flat' : 'sharp'} — ease ${off < 0 ? 'up' : 'off'}.`
  }

  // The coach feeds off a ~30 Hz loop; throttle the visible text so the
  // heading never strobes between phrasings at pitch boundaries. Layout
  // safety is CSS's job (.glass-coach is a fixed-height single line).
  const [coachLine, setCoachLine] = createSignal('Sing to the glass')
  let coachChangedAt = 0
  createEffect(() => {
    const line = liveCoach()
    const now = performance.now()
    if (line !== coachLine() && now - coachChangedAt >= 400) {
      coachChangedAt = now
      setCoachLine(line)
    }
  })

  const targetLabel = (): string => {
    const midi = session().targetMidi
    return midi === null ? '—' : midiToNoteNameOctave(midi)
  }

  const phase = (): GlassSessionState['phase'] => session().phase

  function buildShatterCard(): HTMLCanvasElement | null {
    const state = session()
    if (state.targetMidi === null) return null
    const last = state.repMetrics[state.repMetrics.length - 1]
    return renderShatterCard(
      {
        targetLabel: midiToNoteNameOctave(state.targetMidi),
        shatterRep: state.shatterRep,
        reps: state.repMetrics.length,
        bestLockSec: last?.bestLockSec ?? 0,
        precisionCents:
          last?.meanAbsCents == null ? null : Math.round(last.meanAbsCents),
        peakResonance: last?.peakResonance ?? 0,
        sinceLine: sinceLine(),
        seed: burstSeed,
      },
      cardFormat(),
    )
  }

  function markCardGenerated(): void {
    if (cardGeneratedSent) return
    cardGeneratedSent = true
    trackGlass('glass_card_generated')
  }

  async function onShareCard(): Promise<void> {
    const card = buildShatterCard()
    if (card === null) return
    markCardGenerated()
    const shattered = session().shatterRep !== null
    const outcome = await shareCard(
      await cardToPngBlob(card),
      datedFilename(shattered ? 'glass-shattered' : 'glass-held'),
      {
        title: 'Break glass with your voice',
        text: shattered
          ? 'I shattered it — mercurypitch.com/glass'
          : 'The glass is still standing… for now — mercurypitch.com/glass',
      },
    )
    trackGlass('glass_card_shared')
    setShareStatus(
      outcome === 'shared' ? 'Shared!' : 'Saved — post it anywhere.',
    )
  }

  async function onCopyCard(): Promise<void> {
    const card = buildShatterCard()
    if (card === null) return
    markCardGenerated()
    const outcome = await copyCardToClipboard(cardToPngBlob(card))
    if (outcome === 'copied') trackGlass('glass_card_shared')
    setShareStatus(copyOutcomeMessage(outcome))
  }

  return (
    <div class="glass-shell">
      <div class="glass-cosmos" aria-hidden="true" />

      <main class="glass-main">
        <Show when={phase() === 'idle' && !previewOpen()}>
          <Landing
            onStart={() => void start()}
            onHowItWorks={() => setPreviewOpen(true)}
          />
        </Show>

        <Show when={phase() === 'idle' && previewOpen()}>
          <HowItWillWork
            onStart={() => {
              setPreviewOpen(false)
              void start()
            }}
            onBack={() => setPreviewOpen(false)}
          />
        </Show>

        <Show when={phase() === 'mic' || phase() === 'mic-denied'}>
          <MicPanel
            error={micError()}
            checking={micChecking()}
            silent={micSilent()}
            level={() => f0?.latestLevel() ?? 0}
            devices={micDevices()}
            activeId={activeMicId()}
            activeLabel={activeMicLabel()}
            onSelectDevice={(id) => void switchMicDevice(id)}
            onRetry={() => void start()}
            onTestAgain={() => void retryMicCheck()}
            onContinueAnyway={() => beginFlow()}
            onStartOver={() => resetAll()}
          />
        </Show>

        <Show when={phase() === 'calibrate'}>
          <section class="glass-panel glass-panel-wide glass-panel-clear">
            <h2>Find your ceiling</h2>
            <p>
              Slide low to high, like the siren — the glass tunes itself to
              you.
            </p>
            <Show when={calRetry()}>
              <p class="glass-dim">
                We could not hear enough of a glide — one more try, a little
                longer and louder.
              </p>
            </Show>
            <Show
              when={subPhase() === 'active'}
              fallback={
                <div class="glass-glide-brief">
                  <GlideDemo />
                  <Show
                    when={awaitingReady()}
                    fallback={
                      <div class="glass-countdown glass-countdown-sm">
                        {Math.ceil(remaining())}
                      </div>
                    }
                  >
                    <button
                      class="glass-cta"
                      ref={(el) => {
                        requestAnimationFrame(() =>
                          el.focus({ preventScroll: true }),
                        )
                      }}
                      onClick={() => {
                        setAwaitingReady(false)
                        releaseReadyGate()
                      }}
                    >
                      I'm ready
                    </button>
                  </Show>
                </div>
              }
            >
              <div class="glass-stage" ref={(el) => mountStage(el)} />
              <LiveNote latest={() => f0?.latest() ?? null} />
              <LevelBar level={() => f0?.latestLevel() ?? 0} />
              <TimeBar
                remaining={remaining()}
                total={GLASS_CONFIG.calibration.glideSeconds}
              />
            </Show>
          </section>
        </Show>

        <Show when={phase() === 'calibrate-failed'}>
          <section class="glass-panel">
            <h2>We couldn't hear enough</h2>
            <p class="glass-dim">
              A quieter room — or singing a little louder — usually fixes it.
            </p>
            <div class="glass-actions">
              <button class="glass-cta" onClick={() => resetAll()}>
                Start over
              </button>
            </div>
          </section>
        </Show>

        <Show when={phase() === 'announce'}>
          <section class="glass-panel">
            <p class="glass-dim glass-announce-eyebrow">
              <Show when={session().usedFallback}>
                We mapped what we heard —{' '}
              </Show>
              this glass rings at
            </p>
            <div class="glass-note-hero">{targetLabel()}</div>
            <p>
              Land it, hold it, pour into it — every close call weakens the
              glass.
            </p>
            <div class="glass-actions">
              <button class="glass-cta" onClick={() => releaseReadyGate()}>
                I'm ready
              </button>
            </div>
          </section>
        </Show>

        <Show when={phase() === 'sing'}>
          <section class="glass-panel glass-panel-wide glass-panel-clear">
            <TrustInfo />
            <div class="glass-progress">Rep {session().rep}</div>
            <h2 class="glass-coach">
              {subPhase() === 'active' ? coachLine() : 'Sing to the glass'}
            </h2>
            {/* One line that SWAPS (never appends) — growing text would
                reflow the stage below it on phones. */}
            <p class="glass-dim glass-subline">
              {session().rep > GLASS_CONFIG.reps.restNudgeAfterReps
                ? 'Rest your voice a moment — steadier beats louder.'
                : `Reach ${targetLabel()} and hold it steady.`}
            </p>
            <Show
              when={subPhase() === 'active'}
              fallback={
                <div class="glass-countdown">{Math.ceil(remaining())}</div>
              }
            >
              <div class="glass-stagegrid">
                {/* The left rail: FX card with the takes DIRECTLY beneath
                    it (one grid child — a separate child would land below
                    the tall stage's row instead). */}
                <div class="glass-rail">
                  <FxRackPanel
                    settings={fxSettings()}
                    onChange={(next) => applyFxSettings(next)}
                    onCommit={(next) => commitFxSettings(next)}
                    showMonitor={true}
                    monitorOn={monitorOn()}
                    monitorConfirming={monitorConfirming()}
                    monitorNotice={monitorNotice()}
                    onMonitorToggle={() => {
                      if (monitorOn()) disableMonitor()
                      else setMonitorConfirming(true)
                    }}
                    onMonitorConfirm={() => enableMonitor()}
                    onMonitorCancel={() => setMonitorConfirming(false)}
                  />
                  <TakeStrip
                    takes={takes()}
                    playingId={playingTakeId()}
                    progress={takeProgress()}
                    disabled={subPhase() === 'active'}
                    onToggle={toggleTake}
                    onRemove={removeTake}
                  />
                </div>
                <div>
                  <div class="glass-stage" ref={(el) => mountStage(el)} />
                  <Chips live={live()} rep={session().rep} />
                  <TimeBar
                    remaining={remaining()}
                    total={GLASS_CONFIG.reps.singSeconds}
                  />
                </div>
              </div>
            </Show>
            <button class="glass-textbtn" onClick={() => endSession()}>
              End session
            </button>
          </section>
        </Show>

        <Show when={phase() === 'playback'}>
          <section class="glass-panel glass-panel-wide glass-panel-clear">
            <TrustInfo />
            <h2>That was you</h2>
            <p class="glass-dim glass-subline">
              Getting used to your voice IS the exercise — shape the room with
              the sliders.
            </p>
            <div class="glass-stagegrid">
              <div class="glass-rail">
                <FxRackPanel
                  settings={fxSettings()}
                  onChange={(next) => applyFxSettings(next)}
                  onCommit={(next) => commitFxSettings(next)}
                  showMonitor={false}
                  monitorOn={false}
                  monitorConfirming={false}
                  monitorNotice={null}
                  onMonitorToggle={() => undefined}
                  onMonitorConfirm={() => undefined}
                  onMonitorCancel={() => undefined}
                />
                <TakeStrip
                  takes={takes()}
                  playingId={playingTakeId()}
                  progress={takeProgress()}
                  disabled={false}
                  onToggle={toggleTake}
                  onRemove={removeTake}
                />
              </div>
              <div>
                <div class="glass-stage" ref={(el) => mountStage(el)} />
                <TimeBar
                  remaining={remaining()}
                  total={GLASS_CONFIG.reps.playbackMaxSeconds}
                />
              </div>
            </div>
            <button class="glass-textbtn" onClick={() => endSession()}>
              End session
            </button>
          </section>
        </Show>

        <Show when={phase() === 'gap'}>
          {/* The between-reps rest: NO auto-advance. Review takes, shape the
              room, study the cracked pane — the next rep starts on a tap. */}
          <section class="glass-panel glass-panel-wide glass-panel-clear">
            <TrustInfo />
            <h2>You know where it lives now</h2>
            <p class="glass-dim glass-subline">
              Replay your takes, tweak the room, go when ready.
            </p>
            <div class="glass-stagegrid">
              <div class="glass-rail">
                <FxRackPanel
                  settings={fxSettings()}
                  onChange={(next) => applyFxSettings(next)}
                  onCommit={(next) => commitFxSettings(next)}
                  showMonitor={false}
                  monitorOn={false}
                  monitorConfirming={false}
                  monitorNotice={null}
                  onMonitorToggle={() => undefined}
                  onMonitorConfirm={() => undefined}
                  onMonitorCancel={() => undefined}
                />
                <TakeStrip
                  takes={takes()}
                  playingId={playingTakeId()}
                  progress={takeProgress()}
                  disabled={false}
                  onToggle={toggleTake}
                  onRemove={removeTake}
                />
              </div>
              <div>
                <div class="glass-stage" ref={(el) => mountStage(el)} />
                <div class="glass-actions">
                  <button class="glass-cta" onClick={() => releaseReadyGate()}>
                    Sing again
                  </button>
                </div>
              </div>
            </div>
            <button class="glass-textbtn" onClick={() => endSession()}>
              End session
            </button>
          </section>
        </Show>

        <Show when={phase() === 'shatter'}>
          {/* The burst plays in the stage — the renderer animates
              autonomously from the shatter() call until results. */}
          <section
            class="glass-panel glass-panel-wide glass-panel-clear"
            data-shatter
          >
            <div class="glass-stage" ref={(el) => mountStage(el)} />
          </section>
        </Show>

        <Show when={phase() === 'results'}>
          {/* Results live ON the glass: the shattered (or cracked) pane
              stays on stage with the numbers overlaid, the room + takes in
              the rail — same screen, mirror-style, not a separate page. */}
          <section class="glass-panel glass-panel-wide glass-panel-clear">
            <TrustInfo />
            <div class="glass-stagegrid">
              <div class="glass-rail">
                <FxRackPanel
                  settings={fxSettings()}
                  onChange={(next) => applyFxSettings(next)}
                  onCommit={(next) => commitFxSettings(next)}
                  showMonitor={false}
                  monitorOn={false}
                  monitorConfirming={false}
                  monitorNotice={null}
                  onMonitorToggle={() => undefined}
                  onMonitorConfirm={() => undefined}
                  onMonitorCancel={() => undefined}
                />
                <TakeStrip
                  takes={takes()}
                  playingId={playingTakeId()}
                  progress={takeProgress()}
                  disabled={false}
                  onToggle={toggleTake}
                  onRemove={removeTake}
                />
              </div>
              <div class="glass-stage-wrap">
                <div class="glass-stage" ref={(el) => mountStage(el)} />
                <ResultsPanel
                  session={session()}
                  fatigue={physics.fatigue}
                  sinceLine={sinceLine()}
                  shareStatus={shareStatus()}
                  storyFormat={cardFormat() === 'story'}
                  onToggleFormat={() =>
                    setCardFormat((f) => (f === 'story' ? 'square' : 'story'))
                  }
                  onShare={() => void onShareCard()}
                  onCopy={() => void onCopyCard()}
                  onAgain={() => resetAll()}
                />
              </div>
            </div>
          </section>
        </Show>
      </main>

      <footer class="glass-foot">
        <a
          class="glass-foot-link glass-foot-typegpu"
          href="https://docs.swmansion.com/TypeGPU/"
          target="_blank"
          rel="noopener"
        >
          Powered by TypeGPU
        </a>
        <span class="glass-foot-sep" aria-hidden="true">
          ·
        </span>
        <a class="glass-foot-link" href="/mirror">
          Voice Mirror
        </a>
        <span class="glass-foot-sep" aria-hidden="true">
          ·
        </span>
        <a class="glass-foot-link" href="/karaoke-night">
          Karaoke Night
        </a>
      </footer>
    </div>
  )
}

// ── live widgets ──────────────────────────────────────────────

/** Input-level bar — visible proof the mic is (or isn't) heard. */
const LevelBar: Component<{ level: () => number }> = (props) => {
  const [percent, setPercent] = createSignal(0)
  let rafId = 0
  const tick = (): void => {
    rafId = requestAnimationFrame(tick)
    setPercent(Math.min(100, (props.level() / 0.12) * 100))
  }
  rafId = requestAnimationFrame(tick)
  onCleanup(() => cancelAnimationFrame(rafId))
  return (
    <div class="glass-levelbar" title="Microphone input level">
      <div class="glass-levelbar-fill" style={{ width: `${percent()}%` }} />
    </div>
  )
}

/** The privacy story, tucked into a corner: an "i" button with a popover.
 *  The full text lives on the landing; every other screen carries only
 *  this — so trust stays one tap away without occluding the experience. */
const TrustInfo: Component = () => {
  const [open, setOpen] = createSignal(false)
  return (
    <div class="glass-info">
      <button
        class="glass-info-btn"
        aria-expanded={open()}
        aria-label="Privacy: how your audio is handled"
        onClick={() => setOpen((v) => !v)}
      >
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="9.5" />
          <path d="M12 10.8v5.4" />
          <circle cx="12" cy="7.6" r="0.6" fill="currentColor" />
        </svg>
      </button>
      <Show when={open()}>
        <div class="glass-info-pop" role="note">
          Private by design: your audio never leaves this device — analysis
          runs in your browser. Takes live only in this tab and are gone when
          you leave. Your numbers stay on device.
        </div>
      </Show>
    </div>
  )
}

/** The note currently detected (calibration feedback). */
const LiveNote: Component<{ latest: () => PitchFrame | null }> = (props) => {
  const [label, setLabel] = createSignal('—')
  let rafId = 0
  const tick = (): void => {
    rafId = requestAnimationFrame(tick)
    const frame = props.latest()
    if (frame !== null && frame.f0 > 0 && frame.conf >= CONF_MIN) {
      setLabel(midiToNoteNameOctave(Math.round(hzToCents(frame.f0) / 100)))
    }
  }
  rafId = requestAnimationFrame(tick)
  onCleanup(() => cancelAnimationFrame(rafId))
  return <div class="glass-live-note">{label()}</div>
}

/** Floating HUD chips (artifact style): offset · resonance · integrity · rep. */
const Chips: Component<{ live: LiveReadout; rep: number }> = (props) => {
  const off = (): number | null => props.live.offCents
  const inBand = (): boolean =>
    off() !== null && Math.abs(off()!) <= GLASS_CONFIG.target.tolCents
  const offText = (): string => {
    const value = off()
    if (value === null) return '· · ·'
    if (Math.abs(value) <= GLASS_CONFIG.target.tolCents) return 'locked'
    // Beyond the pane's visible range a cents number is noise ("−1906¢"
    // mid-glide) — say where the voice is instead.
    if (Math.abs(value) > 999) return value < 0 ? 'low' : 'high'
    const rounded = Math.abs(Math.round(value))
    return `${value > 0 ? '+' : '−'}${rounded}¢`
  }
  return (
    <div class="glass-chips">
      <div class="glass-chip">
        <span class="k">Offset</span>
        <span class="v" classList={{ good: inBand() }}>
          {offText()}
        </span>
      </div>
      <div class="glass-chip">
        <span class="k">Resonance</span>
        <span class="v" classList={{ warm: props.live.resonance > 0.6 }}>
          {Math.round(props.live.resonance * 100)}%
        </span>
      </div>
      <div class="glass-chip">
        <span class="k">Integrity</span>
        <span class="v">{Math.round((1 - props.live.fatigue) * 100)}%</span>
      </div>
      <div class="glass-chip">
        <span class="k">Rep</span>
        <span class="v">{props.rep}</span>
      </div>
    </div>
  )
}

const TimeBar: Component<{ remaining: number; total: number }> = (props) => (
  <div class="glass-timebar">
    <div
      class="glass-timebar-fill"
      style={{
        width: `${Math.max(0, Math.min(100, (props.remaining / props.total) * 100))}%`,
      }}
    />
  </div>
)

// ── panels ────────────────────────────────────────────────────

const MicPanel: Component<{
  error: string | null
  checking: boolean
  silent: boolean
  level: () => number
  devices: MediaDeviceInfo[]
  activeId: string
  activeLabel: string
  onSelectDevice: (deviceId: string) => void
  onRetry: () => void
  onTestAgain: () => void
  onContinueAnyway: () => void
  onStartOver: () => void
}> = (props) => {
  // The picker: which input is live + a one-tap switch. The default device
  // is often a webcam/virtual input that probes ~0 with AGC off.
  const picker = (): ReturnType<Component> => (
    <Show when={props.devices.length > 1}>
      <div class="glass-micpick">
        <label class="glass-micpick-label" for="glass-mic-select">
          Microphone
        </label>
        <select
          id="glass-mic-select"
          class="glass-select"
          value={props.activeId}
          onChange={(e) => props.onSelectDevice(e.currentTarget.value)}
        >
          <For each={props.devices}>
            {(device) => (
              <option value={device.deviceId}>
                {device.label !== '' ? device.label : 'Microphone'}
              </option>
            )}
          </For>
        </select>
      </div>
    </Show>
  )
  return (
    <section class="glass-panel">
      <TrustInfo />
      <h2>One thing first</h2>
      <p class="glass-trust">
        We analyze your voice right here in your browser.
      </p>
      <Show when={props.error}>
        <p class="glass-error">{props.error}</p>
        <div class="glass-actions">
          <button class="glass-cta" onClick={() => props.onRetry()}>
            Try again
          </button>
          <button
            class="glass-cta glass-cta-secondary"
            onClick={() => props.onStartOver()}
          >
            Back to start
          </button>
        </div>
      </Show>
      <Show when={props.error === null && props.checking}>
        <p class="glass-dim">Checking your microphone — say "ahh"…</p>
        <LevelBar level={props.level} />
        <Show when={props.activeLabel !== ''}>
          <p class="glass-dim glass-mic-hearing">
            Listening to: {props.activeLabel}
          </p>
        </Show>
      </Show>
      <Show when={props.error === null && props.silent && !props.checking}>
        <p class="glass-error">
          We're not hearing much from your microphone.
        </p>
        <Show
          when={props.devices.length > 1}
          fallback={
            <p class="glass-dim">
              Close other apps that might be using the mic, check the
              browser's microphone permission, then test again.
            </p>
          }
        >
          <p class="glass-dim">
            The browser picked{' '}
            {props.activeLabel !== '' ? (
              <strong>{props.activeLabel}</strong>
            ) : (
              'a default input'
            )}{' '}
            — if that's not the mic in front of you, switch it here and test
            again.
          </p>
        </Show>
        {picker()}
        <LevelBar level={props.level} />
        <div class="glass-actions">
          <button class="glass-cta" onClick={() => props.onTestAgain()}>
            Test again
          </button>
          <button
            class="glass-cta glass-cta-secondary"
            onClick={() => props.onContinueAnyway()}
          >
            Continue anyway
          </button>
          <button
            class="glass-cta glass-cta-secondary"
            onClick={() => props.onStartOver()}
          >
            Back to start
          </button>
        </div>
      </Show>
      <Show when={props.error === null && !props.checking && !props.silent}>
        <p class="glass-dim">Waiting for microphone permission…</p>
      </Show>
    </section>
  )
}

const ResultsPanel: Component<{
  session: GlassSessionState
  fatigue: number
  /** Cross-visit baseline delta ("Since Tue: lock +0.8s"), if any. */
  sinceLine: string | null
  shareStatus: string | null
  storyFormat: boolean
  onToggleFormat: () => void
  onShare: () => void
  onCopy: () => void
  onAgain: () => void
}> = (props) => {
  const shattered = (): boolean => props.session.shatterRep !== null
  const last = (): RepMetrics | undefined =>
    props.session.repMetrics[props.session.repMetrics.length - 1]
  const first = (): RepMetrics | undefined => props.session.repMetrics[0]
  const deltaLine = (): string | null => {
    const a = first()
    const b = last()
    if (
      a === undefined ||
      b === undefined ||
      a === b ||
      a.meanAbsCents === null ||
      b.meanAbsCents === null ||
      a.meanAbsCents === 0
    ) {
      return null
    }
    const gain = Math.round((1 - b.meanAbsCents / a.meanAbsCents) * 100)
    return gain > 0
      ? `${gain}% tighter than rep 1 — the reps did their job.`
      : null
  }
  const target = (): string =>
    props.session.targetMidi === null
      ? '—'
      : midiToNoteNameOctave(props.session.targetMidi)

  return (
    // Overlay ON the pane (a sibling of the stage host — the renderer's
    // mount() replaceChildren()s the host, so this can't live inside it).
    <div class="glass-results-overlay glass-panel-clear">
      <p class="glass-dim glass-announce-eyebrow">
        {shattered() ? 'the glass gave way' : 'the glass held — this time'}
      </p>
      <h2>
        {shattered()
          ? props.session.shatterRep === 1
            ? 'Shattered — first try'
            : `Shattered on rep ${props.session.shatterRep}`
          : `${target()} is still waiting for you`}
      </h2>
      <div class="glass-metrics">
        <div class="glass-metric">
          <span class="glass-metric-k">Target</span>
          <span class="glass-metric-v">{target()}</span>
        </div>
        <div class="glass-metric">
          <span class="glass-metric-k">Reps</span>
          <span class="glass-metric-v">{props.session.repMetrics.length}</span>
        </div>
        <Show when={last()?.meanAbsCents != null}>
          <div class="glass-metric">
            <span class="glass-metric-k">Precision</span>
            <span class="glass-metric-v">
              ±{Math.min(999, Math.round(last()?.meanAbsCents ?? 0))}¢
            </span>
          </div>
        </Show>
        <div class="glass-metric">
          <span class="glass-metric-k">Best lock</span>
          <span class="glass-metric-v">
            {(last()?.bestLockSec ?? 0).toFixed(1)}s
          </span>
        </div>
        <Show when={!shattered()}>
          <div class="glass-metric">
            <span class="glass-metric-k">Glass integrity</span>
            <span class="glass-metric-v">
              {Math.round((1 - props.fatigue) * 100)}%
            </span>
          </div>
        </Show>
      </div>
      <Show when={deltaLine()}>
        <p class="glass-delta">{deltaLine()}</p>
      </Show>
      <Show when={props.sinceLine}>
        <p class="glass-dim">{props.sinceLine}</p>
      </Show>
      <Show when={!shattered()}>
        <p class="glass-dim">
          The damage is real — but a new session starts a fresh glass.
        </p>
      </Show>
      <div class="glass-actions">
        <button class="glass-cta" onClick={() => props.onShare()}>
          Share the shatter card
        </button>
        <Show when={supportsImageClipboard()}>
          <button
            class="glass-cta glass-cta-secondary"
            onClick={() => props.onCopy()}
            title="Copy the card image to the clipboard"
          >
            Copy card
          </button>
        </Show>
        <button
          type="button"
          class="glass-fx-pill"
          classList={{ on: props.storyFormat }}
          aria-pressed={props.storyFormat}
          onClick={() => props.onToggleFormat()}
          title="Export a tall 9:16 story card instead of the square card"
        >
          Story format {props.storyFormat ? 'on' : 'off'}
        </button>
      </div>
      <Show when={props.shareStatus}>
        <p class="glass-dim">{props.shareStatus}</p>
      </Show>
      <div class="glass-actions">
        <button
          class="glass-cta glass-cta-secondary"
          onClick={() => props.onAgain()}
        >
          Sing it again
        </button>
        <a
          class="glass-cta glass-cta-secondary"
          href="/#/exercises"
          target="_blank"
          rel="noopener"
          onClick={() => trackGlass('glass_cta_app_click')}
        >
          Train in MercuryPitch
        </a>
      </div>
    </div>
  )
}

// ── landing + preview (P0 surfaces) ───────────────────────────

/** An animated glide demo shown during the calibration brief — a dot rides a
 *  rising siren curve (synced to the audible sweep), so users SEE the "slide
 *  low to high" they hear. Reduced-motion drops the travelling dot. */
const GlideDemo: Component = () => (
  <div class="glass-glide-demo" aria-hidden="true">
    <svg viewBox="0 0 220 120" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="glideStroke" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stop-color="#58a6ff" />
          <stop offset="1" stop-color="#2dd4bf" />
        </linearGradient>
      </defs>
      <path
        id="glassGlidePath"
        class="glass-glide-track"
        d="M14,104 C60,100 78,44 118,32 S196,18 206,14"
        fill="none"
        stroke="url(#glideStroke)"
      />
      <circle class="glass-glide-dot" r="5" fill="#7ff0dd">
        <animateMotion
          dur="2.2s"
          repeatCount="indefinite"
          calcMode="spline"
          keyPoints="0;1"
          keyTimes="0;1"
          keySplines="0.4 0 0.2 1"
          path="M14,104 C60,100 78,44 118,32 S196,18 206,14"
        />
      </circle>
    </svg>
    <span class="glass-glide-label">low → high</span>
  </div>
)

const Landing: Component<{
  onStart: () => void
  onHowItWorks: () => void
}> = (props) => (
  <section class="glass-panel glass-landing">
    <p class="glass-wordmark">
      <span class="glass-wm-mercury">Mercury</span>
      <span class="glass-wm-pitch">Pitch</span>
      <span class="glass-wm-tail">Glass</span>
    </p>
    <h1>Break glass with your voice</h1>
    <p class="glass-lead">
      This mirror rings at a note near the top of <em>your</em> range. Land it,
      hold it, and the resonance builds until the glass gives way — real
      fracture physics, live in your browser.
    </p>
    <div class="glass-actions">
      <button class="glass-cta" onClick={() => props.onStart()}>
        Start singing
      </button>
    </div>
    <button class="glass-textbtn" onClick={() => props.onHowItWorks()}>
      How it works
    </button>
    <p class="glass-trust">
      Your audio never leaves this device — takes are recorded on-device and
      gone when you leave.
    </p>
  </section>
)

const HowItWillWork: Component<{
  onStart: () => void
  onBack: () => void
}> = (props) => (
  <section class="glass-panel glass-steps">
    <h2>How it works</h2>
    <ol class="glass-step-list">
      <li>
        <span class="glass-step-icon">
          <IconGlide />
        </span>
        <div>
          <h3>Calibrate</h3>
          <p>
            Slide low to high, like a siren. The glass tunes itself just below
            your ceiling.
          </p>
        </div>
      </li>
      <li>
        <span class="glass-step-icon">
          <IconReplay />
        </span>
        <div>
          <h3>Sing, then hear yourself</h3>
          <p>
            Your voice dances in the mirror as you reach for the gold line.
            After each take it plays back to you — getting used to your own
            voice is the exercise.
          </p>
        </div>
      </li>
      <li>
        <span class="glass-step-icon">
          <IconShatter />
        </span>
        <div>
          <h3>Shatter it</h3>
          <p>
            Every near-miss leaves a real crack. Hold the note and the glass
            bursts into a hundred shards — persistence always wins.
          </p>
        </div>
      </li>
    </ol>
    <div class="glass-actions">
      <button class="glass-cta" onClick={() => props.onStart()}>
        Start singing
      </button>
      <button
        class="glass-cta glass-cta-secondary"
        onClick={() => props.onBack()}
      >
        Back
      </button>
    </div>
  </section>
)
