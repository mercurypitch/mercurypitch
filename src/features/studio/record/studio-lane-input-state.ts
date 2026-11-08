// ============================================================
// Studio lane input state — each lane's own input and channels, what the last arm opened of them, and each input's channel count, for the recorder hook
// ============================================================
//
// useStudioRecorder hands the recorder a microphone for the armed lane;
// this is the lane's side of it. It keeps each lane's choice for the open
// song (lane-inputs.ts, on this device), plans what an arm opens from the
// device list the Studio holds, since the input opens inside the press,
// and keeps what the arm then opened: the input that was not there, the
// one or two channels that record, and how many channels the input has,
// remembered for the lane's picker. A song opened again forgets its lanes
// that are gone, so a removed lane's input cannot come back.
import type { Accessor } from 'solid-js'
import { createEffect, createSignal, on, untrack } from 'solid-js'
import type { ChannelPick } from '@/lib/audio-input/input-channels'
import type { StudioProject } from '@/lib/studio/model/types'
import type { InputChannelCount, StudioLaneInput, StudioLaneInputPlan, } from '@/lib/studio/record/lane-inputs'
import { FOLLOW_STUDIO_INPUT, isMidiLaneInput, laneInputChannels, planStudioLaneInput, pruneStudioLaneInputs, readInputChannelCounts, rememberInputChannels, writeStudioLaneInput, } from '@/lib/studio/record/lane-inputs'
import type { StudioRecordSettings } from '@/lib/studio/record/record-settings'
import type { StudioInputOpened } from '@/lib/studio/record/studio-recorder'

/** What the armed lane records, once its input has opened. */
export interface StudioArmedRecords {
  /** The input that opened, by the name its track gives; '' where it gives none. */
  readonly name: string
  /** Its channels as its track reports them; null where the browser does not say. */
  readonly channels: number | null
  /** One input, or an aligned pair mixed to mono; null where the count is not known and the input goes as it is. */
  readonly pick: ChannelPick | null
  /** The lane's pick that the input does not have, or does not say it has: the default records in its place. */
  readonly missing: ChannelPick | null
}

/** What an arm opened, and what it opened in place of what its lane asked for, for the armed lane's card. */
export interface StudioArmedInput {
  /** The lane's own input, by its name, was not connected: the Studio's input opened instead. */
  readonly laneMissing: string | null
  /** The input asked for, by its name, was gone as it opened: the default opened instead. */
  readonly defaultInstead: string | null
  /** What records; null until the input has opened. */
  readonly records: StudioArmedRecords | null
}

const NOTHING_OPENED: StudioArmedInput = {
  laneMissing: null,
  defaultInstead: null,
  records: null,
}

export interface StudioLaneInputStateOptions {
  readonly project: Accessor<StudioProject | null>
  /** The Studio's input, from the Sound panel, that a lane follows unless it has its own. */
  readonly settings: Accessor<StudioRecordSettings>
  /** The browser's inputs as the Studio holds them now. */
  readonly devices: Accessor<readonly MediaDeviceInfo[]>
}

export function createStudioLaneInputState(
  options: StudioLaneInputStateOptions,
) {
  const [lanes, setLanes] = createSignal<ReadonlyMap<string, StudioLaneInput>>(
    new Map(),
  )
  const [counts, setCounts] = createSignal<readonly InputChannelCount[]>(
    readInputChannelCounts(),
  )
  const [armed, setArmed] = createSignal<StudioArmedInput>(NOTHING_OPENED)
  // The Sound panel's input was not connected at the arm: the default opened.
  const [inputMissing, setInputMissing] = createSignal(false)
  // The input the last arm asked for and got, the lane's or the Studio's;
  // null when the default opened in its place.
  let openedAsAsked: string | null = null

  // A song's lane inputs, read as it opens: its lanes that are gone are
  // forgotten then.
  createEffect(
    on(
      () => options.project()?.id,
      (id) => {
        const song = untrack(options.project)
        setLanes(
          id === undefined || song === null
            ? new Map()
            : pruneStudioLaneInputs(
                id,
                song.tracks.map((track) => track.id),
              ),
        )
      },
    ),
  )

  /** A lane's own input and channels, or the Studio's input to follow, with its default. */
  function of(trackId: string | null): StudioLaneInput {
    return trackId === null
      ? FOLLOW_STUDIO_INPUT
      : (lanes().get(trackId) ?? FOLLOW_STUDIO_INPUT)
  }

  /** What an arm opens for `trackId`: from the list the Studio holds now, never one read afresh, as the input opens inside the press. */
  function plan(trackId: string | null): StudioLaneInputPlan {
    // A MIDI lane opens its instrument, never a microphone (the recorder
    // asks for the instrument first), so it is never planned here.
    const lane = of(trackId)
    return planStudioLaneInput(
      isMidiLaneInput(lane) ? FOLLOW_STUDIO_INPUT : lane,
      options.settings().inputDeviceId,
      options.devices(),
    )
  }

  /**
   * What MicManager opened for the arm's `asked` plan: `missing` when the
   * input asked for was gone and the default opened. Gives the pick for the
   * recorder: a channel is a jack of the input it was chosen on, so the
   * default opened in place of a gone one takes its own default.
   */
  function held(
    trackId: string | null,
    asked: StudioLaneInputPlan,
    missing: boolean,
  ): ChannelPick | null {
    const lane = of(trackId)
    const studio = options.settings()
    setInputMissing(missing && !asked.own)
    openedAsAsked = missing ? null : asked.deviceId
    const name = asked.own ? lane.label : studio.inputLabel
    setArmed({
      laneMissing: asked.laneInputMissing
        ? (lane.label ?? 'The input you chose')
        : null,
      defaultInstead: missing ? (name ?? 'the input you chose') : null,
      records: null,
    })
    return missing ? null : asked.pick
  }

  /** What the recorder opened: what records, and the input's channel count, kept for the lane's picker. */
  function opened(input: StudioInputOpened): void {
    const track = input.stream.getAudioTracks?.()[0]
    const { channels, pick, missing } = input
    setArmed((now) => ({
      ...now,
      records: { name: track?.label ?? '', channels, pick, missing },
    }))
    if (channels !== null) remember(input.stream, channels)
  }

  /** Keep how many channels the input `stream` opened has, by its track's id and name: an arm's, or the Inputs view's check. */
  function remember(stream: MediaStream, channels: number): void {
    const track = stream.getAudioTracks?.()[0]
    setCounts(
      rememberInputChannels(
        {
          deviceId: track?.getSettings?.().deviceId ?? null,
          label: track?.label ?? null,
        },
        channels,
      ),
    )
  }

  /** Keep `next` for lane `trackId` on this device; false with no song open. */
  function choose(trackId: string, next: StudioLaneInput): boolean {
    const song = options.project()
    if (song === null) return false
    setLanes(writeStudioLaneInput(song.id, trackId, next))
    setArmed(NOTHING_OPENED)
    return true
  }

  /** The Studio's input by its name, as a lane that follows it says. */
  function studioInputName(): string {
    const studio = options.settings()
    return studio.inputDeviceId === null
      ? 'Default input'
      : (studio.inputLabel ?? 'The input you chose')
  }

  /** How many channels a lane's input has, as far as this device knows; null until an arm opened it. */
  function channels(trackId: string): number | null {
    const studio = options.settings()
    return laneInputChannels(
      of(trackId),
      { deviceId: studio.inputDeviceId, label: studio.inputLabel },
      counts(),
      options.devices(),
    )
  }

  return {
    of,
    plan,
    held,
    opened,
    remember,
    choose,
    studioInputName,
    channels,
    /** Every input's channel count this device has found, newest first. */
    counts,
    /** What the last arm opened, for the armed lane's card. */
    armed,
    inputMissing,
    /** The input the last arm asked for and got, to look its round trip up by when its track names none. */
    openedAsAsked: () => openedAsAsked,
    /** A new choice in the Sound panel: what the last arm found no longer stands. */
    forget(): void {
      setInputMissing(false)
      setArmed(NOTHING_OPENED)
    },
  }
}
