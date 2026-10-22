// Pearl surface tests — joined ornament is removed without holes, duplicate fragments or altered exterior caps.

import { readFileSync } from 'node:fs'
import type { BufferGeometry, Mesh as MeshType } from 'three'
import { BoxGeometry, Float32BufferAttribute, Matrix4, Mesh, MeshStandardMaterial, PlaneGeometry, Raycaster, Texture, Vector3, } from 'three'
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { describe, expect, it } from 'vitest'
import { fitCloudwayLaboratoryRigidPresentation } from './cloudway-laboratory-platforms'
import { clipPearlCourtGeometry } from './cloudway-pearl-court'
import { replacePearlCourtSurface } from './cloudway-pearl-surface'
import { disposeObject } from './dispose'

const contact = { width: 3.2, depth: 0.72 }

function mesh(geometry: BufferGeometry, matrix = new Matrix4()) {
  const result = new Mesh(geometry, new MeshStandardMaterial())
  result.matrixWorld.copy(matrix)
  return result
}

function usedVertices(geometry: BufferGeometry) {
  return geometry.index === null
    ? Array.from(
        { length: geometry.getAttribute('position').count },
        (_, index) => index,
      )
    : Array.from(geometry.index.array)
}

function topArea(parts: readonly BufferGeometry[], height: number) {
  let area = 0
  for (const part of parts) {
    const position = part.getAttribute('position')
    const indices = usedVertices(part)
    for (let index = 0; index < indices.length; index += 3) {
      const [a, b, c] = indices
        .slice(index, index + 3)
        .map((vertex) => new Vector3().fromBufferAttribute(position, vertex))
      if ([a!, b!, c!].every((point) => Math.abs(point.y - height) < 1e-6))
        area += b!.sub(a!).cross(c!.sub(a!)).length() / 2
    }
  }
  return area
}

describe('continuous Pearl court surface', () => {
  it('returns standalone geometry without allocating or editing it', () => {
    const donor = mesh(new BoxGeometry(3.4, 0.34, 0.9))
    const parts = [donor.geometry]
    const result = replacePearlCourtSurface(donor, parts, 0, contact)
    expect(result.shell).toBe(parts)
    expect(result.surface).toBeNull()
    donor.geometry.dispose()
    donor.material.dispose()
  })

  it('partitions corner-crossing triangles exactly once and interpolates every attribute', () => {
    const geometry = new PlaneGeometry(4, 2)
      .rotateX(-Math.PI / 2)
      .translate(0, 0.01, 0)
    geometry.setAttribute(
      'tangent',
      new Float32BufferAttribute(
        Array.from({ length: 4 }, () => [1, 0, 0, 1]).flat(),
        4,
      ),
    )
    const donor = mesh(geometry)
    const source = geometry.getAttribute('position').array.slice()
    const result = replacePearlCourtSurface(donor, [geometry], 4, contact)
    // Duplicated union fragments would make this exact remaining area larger.
    expect(topArea(result.shell, 0.01)).toBeCloseTo(8 - 3.2 * 0.7, 6)
    expect(topArea([result.surface!], 0)).toBeCloseTo(3.2 * 0.7, 6)
    expect(geometry.getAttribute('position').array).toEqual(source)
    for (const part of result.shell)
      for (const attribute of Object.values(part.attributes))
        expect(Array.from(attribute.array).every(Number.isFinite)).toBe(true)
    expect(result.shell.every((part) => part.hasAttribute('tangent'))).toBe(
      true,
    )
    result.shell.forEach((part) => part.dispose())
    result.surface!.dispose()
    geometry.dispose()
    donor.material.dispose()
  })

  it('closes all four cardinal joins at the original walking datum under each quarter turn', () => {
    const donor = mesh(new BoxGeometry(3.4, 0.34, 0.9).translate(0, -0.16, 0))
    for (const turns of [0, 1, 2, 3]) {
      const rotation = new Matrix4().makeRotationY((turns * Math.PI) / 2)
      for (const [mask, opposite, dx, dz] of [
        [1, 2, -3.2, 0],
        [2, 1, 3.2, 0],
        [4, 8, 0, -0.72],
        [8, 4, 0, 0.72],
      ]) {
        const a = replacePearlCourtSurface(
          donor,
          [donor.geometry],
          mask!,
          contact,
        )
        const b = replacePearlCourtSurface(
          donor,
          [donor.geometry],
          opposite!,
          contact,
        )
        const next = rotation
          .clone()
          .multiply(new Matrix4().makeTranslation(dx!, 0, dz!))
        const surfaces = [mesh(a.surface!, rotation), mesh(b.surface!, next)]
        const ray = new Raycaster()
        for (const offset of [-1e-4, 0, 1e-4]) {
          const sample = new Vector3(
            dx! / 2 + (dx === 0 ? 0 : offset),
            1,
            dz! / 2 + (dz === 0 ? 0 : offset),
          ).applyMatrix4(rotation)
          ray.set(sample, new Vector3(0, -1, 0))
          expect(ray.intersectObjects(surfaces, false)[0]?.point.y).toBeCloseTo(
            0,
            7,
          )
        }
        for (const surface of surfaces) {
          const position = surface.geometry.getAttribute('position')
          const normal = surface.geometry.getAttribute('normal')
          expect(position.count).toBe(30)
          expect(position.getY(6)).toBeCloseTo(0)
          expect(position.getY(7)).toBeCloseTo(-0.02)
          for (let index = 0; index < position.count; index += 3) {
            const a = new Vector3().fromBufferAttribute(position, index)
            const b = new Vector3().fromBufferAttribute(position, index + 1)
            const c = new Vector3().fromBufferAttribute(position, index + 2)
            const face = b.sub(a).cross(c.sub(a)).normalize()
            expect(
              face.dot(new Vector3().fromBufferAttribute(normal, index)),
            ).toBeCloseTo(1, 7)
          }
          surface.material.dispose()
          surface.geometry.dispose()
        }
        a.shell.forEach((part) => part.dispose())
        b.shell.forEach((part) => part.dispose())
      }
    }
    donor.geometry.dispose()
    donor.material.dispose()
  })

  it('removes the actual donor’s inboard rows and medallions while preserving its underside and exposed endcaps', async () => {
    const bytes = readFileSync(
      new URL(
        '../../../../apps/beside-cue/public/games/cloudway-laboratory-v1/pearl-marble-long/pearl-marble-long-runtime-v1.glb',
        import.meta.url,
      ),
    )
    const scene = (
      await new GLTFLoader()
        .setMeshoptDecoder(MeshoptDecoder)
        .register(() => ({
          name: 'EXT_texture_webp',
          loadTexture: async () => new Texture(),
        }))
        .parseAsync(
          bytes.buffer.slice(
            bytes.byteOffset,
            bytes.byteOffset + bytes.byteLength,
          ),
          '',
        )
    ).scene
    fitCloudwayLaboratoryRigidPresentation(scene, 'pearlRest', contact)
    scene.updateMatrixWorld(true)
    const donor = scene.getObjectByName(
      'CloudwayLab_PearlMarbleLong__provider_detail',
    )! as MeshType
    const sourceIndex = donor.geometry.index!.array.slice()
    const parts = clipPearlCourtGeometry(donor, 12, contact)
    const result = replacePearlCourtSurface(donor, parts, 12, contact)
    const shell = result.shell.map((geometry) =>
      mesh(geometry, donor.matrixWorld),
    )
    const surface = mesh(result.surface!, donor.matrixWorld)
    const ray = new Raycaster()
    // The gold medallions lie inboard of the contact ends, and the repeated
    // cross-court rows lie inboard of its long sides.
    for (const x of [-1.42, -0.8, 0, 0.8, 1.42])
      for (const z of [-0.35, -0.2, 0, 0.2, 0.35]) {
        ray.set(new Vector3(x, 1, z), new Vector3(0, -1, 0))
        expect(ray.intersectObject(surface, false)[0]?.point.y).toBeCloseTo(
          0,
          6,
        )
        const retained = ray.intersectObjects(shell, false)[0]
        expect(retained === undefined || retained.point.y <= -0.01999).toBe(
          true,
        )
      }
    for (const x of [-1.65, 1.65]) {
      ray.set(new Vector3(x, 1, 0), new Vector3(0, -1, 0))
      expect(ray.intersectObjects(shell, false)[0]?.point.y).toBeCloseTo(
        ray.intersectObject(donor, false)[0]!.point.y,
        6,
      )
    }
    const point = new Vector3()
    for (const part of result.shell) {
      const position = part.getAttribute('position')
      for (const vertex of usedVertices(part)) {
        point
          .fromBufferAttribute(position, vertex)
          .applyMatrix4(donor.matrixWorld)
        if (Math.abs(point.x) < 1.59999 && Math.abs(point.z) < 0.35999)
          expect(point.y).toBeLessThanOrEqual(-0.01999)
      }
    }
    expect(donor.geometry.index!.array).toEqual(sourceIndex)
    for (const object of [...shell, surface]) {
      object.material.dispose()
      object.geometry.dispose()
    }
    for (const part of parts) if (part !== donor.geometry) part.dispose()
    disposeObject(scene)
  })
})
