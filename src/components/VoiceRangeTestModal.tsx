// ============================================================
// VoiceRangeTestModal — guided full vocal-range test (Settings only)
// ============================================================
//
// The professional big brother of the quick "Find my voice" detector:
// three guided takes (glide up, glide down, hold a note) feed the Voice
// Mirror metrics engine (computeRange), which is octave-safe (median
// filter + percentile guard) and measures the actual lowest/highest
// sustained notes rather than a single comfortable pitch. The result is
// shown on a range bar against the six classical voice types and can be
// applied as the vocal range preset.

import type { Component } from 'solid-js'
import { createSignal, For, onCleanup, Show } from 'solid-js'
import { useEngines } from '@/contexts/EngineContext'
import type { F0Frame, RangeResult } from '@/lib/mirror/metrics'
import { computeRange } from '@/lib/mirror/metrics'
import { midiToNoteNameOctave } from '@/lib/note-utils'
import { useFocusTrap } from '@/lib/use-focus-trap'
import type { VocalRangePreset } from '@/stores/settings-store'
import { setVocalRangePreset } from '@/stores/settings-store'
import styles from './VoiceTypeDetectorModal.module.css'

interface VoiceRangeTestModalProps {
  onClose: () => void
}

type Phase =
  | 'intro'
  | 'capturing'
  | 'computing'
  | 'result'
  | 'no-result'
  | 'error'

interface TaskSpec {
  key: 'glide-up' | 'glide-down' | 'hold'
  title: string
  instruction: string
  captureSec: number
}

const TASKS: readonly TaskSpec[] = [
  {
    key: 'glide-up',
    title: 'Glide up',
    instruction:
      'Start at your lowest comfortable note and slide smoothly up to your highest — like a slow siren.',
    captureSec: 7,
  },
  {
    key: 'glide-down',
    title: 'Glide down',
    instruction:
      'Now start high and slide smoothly all the way down to your lowest comfortable note.',
    captureSec: 7,
  },
  {
    key: 'hold',
    title: 'Hold a note',
    instruction:
      'Finally, hold one comfortable note steadily for a few seconds.',
    captureSec: 4,
  },
]

/** Voice-hint names from the mirror metrics table → app presets. */
const HINT_TO_PRESET: Record<string, VocalRangePreset> = {
  Bass: 'bass',
  Baritone: 'baritone',
  Tenor: 'tenor',
  Alto: 'alto',
  'Mezzo-soprano': 'mezzo-soprano',
  Soprano: 'soprano',
}

/** Range-bar scale: E2 (40) .. C6 (84), the span of the voice-type table. */
const BAR_LOW = 40
const BAR_HIGH = 84
const pct = (midi: number) =>
  Math.max(0, Math.min(100, ((midi - BAR_LOW) / (BAR_HIGH - BAR_LOW)) * 100))

const VOICE_LEVEL = 0.02 // RMS that counts as singing (starts a take)
const CONF_START = 0.5 // detector clarity that counts as a voiced start

export const VoiceRangeTestModal: Component<VoiceRangeTestModalProps> = (
  props,
) => {
  let dialogRef: HTMLDivElement | undefined
  useFocusTrap(() => dialogRef, {
    isOpen: () => true,
    onClose: () => props.onClose(),
  })

  const { practiceEngine } = useEngines()
  const [phase, setPhase] = createSignal<Phase>('intro')
  const [taskIndex, setTaskIndex] = createSignal(0)
  const [waitingForVoice, setWaitingForVoice] = createSignal(true)
  const [progress, setProgress] = createSignal(0)
  const [liveNote, setLiveNote] = createSignal<string | null>(null)
  const [result, setResult] = createSignal<RangeResult | null>(null)

  const takes: F0Frame[][] = [[], [], []]

  let animFrame: number | null = null
  const stopLoop = () => {
    if (animFrame !== null) {
      cancelAnimationFrame(animFrame)
      animFrame = null
    }
  }

  onCleanup(() => {
    stopLoop()
    practiceEngine.stopMic()
  })

  const task = () => TASKS[taskIndex()]

  const start = async () => {
    let ok = false
    try {
      ok = await practiceEngine.startMic()
    } catch {
      ok = false
    }
    if (!ok) {
      setPhase('error')
      return
    }
    takes[0] = []
    takes[1] = []
    takes[2] = []
    setTaskIndex(0)
    setPhase('capturing')
    runCapture()
  }

  /**
   * One capture take: wait until we actually hear singing, then record
   * pitch frames for the task's window and hand off to the next take.
   */
  const runCapture = () => {
    const spec = TASKS[taskIndex()]
    const frames: F0Frame[] = []
    let startedAt: number | null = null
    setWaitingForVoice(true)
    setProgress(0)
    setLiveNote(null)

    const loop = () => {
      const level = practiceEngine.getInputLevel()
      const pitch = practiceEngine.detectPitch()
      const voiced =
        pitch !== null && pitch.clarity > CONF_START && level > VOICE_LEVEL

      if (startedAt === null) {
        if (voiced) {
          startedAt = performance.now()
          setWaitingForVoice(false)
        }
      }

      if (startedAt !== null) {
        const t = (performance.now() - startedAt) / 1000
        frames.push({
          t,
          f0: pitch?.frequency ?? 0,
          conf: pitch?.clarity ?? 0,
        })
        setProgress(Math.min(100, (t / spec.captureSec) * 100))
        if (pitch !== null && voiced) {
          const midi = Math.round(69 + 12 * Math.log2(pitch.frequency / 440))
          setLiveNote(midiToNoteNameOctave(midi))
        } else {
          setLiveNote(null)
        }
        if (t >= spec.captureSec) {
          takes[taskIndex()] = frames
          nextTake()
          return
        }
      }

      animFrame = requestAnimationFrame(loop)
    }
    animFrame = requestAnimationFrame(loop)
  }

  const nextTake = () => {
    stopLoop()
    if (taskIndex() < TASKS.length - 1) {
      setTaskIndex(taskIndex() + 1)
      runCapture()
      return
    }
    practiceEngine.stopMic()
    setPhase('computing')
    const range = computeRange(takes)
    if (range === null) {
      setPhase('no-result')
      return
    }
    setResult(range)
    setPhase('result')
  }

  const recommendedPreset = (): VocalRangePreset | null => {
    const hint = result()?.voiceHint
    return hint != null ? (HINT_TO_PRESET[hint] ?? null) : null
  }

  const handleApply = () => {
    const preset = recommendedPreset()
    if (preset !== null) setVocalRangePreset(preset)
    props.onClose()
  }

  return (
    <div
      class={styles.modalOverlay}
      onClick={(e) => {
        e.stopPropagation()
        props.onClose()
      }}
    >
      <div
        class={styles.modalContent}
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Full vocal range test"
        onClick={(e) => e.stopPropagation()}
      >
        <div class={styles.modalHeader}>
          <h2>Full Vocal Range Test</h2>
          <button class={styles.closeBtn} onClick={() => props.onClose()}>
            <svg viewBox="0 0 24 24" width="20" height="20">
              <path
                fill="currentColor"
                d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
              />
            </svg>
          </button>
        </div>

        <div class={styles.modalBody}>
          <Show when={phase() === 'intro'}>
            <div class={styles.centerContainer}>
              <div class={styles.iconCircle}>
                <svg
                  viewBox="0 0 24 24"
                  width="32"
                  height="32"
                  stroke="currentColor"
                  fill="none"
                  stroke-width="2"
                  stroke-linecap="round"
                >
                  <path d="M3 12h2l2-7 3 14 3-10 2 6 2-3h4" />
                </svg>
              </div>
              <h3>Measure your true range</h3>
              <p>
                Three short takes — glide up, glide down, and hold a note. We
                measure the lowest and highest notes you can actually sustain
                and match them against the classical voice types.
              </p>
              <p class={styles.helperText}>
                Everything runs locally on this device; no audio is uploaded.
              </p>
              <button
                type="button"
                class={styles.actionBtn}
                onClick={() => void start()}
              >
                Start the test
              </button>
            </div>
          </Show>

          <Show when={phase() === 'capturing'}>
            <div class={styles.centerContainer}>
              <div class={styles.stepDots}>
                <For each={TASKS}>
                  {(t, i) => (
                    <span
                      class={styles.stepDot}
                      classList={{
                        [styles.stepDotActive]: i() === taskIndex(),
                        [styles.stepDotDone]: i() < taskIndex(),
                      }}
                    >
                      {i() + 1}. {t.title}
                    </span>
                  )}
                </For>
              </div>
              <h3>{task().title}</h3>
              <p>{task().instruction}</p>
              <div class={styles.progressBar}>
                <div
                  class={styles.progressFill}
                  style={{ width: `${progress()}%` }}
                />
              </div>
              <p class={styles.helperText}>
                <Show
                  when={!waitingForVoice()}
                  fallback="Start whenever you're ready — we begin recording when we hear you."
                >
                  <Show when={liveNote()} fallback="Keep going…">
                    Hearing {liveNote()} — keep going…
                  </Show>
                </Show>
              </p>
            </div>
          </Show>

          <Show when={phase() === 'result' && result() !== null}>
            <div class={styles.centerContainer}>
              <h3>
                {result()!.lowNote} – {result()!.highNote}
              </h3>
              <p>
                You sustained a span of {result()!.semitones} semitones
                {result()!.semitones >= 24
                  ? ' — over two octaves!'
                  : result()!.semitones >= 12
                    ? ' — more than an octave.'
                    : '.'}
              </p>

              <div class={styles.rangeBar} aria-hidden="true">
                <div
                  class={styles.rangeSpan}
                  style={{
                    left: `${pct(result()!.lowMidi)}%`,
                    width: `${Math.max(2, pct(result()!.highMidi) - pct(result()!.lowMidi))}%`,
                  }}
                />
              </div>
              <div class={styles.rangeBarLabels} aria-hidden="true">
                <span>E2</span>
                <span>C4</span>
                <span>C6</span>
              </div>

              <Show when={result()!.voiceHint !== null}>
                <p>Your range overlaps most with:</p>
                <div class={styles.resultBadge}>{result()!.voiceHint}</div>
              </Show>

              <Show when={result()!.semitones < 12}>
                <p class={styles.helperText}>
                  That span looks narrow — try again and push a little further
                  at both ends for a truer picture.
                </p>
              </Show>

              <div class={styles.resultActions}>
                <button
                  type="button"
                  class={styles.secondaryBtn}
                  onClick={() => void start()}
                >
                  Try Again
                </button>
                <Show when={recommendedPreset() !== null}>
                  <button
                    type="button"
                    class={styles.actionBtn}
                    onClick={handleApply}
                  >
                    Use This Preset
                  </button>
                </Show>
              </div>
            </div>
          </Show>

          <Show when={phase() === 'no-result'}>
            <div class={styles.centerContainer}>
              <h3>We couldn't get a clear reading</h3>
              <p class={styles.helperText}>
                We need a few seconds of clear, sustained singing per take. Find
                a quiet spot, sing out comfortably, and give it another go.
              </p>
              <button
                type="button"
                class={styles.actionBtn}
                onClick={() => void start()}
              >
                Try Again
              </button>
            </div>
          </Show>

          <Show when={phase() === 'error'}>
            <div class={styles.centerContainer}>
              <h3>We couldn't access your microphone</h3>
              <p class={styles.helperText}>
                Allow microphone access in your browser, then try again.
              </p>
              <button
                type="button"
                class={styles.actionBtn}
                onClick={() => void start()}
              >
                Allow &amp; retry
              </button>
            </div>
          </Show>
        </div>
      </div>
    </div>
  )
}
