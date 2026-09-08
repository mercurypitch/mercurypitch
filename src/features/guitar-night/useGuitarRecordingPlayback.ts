// One audition owner serves recorded input and corrected notes without acquiring a microphone.
import type { Accessor } from 'solid-js'
import { batch, createEffect, createMemo, createSignal, onCleanup, untrack, } from 'solid-js'
import type { GuitarRecordingDraft } from '@/db/services/guitar-recording-service'
import type { GuitarAmpStage } from '@/lib/guitar/guitar-amp-stage'
import { createGuitarAmpStage } from '@/lib/guitar/guitar-amp-stage'
import type { GuitarElectricAmpParameters } from '@/lib/guitar/guitar-electric-amp'
import { createRecordingNotePlayer } from '@/lib/guitar/recording-note-player'
import type { GuitarRecordingPlaybackSource, GuitarRecordingPlaybackTone, } from '@/lib/guitar/recording-playback'
import { recordingPlaybackAmp, recordingPlaybackNotes, } from '@/lib/guitar/recording-playback'
import type { GuitarPracticeScore } from '@/lib/guitar/recording-types'
import type { PreviewPlayerOptions } from '@/lib/preview-player'
import { createPreviewPlayer, ENVELOPE_DEFAULTS } from '@/lib/preview-player'

interface GuitarRecordingPlaybackOptions {
  draft: Accessor<GuitarRecordingDraft | null>
  score: Accessor<GuitarPracticeScore | null>
  currentAmp: Accessor<GuitarElectricAmpParameters>
  blocked: Accessor<boolean>
  /** Opens only the room's output context, never Listening or input monitoring. */
  activate(): Promise<NonNullable<PreviewPlayerOptions['audioGraph']> | null>
  beforePlay(): void
}

interface AuditionPlayer {
  play(startSeconds?: number): Promise<boolean>
  pause(): void
  stop(): void
  seek(seconds: number): void
  dispose(): void
  readonly currentTime: number
}

const RELEASE_MS = ENVELOPE_DEFAULTS.releaseMs + 60

export function useGuitarRecordingPlayback(
  options: GuitarRecordingPlaybackOptions,
) {
  const [source, setSource] =
    createSignal<GuitarRecordingPlaybackSource>('recording')
  const [tone, setTone] =
    createSignal<GuitarRecordingPlaybackTone>('current-amp')
  const [playing, setPlaying] = createSignal(false)
  const [pending, setPending] = createSignal(false)
  const [engaged, setEngaged] = createSignal(false)
  const [position, setPosition] = createSignal(0)
  const [error, setError] = createSignal<string | null>(null)
  const [ampStatus, setAmpStatus] = createSignal<ReturnType<
    GuitarAmpStage['getStatus']
  > | null>(null)
  const notes = createMemo(() => {
    const draft = options.draft()
    return draft === null ? [] : recordingPlaybackNotes(draft, options.score())
  })
  const duration = createMemo(() => {
    const row = options.draft()?.recording
    const captured = row === undefined ? 0 : row.frames / row.sampleRate
    return source() === 'recording'
      ? captured
      : notes().reduce((end, note) => Math.max(end, note.endSeconds), captured)
  })
  const parameters = createMemo(() =>
    recordingPlaybackAmp(
      tone(),
      options.currentAmp(),
      options.draft()?.recording.amp ?? null,
    ),
  )
  const sourceAvailable = (kind: GuitarRecordingPlaybackSource) =>
    kind === 'recording' ? options.draft()?.blob != null : notes().length > 0
  const available = () => sourceAvailable(source()) && parameters() !== null
  let player: AuditionPlayer | null = null
  let amp: GuitarAmpStage | null = null
  let latestParameters = untrack(parameters)
  let url: string | null = null
  let generation = 0
  let playerEpoch = 0
  let disposed = false
  let retireUntil = 0
  let pendingStartSeconds: number | null = null

  const pause = () => {
    generation++
    setPosition(player?.currentTime ?? position())
    player?.pause()
    // Notes retire their run on Pause; its fading processor no longer owns
    // the selected tone. Resume constructs a fresh stage with latest settings.
    if (source() === 'notes') {
      amp = null
      setAmpStatus(null)
    }
    batch(() => {
      setPlaying(false)
      setPending(false)
    })
  }
  const retire = () => {
    playerEpoch++
    const previous = player
    const previousUrl = url
    player = null
    amp = null
    url = null
    if (previous === null) {
      if (previousUrl !== null) URL.revokeObjectURL(previousUrl)
      return
    }
    previous.pause()
    // PreviewPlayer disposal is intentionally immediate. Let its final-output
    // envelope retire first, including amp tails, before releasing the graph.
    retireUntil = performance.now() + RELEASE_MS
    setTimeout(() => {
      previous.dispose()
      if (previousUrl !== null) URL.revokeObjectURL(previousUrl)
    }, RELEASE_MS)
  }
  const reset = () => {
    generation++
    pendingStartSeconds = null
    retire()
    batch(() => {
      setPlaying(false)
      setPending(false)
      setEngaged(false)
      setPosition(0)
      setAmpStatus(null)
      setError(null)
    })
  }
  createEffect(() => {
    options.draft()
    if (source() === 'notes') notes()
    untrack(reset)
  })
  createEffect(() => {
    latestParameters = parameters()
    if (latestParameters !== null) amp?.setParameters(latestParameters)
    else untrack(pause)
    setAmpStatus(amp?.getStatus() ?? null)
  })
  createEffect(() => {
    if (options.blocked()) untrack(pause)
  })
  createEffect(() => {
    if (!playing()) return
    let frame = 0
    const tick = () => {
      setPosition(player?.currentTime ?? 0)
      setAmpStatus(amp?.getStatus() ?? null)
      frame = requestAnimationFrame(tick)
    }
    tick()
    onCleanup(() => cancelAnimationFrame(frame))
  })
  createEffect(() => {
    if (playing() || ampStatus() !== 'loading') return
    // Media keeps its processor across Pause. Cabinet loading can finish
    // while parked; don't leave a stale loading/fallback label until Play.
    const timer = setInterval(() => setAmpStatus(amp?.getStatus() ?? null), 100)
    onCleanup(() => clearInterval(timer))
  })
  onCleanup(() => {
    disposed = true
    generation++
    retire()
  })

  const toggle = async () => {
    if (playing() || pending()) {
      pause()
      return
    }
    const draft = options.draft()
    const kind = source()
    const melody = notes()
    const length = duration()
    if (disposed || options.blocked() || !available() || draft === null) return
    options.beforePlay()
    const attempt = ++generation
    setError(null)
    setPending(true)
    try {
      const graph = await options.activate()
      if (disposed || attempt !== generation) return
      if (graph === null)
        throw new Error('Audio could not start. Try Play again.')
      const waitMs = retireUntil - performance.now()
      if (waitMs > 0)
        await new Promise<void>((resolve) => setTimeout(resolve, waitMs))
      if (disposed || attempt !== generation) return
      if (player === null) {
        const epoch = ++playerEpoch
        const onEnded = () => {
          if (disposed || epoch !== playerEpoch || !playing()) return
          setPosition(length)
          setPlaying(false)
        }
        const createProcessing = (context: AudioContext) => {
          const stage = createGuitarAmpStage(
            context,
            latestParameters ?? { enabled: false },
          )
          amp = stage
          setAmpStatus(stage.getStatus())
          return {
            input: stage.input,
            output: stage.output,
            dispose: () => {
              stage.dispose()
              if (amp !== stage) return
              amp = null
              if (!disposed) setAmpStatus(null)
            },
          }
        }
        if (kind === 'recording') {
          url = URL.createObjectURL(draft.blob!)
          const media = createPreviewPlayer({
            audioGraph: graph,
            createProcessing,
            onEnded,
            errorMessage:
              'This recording could not be played. Reopen the take and try again.',
          })
          const mediaUrl = url
          player = {
            play: (startSeconds) => media.play(mediaUrl, { startSeconds }),
            pause: media.pause,
            stop: media.stop,
            seek: (seconds) =>
              media.seekToFraction(length > 0 ? seconds / length : 0),
            dispose: media.dispose,
            get currentTime() {
              return media.currentTime
            },
          }
        } else {
          const melodyPlayer = createRecordingNotePlayer({
            audioGraph: graph,
            createProcessing,
            onEnded,
            notes: melody,
            durationSeconds: length,
            onError: () => {
              if (!disposed && epoch === playerEpoch) {
                setError('The notes could not be played. Try Play again.')
                setPlaying(false)
                setPending(false)
              }
            },
          })
          player = {
            play: (startSeconds) => {
              if (startSeconds !== undefined) melodyPlayer.seek(startSeconds)
              return melodyPlayer.play()
            },
            pause: melodyPlayer.pause,
            stop: melodyPlayer.stop,
            seek: melodyPlayer.seek,
            dispose: melodyPlayer.dispose,
            get currentTime() {
              return melodyPlayer.currentTime
            },
          }
        }
      }
      const startedPlayer = player
      // Read after activation/retirement: scrubbing while output is opening
      // updates this position without creating another context or microphone.
      const start =
        pendingStartSeconds ?? (position() >= length ? 0 : undefined)
      const ok = await startedPlayer.play(
        start === undefined || start < length ? start : 0,
      )
      if (disposed || attempt !== generation) {
        if (startedPlayer !== player || (!playing() && !pending()))
          startedPlayer.pause()
        return
      }
      pendingStartSeconds = null
      batch(() => {
        setPending(false)
        setEngaged(ok)
        setPlaying(ok)
        if (!ok) setError('Playback could not start. Try Play again.')
      })
    } catch (cause) {
      if (disposed || attempt !== generation) return
      retire()
      setPending(false)
      setPlaying(false)
      setError(
        cause instanceof Error
          ? cause.message
          : 'Playback could not start. Try Play again.',
      )
    }
  }
  const restart = () => {
    reset()
    setEngaged(true)
  }
  const stop = () => {
    generation++
    player?.stop()
    pendingStartSeconds = 0
    if (source() === 'notes') {
      amp = null
      setAmpStatus(null)
    }
    batch(() => {
      setPlaying(false)
      setPending(false)
      setPosition(0)
      setError(null)
    })
  }
  const seek = (seconds: number) => {
    if (disposed || !Number.isFinite(seconds)) return
    const target = Math.min(duration(), Math.max(0, seconds))
    const wasPending = pending()
    // An already-created player's pending Play may be waiting on decoding or
    // a notes release. Supersede that attempt; only the newest seek may start.
    if (target >= duration() || (wasPending && player !== null)) pause()
    if (source() === 'notes') {
      amp = null
      setAmpStatus(null)
    }
    player?.seek(target)
    pendingStartSeconds = playing() ? null : target
    batch(() => {
      setPosition(target)
      setEngaged(true)
      setError(null)
    })
    if (wasPending && player !== null && target < duration()) void toggle()
  }
  return {
    source,
    setSource,
    tone,
    setTone,
    parameters,
    ampStatus,
    sourceAvailable,
    savedAmpAvailable: () => options.draft()?.recording.amp != null,
    playing,
    pending,
    engaged,
    position,
    duration,
    error,
    pause,
    stop,
    seek,
    toggle,
    restart,
    showHistory: () => {
      pause()
      setEngaged(false)
    },
    available,
  }
}
export type GuitarRecordingPlayback = ReturnType<
  typeof useGuitarRecordingPlayback
>
