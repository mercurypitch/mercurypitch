// Echo Curator audition — an optional three-round call-and-response room built on MelodyPractice.

import { createMemo, createSignal, For, onCleanup, Show, untrack, } from 'solid-js'
import type { EchoCuratorAuditionDefinition } from '../content/echo-curator'
import { ECHO_CURATOR_AUDITION, echoCuratorRoundNoteCount, } from '../content/echo-curator'
import { glassMelody } from '../content/melodies'
import type { GlassGameHost } from '../host'
import type { EchoCuratorSnapshot } from './echo-curator-session'
import { createEchoCuratorSession } from './echo-curator-session'
import styles from './EchoCuratorAudition.module.css'
import type { EncoreAudioLease, EncoreAudioLeaseOwner, } from './encore-audio-lease'
import { createEncoreAudioLeaseOwner } from './encore-audio-lease'
import type { MelodyPracticeMode, MelodyPracticeSnapshot, } from './melody-practice'
import { MelodyPractice } from './MelodyPractice'
import { createMercMelodyReferenceFactory } from './merc-melody-reference'

export interface EchoCuratorAuditionProps {
  host: GlassGameHost
  onClose(): void
  definition?: EchoCuratorAuditionDefinition
  audioLeases?: EncoreAudioLeaseOwner
}

function practiceActive(mode: MelodyPracticeMode): boolean {
  return ['permission', 'calibrating', 'reference', 'singing'].includes(mode)
}

export function EchoCuratorAudition(props: EchoCuratorAuditionProps) {
  const host = untrack(() => props.host)
  const definition = untrack(() => props.definition ?? ECHO_CURATOR_AUDITION)
  const fallbackLeases = createEncoreAudioLeaseOwner(
    () => Promise.resolve(),
    () => undefined,
  )
  const audioLeases = untrack(() => props.audioLeases ?? fallbackLeases)
  const [snapshot, setSnapshot] = createSignal<EchoCuratorSnapshot>({
    phase: 'intro' as const,
    roundIndex: 0,
    roundToken: null as string | null,
    completedRoundIds: [] as readonly string[],
    message: definition.introduction,
  })
  const [mode, setMode] = createSignal<MelodyPracticeMode>('idle')
  const [pace, setPace] = createSignal(1)
  const [transposeSemitones, setTransposeSemitones] = createSignal(0)
  const [referenceNotice, setReferenceNotice] = createSignal('')
  const session = createEchoCuratorSession(definition, setSnapshot)
  const references = createMercMelodyReferenceFactory(host, {
    onGuideFallback: () =>
      setReferenceNotice(
        'Merc’s recorded example is unavailable in this key and pace, so the exact instrumental guide is playing.',
      ),
  })
  let captureLease: EncoreAudioLease | undefined

  const turn = createMemo(() => {
    if (mode() === 'reference') return 'Merc’s turn'
    if (mode() === 'singing') return 'Your turn'
    if (mode() === 'permission' || mode() === 'calibrating')
      return 'Getting ready'
    return 'Untimed round'
  })

  async function beforeCapture(): Promise<void> {
    const lease = audioLeases.acquire()
    captureLease?.release()
    captureLease = lease
    try {
      await lease.quiet
    } catch (cause) {
      if (captureLease === lease) captureLease = undefined
      lease.release()
      throw cause
    }
  }

  function releaseCapture(): void {
    const lease = captureLease
    captureLease = undefined
    lease?.release()
  }

  function practiceChanged(next: MelodyPracticeSnapshot): void {
    setMode(next.mode)
    setPace(next.pace)
    setTransposeSemitones(next.transposeSemitones)
    if (next.mode === 'idle') setReferenceNotice('')
  }

  onCleanup(() => {
    releaseCapture()
    references.dispose()
  })

  return (
    <main class={styles.audition}>
      <section class={styles.room} aria-labelledby="echo-curator-title">
        <header class={styles.header}>
          <div>
            <span>Optional listening room</span>
            <h1 id="echo-curator-title">{definition.title}</h1>
          </div>
          <button type="button" onClick={() => props.onClose()}>
            Leave audition
          </button>
        </header>

        <ol class={styles.rounds} aria-label="Audition rounds">
          <For each={definition.rounds}>
            {(round, index) => {
              const completed = () =>
                snapshot().completedRoundIds.includes(round.id)
              const current = () =>
                snapshot().phase === 'round' &&
                snapshot().roundIndex === index()
              return (
                <li
                  data-complete={completed()}
                  data-current={current()}
                  aria-current={current() ? 'step' : undefined}
                >
                  <span>{index() + 1}</span>
                  <div>
                    <strong>{glassMelody(round.melodyId).title}</strong>
                    <small>{echoCuratorRoundNoteCount(round)} notes</small>
                  </div>
                </li>
              )
            }}
          </For>
        </ol>

        <Show when={snapshot().phase === 'intro'}>
          <section class={styles.invitation}>
            <p class={styles.eyebrow}>A friendly call and response</p>
            <h2>Merc sings. You answer when you are ready.</h2>
            <p>{snapshot().message}</p>
            <ul>
              <li>No timer, lives, currency or campaign penalty.</li>
              <li>Your comfortable note carries through all three rounds.</li>
              <li>Microphone permission and setup happen before your turn.</li>
            </ul>
            <button
              class={styles.primary}
              type="button"
              onClick={() => session.begin()}
            >
              Start the first round
            </button>
          </section>
        </Show>

        <Show
          when={snapshot().phase === 'round' && snapshot().roundToken}
          keyed
        >
          {(roundToken) => {
            const round = definition.rounds[snapshot().roundIndex]
            return (
              <section class={styles.challenge}>
                <div class={styles.turn} aria-live="polite">
                  <span>{turn()}</span>
                  <p>{round.invitation}</p>
                </div>
                <MelodyPractice
                  host={host}
                  melody={glassMelody(round.melodyId)}
                  createReference={(contour) => references.create(contour)}
                  beforeCapture={beforeCapture}
                  onReleaseVoice={releaseCapture}
                  onChange={practiceChanged}
                  onComplete={(practice) =>
                    session.acceptCompletion(roundToken, practice)
                  }
                  pace={pace()}
                  transposeSemitones={transposeSemitones()}
                  judgePolicy={definition.judgePolicy}
                  allowedRange={{ minimumMidi: 36, maximumMidi: 84 }}
                  showConfigurationControls
                />
                <Show when={referenceNotice()}>
                  <p class={styles.notice} role="status">
                    {referenceNotice()}
                  </p>
                </Show>
                <Show when={!practiceActive(mode())}>
                  <button
                    class={styles.textAction}
                    type="button"
                    onClick={() => session.retryRound()}
                  >
                    Restart this round
                  </button>
                </Show>
              </section>
            )
          }}
        </Show>

        <Show when={snapshot().phase === 'result'}>
          <section class={styles.result} aria-live="polite">
            <span aria-hidden="true">{snapshot().roundIndex + 1}</span>
            <p class={styles.eyebrow}>Echo answered</p>
            <h2>{snapshot().message}</h2>
            <p>
              Your round is safe. Continue when you want; nothing is counting
              down.
            </p>
            <button
              class={styles.primary}
              type="button"
              onClick={() => session.advance()}
            >
              {snapshot().roundIndex + 1 === definition.rounds.length
                ? 'Finish the audition'
                : 'Meet the next echo'}
            </button>
          </section>
        </Show>

        <Show when={snapshot().phase === 'complete'}>
          <section class={styles.result} aria-live="polite">
            <span aria-hidden="true">3</span>
            <p class={styles.eyebrow}>Audition complete</p>
            <h2>The cabinet remembers all three lights.</h2>
            <p>{snapshot().message}</p>
            <div class={styles.completionActions}>
              <button
                class={styles.primary}
                type="button"
                onClick={() => session.reset()}
              >
                Try the three rounds again
              </button>
              <button
                class={styles.secondary}
                type="button"
                onClick={() => props.onClose()}
              >
                Return to the games
              </button>
            </div>
          </section>
        </Show>
      </section>
    </main>
  )
}
