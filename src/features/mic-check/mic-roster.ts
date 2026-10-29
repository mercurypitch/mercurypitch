// ============================================================
// Mic roster — every connected input, and which one is in charge
// ============================================================
//
// `enumerateDevices()` answers "what is plugged in" in two dialects.
// Chromium adds pseudo-entries — `default`, and on Windows `communications` —
// whose labels name the physical device they point at right now, behind a
// localised role word ("Default - Microphone (Realtek)"). Firefox and Safari
// add nothing and list the system default first. Neither says which device a
// live capture is hearing: only the track's own id and label do.
//
// This folds those into one list a person can read: each physical input
// once, flagged with what it is to the system (the default, the calls
// default) and to us (the one we are listening to). `diffRosters` turns two
// such lists into the changes worth telling someone about — a device that
// quietly became the default is the usual answer to "something took my mic".
//
// Pure on purpose: the dialects are the part worth testing, and they should
// be testable without a browser.

export type InputKind =
  | 'built-in'
  | 'usb'
  | 'bluetooth'
  | 'headset'
  | 'camera'
  | 'display'
  | 'virtual'
  | 'loopback'
  | 'other'

/** The part of MediaDeviceInfo this module reads, so tests can pass plain objects. */
export interface DeviceInfoLike {
  readonly deviceId: string
  readonly groupId: string
  readonly kind: string
  readonly label: string
}

export interface RosterInput {
  deviceId: string
  groupId: string
  /** The device's own name, without the browser's role prefix. Empty until
   *  microphone permission has been granted. */
  name: string
  kind: InputKind
  /** The system's default input. */
  isDefault: boolean
  /** Windows' default input for calls (Chromium only). */
  isCommunications: boolean
  /** The device the live capture says it is hearing. */
  isListening: boolean
}

export interface RosterOutput {
  deviceId: string
  name: string
  isDefault: boolean
}

export interface MicRoster {
  inputs: RosterInput[]
  outputs: RosterOutput[]
  /**
   * False before permission is granted. Ids and names are blank then, so the
   * list can count devices but cannot name or compare them.
   */
  labelled: boolean
}

/** What the live capture track says about itself. */
export interface ListeningTrack {
  /** `getSettings().deviceId`, which may be the pseudo id `default`. */
  deviceId: string | null
  groupId: string | null
  label: string | null
}

export const EMPTY_ROSTER: MicRoster = {
  inputs: [],
  outputs: [],
  labelled: false,
}

const DEFAULT_ID = 'default'
const COMMUNICATIONS_ID = 'communications'

const isPseudo = (device: DeviceInfoLike): boolean =>
  device.deviceId === DEFAULT_ID || device.deviceId === COMMUNICATIONS_ID

// Order matters. Each name is tested against the rules top to bottom and the
// first match wins, so the specific readings come before the general ones: a
// "Monitor of Built-in Audio" is a loopback before it is a display, and a
// Bluetooth "Headset" is Bluetooth before it is a headset.
const KIND_RULES: ReadonlyArray<readonly [InputKind, RegExp]> = [
  [
    'loopback',
    /stereo mix|what u hear|loopback|monitor of|blackhole|soundflower|wave out/i,
  ],
  [
    'virtual',
    /virtual|cable output|voicemeeter|vb-audio|krisp|broadcast|steam streaming|droidcam/i,
  ],
  ['bluetooth', /bluetooth|hands-?free|airpods|\bbt\b|\bbuds\b/i],
  ['camera', /camera|webcam|\bcam\b|\bbrio\b|\bc9\d\d\b/i],
  ['display', /display audio|\bhdmi\b|displayport|\bmonitor\b|\btv\b/i],
  ['headset', /headset|headphone|earphone|earpods/i],
  [
    'usb',
    /\busb\b|interface|scarlett|focusrite|\byeti\b|audient|presonus|behringer|steinberg|\bmotu\b/i,
  ],
  [
    'built-in',
    /built-?in|internal|realtek|microphone array|macbook|imac|intel|conexant|cirrus|integrated/i,
  ],
]

/** A best guess at what sort of input a device is, from its name alone. */
export function classifyInput(name: string): InputKind {
  for (const [kind, pattern] of KIND_RULES) {
    if (pattern.test(name)) return kind
  }
  return 'other'
}

/**
 * The device a label names: the device itself, or a role in front of it
 * ("Default - <its label>"). The role word is localised, so the device is
 * found by the label it ends with rather than by stripping an English prefix.
 */
function namedBy(
  devices: readonly DeviceInfoLike[],
  label: string | null,
): DeviceInfoLike | null {
  if (label === null || label === '') return null
  return (
    devices.find(
      (device) =>
        device.label !== '' &&
        (label === device.label || label.endsWith(` - ${device.label}`)),
    ) ?? null
  )
}

/** The one device with this groupId; null when none or several share it. */
function onlyInGroup(
  devices: readonly DeviceInfoLike[],
  groupId: string | null,
): DeviceInfoLike | null {
  if (groupId === null || groupId === '') return null
  const matches = devices.filter((device) => device.groupId === groupId)
  return matches.length === 1 ? matches[0] : null
}

/** The physical entry a Chromium pseudo-entry points at. */
const pointedAt = (
  pseudo: DeviceInfoLike,
  physical: readonly DeviceInfoLike[],
): DeviceInfoLike | null =>
  namedBy(physical, pseudo.label) ?? onlyInGroup(physical, pseudo.groupId)

/** A pseudo-entry's device name when no physical entry matched it. */
function nameAfterRole(label: string): string {
  const at = label.indexOf(' - ')
  return at === -1 ? label : label.slice(at + 3)
}

/**
 * The physical input a capture track is hearing.
 *
 * The label comes first because it is fixed when the device opens. A track
 * opened on `default` keeps naming the device it opened on even after the
 * system default moves, whereas mapping its `default` id through the CURRENT
 * pseudo-entry would claim it had moved too.
 */
function resolveListening(
  track: ListeningTrack,
  physical: readonly DeviceInfoLike[],
  defaultTarget: DeviceInfoLike | null,
  callsTarget: DeviceInfoLike | null,
): string | null {
  const { deviceId } = track
  const exact =
    deviceId === null || deviceId === ''
      ? null
      : (physical.find((device) => device.deviceId === deviceId) ?? null)
  // A role id says what the device WAS when the track opened. Read through
  // today's pseudo-entry it names today's default, so it may answer only for
  // a track with no label of its own; a label that matches nothing means
  // the device is not in the list, and saying so beats naming the wrong one.
  const unlabelled = track.label === null || track.label === ''
  const roleTarget = !unlabelled
    ? null
    : deviceId === DEFAULT_ID
      ? defaultTarget
      : deviceId === COMMUNICATIONS_ID
        ? callsTarget
        : null
  const found =
    exact ??
    namedBy(physical, track.label) ??
    roleTarget ??
    onlyInGroup(physical, track.groupId)
  return found?.deviceId ?? null
}

/** One kind's devices, one row each, with the rows the roles point at. */
interface RoleRows {
  rows: DeviceInfoLike[]
  defaultTarget: DeviceInfoLike | null
  callsTarget: DeviceInfoLike | null
}

/**
 * Resolve the role pseudo-entries of one kind into flags on its rows.
 *
 * Without a `default` pseudo-entry (Firefox, Safari), the first device is the
 * default: both list the system default first. A Chromium list can carry the
 * pseudo-entry alone — a default whose device the list does not name
 * separately, as Chromium's own fake devices do — and then it stays as a row
 * of its own, so the default is never silently missing.
 */
function resolveRoles(listed: readonly DeviceInfoLike[]): RoleRows {
  const defaultEntry = listed.find((device) => device.deviceId === DEFAULT_ID)
  const callsEntry = listed.find(
    (device) => device.deviceId === COMMUNICATIONS_ID,
  )
  const physical = listed.filter((device) => !isPseudo(device))
  if (defaultEntry === undefined) {
    return {
      rows: physical,
      defaultTarget: physical[0] ?? null,
      callsTarget: null,
    }
  }
  const target = pointedAt(defaultEntry, physical)
  const rows = target === null ? [defaultEntry, ...physical] : physical
  return {
    rows,
    defaultTarget: target ?? defaultEntry,
    callsTarget: callsEntry === undefined ? null : pointedAt(callsEntry, rows),
  }
}

/** A row's name: a pseudo-entry kept as a row loses its role prefix. */
const rowName = (device: DeviceInfoLike): string =>
  isPseudo(device) ? nameAfterRole(device.label) : device.label

/** One readable list from `enumerateDevices()` and the live track. */
export function buildRoster(
  devices: readonly DeviceInfoLike[],
  track: ListeningTrack | null = null,
): MicRoster {
  const rawInputs = devices.filter((device) => device.kind === 'audioinput')
  const ins = resolveRoles(rawInputs)
  const outs = resolveRoles(
    devices.filter((device) => device.kind === 'audiooutput'),
  )

  const listeningId =
    track === null
      ? null
      : resolveListening(track, ins.rows, ins.defaultTarget, ins.callsTarget)

  const inputs = ins.rows.map((device): RosterInput => {
    const name = rowName(device)
    return {
      deviceId: device.deviceId,
      groupId: device.groupId,
      name,
      kind: classifyInput(name),
      isDefault: device === ins.defaultTarget,
      isCommunications: device === ins.callsTarget,
      isListening: listeningId !== null && device.deviceId === listeningId,
    }
  })
  const outputs = outs.rows.map(
    (device): RosterOutput => ({
      deviceId: device.deviceId,
      name: rowName(device),
      isDefault: device === outs.defaultTarget,
    }),
  )

  return {
    inputs,
    outputs,
    labelled: rawInputs.some((device) => device.label !== ''),
  }
}

export const defaultInput = (roster: MicRoster): RosterInput | null =>
  roster.inputs.find((input) => input.isDefault) ?? null

export const listeningInput = (roster: MicRoster): RosterInput | null =>
  roster.inputs.find((input) => input.isListening) ?? null

const callsInput = (roster: MicRoster): RosterInput | null =>
  roster.inputs.find((input) => input.isCommunications) ?? null

export type RosterChange =
  | { type: 'connected'; input: RosterInput }
  | { type: 'disconnected'; input: RosterInput }
  | { type: 'default-changed'; from: RosterInput | null; to: RosterInput }
  | { type: 'calls-changed'; from: RosterInput | null; to: RosterInput }

/**
 * What changed between two rosters, in the order a person would tell it:
 * arrivals and departures first, then what the system did about them.
 * Unlabelled lists have blank ids, so they compare as no change at all.
 */
export function diffRosters(
  before: MicRoster,
  after: MicRoster,
): RosterChange[] {
  if (!before.labelled || !after.labelled) return []
  const changes: RosterChange[] = []
  const beforeIds = new Set(before.inputs.map((input) => input.deviceId))
  const afterIds = new Set(after.inputs.map((input) => input.deviceId))
  for (const input of after.inputs) {
    if (!beforeIds.has(input.deviceId))
      changes.push({ type: 'connected', input })
  }
  for (const input of before.inputs) {
    if (!afterIds.has(input.deviceId)) {
      changes.push({ type: 'disconnected', input })
    }
  }
  const fromDefault = defaultInput(before)
  const toDefault = defaultInput(after)
  if (toDefault !== null && toDefault.deviceId !== fromDefault?.deviceId) {
    changes.push({ type: 'default-changed', from: fromDefault, to: toDefault })
  }
  const fromCalls = callsInput(before)
  const toCalls = callsInput(after)
  if (toCalls !== null && toCalls.deviceId !== fromCalls?.deviceId) {
    changes.push({ type: 'calls-changed', from: fromCalls, to: toCalls })
  }
  return changes
}
