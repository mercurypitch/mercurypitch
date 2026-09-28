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
// derived from these numbers at runtime. What an open door ends on is the
// room's own picture, and that is the room's to choose: `roomBackground`
// names only the background surface it is chosen from and how the room draws
// it (alley-room.ts).

import type { NamedRoomId } from '@/features/rooms/room-names'
import type { ActiveTab } from '@/features/tabs/constants'
import { TAB_EAR_LAB, TAB_KARAOKE, TAB_SINGING, } from '@/features/tabs/constants'
import type { BackgroundSurface } from '@/lib/backgrounds/background-catalog'

export type DoorKey = 'ear' | 'piano' | 'drums' | 'karaoke' | 'sing' | 'guitar'

export type Point = readonly [number, number]
export type Quad = readonly [Point, Point, Point, Point]

export type AmbientKind = 'sing' | 'ear'

/**
 * How the room behind an open door draws its own picture: the element it
 * marks `data-room-background`, a box the size of the screen, painted
 * `background-size: cover` at the picture's focal point. The open ends on
 * exactly that, so the hand-over does not jump.
 */
export interface RoomBackground {
  /** The background surface whose controller picks the room's picture. */
  readonly surface: BackgroundSurface
  /** The element's own `transform: scale()`, about its centre. */
  readonly scale: number
}

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
  /** The picture the open ends on; null for a door that is not open yet. */
  readonly roomBackground: RoomBackground | null
  readonly quad: Quad
}

/**
 * One picture of the alley: its two files, the render master's pixel space
 * its quads are measured in, where it is framed, and the 1x file's density.
 */
export interface PlateSpec {
  readonly src: string
  readonly hi: string
  readonly width: number
  readonly height: number
  readonly position: string
  /** Device pixels per master unit the 1x file carries. */
  readonly density: number
}

export const ALLEY_PLATE = {
  /** 1707 x 2560 — enough for a 393 pt screen at DPR 3's visible window. */
  src: '/rooms/alley/night-rooms-hero.webp',
  /** 2560 x 3840, only where the 1x file would be upscaled (`plateSourceFor`). */
  hi: '/rooms/alley/night-rooms-hero-2x.webp',
  width: 1024,
  height: 1536,
  position: '72% center',
  /** Device pixels per layout unit the 1x file carries: 1707 / 1024. */
  density: 1.667,
} as const satisfies PlateSpec

/** Device pixels per layout unit the portrait 1x file carries. */
export const PLATE_1X_DENSITY = ALLEY_PLATE.density

/**
 * The plate file for the scale the plate is DRAWN at (`alleyFit(...).scale`,
 * CSS px per layout unit), times the DPR: device px per unit. The portrait 1x
 * file has 1.667 px per unit: past that it would be upscaled and the 2x is
 * worth its 1.3 MB; at or under it, the 2x only costs decode time and memory.
 * In portrait the drawn scale is the cover scale: a 393 x 852 phone at DPR 3
 * lands at 1.664 and keeps the 1x, a 430 x 932 at DPR 3 is at 1.82 and takes
 * the 2x. The portrait plate on its side is drawn at the door band's much
 * smaller scale, and the cover scale there once picked the 2x (and a 39 MB
 * decode) for a picture drawn at about 1.1 device px per unit. The landscape
 * plate answers the same rule with its own files and its own density.
 */
export function plateSourceFor(
  scale: number,
  dpr: number,
  plate: PlateSpec = ALLEY_PLATE,
): string {
  return scale * dpr > plate.density ? plate.hi : plate.src
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
    roomBackground: {
      surface: 'ear',
      // EarRoomShell.module.css `.roomPlate`: `transform: scale(1.012)`.
      scale: 1.012,
    },
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
    roomBackground: null,
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
    roomBackground: null,
    quad: [
      [382, 681],
      [463, 653],
      [463, 973],
      [382, 957],
    ],
  },
  {
    // Open since plan S8 §2: the room is the zen player over the Broadway
    // Theater (src/features/karaoke-room). An ambient and a clip may follow;
    // until then the door lifts and opens with neither.
    key: 'karaoke',
    roomId: 'karaoke',
    tab: TAB_KARAOKE,
    ambient: null,
    clip: null,
    drift: false,
    spill: 'rgba(255, 84, 96, 0.46)',
    // KaraokeRoomStage's `.cover`: no transform of its own.
    roomBackground: { surface: 'karaoke', scale: 1 },
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
    roomBackground: { surface: 'sing', scale: 1 },
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
    roomBackground: null,
    quad: [
      [792, 511],
      [982, 419],
      [982, 1250],
      [792, 1150],
    ],
  },
]

// ------------------------------------------------------------
// The same alley on its side
// ------------------------------------------------------------
//
// A screen on its side draws a picture of its own: the same night, the same
// six rooms, re-framed by Codex from the portrait plate for a 16:9 master
// that holds from an iPad at 4:3 to a phone at 2.17:1. Its six openings sit
// right of the headline's column and above the dock, and `alleyFit`
// cover-fits it — the portrait plate on its side was sized by the door band
// and left the alley's ground colour on both sides of a portrait strip
// (TestFlight 420). The quads are four corners per opening, clockwise from
// the top left, in the landscape render master's pixel space (1672 x 941),
// as the portrait's are in its; the two files are upscales of that master at
// its own aspect, so only the aspect reaches the cover-fit.
//
// The owner's pick of three candidates (28 Sep 2026): candidate 3, the
// alley seen from further down, its six openings in one row across the
// right two thirds. The quads are measured to about 1 px on the upscale, as
// the lit opening, the way the portrait's are: a top or a left jamb on the
// first lit pixel inside the dark frame line, a right jamb where the light
// ends, a bottom on the outer edge of the lit sill. Survey and pick page:
// the showcase gallery's native-alley-landscape.html.

export const ALLEY_PLATE_LANDSCAPE = {
  /** 2560 x 1441: an 852 pt phone on its side at DPR 3 shows 2556 of it. */
  src: '/rooms/alley/night-rooms-hero-landscape.webp',
  /** 3840 x 2161, for the Pro Max phones and every iPad (`plateSourceFor`). */
  hi: '/rooms/alley/night-rooms-hero-landscape-2x.webp',
  width: 1672,
  height: 941,
  // Only the anchor that has room to move matters: across on an iPad, where
  // 73% puts the row midway between the column and the edge; down on a
  // phone, where 100% lifts it as far from the dock as the cover allows.
  position: '73% 100%',
  /** 2560 / 1672. */
  density: 1.531,
} as const satisfies PlateSpec

/** The six openings in the landscape master, by door. */
const LANDSCAPE_QUADS: Readonly<Record<DoorKey, Quad>> = {
  ear: [
    [653.8, 399.1],
    [724, 392],
    [723.7, 570.8],
    [655.1, 564.1],
  ],
  piano: [
    [749.7, 389.3],
    [836.6, 379.9],
    [836.6, 582.6],
    [749.7, 573.8],
  ],
  drums: [
    [861.1, 376.2],
    [968.8, 365.4],
    [968.8, 596.4],
    [861.3, 585.4],
  ],
  karaoke: [
    [998.8, 360.9],
    [1133.6, 345.2],
    [1132.1, 615],
    [999.2, 599.7],
  ],
  sing: [
    [1170.4, 336.9],
    [1283.3, 321.7],
    [1283.6, 633.6],
    [1170.3, 620.1],
  ],
  guitar: [
    [1325, 326.8],
    [1466.1, 307.1],
    [1467.4, 657.1],
    [1325.5, 638.7],
  ],
}

/** The doors as they stand in the landscape picture: the same six rooms. */
export const DOORS_LANDSCAPE: readonly DoorSpec[] = DOORS.map((door) => ({
  ...door,
  quad: LANDSCAPE_QUADS[door.key],
}))

/** A picture and the doors measured in it. */
export interface AlleyScene {
  readonly plate: PlateSpec
  readonly doors: readonly DoorSpec[]
}

const PORTRAIT_SCENE: AlleyScene = { plate: ALLEY_PLATE, doors: DOORS }
const LANDSCAPE_SCENE: AlleyScene = {
  plate: ALLEY_PLATE_LANDSCAPE,
  doors: DOORS_LANDSCAPE,
}

/**
 * The alley for a screen this shape: on its side, its own picture and its
 * own quads; upright or square, the portrait plate exactly as it was. The
 * same object each time, so a memo downstream sees no change until the
 * screen turns.
 */
export function alleyScene(w: number, h: number): AlleyScene {
  return w > h ? LANDSCAPE_SCENE : PORTRAIT_SCENE
}

export function doorSpec(key: DoorKey): DoorSpec {
  const found = DOORS.find((door) => door.key === key)
  if (found === undefined) throw new Error(`alley: no door "${key}"`)
  return found
}

export function isEnterable(key: DoorKey): boolean {
  return doorSpec(key).tab !== null
}
