// Studio record notices — what the recorder is doing (a card over the lanes' foot), a take the journal still holds, and why the last take did not go the usual way.
import { Match, Show, Switch } from 'solid-js'
import { channelPickLabel } from '@/lib/audio-input/input-choices'
import { STUDIO_SAMPLE_RATE } from '@/lib/studio/model/types'
import { MicSmall } from '../studio-icons'
import common from '../StudioPage.module.css'
import { formatStudioMoment } from '../timeline/timeline-geometry'
import { studioRecordCardAside } from './record-card-aside'
import type { StudioArmedInput, StudioArmedRecords, } from './studio-lane-input-state'
import { liveTakeSpan } from './StudioLaneTake'
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

/** A take's words while it records: a loop's pass, a punch's pre-roll, or the lane alone. */
function recordingWords(recorder: StudioRecorderHandle, lane: string): string {
  const live = recorder.live()
  const cut = live?.cut ?? null
  if (live === null || cut === null) return `Recording on ${lane}`
  const span = liveTakeSpan(live)
  if (cut.mode === 'loop') return `Recording pass ${span.pass + 1} on ${lane}`
  // Before the range the song plays in; inside it, the take ends at its end.
  return span.to > span.from
    ? `Recording on ${lane} until ${formatStudioMoment(cut.range.endFrame)}`
    : `Recording on ${lane} from ${formatStudioMoment(cut.range.startFrame)}`
}

/** Which input the lane records from when it is not the one asked for; null when it is. */
function fallbackWords(input: StudioArmedInput, lane: string): string | null {
  if (input.defaultInstead !== null)
    return input.laneMissing !== null
      ? `Armed on ${lane} with the default input: ${input.laneMissing} and ${input.defaultInstead} are not connected.`
      : `Armed on ${lane} with the default input: ${input.defaultInstead} is not connected.`
  return input.laneMissing === null
    ? null
    : `Armed on ${lane} with the Studio's input: ${input.laneMissing} is not connected.`
}

/** What records of an input with more than one channel, and a pick it does not have; null for one channel. */
function recordsWords(
  records: StudioArmedRecords,
  lane: string,
): string | null {
  const name = records.name === '' ? null : records.name
  const { pick, missing } = records
  if (missing !== null && pick === null)
    return `Armed on ${lane}. The browser does not say which inputs ${name ?? 'it'} has, so all of it records.`
  if (pick === null) return null
  const taken = channelPickLabel(pick)
  if (missing !== null)
    return `Armed on ${lane}. ${name ?? 'The input'} has no ${channelPickLabel(missing)}, so ${taken} ${pick.pair ? 'record, mixed' : 'records'}.`
  if ((records.channels ?? 0) < 2) return null
  const of = name === null ? '' : ` of ${name}`
  return `Armed on ${lane} with ${taken}${of}${pick.pair ? ', mixed' : ''}. Press Record to start.`
}

/**
 * The armed card's words: what records of an input with more than one
 * channel, one input or a pair mixed to mono; which input the lane records
 * from when it is not the one asked for (a lane's own input that is not
 * connected leaves it on the Studio's; one gone as it opened, on the
 * default); and an input or pair the input does not have, with the default
 * that records in its place.
 */
export function armedWords(
  recorder: Pick<StudioRecorderHandle, 'armedInput'> &
    Partial<Pick<StudioRecorderHandle, 'midiArmed'>>,
  lane: string,
): string {
  // A MIDI lane opened its port, and no microphone: it says which.
  const midi = recorder.midiArmed?.() ?? null
  if (midi !== null)
    return `Armed on ${lane} with ${midi.port}. Press Record to start.`
  const input = recorder.armedInput()
  return (
    fallbackWords(input, lane) ??
    (input.records === null ? null : recordsWords(input.records, lane)) ??
    `Armed on ${lane}. Press Record to start.`
  )
}

/** What to know while armed: a microphone hears the speakers, a MIDI lane's take is made in the page. */
function armedAdvice(recorder: StudioRecorderHandle): string {
  const midi = recorder.midiArmed()
  if (midi !== null) return ` ${midi.words}`
  const settings = recorder.settings()
  if (settings.monitor)
    return ' Monitoring is on: use headphones, or the speakers feed back into the microphone.'
  return settings.click
    ? ' Through speakers the click can leak into the take. Headphones keep it out.'
    : ''
}

function ArmedHint(props: { recorder: StudioRecorderHandle }) {
  return (
    <span class={styles.statusHint}>
      {COUNT_IN[props.recorder.settings().countInBars]}
      {armedAdvice(props.recorder)}
    </span>
  )
}

export function StudioRecordNotices(props: StudioRecordNoticesProps) {
  const recorder = () => props.recorder
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
      {/* The last take's note stays up while its lane stays armed for the next. */}
      <Show
        when={
          (recorder().phase() === 'idle' || recorder().phase() === 'armed') &&
          message()
        }
      >
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

/**
 * The card for an armed or recording lane. It floats over the foot of the
 * lanes, above the zoom and the clip bar, so it hides neither the ruler nor
 * a lane's name and never pushes the lanes down. It mounts after the
 * timeline (StudioWorkspace.tsx), whose last row makes room for it. On a
 * phone it steps aside while an armed lane's line bar holds the foot
 * (record-card-aside.ts).
 */
export function StudioRecordStatus(props: StudioRecordNoticesProps) {
  const recorder = () => props.recorder
  const lane = () =>
    recorder().laneName(recorder().view().targetTrackId) ?? 'a new lane'
  return (
    <Show when={recorder().phase() !== 'idle' && !studioRecordCardAside()}>
      <div class={styles.statusDock}>
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
              </span>
              <p class={styles.statusText}>
                <span>{armedWords(recorder(), lane())}</span>
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
              </span>
              <p class={styles.statusText}>
                {recordingWords(recorder(), lane())}
              </p>
              {/* A timer, not status words: a screen reader is not told every second. */}
              <span class={styles.elapsed} role="timer" title="Recorded so far">
                {wholeSeconds(Math.floor(elapsedSeconds(recorder())))}
              </span>
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
      </div>
    </Show>
  )
}
