// Guitar Night band-controller tests protect progress, cancellation, and exact-session restaging.
// ============================================================

import { cleanup, render, waitFor } from '@solidjs/testing-library'
import type { Component } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { GuitarNightBandPreparationPort, GuitarNightBandPreparationResult, } from './band-preparation-port'
import { useGuitarNightBandPreparationController } from './useGuitarNightBandPreparationController'

function deferred<T>(): {
  promise: Promise<T>
  resolve(value: T): void
} {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((settle) => {
    resolve = settle
  })
  return { promise, resolve }
}

describe('useGuitarNightBandPreparationController', () => {
  afterEach(() => cleanup())

  it('forwards named progress and restages the exact completed session', async () => {
    const onPrepared = vi.fn(async () => undefined)
    const prepareBand = vi.fn(async (_sessionId: string, options) => {
      options.onUpdate({ phase: 'processing', progress: 42 })
      return { saved: ['drums', 'bass', 'guitar'] }
    })
    let controller!: ReturnType<typeof useGuitarNightBandPreparationController>
    const Harness: Component = () => {
      controller = useGuitarNightBandPreparationController({
        loadPort: async () => ({ prepareBand }),
        onPrepared,
      })
      return null
    }
    render(() => <Harness />)

    controller.start('session-room')
    await waitFor(() =>
      expect(onPrepared).toHaveBeenCalledWith(
        'session-room',
        expect.any(AbortSignal),
      ),
    )
    expect(controller.state()).toEqual({ kind: 'idle' })
  })

  it('aborts an active split and ignores its late result', async () => {
    const pending = deferred<GuitarNightBandPreparationResult>()
    let signal: AbortSignal | null = null
    const port: GuitarNightBandPreparationPort = {
      prepareBand: vi.fn((_sessionId, options) => {
        signal = options.signal
        return pending.promise
      }),
    }
    const onPrepared = vi.fn()
    let controller!: ReturnType<typeof useGuitarNightBandPreparationController>
    const Harness: Component = () => {
      controller = useGuitarNightBandPreparationController({
        loadPort: async () => port,
        onPrepared,
      })
      return null
    }
    render(() => <Harness />)

    controller.start('session-room')
    await waitFor(() => expect(signal).not.toBeNull())
    controller.cancel()

    expect((signal as AbortSignal | null)?.aborted).toBe(true)
    expect(controller.state()).toEqual({ kind: 'idle' })
    pending.resolve({ saved: ['drums'] })
    await Promise.resolve()
    expect(onPrepared).not.toHaveBeenCalled()
  })

  it('keeps the original mix available when the split fails', async () => {
    const prepareBand = vi.fn<GuitarNightBandPreparationPort['prepareBand']>()
    prepareBand.mockRejectedValue(new Error('No separation credit available.'))
    let controller!: ReturnType<typeof useGuitarNightBandPreparationController>
    const Harness: Component = () => {
      controller = useGuitarNightBandPreparationController({
        loadPort: async () => ({ prepareBand }),
      })
      return null
    }
    render(() => <Harness />)

    controller.start('session-room')
    await waitFor(() =>
      expect(controller.state()).toEqual({
        kind: 'error',
        sessionId: 'session-room',
        message: 'No separation credit available.',
      }),
    )
  })
})
