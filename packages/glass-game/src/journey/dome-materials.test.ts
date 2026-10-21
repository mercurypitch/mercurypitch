// Dome material tests — preserve shared architecture and atlas ownership during pane refinement.

import type { WebGLProgramParametersWithUniforms, WebGLRenderer } from 'three'
import { BoxGeometry, DoubleSide, FrontSide, Group, Mesh, MeshPhysicalMaterial, MeshStandardMaterial, ShaderLib, Texture, } from 'three'
import { expect, it, vi } from 'vitest'
import { createClearTemplePaneMaterial, createJourneyDomeMaterials, createTempleOrnamentMaterial, } from './dome-materials'

it('gives separated smooth panes a dielectric material without donor atlas or new environment textures', () => {
  const material = createClearTemplePaneMaterial()
  expect(material.metalness).toBe(0)
  expect(material.transmission).toBeGreaterThan(0.95)
  expect(material.side).toBe(FrontSide)
  expect(material.transparent).toBe(false)
  for (const texture of [
    material.map,
    material.normalMap,
    material.roughnessMap,
    material.transmissionMap,
    material.envMap,
  ])
    expect(texture).toBeNull()
  expect(material.thickness).toBeLessThan(0.03)
})

function fixture() {
  const root = new Group()
  const teal = new MeshStandardMaterial({
    color: '#67c3be',
    metalness: 0.83,
    roughness: 0.62,
    side: DoubleSide,
  })
  teal.name = 'map_temple_dome_teal_atlas'
  teal.map = new Texture()
  teal.roughnessMap = new Texture()
  teal.metalnessMap = teal.roughnessMap
  teal.normalMap = new Texture()
  const amber = teal.clone()
  amber.name = 'map_temple_dome_amber_atlas'
  amber.map = new Texture()
  const conservatory = new MeshPhysicalMaterial({
    transmission: 1,
    ior: 1.45,
    side: DoubleSide,
  })
  conservatory.name = 'map_conservatory_atlas'
  conservatory.map = new Texture()
  conservatory.transmissionMap = new Texture()
  const stone = new MeshStandardMaterial()
  const geometry = new BoxGeometry()
  const meshes: Mesh[] = []
  for (const [id, materials] of [
    ['first-light-isle', [teal, stone]],
    ['twin-galleries-isle', [amber, teal, stone]],
    ['resonance-conservatory-isle', [conservatory, stone]],
  ] as const) {
    const stage = new Group()
    stage.name = id
    for (const material of materials) {
      const mesh = new Mesh(geometry, material)
      stage.add(mesh)
      meshes.push(mesh)
    }
    root.add(stage)
  }
  return { root, teal, amber, conservatory, stone, geometry, meshes }
}

function compile(material: MeshStandardMaterial) {
  const shader = {
    uniforms: {},
    vertexShader: ShaderLib.physical.vertexShader,
    fragmentShader: ShaderLib.physical.fragmentShader,
  } as WebGLProgramParametersWithUniforms
  material.onBeforeCompile(shader, {} as WebGLRenderer)
  return shader
}

it('mutes only teal ornament albedo while borrowing the existing map sample and keeping donor PBR maps', () => {
  const { teal } = fixture()
  const before = teal.clone()
  const material = createTempleOrnamentMaterial(teal)
  expect(material).not.toBeInstanceOf(MeshPhysicalMaterial)
  for (const key of [
    'map',
    'normalMap',
    'roughnessMap',
    'metalnessMap',
  ] as const)
    expect(material[key]).toBe(teal[key])
  expect(material.roughness).toBe(teal.roughness)
  expect(material.metalness).toBe(teal.metalness)
  expect(material.color).toEqual(before.color)
  expect(teal.color).toEqual(before.color)
  const shader = compile(material)
  expect(shader.fragmentShader).toContain(
    '#ifdef USE_MAP\nfloat museumPatinaMask',
  )
  expect(shader.fragmentShader).toContain(
    'min(sampledDiffuseColor.g, sampledDiffuseColor.b) - sampledDiffuseColor.r',
  )
  expect(shader.fragmentShader).not.toContain('texture2D(')
  expect(shader.fragmentShader).not.toContain('roughnessFactor =')
  expect(shader.fragmentShader).not.toContain('metalnessFactor =')
  expect(shader.uniforms).toHaveProperty('museumPatinaTint')
  expect(material.customProgramCacheKey()).toBe(
    'first-light-ornament-patina-v1',
  )
  const textureDisposal = vi.spyOn(teal.map!, 'dispose')
  const sourceDisposal = vi.spyOn(teal, 'dispose')
  material.dispose()
  expect(textureDisposal).not.toHaveBeenCalled()
  expect(sourceDisposal).not.toHaveBeenCalled()
})

it('owns four scoped material clones while retaining resident maps and all geometry', () => {
  const { root, teal, amber, conservatory, stone, geometry, meshes } = fixture()
  const owned = createJourneyDomeMaterials(root)
  expect(owned.size).toBe(4)
  for (const mesh of meshes) expect(mesh.geometry).toBe(geometry)
  expect(meshes.filter((mesh) => mesh.material === stone)).toHaveLength(3)
  const roofs = meshes.filter((mesh) => mesh.material !== stone)
  for (const roof of roofs) {
    expect(roof.material).toBeInstanceOf(MeshPhysicalMaterial)
    expect(owned.has(roof.material as MeshPhysicalMaterial)).toBe(true)
    expect((roof.material as MeshPhysicalMaterial).side).toBe(
      (roof.material as MeshPhysicalMaterial).name.startsWith(
        'map_conservatory',
      )
        ? DoubleSide
        : FrontSide,
    )
  }
  expect(roofs[0].material).not.toBe(roofs[2].material)
  expect((roofs[0].material as MeshPhysicalMaterial).map).toBe(teal.map)
  expect((roofs[1].material as MeshPhysicalMaterial).map).toBe(amber.map)
  expect((roofs[3].material as MeshPhysicalMaterial).transmissionMap).toBe(
    conservatory.transmissionMap,
  )
  expect((roofs[0].material as MeshPhysicalMaterial).roughnessMap).toBe(
    teal.roughnessMap,
  )
  expect((roofs[0].material as MeshPhysicalMaterial).normalMap).toBe(
    teal.normalMap,
  )
  expect('transmission' in teal).toBe(false)
  expect(teal.roughness).toBe(0.62)
  expect(conservatory.transmission).toBe(1)
})

it('keeps donor textures and source materials alive when the owned clones are disposed', () => {
  const { root, teal, amber, conservatory } = fixture()
  const sourceDisposals = [
    teal,
    amber,
    conservatory,
    teal.map!,
    amber.map!,
    conservatory.transmissionMap!,
  ].map((resource) => vi.spyOn(resource, 'dispose'))
  const owned = createJourneyDomeMaterials(root)
  const cloneDisposals = [...owned].map((material) =>
    vi.spyOn(material, 'dispose'),
  )
  owned.forEach((material) => material.dispose())
  for (const spy of sourceDisposals) expect(spy).not.toHaveBeenCalled()
  for (const spy of cloneDisposals) expect(spy).toHaveBeenCalledOnce()
})

it('reuses the teal atlas for warm roof segmentation and the exact conservatory pane map', () => {
  const { root, teal, conservatory } = fixture()
  const owned = [...createJourneyDomeMaterials(root)] as MeshPhysicalMaterial[]
  for (const material of owned) {
    const shader = compile(material)
    expect(shader.uniforms.museumPaneMaskMap.value).toBe(
      material.name.startsWith('map_conservatory')
        ? conservatory.transmissionMap
        : teal.map,
    )
    expect(shader.fragmentShader).toContain(
      'roughnessFactor = mix(roughnessFactor, 0.035, museumPaneMask);',
    )
    expect(shader.fragmentShader).toContain(
      'material.transmission = transmission * museumPaneMask;',
    )
    expect(shader.fragmentShader).toContain(
      'mapN.xy *= normalScale * mix(1.0, 0.025, museumPaneMask);',
    )
    expect(shader.fragmentShader).toContain(
      'ambientOcclusion = mix(ambientOcclusion, 1.0, museumPaneMask);',
    )
    expect(shader.fragmentShader).not.toContain(
      '#include <transmission_fragment>',
    )
    expect(shader.fragmentShader).not.toContain(
      '#include <normal_fragment_maps>',
    )
    expect(material.defines).toHaveProperty('PHYSICAL')
    expect(material.envMap).toBeNull()
    expect(material.transparent).toBe(false)
  }
  expect(compile(owned[0]).uniforms.museumPaneTint.value).not.toEqual(
    compile(owned[2]).uniforms.museumPaneTint.value,
  )
})

it('leaves unrelated stages and incomplete donors untouched and is safe to apply twice', () => {
  const { root, teal } = fixture()
  const unrelated = new Mesh(new BoxGeometry(), teal)
  root.add(unrelated)
  const owned = createJourneyDomeMaterials(root)
  expect(unrelated.material).toBe(teal)
  expect(owned.size).toBe(4)
  expect(createJourneyDomeMaterials(root).size).toBe(0)
  const incomplete = new Group()
  const stage = new Group()
  stage.name = 'first-light-isle'
  const material = new MeshStandardMaterial()
  material.name = 'map_temple_dome_teal_atlas'
  stage.add(new Mesh(new BoxGeometry(), material))
  incomplete.add(stage)
  expect(createJourneyDomeMaterials(incomplete).size).toBe(0)
})

it('smooths only the resident temple pane lighting while preserving framing normals', () => {
  const { root } = fixture()
  const owned = [...createJourneyDomeMaterials(root)] as MeshPhysicalMaterial[]
  for (const material of owned) {
    const shader = compile(material)
    if (material.name.startsWith('map_conservatory')) {
      expect(shader.vertexShader).not.toContain('museumDomeNormal')
    } else {
      expect(shader.vertexShader).toContain('position.y - 1.7')
      expect(shader.fragmentShader).toContain('domePaneWeight = museumPaneMask')
      expect(shader.fragmentShader).not.toContain(
        'nonPerturbedNormal = normal;',
      )
    }
    expect(shader.fragmentShader).toContain(
      'reflectedLight.indirectSpecular *= mix(1.0, 2.0, museumPaneMask);',
    )
    expect(shader.fragmentShader).not.toContain('discard;')
    expect(material.customProgramCacheKey()).toMatch(/^museum-panes-v3-/)
  }
})
