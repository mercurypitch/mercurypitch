// Renderer diagnostics keep causal errors and never serialize arbitrary rejection payloads.

import { afterEach, expect, it, vi } from 'vitest'
import type { GlassRenderer } from '../render/glass-renderer'
import type { AdventureLoadingPhase } from './loading-lifecycle'
import { createRendererFailureController, reportRendererFailure, } from './renderer-failure'

afterEach(() => vi.restoreAllMocks())

const context = {
  attempt: 2,
  phase: 'awaiting-first-frame',
  stage: 'frame',
  preference: 'auto',
  renderProfile: 'balanced',
  assetProfile: 'mobile',
} as const

it('retains a frame failure cause with the selected asset profile and a bounded summary', () => {
  const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)
  const cause = new Error('x'.repeat(500))
  reportRendererFailure(context, cause)
  expect(log).toHaveBeenCalledOnce()
  const [, summary, diagnostic] = log.mock.calls[0]!
  expect(summary).toEqual({
    ...context,
    errorName: 'Error',
    errorMessage: 'x'.repeat(240),
  })
  expect(diagnostic).toBeInstanceOf(Error)
  expect((diagnostic as Error).cause).toBe(cause)
})

it('does not inspect or dump an arbitrary rejected object', () => {
  const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)
  const payload = {
    get message(): string {
      throw new Error('Do not inspect payloads')
    },
  }
  reportRendererFailure(context, payload)
  const [, summary, diagnostic] = log.mock.calls[0]!
  expect(summary).toMatchObject({
    errorName: 'UnknownError',
    errorMessage: 'No error detail supplied',
  })
  expect((diagnostic as Error).cause).toBeUndefined()
})

it('captures the active phase before accepting and disposing a renderer failure', () => {
  const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)
  let phase: AdventureLoadingPhase = context.phase
  const dispose = vi.fn()
  const renderer = {
    dispose,
    getRenderQuality: () => ({
      profile: 'balanced',
      assetProfile: 'mobile',
    }),
  } as unknown as GlassRenderer
  const clearCurrentRenderer = vi.fn()
  const clearPresentation = vi.fn()
  const pauseSoundscape = vi.fn()
  const cancelInteraction = vi.fn()
  const pauseGame = vi.fn()
  const refresh = vi.fn()
  const fail = vi.fn(() => {
    phase = 'error'
    return true
  })
  const failRenderer = createRendererFailureController({
    loading: { state: () => ({ phase }), fail },
    preference: () => 'auto',
    currentRenderer: () => renderer,
    clearCurrentRenderer,
    clearPresentation,
    pauseSoundscape,
    cancelInteraction,
    pauseGame,
    refresh,
  })

  expect(
    failRenderer({
      generation: 3,
      message: 'graphics failed',
      renderer,
      stage: 'frame',
      cause: new Error('GPU upload failed'),
    }),
  ).toBe(true)
  expect(fail).toHaveBeenCalledWith(3, 'graphics failed')
  expect(log.mock.calls[0]?.[1]).toMatchObject({
    attempt: 3,
    phase: 'awaiting-first-frame',
    stage: 'frame',
  })
  expect(clearCurrentRenderer).toHaveBeenCalledOnce()
  expect(clearPresentation).toHaveBeenCalledOnce()
  expect(pauseSoundscape).toHaveBeenCalledOnce()
  expect(cancelInteraction).toHaveBeenCalledOnce()
  expect(pauseGame).toHaveBeenCalledOnce()
  expect(refresh).toHaveBeenCalledOnce()
  expect(dispose).toHaveBeenCalledOnce()
})

it('ignores stale renderer failures without diagnostics or cleanup', () => {
  const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)
  const dispose = vi.fn()
  const renderer = { dispose } as unknown as GlassRenderer
  const currentRenderer = vi.fn(() => renderer)
  const preference = vi.fn(() => 'auto' as const)
  const sideEffect = vi.fn()
  const failRenderer = createRendererFailureController({
    loading: {
      state: () => ({ phase: 'ready' }),
      fail: () => false,
    },
    preference,
    currentRenderer,
    clearCurrentRenderer: sideEffect,
    clearPresentation: sideEffect,
    pauseSoundscape: sideEffect,
    cancelInteraction: sideEffect,
    pauseGame: sideEffect,
    refresh: sideEffect,
  })

  expect(
    failRenderer({
      generation: 1,
      message: 'stale failure',
      renderer,
      stage: 'asset-load',
      cause: new Error('late rejection'),
    }),
  ).toBe(false)
  expect(log).not.toHaveBeenCalled()
  expect(preference).not.toHaveBeenCalled()
  expect(currentRenderer).not.toHaveBeenCalled()
  expect(sideEffect).not.toHaveBeenCalled()
  expect(dispose).not.toHaveBeenCalled()
})
