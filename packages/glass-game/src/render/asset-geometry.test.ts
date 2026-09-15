// Authored asset regression — gold, glass and physical texture coordinates survive actual assembly and break.
import { BoxGeometry, BufferGeometry, Float32BufferAttribute, Group, Matrix4, Mesh, MeshPhysicalMaterial, NoColorSpace, PlaneGeometry, RepeatWrapping, SRGBColorSpace, Texture, Uint8BufferAttribute, Vector3, } from 'three'
import { describe, expect, it, vi } from 'vitest'
import { GLASSWORKS } from '../content/glassworks'
import { createMaterialTable, flattenGeometry } from './asset-geometry'
import { disposeMaterials, disposeObject } from './dispose'
import { createKitInstance, kitFloorDimensions } from './kit-instance'
import { createMaterialLibrary } from './material-library'
import { stretchSurfaceUv } from './surface-uv'
import { configureTexture } from './texture-recipe'
import { createVessel } from './vessels'

function fixture() {
  const normal = new Texture()
  normal.colorSpace = NoColorSpace
  normal.flipY = false
  normal.wrapS = normal.wrapT = RepeatWrapping
  normal.repeat.set(2, 3)
  const glass = new MeshPhysicalMaterial({
    transmission: 0.96,
    normalMap: normal,
  })
  glass.name = 'glass_shell'
  const gold = new MeshPhysicalMaterial({ metalness: 1, roughness: 0.22 })
  gold.name = 'gold_trim'
  const shell = new BoxGeometry(0.4, 0.6, 0.05)
  shell.setAttribute('uv1', shell.getAttribute('uv').clone())
  const count = shell.getAttribute('position').count
  shell.setAttribute(
    'tangent',
    new Float32BufferAttribute(
      Array.from({ length: count }, () => [1, 0, 0, 1]).flat(),
      4,
    ),
  )
  const root = new Group()
  root.add(new Mesh(shell, glass))
  const rim = new Mesh(new BoxGeometry(0.45, 0.02, 0.07), gold)
  rim.position.y = 0.3
  root.add(rim)
  return { root, glass, gold, normal }
}

describe('authored museum materials', () => {
  it('merges indexed and unindexed primitives without losing normalized colors or group offsets', () => {
    const root = new Group()
    const box = new BoxGeometry()
    root.add(new Mesh(box, new MeshPhysicalMaterial()))
    const triangle = new BufferGeometry()
    triangle.setAttribute(
      'position',
      new Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3),
    )
    triangle.setAttribute(
      'color',
      new Uint8BufferAttribute(
        [255, 128, 0, 255, 128, 0, 255, 128, 0],
        3,
        true,
      ),
    )
    root.add(new Mesh(triangle, new MeshPhysicalMaterial()))
    const library = createMaterialLibrary()
    const result = flattenGeometry(
      root,
      new Matrix4(),
      createMaterialTable(library),
    )
    expect(result.index!.count).toBe(39)
    expect(result.getAttribute('position').count).toBe(27)
    expect(Array.from(result.index!.array).slice(-3)).toEqual([24, 25, 26])
    expect(result.groups.at(-1)).toEqual({
      start: 36,
      count: 3,
      materialIndex: 1,
    })
    expect(result.getAttribute('color').getX(0)).toBe(1)
    expect(result.getAttribute('color').getY(24)).toBeCloseTo(128 / 255)
    expect(result.getAttribute('color').getZ(24)).toBe(0)
    expect(result.getAttribute('uv').getX(24)).toBe(0)
    expect(triangle.index).toBeNull()
    expect(triangle.getAttribute('color').normalized).toBe(true)
    expect(box.getAttribute('position').count).toBe(24)
    result.dispose()
    library.dispose()
    disposeObject(root)
  })
  it('releases borrowed palette resources once, including maps not used by a visible mesh', () => {
    const map = new Texture()
    const visible = new MeshPhysicalMaterial({ map })
    const unused = new MeshPhysicalMaterial({ normalMap: map })
    const disposeMap = vi.fn(),
      disposeVisible = vi.fn(),
      disposeUnused = vi.fn()
    map.addEventListener('dispose', disposeMap)
    visible.addEventListener('dispose', disposeVisible)
    unused.addEventListener('dispose', disposeUnused)
    const mesh = new Mesh(new BoxGeometry(), visible)
    disposeObject(mesh, new Set([visible, unused]))
    expect(disposeMap).not.toHaveBeenCalled()
    expect(disposeVisible).not.toHaveBeenCalled()
    disposeMaterials([visible, unused, visible])
    expect(disposeMap).toHaveBeenCalledTimes(1)
    expect(disposeVisible).toHaveBeenCalledTimes(1)
    expect(disposeUnused).toHaveBeenCalledTimes(1)
  })
  it('keeps gold and glass bindings, transformed tangents and UV1 through merged geometry', () => {
    const source = fixture()
    const library = createMaterialLibrary()
    const table = createMaterialTable(library)
    const geometry = flattenGeometry(
      source.root,
      new Matrix4().makeRotationY(Math.PI / 2),
      table,
    )
    // Two indexed boxes retain their shared vertices; expanding these to triangle
    // corners multiplies the memory cost of every intact and hidden shard mesh.
    expect(geometry.index?.count).toBe(72)
    expect(geometry.getAttribute('position').count).toBe(48)
    expect(geometry.groups.reduce((sum, group) => sum + group.count, 0)).toBe(
      72,
    )
    expect(table.materials.map((material) => material.name)).toEqual([
      'glass_shell',
      'gold_trim',
    ])
    expect(
      new Set(geometry.groups.map((group) => group.materialIndex)),
    ).toEqual(new Set([0, 1]))
    expect(geometry.getAttribute('uv1').count).toBe(
      geometry.getAttribute('position').count,
    )
    expect(geometry.getAttribute('tangent').getZ(0)).toBeCloseTo(-1)
    expect(geometry.getAttribute('uv1').getX(2)).toBe(
      geometry.getAttribute('uv').getX(2),
    )
    const imported = table.materials[0] as MeshPhysicalMaterial
    expect(imported.transmission).toBe(0.96)
    expect(imported.normalMap).not.toBe(source.normal)
    expect(imported.normalMap?.colorSpace).toBe(NoColorSpace)
    expect(imported.normalMap?.repeat.toArray()).toEqual([2, 3])
    const dispose = vi.fn()
    imported.normalMap!.addEventListener('dispose', dispose)
    library.clone(source.glass)
    library.dispose()
    library.dispose()
    expect(dispose).toHaveBeenCalledTimes(1)
    geometry.dispose()
  })
  it('keeps matching material slots on the actual vessel shards and limits stress to glass', () => {
    const source = fixture()
    const vessel = createVessel(GLASSWORKS.breakables[0], false)
    const table = createMaterialTable(vessel.materialLibrary)
    const intact = flattenGeometry(source.root, new Matrix4(), table)
    vessel.setGeometry(
      intact,
      [{ geometry: intact.clone(), centre: new Vector3() }],
      table.materials,
    )
    vessel.update(
      {
        id: GLASSWORKS.breakables[0].id,
        charge: 1,
        phase: 'shattering',
        brokenAt: 0,
      },
      0.2,
    )
    const meshes: Mesh[] = []
    vessel.root.traverse((node) => {
      if ((node as Mesh).isMesh) meshes.push(node as Mesh)
    })
    const importedMeshes = meshes.filter(
      (mesh) => mesh.material === table.materials,
    )
    expect(importedMeshes).toHaveLength(2)
    expect(importedMeshes[0].geometry.groups).toEqual(
      importedMeshes[1].geometry.groups,
    )
    expect(
      (table.materials[0] as MeshPhysicalMaterial).emissiveIntensity,
    ).toBeGreaterThan(0)
    expect((table.materials[1] as MeshPhysicalMaterial).emissive.getHex()).toBe(
      0,
    )
    vessel.update(
      {
        id: GLASSWORKS.breakables[0].id,
        charge: 1,
        phase: 'complete',
        brokenAt: 0,
      },
      0.6,
    )
    expect((table.materials[0] as MeshPhysicalMaterial).emissiveIntensity).toBe(
      0,
    )
    const dispose = vi.fn()
    table.materials[0].addEventListener('dispose', dispose)
    vessel.dispose()
    expect(dispose).toHaveBeenCalledTimes(1)
  })
  it('keeps separate overrides and restores UVs for an unwrapped legacy stone mesh', () => {
    const geometry = new BoxGeometry(2, 0.3, 3)
    geometry.deleteAttribute('uv')
    const authored = new MeshPhysicalMaterial({
      roughness: 0.4,
      normalMap: new Texture(),
    })
    authored.name = 'museum_ivory'
    const root = new Mesh(geometry, authored)
    const library = createMaterialLibrary()
    const palette = {
      marble: new MeshPhysicalMaterial({ color: 0xffffff, map: new Texture() }),
      dark: new MeshPhysicalMaterial({ color: 0x123456 }),
    }
    const light = createKitInstance(root, palette, {}, library)
      .children[0] as Mesh
    const dark = createKitInstance(
      root,
      palette,
      { museum_ivory: 'dark' },
      library,
    ).children[0] as Mesh
    expect(light.geometry.getAttribute('uv').count).toBe(
      geometry.getAttribute('position').count,
    )
    expect(light.material).not.toBe(dark.material)
    expect((light.material as MeshPhysicalMaterial).color.getHex()).toBe(
      0xffffff,
    )
    expect((dark.material as MeshPhysicalMaterial).color.getHex()).toBe(
      0x123456,
    )
    expect((light.material as MeshPhysicalMaterial).normalMap).not.toBeNull()
    expect((light.material as MeshPhysicalMaterial).normalMap).not.toBe(
      authored.normalMap,
    )
    library.dispose()
  })
  it('scales by declared deck bounds and preserves physical UV density when stretching', () => {
    const source = new Mesh(
      new BoxGeometry(8, 2, 8),
      new MeshPhysicalMaterial(),
    )
    source.userData.collider_json = JSON.stringify({
      width: 3.3,
      depth: 2.4,
      height: 0.22,
    })
    expect(kitFloorDimensions(source).toArray()).toEqual([3.3, 0.22, 2.4])
    const plane = new PlaneGeometry(1, 1).rotateX(-Math.PI / 2)
    plane.setAttribute('uv1', plane.getAttribute('uv').clone())
    const stretched = stretchSurfaceUv(plane, new Vector3(4, 1, 0.5))
    const original = plane
    const normal = original.getAttribute('normal')
    const uv = original.getAttribute('uv')
    for (let i = 0; i < normal.count; i++) {
      if (normal.getY(i) !== 1) continue
      expect(stretched.getAttribute('uv').getX(i)).toBeCloseTo(uv.getX(i) * 4)
      expect(stretched.getAttribute('uv').getY(i)).toBeCloseTo(uv.getY(i) * 0.5)
      expect(stretched.getAttribute('uv1').getX(i)).toBe(uv.getX(i))
    }
  })
  it('does not split shared UV edges across folded geometry', () => {
    const source = new BufferGeometry()
    source.setAttribute(
      'position',
      new Float32BufferAttribute(
        [0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0, 0, 1, 1, 1, 0, 1, 0],
        3,
      ),
    )
    source.setAttribute(
      'uv',
      new Float32BufferAttribute([0, 0, 1, 0, 0, 1, 1, 0, 1, 1, 0, 1], 2),
    )
    const result = stretchSurfaceUv(source, new Vector3(4, 1, 0.5))
    const uv = result.getAttribute('uv')
    expect(uv.getX(1)).toBe(uv.getX(3))
    expect(uv.getY(2)).toBe(uv.getY(5))
    expect(uv.getX(1)).toBeGreaterThan(1)
  })
  it('uses linear physical maps and sRGB color maps with explicit glTF sampling', () => {
    const normal = configureTexture(new Texture(), {
      asset: 'normal',
      interpretation: 'data',
      wrap: 'repeat',
      repeat: [3, 4],
      channel: 1,
    })
    const color = configureTexture(new Texture(), {
      asset: 'marble',
      interpretation: 'color',
    })
    expect(normal.colorSpace).toBe(NoColorSpace)
    expect(normal.flipY).toBe(false)
    expect(normal.wrapS).toBe(RepeatWrapping)
    expect(normal.repeat.toArray()).toEqual([3, 4])
    expect(normal.anisotropy).toBe(4)
    expect(normal.channel).toBe(1)
    expect(color.colorSpace).toBe(SRGBColorSpace)
  })
})
