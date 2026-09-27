// Cloudway laboratory static contract tests — only certified opaque dense rests may replace gameplay fallbacks.

import { BoxGeometry, Group, Mesh, MeshPhysicalMaterial, MeshStandardMaterial, } from 'three'
import { describe, expect, it } from 'vitest'
import { validateCloudwayLaboratoryStaticDonor } from './cloudway-laboratory-static-contract'
import { disposeObject } from './dispose'

function donor(material = new MeshStandardMaterial()): Group {
  const source = new Group()
  source.name = 'CloudwayLab_PearlMarbleLong'
  source.userData.collider_json = JSON.stringify({
    shape: 'box',
    width: 3.2,
    depth: 0.72,
    height: 0.34,
    topY: 0,
    center: [0, -0.17, 0],
  })
  source.userData.cloudway_lab_asset_json = JSON.stringify({
    schema: 'cloudway-lab-static-v1',
    assetId: 'pearl-marble-long',
    kind: 'platform',
    coordinates: {
      upAxis: '+Y',
      units: 'metres',
      origin: 'landing-or-resting-datum',
    },
    contact: {
      kind: 'rectangle',
      width: 3.2,
      depth: 0.72,
      topY: 0,
      height: 0.34,
    },
    material: {
      kind: 'provider-pbr',
      appearanceStatus: 'provider-pbr-preserved',
      intendedAppearance: 'opaque',
    },
    geometry: { triangles: 12, decimated: false, remeshed: false },
  })
  const mesh = new Mesh(new BoxGeometry(3.2, 0.34, 0.72), material)
  mesh.name = 'PearlDenseGeometry'
  mesh.position.y = -0.17
  source.add(mesh)
  return source
}

describe('Cloudway laboratory static donor contract', () => {
  it('accepts the exact opaque contact and preserved triangle inventory', () => {
    const source = donor()
    expect(
      validateCloudwayLaboratoryStaticDonor(source, 'pearl-marble-long'),
    ).toMatchObject({
      collider: { width: 3.2, depth: 0.72, height: 0.34, topY: 0 },
      metadata: {
        assetId: 'pearl-marble-long',
        geometry: { triangles: 12, decimated: false, remeshed: false },
      },
    })
    disposeObject(source)
  })

  it('accepts only declared glass regions while keeping the trim opaque', () => {
    const source = donor()
    const trim = source.children[0] as Mesh
    ;(trim.material as MeshStandardMaterial).name = 'reviewed-trim'
    const glass = new Mesh(
      new BoxGeometry(2.8, 0.2, 0.5),
      new MeshPhysicalMaterial({ transmission: 0.65 }),
    )
    glass.material.name = 'reviewed-glass'
    source.add(glass)
    const roles = {
      'reviewed-trim': 'opaque',
      'reviewed-glass': 'glass',
    } as const
    const metadata = JSON.parse(
      source.userData.cloudway_lab_asset_json as string,
    ) as {
      material: Record<string, unknown>
      geometry: { triangles: number }
    }
    metadata.material = {
      kind: 'authored-pbr-regions',
      appearanceStatus: 'authored-regions',
      intendedAppearance: 'glass-and-trim',
      roles: { opaque: ['reviewed-trim'], glass: ['reviewed-glass'] },
    }
    metadata.geometry.triangles = 24
    source.userData.cloudway_lab_asset_json = JSON.stringify(metadata)
    expect(
      validateCloudwayLaboratoryStaticDonor(source, 'pearl-marble-long', roles)
        .metadata.geometry.triangles,
    ).toBe(24)
    for (const field of ['appearanceStatus', 'intendedAppearance'] as const) {
      const accepted = metadata.material[field]
      metadata.material[field] = 'unreviewed'
      source.userData.cloudway_lab_asset_json = JSON.stringify(metadata)
      expect(() =>
        validateCloudwayLaboratoryStaticDonor(
          source,
          'pearl-marble-long',
          roles,
        ),
      ).toThrow(`material.${field}`)
      metadata.material[field] = accepted
    }
    source.userData.cloudway_lab_asset_json = JSON.stringify(metadata)
    glass.material.transmission = 0
    expect(() =>
      validateCloudwayLaboratoryStaticDonor(source, 'pearl-marble-long', roles),
    ).toThrow('physical transmission')
    glass.material.transmission = 0.65
    glass.material.name = 'unreviewed-glass'
    expect(() =>
      validateCloudwayLaboratoryStaticDonor(source, 'pearl-marble-long', roles),
    ).toThrow('unreviewed material')
    glass.material.name = 'reviewed-glass'
    source.remove(glass)
    expect(() =>
      validateCloudwayLaboratoryStaticDonor(source, 'pearl-marble-long', roles),
    ).toThrow('Every reviewed material region')
    source.add(glass)
    disposeObject(source)
  })

  it.each([
    {
      label: 'blended opacity',
      change(source: Group) {
        const material = (source.children[0] as Mesh)
          .material as MeshStandardMaterial
        material.transparent = true
        material.opacity = 0.5
      },
      message: 'fully opaque',
    },
    {
      label: 'non-finite PBR scalar',
      change(source: Group) {
        const material = (source.children[0] as Mesh)
          .material as MeshStandardMaterial
        material.roughness = Number.NaN
      },
      message: 'non-finite PBR material values',
    },
    {
      label: 'non-finite root transform',
      change(source: Group) {
        source.position.x = Number.NaN
      },
      message: 'identity transform',
    },
    {
      label: 'non-finite contact datum',
      change(source: Group) {
        const collider = JSON.parse(
          source.userData.collider_json as string,
        ) as {
          topY: number
        }
        collider.topY = Number.NaN
        source.userData.collider_json = JSON.stringify(collider).replace(
          'null',
          '1e999',
        )
      },
      message: 'collider_json.topY must equal zero',
    },
    {
      label: 'transmissive provider material',
      change(source: Group) {
        const mesh = source.children[0] as Mesh
        ;(mesh.material as MeshStandardMaterial).dispose()
        mesh.material = new MeshPhysicalMaterial({ transmission: 0.6 })
      },
      message: 'preserve opaque provider PBR',
    },
    {
      label: 'changed triangle inventory',
      change(source: Group) {
        const metadata = JSON.parse(
          source.userData.cloudway_lab_asset_json as string,
        ) as { geometry: { triangles: number } }
        metadata.geometry.triangles = 11
        source.userData.cloudway_lab_asset_json = JSON.stringify(metadata)
      },
      message: 'triangle inventory',
    },
  ])('rejects $label', ({ change, message }) => {
    const source = donor()
    change(source)
    expect(() =>
      validateCloudwayLaboratoryStaticDonor(source, 'pearl-marble-long'),
    ).toThrow(message)
    disposeObject(source)
  })
})
