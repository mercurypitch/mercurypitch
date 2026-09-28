// Mechanics-preview contact tests — certified curved and polygon art stays physically honest at gameplay rates.

import { describe, expect, it } from 'vitest'
import type { LevelDefinition, Vec3 } from '../contracts'
import { FLAT_COURSE_COLLIDER } from '../core/collision'
import { circleOverlapsConvexPolygon } from '../core/convex-polygon'
import { createGlassGame } from '../core/game'
import { MOVEMENT } from '../core/movement'
import { CLOUDWAY_CRYSTAL_PROMENADE_MECHANICS_PREVIEW } from './cloudway-laboratory'
import { FROST_GOLD_ARCH_FRAME, FROST_GOLD_ARCH_PANE, FROST_GOLD_ARCH_PROFILE, } from './frost-gold-arch-profile'
import { ROSE_HEX_CRUMBLE_CONTACT, ROSE_HEX_CRUMBLE_SUPPORT_POLYGON, } from './rose-hex-crumble-profile'

const preview = CLOUDWAY_CRYSTAL_PROMENADE_MECHANICS_PREVIEW
const rose = preview.platforms.find(
  (platform) => platform.id === 'preview-rose-step',
)!
const wall = preview.breakables.find(
  (encounter) => encounter.id === 'preview-voice-fifth',
)!
const wallSolids =
  preview.solids?.filter((solid) =>
    solid.id.startsWith(`barrier:${wall.id}:`),
  ) ?? []

function fixtureAt(position: Vec3): LevelDefinition {
  return {
    ...preview,
    id: `${preview.id}-contact-fixture`,
    spawn: { position, facingYaw: 0 },
    platforms: [rose],
    solids: [],
    checkpoints: [],
    breakables: [],
    intentionalGaps: [],
    camera: undefined,
    presentation: undefined,
    exit: {
      minX: 100,
      maxX: 101,
      minZ: 100,
      maxZ: 101,
      top: 0,
      requiresCompleted: [],
    },
  }
}

function settle(position: Vec3, framesPerSecond: 30 | 60) {
  const game = createGlassGame(fixtureAt(position))
  for (let frame = 0; frame < framesPerSecond / 2; frame++)
    game.step({ moveX: 0, moveZ: 0, jumpDown: false }, 1 / framesPerSecond)
  return game.snapshot().player
}

describe('Cloudway mechanics-preview certified contact', () => {
  it.each([30, 60] as const)(
    'lands on the Rose Hex face and falls past an empty envelope corner at %dHz',
    (framesPerSecond) => {
      const centre = {
        x: (rose.minX + rose.maxX) / 2,
        z: (rose.minZ + rose.maxZ) / 2,
      }
      const supported = settle(
        { x: centre.x + 0.65, y: rose.top + 0.04, z: centre.z + 0.4 },
        framesPerSecond,
      )
      const emptyCorner = settle(
        { x: centre.x + 0.82, y: rose.top + 0.04, z: centre.z + 0.5 },
        framesPerSecond,
      )

      expect(supported.grounded).toBe(true)
      expect(supported.supportPlatformId).toBe(rose.id)
      expect(emptyCorner.grounded).toBe(false)
      expect(emptyCorner.position.y).toBeLessThan(rose.top)
      expect(emptyCorner.supportPlatformId).toBeNull()
    },
  )

  it('uses the exact measured Rose Hex outline and stops a high-displacement side sweep', () => {
    expect(rose.maxX - rose.minX).toBeCloseTo(
      ROSE_HEX_CRUMBLE_CONTACT.width,
      10,
    )
    expect(rose.maxZ - rose.minZ).toBeCloseTo(
      ROSE_HEX_CRUMBLE_CONTACT.depth,
      10,
    )
    expect(rose.thickness).toBeCloseTo(ROSE_HEX_CRUMBLE_CONTACT.thickness, 10)
    const expectedPolygon = ROSE_HEX_CRUMBLE_SUPPORT_POLYGON.map((point) => ({
      x: point.x + 3,
      z: point.z + 3.12,
    }))
    expect(rose.supportPolygon).toHaveLength(expectedPolygon.length)
    expect(rose.supportPolygon).toEqual(expect.arrayContaining(expectedPolygon))

    const result = FLAT_COURSE_COLLIDER.move(
      { x: 1, y: -0.2, z: 3.52 },
      { x: 4, y: 0, z: 0 },
      [rose],
      MOVEMENT,
    )
    expect(result.blockedX).toBe(true)
    expect(
      circleOverlapsConvexPolygon(
        result.position,
        MOVEMENT.radius,
        rose.supportPolygon!,
      ),
    ).toBe(false)
  })

  it('decomposes the curved pane without gaps or a false full crown box', () => {
    const gates = FROST_GOLD_ARCH_PROFILE.gateParts!
    expect(gates).toHaveLength(16)
    expect(FROST_GOLD_ARCH_PROFILE.gate).toBeUndefined()
    expect(gates[0]).toMatchObject({
      id: 'pane-lower',
      bottomCenter: { x: 0, y: 0, z: 0 },
      width: FROST_GOLD_ARCH_PANE.width,
      height: FROST_GOLD_ARCH_PANE.shoulderHeight,
      depth: FROST_GOLD_ARCH_PANE.depth,
    })
    for (let index = 1; index < gates.length; index++) {
      const previous = gates[index - 1]!
      const current = gates[index]!
      expect(current.bottomCenter.y).toBeCloseTo(
        previous.bottomCenter.y + previous.height,
        6,
      )
      expect(current.width).toBeLessThan(previous.width)
      expect(current.depth).toBe(FROST_GOLD_ARCH_PANE.depth)
    }
    const last = gates.at(-1)!
    const uncoveredApex =
      FROST_GOLD_ARCH_PANE.height - (last.bottomCenter.y + last.height)
    expect(uncoveredApex).toBeGreaterThan(0)
    expect(uncoveredApex).toBeLessThan(0.005)
  })

  it('grounds measured posts and keeps the ornate crown above every reachable support jump', () => {
    const anchorSupports = preview.platforms.filter(
      (platform) =>
        wall.anchor.x >= platform.minX &&
        wall.anchor.x <= platform.maxX &&
        wall.anchor.z >= platform.minZ &&
        wall.anchor.z <= platform.maxZ,
    )
    expect(anchorSupports.map((platform) => platform.id)).toContain(
      'preview-wall-approach-entry',
    )
    const highestAdjacentSupport = Math.max(
      ...anchorSupports.map((platform) => platform.top),
    )
    expect(
      highestAdjacentSupport + MOVEMENT.jumpHeight + MOVEMENT.height,
    ).toBeLessThan(FROST_GOLD_ARCH_PANE.shoulderHeight)

    for (const post of FROST_GOLD_ARCH_FRAME.posts) {
      const profile = FROST_GOLD_ARCH_PROFILE.frameSides.find(
        (side) => side.id === post.id,
      )!
      expect(profile.bottomCenter.y).toBe(0)
      expect(profile.width).toBe(post.width)
      expect(profile.height).toBe(FROST_GOLD_ARCH_PANE.shoulderHeight)
      const innerEdge = Math.abs(post.centerX) - post.width / 2
      expect(Math.abs(innerEdge - FROST_GOLD_ARCH_PANE.width / 2)).toBeLessThan(
        0.001,
      )
    }
  })

  it('emits every curved gate band as removable while the measured posts remain permanent', () => {
    const gates = wallSolids.filter(
      (solid) => solid.presentation?.role === 'gate',
    )
    const posts = wallSolids.filter(
      (solid) => solid.presentation?.role === 'wall',
    )

    expect(gates).toHaveLength(FROST_GOLD_ARCH_PROFILE.gateParts!.length)
    expect(posts).toHaveLength(FROST_GOLD_ARCH_FRAME.posts.length)
    gates.forEach((solid) => {
      expect(solid.activation).toEqual({ noneCompleted: [wall.id] })
      expect(solid.fallback).toEqual({
        replacedByBundle: 'cloudway-lab-frost-gold-arch-v1',
        replacedByNode: 'frost_arch_intact',
      })
    })
    posts.forEach((solid) => {
      expect(solid.activation).toBeUndefined()
      expect(solid.top - solid.thickness).toBeCloseTo(wall.position.y, 10)
    })
  })
})
