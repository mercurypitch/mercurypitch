// Studio record notices — what the recorder is doing, a take the journal still holds, and why the last take did not go the usual way.
import { Match, Show, Switch } from 'solid-js'
import { STUDIO_SAMPLE_RATE } from '@/lib/studio/model/types'
import { MicSmall } from '../studio-icons'
import common from '../StudioPage.module.css'
import { formatStudioMoment } from '../timeline/timeline-geometry'
import { StudioInputMeter } from './StudioInputMeter'
import styles from './StudioRecord.module.css'
import type { StudioRecorderHandle } from './useStudioRecorder'

export interface StudioRecordNoticesProps {
  recorder: StudioRecorderHandle
}

const COUNT_IN: Readonly<Record<0 | 1 | 2, string>> = {
  0: 'No count-in.',
  1: 'One bar of count-in.',
  2: 'Two bars of count-in.',
}

/**
 * A take's length to the second, m:ss. The running timer changes once a
 * second, not with every chunk, so the row does not reflow ten times a
 * second while a take records.
 */
function wholeSeconds(seconds: number): string {
  return formatStudioMoment(seconds * STUDIO_SAMPLE_RATE)
}

/** Seconds recorded past the playhead, from the live take. */
function elapsedSeconds(recorder: StudioRecorderHandle): number {
  const live = recorder.live()
  if (live === null) return 0
  const recorded = (live.count * live.peaks.bucketFrames) / live.sampleRate
  const preRoll =
    live.fromFrame === null
      ? 0
      : (live.fromFrame - live.heardFirst) / STUDIO_SAMPLE_RATE
  return Math.max(0, recorded - preRoll)
}

function ArmedHint(props: { recorder: StudioRecorderHandle }) {
  const settings = () => props.recorder.settings()
  return (
    <span class={styles.statusHint}>
      {COUNT_IN[settings().countInBars]}
      {settings().monitor
        ? ' Monitoring is on: use headphones, or the speakers feed back into the microphone.'
        : settings().click
          ? ' Through speakers the click can leak into the take. Headphones keep it out.'
          : ''}
    </span>
  )
}

export function StudioRecordNotices(props: StudioRecordNoticesProps) {
  const recorder = () => props.recorder
  const lane = () =>
    recorder().laneName(recorder().view().targetTrackId) ?? 'a new lane'
  const message = () => recorder().view().error ?? recorder().view().notice
  return (
    <>
      <Show when={recorder().recovery()[0]}>
        {(take) => (
          <div
            class={common.notice}
            role="status"
            data-studio-record-recovery=""
          >
            <p>
              Studio saved{' '}
              {wholeSeconds(
                Math.max(1, Math.round(take().frames / take().sampleRate)),
              )}{' '}
              of {take().title}, which isn't in the song yet.
            </p>
            <span>
              <button
                type="button"
                class={common.button}
                disabled={
                  recorder().recovering() || recorder().phase() !== 'idle'
                }
                onClick={() => void recorder().keepRecovered(take().id)}
              >
                Add to song
              </button>
              <button
                type="button"
                class={common.textButton}
                disabled={recorder().recovering()}
                onClick={() => void recorder().discardRecovered(take().id)}
              >
                Discard
              </button>
            </span>
          </div>
        )}
      </Show>
      <Show when={recorder().phase() !== 'idle'}>
        <div
          class={styles.status}
          role="status"
          data-studio-record-status={recorder().phase()}
        >
          <Switch>
            <Match when={recorder().phase() === 'arming'}>
              <p class={styles.statusText}>Opening the microphone…</p>
            </Match>
            <Match when={recorder().phase() === 'armed'}>
              <span class={styles.statusMic}>
                <MicSmall />
                <StudioInputMeter level={recorder().level()} />
              </span>
              <p class={styles.statusText}>
                <span>Armed on {lane()}. Press Record to start.</span>
                <ArmedHint recorder={recorder()} />
              </p>
              <button
                type="button"
                class={common.textButton}
                onClick={() => recorder().disarm()}
              >
                Disarm
              </button>
            </Match>
            <Match when={recorder().phase() === 'counting'}>
              <span class={styles.count} aria-hidden="true">
                {recorder().view().countBeat ?? ''}
              </span>
              <p class={styles.statusText}>Counting in on {lane()}.</p>
              <button
                type="button"
                class={common.textButton}
                onClick={() => recorder().stop()}
              >
                Cancel
              </button>
            </Match>
            <Match when={recorder().phase() === 'recording'}>
              <span class={styles.statusMic}>
                <MicSmall />
                <StudioInputMeter level={recorder().level()} />
              </span>
              <p class={styles.statusText}>
                <span>
                  Recording on {lane()},{' '}
                  <span class={styles.elapsed}>
                    {wholeSeconds(Math.floor(elapsedSeconds(recorder())))}
                  </span>
                </span>
              </p>
              <button
                type="button"
                class={common.button}
                onClick={() => recorder().stop()}
              >
                Stop
              </button>
            </Match>
            <Match when={recorder().phase() === 'finishing'}>
              <p class={styles.statusText}>Keeping the take…</p>
            </Match>
          </Switch>
        </div>
      </Show>
      <Show when={recorder().phase() === 'idle' && message()}>
        {(text) => (
          <div
            class={common.notice}
            role={recorder().view().error === null ? 'status' : 'alert'}
            data-studio-record-message=""
          >
            <p>{text()}</p>
            <button
              type="button"
              class={common.textButton}
              onClick={() => recorder().clearMessages()}
            >
              Dismiss
            </button>
          </div>
        )}
      </Show>
    </>
  )
}
