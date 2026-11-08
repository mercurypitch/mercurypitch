// ============================================================
// Studio Inputs view — every audio input with its channels, levels, round trip and what to know about it, and every lane's input, in one panel
// ============================================================
//
// The Studio's I/O view. Its sections sit one after another: the audio
// inputs, each a card (StudioInputCard), then the lanes, each with the same
// input and channel picker its Track details has (StudioLaneInputField), so
// a choice here is the lane's own choice, kept on this device, and re-arms
// an armed lane. Another kind of input gets a section of its own beside the
// audio inputs. Before the browser names its inputs there is one thing to
// do, so the view offers that alone rather than a list of numbered devices.
import { Index, Show } from 'solid-js'
import { studioLaneInstrument } from '@/lib/studio/instruments/resolve'
import type { StudioProject } from '@/lib/studio/model/types'
import type { StudioLaneInputRecorder } from '../record/StudioLaneInputField'
import { StudioLaneInputField } from '../record/StudioLaneInputField'
import common from '../StudioPage.module.css'
import { StudioInputCard } from './StudioInputCard'
import styles from './StudioInputs.module.css'
import type { StudioInputsRecorder } from './useStudioInputs'
import { useStudioInputs } from './useStudioInputs'

export interface StudioInputsPanelProps {
  recorder: StudioInputsRecorder & StudioLaneInputRecorder
  project: StudioProject
  /** The Studio's clock, running, to meter a check on; null when it will not run. */
  clock(): Promise<AudioContext | null>
}

export function StudioInputsPanel(props: StudioInputsPanelProps) {
  const inputs = useStudioInputs({
    // The workspace makes its recorder once and never replaces it.
    // eslint-disable-next-line solid/reactivity
    recorder: props.recorder,
    project: () => props.project,
    clock: () => props.clock(),
  })
  const error = () => inputs.check.error()
  return (
    <div class={styles.view} data-studio-inputs="">
      <Show
        when={inputs.model().named}
        fallback={
          <div class={styles.permission}>
            <p class={common.help}>
              Studio lists your inputs by name, with their channels and levels,
              once it may use the microphone.
            </p>
            <button
              type="button"
              class={common.primaryButton}
              disabled={inputs.armed()}
              onClick={() => void inputs.check.allow()}
            >
              Allow the microphone to see your inputs
            </button>
            <Show when={error()}>
              <p class={common.inlineError} role="alert">
                {error()}
              </p>
            </Show>
          </div>
        }
      >
        <section class={styles.section} aria-labelledby="studio-inputs-audio">
          <h3 id="studio-inputs-audio">Audio inputs</h3>
          <p class={common.help}>
            {inputs.armed()
              ? 'The meters follow the input the armed lane records from. Disarm to check another.'
              : 'Check an input to see its channels and levels. It is let go when you close Inputs or arm a lane.'}
          </p>
          <Show when={error()}>
            <p class={common.inlineError} role="alert">
              {error()}
            </p>
          </Show>
          <Index each={inputs.model().devices}>
            {(device) => <StudioInputCard device={device()} inputs={inputs} />}
          </Index>
        </section>
        <section class={styles.section} aria-labelledby="studio-inputs-lanes">
          <h3 id="studio-inputs-lanes">Lanes</h3>
          <Index each={props.project.tracks}>
            {(track) => (
              <div
                class={styles.lane}
                role="group"
                aria-label={`${track().name} input`}
                data-studio-inputs-lane={track().id}
              >
                <h4>{track().name}</h4>
                <StudioLaneInputField
                  trackId={track().id}
                  trackName={track().name}
                  recorder={props.recorder}
                  inInputsView
                  instrument={studioLaneInstrument(track())}
                />
              </div>
            )}
          </Index>
        </section>
      </Show>
    </div>
  )
}
