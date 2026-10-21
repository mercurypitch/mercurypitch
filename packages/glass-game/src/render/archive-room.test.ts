// Archive rendering tests — owned room resources, bounded shelf instances and readable cover/note state.

import type { InstancedMesh } from 'three'
import { BoxGeometry, Group, Mesh, MeshStandardMaterial, Texture, Vector3, } from 'three'
import { describe, expect, it, vi } from 'vitest'
import { ARCHIVE_HUSH_ROOMS, GLASS_ARCHIVE_HUSH, } from '../content/archive-hush-room'
import { GLASS_UNBROKEN_ARCHIVE } from '../content/unbroken-archive'
import { archiveLightWeight, createArchiveRoom, isDarkArchive, } from './archive-room'

function fixture(level = GLASS_UNBROKEN_ARCHIVE) {
  const museum = new Group()
  const room = new Group()
  room.name = `room-${level.presentation!.rooms![0]!.id}`
  museum.add(room)
  const material = new MeshStandardMaterial({
    color: 0xffffff,
    map: new Texture(),
  })
  const wall = new Mesh(new BoxGeometry(1, 1, 1), material)
  room.add(wall)
  const archive = createArchiveRoom(level, museum)!
  return { museum, room, material, wall, archive }
}

function source() {
  const group = new Group()
  for (const name of [
    'vase_amphora_intact',
    'vase_fluted_intact',
    'vase_rounded_intact',
  ]) {
    const mesh = new Mesh(
      new BoxGeometry(0.3, 0.8, 0.3),
      new MeshStandardMaterial(),
    )
    mesh.name = name
    mesh.position.y = 0.4
    group.add(mesh)
  }
  return group
}

describe('dark archive room', () => {
  it('recognizes only the two authored archive levels and restores ordinary lighting at the threshold', () => {
    expect(isDarkArchive(GLASS_UNBROKEN_ARCHIVE)).toBe(true)
    expect(
      isDarkArchive({ id: 'glassworks-unbroken-archive/archive-hush' }),
    ).toBe(true)
    expect(isDarkArchive({ id: 'glassworks-journey/journey' })).toBe(false)
    expect(
      isDarkArchive({ id: 'glassworks-unbroken-archive-copy/archive-hush' }),
    ).toBe(false)
    expect(archiveLightWeight(-1.4)).toBe(1)
    expect(archiveLightWeight(5.3)).toBeCloseTo(0.5)
    expect(archiveLightWeight(6.2)).toBe(0)
    expect(archiveLightWeight(14.94)).toBe(0)
  })

  it.each([
    { level: GLASS_UNBROKEN_ARCHIVE, limit: 6_000 },
    { level: GLASS_ARCHIVE_HUSH, limit: 8_000 },
  ])(
    'keeps $level.id additions inside the first room and bounded geometry',
    ({ level, limit }) => {
      const { archive, room, museum } = fixture(level)
      expect(archive.root.parent).toBe(room)
      expect(museum.children).toHaveLength(1)
      let triangles = 0
      let meshes = 0
      archive.root.traverse((object) => {
        const mesh = object as Mesh
        if (!mesh.isMesh) return
        meshes++
        triangles +=
          (mesh.geometry.index?.count ??
            mesh.geometry.getAttribute('position').count) / 3
        expect(mesh.castShadow).toBe(false)
      })
      expect(meshes).toBeLessThanOrEqual(18)
      expect(triangles).toBeLessThan(limit)
      archive.dispose()
    },
  )

  it('tints cloned room materials and restores their shared original without disposing borrowed textures', () => {
    const { archive, wall, material } = fixture()
    const textureDispose = vi.spyOn(material.map!, 'dispose')
    const originalDispose = vi.spyOn(material, 'dispose')
    archive.finishInstallation()
    const tinted = wall.material as MeshStandardMaterial
    expect(tinted).not.toBe(material)
    expect(tinted.color.getHex()).not.toBe(0xffffff)
    expect(material.color.getHex()).toBe(0xffffff)
    expect(tinted.map).toBe(material.map)
    const cloneDispose = vi.spyOn(tinted, 'dispose')
    archive.dispose()
    archive.dispose()
    expect(wall.material).toBe(material)
    expect(cloneDispose).toHaveBeenCalledTimes(1)
    expect(originalDispose).not.toHaveBeenCalled()
    expect(textureDispose).not.toHaveBeenCalled()
  })

  it('hides the authored cabinet proxy under its cabinet art and retires its extra light cleanly', () => {
    const { archive, room, museum } = fixture()
    const proxy = new Mesh(new BoxGeometry(1, 1, 1), new MeshStandardMaterial())
    proxy.name =
      'solid-glassworks-unbroken-archive/archive-awakening/diadem/solid/archive-west-cabinet'
    room.add(proxy)
    museum.add(archive.light, archive.light.target)
    archive.finishInstallation()
    expect(proxy.visible).toBe(false)
    // Core museum visibility restores active solids before archive art is applied.
    proxy.visible = true
    archive.update(undefined, 0, 6.2)
    expect(proxy.visible).toBe(false)
    expect(archive.light.intensity).toBe(0)
    expect(archive.light.visible).toBe(true)
    archive.dispose()
    expect(proxy.visible).toBe(true)
    expect(archive.light.parent).toBeNull()
    expect(archive.light.target.parent).toBeNull()
  })

  it('instances only intact low-poly shelf vessels and owns its copied geometry', () => {
    const { archive } = fixture()
    const kit = source()
    const sourceMesh = kit.children[0] as Mesh
    const sourceDispose = vi.spyOn(sourceMesh.geometry, 'dispose')
    archive.installBundle(kit, 'vessels')
    archive.installBundle(kit, 'vessels')
    const instances: InstancedMesh[] = []
    archive.root.traverse((object) => {
      if ((object as InstancedMesh).isInstancedMesh)
        instances.push(object as InstancedMesh)
    })
    expect(instances).toHaveLength(3)
    expect(instances.reduce((sum, mesh) => sum + mesh.count, 0)).toBe(8)
    expect(instances[0]!.geometry).not.toBe(sourceMesh.geometry)
    instances.forEach((mesh) => {
      expect(mesh.castShadow).toBe(false)
      mesh.geometry.computeBoundingBox()
      expect(mesh.geometry.boundingBox!.getSize(new Vector3()).y).toBeCloseTo(
        0.55,
      )
      expect(mesh.geometry.boundingBox!.min.y).toBeCloseTo(0)
    })
    archive.dispose()
    expect(sourceDispose).not.toHaveBeenCalled()
  })

  it('replaces ordinary Hush approach rings without suppressing Song approach guidance', () => {
    for (const level of [GLASS_ARCHIVE_HUSH, GLASS_UNBROKEN_ARCHIVE]) {
      const { archive, room } = fixture(level)
      const pad = new Group()
      pad.name = `approach-pad-${level.breakables[0]!.id}`
      room.add(pad)
      archive.finishInstallation()
      pad.visible = true
      archive.update(undefined, 0)
      expect(pad.visible).toBe(level === GLASS_UNBROKEN_ARCHIVE)
      archive.dispose()
      expect(pad.visible).toBe(true)
    }
  })

  it('places the cloche over the chosen glass and retains the intact furniture when walking away', () => {
    const { archive } = fixture(GLASS_ARCHIVE_HUSH)
    const cover = archive.root.getObjectByName('archive-protective-cloche')!
    archive.update(
      {
        challengeEncounterId: null,
        paused: false,
        archiveHush: {
          roomId: 'diadem',
          curtainClosed: false,
          inRoom: true,
          coveredIndex: 2,
          aimedIndex: 0,
          protectedIndices: [0],
          phase: 'preparing',
        },
      },
      1,
    )
    expect(cover.position.x).toBeCloseTo(-1.35)
    expect(cover.position.z).toBe(0.8)
    expect(cover.visible).toBe(true)
    archive.update({ challengeEncounterId: null, paused: false }, 0)
    expect(cover.visible).toBe(true)
    expect(archive.root.getObjectByName('archive-cloche-rail')!.visible).toBe(
      true,
    )
    archive.dispose()
  })

  it('shares shelf resources across three room owners and moves only one light to the current room', () => {
    const museum = new Group()
    for (const room of GLASS_ARCHIVE_HUSH.presentation!.rooms!) {
      const owner = new Group()
      owner.name = `room-${room.id}`
      museum.add(owner)
    }
    const archive = createArchiveRoom(GLASS_ARCHIVE_HUSH, museum)!
    expect(archive.roots).toHaveLength(3)
    let meshes = 0
    let triangles = 0
    archive.roots.forEach((root) =>
      root.traverse((object) => {
        const mesh = object as Mesh
        if (!mesh.isMesh) return
        meshes++
        triangles +=
          (mesh.geometry.index?.count ??
            mesh.geometry.getAttribute('position').count) / 3
        expect(mesh.castShadow).toBe(false)
      }),
    )
    expect(meshes).toBeLessThanOrEqual(90)
    expect(triangles).toBeLessThanOrEqual(29_000)
    const kit = source()
    archive.installBundle(kit, 'vessels')
    const groups = archive.roots.map((root) => {
      const instances: InstancedMesh[] = []
      root.traverse((item) => {
        if ((item as InstancedMesh).isInstancedMesh)
          instances.push(item as InstancedMesh)
      })
      return instances
    })
    expect(
      groups.map((group) => group.reduce((sum, item) => sum + item.count, 0)),
    ).toEqual([8, 8, 8])
    expect(groups[0]![0]!.geometry).toBe(groups[1]![0]!.geometry)
    expect(groups[0]![0]!.material).toBe(groups[2]![0]!.material)
    const instanceDisposals = groups
      .flat()
      .map((instance) => vi.spyOn(instance, 'dispose'))
    const dispose = vi.spyOn(groups[0]![0]!.geometry, 'dispose')
    archive.update(
      {
        paused: false,
        challengeEncounterId: null,
        archiveHush: {
          roomId: 'lotus',
          curtainClosed: true,
          inRoom: true,
          coveredIndex: 4,
          aimedIndex: 0,
          protectedIndices: [0, 1],
          phase: 'ready',
          completedRoomIds: ['diadem', 'tide'],
        },
      },
      1,
      ARCHIVE_HUSH_ROOMS[2]!.centerZ,
    )
    expect(archive.light.position.z).toBeCloseTo(
      ARCHIVE_HUSH_ROOMS[2]!.centerZ - 0.15,
    )
    expect(archive.lightWeight(ARCHIVE_HUSH_ROOMS[2]!.centerZ)).toBe(1)
    expect(
      archive.lightWeight(ARCHIVE_HUSH_ROOMS[2]!.centerZ + 6.2),
    ).toBeCloseTo(0)
    const tideCurtain = archive.roots[1]!.getObjectByName(
      'archive-acoustic-curtain',
    )!
    expect(tideCurtain.userData.closed).toBe(true)
    expect(
      archive.roots[2]!.getObjectByName('archive-acoustic-curtain')!.userData
        .closed,
    ).toBe(true)
    expect(
      archive.roots[2]!.getObjectByName('archive-protective-cloche')!.position
        .x,
    ).toBe(-1.35)
    archive.dispose()
    archive.dispose()
    expect(dispose).toHaveBeenCalledTimes(1)
    instanceDisposals.forEach((dispose) =>
      expect(dispose).toHaveBeenCalledTimes(1),
    )
    expect(museum.children.every((room) => room.children.length === 0)).toBe(
      true,
    )
  })
})
