// Which input the game listens to.
// ============================================================
//
// This module exists because of a real afternoon. A microphone was
// plugged in, permitted, and lit: Chrome showed the recording dot, the
// audio context said `running`, the capture graph produced frames on
// schedule -- and every frame was 0.0001. The stream had opened on an
// audio interface's other channel, which is silence with every light
// green, and the app had no way to say so and no way to change it,
// because it never asked which input to use. It took the browser
// default and hoped.
//
// So: the choice is explicit, it is remembered, and it survives the
// device being unplugged. Three things worth saying about how.
//
// **Two entries per microphone is normal.** Chrome publishes synthetic
// `default` and `communications` devices that mirror a real one (same
// `groupId`), so a single microphone appears two or three times in a
// raw enumeration -- which is confusing in a list the user has to
// choose from. Those are dropped here and replaced by one explicit
// "System default" row, which is the same thing said once.
//
// **Labels need permission.** `enumerateDevices` returns empty labels
// until a stream has been granted, so a picker shown before the first
// successful `getUserMedia` can only offer "System default". That is
// why the game asks for the microphone first and offers the choice
// after, rather than the other way around.
//
// **A remembered device can vanish.** Unplug the interface and the
// stored id matches nothing; asking for it with `exact` then fails
// outright instead of falling back. `applyPreferredInput` checks the
// stored id against the live list and clears it when it is gone, so an
// unplugged interface degrades to the system default rather than to an
// error the player cannot act on.

import { listAudioInputs, micManager } from '@irchiinnuss/pitch-engine'

/**
 * Where the choice is remembered.
 *
 * Namespaced by product rather than fixed, because two apps served from
 * one origin would otherwise share an entry and quietly overwrite each
 * other's microphone. `configureInputDevice` sets it; until then it is
 * the generic key, which is right for a single-app origin and harmless
 * for anyone who never calls it.
 */
let storageKey = 'audio-io:input-device'

/** Name the product, so its remembered input is its own. */
export function configureInputDevice(options: { storageKey: string }): void {
  storageKey = options.storageKey
}

/** Ids Chrome uses for its mirror entries; never offered as choices. */
const SYNTHETIC = new Set(['default', 'communications'])

/** One row in the picker. An empty `deviceId` means "let the OS pick". */
export interface InputChoice {
  readonly deviceId: string
  readonly label: string
}

export const SYSTEM_DEFAULT: InputChoice = {
  deviceId: '',
  label: 'System default',
}

type ReadStorage = Pick<Storage, 'getItem'>
type WriteStorage = Pick<Storage, 'setItem' | 'removeItem'>

function browserStorage(): Storage | undefined {
  if (typeof window === 'undefined') return undefined
  try {
    return window.localStorage
  } catch {
    // Private mode, or storage disabled by policy. The choice simply
    // does not persist; everything else still works.
    return undefined
  }
}

/** The remembered device id, or null for the system default. */
export function readPreferredInput(
  storage: ReadStorage | undefined = browserStorage(),
): string | null {
  if (storage === undefined) return null
  try {
    const value = storage.getItem(storageKey)
    return value !== null && value.length > 0 ? value : null
  } catch {
    return null
  }
}

/** Remember a device id, or forget it with null. */
export function writePreferredInput(
  deviceId: string | null,
  storage: WriteStorage | undefined = browserStorage(),
): void {
  if (storage === undefined) return
  try {
    if (deviceId === null || deviceId.length === 0) {
      storage.removeItem(storageKey)
      return
    }
    storage.setItem(storageKey, deviceId)
  } catch {
    // Quota, or a storage that refuses writes. Not worth failing over.
  }
}

/**
 * The real inputs, deduplicated, with "System default" first.
 *
 * `list` is a seam for tests; production reads the live device list.
 */
export async function listInputs(
  list: () => Promise<MediaDeviceInfo[]> = listAudioInputs,
): Promise<InputChoice[]> {
  let devices: MediaDeviceInfo[]
  try {
    devices = await list()
  } catch {
    return [SYSTEM_DEFAULT]
  }
  const seen = new Set<string>()
  const choices: InputChoice[] = []
  for (const device of devices) {
    if (SYNTHETIC.has(device.deviceId)) continue
    if (device.deviceId.length === 0 || seen.has(device.deviceId)) continue
    seen.add(device.deviceId)
    choices.push({
      deviceId: device.deviceId,
      // Before permission every label is empty, and a list of blank rows
      // is worse than one honest row.
      label: device.label.length > 0 ? device.label : 'Microphone',
    })
  }
  return [SYSTEM_DEFAULT, ...choices]
}

/**
 * Point the mic manager at the remembered device, if it still exists.
 *
 * Call before acquiring. Returns the id actually applied, so a caller
 * can tell that a remembered device was dropped.
 */
export async function applyPreferredInput(
  list: () => Promise<MediaDeviceInfo[]> = listAudioInputs,
  storage: (ReadStorage & WriteStorage) | undefined = browserStorage(),
): Promise<string | null> {
  const wanted = readPreferredInput(storage)
  if (wanted === null) {
    await micManager.setPreferredDevice(null)
    return null
  }
  const choices = await listInputs(list)
  const found = choices.some((c) => c.deviceId === wanted)
  if (!found) {
    writePreferredInput(null, storage)
    await micManager.setPreferredDevice(null)
    return null
  }
  await micManager.setPreferredDevice(wanted)
  return wanted
}

/** Remember a device and switch the mic manager to it. */
export async function chooseInput(deviceId: string): Promise<void> {
  const id = deviceId.length > 0 ? deviceId : null
  writePreferredInput(id)
  await micManager.setPreferredDevice(id)
}
