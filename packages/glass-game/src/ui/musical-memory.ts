// Musical memory session — explicit consent, take ownership and local-save lifecycle.
import type { MusicalMemory, MusicalMemoryStore } from '../core/musical-memory'
import { MEMORY_MAX_SECONDS } from '../core/musical-memory'
import type { GlassVoiceSession, GlassVoiceTake } from '../host'
import type { MelodyPracticeRecordingAdapter, MelodyPracticeSnapshot, } from './melody-practice'

export interface MusicalMemoryState {
  consent: boolean
  recording: boolean
  elapsedSeconds: number
  saving: boolean
  candidate: MusicalMemory | null
  saved: MusicalMemory | null
  message: string
}

export function createMusicalMemory(options: {
  levelId: string
  title: string
  store?: MusicalMemoryStore
  onChange(state: MusicalMemoryState): void
  now?: () => number
}) {
  const now = options.now ?? Date.now
  let alive = true
  let generation = 0
  let storeGeneration = 0
  let take: GlassVoiceTake | null = null
  let session: GlassVoiceSession | null = null
  let captureAuthorized = false
  let clock: ReturnType<typeof setInterval> | undefined
  let startedAt = 0
  let finishedAt = 0
  let pending: Promise<Blob | null> | null = null
  let state: MusicalMemoryState = {
    consent: false,
    recording: false,
    elapsedSeconds: 0,
    saving: false,
    candidate: null,
    saved: null,
    message: '',
  }
  const emit = (patch: Partial<MusicalMemoryState>): void => {
    state = { ...state, ...patch }
    if (alive) options.onChange({ ...state })
  }

  function discardActive(): void {
    generation++
    clearInterval(clock)
    take?.discard()
    take = null
    session = null
    captureAuthorized = false
    pending = null
    emit({ recording: false })
  }
  const recording: MelodyPracticeRecordingAdapter = {
    start(voice) {
      discardActive()
      if (!alive || !state.consent) return
      emit({ candidate: null, message: '' })
      if (!voice.startRecording) {
        emit({
          message:
            'Recording is unavailable here. You can still sing the melody.',
        })
        return
      }
      try {
        take = voice.startRecording()
        session = voice
        captureAuthorized = true
        startedAt = now()
        clock = setInterval(() => {
          const elapsedSeconds = Math.max(0, (now() - startedAt) / 1000)
          if (
            elapsedSeconds >= MEMORY_MAX_SECONDS ||
            take?.isRecording?.() === false
          ) {
            discardActive()
            emit({
              message:
                'Recording stopped. Keep singing, or start a fresh take when ready.',
            })
          } else emit({ elapsedSeconds })
        }, 250)
        emit({
          consent: false,
          recording: true,
          elapsedSeconds: 0,
          message: 'Recording this melody on your device.',
        })
      } catch {
        emit({
          message:
            'Recording could not start. Your melody practice still works.',
        })
      }
    },
    stop(voice, outcome) {
      if (voice !== session || take === null) return
      if (outcome !== 'complete' || !captureAuthorized || !alive) {
        discardActive()
        emit({ message: 'Interrupted take discarded. Nothing was saved.' })
        return
      }
      clearInterval(clock)
      const current = take
      take = null
      session = null
      captureAuthorized = false
      finishedAt = now()
      try {
        pending = current.finish().catch(() => null)
      } catch {
        current.discard()
        pending = Promise.resolve(null)
      }
      emit({ recording: false, message: 'Preparing your take…' })
    },
  }
  return {
    recording,
    snapshot: (): MusicalMemoryState => ({ ...state }),
    setConsent(consent: boolean): void {
      if (!alive) return
      if (!consent) discardActive()
      emit({
        consent,
        message: consent
          ? 'Only your next sung melody is recorded. Save it only if you like it.'
          : 'Recording off. Singing still works.',
      })
    },
    async load(): Promise<void> {
      if (!options.store) return
      const token = ++storeGeneration
      try {
        const saved = await options.store.get(options.levelId)
        if (alive && token === storeGeneration) emit({ saved })
      } catch {
        if (alive && token === storeGeneration)
          emit({
            message:
              'Saved recordings are unavailable here. You can still sing and preview a new take.',
          })
      }
    },
    async completed(snapshot: MelodyPracticeSnapshot): Promise<void> {
      const prepared = pending
      pending = null
      const contour = snapshot.contour
      const token = generation
      if (!prepared || !contour || snapshot.judge?.complete !== true) return
      const audio = await prepared
      if (!alive || token !== generation) return
      const durationSeconds = Math.min(
        45,
        Math.max(0, (finishedAt - startedAt) / 1000),
      )
      if (!audio || !audio.size || durationSeconds <= 0) {
        emit({
          message:
            'The take was interrupted or too long. Your melody still counts; you can sing another take.',
        })
        return
      }
      emit({
        candidate: {
          version: 1,
          levelId: options.levelId,
          melodyId: contour.id,
          melodyVersion: contour.version,
          title: options.title,
          recordedAt: startedAt,
          rootMidi: snapshot.rootMidi!,
          pace: snapshot.pace,
          transposeSemitones: snapshot.transposeSemitones,
          durationSeconds,
          audio,
        },
        message:
          'Your take is ready. Listen first, then save it if you like it.',
      })
    },
    async save(): Promise<void> {
      const candidate = state.candidate
      if (!alive || state.saving || !candidate || !options.store) return
      const token = ++storeGeneration
      emit({ saving: true, message: 'Saving on this device…' })
      try {
        await options.store.put(candidate)
        if (alive && token === storeGeneration)
          emit({
            saved: candidate,
            saving: false,
            message: 'Saved on this device. No recording was uploaded.',
          })
      } catch {
        if (alive && token === storeGeneration)
          emit({
            saving: false,
            message:
              'Could not save here. Your take is still available to listen to or download.',
          })
      }
    },
    discardCandidate(): void {
      if (!alive) return
      discardActive()
      emit({ candidate: null, message: 'Unsaved take discarded.' })
    },
    async deleteSaved(): Promise<void> {
      if (!alive || state.saving || !options.store) return
      const token = ++storeGeneration
      const removed = state.saved
      emit({ saving: true })
      try {
        await options.store.remove(options.levelId)
        if (alive && token === storeGeneration)
          emit({
            saved: null,
            saving: false,
            candidate: state.candidate === removed ? null : state.candidate,
            message: 'Saved take deleted from this device.',
          })
      } catch {
        if (alive && token === storeGeneration)
          emit({
            saving: false,
            message: 'The saved take could not be deleted. Please try again.',
          })
      }
    },
    dispose(): void {
      if (!alive) return
      alive = false
      discardActive()
      storeGeneration++
      state = { ...state, candidate: null, saved: null }
    },
  }
}
