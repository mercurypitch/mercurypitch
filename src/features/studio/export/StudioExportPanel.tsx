// Studio WAV panel — measured output is separate from its target and from the download action.
import { Show } from 'solid-js'
import type { StudioExportStage } from '@/lib/studio/export/render-wav'
import type { StudioProject } from '@/lib/studio/model/types'
import common from '../StudioPage.module.css'
import { runStudioPanelAction } from './action-focus'
import styles from './StudioExport.module.css'
import type { StudioExportController } from './useStudioExport'

interface Props {
  project: StudioProject
  controller: StudioExportController
  canExport: boolean
}
const STAGES: Record<StudioExportStage, string> = {
  preparing: 'Preparing audio…',
  rendering: 'Rendering song…',
  measuring: 'Measuring loudness…',
  encoding: 'Creating WAV…',
  verifying: 'Checking output…',
}

function reading(value: number): string {
  return Number.isFinite(value) ? value.toFixed(1) : '−∞'
}

export function StudioExportPanel(props: Props) {
  const result = () => props.controller.result()
  return (
    <div class={styles.panel} data-studio-finishing-actions>
      <div class={styles.format}>
        <strong>WAV</strong>
        <span>48 kHz · 16-bit · Stereo</span>
      </div>
      <dl class={styles.details}>
        <div>
          <dt>Range</dt>
          <dd>Full song</dd>
        </div>
        <div>
          <dt>Master target</dt>
          <dd>{props.project.master.targetLufs} LUFS</dd>
        </div>
        <div>
          <dt>Peak ceiling</dt>
          <dd>{props.project.master.ceilingDbtp} dBTP</dd>
        </div>
      </dl>
      <Show
        when={result()}
        fallback={<p class={common.help}>Measured when you export.</p>}
      >
        {(output) => (
          <>
            <h3 class={styles.resultHeading}>Ready to download</h3>
            <dl class={styles.measurements} aria-label="Measured WAV output">
              <div>
                <dt>Integrated loudness</dt>
                <dd>
                  {reading(output().measurement.integratedLufs)}{' '}
                  <span>LUFS</span>
                </dd>
              </div>
              <div>
                <dt>Sample peak</dt>
                <dd>
                  {reading(output().measurement.samplePeakDb)} <span>dBFS</span>
                </dd>
              </div>
              <div>
                <dt>True peak (estimate)</dt>
                <dd>
                  {reading(output().measurement.truePeakDb)} <span>dBTP</span>
                </dd>
              </div>
            </dl>
            <p class={common.help}>
              Measured from the encoded WAV.{' '}
              {(output().measurement.frames / 48000).toFixed(2)} seconds,
              including effect tails.
            </p>
            <Show
              when={
                Number.isFinite(output().measurement.integratedLufs) &&
                output().measurement.integratedLufs <
                  props.project.master.targetLufs - 0.5
              }
            >
              <p class={common.help}>
                The master keeps its gain and peak limits, even when the result
                is below the target.
              </p>
            </Show>
          </>
        )}
      </Show>
      <Show
        when={props.controller.busy()}
        fallback={
          <Show
            when={result()}
            fallback={
              <button
                type="button"
                data-studio-finishing-action
                class={common.primaryButton}
                disabled={!props.canExport || props.project.clips.length === 0}
                onClick={(event) => {
                  const action = props.controller.exportWav
                  void runStudioPanelAction(event.currentTarget, action)
                }}
              >
                Export WAV
              </button>
            }
          >
            <button
              type="button"
              data-studio-finishing-action
              class={common.primaryButton}
              onClick={() => props.controller.download()}
            >
              Download WAV
            </button>
          </Show>
        }
      >
        <div role="status" class={styles.progress}>
          <progress
            aria-label={
              props.controller.cancelling()
                ? 'Cancelling export'
                : STAGES[props.controller.stage()]
            }
          />
          <span>
            {props.controller.cancelling()
              ? 'Stopping after the current pass…'
              : STAGES[props.controller.stage()]}
          </span>
        </div>
        <button
          type="button"
          data-studio-finishing-action
          class={common.button}
          disabled={props.controller.cancelling()}
          onClick={() => props.controller.cancel()}
        >
          Cancel export
        </button>
        <p class={common.help}>
          Keep this tab open. Cancel discards the output when the current pass
          finishes.
        </p>
      </Show>
      <Show when={props.controller.error()}>
        {(error) => (
          <p role="alert" class={styles.error}>
            {error()}
          </p>
        )}
      </Show>
      <Show when={props.controller.notice()}>
        {(notice) => (
          <p role="status" class={common.help}>
            {notice()}
          </p>
        )}
      </Show>
    </div>
  )
}
