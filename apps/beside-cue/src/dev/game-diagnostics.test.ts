// Device graphics reports distinguish intentional renderer teardown from a live scene failure.
import { registerGraphicsCanvas, retireGraphicsCanvas, updateGraphicsCanvasSnapshot, } from '@irchiinnuss/glass-game/graphics-diagnostics'
import { afterEach, expect, it, vi } from 'vitest'
import { setupGameDiagnostics } from './game-diagnostics'

vi.mock('../../../../src/components/PortableConsole', () => ({
  setupPortableConsole: vi.fn(),
}))
vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => true, getPlatform: () => 'ios' },
}))

afterEach(() => vi.restoreAllMocks())

it('labels delayed loader teardown without hiding loss or restoration on the active museum', () => {
  const info = vi.spyOn(console, 'info').mockImplementation(() => {})
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext')
  const loading = document.createElement('canvas')
  const museum = document.createElement('canvas')
  document.body.append(loading, museum)
  try {
    setupGameDiagnostics()
    registerGraphicsCanvas(loading, 'loading-merc')
    registerGraphicsCanvas(museum, 'museum-map')
    updateGraphicsCanvasSnapshot(loading, {
      assetProfile: 'mobile',
      drawCalls: 4,
      textures: 2,
    })
    const snapshot = {
      selectedStageId: 'conservatory',
      assetProfile: 'mobile' as const,
      drawCalls: 87,
      triangles: 180_000,
      textures: 36,
      geometries: 42,
      estimatedTextureBytes: 179_306_496,
      url: 'private asset URL',
    }
    updateGraphicsCanvasSnapshot(museum, snapshot)
    snapshot.drawCalls = 0
    retireGraphicsCanvas(loading)
    updateGraphicsCanvasSnapshot(loading, { textures: 0 })
    loading.dispatchEvent(new Event('webglcontextlost'))
    expect(warn).not.toHaveBeenCalled()
    expect(info).toHaveBeenLastCalledWith(
      '[Glassworks graphics lifecycle]',
      expect.objectContaining({
        event: 'webglcontextlost',
        scene: 'loading-merc',
        lifecycle: 'disposed',
        instance: expect.any(Number),
        assetProfile: 'mobile',
        drawCalls: 4,
        textures: 2,
      }),
    )
    museum.dispatchEvent(new Event('webglcontextlost'))
    expect(warn).toHaveBeenLastCalledWith(
      '[Glassworks graphics lifecycle]',
      expect.objectContaining({
        event: 'webglcontextlost',
        scene: 'museum-map',
        lifecycle: 'active',
        instance: expect.any(Number),
        selectedStageId: 'conservatory',
        assetProfile: 'mobile',
        drawCalls: 87,
        triangles: 180_000,
        textures: 36,
        geometries: 42,
        estimatedTextureBytes: 179_306_496,
      }),
    )
    museum.dispatchEvent(new Event('webglcontextrestored'))
    expect(warn).toHaveBeenLastCalledWith(
      '[Glassworks graphics lifecycle]',
      expect.objectContaining({
        event: 'webglcontextrestored',
        scene: 'museum-map',
        lifecycle: 'active',
        selectedStageId: 'conservatory',
        drawCalls: 87,
      }),
    )
    const restoredReport = warn.mock.lastCall?.[1]
    expect(restoredReport).not.toHaveProperty('snapshot')
    expect(restoredReport).not.toHaveProperty('url')
    retireGraphicsCanvas(museum)
    museum.dispatchEvent(new Event('webglcontextlost'))
    expect(info).toHaveBeenLastCalledWith(
      '[Glassworks graphics lifecycle]',
      expect.objectContaining({
        event: 'webglcontextlost',
        scene: 'museum-map',
        lifecycle: 'disposed',
        selectedStageId: 'conservatory',
        drawCalls: 87,
        estimatedTextureBytes: 179_306_496,
      }),
    )
    const unknown = document.createElement('canvas')
    document.body.append(unknown)
    unknown.dispatchEvent(new Event('webglcontextlost'))
    unknown.remove()
    expect(warn).toHaveBeenLastCalledWith(
      '[Glassworks graphics lifecycle]',
      expect.objectContaining({
        event: 'webglcontextlost',
        scene: 'unknown',
        lifecycle: 'unknown',
      }),
    )
    expect(getContext).not.toHaveBeenCalled()
  } finally {
    loading.remove()
    museum.remove()
  }
})
