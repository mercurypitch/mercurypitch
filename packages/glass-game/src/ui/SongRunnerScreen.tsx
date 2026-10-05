// Singing Current screen — owns one runner session and one disposable renderer per comfortable-note choice.
import { createSignal, onCleanup, Show, untrack } from 'solid-js'
import { createBrowserRunnerHost, resolveRunnerComfortableMidi, runnerComfortableMidiRange, } from '../browser/runner-host'
import { createBrowserRunnerSession } from '../browser/runner-session'
import type { GlassGameHost, GlassMicrophoneInput } from '../host'
import { reportGraphicsFailure, reportGraphicsLoad, } from '../render/graphics-diagnostics'
import type { GlassAssetQualityProfile } from '../render/render-quality'
import type { SongRunnerRenderer } from '../render/runner-renderer'
import { createSongRunnerRenderer } from '../render/runner-renderer'
import type { CompiledRunnerCourse } from '../runner/contracts'
import { SINGING_CURRENT, SINGING_CURRENT_CONTINUOUS_TRIAL, SINGING_CURRENT_TRIALS, } from '../runner/first-course'
import type { RunnerCameraChoice } from './RunnerSoundTune'
import { SongRunnerView } from './SongRunnerView'

export { SINGING_CURRENT_TRIALS }
export { SINGING_CURRENT_CONTINUOUS_TRIAL }
export type SingingCurrentTrialPace = keyof typeof SINGING_CURRENT_TRIALS

export interface SongRunnerScreenProps {
  readonly allowCameraTuning?: boolean
  readonly host: GlassGameHost
  readonly course?: CompiledRunnerCourse
  readonly assetProfile?: GlassAssetQualityProfile
  readonly onExit?: () => void
}

export function SongRunnerScreen(props: SongRunnerScreenProps) {
  const initial = untrack(() => {
    const course = props.course ?? SINGING_CURRENT
    const host = createBrowserRunnerHost(props.host)
    return {
      course,
      host,
      midi: resolveRunnerComfortableMidi(
        course,
        host.readPreference('comfortable-note'),
      ),
    }
  })
  const [choice, setChoice] = createSignal(initial)
  return (
    <Show when={choice()} keyed>
      {(selected) => (
        <RunnerVisit
          host={props.host}
          course={selected.course}
          comfortableMidi={selected.midi}
          allowCameraTuning={props.allowCameraTuning}
          assetProfile={props.assetProfile}
          onExit={() => {
            if (props.onExit) props.onExit()
            else props.host.onExit()
          }}
          onChangeNote={(midi) => {
            const range = runnerComfortableMidiRange(selected.course)
            if (
              !Number.isInteger(midi) ||
              midi < range.minimumMidi ||
              midi > range.maximumMidi ||
              midi === selected.midi
            )
              return
            selected.host.writePreference('comfortable-note', String(midi))
            setChoice({ ...selected, midi })
          }}
        />
      )}
    </Show>
  )
}

function RunnerVisit(props: {
  allowCameraTuning?: boolean
  host: GlassGameHost
  course: CompiledRunnerCourse
  comfortableMidi: number
  assetProfile?: GlassAssetQualityProfile
  onExit: () => void
  onChangeNote: (midi: number) => void
}) {
  // The keyed visit owns this exact course, note and host until it unmounts.
  const host = untrack(() => createBrowserRunnerHost(props.host))
  const session = untrack(() =>
    createBrowserRunnerSession({
      course: props.course,
      comfortableMidi: props.comfortableMidi,
      host,
    }),
  )
  const [cameraProfile, setCameraProfile] = createSignal<RunnerCameraChoice>(
    untrack(() => {
      const profile = props.course.presentation.cameraProfile
      return profile === 'steering-close' || profile === 'steering-angled'
        ? profile
        : 'responsive-close'
    }),
  )
  const [loading, setLoading] = createSignal(true)
  const [error, setError] = createSignal<string>()
  let container: HTMLElement | undefined,
    renderer: SongRunnerRenderer | undefined
  let disposed = false,
    generation = 0,
    previousSeconds: number | undefined
  const reducedMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)',
  ).matches
  const unsubscribe = untrack(() =>
    session.subscribe(({ state, presentation }) => {
      if (presentation !== true || !renderer || disposed) return
      const now = state.game.courseSeconds
      const dt =
        previousSeconds === undefined
          ? 0
          : Math.max(0, Math.min(0.25, now - previousSeconds))
      previousSeconds = now
      try {
        const rendered = renderer.render(state.game, dt)
        if (
          !rendered &&
          !untrack(loading) &&
          ['preparing', 'readiness', 'count-in', 'running'].includes(
            state.phase,
          )
        )
          failed(
            'The view is unavailable. Retry to return to your checkpoint.',
            'frame',
            new Error('Renderer returned no usable frame'),
          )
      } catch (cause) {
        failed(
          'The graphics stopped. Retry to return to your checkpoint.',
          'frame',
          cause,
        )
      }
    }),
  )

  function failed(
    message: string,
    stage: 'frame' | 'context-lost' | 'asset-load',
    cause: unknown,
  ) {
    if (disposed) return
    reportGraphicsFailure('singing-current', stage, cause)
    generation++
    const old = renderer
    renderer = undefined
    old?.dispose()
    session.setPresentationReady(false)
    session.pause('renderer-unavailable')
    setLoading(false)
    setError(message)
  }

  async function load() {
    if (!container || disposed) return
    const current = ++generation
    reportGraphicsLoad('singing-current', props.course.id, 'loading')
    renderer?.dispose()
    renderer = undefined
    session.setPresentationReady(false)
    setLoading(true)
    setError(undefined)
    try {
      const next = createSongRunnerRenderer(
        container,
        props.allowCameraTuning === true
          ? {
              ...props.course,
              presentation: {
                ...props.course.presentation,
                cameraProfile: cameraProfile(),
              },
            }
          : props.course,
        props.comfortableMidi,
        host.assetUrl,
        {
          assetProfile: props.assetProfile,
          reducedMotion,
          initialSnapshot: session.state().game,
          onContextLost: () => {
            if (current === generation)
              failed(
                'The graphics stopped. Retry to return to your checkpoint.',
                'context-lost',
                new Error('WebGL context lost'),
              )
          },
        },
      )
      renderer = next
      await next.ready
      if (disposed || current !== generation) {
        next.dispose()
        return
      }
      if (!next.render(session.state().game, 0))
        throw new Error('No usable first frame')
      session.setPresentationReady(true)
      reportGraphicsLoad('singing-current', props.course.id, 'ready')
      setLoading(false)
    } catch (cause) {
      if (!disposed && current === generation)
        failed(
          'The scene could not load. Check your connection and retry.',
          'asset-load',
          cause,
        )
    }
  }
  const input = untrack(() => props.host.microphoneInput)
  const microphoneInput: GlassMicrophoneInput | undefined =
    input === undefined
      ? undefined
      : {
          list: () => input.list(),
          selected: () => input.selected(),
          select: (id) => {
            session.pause('manual')
            return input.select(id)
          },
        }
  onCleanup(() => {
    disposed = true
    generation++
    unsubscribe()
    session.dispose()
    renderer?.dispose()
    renderer = undefined
  })
  return (
    <SongRunnerView
      cameraControls={
        props.allowCameraTuning === true
          ? {
              profile: cameraProfile(),
              disabled: loading() || error() !== undefined,
              onChange: (profile) => {
                if (disposed || !renderer || profile === cameraProfile()) return
                try {
                  // Pause notifications stop the frame loop before it can publish
                  // the paused snapshot to the renderer. Sync it without time advancing.
                  if (!renderer.render(session.state().game, 0))
                    throw new Error('No usable frame for camera change')
                  if (renderer.setCameraProfile(profile))
                    setCameraProfile(profile)
                } catch (cause) {
                  failed(
                    'The view is unavailable. Retry to return to your checkpoint.',
                    'frame',
                    cause,
                  )
                }
              },
            }
          : undefined
      }
      course={props.course}
      session={session}
      assetUrl={host.assetUrl}
      comfortableMidi={props.comfortableMidi}
      comfortableMidiRange={runnerComfortableMidiRange(props.course)}
      onComfortableMidiChange={(midi) => {
        session.pause('manual')
        props.onChangeNote(midi)
      }}
      microphoneInput={microphoneInput}
      onExit={props.onExit}
      presentationLoading={loading()}
      presentationError={error()}
      onRetryPresentation={() => void load()}
      mountScene={(element) => {
        container = element
        void load()
        return () => {
          generation++
          container = undefined
          renderer?.dispose()
          renderer = undefined
          session.setPresentationReady(false)
        }
      }}
    />
  )
}
