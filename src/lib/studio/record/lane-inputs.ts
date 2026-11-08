// ============================================================
// Studio lane inputs — each lane's own input and channel, and how many channels each input has, kept on this device
// ============================================================
//
// A lane can record from an input of its own and take one channel of it, or
// an aligned pair mixed to mono, as a DAW's record input does: a guitar on
// input 2 of an interface, alone, or a stereo keyboard on inputs 3 and 4.
// The choice is this device's, never the song's: a device id means nothing
// on another machine, and the song's validator refuses a field it does not
// know, so a song carrying one would not open in an older build. It is kept
// by song and lane, as the device's id, the name it had (the second key, for
// an id that changed under it: resolveDeviceId), the channel and whether it
// is a pair; a row kept before pairs reads as one input. A lane with none
// follows the Studio's input from the Sound panel (record-settings.ts) and
// takes what its count makes the default (defaultChannelPick), as every
// lane did before. A song opened again forgets its lanes that are gone, and
// the most recent choices are kept, so the list cannot grow for ever.
//
// How many channels an input has is known only once it is open, so the
// arm says (studio-recorder.ts) and the count is kept by the device's id and
// name, for the lane's channel picker. Storage that throws or is missing
// keeps nothing past the session.
import type { ChannelPick } from '@/lib/audio-input/input-channels'
import { isAvailablePick, MAX_INPUT_CHANNELS, } from '@/lib/audio-input/input-channels'
import { inputsNamed } from '@/lib/audio-input/input-choices'
import type { DeviceInfoLike } from '@/lib/audio-input/mic-roster'
import { buildRoster, defaultInput } from '@/lib/audio-input/mic-roster'
import { resolveDeviceId } from '@/lib/audio-input/saved-input'

export interface StudioLaneInput {
  /** The lane's own input; null to follow the Studio's (the Sound panel's). */
  readonly deviceId: string | null
  /** Its name when chosen: the second key to find it by, and what to call it when it is gone. */
  readonly label: string | null
  /** The input to record, 0-based, or the first of a pair; null for the default its channel count makes. */
  readonly channel: number | null
  /** `channel` and the one after it, mixed to mono: an aligned pair, `channel` even. */
  readonly pair: boolean
}

/** A lane that follows the Studio's input and takes its default. */
export const FOLLOW_STUDIO_INPUT: StudioLaneInput = {
  deviceId: null,
  label: null,
  channel: null,
  pair: false,
}

/** A lane's channels as a pick; null for the default. */
export function laneChannelPick(lane: StudioLaneInput): ChannelPick | null {
  return lane.channel === null
    ? null
    : { channel: lane.channel, pair: lane.pair }
}

/** How many lanes' inputs are kept at most: the ones chosen last. */
export const MAX_LANE_INPUTS = 200
/** How many inputs' channel counts are kept at most: the ones opened last. */
export const MAX_INPUT_CHANNEL_COUNTS = 50

const LANES_KEY = 'mercurypitch.studio.lane-inputs'
const CHANNELS_KEY = 'mercurypitch.studio.input-channels'

interface LaneInputRow extends StudioLaneInput {
  readonly projectId: string
  readonly trackId: string
}

/** An input's channel count, by the id and the name its track opened with. */
export interface InputChannelCount {
  readonly deviceId: string | null
  readonly label: string | null
  readonly channels: number
}

/** A device id or name as kept: text, not too long, or none. */
const text = (value: unknown) =>
  typeof value === 'string' && value !== '' && value.length <= 512
    ? value
    : null

const channelOf = (value: unknown) =>
  typeof value === 'number' &&
  Number.isInteger(value) &&
  value >= 0 &&
  value < MAX_INPUT_CHANNELS
    ? value
    : null

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

function readRows(key: string): unknown[] {
  try {
    const raw = storage()?.getItem(key)
    if (raw === null || raw === undefined || raw === '') return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeRows(key: string, rows: readonly unknown[]): void {
  try {
    storage()?.setItem(key, JSON.stringify(rows))
  } catch {
    // Private mode or storage off: the choice lasts this session.
  }
}

/** A lane's input from anything: what does not fit follows the Studio's input. */
export function sanitizeStudioLaneInput(value: unknown): StudioLaneInput {
  const raw =
    typeof value === 'object' && value !== null
      ? (value as Record<string, unknown>)
      : {}
  const deviceId = text(raw.deviceId)
  const channel = channelOf(raw.channel)
  // A row kept before pairs says nothing of one: it is one input. A pair
  // that is not aligned, or not all addressable, is no choice at all.
  const wantsPair = raw.pair === true
  const pair =
    wantsPair &&
    channel !== null &&
    isAvailablePick({ channel, pair: true }, MAX_INPUT_CHANNELS)
  return {
    deviceId,
    label: deviceId === null ? null : text(raw.label),
    channel: wantsPair && !pair ? null : channel,
    pair,
  }
}

const follows = (input: StudioLaneInput) =>
  input.deviceId === null && input.channel === null

/** The kept rows, newest first: each one whole, once per lane, at most MAX_LANE_INPUTS. */
function laneRows(): LaneInputRow[] {
  const seen = new Set<string>()
  const rows: LaneInputRow[] = []
  for (const value of readRows(LANES_KEY)) {
    const raw =
      typeof value === 'object' && value !== null
        ? (value as Record<string, unknown>)
        : {}
    const projectId = text(raw.projectId)
    const trackId = text(raw.trackId)
    if (projectId === null || trackId === null) continue
    const input = sanitizeStudioLaneInput(raw)
    const key = JSON.stringify([projectId, trackId])
    if (follows(input) || seen.has(key)) continue
    seen.add(key)
    rows.push({ projectId, trackId, ...input })
    if (rows.length === MAX_LANE_INPUTS) break
  }
  return rows
}

function songInputs(
  rows: readonly LaneInputRow[],
  projectId: string,
): ReadonlyMap<string, StudioLaneInput> {
  const lanes = new Map<string, StudioLaneInput>()
  for (const row of rows)
    if (row.projectId === projectId)
      lanes.set(row.trackId, {
        deviceId: row.deviceId,
        label: row.label,
        channel: row.channel,
        pair: row.pair,
      })
  return lanes
}

/** The song's lanes that have an input of their own, by lane id. */
export function readStudioLaneInputs(
  projectId: string,
): ReadonlyMap<string, StudioLaneInput> {
  return songInputs(laneRows(), projectId)
}

/** Keep one lane's input, newest first; following the Studio's input keeps nothing. Gives back the song's lanes. */
export function writeStudioLaneInput(
  projectId: string,
  trackId: string,
  input: StudioLaneInput,
): ReadonlyMap<string, StudioLaneInput> {
  const kept = sanitizeStudioLaneInput(input)
  const others = laneRows().filter(
    (row) => row.projectId !== projectId || row.trackId !== trackId,
  )
  const rows = follows(kept)
    ? others
    : [{ projectId, trackId, ...kept }, ...others].slice(0, MAX_LANE_INPUTS)
  writeRows(LANES_KEY, rows)
  return songInputs(rows, projectId)
}

/** Forget the song's lanes that are no longer in it. Gives back the lanes still kept. */
export function pruneStudioLaneInputs(
  projectId: string,
  trackIds: readonly string[],
): ReadonlyMap<string, StudioLaneInput> {
  const rows = laneRows()
  const kept = rows.filter(
    (row) => row.projectId !== projectId || trackIds.includes(row.trackId),
  )
  if (kept.length !== rows.length) writeRows(LANES_KEY, kept)
  return songInputs(kept, projectId)
}

// ── Channel counts ─────────────────────────────────────────────

/** The kept counts, newest first, at most MAX_INPUT_CHANNEL_COUNTS. */
export function readInputChannelCounts(): readonly InputChannelCount[] {
  const rows: InputChannelCount[] = []
  for (const value of readRows(CHANNELS_KEY)) {
    const raw =
      typeof value === 'object' && value !== null
        ? (value as Record<string, unknown>)
        : {}
    const deviceId = text(raw.deviceId)
    const label = text(raw.label)
    const channels = raw.channels
    if (deviceId === null && label === null) continue
    if (
      typeof channels !== 'number' ||
      !Number.isInteger(channels) ||
      channels < 1 ||
      channels > MAX_INPUT_CHANNELS
    )
      continue
    rows.push({ deviceId, label, channels })
    if (rows.length === MAX_INPUT_CHANNEL_COUNTS) break
  }
  return rows
}

/** Keep how many channels an input opened with, newest first. Gives back every count kept. */
export function rememberInputChannels(
  device: { readonly deviceId: string | null; readonly label: string | null },
  channels: number,
): readonly InputChannelCount[] {
  const deviceId = text(device.deviceId)
  const label = text(device.label)
  const rows = readInputChannelCounts()
  if (
    (deviceId === null && label === null) ||
    !Number.isInteger(channels) ||
    channels < 1 ||
    channels > MAX_INPUT_CHANNELS
  )
    return rows
  const others = rows.filter(
    (row) =>
      (deviceId === null || row.deviceId !== deviceId) &&
      (label === null || row.label !== label),
  )
  const next = [{ deviceId, label, channels }, ...others].slice(
    0,
    MAX_INPUT_CHANNEL_COUNTS,
  )
  writeRows(CHANNELS_KEY, next)
  return next
}

/** How many channels an input had when it last opened: by its id, then by its name; null until it has opened. */
export function knownInputChannels(
  counts: readonly InputChannelCount[],
  device: { readonly deviceId: string | null; readonly label: string | null },
): number | null {
  const byId =
    device.deviceId === null
      ? undefined
      : counts.find((row) => row.deviceId === device.deviceId)
  const byName =
    device.label === null || device.label === ''
      ? undefined
      : counts.find((row) => row.label === device.label)
  return (byId ?? byName)?.channels ?? null
}

/**
 * How many channels a lane's input has, as far as this device knows: its
 * own input's, else the Studio's. The system's default is opened as
 * `default` by Chromium, and is the roster's default elsewhere.
 */
export function laneInputChannels(
  lane: StudioLaneInput,
  studio: { readonly deviceId: string | null; readonly label: string | null },
  counts: readonly InputChannelCount[],
  devices: readonly DeviceInfoLike[],
): number | null {
  if (lane.deviceId !== null) return knownInputChannels(counts, lane)
  if (studio.deviceId !== null) return knownInputChannels(counts, studio)
  const opened = knownInputChannels(counts, {
    deviceId: 'default',
    label: null,
  })
  if (opened !== null) return opened
  const target = defaultInput(buildRoster(devices))
  return target === null
    ? null
    : knownInputChannels(counts, {
        deviceId: target.deviceId,
        label: target.name,
      })
}

// ── At the arm ─────────────────────────────────────────────────

/** What an arm opens for a lane. */
export interface StudioLaneInputPlan {
  /** The input to open: the lane's own as listed now, else the Studio's; null for the system's default. */
  readonly deviceId: string | null
  /** The input asked for is the lane's own, not the Studio's. */
  readonly own: boolean
  /** The lane's own input is not in the browser's list: the Studio's opens instead. */
  readonly laneInputMissing: boolean
  /** The input or pair to record; null for the default the input's count makes. */
  readonly pick: ChannelPick | null
}

/**
 * Which input an arm opens for a lane, from the device list the Studio
 * holds now: an arm opens the microphone inside the press, so nothing is
 * listed afresh. The lane's own input is found by its id, then its name;
 * one that is not listed leaves the lane on the Studio's input and its
 * default, since a channel is a jack of the input it was chosen on. Before
 * the page may use the microphone the browser lists no ids, so the kept id
 * is all there is to ask for (MicManager.acquireFrom falls back to the
 * default).
 */
export function planStudioLaneInput(
  lane: StudioLaneInput,
  studioDeviceId: string | null,
  devices: readonly Pick<MediaDeviceInfo, 'deviceId' | 'label'>[],
): StudioLaneInputPlan {
  const pick = laneChannelPick(lane)
  if (lane.deviceId === null)
    return {
      deviceId: studioDeviceId,
      own: false,
      laneInputMissing: false,
      pick,
    }
  if (!inputsNamed(devices))
    return { deviceId: lane.deviceId, own: true, laneInputMissing: false, pick }
  const found = resolveDeviceId(lane.deviceId, lane.label, devices)
  return found === null
    ? {
        deviceId: studioDeviceId,
        own: false,
        laneInputMissing: true,
        pick: null,
      }
    : { deviceId: found, own: true, laneInputMissing: false, pick }
}

/** Whether two lanes record from the same input and channels, so an arm can move between them. */
export function sameStudioLaneInput(
  a: StudioLaneInput,
  b: StudioLaneInput,
): boolean {
  return (
    a.deviceId === b.deviceId && a.channel === b.channel && a.pair === b.pair
  )
}
