// Cloudway render catalog — stable logical IDs bind authored platforms to one reusable donor kit.

export const CLOUDWAY_PLATFORM_BUNDLE_ID = 'cloudway-platform-kit-v1'

export const CLOUDWAY_PLATFORM_RENDER_IDS = {
  marble: 'cloudway-marble',
  frost: 'cloudway-frost',
  glide: 'cloudway-glide',
  crackle: 'cloudway-crackle',
} as const

export type CloudwayPlatformRenderId =
  (typeof CLOUDWAY_PLATFORM_RENDER_IDS)[keyof typeof CLOUDWAY_PLATFORM_RENDER_IDS]

export const CLOUDWAY_PLATFORM_NODES = {
  marble: 'Cloudway_Marble',
  frost: 'Cloudway_Frost',
  glide: 'Cloudway_Glide',
  crackleIntact: 'Cloudway_Crackle_Intact',
  crackleWarning: 'Cloudway_Crackle_Warning',
  crackleRelease: 'Cloudway_Crackle_Release',
} as const

export function isCloudwayPlatformRenderId(
  value: string | undefined,
): value is CloudwayPlatformRenderId {
  return Object.values(CLOUDWAY_PLATFORM_RENDER_IDS).some(
    (candidate) => candidate === value,
  )
}
