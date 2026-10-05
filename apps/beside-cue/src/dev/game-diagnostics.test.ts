// Device graphics reports distinguish intentional renderer teardown from a live scene failure.
import { registerGraphicsCanvas, retireGraphicsCanvas, } from '@irchiinnuss/glass-game/graphics-diagnostics'
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
  const loading = document.createElement('canvas')
  const museum = document.createElement('canvas')
  document.body.append(loading, museum)
  try {
    setupGameDiagnostics()
    registerGraphicsCanvas(loading, 'loading-merc')
    registerGraphicsCanvas(museum, 'museum-map')
    retireGraphicsCanvas(loading)
    loading.dispatchEvent(new Event('webglcontextlost'))
    expect(warn).not.toHaveBeenCalled()
    expect(info).toHaveBeenLastCalledWith(
      '[Glassworks graphics lifecycle]',
      expect.objectContaining({
        event: 'webglcontextlost',
        scene: 'loading-merc',
        lifecycle: 'disposed',
        instance: expect.any(Number),
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
      }),
    )
    museum.dispatchEvent(new Event('webglcontextrestored'))
    expect(warn).toHaveBeenLastCalledWith(
      '[Glassworks graphics lifecycle]',
      expect.objectContaining({
        event: 'webglcontextrestored',
        scene: 'museum-map',
        lifecycle: 'active',
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
  } finally {
    loading.remove()
    museum.remove()
  }
})
