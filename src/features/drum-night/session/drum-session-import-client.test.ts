// Drum session Worker client tests — one-shot lifecycle and hard cancellation.

import { afterEach, describe, expect, it, vi } from 'vitest'
import { importDrumSessionInWorker } from './drum-session-import-client'
import type { DrumSessionParserOutcome } from './import-drum-session'

function parsedOutcome(): DrumSessionParserOutcome {
  return {
    status: 'parsed',
    song: {
      bpm: 120,
      tempoChanges: [],
      timeSignatures: [],
      tracks: [
        {
          id: 'drums',
          kind: 'percussion',
          name: 'Drums',
          instrumentName: 'General MIDI Drum Kit',
          noteCount: 1,
          notes: [],
          percussionHits: [
            {
              id: 'hit-1',
              gmKey: 38,
              startBeat: 0,
              velocity: 100,
            },
          ],
          droppedHitCount: 0,
        },
      ],
    },
  }
}

class FakeWorker {
  onmessage: ((event: MessageEvent<unknown>) => void) | null = null
  onerror: ((event: ErrorEvent) => void) | null = null
  onmessageerror: ((event: MessageEvent<unknown>) => void) | null = null
  readonly postMessage = vi.fn()
  readonly terminate = vi.fn()

  asWorker(): Worker {
    return this as unknown as Worker
  }

  respond(data: unknown): void {
    this.onmessage?.({ data } as MessageEvent<unknown>)
  }
}

function requestId(worker: FakeWorker): string {
  const request = worker.postMessage.mock.calls[0]?.[0] as
    | { requestId?: unknown }
    | undefined
  if (typeof request?.requestId !== 'string') {
    throw new Error('The import client did not post a typed request.')
  }
  return request.requestId
}

afterEach(() => {
  vi.useRealTimers()
})

describe('importDrumSessionInWorker', () => {
  it('posts the File lazily, ignores stale replies, and terminates on success', async () => {
    const worker = new FakeWorker()
    const factory = vi.fn(() => worker.asWorker())
    const file = new File([new Uint8Array(42)], 'pocket.mid')

    expect(factory).not.toHaveBeenCalled()
    const importing = importDrumSessionInWorker(file, 'midi', {
      workerFactory: factory,
    })

    expect(factory).toHaveBeenCalledOnce()
    expect(worker.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'IMPORT_DRUM_SESSION',
        file,
        format: 'midi',
      }),
    )
    worker.respond({
      type: 'DRUM_SESSION_IMPORTED',
      requestId: 'stale-request',
      outcome: parsedOutcome(),
    })
    expect(worker.terminate).not.toHaveBeenCalled()

    const outcome = parsedOutcome()
    worker.respond({
      type: 'DRUM_SESSION_IMPORTED',
      requestId: requestId(worker),
      outcome,
    })

    await expect(importing).resolves.toBe(outcome)
    expect(worker.terminate).toHaveBeenCalledOnce()
  })

  it('preserves a recoverable complexity failure and terminates', async () => {
    const worker = new FakeWorker()
    const importing = importDrumSessionInWorker(
      new File([new Uint8Array(1)], 'dense.gpx'),
      'guitar-pro',
      { workerFactory: () => worker.asWorker() },
    )
    worker.respond({
      type: 'DRUM_SESSION_IMPORT_ERROR',
      requestId: requestId(worker),
      code: 'TOO_COMPLEX',
      message: 'Nothing was truncated. Export a shorter part and retry.',
    })

    await expect(importing).rejects.toMatchObject({
      name: 'DrumSessionImportError',
      code: 'TOO_COMPLEX',
      message: 'Nothing was truncated. Export a shorter part and retry.',
    })
    expect(worker.terminate).toHaveBeenCalledOnce()
  })

  it('does not create a Worker when already aborted and closes an active one', async () => {
    const alreadyAborted = new AbortController()
    alreadyAborted.abort()
    const unusedFactory = vi.fn(() => new FakeWorker().asWorker())
    await expect(
      importDrumSessionInWorker(
        new File([new Uint8Array(1)], 'cancelled.mid'),
        'midi',
        {
          signal: alreadyAborted.signal,
          workerFactory: unusedFactory,
        },
      ),
    ).rejects.toMatchObject({ name: 'AbortError' })
    expect(unusedFactory).not.toHaveBeenCalled()

    const worker = new FakeWorker()
    const controller = new AbortController()
    const importing = importDrumSessionInWorker(
      new File([new Uint8Array(1)], 'active.mid'),
      'midi',
      {
        signal: controller.signal,
        workerFactory: () => worker.asWorker(),
      },
    )

    controller.abort()
    await expect(importing).rejects.toMatchObject({ name: 'AbortError' })
    expect(worker.terminate).toHaveBeenCalledOnce()
  })

  it('times out and rejects malformed replies without leaking Workers', async () => {
    vi.useFakeTimers()
    const timedWorker = new FakeWorker()
    const timedImport = importDrumSessionInWorker(
      new File([new Uint8Array(1)], 'slow.mid'),
      'midi',
      {
        timeoutMs: 25,
        workerFactory: () => timedWorker.asWorker(),
      },
    )
    const timedExpectation = expect(timedImport).rejects.toMatchObject({
      name: 'DrumSessionImportError',
      code: 'TIMED_OUT',
    })
    await vi.advanceTimersByTimeAsync(25)
    await timedExpectation
    expect(timedWorker.terminate).toHaveBeenCalledOnce()

    const malformedWorker = new FakeWorker()
    const malformedImport = importDrumSessionInWorker(
      new File([new Uint8Array(1)], 'broken.mid'),
      'midi',
      { workerFactory: () => malformedWorker.asWorker() },
    )
    malformedWorker.respond({
      type: 'DRUM_SESSION_IMPORTED',
      requestId: requestId(malformedWorker),
      outcome: { status: 'parsed', song: null },
    })

    await expect(malformedImport).rejects.toMatchObject({
      name: 'DrumSessionImportError',
      code: 'WORKER_FAILED',
    })
    expect(malformedWorker.terminate).toHaveBeenCalledOnce()
  })
})
