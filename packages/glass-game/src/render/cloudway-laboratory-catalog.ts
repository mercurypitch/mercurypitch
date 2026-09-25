// Cloudway laboratory render catalogue — stable IDs bind only reviewed, bounded first-slice donors.

export const CLOUDWAY_LAB_PLATFORM_RENDER_IDS = {
  pearlRest: 'cloudway-lab-pearl-rest',
  scroll: 'cloudway-lab-gilt-scroll',
  roseCrackle: 'cloudway-lab-rose-crackle',
  amethystCrackle: 'cloudway-lab-amethyst-crackle',
} as const

export type CloudwayLaboratoryPlatformRenderId =
  (typeof CLOUDWAY_LAB_PLATFORM_RENDER_IDS)[keyof typeof CLOUDWAY_LAB_PLATFORM_RENDER_IDS]

export const CLOUDWAY_LAB_BUNDLE_IDS = {
  pearlRest: 'cloudway-lab-pearl-marble-long-v1',
  scroll: 'gilt-scroll-bridge-runtime-v1',
  roseCrackle: 'cloudway-lab-rose-crackle-v1',
  amethystCrackle: 'cloudway-lab-amethyst-crackle-v1',
} as const

export const CLOUDWAY_LAB_ROOT_NAMES = {
  pearlRest: 'CloudwayLab_PearlMarbleLong',
  scroll: 'Cloudway_GiltScrollBridge_RuntimeV1',
  roseCrackle: 'CloudwayLab_RoseQuartzCrackleFast',
  amethystCrackle: 'CloudwayLab_AmethystCrackleSlow',
} as const

export const CLOUDWAY_LAB_CRACKLE_MATERIAL_KINDS = {
  roseCrackle: {
    CloudwayLab_RoseQuartz__glass: 'glass',
    CloudwayLab_RoseQuartz__framework: 'opaque',
    CloudwayLab_RoseQuartz__internal_detail: 'opaque',
    CloudwayLab_RoseQuartz__corner_provider_pbr: 'opaque',
    CloudwayLab_RoseQuartz__ivory: 'opaque',
  },
  amethystCrackle: {
    CloudwayLab_Amethyst__glass: 'glass',
    CloudwayLab_Amethyst__framework: 'opaque',
    CloudwayLab_Amethyst__internal_detail: 'opaque',
    CloudwayLab_Amethyst__corner_provider_pbr: 'opaque',
    CloudwayLab_Amethyst__luminous_accent: 'opaque',
  },
} as const satisfies Readonly<
  Record<
    'roseCrackle' | 'amethystCrackle',
    Readonly<Record<string, 'glass' | 'opaque'>>
  >
>

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
