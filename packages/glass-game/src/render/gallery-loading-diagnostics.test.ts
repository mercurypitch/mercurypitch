// Gallery loading diagnostics regression — bounded snapshots preserve concurrent pending work and failure ordering.
import { afterEach, expect, it, vi } from 'vitest'
import { createLoadingProgressLedger } from '../loading-progress'
import { createGalleryLoadingDiagnostics, createGalleryRendererLoadingDiagnostics, } from './gallery-loading-diagnostics'
import { registerGraphicsCanvas, retireGraphicsCanvas, } from './graphics-diagnostics'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

it('samples the current render profile after a quality change', () => {
  vi.stubEnv('VITE_PORTABLE_CONSOLE', 'true')
  const info = vi.spyOn(console, 'info').mockImplementation(() => {})
  const loading = createLoadingProgressLedger(['gpu:programs'], vi.fn())
  let profile: 'balanced' | 'high' = 'balanced'
  const diagnostics = createGalleryRendererLoadingDiagnostics(
    'thawing-song',
    loading,
    () => profile,
    'mobile',
  )
  profile = 'high'
  diagnostics.report('failure')
  expect(info.mock.calls[0]?.[1]).toMatchObject({
    renderProfile: 'high',
    assetProfile: 'mobile',
  })
  info.mockRestore()
})

it('reports one failure before retirement with concurrent task IDs and finite primitive resources', () => {
  vi.stubEnv('VITE_PORTABLE_CONSOLE', 'true')
  const info = vi.spyOn(console, 'info').mockImplementation(() => {})
  const canvas = {} as HTMLCanvasElement
  registerGraphicsCanvas(canvas, 'gallery')
  const loading = createLoadingProgressLedger(
    ['bundle:garden', 'environment:sky', 'gpu:programs'],
    vi.fn(),
  )
  let now = 10
  const diagnostics = createGalleryLoadingDiagnostics(
    'level:'.repeat(30),
    loading,
    () => now,
  )
  now = 30
  diagnostics.stage('program-compile')
  now = 45
  diagnostics.report('failure', {
    canvas,
    renderProfile: 'balanced',
    assetProfile: 'mobile',
    drawingBuffer: [487, 1055],
    viewport: [390, 844],
    textures: 41,
    geometries: 62,
    drawCalls: NaN,
    triangles: -1,
    arbitrary: { private: 'not copied' },
  } as Parameters<typeof diagnostics.report>[1])
  retireGraphicsCanvas(canvas)
  diagnostics.stage('disposed')
  diagnostics.stage('ready')
  diagnostics.report('ready', { canvas })
  diagnostics.report('failure', { canvas })
  expect(info).toHaveBeenCalledOnce()
  expect(info).toHaveBeenCalledWith('[Glassworks gallery loading]', {
    outcome: 'failure',
    attemptGeneration: expect.any(Number),
    levelId: 'level:'.repeat(30).slice(0, 100),
    substage: 'program-compile',
    elapsedMs: 35,
    stageElapsedMs: 15,
    completedUnits: 0,
    totalUnits: 3,
    lastCompletedUnitId: null,
    pendingCount: 3,
    pendingUnitIds: ['bundle:garden', 'environment:sky', 'gpu:programs'],
    canvasInstance: expect.any(Number),
    activeGalleryCount: expect.any(Number),
    activeLoadingPreviewCount: 0,
    renderProfile: 'balanced',
    assetProfile: 'mobile',
    drawingBuffer: [487, 1055],
    viewport: [390, 844],
    textures: 41,
    geometries: 62,
  })
  info.mockRestore()
})

it('reports ready once, then permits one later failure without negative or nonfinite timings', () => {
  vi.stubEnv('VITE_PORTABLE_CONSOLE', 'true')
  const info = vi.spyOn(console, 'info').mockImplementation(() => {})
  const loading = createLoadingProgressLedger(['gpu:programs'], vi.fn())
  const diagnostics = createGalleryLoadingDiagnostics(
    'thawing-song',
    loading,
    () => Infinity,
  )
  loading.complete('gpu:programs')
  diagnostics.stage('ready')
  diagnostics.report('ready')
  diagnostics.report('ready')
  diagnostics.report('failure')
  diagnostics.report('failure')
  expect(info).toHaveBeenCalledTimes(2)
  expect(info.mock.calls[0]?.[1]).toMatchObject({
    outcome: 'ready',
    substage: 'ready',
    elapsedMs: 0,
    stageElapsedMs: 0,
    completedUnits: 1,
    pendingCount: 0,
    pendingUnitIds: [],
  })
  expect(info.mock.calls[1]?.[1]).toMatchObject({ outcome: 'failure' })
  info.mockRestore()
})

it('distinguishes an environment-only wait while preserving concurrent pending IDs', () => {
  vi.stubEnv('VITE_PORTABLE_CONSOLE', 'true')
  const info = vi.spyOn(console, 'info').mockImplementation(() => {})
  const loading = createLoadingProgressLedger(
    ['bundle:garden', 'environment:sky', 'gpu:programs'],
    vi.fn(),
  )
  const diagnostics = createGalleryLoadingDiagnostics('garden', loading)
  diagnostics.stage('assets')
  diagnostics.progress()
  loading.complete('bundle:garden')
  diagnostics.progress()
  diagnostics.report('failure')
  expect(info.mock.calls[0]?.[1]).toMatchObject({
    substage: 'environment',
    pendingUnitIds: ['environment:sky', 'gpu:programs'],
  })
  info.mockRestore()
})
