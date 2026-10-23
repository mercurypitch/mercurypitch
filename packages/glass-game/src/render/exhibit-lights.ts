// Resident exhibit lights — one top key and one narrow glint that follow an exhibit, so the light count never changes as rooms hide.
import type { Object3D } from 'three'
import { SpotLight } from 'three'

export interface ExhibitAim {
  readonly x: number
  readonly y: number
  readonly z: number
  /** The exhibit's front, as the vessel root's yaw. */
  readonly facingYaw: number
  /** Height of the vessel's middle above `y`, in metres. */
  readonly height: number
}

export interface ResidentExhibitLights {
  readonly key: SpotLight
  readonly glint: SpotLight
  /** Lights and their targets, to add to the scene once. */
  readonly objects: readonly Object3D[]
  /** Re-aims both lights; `weight` 0 turns them off without removing them. */
  aim(exhibit: ExhibitAim, weight?: number): void
}

export const EXHIBIT_KEY_INTENSITY = 26
export const EXHIBIT_GLINT_INTENSITY = 34

/** Offsets in the exhibit's frame: +z is its front. */
const KEY_OFFSET = { side: 0.15, up: 2.3, front: 0.85 } as const
const GLINT_OFFSET = { side: 0.95, up: 1.9, front: 0.45 } as const

export function createResidentExhibitLights(): ResidentExhibitLights {
  // Unshadowed: a shadowed spot adds a shadow pass, and glass shadows are opaque.
  const key = new SpotLight(0xfff4e6, EXHIBIT_KEY_INTENSITY, 7, 0.42, 0.85, 2)
  const glint = new SpotLight(
    0xffffff,
    EXHIBIT_GLINT_INTENSITY,
    7,
    0.13,
    0.5,
    2,
  )
  key.name = 'exhibit-key'
  glint.name = 'exhibit-glint'
  const place = (
    light: SpotLight,
    offset: { side: number; up: number; front: number },
    exhibit: ExhibitAim,
  ) => {
    const sin = Math.sin(exhibit.facingYaw)
    const cos = Math.cos(exhibit.facingYaw)
    light.position.set(
      exhibit.x + offset.side * cos + offset.front * sin,
      exhibit.y + offset.up,
      exhibit.z - offset.side * sin + offset.front * cos,
    )
    light.target.position.set(exhibit.x, exhibit.y + exhibit.height, exhibit.z)
    light.target.updateMatrixWorld()
  }
  return {
    key,
    glint,
    objects: [key, key.target, glint, glint.target],
    aim(exhibit, weight = 1) {
      place(key, KEY_OFFSET, exhibit)
      place(glint, GLINT_OFFSET, exhibit)
      key.intensity = EXHIBIT_KEY_INTENSITY * weight
      glint.intensity = EXHIBIT_GLINT_INTENSITY * weight
    },
  }
}
