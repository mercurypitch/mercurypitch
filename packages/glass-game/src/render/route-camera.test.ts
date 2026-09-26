// Route camera regression — section changes require one stable grounded landing.

import { describe, expect, it } from 'vitest'
import type { RouteSectionCameraDefinition } from '../contracts'
import { createRouteCameraDirector } from './route-camera'

const ROUTE: RouteSectionCameraDefinition = {
  kind: 'route-sections',
  initialSectionId: 'arrival',
  landingDwellSeconds: 0.6,
  sections: [
    {
      id: 'arrival',
      platformIds: ['arrival', 'threshold'],
      yaw: Math.PI,
    },
    {
      id: 'crossing',
      platformIds: ['scroll', 'catch'],
      yaw: 0,
      targetOffset: { x: 0, y: 0.1, z: 0.5 },
    },
  ],
}

function sampleFor(
  director: ReturnType<typeof createRouteCameraDirector>,
  seconds: number,
  supportPlatformId: string,
) {
  let result = director.update({ grounded: true, supportPlatformId }, 1 / 60)
  for (let elapsed = 1 / 60; elapsed < seconds - 1 / 120; elapsed += 1 / 60)
    result = director.update({ grounded: true, supportPlatformId }, 1 / 60)
  return result
}

describe('route camera director', () => {
  it('is an inert backwards-compatible policy without authored sections', () => {
    const director = createRouteCameraDirector(undefined)

    expect(director.section()).toBeNull()
    expect(
      director.update({ grounded: true, supportPlatformId: 'floor' }, 1),
    ).toEqual({ section: null, changed: false })
  })

  it('keeps the initial composition through a jump and commits after landing', () => {
    const director = createRouteCameraDirector(ROUTE)

    expect(director.section()?.id).toBe('arrival')
    for (let frame = 0; frame < 90; frame++)
      expect(
        director.update(
          { grounded: false, supportPlatformId: frame > 40 ? 'scroll' : null },
          1 / 60,
        ),
      ).toMatchObject({ section: { id: 'arrival' }, changed: false })

    expect(sampleFor(director, 0.55, 'scroll')).toMatchObject({
      section: { id: 'arrival' },
      changed: false,
    })
    expect(sampleFor(director, 0.05, 'scroll')).toMatchObject({
      section: { id: 'crossing' },
      changed: true,
    })
  })

  it('requires continuous support instead of accumulating boundary jitter', () => {
    const director = createRouteCameraDirector(ROUTE)

    sampleFor(director, 0.35, 'scroll')
    director.update({ grounded: true, supportPlatformId: 'threshold' }, 1 / 60)
    expect(sampleFor(director, 0.35, 'scroll')).toMatchObject({
      section: { id: 'arrival' },
      changed: false,
    })
    director.update({ grounded: false, supportPlatformId: null }, 1 / 60)
    expect(sampleFor(director, 0.59, 'catch')).toMatchObject({
      section: { id: 'arrival' },
      changed: false,
    })
    expect(sampleFor(director, 0.02, 'catch')).toMatchObject({
      section: { id: 'crossing' },
      changed: true,
    })
  })

  it('clamps untrusted timing and falls back to the first authored section', () => {
    const director = createRouteCameraDirector({
      ...ROUTE,
      initialSectionId: 'missing',
      landingDwellSeconds: 0,
    })

    expect(director.section()?.id).toBe('arrival')
    expect(
      director.update(
        { grounded: true, supportPlatformId: 'scroll' },
        Number.POSITIVE_INFINITY,
      ).changed,
    ).toBe(false)
    expect(sampleFor(director, 0.39, 'scroll').changed).toBe(false)
    expect(sampleFor(director, 0.04, 'scroll')).toMatchObject({
      section: { id: 'crossing' },
      changed: true,
    })
  })

  it('keeps the first authored owner when platform lists overlap', () => {
    const director = createRouteCameraDirector({
      ...ROUTE,
      sections: [
        { ...ROUTE.sections[0], platformIds: ['shared'] },
        { ...ROUTE.sections[1], platformIds: ['shared'] },
      ],
    })

    expect(
      director.update(
        { grounded: true, supportPlatformId: 'shared' },
        Number.POSITIVE_INFINITY,
      ),
    ).toMatchObject({ section: { id: 'arrival' }, changed: false })
  })
})
