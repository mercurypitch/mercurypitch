// ============================================================
// useStudioInputs — the Inputs view's live state: every input, which one is metered and how, its meters, its check, and the latency check
// ============================================================
//
// One input is metered at a time, and never on a capture of the view's own
// beside a take (input-check.ts says how the view keeps to MicManager's one
// hold and WebKit's one capture):
//  - while a lane holds the microphone, the input it records from, on the
//    arm's own split (recorder.inputTap), found in the roster by the track
//    it opened (trackIdentity);
//  - otherwise the input a check opened, while the view is open.
// Each row of that input reads a meter (channel-meters.ts): every input
// and every aligned pair, the default row reading what the default takes;
// an input whose channels the browser does not report, one meter, whole.
// The latency check opens an input as one of its own too, so it is offered
// only while nothing is armed, and a check lets its input go first.
import type { Accessor } from 'solid-js'
import { createEffect, createMemo, createSignal, onCleanup, untrack, } from 'solid-js'
import type { ChannelMeterReading, ChannelTap, } from '@/lib/audio-input/channel-meters'
import { meterChannels } from '@/lib/audio-input/channel-meters'
import { trackIdentity } from '@/lib/audio-input/device-watch'
import type { ChannelPick } from '@/lib/audio-input/input-channels'
import { channelPicks, defaultChannelPick, samePick, } from '@/lib/audio-input/input-channels'
import { buildRoster, listeningInput } from '@/lib/audio-input/mic-roster'
import { micManager } from '@/lib/mic-manager'
import type { StudioProject } from '@/lib/studio/model/types'
import { micLatencyMsForDevice } from '@/stores/mic-latency-store'
import type { StudioRecorderHandle } from '../record/useStudioRecorder'
import { createStudioInputCheck, STUDIO_INPUTS_MIC_ID } from './input-check'
import type { StudioInputDevice, StudioInputRow } from './inputs-view-model'
import { studioInputsModel, studioSignalOn } from './inputs-view-model'

/** What the view reads from the recorder. */
export type StudioInputsRecorder = Pick<
  StudioRecorderHandle,
  | 'inputs'
  | 'refreshInputs'
  | 'laneInputs'
  | 'settings'
  | 'phase'
  | 'inputTap'
  | 'busy'
>

export interface StudioInputsOptions {
  readonly recorder: StudioInputsRecorder
  readonly project: Accessor<StudioProject>
  /** The Studio's clock, running, to meter a check on; null when it will not run. */
  clock(): Promise<AudioContext | null>
}

/** The input metered now, and how. */
interface Metered {
  /** Its id in the roster. */
  readonly deviceId: string
  readonly channels: number | null
  readonly tap: ChannelTap
  /** On the arm's split, beside a take; else on a check. */
  readonly armed: boolean
}

const HOLDING = new Set(['armed', 'counting', 'recording', 'finishing'])

/**
 * An input whose channels the browser does not report is neither split
 * nor taken apart by a take: it records as it is. Its tap has no split and
 * sends it whole, so it is metered whole, on one meter, as a take hears it.
 */
const WHOLE_INPUT: ChannelPick = { channel: 0, pair: false }

export function useStudioInputs(options: StudioInputsOptions) {
  const { recorder } = options
  const armed = () => recorder.phase() !== 'idle'
  const check = createStudioInputCheck({
    armed,
    acquire: (deviceId) =>
      micManager.acquireFrom(STUDIO_INPUTS_MIC_ID, deviceId),
    clock: options.clock,
    remember: recorder.laneInputs.remember,
    watch: (ended) =>
      micManager.subscribe((state) => {
        if (state.scoped !== STUDIO_INPUTS_MIC_ID) ended()
      }),
    refresh: recorder.refreshInputs,
  })
  const [measuring, setMeasuring] = createSignal<string | null>(null)

  const model = createMemo(() =>
    studioInputsModel({
      devices: recorder.inputs(),
      studioDeviceId: recorder.settings().inputDeviceId,
      lanes: options.project().tracks.map((track) => ({
        id: track.id,
        name: track.name,
        input: recorder.laneInputs.of(track.id),
      })),
      counts: recorder.laneInputs.counts(),
      latencyMs: micLatencyMsForDevice,
    }),
  )

  // The arm's own split, from the moment a lane holds the microphone until
  // it lets go: a take starting or ending keeps the same split.
  const holding = createMemo(() => HOLDING.has(recorder.phase()))
  const armedTap = createMemo(() =>
    holding() ? untrack(() => recorder.inputTap()) : null,
  )
  const metered = createMemo((): Metered | null => {
    const tap = armedTap()
    if (tap !== null) {
      const heard = listeningInput(
        buildRoster(recorder.inputs(), trackIdentity(tap.track)),
      )
      return heard === null
        ? null
        : { deviceId: heard.deviceId, channels: tap.channels, tap, armed: true }
    }
    const open = check.open()
    return open === null ? null : { ...open, armed: false }
  })

  const [readings, setReadings] = createSignal<readonly ChannelMeterReading[]>(
    [],
  )
  const picks = createMemo((): readonly ChannelPick[] => {
    const target = metered()
    if (target === null) return []
    return target.channels === null
      ? [WHOLE_INPUT]
      : channelPicks(target.channels)
  })
  createEffect(() => {
    const target = metered()
    const meteredPicks = picks()
    if (target === null || meteredPicks.length === 0) return
    const stop = meterChannels(target.tap, meteredPicks, setReadings)
    onCleanup(() => {
      stop()
      setReadings([])
    })
  })

  /** A row's live reading, while its input is metered: the default row reads what the default takes, and the whole input's row all of it. */
  function readingOf(
    device: StudioInputDevice,
    row: StudioInputRow,
  ): ChannelMeterReading | null {
    const target = metered()
    if (target?.deviceId !== device.deviceId) return null
    const pick =
      row.pick ??
      (target.channels === null
        ? WHOLE_INPUT
        : defaultChannelPick(target.channels))
    const at = picks().findIndex((each) => samePick(each, pick))
    return readings()[at] ?? null
  }

  /** Which input of a metered device the signal is on; null for an input metered whole. */
  function signalOn(device: StudioInputDevice): string | null {
    const target = metered()
    if (target?.deviceId !== device.deviceId || target.channels === null)
      return null
    const peaks = picks()
      .map((pick, at) => (pick.pair ? null : (readings()[at]?.peak ?? 0)))
      .filter((peak): peak is number => peak !== null)
    return studioSignalOn(peaks)
  }

  /** Open the latency check for `device`; a check lets its input go first. */
  function measure(device: StudioInputDevice | null): void {
    if (device !== null && armed()) return
    check.release()
    setMeasuring(device?.deviceId ?? null)
  }

  // A lane arming takes the microphone from the latency check too.
  createEffect(() => {
    if (armed()) setMeasuring(null)
  })

  return {
    model,
    check,
    /** The input metered now, by its roster id, its channels as its track reports them (null: metered whole), and whether on the arm's split; null while none is. */
    metered: () => {
      const target = metered()
      return target === null
        ? null
        : {
            deviceId: target.deviceId,
            channels: target.channels,
            armed: target.armed,
          }
    },
    readingOf,
    signalOn,
    /** The input whose latency check is open, by its roster id. */
    measuring,
    measure,
    /** A lane holds the microphone: no check, no latency check. */
    armed,
  }
}

export type StudioInputsState = ReturnType<typeof useStudioInputs>
