// ============================================================
// Glass — the shattering voice mirror (P1: full audio core).
//
// Landing → mic (trust copy + silence probe) → calibration glide
// (with one retry) → target announce → the rep loop: sing with
// live resonance/fatigue physics → contour playback → retry —
// until the glass shatters (or the singer ends the session).
//
// P1 renders debug bars, not the mirror visuals (P3/P4); audible
// take playback and the FX rack land in P2. Audio never leaves
// the device. Hardened mic handling (probe + rebuild + generation
// tokens) is ported from the Voice Mirror.
// ============================================================

import type { Component } from 'solid-js'
import { createSignal, onCleanup, Show } from 'solid-js'
import { GLASS_CONFIG } from '@/lib/glass/config'
import type { RepMetrics } from '@/lib/glass/metrics'
import { computeRepMetrics } from '@/lib/glass/metrics'
import type { GlassPhysicsState } from '@/lib/glass/resonance'
import { initialPhysics, shatterReady, startRep, tickPhysics, } from '@/lib/glass/resonance'
import type { GlassEvent, GlassSessionState } from '@/lib/glass/session'
import { initialSessionState, reduceSession } from '@/lib/glass/session'
import { computeTarget } from '@/lib/glass/target'
import type { MicError } from '@/lib/mic-manager'
import { micManager } from '@/lib/mic-manager'
import { CONF_MIN, hzToCents } from '@/lib/mirror/metrics'
import { midiToNoteNameOctave } from '@/lib/note-utils'
import type { F0Stream, PitchFrame } from '@/lib/pitch-f0-stream'
import { createF0Stream } from '@/lib/pitch-f0-stream'
import { trackGlass } from './funnel'
import { IconGlide, IconReplay, IconShatter } from './icons'

const MIC_CONSUMER_ID = 'glass'
// A live mic never reads exactly zero (room noise floors ~1e-3); dead zeros
// mean the capture graph is broken (iOS WebKit) or the mic is OS-muted.
const SILENCE_RMS = 1e-6
const CAL_BRIEF_SEC = 3
const REP_BRIEF_SEC = 2
const GAP_SEC = 1.4
// Placeholder pause where the P4 shatter animation will play.
const SHATTER_PLACEHOLDER_SEC = 1.4

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms))

const round2 = (value: number): number => Math.round(value * 100) / 100

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
  const [calRetry, setCalRetry] = createSignal(false)

  let audioContext: AudioContext | null = null
  let f0: F0Stream | null = null
  let cancelled = false
  // Generation token: each start/reset bumps it, so an orphaned flow dies at
  // its next checkpoint instead of clobbering the new run (mirror pattern).
  let flowGen = 0
  let starting = false
  let readyResolve: (() => void) | null = null
  // Physics persists ACROSS reps within one glass (fatigue is cumulative).
  let physics: GlassPhysicsState = initialPhysics()

  const dispatch = (event: GlassEvent): GlassSessionState => {
    const next = reduceSession(session(), event)
    setSession(next)
    return next
  }

  onCleanup(() => {
    cancelled = true
    flowGen++
    releaseAnnounceGate()
    teardownAudio()
  })

  function releaseAnnounceGate(): void {
    readyResolve?.()
    readyResolve = null
  }

  function teardownAudio(): void {
    f0?.dispose()
    f0 = null
    micManager.release(MIC_CONSUMER_ID)
    void audioContext?.close().catch(() => undefined)
    audioContext = null
  }

  function resetAll(): void {
    teardownAudio()
    flowGen++
    releaseAnnounceGate()
    starting = false
    physics = initialPhysics()
    setSession(initialSessionState())
    setPreviewOpen(false)
    setSubPhase('brief')
    setRemaining(0)
    setLive(IDLE_READOUT)
    setMicError(null)
    setMicChecking(false)
    setMicSilent(false)
    setCalRetry(false)
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
    f0?.dispose()
    f0 = null
    await audioContext?.close().catch(() => undefined)
    audioContext = new AudioContext()
    if (audioContext.state === 'suspended') {
      await audioContext.resume().catch(() => undefined)
    }
    if (stream) f0 = createF0Stream(audioContext, stream)
  }

  /** Silence check with one automatic graph rebuild. */
  async function probeMic(): Promise<boolean> {
    setMicChecking(true)
    try {
      if ((await probeLevel(900)) > SILENCE_RMS) return true
      await rebuildAudio()
      return (await probeLevel(900)) > SILENCE_RMS
    } finally {
      setMicChecking(false)
    }
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
    try {
      audioContext = new AudioContext()
      if (audioContext.state === 'suspended') await audioContext.resume()
      const stream = await micManager.acquire(MIC_CONSUMER_ID)
      f0 = createF0Stream(audioContext, stream)
      trackGlass('glass_mic_granted')
      setMicError(null)
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

  /** Plain timed take (calibration): frames only, no physics. */
  async function recordPlain(seconds: number): Promise<PitchFrame[]> {
    if (!f0) return []
    const gen = flowGen
    setSubPhase('active')
    f0.startTask()
    await countdown(seconds)
    if (cancelled || gen !== flowGen) return []
    return f0?.takeFrames() ?? []
  }

  interface RepResult {
    frames: PitchFrame[]
    shattered: boolean
    peakResonance: number
  }

  /**
   * A rep take with the physics ticking live: resonance/fatigue update every
   * ~30 ms from the freshest frame, and the take ends EARLY the moment the
   * shatter condition is met.
   */
  async function recordRep(seconds: number): Promise<RepResult> {
    const target = session().targetMidi
    if (!f0 || target === null)
      return { frames: [], shattered: false, peakResonance: 0 }
    const gen = flowGen
    setSubPhase('active')
    f0.startTask()
    const start = performance.now()
    let lastTick = start
    let peak = 0
    while (!cancelled && gen === flowGen) {
      const now = performance.now()
      const elapsed = (now - start) / 1000
      const left = seconds - elapsed
      setRemaining(Math.max(0, left))
      const dt = Math.min(0.1, (now - lastTick) / 1000)
      lastTick = now
      const frame = f0.latest()
      const voiced =
        frame !== null &&
        frame.f0 > 0 &&
        frame.conf >= CONF_MIN &&
        elapsed > 0.1
      const offCents = voiced ? hzToCents(frame.f0) - target * 100 : null
      physics = tickPhysics(physics, {
        offCents,
        level: f0.latestLevel(),
        dt,
      })
      peak = Math.max(peak, physics.resonance)
      setLive({
        offCents,
        resonance: physics.resonance,
        fatigue: physics.fatigue,
        lockRun: physics.lockRun,
      })
      if (shatterReady(physics)) {
        return { frames: f0.takeFrames(), shattered: true, peakResonance: peak }
      }
      if (left <= 0) break
      await sleep(30)
    }
    if (cancelled || gen !== flowGen) {
      return { frames: [], shattered: false, peakResonance: peak }
    }
    return {
      frames: f0?.takeFrames() ?? [],
      shattered: false,
      peakResonance: peak,
    }
  }

  /** Contour replay of the take — the readout re-dances to the recorded
   *  frames. (P2 adds the actual recorded-voice audio + FX rack here.) */
  async function playbackPhase(frames: PitchFrame[]): Promise<void> {
    const target = session().targetMidi ?? 0
    const gen = flowGen
    const duration = Math.min(
      frames.length > 0 ? frames[frames.length - 1].t : 0,
      GLASS_CONFIG.reps.playbackMaxSeconds,
    )
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
      setLive((prev) => ({
        ...prev,
        offCents: voiced ? hzToCents(frame.f0) - target * 100 : null,
      }))
      await sleep(30)
    }
    setRemaining(0)
  }

  function announceGate(gen: number): Promise<void> {
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

    // Calibration, with one reducer-driven retry.
    while (alive() && session().phase === 'calibrate') {
      setSubPhase('brief')
      await countdown(CAL_BRIEF_SEC)
      if (!alive()) return
      const frames = await recordPlain(GLASS_CONFIG.calibration.glideSeconds)
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
    })

    // "This glass rings at G4 — your G4." Waits for the I'm-ready tap.
    await announceGate(gen)
    if (!alive()) return
    dispatch({ type: 'announce-done' })

    // The rep loop — runs until the glass gives way or the singer ends it.
    while (alive() && session().phase === 'sing') {
      const rep = session().rep
      physics = startRep(physics)
      setSubPhase('brief')
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
        dispatch({ type: 'shattered', metrics })
        trackGlass('glass_shatter', { rep, fatigue: round2(physics.fatigue) })
        await sleep(SHATTER_PLACEHOLDER_SEC * 1000)
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
      await playbackPhase(take.frames)
      if (!alive()) return
      dispatch({ type: 'playback-done' })
      trackGlass('glass_playback_done')
      await countdown(GAP_SEC)
      if (!alive()) return
      dispatch({ type: 'gap-done' })
    }
  }

  function finishRun(): void {
    teardownAudio()
    const state = session()
    const last = state.repMetrics[state.repMetrics.length - 1]
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
    })
  }

  /** The singer bails mid-loop: orphan the flow, honest results. */
  function endSession(): void {
    flowGen++
    releaseAnnounceGate()
    teardownAudio()
    dispatch({ type: 'end-session' })
    finishRun()
  }

  const targetLabel = (): string => {
    const midi = session().targetMidi
    return midi === null ? '—' : midiToNoteNameOctave(midi)
  }

  const phase = (): GlassSessionState['phase'] => session().phase

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
            onRetry={() => void start()}
            onTestAgain={() => void retryMicCheck()}
            onContinueAnyway={() => beginFlow()}
            onStartOver={() => resetAll()}
          />
        </Show>

        <Show when={phase() === 'calibrate'}>
          <section class="glass-panel">
            <h2>Find your ceiling</h2>
            <p>
              Slide from your lowest comfy note to your highest — like a siren.
              The glass listens and tunes itself to you.
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
                <div class="glass-countdown">{Math.ceil(remaining())}</div>
              }
            >
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
              Your {targetLabel()}. Land it, hold it, and pour into it until the
              glass gives way. Every close call weakens it — persistence always
              wins.
            </p>
            <div class="glass-actions">
              <button class="glass-cta" onClick={() => releaseAnnounceGate()}>
                I'm ready
              </button>
            </div>
          </section>
        </Show>

        <Show when={phase() === 'sing'}>
          <section class="glass-panel">
            <div class="glass-progress">Rep {session().rep}</div>
            <h2>Sing to the glass</h2>
            <p>
              Reach {targetLabel()} and hold it steady.
              <Show when={session().rep > GLASS_CONFIG.reps.restNudgeAfterReps}>
                {' '}
                <span class="glass-dim">
                  (Give your voice a rest soon — steadier beats louder.)
                </span>
              </Show>
            </p>
            <Show
              when={subPhase() === 'active'}
              fallback={
                <div class="glass-countdown">{Math.ceil(remaining())}</div>
              }
            >
              <OffsetReadout offCents={live().offCents} />
              <Bars live={live()} />
              <TimeBar
                remaining={remaining()}
                total={GLASS_CONFIG.reps.singSeconds}
              />
            </Show>
            <button class="glass-textbtn" onClick={() => endSession()}>
              End session
            </button>
          </section>
        </Show>

        <Show when={phase() === 'playback'}>
          <section class="glass-panel">
            <h2>That was you</h2>
            <p class="glass-dim">
              Your take replays in the glass — getting used to your own voice IS
              the exercise. (Audible playback and the FX rack land with the next
              phase.)
            </p>
            <OffsetReadout offCents={live().offCents} />
            <TimeBar
              remaining={remaining()}
              total={GLASS_CONFIG.reps.playbackMaxSeconds}
            />
            <button class="glass-textbtn" onClick={() => endSession()}>
              End session
            </button>
          </section>
        </Show>

        <Show when={phase() === 'gap'}>
          <section class="glass-panel">
            <h2>Again — you know where it lives now</h2>
            <div class="glass-countdown">{Math.ceil(remaining())}</div>
          </section>
        </Show>

        <Show when={phase() === 'shatter'}>
          <section class="glass-panel glass-shatter-flash">
            <div class="glass-note-hero">✦</div>
            <h2>The glass gave way</h2>
            <p class="glass-dim">(The real burst animation lands in P4.)</p>
          </section>
        </Show>

        <Show when={phase() === 'results'}>
          <ResultsPanel
            session={session()}
            fatigue={physics.fatigue}
            onAgain={() => resetAll()}
          />
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

const OffsetReadout: Component<{ offCents: number | null }> = (props) => {
  const inBand = (): boolean =>
    props.offCents !== null &&
    Math.abs(props.offCents) <= GLASS_CONFIG.target.tolCents
  const text = (): string => {
    if (props.offCents === null) return '· · ·'
    const off = Math.round(props.offCents)
    if (Math.abs(off) <= GLASS_CONFIG.target.tolCents) return 'locked'
    return `${off > 0 ? '+' : '−'}${Math.abs(off)}¢ ${off > 0 ? 'sharp' : 'flat'}`
  }
  return (
    <div class="glass-offset" classList={{ 'glass-offset-locked': inBand() }}>
      {text()}
    </div>
  )
}

const Bars: Component<{ live: LiveReadout }> = (props) => (
  <div class="glass-bars">
    <BarRow
      label="Resonance"
      value={props.live.resonance}
      kind="gold"
      detail={`${Math.round(props.live.resonance * 100)}%`}
    />
    <BarRow
      label="Integrity"
      value={1 - props.live.fatigue}
      kind="chrome"
      detail={`${Math.round((1 - props.live.fatigue) * 100)}%`}
    />
    <BarRow
      label="Lock"
      value={Math.min(
        1,
        props.live.lockRun / GLASS_CONFIG.resonance.lockForShatterSec,
      )}
      kind="aqua"
      detail={`${props.live.lockRun.toFixed(1)}s`}
    />
  </div>
)

const BarRow: Component<{
  label: string
  value: number
  kind: 'gold' | 'aqua' | 'chrome'
  detail: string
}> = (props) => (
  <div class="glass-barrow">
    <span class="glass-barrow-label">{props.label}</span>
    <div class="glass-bar">
      <div
        class={`glass-bar-fill glass-bar-${props.kind}`}
        style={{ width: `${Math.max(0, Math.min(100, props.value * 100))}%` }}
      />
    </div>
    <span class="glass-barrow-detail">{props.detail}</span>
  </div>
)

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
  onRetry: () => void
  onTestAgain: () => void
  onContinueAnyway: () => void
  onStartOver: () => void
}> = (props) => (
  <section class="glass-panel">
    <h2>One thing first</h2>
    <p class="glass-trust">
      Your audio never leaves this device — we analyze it right here in your
      browser. Takes are recorded on-device, played back to you, then deleted.
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
    </Show>
    <Show when={props.error === null && props.silent && !props.checking}>
      <p class="glass-error">
        We're not hearing anything from your microphone.
      </p>
      <p class="glass-dim">
        Close other apps that might be using the mic, check the browser's
        microphone permission, then test again.
      </p>
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

const ResultsPanel: Component<{
  session: GlassSessionState
  fatigue: number
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
    <section class="glass-panel">
      <p class="glass-dim glass-announce-eyebrow">
        {shattered() ? '✦ the glass gave way' : 'the glass held — this time'}
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
              ±{Math.round(last()?.meanAbsCents ?? 0)}¢
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
      <Show when={!shattered()}>
        <p class="glass-dim">
          The damage you did is real — a fresh session starts a fresh glass, but
          your voice remembers.
        </p>
      </Show>
      <div class="glass-actions">
        <button class="glass-cta" onClick={() => props.onAgain()}>
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
    </section>
  )
}

// ── landing + preview (P0 surfaces) ───────────────────────────

const Landing: Component<{
  onStart: () => void
  onHowItWorks: () => void
}> = (props) => (
  <section class="glass-panel glass-landing">
    <p class="glass-wordmark">MercuryPitch</p>
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
      Your audio never leaves this device. Takes are recorded on-device, played
      back to you, then deleted.
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
