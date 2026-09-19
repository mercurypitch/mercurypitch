// Camera movement regression — forward follows the view without a diagonal speed gain.
import { BoxGeometry, Mesh, MeshBasicMaterial, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { GLASSWORKS } from '../content/glassworks'
import { createGlassGame } from '../core/game'
import { cameraRelativeMovement, createAdventureCamera } from './camera'

describe('camera-relative traversal', () => {
  it('moves away from the camera at all cardinal headings', () => {
    for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      const forward = cameraRelativeMovement(0, 1, yaw)
      expect(forward.moveX).toBeCloseTo(-Math.sin(yaw))
      expect(forward.moveZ).toBeCloseTo(-Math.cos(yaw))
      const right = cameraRelativeMovement(1, 0, yaw)
      expect(
        right.moveX * forward.moveX + right.moveZ * forward.moveZ,
      ).toBeCloseTo(0)
    }
  })
  it('caps diagonals without losing analog stick magnitude', () => {
    const diagonal = cameraRelativeMovement(1, 1, 0.7)
    expect(Math.hypot(diagonal.moveX, diagonal.moveZ)).toBeCloseTo(1)
    const analog = cameraRelativeMovement(0.2, 0.1, 0.7)
    expect(Math.hypot(analog.moveX, analog.moveZ)).toBeCloseTo(
      Math.hypot(0.2, 0.1),
    )
  })
  it('starts behind the spawn direction and retains a deliberate orbit', () => {
    const camera = createAdventureCamera(GLASSWORKS)
    expect(camera.yaw()).toBe(GLASSWORKS.spawn.facingYaw)
    camera.orbit(0.7, 0)
    expect(camera.yaw()).toBeCloseTo(GLASSWORKS.spawn.facingYaw + 0.7)
    camera.recenter()
    expect(camera.yaw()).toBe(GLASSWORKS.spawn.facingYaw)
  })
  it('retracts before actual museum geometry and restores the free orbit after it clears', () => {
    const rig = createAdventureCamera(GLASSWORKS)
    const state = createGlassGame(GLASSWORKS).snapshot()
    const target = new Vector3()
      .copy(state.player.position)
      .add(new Vector3(0, 0.42, 0))
    const wall = new Mesh(new BoxGeometry(2, 3, 0.3), new MeshBasicMaterial())
    wall.position.set(1.2, 1, -0.5)
    wall.updateMatrixWorld()
    rig.setOccluders([wall])
    rig.update(state, 1 / 60)
    expect(rig.camera.position.distanceTo(target)).toBeLessThan(2)
    expect(rig.camera.position.z).toBeGreaterThan(-0.35)
    rig.setOccluders([])
    rig.update(state, 1 / 60)
    expect(rig.camera.position.distanceTo(target)).toBeCloseTo(4)
    wall.geometry.dispose()
    wall.material.dispose()
  })
})
