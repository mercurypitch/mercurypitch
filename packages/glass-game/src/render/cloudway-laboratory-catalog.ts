// Cloudway laboratory render catalogue — stable IDs bind the accepted first-slice donors without exposing pending art.

export const CLOUDWAY_LAB_PLATFORM_RENDER_IDS = {
  pearlRest: 'cloudway-lab-pearl-rest',
  scroll: 'cloudway-lab-gilt-scroll',
  rosePending: 'cloudway-lab-rose-pending',
  amethystPending: 'cloudway-lab-amethyst-pending',
} as const

export type CloudwayLaboratoryPlatformRenderId =
  (typeof CLOUDWAY_LAB_PLATFORM_RENDER_IDS)[keyof typeof CLOUDWAY_LAB_PLATFORM_RENDER_IDS]

export const CLOUDWAY_LAB_BUNDLE_IDS = {
  pearlRest: 'cloudway-lab-pearl-marble-long-v1',
  scroll: 'gilt-scroll-bridge-runtime-v1',
} as const

export const CLOUDWAY_LAB_ROOT_NAMES = {
  pearlRest: 'CloudwayLab_PearlMarbleLong',
  scroll: 'Cloudway_GiltScrollBridge_RuntimeV1',
} as const

export const CLOUDWAY_LAB_SCROLL_MATERIAL_BINDINGS = [
  { mesh: 'ScrollDeckGeometry', kind: 'glass' },
  { mesh: 'ScrollDeckGoldStarDetailLayer', kind: 'opaque' },
  { mesh: 'ScrollDeckFrostEtchDetailLayer', kind: 'glass' },
  { mesh: 'ScrollRollerNegativeGeometry', kind: 'opaque' },
  { mesh: 'ScrollRollerPositiveGeometry', kind: 'opaque' },
] as const

const VALUES = new Set<string>(Object.values(CLOUDWAY_LAB_PLATFORM_RENDER_IDS))

export function isCloudwayLaboratoryPlatformRenderId(
  value: string | undefined,
): value is CloudwayLaboratoryPlatformRenderId {
  return value !== undefined && VALUES.has(value)
}
