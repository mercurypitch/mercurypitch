// ============================================================
// Beat 4 — Voiceprint
// ============================================================
//
// The Voice Mirror's three tasks, restaged in the sky: glide up, glide
// down, hold, then match five notes. The maths is entirely the
// Mirror's (`computeMirrorResult`) — this beat owns only the script
// and the staging.
//
// Every await is followed by an alive() check before the next side
// effect. Without it, a visitor who backs out mid-take leaves a
// running script that dispatches into a torn-down session — the same
// generation-guard the Mirror's runFlow uses, and for the same reason.

import type { Component } from 'solid-js'
import { createSignal, onCleanup, onMount, Show } from 'solid-js'
import { Mascot } from '@/components/Mascot'
import { playReferenceTone } from '@/features/mirror/tone-player'
import type { F0Frame, MatchTake, MirrorResult } from '@/lib/mirror/metrics'
import { computeMirrorResult, computeRange, pickMatchTargets, } from '@/lib/mirror/metrics'
import { midiToNoteNameOctave } from '@/lib/note-utils'
import type { VoiceSession } from '@/lib/voice-session'
import { createVoiceSession } from '@/lib/voice-session'
import styles from '../onboarding.module.css'

const GLIDE_SEC = 8
const HOLD_SEC = 6
const MATCH_TAKE_SEC = 3
const REFERENCE_SEC = 1.4
/** Hear the note, then a beat to prepare before singing it back. */
const MATCH_PREPARE_SEC = 2
const BRIEF_SEC = 3
const MATCH_COUNT = 5

type Stage =
  | { kind: 'brief'; title: string; body: string; seconds: number }
  | { kind: 'record'; title: string; body: string; seconds: number }
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
    title: 'Slide from low to high',
    body: "On an 'ooo', glide as low as you comfortably can up to as high as you comfortably can. Don't strain — we want your easy range.",
    seconds: BRIEF_SEC,
  })
  const [remaining, setRemaining] = createSignal(BRIEF_SEC)
  const [step, setStep] = createSignal(1)

  let session: VoiceSession | null = null
  let cancelled = false
  let timer = 0

  const alive = (): boolean => !cancelled

  onCleanup(() => {
    cancelled = true
    clearInterval(timer)
    session?.close()
    session = null
  })

  /** A visible countdown, so nobody wonders whether it's still going. */
  const countdown = async (seconds: number): Promise<void> => {
    setRemaining(seconds)
    clearInterval(timer)
    timer = window.setInterval(() => {
      setRemaining((r) => Math.max(0, r - 1))
    }, 1000)
    await new Promise((resolve) => setTimeout(resolve, seconds * 1000))
    clearInterval(timer)
  }

  const brief = async (title: string, body: string): Promise<void> => {
    setStage({ kind: 'brief', title, body, seconds: BRIEF_SEC })
    await countdown(BRIEF_SEC)
  }

  const record = async (
    title: string,
    body: string,
    seconds: number,
  ): Promise<F0Frame[]> => {
    setStage({ kind: 'record', title, body, seconds })
    if (session === null) return []
    setRemaining(seconds)
    clearInterval(timer)
    timer = window.setInterval(() => {
      setRemaining((r) => Math.max(0, r - 1))
    }, 1000)
    const frames = await session.record(seconds)
    clearInterval(timer)
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
    await brief(
      'Slide from low to high',
      "On an 'ooo', glide as low as you comfortably can up to as high as you comfortably can. Don't strain — we want your easy range.",
    )
    if (!alive()) return
    const glideUp = await record(
      'Glide up',
      'Low to high, one smooth slide.',
      GLIDE_SEC,
    )
    if (!alive()) return

    setStep(2)
    await brief('Now back down', 'Same thing, high to low.')
    if (!alive()) return
    const glideDown = await record(
      'Glide down',
      'High to low, one smooth slide.',
      GLIDE_SEC,
    )
    if (!alive()) return

    // ── Task B: hold. ──
    setStep(3)
    await brief(
      'Hold one note',
      "Pick a note in the middle of your range and hold it steady on an 'ahh'.",
    )
    if (!alive()) return
    const hold = await record(
      'Hold it',
      'Steady as you can — this measures your control, not your volume.',
      HOLD_SEC,
    )
    if (!alive()) return

    // ── Task C: match five. Reference then record, never together. ──
    setStep(4)
    const range = computeRange([glideUp, glideDown])
    // No usable range means both glides were silent — there is nothing to
    // pitch the targets against, so finish on what we have rather than
    // firing arbitrary notes at someone we evidently cannot hear.
    const targets =
      range === null ? [] : pickMatchTargets(range.lowMidi, range.highMidi)

    const matches: MatchTake[] = []

    if (targets.length > 0) {
      await brief(
        'Now match five notes',
        "You'll hear a note, then sing it back. Listen first — we'll tell you when.",
      )
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

      setStage({
        kind: 'brief',
        title: 'Ready…',
        body: `Sing ${name} back.`,
        seconds: MATCH_PREPARE_SEC,
      })
      await countdown(MATCH_PREPARE_SEC)
      if (!alive()) return

      const frames = await record(
        `Sing ${name}`,
        `Note ${i + 1} of ${targets.length}.`,
        MATCH_TAKE_SEC,
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

  return (
    <div class={styles.beat} data-beat="voiceprint">
      <span class={styles.mascot} aria-hidden="true">
        <Mascot
          state={current().kind === 'record' ? 'listening' : 'idle'}
          size={72}
          title=""
        />
      </span>

      <p class={styles.eyebrow}>Step {step()} of 4 · mapping your voice</p>

      <Show when={current().kind !== 'done'}>
        <h1 class={styles.headline}>
          {(current() as { title: string }).title}
        </h1>
        <p class={styles.sub}>{(current() as { body: string }).body}</p>
      </Show>

      <Show when={current().kind === 'record' || current().kind === 'brief'}>
        <div class={styles.countdown} aria-live="polite">
          {remaining()}
        </div>
      </Show>

      <Show when={current().kind === 'record'}>
        <p class={styles.recordingTag}>Recording</p>
      </Show>

      <Show when={current().kind === 'done'}>
        <h1 class={styles.headline}>Reading your voice…</h1>
      </Show>
    </div>
  )
}

export default BeatVoiceprint
