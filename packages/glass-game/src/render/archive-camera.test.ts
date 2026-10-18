// Archive overview tests — authored displays fit beside the console without changing other level cameras.

import { Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { ARCHIVE_HUSH_ROOMS, GLASS_ARCHIVE_HUSH, } from '../content/archive-hush-room'
import { GLASS_UNBROKEN_ARCHIVE } from '../content/unbroken-archive'
import { createGlassGame } from '../core/game'
import { archiveOverviewViewport, createArchiveOverviewFraming, } from './archive-camera'
import { createAdventureCamera } from './camera'
import { EXPLORATION_FOV_DEGREES } from './camera-policy'

describe('archive overview composition', () => {
  it('leaves twenty pixels between display framing and the bounded portrait console', () => {
    expect(archiveOverviewViewport(390, 844).bottom).toBe(844 - 138 - 360 - 20)
    expect(archiveOverviewViewport(768, 1024).bottom).toBe(1024 - 18 - 360 - 20)
  })
  it('leaves Song and other museum cameras untouched', () => {
    expect(createArchiveOverviewFraming(GLASS_UNBROKEN_ARCHIVE)).toBeUndefined()
  })

  it.each(
    ARCHIVE_HUSH_ROOMS.flatMap((room) =>
      [
        [390, 844],
        [844, 390],
        [768, 1024],
        [1440, 900],
      ].map(([width, height]) => ({ room, width: width!, height: height! })),
    ),
  )(
    'keeps $room.id display and curtain envelopes clear of the console at $width by $height',
    ({ room, width, height }) => {
      const level = {
        ...GLASS_ARCHIVE_HUSH,
        spawn: {
          ...GLASS_ARCHIVE_HUSH.spawn,
          position: {
            ...GLASS_ARCHIVE_HUSH.spawn.position,
            z: room.centerZ + (room.id === 'diadem' ? -0.8 : -2.2),
          },
        },
      }
      const rig = createAdventureCamera(level)
      const camera = rig.camera
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      const frame = createArchiveOverviewFraming(GLASS_ARCHIVE_HUSH)!
      const game = createGlassGame(level)
      for (let i = 0; i < 120; i++) {
        rig.update(game.snapshot(), 1 / 60)
        frame.apply(camera, width, height, room.id)
      }
      camera.updateMatrixWorld(true)
      const rect = archiveOverviewViewport(width, height)
      for (const display of GLASS_ARCHIVE_HUSH.breakables.filter(({ id }) =>
        room.vesselIds.includes(id),
      )) {
        for (const x of [-0.64, 0.64]) {
          for (const y of [
            0.13,
            room.curtainVesselIds.length > 0 ? 2.05 : 1.68,
          ]) {
            for (const z of [-0.65, 0.65]) {
              const point = new Vector3(
                display.position.x + x,
                y,
                display.position.z + z,
              ).project(camera)
              const px = ((point.x + 1) * width) / 2
              const py = ((1 - point.y) * height) / 2
              expect(px).toBeGreaterThanOrEqual(rect.left - 1)
              expect(px).toBeLessThanOrEqual(rect.right + 1)
              expect(py).toBeGreaterThanOrEqual(rect.top - 1)
              expect(py).toBeLessThanOrEqual(rect.bottom + 1)
            }
          }
        }
      }
    },
  )

  it('replans projection on rotation and keeps a stable FOV during movement', () => {
    const rig = createAdventureCamera(GLASS_ARCHIVE_HUSH)
    const camera = rig.camera
    const frame = createArchiveOverviewFraming(GLASS_ARCHIVE_HUSH)!
    rig.update(createGlassGame(GLASS_ARCHIVE_HUSH).snapshot(), 1 / 60)
    camera.aspect = 390 / 844
    frame.apply(camera, 390, 844)
    const portraitFov = camera.fov
    camera.position.x += 0.2
    frame.apply(camera, 390, 844)
    expect(camera.fov).toBe(portraitFov)
    camera.aspect = 844 / 390
    frame.apply(camera, 844, 390)
    expect(camera.fov).toBeLessThan(portraitFov)
    expect(camera.view?.fullWidth).toBe(844)
    expect(camera.view?.fullHeight).toBe(390)
  })

  it('rebases view offset on orientation change while looking away from the display row', () => {
    const rig = createAdventureCamera(GLASS_ARCHIVE_HUSH)
    const camera = rig.camera
    const frame = createArchiveOverviewFraming(GLASS_ARCHIVE_HUSH)!
    rig.update(createGlassGame(GLASS_ARCHIVE_HUSH).snapshot(), 1 / 60)
    camera.aspect = 390 / 844
    frame.apply(camera, 390, 844)
    camera.rotateY(Math.PI)
    const rotation = camera.quaternion.clone()
    camera.aspect = 844 / 390
    frame.apply(camera, 844, 390)
    expect(camera.view?.fullWidth).toBe(844)
    expect(camera.view?.fullHeight).toBe(390)
    expect(Number.isFinite(camera.view?.offsetX)).toBe(true)
    expect(Number.isFinite(camera.view?.offsetY)).toBe(true)
    expect(camera.fov).toBeGreaterThanOrEqual(EXPLORATION_FOV_DEGREES)
    expect(camera.fov).toBeLessThanOrEqual(104)
    expect(camera.quaternion.equals(rotation)).toBe(true)
  })

  it('clears overview projection before entering first-person and can restore it afterwards', () => {
    const rig = createAdventureCamera(GLASS_ARCHIVE_HUSH)
    const camera = rig.camera
    const frame = createArchiveOverviewFraming(GLASS_ARCHIVE_HUSH)!
    rig.update(createGlassGame(GLASS_ARCHIVE_HUSH).snapshot(), 1 / 60)
    camera.aspect = 390 / 844
    frame.apply(camera, 390, 844)
    const overviewFov = camera.fov
    frame.clear(camera)
    expect(camera.view?.enabled).toBe(false)
    expect(camera.fov).toBe(EXPLORATION_FOV_DEGREES)
    rig.setMode('first-person')
    expect(camera.fov).not.toBe(overviewFov)
    rig.setMode('third-person')
    frame.apply(camera, 390, 844)
    expect(camera.view?.enabled).toBe(true)
    expect(camera.fov).toBe(overviewFov)
  })
})
