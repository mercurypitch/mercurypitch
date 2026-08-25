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

  /**
   * The bug: "Separate guitar" checked nothing. Pressed with no account it
   * started a split, uploaded a ~60-190 MB instrumental into a 401, and --
   * because `fetch` cannot report upload progress -- sat on "Sending the
   * instrumental · 0%" for ever. The phase only advances when the request
   * resolves, so there was no error and no way back.
   *
   * So the property is not "a nicer message". It is that no billable work
   * starts at all: the port must never be loaded, let alone called.
   */
  describe('prerequisites', () => {
    const blocker = {
      reason: 'signed-out' as const,
      message: 'Separating the band needs an account.',
      cta: { label: 'Sign in', section: 'account' as const },
    }

    it('reopens durable parts without account preflight or cloud preparation', async () => {
      const reusePreparedBand = vi.fn(async () => ({
        saved: ['drums', 'bass', 'guitar'],
      }))
      const prepareBand = vi.fn<GuitarNightBandPreparationPort['prepareBand']>()
      const checkPreflight = vi.fn(() => blocker)
      const onPrepared = vi.fn(async () => undefined)
      let controller!: ReturnType<
        typeof useGuitarNightBandPreparationController
      >
      const Harness: Component = () => {
        controller = useGuitarNightBandPreparationController({
          loadPort: async () => ({ reusePreparedBand, prepareBand }),
          checkPreflight,
          onPrepared,
        })
        return null
      }
      render(() => <Harness />)

      controller.start('session-room')
      await waitFor(() => expect(onPrepared).toHaveBeenCalledOnce())

      expect(reusePreparedBand).toHaveBeenCalledWith('session-room', {
        signal: expect.any(AbortSignal),
      })
      expect(checkPreflight).not.toHaveBeenCalled()
      expect(prepareBand).not.toHaveBeenCalled()
      expect(controller.state()).toEqual({ kind: 'idle' })
    })

    it('starts no billable work when the prerequisites are not met', async () => {
      const prepareBand = vi.fn<GuitarNightBandPreparationPort['prepareBand']>()
      const reusePreparedBand = vi.fn(async () => null)
      const loadPort = vi.fn(async () => ({ reusePreparedBand, prepareBand }))
      let controller!: ReturnType<
        typeof useGuitarNightBandPreparationController
      >
      const Harness: Component = () => {
        controller = useGuitarNightBandPreparationController({
          loadPort,
          checkPreflight: () => blocker,
        })
        return null
      }
      render(() => <Harness />)

      controller.start('session-room')
      await waitFor(() =>
        expect(controller.state()).toEqual({
          kind: 'blocked',
          sessionId: 'session-room',
          blocker,
        }),
      )
      expect(reusePreparedBand).toHaveBeenCalledWith('session-room', {
        signal: expect.any(AbortSignal),
      })
      expect(prepareBand).not.toHaveBeenCalled()
      // The port is opened only to look for durable local output. Its cloud
      // implementation remains behind prepareBand, which cannot run here.
      expect(loadPort).toHaveBeenCalledOnce()
    })

    it('waits for an async answer before deciding', async () => {
      // On a standalone page the account state is lazy. Answering from data
      // that has not loaded would refuse a signed-in singer, so the check
      // may be async -- and a slow answer must not start the job meanwhile.
      const prepareBand = vi.fn<GuitarNightBandPreparationPort['prepareBand']>()
      prepareBand.mockResolvedValue({ saved: ['drums'] })
      const gate = deferred<typeof blocker | null>()
      let controller!: ReturnType<
        typeof useGuitarNightBandPreparationController
      >
      const Harness: Component = () => {
        controller = useGuitarNightBandPreparationController({
          loadPort: async () => ({ prepareBand }),
          checkPreflight: () => gate.promise,
        })
        return null
      }
      render(() => <Harness />)

      controller.start('session-room')
      expect(prepareBand).not.toHaveBeenCalled()
      gate.resolve(blocker)
      await waitFor(() =>
        expect(controller.state()).toMatchObject({ kind: 'blocked' }),
      )
      expect(prepareBand).not.toHaveBeenCalled()
    })

    it('proceeds normally once the prerequisites are met', async () => {
      const prepareBand = vi.fn<GuitarNightBandPreparationPort['prepareBand']>()
      prepareBand.mockResolvedValue({ saved: ['drums', 'bass', 'guitar'] })
      let controller!: ReturnType<
        typeof useGuitarNightBandPreparationController
      >
      const Harness: Component = () => {
        controller = useGuitarNightBandPreparationController({
          loadPort: async () => ({ prepareBand }),
          checkPreflight: () => null,
        })
        return null
      }
      render(() => <Harness />)

      controller.start('session-room')
      await waitFor(() => expect(prepareBand).toHaveBeenCalledOnce())
      expect(controller.state()).toEqual({ kind: 'idle' })
    })

    it('runs unchanged with no preflight configured', async () => {
      // The option is optional: every existing caller and fake must keep
      // working without one.
      const prepareBand = vi.fn<GuitarNightBandPreparationPort['prepareBand']>()
      prepareBand.mockResolvedValue({ saved: ['drums'] })
      let controller!: ReturnType<
        typeof useGuitarNightBandPreparationController
      >
      const Harness: Component = () => {
        controller = useGuitarNightBandPreparationController({
          loadPort: async () => ({ prepareBand }),
        })
        return null
      }
      render(() => <Harness />)

      controller.start('session-room')
      await waitFor(() => expect(prepareBand).toHaveBeenCalledOnce())
    })

    it('lets a retry through after the singer fixes it', async () => {
      // Blocked is not terminal: they open Account, sign in, come back.
      const prepareBand = vi.fn<GuitarNightBandPreparationPort['prepareBand']>()
      prepareBand.mockResolvedValue({ saved: ['drums'] })
      let blocked = true
      let controller!: ReturnType<
        typeof useGuitarNightBandPreparationController
      >
      const Harness: Component = () => {
        controller = useGuitarNightBandPreparationController({
          loadPort: async () => ({ prepareBand }),
          checkPreflight: () => (blocked ? blocker : null),
        })
        return null
      }
      render(() => <Harness />)

      controller.start('session-room')
      await waitFor(() =>
        expect(controller.state()).toMatchObject({ kind: 'blocked' }),
      )

      blocked = false
      controller.start('session-room')
      await waitFor(() => expect(prepareBand).toHaveBeenCalledOnce())
      expect(controller.state()).toEqual({ kind: 'idle' })
    })
  })
})
