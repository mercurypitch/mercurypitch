// ============================================================
// Voice Mirror — the guided 3-task flow (spec §2).
//
//   landing → mic permission (trust copy) → Task A: Glide →
//   Task B: Hold → Task C: Match 5 → results
//
// Audio never leaves the device: the mic stream feeds the YIN
// detector locally and only derived numbers are kept. The session
// ordering itself lives in src/lib/mirror/session.ts (pure); this
// component owns timers, audio and rendering.
// ============================================================

import type { Component } from 'solid-js'
import { createEffect, createSignal, For, onCleanup, onMount, Show, } from 'solid-js'
import type { MicError } from '@/lib/mic-manager'
import { listAudioInputs, micManager } from '@/lib/mic-manager'
import { attemptByTake, parseTakeHash, saveAttempt, takeHash, } from '@/lib/mirror/attempts'
import { deltaVsBaseline, saveBaseline } from '@/lib/mirror/baseline'
import type { DemoKind } from '@/lib/mirror/demo-timeline'
import type { FreeSingResult } from '@/lib/mirror/free-sing'
import { computeFreeSing } from '@/lib/mirror/free-sing'
import type { F0Frame, MirrorResult, NoteTakeResult, } from '@/lib/mirror/metrics'
import { summarize } from '@/lib/mirror/metrics'
import { hasSeenHowItWorks, markHowItWorksSeen } from '@/lib/mirror/onboarding'
import type { MirrorEvent, MirrorSessionState } from '@/lib/mirror/session'
import { initialSessionState, reduceSession } from '@/lib/mirror/session'
import { singerForRange } from '@/lib/mirror/singer-match'
import { midiToNoteNameOctave } from '@/lib/note-utils'
import type { F0Stream } from '@/lib/pitch-f0-stream'
import { createF0Stream } from '@/lib/pitch-f0-stream'
import type { CardFormat } from './card-renderer'
import { cardToPngBlob, copyCardToClipboard, copyOutcomeMessage, datedFilename, formatDeltaLine, renderCard, renderTwinFaceCard, shareCard, supportsImageClipboard, } from './card-renderer'
import { CosmicMode } from './CosmicMode'
import { trackFunnel } from './funnel'
import { HowItWorks } from './HowItWorks'
import { IconCopy, IconGalaxy, IconRocket, IconShare, IconSpark, IconStats, IconTrace, } from './icons'
import { legendArt } from './LegendCaricature'
import { LiveViz, MicLevelBar } from './LiveViz'
import type { RevealMode } from './RevealCard'
import { RevealCard } from './RevealCard'
import { TaskDemo } from './TaskDemo'
import { playReferenceTone } from './tone-player'

const GLIDE_SEC = 8
const HOLD_SEC = 6
const REFERENCE_SEC = 1.4
const MATCH_TAKE_SEC = 3
// A "get ready" count-in between hearing the note and singing it back, so the
// match task doesn't fire notes at the singer with no time to prepare.
const MATCH_PREPARE_SEC = 2
const FREE_SING_SEC = 40
const MIC_CONSUMER_ID = 'voice-mirror'
// A live mic never reads exactly zero (room noise floors around 1e-3); dead
// zeros mean the capture graph itself is broken (the iOS WebKit case) or the
// mic is muted at the OS level.
const SILENCE_RMS = 1e-6
// The flow gate (same fix as Glass): a WRONG device is usually not dead-zero
// — faint noise sails past the dead-graph check and the flow used to start
// against an inaudible mic. Below this peak during the say-"ahh" probe, stay
// on the mic panel and offer the device picker.
const QUIET_RMS = 0.004

// Deep-link fragment for the cosmic "Sing the Universe" mode. The landing page
// links straight to /mirror#sing-the-universe, and share cards / the browser
// URL reflect it — keep this string in sync with those. A fragment never
// reaches the Worker, so no server route is needed; the SPA reads it here.
const COSMIC_HASH = 'sing-the-universe'
const isCosmicHash = (): boolean =>
  window.location.hash.replace(/^#/, '') === COSMIC_HASH

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms))

type SubPhase = 'intro' | 'brief' | 'recording' | 'listening' | 'prepare'

interface TaskCopy {
  title: string
  instruction: string
}

const TASK_COPY: Record<string, TaskCopy> = {
  'glide-up': {
    title: 'Glide up',
    instruction:
      'Slide from your lowest comfy note to your highest — like a siren.',
  },
  'glide-down': {
    title: 'Glide down',
    instruction: 'Now slide back down, top to bottom. Same siren, reversed.',
  },
  hold: {
    title: 'Hold',
    instruction:
      'Pick any comfortable note and hold it steady. The ring tightens as you hold.',
  },
  match: {
    title: 'Match',
    instruction: 'Listen to the tone, then sing it back. Any octave counts.',
  },
}

export const MirrorApp: Component = () => {
  const [session, setSession] = createSignal<MirrorSessionState>(
    initialSessionState(),
  )
  const [subPhase, setSubPhase] = createSignal<SubPhase>('brief')
  const [remaining, setRemaining] = createSignal(0)
  const [taskKey, setTaskKey] = createSignal(0)
  const [micError, setMicError] = createSignal<string | null>(null)
  const [micChecking, setMicChecking] = createSignal(false)
  const [micSilent, setMicSilent] = createSignal(false)
  // Input picker on the mic panel (same fix as Glass): the browser's default
  // device is often NOT the mic in front of the singer, and with AGC off a
  // wrong device probes ~0 and reads as "mic doesn't work". Labels are only
  // available post-grant.
  const [micDevices, setMicDevices] = createSignal<MediaDeviceInfo[]>([])
  const [activeMicId, setActiveMicId] = createSignal('')
  const [activeMicLabel, setActiveMicLabel] = createSignal('')
  const [retryNotice, setRetryNotice] = createSignal(false)
  const [shareStatus, setShareStatus] = createSignal<string | null>(null)
  const [deltaLine, setDeltaLine] = createSignal<string | null>(null)
  // The saved take number of the run on screen (null for unsaved/demo runs);
  // personalises download filenames ("…-take-3-…").
  const [takeN, setTakeN] = createSignal<number | null>(null)
  const [mode, setMode] = createSignal<'guided' | 'free'>('guided')
  // "How it works" overview — UI-only, shown over the idle phase. Opens
  // automatically for first-timers on "Start singing"; replayable from the
  // Landing link.
  const [howtoOpen, setHowtoOpen] = createSignal(false)
  const [freePhase, setFreePhase] = createSignal<
    null | 'mic' | 'task' | 'results'
  >(null)
  const [freeResult, setFreeResult] = createSignal<FreeSingResult | null>(null)
  // Initialized from the URL fragment so a /mirror#sing-the-universe deep link
  // opens cosmic mode on the first paint (no Landing flash before onMount runs).
  const [cosmicOpen, setCosmicOpen] = createSignal(isCosmicHash())
  // Legend "voice twin" reveal on the results card. Flip is the shipped
  // reveal; the lenticular machinery is kept behind the dev-only ?mode=
  // override (its on-card look ships as the "Share with twin" export).
  const [revealed, setRevealed] = createSignal(false)
  const [revealMode, setRevealMode] = createSignal<RevealMode>('flip')
  // Card option: include the pitch glide trace on shared/copied cards.
  const [includeTrace, setIncludeTrace] = createSignal(true)
  // Card option: exported voiceprint shape — 'square' (1:1, feeds/the on-screen
  // look) or 'story' (9:16, Instagram/TikTok stories). Default square so the
  // download matches the compact on-screen preview; toggle to story for stories.
  const [cardFormat, setCardFormat] = createSignal<CardFormat>('square')
  // Card option: draw the trace over the twin card too (default off — the
  // downloaded twin stays identical to the on-screen reveal, face clean).
  const [twinTrace, setTwinTrace] = createSignal(false)
  // Card option: swap the twin card's caption for the run's data block
  // (default off — caption keeps it identical to the on-screen reveal).
  const [twinData, setTwinData] = createSignal(false)
  // Sticky "has met their twin" — after the first reveal the front data card
  // keeps the circular twin medallion (the surprise is already spent).
  const [metTwin, setMetTwin] = createSignal(false)

  let audioContext: AudioContext | null = null
  let f0: F0Stream | null = null
  let cancelled = false
  // Generation token: each start/reset/restore bumps it, so an orphaned
  // flow (back/forward mid-run) sees a stale token and dies at its next
  // checkpoint instead of clobbering the new run's intro gate.
  let flowGen = 0
  // Resolver for the pending "I'm ready" intro gate, if a task is waiting.
  let readyResolve: (() => void) | null = null
  let freeTakeFrames: F0Frame[] = []
  // Guards double-taps on Start/Try-again/Test-again: a second concurrent
  // start would orphan AudioContexts and drive two flows over one session.
  let starting = false
  let cardCanvas: HTMLCanvasElement | null = null
  let voiceprintHost: HTMLDivElement | undefined
  // The twin's raster portrait, decoded ahead of the share tap: ClipboardItem
  // must be constructed synchronously inside the gesture (Safari), so the
  // story card can't await an image load at share time. A signal so the
  // "Share with twin" button appears the moment the decode lands.
  const [legendImage, setLegendImage] = createSignal<HTMLImageElement | null>(
    null,
  )
  let legendLoadSeq = 0

  /** Kick off decoding the legend portrait for a finished run (if any). */
  function preloadLegendPortrait(result: MirrorResult | null): void {
    setLegendImage(null)
    // A decode that resolves after a newer run started must not win — the
    // twin card would show the previous run's twin.
    const seq = ++legendLoadSeq
    const legend = singerForRange(result?.range ?? null)
    if (legend === null) return
    const src = legendArt(legend).imageSrc
    if (src === undefined) return
    const img = new Image()
    img.src = src
    img
      .decode()
      .then(() => {
        if (seq === legendLoadSeq) setLegendImage(img)
      })
      .catch(() => undefined) // missing file → pill-only share card
  }

  const dispatch = (event: MirrorEvent): MirrorSessionState => {
    const next = reduceSession(session(), event)
    setSession(next)
    return next
  }

  /** localStorage, or null where even touching the global throws (Chrome
   *  "block all cookies", some embedded webviews). Callers on the start
   *  gesture path must never die on a storage SecurityError. */
  function safeStorage(): Storage | null {
    try {
      return window.localStorage
    } catch {
      return null
    }
  }

  /** One fragment router for load AND hashchange: cosmic mode, saved takes
   *  (#take-N, a real feature) and — in dev builds — the demo fast lanes, so
   *  editing the hash or using back/forward reacts without a reload. When the
   *  fragment names no state (cleared by back/forward or edited away), a
   *  hash-addressed terminal screen falls back to the landing so the URL and
   *  the UI agree; live takes are never torn down by a stray fragment. */
  async function applyHash(): Promise<void> {
    setCosmicOpen(isCosmicHash())
    if (isCosmicHash()) return
    const take = parseTakeHash(window.location.hash)
    if (take !== null && restoreAttempt(take)) return
    if (import.meta.env.DEV && (await maybeStartDemo())) return
    if (session().phase === 'results' || freePhase() === 'results') resetAll()
  }

  const onHashChange = (): void => {
    void applyHash()
  }

  onMount(() => {
    trackFunnel('mirror_view')
    onHashChange()
    window.addEventListener('hashchange', onHashChange)
    onCleanup(() => window.removeEventListener('hashchange', onHashChange))
  })
  onCleanup(() => {
    cancelled = true
    flowGen++
    releaseIntroGate()
    teardownAudio()
  })

  /** Resolve a pending "I'm ready" intro gate (the awaiting flow re-checks
   *  its generation token, so stale flows still die here). */
  function releaseIntroGate(): void {
    readyResolve?.()
    readyResolve = null
  }

  /** Show a task's demo + instruction until the user taps "I'm ready".
   *  A stale flow (gen mismatch) must not touch the shared gate — it would
   *  clobber the live run's resolver and strand it on the intro screen. */
  function taskIntro(gen: number): Promise<void> {
    if (cancelled || gen !== flowGen) return Promise.resolve()
    setSubPhase('intro')
    return new Promise<void>((resolve) => {
      readyResolve = resolve
    })
  }

  function teardownAudio(): void {
    f0?.dispose()
    f0 = null
    micManager.release(MIC_CONSUMER_ID)
    void audioContext?.close().catch(() => undefined)
    audioContext = null
  }

  /** Full restart back to the landing — retakes are the whole point of a
   *  baseline+delta product, so every terminal screen offers a way back. */
  function resetAll(): void {
    teardownAudio()
    flowGen++
    releaseIntroGate()
    setSubPhase('brief')
    setHowtoOpen(false)
    starting = false
    cardCanvas = null
    setLegendImage(null)
    legendLoadSeq++ // invalidate any in-flight portrait decode
    setSession(initialSessionState())
    setFreePhase(null)
    setFreeResult(null)
    setDeltaLine(null)
    setTakeN(null)
    setShareStatus(null)
    setMicError(null)
    setMicSilent(false)
    setRetryNotice(false)
    setCosmic(false)
    setRevealed(false)
    setRevealMode('flip')
    setIncludeTrace(true)
    setTwinTrace(false)
    setTwinData(false)
    setMetTwin(false)
    // Drop a #take-N fragment so the landing isn't re-restored on reload.
    if (parseTakeHash(window.location.hash) !== null) {
      history.replaceState(
        null,
        '',
        window.location.pathname + window.location.search,
      )
    }
  }

  /** Open/close cosmic "Sing the Universe" mode, keeping the URL fragment in
   *  sync so the mode is deep-linkable and shareable. replaceState (not push)
   *  keeps it out of the back-button stack while making the URL truthful; the
   *  onMount hashchange listener covers manual / forward-back fragment edits. */
  function setCosmic(open: boolean): void {
    setCosmicOpen(open)
    if (open === isCosmicHash()) return
    history.replaceState(
      null,
      '',
      open
        ? `#${COSMIC_HASH}`
        : window.location.pathname + window.location.search,
    )
  }

  /** Countdown helper driving the `remaining` signal. Aborts early when the
   *  flow generation changes mid-count (reset / take restore), so an
   *  orphaned flow can't keep writing `remaining` — or run for its full
   *  duration — after the user has moved on. */
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

  async function brief(seconds: number): Promise<void> {
    setSubPhase('brief')
    await countdown(seconds)
  }

  /** "Your turn" count-in after the reference tone, before recording. */
  async function prepare(seconds: number): Promise<void> {
    setSubPhase('prepare')
    await countdown(seconds)
  }

  async function record(seconds: number): Promise<F0Frame[]> {
    if (!f0) return []
    const gen = flowGen
    setTaskKey((k) => k + 1)
    setSubPhase('recording')
    f0.startTask()
    await countdown(seconds)
    // The take is void if the run was reset/restored mid-count, and f0 may
    // have been torn down while we were awaiting (unmount mid-take).
    if (cancelled || gen !== flowGen) return []
    return f0?.takeFrames() ?? []
  }

  /**
   * Measure the loudest input over a short window. Distinguishes a live mic
   * (room noise alone registers well above zero) from the dead-zero output
   * WebKit produces when the audio graph is broken.
   */
  async function probeLevel(ms: number): Promise<number> {
    if (!f0) return 0
    f0.startTask()
    await sleep(ms)
    f0.takeFrames()
    return f0?.maxLevel() ?? 0
  }

  /**
   * Rebuild the audio graph with a fresh AudioContext created AFTER capture
   * is live. On iOS WebKit, createMediaStreamSource outputs pure silence
   * when the context sample rate doesn't match the mic route (the context
   * pre-dates getUserMedia, so it locked to the output rate); a context
   * created while the mic is capturing picks up the session rate.
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
   * Capture from a different input (the wrong-default-mic fix). The manager
   * drops its handle on a device change, so re-acquire opens the new device,
   * then the graph re-wires onto the fresh stream and the probe re-runs.
   */
  async function switchMicDevice(deviceId: string): Promise<void> {
    if (starting || micChecking()) return
    setMicSilent(false)
    setMicChecking(true)
    try {
      await micManager.setPreferredDevice(deviceId === '' ? null : deviceId)
      await micManager.acquire(MIC_CONSUMER_ID)
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
    // Same contract as start(): a passing probe continues the flow — without
    // this the panel fell into its "waiting for permission" fallback.
    if (await probeMic()) beginFlow()
    else setMicSilent(true)
  }

  function beginFlow(): void {
    // 'Continue anyway' can race a 'Test again' rebuild — while the check is
    // in flight, f0 may be mid-swap and a second flow could start.
    if (starting || micChecking()) return
    setMicSilent(false)
    setShareStatus(null)
    if (mode() === 'free') {
      void runFreeFlow()
      return
    }
    dispatch({ type: 'mic-granted' })
    void runFlow()
  }

  /** Re-test from the warning screen — the tap gives WebKit a fresh user
   *  gesture, so a suspended context can resume here. */
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

  /** The scariest moment is the biggest trust moment: mic + audio context are
   *  created inside this tap handler (required by iOS Safari). */
  async function start(selected: 'guided' | 'free' = mode()): Promise<void> {
    if (starting) return
    starting = true
    setMode(selected)
    setShareStatus(null)
    if (selected === 'free') setFreePhase('mic')
    else dispatch({ type: 'start' })
    try {
      audioContext = new AudioContext()
      if (audioContext.state === 'suspended') await audioContext.resume()
      const stream = await micManager.acquire(MIC_CONSUMER_ID)
      f0 = createF0Stream(audioContext, stream)
      trackFunnel('mic_granted')
      setMicError(null)
      void refreshMicDevices()
      starting = false
      if (await probeMic()) {
        beginFlow()
      } else {
        // Stay on the mic panel and tell the user instead of running the
        // whole flow against a dead input.
        setMicSilent(true)
      }
    } catch (err) {
      starting = false
      // Without this, every denied attempt leaks an AudioContext and the
      // browser's hardware-context cap eventually blocks 'Try again'.
      teardownAudio()
      trackFunnel('mic_denied')
      const message = (err as MicError | null)?.message
      setMicError(
        message !== undefined && message !== ''
          ? message
          : 'Microphone access was denied. Allow mic access to continue.',
      )
      if (mode() === 'guided') dispatch({ type: 'mic-denied' })
    }
  }

  /** Free Sing: one open 40 s take, then post-analysis — no targets. */
  async function runFreeFlow(): Promise<void> {
    const gen = ++flowGen
    setFreePhase('task')
    await brief(3)
    if (cancelled || gen !== flowGen) return
    const frames = await record(FREE_SING_SEC)
    // A mid-take reset/restore orphans this flow — it must not tear down
    // the successor run's audio or flip the UI to a dead results screen.
    if (cancelled || gen !== flowGen) return
    freeTakeFrames = frames
    teardownAudio()
    setFreeResult(computeFreeSing(freeTakeFrames))
    setFreePhase('results')
    trackFunnel('free_sing_done')
  }

  function buildFreeCard(): HTMLCanvasElement | null {
    const analysis = freeResult()
    if (!analysis) return null
    return renderCard(
      {
        result: { range: analysis.range, accuracy: null, steadiness: null },
        glides: [freeTakeFrames],
        title: '✦ FREE SING',
      },
      'story',
    )
  }

  async function onShareFree(): Promise<void> {
    const card = buildFreeCard()
    if (!card) return
    const outcome = await shareCard(
      await cardToPngBlob(card),
      datedFilename('free-sing'),
    )
    trackFunnel('card_shared')
    setShareStatus(
      outcome === 'shared' ? 'Shared!' : 'Saved — post it anywhere.',
    )
  }

  async function onCopyFree(): Promise<void> {
    const card = buildFreeCard()
    if (!card) return
    const outcome = await copyCardToClipboard(cardToPngBlob(card))
    if (outcome === 'copied') trackFunnel('card_shared')
    setShareStatus(copyOutcomeMessage(outcome))
  }

  async function runFlow(): Promise<void> {
    const gen = ++flowGen
    const alive = (): boolean => !cancelled && gen === flowGen

    // Task A — glide up, then down (union of both builds the range).
    // Each task opens with its demo animation behind an "I'm ready" gate,
    // so the instruction is fresh at the moment it matters. Every await is
    // followed by an alive() check before the next side effect — a stale
    // flow must never dispatch into (or re-arm the gate of) its successor.
    await taskIntro(gen)
    if (!alive()) return
    await brief(3)
    if (!alive()) return
    const glideUp = await record(GLIDE_SEC)
    if (!alive()) return
    dispatch({ type: 'glide-done', frames: glideUp })
    await taskIntro(gen)
    if (!alive()) return
    await brief(2)
    if (!alive()) return
    const glideDown = await record(GLIDE_SEC)
    if (!alive()) return
    dispatch({ type: 'glide-done', frames: glideDown })
    trackFunnel('task_glide_done')

    // Task B — hold.
    await taskIntro(gen)
    if (!alive()) return
    await brief(3)
    if (!alive()) return
    const holdTake = await record(HOLD_SEC)
    if (!alive()) return
    dispatch({ type: 'hold-done', frames: holdTake })
    trackFunnel('task_hold_done')

    // Task C — match 5, reference-then-record (never simultaneous).
    // One gate before round 1; rounds 2-5 keep the automatic rhythm.
    await taskIntro(gen)
    if (!alive()) return
    await brief(2)
    while (alive() && session().phase === 'match') {
      const state = session()
      const target = state.targets[state.matchIndex]
      const retrying = state.retriesUsed > 0
      setRetryNotice(retrying)
      if (retrying) await sleep(1200)
      setSubPhase('listening')
      if (audioContext) {
        await playReferenceTone(audioContext, target, REFERENCE_SEC)
      }
      if (!alive()) return
      // Breathing room: hear the note, then a short count-in before singing.
      await prepare(MATCH_PREPARE_SEC)
      if (!alive()) return
      const take = await record(MATCH_TAKE_SEC)
      if (!alive()) return
      const next = dispatch({ type: 'match-done', frames: take })
      if (next.phase === 'results') {
        trackFunnel('task_match_done')
        finishRun(next)
      }
    }
  }

  /** Render the shareable voiceprint canvas and mount it into the results
   *  host (the on-screen card front). Kept separate so real runs, restored
   *  takes and the dev demo path all paint the same way. Once the twin has
   *  been met, the front card carries the medallion too. */
  function paintCard(
    result: MirrorResult,
    glides: F0Frame[][],
    line: string,
    withMedallion = false,
  ): void {
    cardCanvas = renderCard(
      {
        result,
        glides,
        deltaLine: line,
        legend: withMedallion ? singerForRange(result.range) : null,
        legendImage: withMedallion ? legendImage() : null,
      },
      'square',
    )
    cardCanvas.className = 'mirror-voiceprint-canvas'
    voiceprintHost?.replaceChildren(cardCanvas)
  }

  // Once the singer has met their twin (first reveal), the on-screen data
  // card keeps the circular medallion — repaint when the portrait lands.
  createEffect(() => {
    if (!metTwin()) return
    if (legendImage() === null) return
    const state = session()
    if (state.phase !== 'results' || state.result === null) return
    paintCard(state.result, state.glides, deltaLine() ?? '', true)
  })

  function finishRun(state: MirrorSessionState): void {
    teardownAudio()
    const result = state.result
    if (!result) {
      trackFunnel('results_view')
      return
    }

    // Delta vs. the previous visit is read before this run replaces it.
    const summary = summarize(result)
    // The funnel's results_view carries the derived numbers (never audio),
    // so the db can answer "who did the mirror and what did they measure".
    trackFunnel('results_view', {
      lowMidi: summary.lowMidi,
      highMidi: summary.highMidi,
      semitones: summary.semitones,
      accuracy: summary.accuracy,
      steadiness: summary.steadiness,
    })
    const previous = deltaVsBaseline(localStorage, summary)
    const line = previous ? formatDeltaLine(previous.delta, previous.since) : ''
    setDeltaLine(line !== '' ? line : null)
    saveBaseline(localStorage, summary)

    // Flip is the one shipped reveal (the lenticular look lives on as the
    // "Share with twin" export; the animation stays reachable via ?mode=).
    setRevealed(false)
    setRevealMode('flip')

    preloadLegendPortrait(result)
    paintCard(result, state.glides, line)
    trackFunnel('card_generated')

    // Persist the run as take N and make the URL returnable: /mirror#take-N
    // restores this exact results page after navigating away.
    const attempt = saveAttempt(localStorage, {
      result,
      glides: state.glides,
      deltaLine: line,
    })
    setTakeN(attempt?.n ?? null)
    if (attempt !== null) {
      // Push, don't replace: landing → results becomes a real history step,
      // so Back returns to the landing (applyHash resets the screen) and
      // Forward re-restores this take. pushState fires no hashchange, so the
      // fresh results are not immediately re-restored from storage.
      history.pushState(null, '', `#${takeHash(attempt.n)}`)
    }
  }

  /** Restore a saved take (deep link / back-forward): the results page as it
   *  was when that run finished, reveal reset so the twin stays a tap away. */
  function restoreAttempt(n: number): boolean {
    const attempt = attemptByTake(localStorage, n)
    if (attempt === null) return false
    // Back/forward can land here mid-run — release the mic and stop the
    // detector before swapping the session to the stored results. The
    // orphaned flow's stale generation token kills it at its next checkpoint.
    teardownAudio()
    flowGen++
    releaseIntroGate()
    setHowtoOpen(false)
    starting = false
    // A restore can land mid-Free-Sing — clear its panels or they'd render
    // stacked on top of the restored guided results.
    setFreePhase(null)
    setFreeResult(null)
    setSubPhase('brief')
    setMetTwin(false)
    setRevealed(false)
    setRevealMode('flip')
    setIncludeTrace(true)
    setTwinTrace(false)
    setTwinData(false)
    setDeltaLine(attempt.deltaLine !== '' ? attempt.deltaLine : null)
    setTakeN(n)
    preloadLegendPortrait(attempt.result)
    paintCard(attempt.result, attempt.glides, attempt.deltaLine)
    setSession({
      ...initialSessionState(),
      phase: 'results',
      glides: attempt.glides,
      range: attempt.result.range,
      result: attempt.result,
    })
    return true
  }

  /** Dev-only: /mirror?demo=<profile>[&delta=1] jumps straight to a results
   *  screen built from synthetic frames (no mic), so the layout, card and
   *  reveal can be rendered and screenshotted. /mirror#<legend> (e.g.
   *  #freddie, #cher) is the fast-lane shorthand: that legend's profile,
   *  already revealed. Tree-shaken out of prod. Returns whether it installed
   *  a demo screen, so applyHash knows the fragment was consumed. */
  async function maybeStartDemo(): Promise<boolean> {
    const params = new URLSearchParams(window.location.search)
    const queryKey = params.get('demo')
    const hashKey = window.location.hash.replace(/^#/, '')
    if (queryKey === null && hashKey === '') return false
    const { DEMO_PROFILES, buildDemoResult } = await import('./demo-data')
    // Hash shorthand only counts when it names an own profile key — other
    // fragments (e.g. #sing-the-universe) belong to their own features, and
    // inherited keys (#constructor) must not resolve to a "profile".
    const fromHash = queryKey === null && Object.hasOwn(DEMO_PROFILES, hashKey)
    if (queryKey === null && !fromHash) return false
    const profileKey = queryKey ?? hashKey
    const profile = DEMO_PROFILES[profileKey] ?? DEMO_PROFILES.baritone
    const { result, glides } = buildDemoResult(profile)
    // Built by the real formatter so ?delta=1 screenshots stay pixel-faithful.
    const line =
      params.get('delta') !== null
        ? formatDeltaLine(
            { semitones: 5, accuracy: 1, steadiness: -11 },
            new Date('2026-07-07'),
          )
        : ''
    // ?mode= can force a reveal style for screenshots (lenticular stays
    // reachable here even though the shipped reveal is flip-only).
    const forced = params.get('mode')
    setRevealMode(forced === 'lenticular' ? 'lenticular' : 'flip')
    const startRevealed = fromHash || params.get('revealed') !== null
    setRevealed(startRevealed)
    setMetTwin(startRevealed)
    preloadLegendPortrait(result)
    paintCard(result, glides, line)
    setDeltaLine(line !== '' ? line : null)
    setSession({
      ...initialSessionState(),
      phase: 'results',
      glides,
      range: result.range,
      result,
    })
    return true
  }

  /** The clean data story card — legend as a circular medallion + name pill
   *  once revealed; honours the "pitch trace" card option. Keyed on metTwin
   *  (sticky), not the current flip state, so the share always matches the
   *  on-screen front card — flipping back must not strip the medallion. */
  function buildStoryCard(): HTMLCanvasElement | null {
    const state = session()
    if (!state.result) return null
    const legend = metTwin() ? singerForRange(state.result.range) : null
    return renderCard(
      {
        result: state.result,
        glides: state.glides,
        deltaLine: deltaLine(),
        legend,
        legendImage: legendImage(),
        showTrace: includeTrace(),
      },
      cardFormat(),
    )
  }

  /** The twin card — a pixel-faithful replica of the on-screen back face
   *  (full-opacity portrait, scrim, caption); the trace only when the
   *  "trace on twin" option is on. */
  function buildTwinCard(): HTMLCanvasElement | null {
    const state = session()
    const img = legendImage()
    if (!state.result || img === null) return null
    const legend = singerForRange(state.result.range)
    if (legend === null) return null
    return renderTwinFaceCard({
      legend,
      epithet: legendArt(legend).epithet,
      voiceType: state.result.range?.voiceHint ?? null,
      legendImage: img,
      showTrace: twinTrace(),
      showData: twinData(),
      result: state.result,
      glides: state.glides,
    })
  }

  /** Whether the twin share variant is possible — once the twin has been
   *  met it stays available even after flipping back to the data face. */
  const twinReady = (): boolean => metTwin() && legendImage() !== null

  /** Personal, distinct download names — never a model or asset name.
   *  e.g. "voice-twin-elvis-presley-take-3-2026-07-10.png" vs
   *  "voiceprint-take-3-2026-07-10.png", so saving both variants of the
   *  same run never collides. */
  function cardFilename(withTwin: boolean): string {
    const parts = [withTwin ? 'voice-twin' : 'voiceprint']
    if (withTwin) {
      const legend = singerForRange(session().result?.range ?? null)
      if (legend !== null) {
        parts.push(
          legend
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, ''),
        )
      }
    }
    const take = takeN()
    if (take !== null) parts.push(`take-${take}`)
    return datedFilename(parts.join('-'))
  }

  async function onShare(withTwin = false): Promise<void> {
    const card = withTwin && twinReady() ? buildTwinCard() : buildStoryCard()
    if (!card) return
    const outcome = await shareCard(
      await cardToPngBlob(card),
      cardFilename(withTwin),
    )
    trackFunnel('card_shared')
    setShareStatus(
      outcome === 'shared' ? 'Shared!' : 'Saved — post it anywhere.',
    )
  }

  async function onCopy(): Promise<void> {
    // Copy mirrors the face on screen: the twin while it's face-up,
    // otherwise the data card (with the medallion once the twin is met).
    const card =
      revealed() && legendImage() !== null ? buildTwinCard() : buildStoryCard()
    if (!card) return
    const outcome = await copyCardToClipboard(cardToPngBlob(card))
    if (outcome === 'copied') trackFunnel('card_shared')
    setShareStatus(copyOutcomeMessage(outcome))
  }

  const appUrl = (): string =>
    window.location.hostname.startsWith('mirror.')
      ? `https://${window.location.hostname.replace(/^mirror\./, '')}/#/exercises`
      : '/#/exercises'

  const currentTask = (): TaskCopy | null => TASK_COPY[session().phase] ?? null
  const isTaskPhase = (): boolean => currentTask() !== null
  const taskNumber = (): number =>
    session().phase === 'hold' ? 2 : session().phase === 'match' ? 3 : 1

  return (
    <div class="mirror-shell">
      <Show
        when={
          session().phase === 'idle' &&
          freePhase() === null &&
          !cosmicOpen() &&
          !howtoOpen()
        }
      >
        <Landing
          onStart={(selected) => {
            // First guided run detours through the animated overview; the
            // "Let's go" tap there becomes the mic-acquiring gesture.
            // Blocked storage reads as "never seen" — show the overview.
            const store = safeStorage()
            if (
              selected === 'guided' &&
              (store === null || !hasSeenHowItWorks(store))
            ) {
              setHowtoOpen(true)
              return
            }
            void start(selected)
          }}
          onHowItWorks={() => setHowtoOpen(true)}
        />
      </Show>

      <Show
        when={
          howtoOpen() &&
          session().phase === 'idle' &&
          freePhase() === null &&
          !cosmicOpen()
        }
      >
        <HowItWorks
          onLetsGo={() => {
            const store = safeStorage()
            if (store !== null) markHowItWorksSeen(store)
            trackFunnel('howto_done')
            // start() flips the phase synchronously, mounting the mic panel
            // before this overview's Show condition drops it.
            void start('guided')
            setHowtoOpen(false)
          }}
          onBack={() => setHowtoOpen(false)}
        />
      </Show>

      <Show
        when={
          session().phase === 'mic' ||
          session().phase === 'mic-denied' ||
          freePhase() === 'mic'
        }
      >
        <section class="mirror-panel">
          <h2>One thing first</h2>
          <p class="mirror-trust">
            Your audio never leaves this device — we analyze it right here in
            your browser. No recording is uploaded, ever.
          </p>
          <Show when={micError()}>
            <p class="mirror-error">{micError()}</p>
            <div class="mirror-actions">
              <button class="mirror-cta" onClick={() => void start()}>
                Try again
              </button>
              <button
                class="mirror-cta mirror-cta-secondary"
                onClick={() => resetAll()}
              >
                Back to start
              </button>
            </div>
          </Show>
          <Show when={micError() === null && micChecking()}>
            <p class="mirror-dim">Checking your microphone — say "ahh"…</p>
            <MicLevelBar level={() => f0?.latestLevel() ?? 0} />
            <Show when={activeMicLabel() !== ''}>
              <p class="mirror-dim mirror-mic-hearing">
                Listening to: {activeMicLabel()}
              </p>
            </Show>
          </Show>
          <Show when={micError() === null && micSilent() && !micChecking()}>
            <p class="mirror-error">
              We're not hearing much from your microphone.
            </p>
            <Show
              when={micDevices().length > 1}
              fallback={
                <p class="mirror-dim">
                  Close other apps that might be using the mic, check the
                  microphone permission in your phone's browser settings, then
                  test again.
                </p>
              }
            >
              <p class="mirror-dim">
                The browser picked{' '}
                {activeMicLabel() !== '' ? (
                  <strong>{activeMicLabel()}</strong>
                ) : (
                  'a default input'
                )}{' '}
                — if that's not the mic in front of you, switch it here and test
                again.
              </p>
              <div class="mirror-micpick">
                <label class="mirror-micpick-label" for="mirror-mic-select">
                  Microphone
                </label>
                <select
                  id="mirror-mic-select"
                  class="mirror-select"
                  value={activeMicId()}
                  onChange={(e) => void switchMicDevice(e.currentTarget.value)}
                >
                  <For each={micDevices()}>
                    {(device) => (
                      <option value={device.deviceId}>
                        {device.label !== '' ? device.label : 'Microphone'}
                      </option>
                    )}
                  </For>
                </select>
              </div>
            </Show>
            <MicLevelBar level={() => f0?.latestLevel() ?? 0} />
            <div class="mirror-actions">
              <button class="mirror-cta" onClick={() => void retryMicCheck()}>
                Test again
              </button>
              <button
                class="mirror-cta mirror-cta-secondary"
                onClick={() => beginFlow()}
              >
                Continue anyway
              </button>
              <button
                class="mirror-cta mirror-cta-secondary"
                onClick={() => resetAll()}
              >
                Back to start
              </button>
            </div>
          </Show>
          <Show when={micError() === null && !micChecking() && !micSilent()}>
            <p class="mirror-dim">Waiting for microphone permission…</p>
          </Show>
        </section>
      </Show>

      <Show when={freePhase() === 'task'}>
        <section class="mirror-panel">
          <h2>Just sing</h2>
          <p>
            Sing anything you like for 40 seconds — your shower song counts. No
            targets, no judgment: we map what your voice actually does.
          </p>
          <div class="mirror-stage">
            <Show when={subPhase() === 'brief'}>
              <div class="mirror-countdown">{Math.ceil(remaining())}</div>
            </Show>
            <Show when={subPhase() === 'recording'}>
              <LiveViz
                latest={() => f0?.latest() ?? null}
                mode="glide"
                targetMidi={null}
                resetKey={taskKey()}
              />
              <MicLevelBar level={() => f0?.latestLevel() ?? 0} />
              <div class="mirror-timebar">
                <div
                  class="mirror-timebar-fill"
                  style={{
                    width: `${Math.max(0, Math.min(100, (remaining() / FREE_SING_SEC) * 100))}%`,
                  }}
                />
              </div>
            </Show>
          </div>
        </section>
      </Show>

      <Show when={freePhase() === 'results'}>
        <FreeResults
          result={freeResult()}
          shareStatus={shareStatus()}
          onShare={() => void onShareFree()}
          onCopy={() => void onCopyFree()}
          onAgain={() => {
            setFreeResult(null)
            void start('free')
          }}
          onStartOver={() => resetAll()}
          appUrl={appUrl()}
        />
      </Show>

      <Show when={isTaskPhase()}>
        <section class="mirror-panel">
          <div class="mirror-progress">Task {taskNumber()} of 3</div>
          <h2>{currentTask()?.title}</h2>
          <p>{currentTask()?.instruction}</p>

          <Show when={session().phase === 'match'}>
            <p class="mirror-dim">
              Note {session().matchIndex + 1} of {session().targets.length}
              <Show when={retryNotice()}>
                {' '}
                — we couldn't hear a note there, one more try!
              </Show>
            </p>
          </Show>

          <div class="mirror-stage">
            <Show when={subPhase() === 'intro'}>
              <TaskDemo
                kind={session().phase as DemoKind}
                size="stage"
                label={`Animated demo: ${currentTask()?.instruction ?? ''}`}
                getAudioContext={() => audioContext}
              />
              <button
                class="mirror-cta mirror-cta-ready"
                ref={(el) => {
                  // Refs fire before insertion — focus once it's in the DOM.
                  requestAnimationFrame(() => el.focus({ preventScroll: true }))
                }}
                onClick={() => {
                  trackFunnel('task_intro_done')
                  releaseIntroGate()
                }}
              >
                I'm ready
              </button>
            </Show>
            <Show when={subPhase() === 'brief'}>
              <div class="mirror-countdown">{Math.ceil(remaining())}</div>
            </Show>
            <Show when={subPhase() === 'listening'}>
              <div class="mirror-listening">listen…</div>
            </Show>
            <Show when={subPhase() === 'prepare'}>
              <div class="mirror-prepare">
                <span class="mirror-prepare-label">your turn — sing it</span>
                <span class="mirror-countdown">{Math.ceil(remaining())}</span>
              </div>
            </Show>
            <Show when={subPhase() === 'recording'}>
              <LiveViz
                latest={() => f0?.latest() ?? null}
                mode={
                  session().phase === 'hold'
                    ? 'hold'
                    : session().phase === 'match'
                      ? 'match'
                      : 'glide'
                }
                targetMidi={
                  session().phase === 'match'
                    ? session().targets[session().matchIndex]
                    : null
                }
                resetKey={taskKey()}
              />
              <MicLevelBar level={() => f0?.latestLevel() ?? 0} />
              <div class="mirror-timebar">
                <div
                  class="mirror-timebar-fill"
                  style={{
                    width: `${Math.max(0, Math.min(100, (remaining() / (session().phase === 'hold' ? HOLD_SEC : session().phase === 'match' ? MATCH_TAKE_SEC : GLIDE_SEC)) * 100))}%`,
                  }}
                />
              </div>
            </Show>
          </div>
        </section>
      </Show>

      <Show when={cosmicOpen()}>
        <CosmicMode
          range={session().result?.range ?? null}
          onBack={() => setCosmic(false)}
          backLabel={
            session().result ? 'Back to results' : 'Back to Voice Mirror'
          }
        />
      </Show>

      <Show
        when={
          session().phase === 'results' && session().result && !cosmicOpen()
        }
      >
        <Results
          result={session().result as MirrorResult}
          deltaLine={deltaLine()}
          shareStatus={shareStatus()}
          revealed={revealed()}
          revealMode={revealMode()}
          twinReady={twinReady()}
          includeTrace={includeTrace()}
          onToggleTrace={() => setIncludeTrace((v) => !v)}
          cardFormat={cardFormat()}
          onToggleFormat={() =>
            setCardFormat((f) => (f === 'story' ? 'square' : 'story'))
          }
          twinTrace={twinTrace()}
          onToggleTwinTrace={() => setTwinTrace((v) => !v)}
          twinData={twinData()}
          onToggleTwinData={() => setTwinData((v) => !v)}
          onToggleReveal={() => {
            const next = !revealed()
            setRevealed(next)
            if (next) {
              setMetTwin(true) // the front card keeps the medallion from now on
              trackFunnel('twin_revealed')
            }
          }}
          onShare={() => void onShare()}
          onShareTwin={() => void onShare(true)}
          onCopy={() => void onCopy()}
          onCosmic={() => setCosmic(true)}
          onStartOver={() => resetAll()}
          appUrl={appUrl()}
          voiceprintRef={(el) => {
            voiceprintHost = el
            if (cardCanvas) el.replaceChildren(cardCanvas)
          }}
        />
      </Show>
    </div>
  )
}

const Landing: Component<{
  onStart: (mode: 'guided' | 'free') => void
  onHowItWorks: () => void
}> = (props) => (
  <section class="mirror-panel mirror-landing">
    <p class="mirror-wordmark">MercuryPitch</p>
    <h1>See your voice. 60 seconds.</h1>
    <p>
      Sing three short tasks and get your vocal range, pitch accuracy and
      steadiness — rendered as a voiceprint you can share.
    </p>
    <div class="mirror-actions">
      <button class="mirror-cta" onClick={() => props.onStart('guided')}>
        Start singing
      </button>
      <button
        class="mirror-cta mirror-cta-secondary"
        onClick={() => props.onStart('free')}
      >
        Just sing · 40 s
      </button>
    </div>
    <button class="mirror-textbtn" onClick={() => props.onHowItWorks()}>
      How it works
    </button>
    <p class="mirror-trust">
      Your audio never leaves this device — we analyze it right here in your
      browser.
    </p>
    <p class="mirror-crosslink">
      Or{' '}
      <a href="/glass" onClick={() => trackFunnel('cta_glass_click')}>
        break glass with your voice
      </a>
      .
    </p>
  </section>
)

const FreeResults: Component<{
  result: FreeSingResult | null
  shareStatus: string | null
  onShare: () => void
  onCopy: () => void
  onAgain: () => void
  onStartOver: () => void
  appUrl: string
}> = (props) => {
  const r = (): FreeSingResult | null => props.result
  const styleLabel = (): string => {
    const agility = r()?.agilityMovesPerSec ?? 0
    if (agility >= 0.8) return "You're a mover — lots of melodic motion."
    if (agility <= 0.3) return "You're a sustainer — you live in held notes."
    return 'You balance held notes and melodic motion.'
  }
  return (
    <section class="mirror-panel mirror-results">
      <Show
        when={r()}
        fallback={
          <>
            <h2>We couldn't hear enough</h2>
            <p class="mirror-dim">
              A quieter room — or singing a little louder — usually fixes it.
            </p>
            <button class="mirror-cta" onClick={() => props.onAgain()}>
              Try again
            </button>
          </>
        }
      >
        <h1 class="mirror-hero">
          {r()?.range?.lowNote ?? '—'} – {r()?.range?.highNote ?? '—'}
          <span class="mirror-hero-sub"> · in use</span>
        </h1>
        <p class="mirror-chip">
          You live around {r()?.homeNote} · comfortable middle{' '}
          {r()?.tessituraLowNote}–{r()?.tessituraHighNote}
        </p>
        <Show when={r()?.phrases}>
          <div class="mirror-stat">
            <h3>Breath</h3>
            <p>
              {r()?.phrases?.count} phrases — median{' '}
              {r()?.phrases?.medianSec.toFixed(1)} s, longest{' '}
              {r()?.phrases?.longestSec.toFixed(1)} s
              {(r()?.phrases?.longestSec ?? 0) >= 6
                ? ' — solid breath support.'
                : ' — breath support to build on.'}
            </p>
          </div>
        </Show>
        <div class="mirror-stat">
          <h3>Style</h3>
          <p>{styleLabel()}</p>
        </div>
        <Show when={r()?.vibrato}>
          <div class="mirror-stat">
            <h3>Vibrato</h3>
            <p>
              {r()?.vibrato?.rateHz.toFixed(1)} Hz, ±{r()?.vibrato?.extentCents}{' '}
              cents on your longest note — a feature worth keeping.
            </p>
          </div>
        </Show>
        <div class="mirror-actions">
          <button class="mirror-cta" onClick={() => props.onShare()}>
            <IconShare size={20} />
            Share my voiceprint
          </button>
          <Show when={supportsImageClipboard()}>
            <button
              class="mirror-cta mirror-cta-secondary"
              onClick={() => props.onCopy()}
              title="Copy the voiceprint image to the clipboard"
            >
              <IconCopy />
              Copy
            </button>
          </Show>
          <button
            class="mirror-cta mirror-cta-secondary"
            onClick={() => props.onAgain()}
          >
            Sing again
          </button>
          <a
            class="mirror-cta mirror-cta-secondary"
            href={props.appUrl}
            target="_blank"
            rel="noopener"
            onClick={() => trackFunnel('cta_app_click')}
          >
            <IconRocket />
            Open MercuryPitch
          </a>
          <button
            class="mirror-cta mirror-cta-secondary"
            onClick={() => props.onStartOver()}
          >
            Start over
          </button>
        </div>
        <Show when={props.shareStatus}>
          <p class="mirror-dim">{props.shareStatus}</p>
        </Show>
      </Show>
    </section>
  )
}

const BAND_LABEL: Record<NoteTakeResult['band'], string> = {
  bullseye: 'bullseye',
  hit: 'hit',
  close: 'close',
  miss: 'miss',
  'no-voice': 'no note heard',
}

const Results: Component<{
  result: MirrorResult
  deltaLine: string | null
  shareStatus: string | null
  revealed: boolean
  revealMode: RevealMode
  /** Twin share/copy variant available (revealed + portrait decoded). */
  twinReady: boolean
  /** Card option: include the pitch glide trace on shared cards. */
  includeTrace: boolean
  onToggleTrace: () => void
  /** Card option: exported shape — square (1:1) vs story (9:16). */
  cardFormat: CardFormat
  onToggleFormat: () => void
  /** Card option: draw the trace over the twin card too (default off). */
  twinTrace: boolean
  onToggleTwinTrace: () => void
  /** Card option: the run's data block on the twin card (default off). */
  twinData: boolean
  onToggleTwinData: () => void
  onToggleReveal: () => void
  onShare: () => void
  onShareTwin: () => void
  onCopy: () => void
  onCosmic: () => void
  onStartOver: () => void
  appUrl: string
  voiceprintRef: (el: HTMLDivElement) => void
}> = (props) => {
  const range = (): MirrorResult['range'] => props.result.range
  const accuracy = (): MirrorResult['accuracy'] => props.result.accuracy
  const steadiness = (): MirrorResult['steadiness'] => props.result.steadiness
  const hits = (): number =>
    accuracy()?.takes.filter((t) => t.band === 'bullseye' || t.band === 'hit')
      .length ?? 0
  const drift = (): number => steadiness()?.driftCentsPerSec ?? 0
  const legend = (): string | null => singerForRange(range())

  // The card's data lives only in canvas pixels; this is its spoken and
  // machine-readable summary (RevealCard aria-label).
  const frontLabel = (): string | undefined => {
    const r = range()
    if (r === null) return undefined
    const extras = [
      accuracy() !== null ? `accuracy ${accuracy()?.score}` : null,
      steadiness() !== null ? `steadiness ${steadiness()?.score}` : null,
    ].filter((s): s is string => s !== null)
    const tail = extras.length > 0 ? `, ${extras.join(', ')}` : ''
    return `Your voiceprint: ${r.lowNote} to ${r.highNote}, ${r.semitones} semitones${tail}`
  }

  return (
    <section class="mirror-panel mirror-results">
      <Show when={props.deltaLine}>
        <p class="mirror-delta">{props.deltaLine}</p>
      </Show>

      {/* The voiceprint card centered, with the detail "notes" flanking it
          (left / right on desktop, stacked under it on mobile). */}
      <div class="mirror-results-grid">
        <Show when={accuracy()}>
          <div class="mirror-notecard mirror-notecard-left">
            <div class="mirror-notecard-head">
              <span class="mirror-notecard-label">Accuracy</span>
              <span class="mirror-notecard-score">{accuracy()?.score}</span>
            </div>
            <div class="mirror-pips">
              <For each={accuracy()?.takes}>
                {(take) => (
                  <span
                    class={`mirror-pip mirror-pip-${take.band}`}
                    title={`${midiToNoteNameOctave(take.targetMidi)}: ${BAND_LABEL[take.band]}`}
                  />
                )}
              </For>
            </div>
            <p>
              You hit {hits()} of {accuracy()?.takes.length} targets within a
              third of a semitone
              {hits() >= 3
                ? ' — your ear is ahead of your control, the good order.'
                : ' — a trainable skill, and this is the honest baseline.'}
            </p>
            <Show when={accuracy()?.scoopMedianMs !== null}>
              <p class="mirror-note-sub">
                {(accuracy()?.scoopMedianMs ?? 0) > 120
                  ? `You scoop ~${accuracy()?.scoopMedianMs} ms into notes — try landing the pitch directly.`
                  : `Clean onset — you settle in ~${accuracy()?.scoopMedianMs} ms.`}
              </p>
            </Show>
          </div>
        </Show>

        <div class="mirror-card-col">
          <RevealCard
            legend={legend()}
            voiceType={range()?.voiceHint ?? null}
            mode={props.revealMode}
            revealed={props.revealed}
            frontLabel={frontLabel()}
            onToggle={props.onToggleReveal}
            mountFront={props.voiceprintRef}
          />
          <Show when={!range()}>
            <p class="mirror-dim">
              We couldn't map a range this time — a quieter room usually fixes
              it.
            </p>
          </Show>
        </div>

        <Show when={steadiness()}>
          <div class="mirror-notecard mirror-notecard-right">
            <div class="mirror-notecard-head">
              <span class="mirror-notecard-label">Steadiness</span>
              <span class="mirror-notecard-score">{steadiness()?.score}</span>
            </div>
            <p>
              Your hold drifted ~{Math.abs(drift()).toFixed(1)} cents/sec{' '}
              {drift() < 0 ? 'flat' : 'sharp'} with ±
              {(steadiness()?.wobbleSdCents ?? 0).toFixed(0)} cents of wobble.
            </p>
            <Show when={steadiness()?.vibrato}>
              <p class="mirror-note-sub">
                Vibrato {steadiness()?.vibrato?.rateHz.toFixed(1)} Hz, ±
                {steadiness()?.vibrato?.extentCents} cents — a feature, not
                scored against you.
              </p>
            </Show>
          </div>
        </Show>
      </div>

      <div class="mirror-actions mirror-actions-hero">
        {/* Two main shares once the twin is revealed: the clean data card
            (legend as a name pill) and the twin card with the portrait
            blended behind the data. */}
        <div class="mirror-share-row">
          <button
            class="mirror-cta mirror-cta-hero"
            onClick={() => props.onShare()}
            title="Share the clean voiceprint card"
          >
            <IconShare size={20} />
            Share voiceprint
          </button>
          <Show when={props.twinReady}>
            <button
              class="mirror-cta mirror-cta-hero mirror-cta-twin"
              onClick={() => props.onShareTwin()}
              title="Share the card with your twin's portrait behind the data"
            >
              <IconSpark size={18} />
              Share with twin
            </button>
          </Show>
        </div>
        <div class="mirror-cardopts">
          <button
            type="button"
            class="mirror-optchip"
            classList={{ on: props.includeTrace }}
            aria-pressed={props.includeTrace}
            onClick={() => props.onToggleTrace()}
            title="Include the pitch glide trace on the voiceprint card"
          >
            <IconTrace size={15} />
            Pitch trace {props.includeTrace ? 'on' : 'off'}
          </button>
          <button
            type="button"
            class="mirror-optchip"
            classList={{ on: props.cardFormat === 'story' }}
            aria-pressed={props.cardFormat === 'story'}
            onClick={() => props.onToggleFormat()}
            title="Export a tall 9:16 story card (for Instagram/TikTok stories) instead of the square card"
          >
            Story format {props.cardFormat === 'story' ? 'on' : 'off'}
          </button>
          <Show when={props.twinReady}>
            <button
              type="button"
              class="mirror-optchip"
              classList={{ on: props.twinTrace }}
              aria-pressed={props.twinTrace}
              onClick={() => props.onToggleTwinTrace()}
              title="Draw the pitch trace over the twin card too (off keeps the twin's face clean)"
            >
              <IconTrace size={15} />
              Trace on twin {props.twinTrace ? 'on' : 'off'}
            </button>
            <button
              type="button"
              class="mirror-optchip"
              classList={{ on: props.twinData }}
              aria-pressed={props.twinData}
              onClick={() => props.onToggleTwinData()}
              title="Show your range, accuracy and steadiness on the twin card instead of the caption"
            >
              <IconStats size={15} />
              Data on twin {props.twinData ? 'on' : 'off'}
            </button>
          </Show>
        </div>
        <div class="mirror-actions-sub">
          <Show when={supportsImageClipboard()}>
            <button
              class="mirror-cta mirror-cta-secondary mirror-cta-sm"
              onClick={() => props.onCopy()}
              title="Copy the voiceprint image to the clipboard"
            >
              <IconCopy />
              Copy
            </button>
          </Show>
          <button
            class="mirror-cta mirror-cta-secondary mirror-cta-sm"
            onClick={() => props.onCosmic()}
          >
            <IconGalaxy />
            Sing the Universe
          </button>
          <a
            class="mirror-cta mirror-cta-secondary mirror-cta-sm"
            href={props.appUrl}
            target="_blank"
            rel="noopener"
            onClick={() => trackFunnel('cta_app_click')}
          >
            <IconRocket />
            Open MercuryPitch
          </a>
        </div>
        <button class="mirror-textbtn" onClick={() => props.onStartOver()}>
          Start over
        </button>
      </div>
      <Show when={props.shareStatus}>
        <p class="mirror-dim mirror-sharestatus">{props.shareStatus}</p>
      </Show>
      <p class="mirror-foot">
        Saved on this device only — come back any time to see your delta.
      </p>
    </section>
  )
}
