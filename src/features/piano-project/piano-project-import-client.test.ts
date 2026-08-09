// ============================================================
// PianoProject import client tests — one-shot Worker lifecycle guarantees
// ============================================================

import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PianoProject } from './piano-project'
import { importPianoProject, PianoProjectImportError, } from './piano-project-import-client'

function projectFixture(): PianoProject {
  const importedAt = '2026-08-09T12:00:00.000Z'
  return {
    schemaVersion: 1,
    id: 'piano-project-client-fixture',
    name: 'Client fixture',
    createdAt: importedAt,
    updatedAt: importedAt,
    source: {
      kind: 'midi',
      fileName: 'fixture.mid',
      byteLength: 42,
      sha256: 'a'.repeat(64),
      format: 0,
      ticksPerQuarter: 480,
    },
    durationTicks: 480,
    tempoMap: [],
    timeSignatures: [],
    keySignatures: [],
    tracks: [
      {
        id: 'smf-t0-c0',
        sourceTrackIndex: 0,
        channel: 0,
        isPercussion: false,
        name: 'Piano',
        instrumentName: 'Grand Piano',
        events: [
          {
            type: 'note-on',
            sourceTrackIndex: 0,
            order: 0,
            tick: 0,
            channel: 0,
            note: 60,
            velocity: 96,
          },
          {
            type: 'note-off',
            sourceTrackIndex: 0,
            order: 1,
            tick: 480,
            channel: 0,
            note: 60,
            velocity: 32,
          },
        ],
      },
    ],
    scoreTrackId: 'smf-t0-c0',
    backingTrackIds: [],
    metaEvents: [],
    systemEvents: [],
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

describe('importPianoProject', () => {
  it('creates lazily, validates a success response, and terminates', async () => {
    const worker = new FakeWorker()
    const factory = vi.fn(() => worker.asWorker())
    const file = new File([new Uint8Array(42)], 'fixture.mid')

    expect(factory).not.toHaveBeenCalled()
    const importing = importPianoProject(file, { workerFactory: factory })
    expect(factory).toHaveBeenCalledOnce()
    expect(worker.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'IMPORT_PIANO_PROJECT', file }),
    )

    const project = projectFixture()
    worker.respond({
      type: 'PIANO_PROJECT_IMPORTED',
      requestId: 'stale-request',
      project,
    })
    expect(worker.terminate).not.toHaveBeenCalled()
    worker.respond({
      type: 'PIANO_PROJECT_IMPORTED',
      requestId: requestId(worker),
      project,
    })

    await expect(importing).resolves.toBe(project)
    expect(worker.terminate).toHaveBeenCalledOnce()
  })

  it('preserves typed Worker failures and terminates', async () => {
    const worker = new FakeWorker()
    const importing = importPianoProject(new File([], 'drums.mid'), {
      workerFactory: () => worker.asWorker(),
    })
    worker.respond({
      type: 'PIANO_PROJECT_IMPORT_ERROR',
      requestId: requestId(worker),
      code: 'NO_NOTES',
      message: 'No pitched playable notes were found.',
    })

    await expect(importing).rejects.toMatchObject({
      name: 'PianoProjectImportError',
      code: 'NO_NOTES',
    })
    expect(worker.terminate).toHaveBeenCalledOnce()
  })

  it('settles when abort happens inside the Worker factory race window', async () => {
    const alreadyAborted = new AbortController()
    alreadyAborted.abort()
    const unusedFactory = vi.fn(() => new FakeWorker().asWorker())
    await expect(
      importPianoProject(new File([], 'already-cancelled.mid'), {
        signal: alreadyAborted.signal,
        workerFactory: unusedFactory,
      }),
    ).rejects.toMatchObject({ name: 'AbortError' })
    expect(unusedFactory).not.toHaveBeenCalled()

    const worker = new FakeWorker()
    const controller = new AbortController()
    const importing = importPianoProject(new File([], 'cancelled.mid'), {
      signal: controller.signal,
      workerFactory: () => {
        controller.abort()
        return worker.asWorker()
      },
    })

    await expect(importing).rejects.toMatchObject({ name: 'AbortError' })
    expect(worker.postMessage).not.toHaveBeenCalled()
    expect(worker.terminate).toHaveBeenCalledOnce()
  })

  it('times out and rejects malformed success payloads without leaking Workers', async () => {
    vi.useFakeTimers()
    const timedWorker = new FakeWorker()
    const timedImport = importPianoProject(new File([], 'slow.mid'), {
      timeoutMs: 25,
      workerFactory: () => timedWorker.asWorker(),
    })
    const timedExpectation = expect(timedImport).rejects.toMatchObject({
      name: 'PianoProjectImportError',
      code: 'TIMED_OUT',
    })
    await vi.advanceTimersByTimeAsync(25)
    await timedExpectation
    expect(timedWorker.terminate).toHaveBeenCalledOnce()

    const malformedWorker = new FakeWorker()
    const malformedImport = importPianoProject(new File([], 'broken.mid'), {
      workerFactory: () => malformedWorker.asWorker(),
    })
    malformedWorker.respond({
      type: 'PIANO_PROJECT_IMPORTED',
      requestId: requestId(malformedWorker),
      project: { schemaVersion: 999 },
    })
    await expect(malformedImport).rejects.toBeInstanceOf(
      PianoProjectImportError,
    )
    await expect(malformedImport).rejects.toMatchObject({
      code: 'IMPORT_FAILED',
    })
    expect(malformedWorker.terminate).toHaveBeenCalledOnce()
  })
})
