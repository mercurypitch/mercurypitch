// ============================================================
// Cloudway platform culling tests — camera visibility keeps a conservative shadow reach.
// ============================================================

import { Box3, BoxGeometry, Group, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, PerspectiveCamera, Vector3, } from 'three'
import { describe, expect, it } from 'vitest'
import { collectShadowReceiverBounds, createCloudwayPlatformViewSelector, } from './cloudway-platform-culling'

function cameraLookingAt(
  position: Vector3,
  target: Vector3,
): PerspectiveCamera {
  const camera = new PerspectiveCamera(90, 1, 0.1, 100)
  camera.position.copy(position)
  camera.lookAt(target)
  camera.updateMatrixWorld(true)
  return camera
}

function bounds(
  minX: number,
  minY: number,
  minZ: number,
  maxX: number,
  maxY: number,
  maxZ: number,
): Box3 {
  return new Box3(new Vector3(minX, minY, minZ), new Vector3(maxX, maxY, maxZ))
}

describe('Cloudway platform view selector', () => {
  it('measures installed receiving decor, including instances, below platform shells', () => {
    const root = new Group()
    const decoration = new Group()
    decoration.position.y = -2
    const receivingMesh = new Mesh(
      new BoxGeometry(1, 2, 1),
      new MeshBasicMaterial(),
    )
    receivingMesh.receiveShadow = true
    decoration.add(receivingMesh)
    root.add(decoration)

    const instances = new InstancedMesh(
      new BoxGeometry(1, 1, 1),
      new MeshBasicMaterial(),
      2,
    )
    instances.receiveShadow = true
    instances.setMatrixAt(0, new Matrix4().makeTranslation(0, -4, 0))
    instances.setMatrixAt(1, new Matrix4().makeTranslation(0, 2, 0))
    root.add(instances)

    const nonReceiver = new Mesh(
      new BoxGeometry(1, 1, 1),
      new MeshBasicMaterial(),
    )
    nonReceiver.position.y = -20
    root.add(nonReceiver)
    const excludedPlatformArt = new Group()
    const excludedReceiver = new Mesh(
      new BoxGeometry(1, 1, 1),
      new MeshBasicMaterial(),
    )
    excludedReceiver.receiveShadow = true
    excludedReceiver.position.y = -30
    excludedPlatformArt.add(excludedReceiver)
    root.add(excludedPlatformArt)

    const receiverBounds = collectShadowReceiverBounds(
      root,
      excludedPlatformArt,
    )
    expect(receiverBounds).toHaveLength(3)
    expect(
      Math.min(...receiverBounds.map((receiver) => receiver.min.y)),
    ).toBeCloseTo(-4.5)
  })

  it('rejects a nearby platform behind the camera when its shadow travels away from view', () => {
    const selector = createCloudwayPlatformViewSelector({
      shadowDirection: { x: 0, y: -1, z: 0 },
      shadowReceiverMinimumY: -4,
    })
    selector.update(cameraLookingAt(new Vector3(), new Vector3(0, 0, 10)))

    expect(selector.includes(bounds(-1, 0, -4, 1, 1, -3))).toBe(false)
  })

  it('rejects a shadow that touches only the offscreen end of a visible receiver', () => {
    const selector = createCloudwayPlatformViewSelector({
      shadowDirection: { x: 0, y: -1, z: 0 },
      shadowReceiverMinimumY: -4,
    })
    selector.update(cameraLookingAt(new Vector3(), new Vector3(0, 0, 10)), [
      bounds(-2, -4, -4, 2, -3, 5),
    ])

    expect(selector.includes(bounds(-1, 0, -4, 1, 1, -3))).toBe(false)
  })

  it('retains a behind-camera caster whose authored light can carry its shadow into view', () => {
    const selector = createCloudwayPlatformViewSelector({
      shadowDirection: { x: 0, y: -1, z: 1 },
      shadowReceiverMinimumY: -4,
    })
    selector.update(cameraLookingAt(new Vector3(), new Vector3(0, 0, 10)))

    expect(selector.includes(bounds(-1, 0, -4, 1, 1, -3))).toBe(true)
  })

  it('extends the sweep only to installed receiver art visible below the collision shell', () => {
    const camera = cameraLookingAt(
      new Vector3(0, -3.5, 0),
      new Vector3(0, -3.5, 10),
    )
    const selector = createCloudwayPlatformViewSelector({
      shadowDirection: { x: 0, y: -1, z: 1 },
      shadowReceiverMinimumY: 10,
    })
    const caster = bounds(-1, 10, -4, 1, 11, -3)
    selector.update(camera)
    expect(selector.includes(caster)).toBe(false)

    selector.update(camera, [bounds(-2, -4, 10, 2, -3, 13)])
    expect(selector.includes(caster)).toBe(true)

    // The union AABB around the diagonal sweep would hit this empty corner.
    selector.update(camera, [bounds(-2, -4, 1, 2, -3, 3)])
    expect(selector.includes(caster)).toBe(false)

    selector.update(camera, [bounds(99, -4, 10, 101, -3, 13)])
    expect(selector.includes(caster)).toBe(false)
  })

  it('uses the world-space guard band to avoid edge popping', () => {
    const camera = cameraLookingAt(new Vector3(), new Vector3(0, 0, 10))
    const outsideRightEdge = bounds(10.45, -0.2, 9.8, 10.7, 0.2, 10.2)
    const strict = createCloudwayPlatformViewSelector({
      frustumMargin: 0,
      shadowDirection: { x: 0, y: -1, z: 0 },
      shadowReceiverMinimumY: 0,
    })
    const guarded = createCloudwayPlatformViewSelector({
      shadowDirection: { x: 0, y: -1, z: 0 },
      shadowReceiverMinimumY: 0,
    })
    strict.update(camera)
    guarded.update(camera)

    expect(strict.includes(outsideRightEdge)).toBe(false)
    expect(guarded.includes(outsideRightEdge)).toBe(true)
  })

  it('falls back to retaining platforms until a usable camera is available', () => {
    const selector = createCloudwayPlatformViewSelector({
      shadowDirection: { x: 0, y: -1, z: 0 },
      shadowReceiverMinimumY: -4,
    })

    selector.update(undefined)

    expect(selector.includes(bounds(80, 0, 80, 81, 1, 81))).toBe(true)
  })
})
