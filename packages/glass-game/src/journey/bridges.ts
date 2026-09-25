// Journey bridges — joined fan-shaped marble treads, continuous rails and supported terrace landings.

import type { Material } from 'three'
import { BufferGeometry, CatmullRomCurve3, CylinderGeometry, Float32BufferAttribute, Group, InstancedMesh, Matrix4, Mesh, OctahedronGeometry, Quaternion, TubeGeometry, Vector3, } from 'three'
import type { MuseumJourneyBridge } from '../content/museum-journey'
import { createJourneyBridgePath } from './bridge-path'

interface BridgeMaterials {
  ivory: Material
  gold: Material
}

/** A closed flat-topped wedge: neighbouring treads share the same plan boundary. */
function addTread(
  positions: number[],
  uv: number[],
  corners: Vector3[],
  top: number,
  bottom: number,
): void {
  const lower = corners.map((point) => new Vector3(point.x, bottom, point.z))
  const upper = corners.map((point) => new Vector3(point.x, top, point.z))
  const quad = (a: Vector3, b: Vector3, c: Vector3, d: Vector3): void => {
    for (const point of [a, b, c, a, c, d]) {
      positions.push(point.x, point.y, point.z)
      uv.push(point.x * 0.75, point.z * 0.75 + point.y * 0.3)
    }
  }
  quad(upper[0]!, upper[1]!, upper[2]!, upper[3]!)
  quad(lower[3]!, lower[2]!, lower[1]!, lower[0]!)
  for (let side = 0; side < 4; side++) {
    const next = (side + 1) % 4
    quad(lower[side]!, lower[next]!, upper[next]!, upper[side]!)
  }
}

export function createJourneyBridge(
  bridge: MuseumJourneyBridge,
  materials: BridgeMaterials,
  owned: Set<BufferGeometry>,
): Group {
  const own = <T extends BufferGeometry>(geometry: T): T => {
    owned.add(geometry)
    return geometry
  }
  const root = new Group()
  root.name = bridge.id
  const path = createJourneyBridgePath(bridge)
  const positions: number[] = []
  const uv: number[] = []
  const slices = bridge.kind === 'promenade' ? 24 : path.steps
  const halfWidth = bridge.width * 0.5
  for (let index = 0; index < slices; index++) {
    const start = index / slices,
      end = (index + 1) / slices
    const corners = [
      path.point(start, -halfWidth),
      path.point(start, halfWidth),
      path.point(end, halfWidth),
      path.point(end, -halfWidth),
    ]
    const top = path.surfaceHeight((start + end) * 0.5)
    const lowerTop = path.surfaceHeight(Math.max(0, start - 0.00001))
    addTread(positions, uv, corners, top, Math.min(top, lowerTop) - 0.12)
  }
  const geometry = own(new BufferGeometry())
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new Float32BufferAttribute(uv, 2))
  geometry.computeVertexNormals()
  geometry.computeBoundingSphere()
  const deck = new Mesh(geometry, materials.ivory)
  deck.name = `${bridge.id}-curved-promenade`
  deck.castShadow = true
  deck.receiveShadow = true
  root.add(deck)

  const railHeight = bridge.kind === 'skybridge' ? 0.26 : 0.035
  const postsPerSide =
    bridge.kind === 'skybridge'
      ? Math.max(3, Math.ceil(path.curve.getLength() / 0.4))
      : 3
  const postGeometry = own(new CylinderGeometry(0.019, 0.025, 1, 8))
  const posts = new InstancedMesh(
    postGeometry,
    materials.gold,
    postsPerSide * 2,
  )
  posts.name = `${bridge.id}-rail-posts`
  posts.castShadow = true
  const finials = new InstancedMesh(
    own(new OctahedronGeometry(0.034, 0)),
    materials.gold,
    postsPerSide * 2,
  )
  finials.name = `${bridge.id}-gilded-rail-finials`
  finials.castShadow = true
  const matrix = new Matrix4(),
    rotation = new Quaternion()
  let instance = 0
  for (const sign of [-1, 1]) {
    const railPoints = Array.from({ length: 49 }, (_, i) => {
      const t = i / 48,
        point = path.point(t, sign * (halfWidth - 0.022))
      // A continuous rail slopes gently above the level treads.
      point.y =
        bridge.from[1] + (bridge.to[1] - bridge.from[1]) * t + railHeight
      return point
    })
    const rail = new Mesh(
      own(
        new TubeGeometry(new CatmullRomCurve3(railPoints), 48, 0.017, 6, false),
      ),
      materials.gold,
    )
    rail.name = `${bridge.id}-continuous-handrail`
    rail.castShadow = true
    root.add(rail)
    for (let index = 0; index < postsPerSide; index++) {
      const t = index / (postsPerSide - 1),
        point = path.point(t, sign * (halfWidth - 0.022))
      const railY =
        bridge.from[1] + (bridge.to[1] - bridge.from[1]) * t + railHeight
      const height = railY - point.y
      matrix.compose(
        new Vector3(point.x, point.y + height * 0.5, point.z),
        rotation,
        new Vector3(1, height, 1),
      )
      posts.setMatrixAt(instance, matrix)
      matrix.makeTranslation(point.x, railY + 0.025, point.z)
      finials.setMatrixAt(instance++, matrix)
    }
    if (bridge.kind === 'skybridge') {
      const archPoints = Array.from({ length: 33 }, (_, i) => {
        const t = i / 32,
          point = path.point(t, sign * (halfWidth - 0.045))
        point.y =
          bridge.from[1] +
          (bridge.to[1] - bridge.from[1]) * t -
          0.15 -
          0.42 * Math.pow(2 * t - 1, 2)
        return point
      })
      const arch = new Mesh(
        own(
          new TubeGeometry(
            new CatmullRomCurve3(archPoints),
            32,
            0.035,
            8,
            false,
          ),
        ),
        materials.gold,
      )
      arch.name = `${bridge.id}-supporting-arch`
      arch.castShadow = true
      root.add(arch)
    }
  }
  posts.instanceMatrix.needsUpdate = true
  finials.instanceMatrix.needsUpdate = true
  root.add(posts, finials)
  return root
}
