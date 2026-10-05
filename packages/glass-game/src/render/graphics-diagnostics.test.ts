// Graphics diagnostics tests — original failures stay actionable and arbitrary payloads stay private.
import { expect, it, vi } from 'vitest'
import { reportGraphicsFailure } from './graphics-diagnostics'

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
