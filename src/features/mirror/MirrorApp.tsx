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
import type { F0Frame, MirrorResult, NoteTakeResult, } from '@/lib/mirror/metrics'
import { summarize } from '@/lib/mirror/metrics'
import type { MirrorEvent, MirrorSessionState } from '@/lib/mirror/session'
import { initialSessionState, reduceSession } from '@/lib/mirror/session'
import { midiToNoteNameOctave } from '@/lib/note-utils'
import { cardToPngBlob, formatDeltaLine, renderCard, shareCard, } from './card-renderer'
import type { F0Stream } from './f0-stream'
import { createF0Stream } from './f0-stream'
import { trackFunnel } from './funnel'
import { LiveViz } from './LiveViz'
import { playReferenceTone } from './tone-player'

const GLIDE_SEC = 8
const HOLD_SEC = 6
const REFERENCE_SEC = 1
const MATCH_TAKE_SEC = 3
const MIC_CONSUMER_ID = 'voice-mirror'

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms))

type SubPhase = 'brief' | 'recording' | 'listening'

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
  const [retryNotice, setRetryNotice] = createSignal(false)
  const [shareStatus, setShareStatus] = createSignal<string | null>(null)
  const [deltaLine, setDeltaLine] = createSignal<string | null>(null)

  let audioContext: AudioContext | null = null
  let f0: F0Stream | null = null
  let cancelled = false
  let cardCanvas: HTMLCanvasElement | null = null
  let voiceprintHost: HTMLDivElement | undefined

  const dispatch = (event: MirrorEvent): MirrorSessionState => {
    const next = reduceSession(session(), event)
    setSession(next)
    return next
  }

  onMount(() => trackFunnel('mirror_view'))
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

  async function record(seconds: number): Promise<F0Frame[]> {
    if (!f0) return []
    setTaskKey((k) => k + 1)
    setSubPhase('recording')
    f0.startTask()
    await countdown(seconds)
    // f0 may have been torn down while we were awaiting (unmount mid-take).
    return f0?.takeFrames() ?? []
  }

  /** The scariest moment is the biggest trust moment: mic + audio context are
   *  created inside this tap handler (required by iOS Safari). */
  async function start(): Promise<void> {
    dispatch({ type: 'start' })
    try {
      audioContext = new AudioContext()
      if (audioContext.state === 'suspended') await audioContext.resume()
      const stream = await micManager.acquire(MIC_CONSUMER_ID)
      f0 = createF0Stream(audioContext, stream)
      trackFunnel('mic_granted')
      setMicError(null)
      dispatch({ type: 'mic-granted' })
      void runFlow()
    } catch (err) {
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
      dispatch({ type: 'mic-denied' })
    }
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

  function finishRun(state: MirrorSessionState): void {
    teardownAudio()
    trackFunnel('results_view')
    const result = state.result
    if (!result) return

    // Delta vs. the previous visit is read before this run replaces it.
    const summary = summarize(result)
    const previous = deltaVsBaseline(localStorage, summary)
    const line = previous ? formatDeltaLine(previous.delta, previous.since) : ''
    setDeltaLine(line !== '' ? line : null)
    saveBaseline(localStorage, summary)

    cardCanvas = renderCard(
      { result, glides: state.glides, deltaLine: line },
      'square',
    )
    trackFunnel('card_generated')
    cardCanvas.className = 'mirror-voiceprint-canvas'
    voiceprintHost?.replaceChildren(cardCanvas)
  }

  async function onShare(): Promise<void> {
    const state = session()
    if (!state.result) return
    const storyCard = renderCard(
      { result: state.result, glides: state.glides, deltaLine: deltaLine() },
      'story',
    )
    const blob = await cardToPngBlob(storyCard)
    const outcome = await shareCard(blob)
    trackFunnel('card_shared')
    setShareStatus(
      outcome === 'shared' ? 'Shared!' : 'Saved — post it anywhere.',
    )
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
      <Show when={session().phase === 'idle'}>
        <Landing onStart={() => void start()} />
      </Show>

      <Show
        when={session().phase === 'mic' || session().phase === 'mic-denied'}
      >
        <section class="mirror-panel">
          <h2>One thing first</h2>
          <p class="mirror-trust">
            Your audio never leaves this device — we analyze it right here in
            your browser. No recording is uploaded, ever.
          </p>
          <Show when={micError()}>
            <p class="mirror-error">{micError()}</p>
            <button class="mirror-cta" onClick={() => void start()}>
              Try again
            </button>
          </Show>
          <Show when={micError() === null}>
            <p class="mirror-dim">Waiting for microphone permission…</p>
          </Show>
        </section>
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

      <Show when={session().phase === 'results' && session().result}>
        <Results
          result={session().result as MirrorResult}
          deltaLine={deltaLine()}
          shareStatus={shareStatus()}
          onShare={() => void onShare()}
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

const Landing: Component<{ onStart: () => void }> = (props) => (
  <section class="mirror-panel mirror-landing">
    <p class="mirror-wordmark">MERCURYPITCH</p>
    <h1>See your voice. 60 seconds.</h1>
    <p>
      Sing three short tasks and get your vocal range, pitch accuracy and
      steadiness — rendered as a voiceprint you can share.
    </p>
    <button class="mirror-cta" onClick={() => props.onStart()}>
      Start singing
    </button>
    <p class="mirror-trust">
      Your audio never leaves this device — we analyze it right here in your
      browser.
    </p>
  </section>
)

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
  onShare: () => void
  appUrl: string
  voiceprintRef: (el: HTMLDivElement) => void
}> = (props) => {
  const range = (): MirrorResult['range'] => props.result.range
  const accuracy = (): MirrorResult['accuracy'] => props.result.accuracy
  const steadiness = (): MirrorResult['steadiness'] => props.result.steadiness
  const hits = (): number =>
    accuracy()?.takes.filter((t) => t.band === 'bullseye' || t.band === 'hit')
      .length ?? 0

  return (
    <section class="mirror-panel mirror-results">
      <div class="mirror-voiceprint" ref={props.voiceprintRef} />

      <Show when={props.deltaLine}>
        <p class="mirror-delta">{props.deltaLine}</p>
      </Show>

      <Show
        when={range()}
        fallback={
          <p class="mirror-dim">
            We couldn't map a range this time — a quieter room usually fixes it.
          </p>
        }
      >
        <h1 class="mirror-hero">
          {range()?.lowNote} – {range()?.highNote}
          <span class="mirror-hero-sub"> · {range()?.semitones} semitones</span>
        </h1>
        <Show when={range()?.voiceHint}>
          <p
            class="mirror-chip"
            title="Voice classification really depends on timbre and tessitura, not range alone — this stays a hint."
          >
            Your range overlaps most with: {range()?.voiceHint}
          </p>
        </Show>
      </Show>

      <Show when={accuracy()}>
        <div class="mirror-stat">
          <h3>Accuracy {accuracy()?.score}</h3>
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
              ? ' — your ear is ahead of your control, which is the good order.'
              : ' — matching is a trainable skill, and this is the honest baseline.'}
          </p>
        </div>
      </Show>

      <Show when={steadiness()}>
        <div class="mirror-stat">
          <h3>Steadiness {steadiness()?.score}</h3>
          <p>
            Your hold drifted ~
            {Math.abs(steadiness()?.driftCentsPerSec ?? 0).toFixed(1)} cents/sec{' '}
            {(steadiness()?.driftCentsPerSec ?? 0) < 0 ? 'flat' : 'sharp'} with
            ±{(steadiness()?.wobbleSdCents ?? 0).toFixed(0)} cents of wobble.
          </p>
        </div>
      </Show>

      <div class="mirror-actions">
        <button class="mirror-cta" onClick={() => props.onShare()}>
          Share my voiceprint
        </button>
        <a
          class="mirror-cta mirror-cta-secondary"
          href={props.appUrl}
          onClick={() => trackFunnel('cta_app_click')}
        >
          Train it in MercuryPitch
        </a>
      </div>
      <Show when={props.shareStatus}>
        <p class="mirror-dim">{props.shareStatus}</p>
      </Show>
      <p class="mirror-trust">
        Saved on this device only — come back any time to see your delta.
      </p>
    </section>
  )
}
