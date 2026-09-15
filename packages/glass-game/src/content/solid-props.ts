// Museum solid props — shared exhibit dimensions and measured reachable scenery proxies.
import type { LevelDefinition, SolidPropDefinition } from '../contracts'

export const EXHIBIT_PLINTH = {
  radiusTop: 0.25,
  radiusBottom: 0.29,
  height: 0.24,
} as const

/** Decoration above the trough rims and the open arch passage stay nonblocking. */
export function glassworksSolidProps(
  level: LevelDefinition,
): SolidPropDefinition[] {
  const props: SolidPropDefinition[] = level.breakables.map((target) => ({
    id: `plinth:${target.id}`,
    kind: 'prop',
    shape: 'cylinder',
    x: target.position.x,
    z: target.position.z,
    top: target.position.y + EXHIBIT_PLINTH.height,
    thickness: EXHIBIT_PLINTH.height,
    radiusTop: EXHIBIT_PLINTH.radiusTop,
    radiusBottom: EXHIBIT_PLINTH.radiusBottom,
  }))
  for (const id of ['arrival', 'goblet-deck', 'vase-deck', 'hero-deck']) {
    const floor = level.platforms.find((platform) => platform.id === id)!
    const width = floor.maxX - floor.minX
    const depth = floor.maxZ - floor.minZ
    for (const side of [-1, 1]) {
      const x = (floor.minX + floor.maxX) / 2 + side * 0.3 * width
      const z = (floor.minZ + floor.maxZ) / 2 - 0.34 * depth
      // The authored 1.4×0.55m trough is placed at scale .7, with its rim at .084m.
      props.push({
        id: `planter:${id}:${side}`,
        kind: 'prop',
        shape: 'box',
        platformId: id,
        minX: x - 0.49,
        maxX: x + 0.49,
        minZ: z - 0.1925,
        maxZ: z + 0.1925,
        top: floor.top + 0.084,
        thickness: 0.084,
        fallback: {
          replacedByBundle: 'museum-garden-v2',
          replacedByNode: 'garden_perimeter',
        },
      })
    }
  }
  for (const side of [-1, 1]) {
    const x = 1.2 + side * 0.895
    props.push(
      {
        id: `arch-pier:${side}`,
        kind: 'prop',
        shape: 'box',
        platformId: 'goblet-deck',
        minX: x - 0.08,
        maxX: x + 0.08,
        minZ: 4.85 - 0.175,
        maxZ: 4.85 + 0.175,
        top: 1.2925,
        thickness: 1.305,
        fallback: {
          replacedByBundle: 'museum-kit',
          replacedByNode: 'museum_arch',
        },
      },
      {
        id: `arch-foot:${side}`,
        kind: 'prop',
        shape: 'box',
        platformId: 'goblet-deck',
        minX: x - 0.12,
        maxX: x + 0.12,
        minZ: 4.85 - 0.2,
        maxZ: 4.85 + 0.2,
        top: 0.065,
        thickness: 0.065,
        fallback: {
          replacedByBundle: 'museum-kit',
          replacedByNode: 'museum_arch',
        },
      },
    )
  }
  const hero = level.platforms.find((platform) => platform.id === 'hero-deck')!
  for (const x of [hero.minX + 0.12, hero.maxX - 0.12])
    props.push({
      id: `hero-column:${x}`,
      kind: 'prop',
      shape: 'cylinder',
      platformId: hero.id,
      x,
      z: hero.minZ + 0.12,
      top: hero.top + 1.8,
      thickness: 1.8,
      radiusTop: 0.065,
      radiusBottom: 0.09,
    })
  return props
}
