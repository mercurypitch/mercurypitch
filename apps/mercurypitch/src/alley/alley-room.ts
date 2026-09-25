// ============================================================
// The room behind a door: its own picture, decoded before the open
// ============================================================
//
// The open used to grow the plate's own pixels to the full screen: for the
// Ear Lab, the tuning forks from a 1024 x 1536 plate at about four times
// their size, blurred, and only then did the real room replace them (device
// round 4). It ends on the room's own picture now (alley-entry.ts), and a
// picture is only worth growing once it is decoded, so the decode starts on
// the tap that picks the door rather than on Enter.
//
// THE ROOM'S OWN CONTROLLER, NOT A COPY OF ITS CHOICE. The door retains the
// background controller the room reads when it mounts
// (`backgroundSurfaceController`), so the URL is the one the room will draw:
// the room the singer chose, this orientation's file, this density's variant.
// Retained without the premium catalogue, so a door tap starts no request of
// its own. A premium room whose catalogue is already loaded resolves here as
// it will in the room; one whose catalogue is not resolves to the room's
// fallback, which is also what the room draws until its catalogue answers.
//
// The retain lasts until the open is over, not until the alley unmounts: a
// premium picture's object URL is revoked when its last retainer lets go, and
// between the alley unmounting and the room mounting there would be none.

import { createComputed, createRoot } from 'solid-js'
import { backgroundSurfaceController } from '@/lib/backgrounds/background-surface'
import type { DoorKey, DoorSpec } from './alley-plate'

/** A room's picture, decoded, and how the room draws it. */
export interface RoomPicture {
  /** The element that decoded: the clone shows this one, not a copy. */
  readonly image: HTMLImageElement
  readonly src: string
  /** Its own pixel size. */
  readonly width: number
  readonly height: number
  /** Its `background-position`, as fractions. */
  readonly focus: readonly [number, number]
  /** The room element's own scale about its centre. */
  readonly scale: number
}

/**
 * What an open is handed: the picture if it has decoded, and the promise of
 * it either way. `later` settles null when it cannot be had: a failed load,
 * or a file that decoded to nothing. Never a half-loaded image.
 */
export interface RoomPictureSource {
  readonly now: RoomPicture | null
  readonly later: Promise<RoomPicture | null>
}

export interface RoomPreload {
  readonly key: DoorKey
  /** The room's picture as things stand now. */
  readonly source: () => RoomPictureSource
  /** Stop following the room's choice, and let its controller go. */
  readonly release: () => void
}

interface Decoding {
  readonly src: string
  picture: RoomPicture | null
  readonly later: Promise<RoomPicture | null>
}

function decodePicture(
  src: string,
  focus: readonly [number, number],
  scale: number,
): Decoding {
  const image = new Image()
  image.alt = ''
  image.decoding = 'async'
  image.src = src
  // Not every engine has decode() (jsdom has none); load is the fallback.
  const loaded =
    typeof image.decode === 'function'
      ? image.decode()
      : new Promise<void>((resolve, reject) => {
          image.onload = () => resolve()
          image.onerror = () => reject(new Error(`${src} did not load`))
        })
  const decoding: Decoding = {
    src,
    picture: null,
    later: loaded.then(
      () => {
        if (image.naturalWidth <= 0 || image.naturalHeight <= 0) return null
        decoding.picture = {
          image,
          src,
          width: image.naturalWidth,
          height: image.naturalHeight,
          focus,
          scale,
        }
        return decoding.picture
      },
      () => null,
    ),
  }
  return decoding
}

/**
 * Start decoding the room's picture behind `spec`, and keep following the
 * room's choice until released: a rotation, or a premium picture arriving,
 * changes the URL, and the new one is decoded in its turn. Null for a door
 * with no room behind it yet.
 */
export function preloadRoom(spec: DoorSpec): RoomPreload | null {
  const backdrop = spec.roomBackground
  if (backdrop === null) return null
  const controller = backgroundSurfaceController(backdrop.surface)
  const letGo = controller.retain({ premiumCatalog: false })
  let current: Decoding | null = null
  const stop = createRoot((dispose) => {
    createComputed(() => {
      const resolved = controller.resolved()
      if (current?.src === resolved.url) return
      current = decodePicture(
        resolved.url,
        [resolved.focalPoint.x, resolved.focalPoint.y],
        backdrop.scale,
      )
    })
    return dispose
  })
  let released = false
  return {
    key: spec.key,
    source: () => ({
      now: current?.picture ?? null,
      later: current?.later ?? Promise.resolve(null),
    }),
    release: () => {
      if (released) return
      released = true
      stop()
      letGo()
      current = null
    },
  }
}

// The picked door's room, on its way. One at a time: picking another door,
// or none, lets the last one go.
let held: RoomPreload | null = null

/** A door picked: its room's picture starts decoding. A locked door has none. */
export function pickRoom(spec: DoorSpec): void {
  if (held !== null && held.key === spec.key) return
  dropRoom()
  held = preloadRoom(spec)
}

/** The door went back into the plate, or the alley went: the room is let go. */
export function dropRoom(): void {
  const preload = held
  held = null
  preload?.release()
}

/**
 * Enter: the open takes the room over, and releases it once it is over. A
 * door entered without having been picked starts its picture now, and the
 * open falls back to the plate until it arrives.
 */
export function takeRoom(spec: DoorSpec): RoomPreload | null {
  if (held !== null && held.key === spec.key) {
    const preload = held
    held = null
    return preload
  }
  dropRoom()
  return preloadRoom(spec)
}

/** For a test: the door whose room is being held, if any. */
export function heldRoom(): DoorKey | null {
  return held?.key ?? null
}
