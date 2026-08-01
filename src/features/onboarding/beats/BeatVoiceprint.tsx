// ============================================================
// Beat 4 — Voiceprint
// ============================================================
//
// The Voice Mirror's three tasks, restaged in the sky: glide up, glide
// down, hold, then match five notes. The maths is entirely the
// Mirror's (`computeMirrorResult`) — this beat owns only the script
// and the staging.
//
// Each task opens on its own intro: the looping TaskDemo animation,
// its audible guide cue, the instruction, and an "I'm ready" gate.
// Nothing records until the singer says so. That makes the flow
// longer, and it is the right trade — someone who has never done a
// vocal glide cannot be rushed into one. The demo is deliberately
// audible as well as animated: an animation alone does not tell you
// what your VOICE should do, so TaskDemo pairs the drawing with a
// synthesized siren or held tone.
//
// Every await is followed by an alive() check before the next side
// effect. Without it, a visitor who backs out mid-take leaves a
// running script that dispatches into a torn-down session — the same
// generation-guard the Mirror's runFlow uses, and for the same reason.

import type { Component } from 'solid-js'
import { createSignal, onCleanup, onMount, Show } from 'solid-js'
import type { LiveVizMode } from '@/features/mirror/LiveViz'
import { LiveViz } from '@/features/mirror/LiveViz'
import { TaskDemo } from '@/features/mirror/TaskDemo'
import { playReferenceTone } from '@/features/mirror/tone-player'
import { registerMicIndicator } from '@/lib/mic-sentinel'
import type { DemoKind } from '@/lib/mirror/demo-timeline'
import type { F0Frame, MatchTake, MirrorResult } from '@/lib/mirror/metrics'
import { computeMirrorResult, computeRange, pickMatchTargets, } from '@/lib/mirror/metrics'
import { midiToNoteNameOctave } from '@/lib/note-utils'
import type { VoiceSession } from '@/lib/voice-session'
import { createVoiceSession } from '@/lib/voice-session'
import styles from '../onboarding.module.css'

const GLIDE_SEC = 8
const HOLD_SEC = 6
/** 2*PI*r for the countdown ring's r=31 circle in its 72 viewBox. */
const RING_CIRCUMFERENCE = 194.8
const MATCH_TAKE_SEC = 3
const REFERENCE_SEC = 1.4
/** Hear the note, then a beat to prepare before singing it back. */
const MATCH_PREPARE_SEC = 2
const MATCH_COUNT = 5

type Stage =
  | { kind: 'intro'; demo: DemoKind; title: string; body: string }
  | { kind: 'brief'; title: string; body: string }
  | { kind: 'record'; title: string; body: string }
  | { kind: 'listen'; title: string; body: string }
  | { kind: 'done' }

export interface BeatVoiceprintProps {
  onComplete: (result: MirrorResult, glides: F0Frame[][]) => void
  /** Mic died mid-run — route onward rather than stall on a dead take. */
  onDenied: () => void
}

export const BeatVoiceprint: Component<BeatVoiceprintProps> = (props) => {
  const [stage, setStage] = createSignal<Stage>({
    kind: 'brief',
    title: 'Getting ready',
    body: 'Waking the microphone…',
  })
  const [remaining, setRemaining] = createSignal(0)
  const [step, setStep] = createSignal(1)

  /**
   * Live feedback for the take being recorded — the Mirror's own canvas
   * (trace for glides, tightening ring for the hold, target line for
   * matches). Null outside a take. The singer watching their pitch draw
   * itself is the payoff that a bare countdown number never delivered
   * (owner testing: "no pitch tracker like in voice mirror").
   */
  const [viz, setViz] = createSignal<{
    mode: LiveVizMode
    target: number | null
  } | null>(null)
  const [vizReset, setVizReset] = createSignal(0)
  /** Length of the current take, so the countdown ring can fill. */
  const [recordTotal, setRecordTotal] = createSignal(1)

  /**
   * A note from the middle of the measured range, offered during the
   * hold task's gate. Null outside that task — the tone must never be
   * available while a take is recording, or the mic captures it.
   */
  const [suggestedMidi, setSuggestedMidi] = createSignal<number | null>(null)
  const [tonePlaying, setTonePlaying] = createSignal(false)

  const playSuggested = async (): Promise<void> => {
    const midi = suggestedMidi()
    const context = session?.context() ?? null
    if (midi === null || context === null || tonePlaying()) return
    setTonePlaying(true)
    try {
      await playReferenceTone(context, midi, 1.6)
    } finally {
      setTonePlaying(false)
    }
  }

  let session: VoiceSession | null = null
  let cancelled = false
  let timer = 0
  let readyResolve: (() => void) | null = null

  const alive = (): boolean => !cancelled

  /** Let go of the "I'm ready" promise so `run()` can unwind and bail. */
  const releaseGate = (): void => {
    readyResolve?.()
    readyResolve = null
  }

  // Mic sentinel: the session stays open across all four tasks and this
  // beat shows no persistent mic icon, so without an indicator the
  // watchdog reported live-without-ui for the whole run.
  const unregisterIndicator = registerMicIndicator(
    'first-light-voiceprint',
    () => session?.isOpen() ?? false,
    () => {
      session?.close()
      session = null
    },
  )

  onCleanup(() => {
    unregisterIndicator()
    cancelled = true
    clearInterval(timer)
    // Without this an unmount during an intro leaves run() parked on a
    // promise nobody will ever resolve, holding the session with it.
    releaseGate()
    session?.close()
    session = null
  })

  const countdown = async (seconds: number): Promise<void> => {
    setRemaining(seconds)
    clearInterval(timer)
    timer = window.setInterval(() => {
      setRemaining((r) => Math.max(0, r - 1))
    }, 1000)
    await new Promise((resolve) => setTimeout(resolve, seconds * 1000))
    clearInterval(timer)
  }

  /**
   * Show a task's demo and instruction, and wait. The pacing of the
   * whole beat rests on this: it never resolves on a timer, only when
   * the singer says they are ready.
   */
  const taskIntro = (
    demo: DemoKind,
    title: string,
    body: string,
  ): Promise<void> => {
    if (!alive()) return Promise.resolve()
    setStage({ kind: 'intro', demo, title, body })
    return new Promise<void>((resolve) => {
      readyResolve = resolve
    })
  }

  const brief = async (
    title: string,
    body: string,
    seconds = 3,
  ): Promise<void> => {
    setStage({ kind: 'brief', title, body })
    await countdown(seconds)
  }

  const record = async (
    title: string,
    body: string,
    seconds: number,
    live: { mode: LiveVizMode; target?: number } | null = null,
  ): Promise<F0Frame[]> => {
    setStage({ kind: 'record', title, body })
    if (session === null) return []
    setViz(
      live === null ? null : { mode: live.mode, target: live.target ?? null },
    )
    setVizReset((k) => k + 1)
    setRecordTotal(seconds)
    setRemaining(seconds)
    clearInterval(timer)
    timer = window.setInterval(() => {
      setRemaining((r) => Math.max(0, r - 1))
    }, 1000)
    const frames = await session.record(seconds)
    clearInterval(timer)
    setViz(null)
    return frames
  }

  const run = async (): Promise<void> => {
    session = createVoiceSession('first-light-voiceprint')
    // The mic was granted at beat 2, so a failure here is a device that
    // went away (unplugged, stolen by another tab). Nothing to ask —
    // route onward rather than stall on a dead take.
    if (!(await session.open()).ok) {
      props.onDenied()
      return
    }
    if ((await session.probe()) !== 'ok' || !alive()) {
      props.onDenied()
      return
    }

    // ── Task A: glide up, then down. Their union is the range. ──
    setStep(1)
    await taskIntro(
      'glide-up',
      'Slide from low to high',
      "Listen to the sweep, then do the same on an 'ooo' — from as low as you comfortably sing up to as high as you comfortably sing. Never strain: we want your easy range, not your limit.",
    )
    if (!alive()) return
    await brief('Ready…', 'Take a breath.')
    if (!alive()) return
    const glideUp = await record(
      'Glide up',
      'Low to high, one smooth slide.',
      GLIDE_SEC,
      { mode: 'glide' },
    )
    if (!alive()) return
    // A beat of acknowledgement between tasks: without it the flow jumps
    // straight to the next instruction and singers can't tell whether the
    // take even registered (owner testing).
    await brief('Got it.', 'That was 1 of 3.', 1)
    if (!alive()) return

    setStep(2)
    await taskIntro(
      'glide-down',
      'Now the same, downwards',
      'High to low this time, one smooth slide.',
    )
    if (!alive()) return
    await brief('Ready…', 'Take a breath.', 2)
    if (!alive()) return
    const glideDown = await record(
      'Glide down',
      'High to low, one smooth slide.',
      GLIDE_SEC,
      { mode: 'glide' },
    )
    if (!alive()) return
    await brief('Both directions in.', 'That was 2 of 3.', 1)
    if (!alive()) return

    // ── Task B: hold. ──
    //
    // The glides are already in, so we know their range and can offer a
    // note from the middle of it. This is SAFE for the measurement:
    // computeSteadiness detrends against the singer's own mean and slope
    // (see metrics.ts), so which note they choose has no effect on the
    // score whatsoever. It would NOT be safe on the match task, which
    // scores deviation from a target.
    setStep(3)
    const glideRange = computeRange([glideUp, glideDown])
    if (glideRange !== null) {
      setSuggestedMidi(
        Math.round((glideRange.lowMidi + glideRange.highMidi) / 2),
      )
    }
    await taskIntro(
      'hold',
      'Hold one note steady',
      "Pick any note in the middle of your range and hold it on an 'ahh'. This measures control, not volume — quiet and steady beats loud and wobbly.",
    )
    if (!alive()) return
    await brief('Ready…', 'Take a breath.', 2)
    if (!alive()) return
    const hold = await record('Hold it', 'Steady as you can.', HOLD_SEC, {
      mode: 'hold',
    })
    if (!alive()) return
    await brief('Nice and steady.', 'Last one: sing a note back to us.', 1)
    if (!alive()) return

    // ── Task C: match five. Reference then record, never together. ──
    setStep(4)
    setSuggestedMidi(null)
    const range = glideRange
    // No usable range means both glides were silent — there is nothing to
    // pitch the targets against, so finish on what we have rather than
    // firing arbitrary notes at someone we evidently cannot hear.
    const targets =
      range === null ? [] : pickMatchTargets(range.lowMidi, range.highMidi)

    const matches: MatchTake[] = []

    if (targets.length > 0) {
      // One gate before the series, not one per note: rounds 2-5 keeping
      // their rhythm is what makes it feel like call-and-response rather
      // than five separate exercises.
      await taskIntro(
        'match',
        'Last one — match five notes',
        "You'll hear a note, then sing it back. Listen first; we'll tell you when it's your turn.",
      )
      if (!alive()) return
      await brief('Ready…', 'Here comes the first note.', 2)
    }

    for (let i = 0; i < Math.min(MATCH_COUNT, targets.length); i++) {
      if (!alive()) return
      const target = targets[i]
      const name = midiToNoteNameOctave(Math.round(target))

      setStage({
        kind: 'listen',
        title: `Listen — note ${i + 1} of ${targets.length}`,
        body: `This is ${name}.`,
      })
      const context = session.context()
      if (context !== null) {
        await playReferenceTone(context, target, REFERENCE_SEC)
      }
      if (!alive()) return

      await brief('Your turn', `Sing ${name} back.`, MATCH_PREPARE_SEC)
      if (!alive()) return

      const frames = await record(
        `Sing ${name}`,
        `Note ${i + 1} of ${targets.length}.`,
        MATCH_TAKE_SEC,
        { mode: 'match', target },
      )
      if (!alive()) return
      matches.push({ targetMidi: target, frames })
    }

    if (!alive()) return
    session.close()
    session = null
    setStage({ kind: 'done' })

    const result = computeMirrorResult({
      glides: [glideUp, glideDown],
      hold,
      matches,
    })
    props.onComplete(result, [glideUp, glideDown])
  }

  onMount(() => void run())

  const current = () => stage()
  const titled = () => current() as { title: string; body: string }

  return (
    <div class={styles.beat} data-beat="voiceprint">
      <p class={styles.eyebrow}>Step {step()} of 4 · mapping your voice</p>

      <Show when={current().kind !== 'done'}>
        <h1 class={styles.headlineSmall}>{titled().title}</h1>
      </Show>

      {/* Animation plus its audible siren/hold cue. Mounted only during
          the intro, so every task gets a fresh instance and the cue
          replays for the task it belongs to. */}
      <Show when={current().kind === 'intro'}>
        <div class={styles.demoStage}>
          <TaskDemo
            kind={(current() as { demo: DemoKind }).demo}
            size="stage"
            label={titled().title}
            getAudioContext={() => session?.context() ?? null}
          />
        </div>
      </Show>

      <Show when={current().kind !== 'done'}>
        <p class={styles.sub}>{titled().body}</p>
      </Show>

      <Show when={current().kind === 'intro'}>
        <div class={styles.actions}>
          {/* Offered only where a note has been suggested (the hold task,
              once the glides have given us a range). Never during a take:
              a tone still sounding would be captured by the mic. */}
          <Show when={suggestedMidi() !== null}>
            <button
              type="button"
              class={styles.secondary}
              onClick={() => void playSuggested()}
              disabled={tonePlaying()}
            >
              {tonePlaying()
                ? 'Playing…'
                : `Hear a note (${midiToNoteNameOctave(suggestedMidi() ?? 0)})`}
            </button>
          </Show>
          <button
            type="button"
            class={styles.primary}
            onClick={() => releaseGate()}
          >
            I'm ready
          </button>
        </div>
      </Show>

      <Show when={current().kind === 'record' && viz() !== null}>
        <div class={styles.liveViz}>
          <LiveViz
            latest={() => session?.latestSmoothed() ?? null}
            mode={viz()?.mode ?? 'glide'}
            targetMidi={viz()?.target ?? null}
            resetKey={vizReset()}
          />
        </div>
      </Show>

      <Show when={current().kind === 'brief'}>
        <div class={styles.countdown} aria-live="polite">
          {remaining()}
        </div>
      </Show>

      <Show when={current().kind === 'record'}>
        {/* The ring fills as the take runs — progress, not just a number
            counting at you. */}
        <div class={styles.countdownRing} aria-live="polite">
          <svg viewBox="0 0 72 72" aria-hidden="true">
            <circle class={styles.ringTrack} cx="36" cy="36" r="31" />
            <circle
              class={styles.ringFill}
              cx="36"
              cy="36"
              r="31"
              stroke-dasharray={`${RING_CIRCUMFERENCE}`}
              stroke-dashoffset={`${
                RING_CIRCUMFERENCE * (remaining() / Math.max(1, recordTotal()))
              }`}
            />
          </svg>
          <span class={styles.countdownNum}>{remaining()}</span>
        </div>
        <p class={styles.recordingTag}>Recording</p>
        <p class={styles.recordHint}>
          Done before the count ends? Just stop singing — we keep what we heard.
        </p>
      </Show>

      <Show when={current().kind === 'done'}>
        <h1 class={styles.headline}>Reading your voice…</h1>
      </Show>
    </div>
  )
}

export default BeatVoiceprint
