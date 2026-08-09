// ============================================================
// HomeDrill — scale-degree identification, the Ear Lab's spine.
//
// A cadence plants the key (four dots light as the chords land), a
// probe note sounds, and the answer comes by tap (seven buttons) or
// by mic — sing or play the degree on any instrument. The reveal
// colours the truth: the correct degree goes green; a wrong pick
// goes red beside it while the probe replays and falls to the
// tonic. Mic answers add the production half of the diagnostic:
// "Yes — Sol, 12¢ sharp."
//
// The component owns the microphone lifecycle (micManager + f0
// stream); the controller only opens answer windows on it.
// ============================================================

import type { JSX } from 'solid-js'
import { createMemo, createSignal, For, onCleanup, Show } from 'solid-js'
import { useEngines } from '@/contexts/EngineContext'
import { isProvisional } from '@/lib/ear/elo'
import { HOME_DEGREES, HOME_DRILL_ID, HOME_SING_DRILL_ID, } from '@/lib/ear/item-bank'
import { micManager } from '@/lib/mic-manager'
import type { F0Stream } from '@/lib/pitch-f0-stream'
import { createF0Stream } from '@/lib/pitch-f0-stream'
import { earPlayerRating, homeAnswerMode, setHomeAnswerMode, } from '@/stores/ear-lab-store'
import styles from './EarDrill.module.css'
import type { HomeAnswerMode, SingCapture } from './use-home-controller'
import { useHomeController } from './use-home-controller'

interface HomeDrillProps {
  onBack: () => void
}

const CADENCE_LABELS = ['I', 'IV', 'V', 'I']
const MIC_CONSUMER = 'ear-home-drill'

export function HomeDrill(props: HomeDrillProps): JSX.Element {
  const { audioEngine } = useEngines()
  const [micError, setMicError] = createSignal('')

  let f0: F0Stream | null = null
  const capture: SingCapture = {
    startWindow: () => f0?.startTask(),
    takeFrames: () =>
      (f0?.takeFrames() ?? []).map((frame) => ({
        f0: frame.f0,
        conf: frame.conf,
      })),
  }

  const controller = useHomeController(audioEngine, capture, {
    cancelAudio: () => audioEngine.stopTone(60),
  })

  function releaseMic(): void {
    f0?.dispose()
    f0 = null
    micManager.release(MIC_CONSUMER)
  }
  // The controller registers its own cleanup; this one owns the mic.
  onCleanup(releaseMic)

  async function handleStart(): Promise<void> {
    setMicError('')
    let mode: HomeAnswerMode = homeAnswerMode()
    if (mode === 'mic' && f0 === null) {
      try {
        await audioEngine.init()
        await audioEngine.resume()
        const ctx = audioEngine.getAudioContext()
        if (!ctx) throw new Error('Audio engine has no context')
        const stream = await micManager.acquire(MIC_CONSUMER)
        f0 = createF0Stream(ctx, stream)
      } catch {
        setMicError(
          'Microphone unavailable — starting in tap mode. Allow mic access to sing your answers.',
        )
        mode = 'tap'
      }
    } else if (mode === 'tap' && f0 !== null) {
      // Switched back to tapping: hand the device back rather than
      // holding an open mic for a run that will never listen.
      releaseMic()
    }
    controller.start(mode)
  }

  const running = () =>
    controller.phase() !== 'idle' && controller.phase() !== 'done'

  const stageClass = createMemo(() => {
    if (controller.phase() !== 'reveal') return styles.stage
    const correct =
      controller.answeredDegree() === controller.currentDegree()?.degree
    return `${styles.stage} ${correct ? styles.correct : styles.wrong}`
  })

  const centsLabel = (): string => {
    const cents = controller.lastCents()
    if (cents === null) return ''
    if (Math.abs(cents) < 8) return ', dead in tune'
    return `, ${Math.abs(cents)}¢ ${cents > 0 ? 'sharp' : 'flat'}`
  }

  const stageHint = () => {
    switch (controller.phase()) {
      case 'cadence':
        return 'Planting the key…'
      case 'probe':
        return 'The note — which degree is it?'
      case 'answer':
        if (controller.mode() === 'mic') {
          return controller.unclear()
            ? 'Did not catch that — once more, louder and steadier'
            : 'Sing or play the degree you heard…'
        }
        return 'Which degree was that?'
      case 'reveal': {
        const target = controller.currentDegree()
        if (!target) return ''
        if (controller.answeredDegree() === null) {
          return `No clear take — that was ${target.solfege} (${target.degree}). Round skipped, rating untouched.`
        }
        const correct = controller.answeredDegree() === target.degree
        return correct
          ? `Yes — ${target.solfege} (${target.degree})${centsLabel()}`
          : `That was ${target.solfege} (${target.degree}) — hear it fall home`
      }
      default:
        return ''
    }
  }

  function degreeClass(degree: number): string {
    if (controller.phase() !== 'reveal') return styles.degreeBtn
    const target = controller.currentDegree()?.degree
    const picked = controller.answeredDegree()
    if (degree === target) return `${styles.degreeBtn} ${styles.correctPick}`
    if (degree === picked) return `${styles.degreeBtn} ${styles.wrongPick}`
    return styles.degreeBtn
  }

  return (
    <div class={styles.drill} data-ear-drill="home">
      <div class={styles.header}>
        <button
          type="button"
          class={styles.backBtn}
          onClick={() => props.onBack()}
        >
          Back
        </button>
        <h2>Home</h2>
        <span class={styles.modeChip}>
          {controller.mode() === 'mic' && running() ? 'Voice · ' : ''}
          Rating {Math.round(controller.rating().rating)}
          {isProvisional(controller.rating()) ? ' · settling' : ''}
        </span>
      </div>

      <Show when={running()}>
        <div class={styles.status}>
          <span>
            Round{' '}
            <span class={styles.statusValue}>
              {Math.min(controller.round() + 1, controller.totalRounds)} /{' '}
              {controller.totalRounds}
            </span>
          </span>
          <div class={styles.progressTrack}>
            <div
              class={styles.progressFill}
              style={{
                width: `${(controller.round() / controller.totalRounds) * 100}%`,
              }}
            />
          </div>
        </div>
      </Show>

      <Show
        when={controller.phase() !== 'done'}
        fallback={
          <HomeDone
            controller={controller}
            onBack={props.onBack}
            onAgain={() => void handleStart()}
          />
        }
      >
        <div class={stageClass()}>
          <Show
            when={running()}
            fallback={
              <div class={styles.idleCard}>
                <p>
                  A short cadence tells your ear where home is. Then one note
                  sounds — name its scale degree. This is the hearing that
                  transfers to real music: not "a major sixth", but "that note
                  is La, and it wants to fall to Sol".
                </p>

                <div class={styles.modeToggle} role="radiogroup">
                  <button
                    type="button"
                    class={`${styles.modeOption} ${
                      homeAnswerMode() === 'tap' ? styles.modeActive : ''
                    }`}
                    role="radio"
                    aria-checked={homeAnswerMode() === 'tap'}
                    onClick={() => setHomeAnswerMode('tap')}
                  >
                    Tap
                  </button>
                  <button
                    type="button"
                    class={`${styles.modeOption} ${
                      homeAnswerMode() === 'mic' ? styles.modeActive : ''
                    }`}
                    role="radio"
                    aria-checked={homeAnswerMode() === 'mic'}
                    onClick={() => setHomeAnswerMode('mic')}
                  >
                    Sing or play
                  </button>
                </div>
                <Show when={homeAnswerMode() === 'mic'}>
                  <p>
                    Mic mode answers by ear alone — no buttons to luck into —
                    and reads your intonation on every note. Octave does not
                    matter; sing or play the degree anywhere comfortable.
                  </p>
                </Show>
                <Show when={micError() !== ''}>
                  <p class={styles.micError}>{micError()}</p>
                </Show>

                <button
                  type="button"
                  class={styles.primaryBtn}
                  onClick={() => void handleStart()}
                >
                  Start (12 rounds)
                </button>
              </div>
            }
          >
            <div class={styles.cadenceDots}>
              <For each={CADENCE_LABELS}>
                {(label, i) => (
                  <div
                    class={`${styles.cadenceDot} ${
                      controller.phase() !== 'cadence' ||
                      i() < controller.cadenceStep()
                        ? styles.lit
                        : ''
                    }`}
                    title={label}
                  />
                )}
              </For>
            </div>

            <p class={styles.stageHint}>{stageHint()}</p>

            <div class={styles.degreeGrid}>
              <For each={HOME_DEGREES}>
                {(degree) => (
                  <button
                    type="button"
                    class={degreeClass(degree.degree)}
                    disabled={
                      controller.phase() !== 'answer' ||
                      controller.mode() === 'mic'
                    }
                    onClick={() => controller.answer(degree.degree)}
                  >
                    <span class={styles.degreeNumber}>{degree.degree}</span>
                    <span class={styles.degreeSolfege}>{degree.solfege}</span>
                  </button>
                )}
              </For>
            </div>

            <button
              type="button"
              class={styles.secondaryBtn}
              onClick={() => controller.stop()}
            >
              Stop
            </button>
          </Show>
        </div>
      </Show>
    </div>
  )
}

function HomeDone(props: {
  controller: ReturnType<typeof useHomeController>
  onBack: () => void
  onAgain: () => void
}): JSX.Element {
  const result = () => props.controller.result()

  /** The ear-vs-voice line, once both modes have been rated. */
  const earVsVoice = (): string | null => {
    const ear = earPlayerRating(HOME_DRILL_ID)
    const voice = earPlayerRating(HOME_SING_DRILL_ID)
    if (ear.attempts === 0 || voice.attempts === 0) return null
    const gap = Math.round(ear.rating - voice.rating)
    if (Math.abs(gap) < 40) return 'Ear and voice are moving together.'
    return gap > 0
      ? `Your ear (tap ${Math.round(ear.rating)}) leads your voice (sing ${Math.round(voice.rating)}) — the hearing is there; drill the production.`
      : `Your voice (sing ${Math.round(voice.rating)}) leads your ear (tap ${Math.round(ear.rating)}) — rare, and worth more tap rounds.`
  }

  return (
    <div class={styles.stage}>
      <div class={styles.doneCard}>
        <Show when={result()}>
          {(r) => (
            <>
              <div>
                <span class={styles.reading}>
                  {Math.round(r().rating.rating)}
                </span>{' '}
                <span class={styles.readingUnit}>
                  {r().mode === 'mic' ? 'Voice rating' : 'Function rating'}
                </span>
              </div>
              <span
                class={r().ratingDelta >= 0 ? styles.deltaUp : styles.deltaDown}
              >
                {r().ratingDelta >= 0 ? '+' : ''}
                {r().ratingDelta} this session
              </span>
              <Show when={isProvisional(r().rating)}>
                <span class={styles.provisionalBadge}>
                  Provisional — keeps settling for {10 - r().rating.attempts}{' '}
                  more answers
                </span>
              </Show>
              <p class={styles.stageHint}>
                {r().correct} of {r().total} named correctly
                {r().skipped > 0 ? ` · ${r().skipped} skipped (unclear)` : ''}
                {r().medianAbsCents !== null
                  ? ` · voice typically ${r().medianAbsCents}¢ off when right`
                  : ''}
              </p>
              <Show when={earVsVoice()}>
                {(line) => <p class={styles.stageHint}>{line()}</p>}
              </Show>
              <div class={styles.outcomeDots}>
                <For each={r().outcomes}>
                  {(outcome) => (
                    <div
                      class={`${styles.outcomeDot} ${
                        outcome.correct
                          ? ''
                          : outcome.answered === 0
                            ? styles.skip
                            : styles.miss
                      }`}
                      title={`Degree ${outcome.degree}${
                        outcome.correct
                          ? ''
                          : outcome.answered === 0
                            ? ' — skipped'
                            : ` — answered ${outcome.answered}`
                      }`}
                    />
                  )}
                </For>
              </div>
            </>
          )}
        </Show>

        <div class={styles.answerRow}>
          <button
            type="button"
            class={styles.primaryBtn}
            onClick={() => props.onAgain()}
          >
            Run again
          </button>
          <button
            type="button"
            class={styles.secondaryBtn}
            onClick={() => props.onBack()}
          >
            Back to Ear Lab
          </button>
        </div>
      </div>
    </div>
  )
}
