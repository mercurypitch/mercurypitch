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
import { createSignal, For, onCleanup, onMount, Show } from 'solid-js'
import type { MicError } from '@/lib/mic-manager'
import { micManager } from '@/lib/mic-manager'
import { deltaVsBaseline, saveBaseline } from '@/lib/mirror/baseline'
import type { FreeSingResult } from '@/lib/mirror/free-sing'
import { computeFreeSing } from '@/lib/mirror/free-sing'
import type { F0Frame, MirrorResult, NoteTakeResult, } from '@/lib/mirror/metrics'
import { summarize } from '@/lib/mirror/metrics'
import type { MirrorEvent, MirrorSessionState } from '@/lib/mirror/session'
import { initialSessionState, reduceSession } from '@/lib/mirror/session'
import { singerForVoiceType } from '@/lib/mirror/singer-match'
import { midiToNoteNameOctave } from '@/lib/note-utils'
import { cardToPngBlob, copyCardToClipboard, copyOutcomeMessage, datedFilename, formatDeltaLine, renderCard, shareCard, supportsImageClipboard, } from './card-renderer'
import { CosmicMode } from './CosmicMode'
import type { F0Stream } from './f0-stream'
import { createF0Stream } from './f0-stream'
import { trackFunnel } from './funnel'
import { IconCopy, IconGalaxy, IconRocket, IconShare } from './icons'
import { legendArt } from './LegendCaricature'
import { LiveViz, MicLevelBar } from './LiveViz'
import type { RevealMode } from './RevealCard'
import { RevealCard } from './RevealCard'
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

// Deep-link fragment for the cosmic "Sing the Universe" mode. The landing page
// links straight to /mirror#sing-the-universe, and share cards / the browser
// URL reflect it — keep this string in sync with those. A fragment never
// reaches the Worker, so no server route is needed; the SPA reads it here.
const COSMIC_HASH = 'sing-the-universe'
const isCosmicHash = (): boolean =>
  window.location.hash.replace(/^#/, '') === COSMIC_HASH

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms))

type SubPhase = 'brief' | 'recording' | 'listening' | 'prepare'

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
  const [retryNotice, setRetryNotice] = createSignal(false)
  const [shareStatus, setShareStatus] = createSignal<string | null>(null)
  const [deltaLine, setDeltaLine] = createSignal<string | null>(null)
  const [mode, setMode] = createSignal<'guided' | 'free'>('guided')
  const [freePhase, setFreePhase] = createSignal<
    null | 'mic' | 'task' | 'results'
  >(null)
  const [freeResult, setFreeResult] = createSignal<FreeSingResult | null>(null)
  // Initialized from the URL fragment so a /mirror#sing-the-universe deep link
  // opens cosmic mode on the first paint (no Landing flash before onMount runs).
  const [cosmicOpen, setCosmicOpen] = createSignal(isCosmicHash())
  // Legend "voice twin" reveal on the results card. The style defaults to flip
  // on a first visit and lenticular on a returning (delta) visit — the singer
  // can also switch to compare.
  const [revealed, setRevealed] = createSignal(false)
  const [revealMode, setRevealMode] = createSignal<RevealMode>('flip')

  let audioContext: AudioContext | null = null
  let f0: F0Stream | null = null
  let cancelled = false
  let freeTakeFrames: F0Frame[] = []
  // Guards double-taps on Start/Try-again/Test-again: a second concurrent
  // start would orphan AudioContexts and drive two flows over one session.
  let starting = false
  let cardCanvas: HTMLCanvasElement | null = null
  let voiceprintHost: HTMLDivElement | undefined
  // The twin's raster portrait, decoded ahead of the share tap: ClipboardItem
  // must be constructed synchronously inside the gesture (Safari), so the
  // story card can't await an image load at share time.
  let legendImageEl: HTMLImageElement | null = null

  /** Kick off decoding the legend portrait for a finished run (if any). */
  function preloadLegendPortrait(result: MirrorResult | null): void {
    legendImageEl = null
    const r = result?.range ?? null
    if (r === null) return
    const legend = singerForVoiceType(r.voiceHint, r.lowMidi, r.highMidi)
    if (legend === null) return
    const src = legendArt(legend).imageSrc
    if (src === undefined) return
    const img = new Image()
    img.src = src
    img
      .decode()
      .then(() => {
        legendImageEl = img
      })
      .catch(() => undefined) // missing file → pill-only share card
  }

  const dispatch = (event: MirrorEvent): MirrorSessionState => {
    const next = reduceSession(session(), event)
    setSession(next)
    return next
  }

  onMount(() => {
    trackFunnel('mirror_view')
    if (import.meta.env.DEV) void maybeStartDemo()
    // Keep cosmic mode in sync when the fragment changes after load (manual
    // edit, or browser back/forward). Initial deep-link is handled by the
    // cosmicOpen initializer above.
    const onHashChange = (): void => {
      setCosmicOpen(isCosmicHash())
    }
    window.addEventListener('hashchange', onHashChange)
    onCleanup(() => window.removeEventListener('hashchange', onHashChange))
  })
  onCleanup(() => {
    cancelled = true
    teardownAudio()
  })

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
    starting = false
    cardCanvas = null
    legendImageEl = null
    setSession(initialSessionState())
    setFreePhase(null)
    setFreeResult(null)
    setDeltaLine(null)
    setShareStatus(null)
    setMicError(null)
    setMicSilent(false)
    setRetryNotice(false)
    setCosmic(false)
    setRevealed(false)
    setRevealMode('flip')
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

  /** Countdown helper driving the `remaining` signal. */
  async function countdown(seconds: number): Promise<void> {
    const start = performance.now()
    setRemaining(seconds)
    while (!cancelled) {
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
    setTaskKey((k) => k + 1)
    setSubPhase('recording')
    f0.startTask()
    await countdown(seconds)
    // f0 may have been torn down while we were awaiting (unmount mid-take).
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

  /** Silence check with one automatic graph rebuild (the iOS WebKit fix). */
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
    setFreePhase('task')
    await brief(3)
    if (cancelled) return
    freeTakeFrames = await record(FREE_SING_SEC)
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
    // Task A — glide up, then down (union of both builds the range).
    await brief(3)
    if (cancelled) return
    dispatch({ type: 'glide-done', frames: await record(GLIDE_SEC) })
    await brief(2)
    if (cancelled) return
    dispatch({ type: 'glide-done', frames: await record(GLIDE_SEC) })
    trackFunnel('task_glide_done')

    // Task B — hold.
    await brief(3)
    if (cancelled) return
    dispatch({ type: 'hold-done', frames: await record(HOLD_SEC) })
    trackFunnel('task_hold_done')

    // Task C — match 5, reference-then-record (never simultaneous).
    await brief(2)
    while (!cancelled && session().phase === 'match') {
      const state = session()
      const target = state.targets[state.matchIndex]
      const retrying = state.retriesUsed > 0
      setRetryNotice(retrying)
      if (retrying) await sleep(1200)
      setSubPhase('listening')
      if (audioContext) {
        await playReferenceTone(audioContext, target, REFERENCE_SEC)
      }
      if (cancelled) return
      // Breathing room: hear the note, then a short count-in before singing.
      await prepare(MATCH_PREPARE_SEC)
      if (cancelled) return
      const next = dispatch({
        type: 'match-done',
        frames: await record(MATCH_TAKE_SEC),
      })
      if (next.phase === 'results') {
        trackFunnel('task_match_done')
        finishRun(next)
      }
    }
  }

  /** Render the shareable voiceprint canvas and mount it into the results
   *  host (the on-screen card front). Kept separate so both a real run and
   *  the dev demo path paint the same way. */
  function paintCard(
    result: MirrorResult,
    glides: F0Frame[][],
    line: string,
  ): void {
    cardCanvas = renderCard({ result, glides, deltaLine: line }, 'square')
    cardCanvas.className = 'mirror-voiceprint-canvas'
    voiceprintHost?.replaceChildren(cardCanvas)
  }

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

    // First visit → flip; returning (delta) visit → lenticular.
    setRevealed(false)
    setRevealMode(previous ? 'lenticular' : 'flip')

    preloadLegendPortrait(result)
    paintCard(result, state.glides, line)
    trackFunnel('card_generated')
  }

  /** Dev-only: /mirror?demo=<profile>[&delta=1] jumps straight to a results
   *  screen built from synthetic frames (no mic), so the layout, card and
   *  reveal can be rendered and screenshotted. Tree-shaken out of prod. */
  async function maybeStartDemo(): Promise<void> {
    const params = new URLSearchParams(window.location.search)
    const profileKey = params.get('demo')
    if (profileKey === null) return
    const { DEMO_PROFILES, buildDemoResult } = await import('./demo-data')
    const profile = DEMO_PROFILES[profileKey] ?? DEMO_PROFILES.baritone
    const { result, glides } = buildDemoResult(profile)
    const line =
      params.get('delta') !== null
        ? '▲ +5 semitones · accuracy +1 · steadiness −11 since Jul 7'
        : ''
    // Let ?mode= force a reveal style for screenshots; otherwise flip on a
    // first visit, lenticular on a delta visit.
    const forced = params.get('mode')
    setRevealMode(
      forced === 'flip' || forced === 'lenticular'
        ? forced
        : line !== ''
          ? 'lenticular'
          : 'flip',
    )
    setRevealed(params.get('revealed') !== null)
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
  }

  function buildStoryCard(): HTMLCanvasElement | null {
    const state = session()
    if (!state.result) return null
    // Once the twin is revealed, bake the legend into the shared card too.
    const r = state.result.range
    const legend =
      revealed() && r
        ? singerForVoiceType(r.voiceHint, r.lowMidi, r.highMidi)
        : null
    return renderCard(
      {
        result: state.result,
        glides: state.glides,
        deltaLine: deltaLine(),
        legend,
        legendImage: legendImageEl,
      },
      'story',
    )
  }

  async function onShare(): Promise<void> {
    const card = buildStoryCard()
    if (!card) return
    const outcome = await shareCard(
      await cardToPngBlob(card),
      datedFilename('voiceprint'),
    )
    trackFunnel('card_shared')
    setShareStatus(
      outcome === 'shared' ? 'Shared!' : 'Saved — post it anywhere.',
    )
  }

  async function onCopy(): Promise<void> {
    const card = buildStoryCard()
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
          session().phase === 'idle' && freePhase() === null && !cosmicOpen()
        }
      >
        <Landing onStart={(selected) => void start(selected)} />
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
          </Show>
          <Show when={micError() === null && micSilent() && !micChecking()}>
            <p class="mirror-error">
              We're not hearing anything from your microphone.
            </p>
            <p class="mirror-dim">
              Close other apps that might be using the mic, check the microphone
              permission in your phone's browser settings, then test again.
            </p>
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
          onToggleReveal={() => {
            const next = !revealed()
            setRevealed(next)
            if (next) trackFunnel('twin_revealed')
          }}
          onSetRevealMode={(m) => {
            setRevealMode(m)
            setRevealed(false)
          }}
          onShare={() => void onShare()}
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
    <p class="mirror-trust">
      Your audio never leaves this device — we analyze it right here in your
      browser.
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
  onToggleReveal: () => void
  onSetRevealMode: (mode: RevealMode) => void
  onShare: () => void
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
  const legend = (): string | null => {
    const r = range()
    return r ? singerForVoiceType(r.voiceHint, r.lowMidi, r.highMidi) : null
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
            onToggle={props.onToggleReveal}
            mountFront={props.voiceprintRef}
          />
          <Show when={legend()}>
            <div
              class="mirror-reveal-toggle"
              role="group"
              aria-label="Reveal style"
            >
              <button
                type="button"
                class={props.revealMode === 'flip' ? 'active' : ''}
                onClick={() => props.onSetRevealMode('flip')}
              >
                Flip
              </button>
              <button
                type="button"
                class={props.revealMode === 'lenticular' ? 'active' : ''}
                onClick={() => props.onSetRevealMode('lenticular')}
              >
                Lenticular
              </button>
            </div>
          </Show>
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

      <div class="mirror-actions">
        <button
          class="mirror-cta mirror-cta-hero"
          onClick={() => props.onShare()}
        >
          <IconShare size={20} />
          Share my voiceprint
        </button>
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
