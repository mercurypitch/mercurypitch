// Renderer diagnostics keep causal errors and never serialize arbitrary rejection payloads.

import { afterEach, expect, it, vi } from 'vitest'
import { reportRendererFailure } from './renderer-failure'

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
