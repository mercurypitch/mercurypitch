// ============================================================
// Guitar Night preparation-controller tests protect cancellation, retry, and stale completion rejection
// ============================================================

import { cleanup, render, waitFor } from '@solidjs/testing-library'
import type { Component } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { GuitarNightPreparationPort, GuitarNightPreparationResult, } from './preparation-port'
import { useGuitarNightPreparationController } from './useGuitarNightPreparationController'

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

function songFile(): File {
  return new File(['audio'], 'room.wav', { type: 'audio/wav' })
}

describe('useGuitarNightPreparationController', () => {
  afterEach(() => cleanup())

  it('forwards progress and opens a completed or reused session', async () => {
    const onPrepared = vi.fn(async () => undefined)
    const prepare = vi.fn(async (_file: File, options) => {
      options.onUpdate({ phase: 'separating', progress: 38 })
      return {
        status: 'existing' as const,
        sessionId: 'session-room',
      }
    })
    const port: GuitarNightPreparationPort = { prepare }
    let controller!: ReturnType<typeof useGuitarNightPreparationController>
    const Harness: Component = () => {
      controller = useGuitarNightPreparationController({
        loadPreparationPort: async () => port,
        onPrepared,
      })
      return null
    }
    render(() => <Harness />)

    expect(controller.start(songFile())).toBe(true)
    await waitFor(() =>
      expect(onPrepared).toHaveBeenCalledWith(
        'session-room',
        expect.any(AbortSignal),
      ),
    )
    expect(controller.state()).toEqual({ kind: 'idle' })
  })

  it('aborts on cancel and ignores a late completion', async () => {
    const pending = deferred<GuitarNightPreparationResult>()
    let signal: AbortSignal | null = null
    const port: GuitarNightPreparationPort = {
      prepare: vi.fn((_file, options) => {
        signal = options.signal
        return pending.promise
      }),
    }
    const onPrepared = vi.fn()
    let controller!: ReturnType<typeof useGuitarNightPreparationController>
    const Harness: Component = () => {
      controller = useGuitarNightPreparationController({
        loadPreparationPort: async () => port,
        onPrepared,
      })
      return null
    }
    render(() => <Harness />)
    const file = songFile()
    controller.start(file)
    await waitFor(() => expect(signal).not.toBeNull())

    controller.cancel()
    expect((signal as AbortSignal | null)?.aborted).toBe(true)
    expect(controller.state()).toEqual({ kind: 'cancelled', file })

    pending.resolve({ status: 'completed', sessionId: 'late-session' })
    await Promise.resolve()
    expect(onPrepared).not.toHaveBeenCalled()
    expect(controller.state()).toEqual({ kind: 'cancelled', file })
  })

  it('retries the same retained file after a recoverable error', async () => {
    const file = songFile()
    const prepare = vi
      .fn<GuitarNightPreparationPort['prepare']>()
      .mockResolvedValueOnce({
        status: 'error',
        message: 'The decoder could not read this song.',
      })
      .mockResolvedValueOnce({
        status: 'completed',
        sessionId: 'session-retry',
      })
    const onPrepared = vi.fn()
    let controller!: ReturnType<typeof useGuitarNightPreparationController>
    const Harness: Component = () => {
      controller = useGuitarNightPreparationController({
        loadPreparationPort: async () => ({ prepare }),
        onPrepared,
      })
      return null
    }
    render(() => <Harness />)

    controller.start(file)
    await waitFor(() =>
      expect(controller.state()).toMatchObject({
        kind: 'error',
        retryable: true,
      }),
    )
    controller.retry()
    await waitFor(() =>
      expect(onPrepared).toHaveBeenCalledWith(
        'session-retry',
        expect.any(AbortSignal),
      ),
    )

    expect(prepare).toHaveBeenCalledTimes(2)
    expect(prepare.mock.calls[0][0]).toBe(file)
    expect(prepare.mock.calls[1][0]).toBe(file)
  })

  it('keeps cancellation active through the final room handoff', async () => {
    const handoff = deferred<undefined>()
    let handoffSignal: AbortSignal | null = null
    const file = songFile()
    const port: GuitarNightPreparationPort = {
      prepare: vi.fn(async () => ({
        status: 'completed' as const,
        sessionId: 'session-handoff',
      })),
    }
    let controller!: ReturnType<typeof useGuitarNightPreparationController>
    const Harness: Component = () => {
      controller = useGuitarNightPreparationController({
        loadPreparationPort: async () => port,
        onPrepared: (_sessionId, signal) => {
          handoffSignal = signal
          return handoff.promise
        },
      })
      return null
    }
    render(() => <Harness />)

    controller.start(file)
    await waitFor(() =>
      expect(controller.state()).toMatchObject({
        kind: 'preparing',
        phase: 'opening-song',
      }),
    )
    controller.cancel()

    expect((handoffSignal as AbortSignal | null)?.aborted).toBe(true)
    expect(controller.state()).toEqual({ kind: 'cancelled', file })
    handoff.resolve(undefined)
    await Promise.resolve()
    expect(controller.state()).toEqual({ kind: 'cancelled', file })
  })

  it('aborts its active run when the room unmounts', async () => {
    const pending = deferred<GuitarNightPreparationResult>()
    let signal: AbortSignal | null = null
    const port: GuitarNightPreparationPort = {
      prepare: vi.fn((_file, options) => {
        signal = options.signal
        return pending.promise
      }),
    }
    let controller!: ReturnType<typeof useGuitarNightPreparationController>
    const Harness: Component = () => {
      controller = useGuitarNightPreparationController({
        loadPreparationPort: async () => port,
      })
      return null
    }
    render(() => <Harness />)
    controller.start(songFile())
    await waitFor(() => expect(signal).not.toBeNull())

    cleanup()

    expect((signal as AbortSignal | null)?.aborted).toBe(true)
  })
})
