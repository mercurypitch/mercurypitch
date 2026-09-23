// Coda Echo — optional portrait melody and explicit local musical memory, after the lesson is complete.
import { createSignal, For, onCleanup, onMount, Show, untrack } from 'solid-js'
import type { GalleryEncore } from '../content/encores'
import type { GlassMelodyId } from '../content/melodies'
import { GLASS_MELODIES, glassMelody } from '../content/melodies'
import type { MusicalMemory } from '../core/musical-memory'
import { memoryFileName } from '../core/musical-memory'
import type { GlassGameHost } from '../host'
import { focusDialog, trapDialogKeys } from './dialog-focus'
import styles from './EncoreDialog.module.css'
import type { MelodyPracticeSnapshot } from './melody-practice'
import { MelodyPractice } from './MelodyPractice'
import type { MusicalMemoryState } from './musical-memory'
import { createMusicalMemory } from './musical-memory'

export function EncoreDialog(props: {
  host: GlassGameHost
  levelId: string
  encore: GalleryEncore
  beforeCapture(): Promise<void>
  onReleaseVoice(): void
  onComplete?(): void
  onClose(): void
  returnLabel?: string
}) {
  const host = untrack(() => props.host)
  const encore = untrack(() => props.encore)
  const levelId = untrack(() => props.levelId)
  const sealKey = `encore:${levelId}:${encore.id}:${encore.revision}`
  const [selected, setSelected] = createSignal<GlassMelodyId>(encore.melodyId)
  const [sealed, setSealed] = createSignal(
    host.readPreference(sealKey) === 'earned',
  )
  const [celebrating, setCelebrating] = createSignal(false)
  const [foreground, setForeground] = createSignal(true)
  const [playing, setPlaying] = createSignal(false)
  const [practiceActive, setPracticeActive] = createSignal(false)
  const [status, setStatus] = createSignal('')
  const [state, setState] = createSignal<MusicalMemoryState>({
    consent: false,
    recording: false,
    elapsedSeconds: 0,
    saving: false,
    candidate: null,
    saved: null,
    message: '',
  })
  const memory = createMusicalMemory({
    levelId,
    title: encore.title,
    store: host.memories,
    onChange: setState,
  })
  const playback = host.createMemoryPlayback?.()
  let alive = true
  let playbackGeneration = 0
  let releaseTimer: ReturnType<typeof setTimeout> | undefined
  const downloadUrls = new Set<string>()

  async function stopPlayback(): Promise<void> {
    playbackGeneration++
    setPlaying(false)
    await playback?.stop()
  }

  async function beforeCapture(): Promise<void> {
    await Promise.all([stopPlayback(), props.beforeCapture()])
  }

  async function listen(take: MusicalMemory): Promise<void> {
    if (!playback || !foreground() || practiceActive()) return
    const token = ++playbackGeneration
    setStatus('')
    // The player's factory reaches the shared context synchronously in this tap.
    const quiet = props.beforeCapture()
    const releaseVoice = props.onReleaseVoice
    setPlaying(true)
    const started = await playback.play(
      take.audio,
      () => {
        if (!alive || token !== playbackGeneration) return
        setPlaying(false)
        releaseVoice()
      },
      quiet,
    )
    if (!alive || token !== playbackGeneration) return
    if (!started) {
      setPlaying(false)
      setStatus(
        'This browser could not play the take. You can download it instead.',
      )
      props.onReleaseVoice()
    }
  }

  async function stopListening(): Promise<void> {
    const releaseVoice = props.onReleaseVoice
    await stopPlayback()
    releaseVoice()
  }

  function download(take: MusicalMemory): void {
    const url = URL.createObjectURL(take.audio)
    downloadUrls.add(url)
    const link = document.createElement('a')
    link.href = url
    link.download = memoryFileName(take)
    document.body.append(link)
    link.click()
    link.remove()
    setTimeout(() => {
      URL.revokeObjectURL(url)
      downloadUrls.delete(url)
    }, 1000)
  }

  function completed(snapshot: MelodyPracticeSnapshot): void {
    if (snapshot.judge?.complete !== true) return
    setSealed(true)
    setCelebrating(true)
    host.writePreference(sealKey, 'earned')
    void memory.completed(snapshot)
    props.onComplete?.()
    clearTimeout(releaseTimer)
    releaseTimer = setTimeout(() => {
      if (alive) setCelebrating(false)
    }, 2600)
  }
  onMount(() => {
    void memory.load()
    const unsubscribe = host.subscribeForeground((value) => {
      setForeground(value)
      if (!value) void stopPlayback()
    })
    onCleanup(unsubscribe)
  })
  onCleanup(() => {
    alive = false
    playbackGeneration++
    clearTimeout(releaseTimer)
    memory.dispose()
    playback?.dispose()
    props.onReleaseVoice()
    downloadUrls.forEach((url) => URL.revokeObjectURL(url))
  })
  const recordControls = () => (
    <div class={styles.recording}>
      <label class={styles.consent}>
        <input
          type="checkbox"
          checked={state().consent}
          onChange={(event) => memory.setConsent(event.currentTarget.checked)}
        />
        Keep a recording of my next melody
      </label>
      <p>
        Your voice stays on this device. Save only the take you want to keep.
      </p>
      <Show when={state().recording}>
        <div class={styles.recordingActive} role="status">
          <span aria-hidden="true" /> Recording ·{' '}
          {Math.floor(state().elapsedSeconds / 60)}:
          {String(Math.floor(state().elapsedSeconds % 60)).padStart(2, '0')}
          <button type="button" onClick={() => memory.setConsent(false)}>
            Stop recording
          </button>
        </div>
      </Show>
    </div>
  )
  const takeControls = (take: MusicalMemory, candidate: boolean) => (
    <section
      class={styles.take}
      aria-label={candidate ? 'New recording' : 'Saved recording'}
    >
      <div>
        <strong>{candidate ? 'Your new take' : 'Your saved take'}</strong>
        <span>{take.title}</span>
      </div>
      <div class={styles.takeActions}>
        <Show when={playback}>
          <button
            type="button"
            disabled={practiceActive()}
            onClick={() => void listen(take)}
          >
            Listen
          </button>
        </Show>
        <button type="button" onClick={() => download(take)}>
          Download
        </button>
        <Show when={candidate && host.memories}>
          <button
            type="button"
            disabled={state().saving || state().saved === take}
            onClick={() => void memory.save()}
          >
            {state().saved === take
              ? 'Saved'
              : state().saved
                ? 'Replace saved take'
                : 'Save take'}
          </button>
        </Show>
        <button
          type="button"
          disabled={state().saving}
          onClick={() => {
            void stopPlayback()
            if (candidate) memory.discardCandidate()
            else void memory.deleteSaved()
          }}
        >
          {candidate ? 'Discard new take' : 'Delete saved take'}
        </button>
      </div>
    </section>
  )
  return (
    <div
      class={styles.scrim}
      onClick={(event) => {
        if (event.target === event.currentTarget) props.onClose()
      }}
    >
      <section
        class={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="encore-title"
        ref={focusDialog}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.stopPropagation()
            props.onClose()
          } else trapDialogKeys(event)
        }}
      >
        <header class={styles.header}>
          <div>
            <span>Coda Echo · optional</span>
            <h2 id="encore-title">Leave a little light.</h2>
          </div>
          <button
            type="button"
            onClick={() => props.onClose()}
            aria-label={props.returnLabel ?? 'Back to completion card'}
          >
            Back
          </button>
        </header>
        <div class={styles.body}>
          <aside class={styles.portrait} data-celebrating={celebrating()}>
            <img
              src={host.assetUrl(encore.portraitAssetId)}
              alt="Your collected gallery portrait"
            />
            <div class={styles.halo} aria-hidden="true">
              <For each={[0, 1, 2, 3, 4, 5, 6, 7]}>
                {(index) => <i style={{ '--ray': `${index * 45}deg` }} />}
              </For>
            </div>
            <p>
              {selected() === encore.melodyId
                ? `“${encore.words}”`
                : 'Hum the shape, or give it your own words.'}
            </p>
            <Show when={sealed()}>
              <div class={styles.seal} role="status">
                <svg viewBox="0 0 32 32" aria-hidden="true">
                  <path d="m16 2 4 9 10 5-10 5-4 9-4-9-10-5 10-5Z" />
                </svg>
                {encore.sealTitle}
              </div>
            </Show>
            <small>Your lesson, stars and portrait are already yours.</small>
          </aside>
          <div class={styles.practiceColumn}>
            <label class={styles.shape}>
              <span>Melody shape</span>
              <select
                value={selected()}
                disabled={practiceActive()}
                onChange={(event) => {
                  void stopPlayback()
                  memory.setConsent(false)
                  setSelected(event.currentTarget.value as GlassMelodyId)
                }}
              >
                <For each={GLASS_MELODIES}>
                  {(melody) => (
                    <option value={melody.id}>
                      {melody.title} ·{' '}
                      {melody.phrases.reduce(
                        (count, phrase) => count + phrase.anchors.length,
                        0,
                      )}{' '}
                      notes
                    </option>
                  )}
                </For>
              </select>
            </label>
            <Show when={selected()} keyed>
              {(id) => (
                <MelodyPractice
                  host={host}
                  melody={glassMelody(id)}
                  createReference={(contour) =>
                    host.createMelodyReference!(contour)
                  }
                  beforeCapture={beforeCapture}
                  onReleaseVoice={() => props.onReleaseVoice()}
                  canPlay={foreground}
                  onComplete={completed}
                  onChange={(snapshot) =>
                    setPracticeActive(
                      [
                        'permission',
                        'calibrating',
                        'reference',
                        'singing',
                      ].includes(snapshot.mode),
                    )
                  }
                  recording={memory.recording}
                  showConfigurationControls
                />
              )}
            </Show>
            {recordControls()}
            <Show when={state().message}>
              <p class={styles.status} role="status">
                {state().message}
              </p>
            </Show>
            <Show when={state().candidate}>
              {(take) => takeControls(take(), true)}
            </Show>
            <Show
              when={state().saved !== state().candidate ? state().saved : null}
            >
              {(take) => takeControls(take(), false)}
            </Show>
            <Show when={playing()}>
              <button
                type="button"
                class={styles.stop}
                onClick={() => void stopListening()}
              >
                Stop listening
              </button>
            </Show>
            <Show when={status()}>
              <p class={styles.status} role="alert">
                {status()}
              </p>
            </Show>
          </div>
        </div>
      </section>
    </div>
  )
}
