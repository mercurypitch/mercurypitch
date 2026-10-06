// Visibility authoring tests — strict opt-in schema upgrades preserve legacy courses.

import { describe, expect, it } from 'vitest'
import { CLOUDWAY_FOG_DEFAULTS, CLOUDWAY_FOG_LIMITS, } from '../content/cloudway-visibility'
import { resolveCloudwayFog } from '../render/cloudway-scene'
import { getMuseumSceneFrame } from '../render/scene-catalog'
import { cloudwayStudioCatalog, compileStudioDocument } from './cloudway-studio'
import { compileCloudwayFog } from './compile-cloudway-fog'

const fog = { kind: 'linear', nearMeters: 12, farMeters: 24 } as const

describe('Cloudway visibility authoring', () => {
  it('keeps every existing schema 2/3 course and its omitted-field default intact', () => {
    for (const { document } of cloudwayStudioCatalog().examples) {
      const version = (document as { schemaVersion?: number }).schemaVersion
      if (typeof version === 'number' && version >= 4) continue
      const before = structuredClone(document)
      for (const level of compileStudioDocument(document)) {
        expect(level.presentation).not.toHaveProperty('fog')
        expect(resolveCloudwayFog(level)).toEqual(CLOUDWAY_FOG_DEFAULTS)
        expect(getMuseumSceneFrame(level).cameraFar).toBeGreaterThan(
          CLOUDWAY_FOG_LIMITS.maximumFarMeters + 2,
        )
      }
      expect(document).toEqual(before)
    }
  })

  it('round-trips a schema-4 override without altering omission on another course', () => {
    const source = JSON.parse(
      JSON.stringify(cloudwayStudioCatalog().examples[0]!.document),
    )
    source.schemaVersion = 4
    source.courses[0].presentation.fog = fog
    const [level] = compileStudioDocument(JSON.parse(JSON.stringify(source)))
    expect(level!.presentation!.fog).toEqual(fog)
    expect(resolveCloudwayFog(level!)).toEqual(fog)
    delete source.courses[0].presentation.fog
    expect(compileStudioDocument(source)[0]!.presentation).not.toHaveProperty(
      'fog',
    )
  })

  it.each([2, 3])(
    'rejects an override masquerading as older schema %s',
    (version) => {
      const example = cloudwayStudioCatalog().examples.find(
        ({ document }) => document.schemaVersion === version,
      )!
      const source = JSON.parse(JSON.stringify(example.document))
      source.courses[0].presentation.fog = fog
      expect(() => compileStudioDocument(source)).toThrow(
        'presentation.fog is not supported',
      )
    },
  )

  it.each([
    [null, 'must be an object'],
    [{ ...fog, colour: 0xffffff }, 'colour is not supported'],
    [{ ...fog, kind: 'exponential' }, 'kind must be linear'],
    [{ ...fog, nearMeters: NaN }, 'nearMeters must be finite'],
    [{ ...fog, nearMeters: 0 }, 'nearMeters must be at least'],
    [{ ...fog, farMeters: Infinity }, 'farMeters must be finite'],
    [{ ...fog, farMeters: 31 }, 'farMeters must be at most'],
    [{ ...fog, farMeters: 13 }, 'farMeters must be at least 2m beyond'],
    [{ ...fog, nearMeters: 30 }, 'farMeters must be at least 2m beyond'],
  ])('rejects invalid visibility with its source path', (source, error) => {
    expect(() =>
      compileCloudwayFog(source, 'courses[0].presentation.fog'),
    ).toThrow(error)
  })

  it('accepts the bounded extremes and advertises them to the editor', () => {
    expect(
      compileCloudwayFog(
        { kind: 'linear', nearMeters: 1, farMeters: 3 },
        'fog',
      ),
    ).toEqual({ kind: 'linear', nearMeters: 1, farMeters: 3 })
    expect(
      compileCloudwayFog(
        { kind: 'linear', nearMeters: 28, farMeters: 30 },
        'fog',
      ),
    ).toEqual({ kind: 'linear', nearMeters: 28, farMeters: 30 })
    expect(cloudwayStudioCatalog()).toMatchObject({
      courseSchemaVersions: [2, 3, 4],
      visibility: {
        defaults: CLOUDWAY_FOG_DEFAULTS,
        limits: CLOUDWAY_FOG_LIMITS,
      },
    })
  })
})
