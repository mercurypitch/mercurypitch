// Journey scene construction — partial WebGL ownership rolls back without hiding setup failures.

import type * as ThreeTypes from 'three'
import { expect, it, vi } from 'vitest'
import type { MuseumJourneyDefinition } from '../content/museum-journey'

const state = vi.hoisted(() => ({
  setupFailure: new Error('initial reflection failed'),
  cleanupFailure: new Error('renderer cleanup failed'),
  rendererDispose: vi.fn(),
  forceContextLoss: vi.fn(),
  canvasRemove: vi.fn(),
  skyDispose: vi.fn(),
}))

vi.mock('three', async (original) => ({
  ...(await original<typeof ThreeTypes>()),
  WebGLRenderer: class {
    domElement = {
      style: { cssText: '' },
      setAttribute: vi.fn(),
      remove: state.canvasRemove,
    }
    info = { autoReset: true }
    shadowMap = { enabled: false }
    setPixelRatio = vi.fn()
    dispose = state.rendererDispose
    forceContextLoss = state.forceContextLoss
  },
}))

vi.mock('./sky', async () => {
  const { Group, Texture } = await vi.importActual<typeof ThreeTypes>('three')
  return {
    createJourneySky: () => ({
      root: new Group(),
      background: new Texture(),
      resize: vi.fn(),
      update: vi.fn(),
      dispose: state.skyDispose,
    }),
  }
})

vi.mock('../render/environment', () => ({
  createMuseumEnvironment: () => {
    throw state.setupFailure
  },
}))

import { createMuseumJourneyScene } from './scene'

const DEFINITION: MuseumJourneyDefinition = {
  id: 'construction-test',
  modelAssetId: 'map',
  landmasses: [
    {
      id: 'island',
      position: [0, 0, 0],
      yaw: 0,
      scale: [1, 1, 1],
      terraceScale: [1, 1, 1],
    },
  ],
  stages: [
    {
      id: 'stage',
      chapterIds: ['chapter'],
      islandId: 'island',
      position: [0, 0, 0],
      architecturePosition: [0, 0, 0],
      yaw: 0,
      scale: 1,
      focus: [0, 0, 0],
      merc: [0, 0, 0],
      kind: 'pavilion',
      accent: 'jade',
    },
  ],
  bridges: [],
  spillways: [],
}

it('retires acquired owners and preserves the original construction failure', () => {
  state.rendererDispose.mockImplementationOnce(() => {
    throw state.cleanupFailure
  })
  const append = vi.fn()
  vi.stubGlobal('window', {
    devicePixelRatio: 1,
    matchMedia: () => ({ matches: false }),
  })

  let thrown: unknown
  try {
    createMuseumJourneyScene(
      { append } as unknown as HTMLElement,
      DEFINITION,
      (id) => id,
      {
        selectedStageId: 'stage',
        foreground: true,
        reducedMotion: false,
        onSelect: vi.fn(),
        onFailure: vi.fn(),
      },
    )
  } catch (error) {
    thrown = error
  } finally {
    vi.unstubAllGlobals()
  }

  expect(thrown).toBe(state.setupFailure)
  expect(state.skyDispose).toHaveBeenCalledOnce()
  expect(state.rendererDispose).toHaveBeenCalledOnce()
  expect(state.forceContextLoss).toHaveBeenCalledOnce()
  expect(state.canvasRemove).toHaveBeenCalledOnce()
  expect(append).not.toHaveBeenCalled()
})
