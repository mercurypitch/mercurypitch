// Archive acoustic curtains — pleated velvet gathers visibly beside a brass-framed display alcove.

import type { BufferGeometry } from 'three'
import { BoxGeometry, CatmullRomCurve3, DoubleSide, Group, Mesh, MeshBasicMaterial, MeshPhysicalMaterial, MeshStandardMaterial, PlaneGeometry, SphereGeometry, TorusGeometry, TubeGeometry, Vector3, } from 'three'
import type { BreakableDefinition } from '../contracts'

export function createArchiveCurtain(
  vessels: readonly BreakableDefinition[],
  centerZ: number,
) {
  if (vessels.length === 0) return undefined
  const minX = Math.min(...vessels.map(({ position }) => position.x))
  const maxX = Math.max(...vessels.map(({ position }) => position.x))
  const width = maxX - minX + 1.44
  const x = minX - 0.72
  const front = Math.min(
    0.48,
    ...vessels.map(({ position }) => position.z - centerZ - 0.72),
  )
  const root = new Group()
  root.name = 'archive-acoustic-curtain'
  root.position.set(x, 0, front)
  root.userData.excludeFromCameraCollision = true
  const geometries: BufferGeometry[] = []
  const brass = new MeshStandardMaterial({
    color: 0xbda069,
    roughness: 0.36,
    metalness: 0.82,
  })
  const velvet = new MeshPhysicalMaterial({
    color: 0x12434b,
    roughness: 0.88,
    metalness: 0,
    sheen: 0.65,
    sheenColor: 0x537e8f,
    sheenRoughness: 0.68,
    side: DoubleSide,
  })
  const signal = new MeshBasicMaterial({
    color: 0xc5a25e,
    transparent: true,
    opacity: 0.68,
  })

  function mesh(geometry: BufferGeometry, material = brass) {
    geometries.push(geometry)
    return new Mesh(geometry, material)
  }
  const rod = mesh(new BoxGeometry(width + 0.12, 0.045, 0.055))
  rod.position.set(width / 2, 1.97, 0)
  root.add(rod)
  for (const side of [-0.04, width + 0.04]) {
    const upright = mesh(new BoxGeometry(0.026, 1.97, 0.026))
    upright.position.set(side, 0.985, 0)
    const foot = mesh(new BoxGeometry(0.09, 0.025, 0.12))
    foot.position.set(side, 0.0125, 0)
    const finial = mesh(new SphereGeometry(0.043, 10, 6))
    finial.position.set(side, 1.97, 0)
    root.add(upright, foot, finial)
  }

  const cloth = new Group()
  cloth.name = 'archive-curtain-cloth'
  const pleats = new PlaneGeometry(1, 1.76, 64, 8)
  const positions = pleats.getAttribute('position')
  for (let i = 0; i < positions.count; i++) {
    const u = positions.getX(i) + 0.5
    const y = positions.getY(i) + 1.03
    positions.setXYZ(
      i,
      u,
      y + 0.018 * Math.sin(u * Math.PI * 24),
      0.045 * Math.cos(u * Math.PI * 24) +
        0.025 * Math.sin((y / 1.91) * Math.PI),
    )
  }
  pleats.computeVertexNormals()
  geometries.push(pleats)
  cloth.add(new Mesh(pleats, velvet))
  for (const y of [0.15, 1.91]) {
    const border = mesh(new BoxGeometry(1, 0.022, 0.008))
    border.position.set(0.5, y, -0.052)
    cloth.add(border)
  }
  root.add(cloth)
  const clasp = mesh(new TorusGeometry(0.06, 0.008, 4, 16))
  clasp.name = 'archive-curtain-tieback'
  clasp.position.set(width - 0.08, 0.92, -0.07)
  root.add(clasp)

  // A floor-level acoustic path ends at the screen, never crosses the route.
  const cue = new Group()
  cue.name = 'archive-curtain-sound-path'
  for (const offset of [-0.075, 0, 0.075]) {
    const curve = new CatmullRomCurve3([
      new Vector3(-x + 0.3, 0.026, -0.6 + offset),
      new Vector3(-0.7, 0.026, -0.55 + offset),
      new Vector3(width / 2, 0.026, -0.09 + offset),
    ])
    const geometry = new TubeGeometry(curve, 16, 0.009, 4, false)
    geometries.push(geometry)
    cue.add(new Mesh(geometry, signal))
  }
  root.add(cue)
  let openness = 1
  let disposed = false

  function update(closed: boolean, dt: number) {
    const target = closed ? 0 : 1
    openness += (target - openness) * Math.min(1, Math.max(0, dt) * 8)
    const visibleWidth = width * (1 - openness * 0.86)
    cloth.scale.x = visibleWidth
    cloth.position.x = width - visibleWidth
    clasp.visible = openness > 0.75
    signal.color.setHex(closed ? 0x8fbeac : 0xc5a25e)
    root.userData.closed = closed
  }
  update(false, 1)
  return {
    root,
    update,
    dispose() {
      if (disposed) return
      disposed = true
      geometries.forEach((geometry) => geometry.dispose())
      brass.dispose()
      velvet.dispose()
      signal.dispose()
      root.removeFromParent()
    },
  }
}
