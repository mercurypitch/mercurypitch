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
// what your VOICE should do, so each intro pairs the drawing with a
// synthesized siren, or for the hold, the singer's own note.
//
// One sound at a time (owner testing, iPhone, 11 Oct 2026). The hold
// used to play the demo's fixed note on arrival while "Hear a note"
// played a different one over it. Every sound in this beat now goes
// through one lane (../sound-lane.ts): a new sound stops the one before,
// "Hear a note" waits while anything plays, and "I'm ready" silences the
// lane before a take can record. TaskDemo draws, and plays nothing.
//
// Every await is followed by an alive() check before the next side
// effect. Without it, a visitor who backs out mid-take leaves a
// running script that dispatches into a torn-down session — the same
// generation-guard the Mirror's runFlow uses, and for the same reason.
//
// One run, one counter (owner decision V7, 11 Oct 2026). The four steps
// are counted in one place, the step track at the top, and nowhere else:
// the briefs between steps used to say "That was 1 of 3" under an eyebrow
// that said "Step 1 of 4". The first screen says how long the whole run
// takes, and the five-note match counts its notes as it goes.

import type { Component } from 'solid-js'
import { createSignal, For, onCleanup, onMount, Show } from 'solid-js'
import { planDemoCue, playDemoCue } from '@/features/mirror/demo-cue'
import type { LiveVizMode } from '@/features/mirror/LiveViz'
import { LiveViz } from '@/features/mirror/LiveViz'
import { TaskDemo } from '@/features/mirror/TaskDemo'
import { registerMicIndicator } from '@/lib/mic-sentinel'
import type { DemoKind } from '@/lib/mirror/demo-timeline'
import { buildDemoTimeline } from '@/lib/mirror/demo-timeline'
import type { F0Frame, MatchTake, MirrorResult } from '@/lib/mirror/metrics'
import { computeMirrorResult, computeRange, pickMatchTargets, } from '@/lib/mirror/metrics'
import { midiToNoteNameOctave } from '@/lib/note-utils'
import { startReferenceTone } from '@/lib/reference-tone'
import type { VoiceSession } from '@/lib/voice-session'
import { createVoiceSession } from '@/lib/voice-session'
import styles from '../onboarding.module.css'
import { createSoundLane } from '../sound-lane'

const GLIDE_SEC = 8
const HOLD_SEC = 6
/** 2*PI*r for the countdown ring's r=31 circle in its 72 viewBox. */
const RING_CIRCUMFERENCE = 194.8
const MATCH_TAKE_SEC = 3
const REFERENCE_SEC = 1.4
/** How long a note cut short needs before its context can close: the
 *  reference tone's 180 ms release and 60 ms of slack (reference-tone.ts),
 *  with a margin. The demo cues' own stop is shorter. */
const CLOSE_AFTER_RELEASE_MS = 300
/** Hear the note, then a beat to prepare before singing it back. */
const MATCH_PREPARE_SEC = 2
const MATCH_COUNT = 5

/**
 * The four steps, in the order the script runs them. The step track and
 * its counter are drawn from this list, so the count cannot drift from
 * the script again.
 */
export const VOICEPRINT_STEPS = [
  'Glide up',
  'Glide down',
  'Hold',
  'Match',
] as const

/**
 * How long the whole run takes, said on its first screen. The timed
 * stages come to 66 seconds (37 of them singing); the four "I'm ready"
 * gates are the singer's own pace. The Fork promises the same number.
 */
export const VOICEPRINT_TIME = 'about 90 seconds'

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
   * True when the glides gave no range: the five notes are pitched from
   * it, so step 4 is skipped rather than run, and the counter says so
   * instead of waiting on the hold while the result is read.
   */
  const [matchSkipped, setMatchSkipped] = createSignal(false)
  /** Where the five-note match stands; null outside it. */
  const [matchNote, setMatchNote] = createSignal<{
    index: number
    total: number
  } | null>(null)

  /**
   * The countdown ring sweeps once, across the whole take, rather than
   * stepping with the number.
   *
   * Stepping it per second could never close the circle: each step targeted
   * the fill for the START of that second while the 1s transition spent the
   * whole second getting there, so the ring ran a step behind and stalled a
   * third short on a 3-2-1. The last tick could not rescue it either — the
   * take resolves and the stage unmounts on the same beat as remaining
   * hitting zero. So: mount empty, arm on the next frame, and let one
   * transition of exactly the take's length carry it 0 to 360.
   */
  const [ringArmed, setRingArmed] = createSignal(false)
  let ringFrame = 0

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
   * A note from the middle of the measured range: the hold task's intro
   * plays it on arrival, and "Hear a note" plays it again. Null outside
   * that task. The tone must never be available while a take is
   * recording, or the mic captures it.
   */
  const [suggestedMidi, setSuggestedMidi] = createSignal<number | null>(null)

  /** Every sound this beat makes, one at a time. */
  const lane = createSoundLane()

  /**
   * The hold's note lasts as long as the hold demo's sing window (3.3 s),
   * so the note on arrival sounds while the animation holds its line.
   * "Hear a note" replays the same note for the same time.
   */
  const holdNoteSec =
    planDemoCue('hold', buildDemoTimeline('hold'))?.seconds ?? 3.3

  let session: VoiceSession | null = null

  const audioContext = (): AudioContext | null => {
    const context = session?.context() ?? null
    if (context === null || context.state === 'closed') return null
    if (context.state === 'suspended') {
      void context.resume().catch(() => undefined)
    }
    return context
  }

  /** The singer's own note for the hold, through the lane. */
  const playHoldNote = (midi: number): Promise<void> => {
    const context = audioContext()
    if (context === null) return Promise.resolve()
    return lane.play(
      () => startReferenceTone(context, midi, holdNoteSec),
      holdNoteSec,
    )
  }

  /**
   * The sound that goes with a task's demo, once, as its intro opens. The
   * hold plays the singer's own note when the glides gave one; otherwise
   * every task plays the demo's own cue (the match has none: it plays its
   * notes one by one).
   */
  const playIntroCue = (demo: DemoKind): void => {
    const midi = suggestedMidi()
    if (demo === 'hold' && midi !== null) {
      void playHoldNote(midi)
      return
    }
    const plan = planDemoCue(demo, buildDemoTimeline(demo))
    const context = audioContext()
    if (plan === null || context === null) return
    void lane.play(() => playDemoCue(context, plan), plan.seconds)
  }

  /** "Hear a note": the hold's note again, only when nothing is playing. */
  const hearNote = (): void => {
    const midi = suggestedMidi()
    if (midi === null || lane.busy()) return
    void playHoldNote(midi)
  }
  let cancelled = false
  let timer = 0
  let readyResolve: (() => void) | null = null

  const alive = (): boolean => !cancelled

  /**
   * Let go of the "I'm ready" promise so `run()` can unwind and bail. The
   * lane goes quiet first: a take follows, and the mic must not hear a
   * note still ringing.
   */
  const releaseGate = (): void => {
    lane.stop()
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
    cancelAnimationFrame(ringFrame)
    // Without this an unmount during an intro leaves run() parked on a
    // promise nobody will ever resolve, holding the session with it. It
    // also silences the lane, so no note outlives the beat.
    //
    // A note cut short ("Not now" mid-note) fades over its release, on
    // the session's context. Closing that context at once cut the fade
    // off where it stood: a pop. Close it once the tail is quiet, on a
    // timer that does not depend on this component, so it always closes.
    const sounding = lane.busy()
    releaseGate()
    const leaving = session
    session = null
    if (leaving === null) return
    if (sounding) setTimeout(() => leaving.close(), CLOSE_AFTER_RELEASE_MS)
    else leaving.close()
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
    playIntroCue(demo)
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
    // Never a sound under a take. "I'm ready" already silenced the lane;
    // this is the guarantee for every other way into a take.
    lane.stop()
    setStage({ kind: 'record', title, body })
    if (session === null) return []
    setViz(
      live === null ? null : { mode: live.mode, target: live.target ?? null },
    )
    setVizReset((k) => k + 1)
    setRecordTotal(seconds)
    setRemaining(seconds)
    // TWO frames, not one. requestAnimationFrame runs BEFORE the paint of
    // the frame that inserted the ring, so a single rAF flips the offset
    // while the browser has still never rendered the empty state — it
    // coalesces both values, renders the full ring, and there is nothing to
    // transition from. Measured in Chromium: with one frame the ring is 100%
    // filled 1.2s into a 3s take; with two it is 40%, which is the sweep.
    // The inner rAF is what guarantees a paint has happened in between.
    setRingArmed(false)
    cancelAnimationFrame(ringFrame)
    ringFrame = requestAnimationFrame(() => {
      ringFrame = requestAnimationFrame(() => setRingArmed(true))
    })
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
    // 'quiet' is not a failure here either: the probe runs before the
    // first task brief, so the room is quiet because we haven't asked
    // for anything yet. Only a graph carrying literally nothing is a
    // reason to abandon a run the singer opted into.
    const probe = await session.probe()
    if (probe === 'silent' || probe === 'no-session' || !alive()) {
      props.onDenied()
      return
    }

    // ── Task A: glide up, then down. Their union is the range. ──
    setStep(1)
    await taskIntro(
      'glide-up',
      'Slide from low to high',
      "Listen to the sweep, then do the same on an 'ooo', from as low as you comfortably sing up to as high as you comfortably sing. Never strain: we want your easy range, not your limit.",
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
    // take even registered (owner testing). It says what comes next, not
    // a count: the step track at the top is the one counter.
    await brief('Got it.', 'Next: the same slide, downwards.', 1)
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
    await brief('Both directions in.', 'Next: hold one note.', 1)
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
    // Picked now rather than at step 4, so the brief after the hold can say
    // whether a match is coming at all. No usable range means both glides
    // were silent: there is nothing to pitch the targets against, so the
    // run finishes on what it has rather than firing arbitrary notes at
    // someone we evidently cannot hear.
    const targets =
      glideRange === null
        ? []
        : pickMatchTargets(glideRange.lowMidi, glideRange.highMidi).slice(
            0,
            MATCH_COUNT,
          )
    await taskIntro(
      'hold',
      'Hold one note steady',
      "Pick any note in the middle of your range and hold it on an 'ahh'. This measures control, not volume: quiet and steady beats loud and wobbly.",
    )
    if (!alive()) return
    await brief('Ready…', 'Take a breath.', 2)
    if (!alive()) return
    const hold = await record('Hold it', 'Steady as you can.', HOLD_SEC, {
      mode: 'hold',
    })
    if (!alive()) return
    if (targets.length > 0) {
      await brief('Nice and steady.', 'Last one: match five notes.', 1)
    } else {
      // The Fork promised five notes, so say why they are not coming, and
      // long enough to read: one screen later the twin says it could not
      // read a range either.
      setStep(4)
      setMatchSkipped(true)
      await brief(
        "We couldn't hear your slides",
        "The five notes are pitched from your range, so we'll skip them this time.",
      )
    }
    if (!alive()) return

    // ── Task C: match five. Reference then record, never together. ──
    setSuggestedMidi(null)
    const matches: MatchTake[] = []

    if (targets.length > 0) {
      setStep(4)
      // One gate before the series, not one per note: rounds 2-5 keeping
      // their rhythm is what makes it feel like call-and-response rather
      // than five separate exercises.
      await taskIntro(
        'match',
        'Match five notes',
        "You'll hear a note, then sing it back. Listen first; we'll tell you when it's your turn.",
      )
      if (!alive()) return
      await brief('Ready…', 'Here comes the first note.', 2)
    }

    for (let i = 0; i < targets.length; i++) {
      if (!alive()) return
      const target = targets[i]
      const name = midiToNoteNameOctave(Math.round(target))
      // Counted on screen through all three stages of the note: listen,
      // your turn, sing.
      setMatchNote({ index: i, total: targets.length })

      setStage({
        kind: 'listen',
        title: 'Listen',
        body: `This is ${name}.`,
      })
      const context = audioContext()
      if (context !== null) {
        await lane.play(
          () => startReferenceTone(context, target, REFERENCE_SEC),
          REFERENCE_SEC,
        )
      }
      if (!alive()) return

      await brief('Your turn', `Sing ${name} back.`, MATCH_PREPARE_SEC)
      if (!alive()) return

      const frames = await record(
        `Sing ${name}`,
        'Match the note you just heard.',
        MATCH_TAKE_SEC,
        { mode: 'match', target },
      )
      if (!alive()) return
      matches.push({ targetMidi: target, frames })
    }

    if (!alive()) return
    setMatchNote(null)
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
      {/* The one step counter: a track of four segments and the words
          under it. The time goes on the first step only, the first
          thing the singer reads after choosing to start. */}
      <div class={styles.stepper}>
        <ol class={styles.stepTrack} aria-hidden="true">
          <For each={VOICEPRINT_STEPS}>
            {(_name, index) => (
              <li
                class={styles.stepSegment}
                data-state={
                  index() + 1 < step()
                    ? 'done'
                    : index() + 1 === step()
                      ? matchSkipped()
                        ? 'skipped'
                        : 'current'
                      : 'ahead'
                }
              />
            )}
          </For>
        </ol>
        <p class={styles.stepCounter} data-step-counter>
          Step {step()} of {VOICEPRINT_STEPS.length}
          {step() === 1
            ? ` · ${VOICEPRINT_TIME}`
            : ` · ${VOICEPRINT_STEPS[step() - 1]}${matchSkipped() ? ' skipped' : ''}`}
        </p>
      </div>

      <Show when={current().kind !== 'done'}>
        <h1 class={styles.headlineSmall}>{titled().title}</h1>
      </Show>

      <Show when={matchNote()}>
        {(note) => (
          <div class={styles.matchProgress} data-match-progress>
            <span class={styles.matchDots} aria-hidden="true">
              <For each={Array.from({ length: note().total })}>
                {(_dot, index) => (
                  <span
                    class={styles.matchDot}
                    data-state={
                      index() < note().index
                        ? 'done'
                        : index() === note().index
                          ? 'current'
                          : 'ahead'
                    }
                  />
                )}
              </For>
            </span>
            <span class={styles.matchLabel}>
              Note {note().index + 1} of {note().total}
            </span>
          </div>
        )}
      </Show>

      {/* The animation only. Its sound comes from taskIntro, through
          the lane, so it can never overlap another note. Mounted only
          during the intro, so every task gets a fresh instance. */}
      <Show when={current().kind === 'intro'}>
        <div class={styles.demoStage}>
          <TaskDemo
            kind={(current() as { demo: DemoKind }).demo}
            size="stage"
            label={titled().title}
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
              a tone still sounding would be captured by the mic. It waits
              while any sound plays, the arrival note included. */}
          <Show when={suggestedMidi() !== null}>
            <button
              type="button"
              class={styles.secondary}
              onClick={hearNote}
              disabled={lane.busy()}
            >
              {lane.busy()
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
              stroke-dashoffset={ringArmed() ? '0' : `${RING_CIRCUMFERENCE}`}
              style={{ 'transition-duration': `${recordTotal()}s` }}
            />
          </svg>
          <span class={styles.countdownNum}>{remaining()}</span>
        </div>
        <p class={styles.recordingTag}>Recording</p>
        <p class={styles.recordHint}>
          Done before the count ends? Just stop singing. We keep what we heard.
        </p>
      </Show>

      <Show when={current().kind === 'done'}>
        <h1 class={styles.headline}>Reading your voice…</h1>
      </Show>
    </div>
  )
}

export default BeatVoiceprint
