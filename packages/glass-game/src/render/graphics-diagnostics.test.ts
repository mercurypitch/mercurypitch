// Graphics diagnostics tests — original failures stay actionable and arbitrary payloads stay private.
import { expect, it, vi } from 'vitest'
import type { GraphicsCanvasSnapshot } from './graphics-diagnostics'
import { getGraphicsCanvasDiagnostic, registerGraphicsCanvas, reportGraphicsFailure, retireGraphicsCanvas, updateGraphicsCanvasSnapshot, } from './graphics-diagnostics'

it('keeps renderer ownership distinct across retry and retirement snapshots', () => {
  const first = {} as HTMLCanvasElement
  const second = {} as HTMLCanvasElement
  expect(getGraphicsCanvasDiagnostic(first)).toBeUndefined()
  registerGraphicsCanvas(first, 'museum-map')
  updateGraphicsCanvasSnapshot(first, {
    selectedStageId: 'conservatory',
    assetProfile: 'mobile',
    textures: 36,
  })
  const before = getGraphicsCanvasDiagnostic(first)
  registerGraphicsCanvas(second, 'museum-map')
  retireGraphicsCanvas(first)
  retireGraphicsCanvas(first)
  updateGraphicsCanvasSnapshot(first, { textures: 0 })
  expect(before).toMatchObject({ scene: 'museum-map', lifecycle: 'active' })
  expect(getGraphicsCanvasDiagnostic(first)).toMatchObject({
    scene: 'museum-map',
    lifecycle: 'disposed',
    snapshot: {
      selectedStageId: 'conservatory',
      assetProfile: 'mobile',
      textures: 36,
    },
  })
  expect(getGraphicsCanvasDiagnostic(second)).toMatchObject({
    scene: 'museum-map',
    lifecycle: 'active',
  })
  expect(getGraphicsCanvasDiagnostic(second)?.instance).not.toBe(
    before?.instance,
  )
  registerGraphicsCanvas(first, 'gallery')
  expect(getGraphicsCanvasDiagnostic(first)).toMatchObject({
    scene: 'gallery',
    lifecycle: 'active',
  })
  expect(getGraphicsCanvasDiagnostic(first)?.snapshot).toBeUndefined()
  expect(getGraphicsCanvasDiagnostic(first)?.instance).not.toBe(
    before?.instance,
  )
})

it('retains only bounded stage, profile and finite nonnegative resource counts', () => {
  const canvas = {} as HTMLCanvasElement
  updateGraphicsCanvasSnapshot(canvas, { textures: 36 })
  expect(getGraphicsCanvasDiagnostic(canvas)).toBeUndefined()
  registerGraphicsCanvas(canvas, 'museum-map')
  updateGraphicsCanvasSnapshot(canvas, {
    selectedStageId: 'x'.repeat(150),
    assetProfile: 'mobile',
    drawCalls: 0,
    triangles: 180_000,
    textures: 36,
    geometries: 42,
    estimatedTextureBytes: 179_306_496,
    url: 'private asset URL',
    state: { save: 'private' },
  } as GraphicsCanvasSnapshot)
  expect(getGraphicsCanvasDiagnostic(canvas)?.snapshot).toEqual({
    selectedStageId: 'x'.repeat(100),
    assetProfile: 'mobile',
    drawCalls: 0,
    triangles: 180_000,
    textures: 36,
    geometries: 42,
    estimatedTextureBytes: 179_306_496,
  })
  for (const invalid of [NaN, Infinity, -Infinity, -1, '123', null]) {
    updateGraphicsCanvasSnapshot(canvas, {
      selectedStageId: 42,
      assetProfile: 'unexpected',
      drawCalls: invalid,
      triangles: invalid,
      textures: invalid,
      geometries: invalid,
      estimatedTextureBytes: invalid,
    } as unknown as GraphicsCanvasSnapshot)
    expect(getGraphicsCanvasDiagnostic(canvas)?.snapshot).toEqual({})
  }
})

it('isolates retained diagnostics from caller and reader mutation', () => {
  const canvas = {} as HTMLCanvasElement
  const snapshot: GraphicsCanvasSnapshot = {
    selectedStageId: 'journey',
    assetProfile: 'full',
    drawCalls: 87,
    estimatedTextureBytes: 179_306_496,
  }
  registerGraphicsCanvas(canvas, 'museum-map')
  updateGraphicsCanvasSnapshot(canvas, snapshot)
  snapshot.selectedStageId = 'twin'
  snapshot.drawCalls = 0
  const first = getGraphicsCanvasDiagnostic(canvas)!
  expect(Object.isFrozen(first.snapshot)).toBe(true)
  expect(Reflect.set(first.snapshot!, 'drawCalls', 999)).toBe(false)
  Reflect.set(first, 'scene', 'gallery')
  Reflect.set(first, 'snapshot', { drawCalls: 999 })
  const retained = getGraphicsCanvasDiagnostic(canvas)
  expect(retained).toMatchObject({
    scene: 'museum-map',
    snapshot: {
      selectedStageId: 'journey',
      assetProfile: 'full',
      drawCalls: 87,
      estimatedTextureBytes: 179_306_496,
    },
  })
  expect(retained?.snapshot).not.toBe(
    getGraphicsCanvasDiagnostic(canvas)?.snapshot,
  )
})

it('retains scene and stage while bounding an original error', () => {
  const error = vi.spyOn(console, 'error').mockImplementation(() => {})
  try {
    reportGraphicsFailure(
      'singing-current',
      'asset-load',
      new TypeError('x'.repeat(600)),
    )
    expect(error).toHaveBeenCalledWith('[Glassworks graphics]', {
      scene: 'singing-current',
      stage: 'asset-load',
      errorName: 'TypeError',
      errorMessage: 'x'.repeat(240),
    })
    reportGraphicsFailure('museum-map', 'frame', { private: 'not diagnostic' })
    expect(error).toHaveBeenLastCalledWith('[Glassworks graphics]', {
      scene: 'museum-map',
      stage: 'frame',
      errorName: 'UnknownError',
      errorMessage: 'No error detail supplied',
    })
  } finally {
    error.mockRestore()
  }
})
