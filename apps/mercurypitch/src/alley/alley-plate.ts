// ============================================================
// The plate: the one picture the alley is, and the six doors in it
// ============================================================
//
// Codex re-render A of the mock's D2 Night Rooms, chosen by the owner on 12
// September. The quads are the lab's CONFIG block verbatim
// (disjoint-colliders `native-s4-alley-lab.html`, survey
// OPENINGS-RERENDER-A.md §2): four corners per lit opening, clockwise from
// the top left, in the RENDER MASTER's pixel space, 1024 x 1536. The two files
// that ship are upscales of that master at the same 2:3, so only the aspect
// reaches the cover-fit and the quads hold for either.
//
// `position` is the survey's §5 answer. The six doors span 418 CSS px on a
// 393 px phone, so no crop keeps all six whole: at 72% the Ear Lab's left
// jamb lands on 0.5 px and the guitar loses only its stool and right jamb.
//
// CONSTRUCTION A (owner decision 2): a door shows the plate's own pixels.
// Nothing here names a room photograph. A new alley is this file and nothing
// else — the geometry, the rim, the dim, the tap routing and the open are all
// derived from these numbers at runtime.

import type { NamedRoomId } from '@/features/rooms/room-names'
import type { ActiveTab } from '@/features/tabs/constants'
import { TAB_EAR_LAB, TAB_SINGING } from '@/features/tabs/constants'

export type DoorKey = 'ear' | 'piano' | 'drums' | 'karaoke' | 'sing' | 'guitar'

export type Point = readonly [number, number]
export type Quad = readonly [Point, Point, Point, Point]

export type AmbientKind = 'sing' | 'ear'

export interface DoorSpec {
  readonly key: DoorKey
  /** Where the room's NAME comes from (`room-names.ts`). */
  readonly roomId: NamedRoomId
  /** The tab an open door goes to; null for a door that is not open yet. */
  readonly tab: ActiveTab | null
  /** The ambient a selected door fades in, if it has one. */
  readonly ambient: AmbientKind | null
  /** The loop a selected door plays inside its opening, if it has one. */
  readonly clip: string | null
  /** A selected door with no clip drifts its own pixels instead. */
  readonly drift: boolean
  /** The room's light on the cobbles under the door. */
  readonly spill: string
  readonly quad: Quad
}

export const ALLEY_PLATE = {
  /** 1707 x 2560 — enough for a 393 pt screen at DPR 3's visible window. */
  src: '/rooms/alley/night-rooms-hero.webp',
  /** 2560 x 3840, only where the 1x file would be upscaled (`plateSourceFor`). */
  hi: '/rooms/alley/night-rooms-hero-2x.webp',
  width: 1024,
  height: 1536,
  position: '72% center',
} as const

/** Device pixels per layout unit the 1x file carries: 1707 / 1024. */
export const PLATE_1X_DENSITY = 1.667

/**
 * The plate file for the scale the plate is DRAWN at (`alleyFit(...).scale`,
 * CSS px per layout unit), times the DPR: device px per unit. The 1x file has
 * 1.667 px per unit: past that it would be upscaled and the 2x is worth its
 * 1.3 MB; at or under it, the 2x only costs decode time and memory. In
 * portrait the drawn scale is the cover scale: a 393 x 852 phone at DPR 3
 * lands at 1.664 and keeps the 1x, a 430 x 932 at DPR 3 is at 1.82 and takes
 * the 2x. On its side the plate is drawn at the door band's much smaller
 * scale, and the cover scale there once picked the 2x (and a 39 MB decode)
 * for a picture drawn at about 1.1 device px per unit.
 */
export function plateSourceFor(scale: number, dpr: number): string {
  return scale * dpr > PLATE_1X_DENSITY ? ALLEY_PLATE.hi : ALLEY_PLATE.src
}

export const DOOR_CLIP_SING =
  '/rooms/alley/retro-analog-studio-portrait-loop.mp4'

export const AMBIENT_URL: Record<AmbientKind, string> = {
  sing: '/rooms/alley/retro-analog-studio-ambient-take2-loop.m4a',
  ear: '/rooms/alley/ear-lab-workshop-ambient-take2-loop.m4a',
}

/** Left to right, which is also the order a screen reader walks them. */
export const DOORS: readonly DoorSpec[] = [
  {
    key: 'ear',
    roomId: 'ear-lab',
    tab: TAB_EAR_LAB,
    ambient: 'ear',
    clip: null,
    drift: true,
    spill: 'rgba(255, 176, 96, 0.50)',
    quad: [
      [228, 724],
      [279, 708],
      [279, 923],
      [228, 916],
    ],
  },
  {
    key: 'piano',
    roomId: 'piano',
    tab: null,
    ambient: null,
    clip: null,
    drift: false,
    spill: 'rgba(255, 168, 88, 0.48)',
    quad: [
      [296, 701],
      [361, 680],
      [361, 943],
      [296, 933],
    ],
  },
  {
    key: 'drums',
    roomId: 'drums',
    tab: null,
    ambient: null,
    clip: null,
    drift: false,
    spill: 'rgba(226, 226, 224, 0.36)',
    quad: [
      [382, 681],
      [463, 653],
      [463, 973],
      [382, 957],
    ],
  },
  {
    key: 'karaoke',
    roomId: 'karaoke',
    tab: null,
    ambient: null,
    clip: null,
    drift: false,
    spill: 'rgba(255, 84, 96, 0.46)',
    quad: [
      [489, 639],
      [590, 588],
      [590, 1020],
      [489, 994],
    ],
  },
  {
    key: 'sing',
    roomId: 'sing',
    tab: TAB_SINGING,
    ambient: 'sing',
    clip: DOOR_CLIP_SING,
    drift: false,
    spill: 'rgba(96, 220, 226, 0.46)',
    quad: [
      [635, 580],
      [732, 534],
      [732, 1095],
      [635, 1070],
    ],
  },
  {
    key: 'guitar',
    roomId: 'guitar',
    tab: null,
    ambient: null,
    clip: null,
    drift: false,
    spill: 'rgba(255, 176, 72, 0.58)',
    quad: [
      [792, 511],
      [982, 419],
      [982, 1250],
      [792, 1150],
    ],
  },
]

export function doorSpec(key: DoorKey): DoorSpec {
  const found = DOORS.find((door) => door.key === key)
  if (found === undefined) throw new Error(`alley: no door "${key}"`)
  return found
}

export function isEnterable(key: DoorKey): boolean {
  return doorSpec(key).tab !== null
}
