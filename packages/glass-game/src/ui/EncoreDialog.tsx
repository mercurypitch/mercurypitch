// Coda Echo — optional portrait melody and explicit local musical memory, after the lesson is complete.
import { createMemo, createSignal, For, onCleanup, onMount, Show, untrack, } from 'solid-js'
import { MERC_ENCORE_JUDGE_POLICY, MERC_ENCORE_PHRASES, mercEncoreAvailability, } from '../content/encore-examples'
import type { MercEncoreAvailability, MercEncoreVariant, } from '../content/encore-examples'
import type { GalleryEncore } from '../content/encores'
import type { GlassMelodyId } from '../content/melodies'
import { GLASS_MELODIES, glassMelody } from '../content/melodies'
import type { MusicalMemory } from '../core/musical-memory'
import { memoryFileName } from '../core/musical-memory'
import type { GlassGameHost } from '../host'
import { focusDialog, trapDialogKeys } from './dialog-focus'
import type { EncoreAudioLease } from './encore-audio-lease'
import type { EncoreAudioLeaseOwner } from './encore-audio-lease'
import { createEncorePlaybackClaims, retireEncoreAudioLease, } from './encore-audio-lease'
import styles from './EncoreDialog.module.css'
import type { MelodyPracticeSnapshot } from './melody-practice'
import { MelodyPractice } from './MelodyPractice'
import type { MusicalMemoryState } from './musical-memory'
import { createMusicalMemory } from './musical-memory'

function guideFallbackCopy(
  availability: Extract<MercEncoreAvailability, { kind: 'guide' }>,
): string {
  switch (availability.reason) {
    case 'find-note':
      return 'Find your comfortable note first. The instrumental guide will match it.'
    case 'key':
      return 'Merc’s sung take is unavailable in this key. Hear melody plays the exact instrumental guide.'
    case 'pace':
      return 'Merc’s sung take is unavailable at this pace. Hear melody plays the exact instrumental guide.'
    case 'unverified-voice':
      return 'Merc’s sung take is unavailable in this key and pace. Hear melody plays the exact instrumental guide.'
    case 'melody-version':
      return 'Merc’s sung take is unavailable for this melody. Hear melody plays the exact instrumental guide.'
    case 'shape':
      return 'Merc has no sung take for this shape. Hear melody plays the exact instrumental guide.'
  }
}

export function EncoreDialog(props: {
  host: GlassGameHost
  levelId: string
  encore: GalleryEncore
  audioLeases: EncoreAudioLeaseOwner
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
  const [practiceSnapshot, setPracticeSnapshot] =
    createSignal<MelodyPracticeSnapshot | null>(null)
  const [status, setStatus] = createSignal('')
  const [examples, setExamples] = createSignal<
    Partial<
      Record<string, { audio?: Blob; failed?: boolean; loading?: boolean }>
    >
  >({})
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
  const audioLeases = untrack(() => props.audioLeases)
  const playbackClaims = createEncorePlaybackClaims()
  let alive = true
  let captureLease: EncoreAudioLease | undefined
  let releaseTimer: ReturnType<typeof setTimeout> | undefined
  const downloadUrls = new Set<string>()
  const exampleRequests = new Map<string, AbortController>()
  const selectedAvailability = createMemo(() =>
    mercEncoreAvailability(selected(), practiceSnapshot()?.contour ?? null),
  )
  const voiceAvailability = createMemo(() => {
    const availability = selectedAvailability()
    return availability.kind === 'voice' ? availability : null
  })
  const guideAvailability = createMemo(() => {
    const availability = selectedAvailability()
    return availability.kind === 'guide' ? availability : null
  })

  async function loadExample(variant: MercEncoreVariant): Promise<Blob> {
    const cached = examples()[variant.assetId]?.audio
    if (cached !== undefined) return cached
    if (exampleRequests.has(variant.assetId))
      throw new Error('Voice example is already loading')
    const request = new AbortController()
    exampleRequests.set(variant.assetId, request)
    setExamples((current) => ({
      ...current,
      [variant.assetId]: { loading: true },
    }))
    const deadline = setTimeout(() => request.abort(), 10_000)
    try {
      const response = await fetch(host.assetUrl(variant.assetId), {
        signal: request.signal,
      })
      if (!response.ok) throw new Error('Voice example unavailable')
      const audio = await response.blob()
      if (!audio.size || audio.size > 1_000_000)
        throw new Error('Invalid voice example')
      if (alive)
        setExamples((current) => ({
          ...current,
          [variant.assetId]: { audio },
        }))
      if (!alive) throw new Error('Voice example request was cancelled')
      return audio
    } catch (cause) {
      if (alive)
        setExamples((current) => ({
          ...current,
          [variant.assetId]: { failed: true },
        }))
      throw cause
    } finally {
      clearTimeout(deadline)
      exampleRequests.delete(variant.assetId)
    }
  }

  async function stopPlayback(): Promise<void> {
    const variantAssetId = playbackClaims.currentAssetId()
    const lease = playbackClaims.takeCurrentLease()
    if (variantAssetId !== null) exampleRequests.get(variantAssetId)?.abort()
    setPlaying(false)
    await retireEncoreAudioLease(
      lease,
      () => playback?.stop() ?? Promise.resolve(),
    )
  }

  async function beforeCapture(): Promise<void> {
    const lease = audioLeases.acquire()
    captureLease = lease
    try {
      await Promise.all([stopPlayback(), lease.quiet])
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

  async function listenAudio(
    audio: Blob | Promise<Blob>,
    example = false,
    variantAssetId: string | null = null,
  ): Promise<void> {
    if (!playback || !foreground() || practiceActive()) return
    const lease = audioLeases.acquire()
    const claim = playbackClaims.claim(lease, variantAssetId)
    setStatus('')
    setPlaying(true)
    let started = false
    try {
      started = await playback.play(
        audio,
        () => {
          const completion = playbackClaims.release(claim)
          if (!completion.owned || !completion.latest || !alive) return
          setPlaying(false)
        },
        lease.quiet,
      )
    } catch {
      started = false
    }
    if (!alive || !playbackClaims.isLatest(claim)) {
      playbackClaims.release(claim)
      return
    }
    if (!started) {
      const completion = playbackClaims.release(claim)
      if (!completion.latest) return
      if (example && variantAssetId !== null)
        setExamples((current) => ({
          ...current,
          [variantAssetId]: { failed: true },
        }))
      setPlaying(false)
      setStatus(
        example
          ? 'Merc could not play this time. You can still hear your note guide.'
          : 'This browser could not play the take. You can download it instead.',
      )
    }
  }

  async function stopListening(): Promise<void> {
    await stopPlayback()
  }

  function hearMerc(variant: MercEncoreVariant): void {
    if (!playback || !foreground() || practiceActive()) return
    const current = voiceAvailability()?.variant
    if (current?.assetId !== variant.assetId) return
    void listenAudio(loadExample(variant), true, variant.assetId)
  }

  function practiceChanged(snapshot: MelodyPracticeSnapshot): void {
    const isActive = [
      'permission',
      'calibrating',
      'reference',
      'singing',
    ].includes(snapshot.mode)
    const nextAvailability = mercEncoreAvailability(
      selected(),
      snapshot.contour,
    )
    const nextAssetId =
      nextAvailability.kind === 'voice'
        ? nextAvailability.variant.assetId
        : null
    setPracticeSnapshot(snapshot)
    setPracticeActive(isActive)
    if (
      playing() &&
      (isActive ||
        (playbackClaims.currentAssetId() !== null &&
          playbackClaims.currentAssetId() !== nextAssetId))
    )
      void stopPlayback()
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
    clearTimeout(releaseTimer)
    memory.dispose()
    exampleRequests.forEach((request) => request.abort())
    const playbackLease = playbackClaims.takeCurrentLease()
    const activeCaptureLease = captureLease
    const playbackRetired = playback?.stop() ?? Promise.resolve()
    playback?.dispose()
    captureLease = undefined
    void retireEncoreAudioLease(playbackLease, () => playbackRetired).then(() =>
      activeCaptureLease?.release(),
    )
    downloadUrls.forEach((url) => URL.revokeObjectURL(url))
  })
  const recordControls = () => (
    <div class={styles.recording}>
      <label class={styles.consent}>
        <input
          type="checkbox"
          checked={state().consent}
          disabled={state().recording}
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
            onClick={() => void listenAudio(take.audio)}
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
            void stopListening()
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
              {MERC_ENCORE_PHRASES[selected()]?.words !== undefined
                ? `“${MERC_ENCORE_PHRASES[selected()]?.words}”`
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
            <Show when={playback}>
              <div class={styles.mercExample}>
                <Show
                  when={voiceAvailability()}
                  fallback={
                    <small>{guideFallbackCopy(guideAvailability()!)}</small>
                  }
                >
                  {(availability) => {
                    const state = () =>
                      examples()[availability().variant.assetId]
                    return (
                      <>
                        <button
                          type="button"
                          disabled={
                            practiceActive() || state()?.loading === true
                          }
                          onClick={() => hearMerc(availability().variant)}
                        >
                          {state()?.failed === true
                            ? 'Retry Merc’s example'
                            : state()?.loading === true
                              ? 'Loading Merc’s example…'
                              : 'Hear Merc'}
                        </button>
                        <small>
                          {state()?.failed === true
                            ? 'Merc’s take could not load. Hear melody still plays the exact instrumental guide.'
                            : 'Merc sings this exact shape in your selected key and pace.'}
                        </small>
                      </>
                    )
                  }}
                </Show>
              </div>
            </Show>
          </aside>
          <div class={styles.practiceColumn}>
            <label class={styles.shape}>
              <span>Melody shape</span>
              <select
                value={selected()}
                disabled={practiceActive()}
                onChange={(event) => {
                  void stopListening()
                  memory.setConsent(false)
                  setPracticeSnapshot(null)
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
                  onReleaseVoice={releaseCapture}
                  canPlay={foreground}
                  onComplete={completed}
                  onChange={practiceChanged}
                  recording={memory.recording}
                  judgePolicy={MERC_ENCORE_JUDGE_POLICY}
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
