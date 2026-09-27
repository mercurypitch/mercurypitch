// ============================================================
// The import queue (plan S8 §6.4 to §6.6)
// ============================================================
//
// One upload at a time, the next one starting as soon as the server has
// taken the last: separations overlap on the server, sends do not. Rows
// outlive the app: a song picked is a session with its original kept, and
// one the app closed on while sending is sent again from that copy on the
// next launch, saying why. Every refusal before the server takes a song
// costs nothing; a song the studio cannot take right now waits.
//
// The pipeline and the session store are fakes with the real ones' shapes:
// what is under test is the queue's order, its words and its recoveries.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ProcessingCallbacks } from '@/lib/uvr-processing-pipeline'
import type { UvrSession } from '@/stores/uvr-store'

/** One run of the pipeline, driven by the test. */
interface FakeRun {
  readonly sessionId: string
  readonly file: File
  readonly callbacks: ProcessingCallbacks
  readonly signal: AbortSignal | undefined
  readonly onUploadProgress: ((share: number) => void) | undefined
  resolve: () => void
  reject: (error: unknown) => void
}

const fake = vi.hoisted(() => ({
  runs: [] as FakeRun[],
  resumed: [] as string[],
  originals: new Map<string, File>(),
  deletedOriginals: [] as string[],
  saveFails: false,
  setSessions: null as null | ((next: UvrSession[]) => void),
  sessions: null as null | (() => UvrSession[]),
  deleted: [] as string[],
}))

vi.mock('@/stores/uvr-store', async () => {
  const solid = await import('solid-js')
  const [sessions, setSessions] = solid.createSignal<UvrSession[]>([])
  fake.sessions = sessions
  fake.setSessions = setSessions
  let minted = 0
  const put = (next: UvrSession): void => {
    setSessions((list) =>
      list.some((s) => s.sessionId === next.sessionId)
        ? list.map((s) => (s.sessionId === next.sessionId ? next : s))
        : [...list, next],
    )
  }
  const get = (id: string): UvrSession | undefined =>
    solid.untrack(sessions).find((s) => s.sessionId === id)
  return {
    whenSessionStoreReady: async () => Promise.resolve(),
    getAllUvrSessionsReactive: () => sessions(),
    getAllUvrSessions: () => solid.untrack(sessions),
    getUvrSession: get,
    saveAllUvrSessions: (next: UvrSession[]) => setSessions(next),
    startUvrSession: (name: string, size: number, mimeType: string) => {
      minted += 1
      const sessionId = `uvr-session-${minted}`
      put({
        sessionId,
        status: 'idle',
        progress: 0,
        processingMode: 'server',
        originalFile: { name, size, mimeType },
        createdAt: minted,
      })
      return sessionId
    },
    setErrorUvrSession: (id: string, error: string) => {
      const s = get(id)
      if (s) put({ ...s, status: 'error', error })
    },
    setInterruptedUvrSession: (id: string) => {
      const s = get(id)
      if (s) put({ ...s, status: 'interrupted', error: undefined })
    },
    setUvrSessionResuming: (id: string) => {
      const s = get(id)
      if (s) {
        put({
          ...s,
          status: 'processing',
          indeterminate: true,
          phase: 'queued',
          error: undefined,
        })
      }
    },
    completeUvrSession: async (
      id: string,
      outputs: UvrSession['outputs'],
    ): Promise<boolean> => {
      const s = get(id)
      if (s) put({ ...s, status: 'completed', progress: 100, outputs })
      return Promise.resolve(true)
    },
    deleteUvrSession: async (id: string) => {
      fake.deleted.push(id)
      setSessions((list) => list.filter((s) => s.sessionId !== id))
      return Promise.resolve(true)
    },
  }
})

vi.mock('@/db/services/uvr-service', () => ({
  saveStemBlobDurable: vi.fn(async (id: string, _type: string, file: File) => {
    if (fake.saveFails) {
      return Promise.resolve({
        ok: false,
        quotaExceeded: true,
        error: new Error('quota'),
      })
    }
    fake.originals.set(id, file)
    return Promise.resolve({ ok: true, value: 'row' })
  }),
  getOriginalFileBlob: vi.fn(async (id: string) =>
    Promise.resolve(fake.originals.get(id) ?? null),
  ),
  deleteStemBlobs: vi.fn(async (id: string, type: string) => {
    if (type === 'original') fake.deletedOriginals.push(id)
    return Promise.resolve()
  }),
}))

vi.mock('@/lib/uvr-processing-pipeline', () => ({
  runUvrPipeline: vi.fn(
    async (
      file: File,
      sessionId: string,
      _mode: string,
      callbacks: ProcessingCallbacks,
      options: {
        signal?: AbortSignal
        onUploadProgress?: (share: number) => void
      } = {},
    ) =>
      new Promise<void>((resolve, reject) => {
        fake.runs.push({
          sessionId,
          file,
          callbacks,
          signal: options.signal,
          onUploadProgress: options.onUploadProgress,
          resolve,
          reject,
        })
        options.signal?.addEventListener('abort', () => {
          reject(new DOMException('The upload was stopped.', 'AbortError'))
        })
      }),
  ),
  resumeServerSession: vi.fn(async (sessionId: string) => {
    fake.resumed.push(sessionId)
    return Promise.resolve()
  }),
}))

const songsApi = vi.hoisted(() => ({ refreshes: 0 }))
vi.mock('./karaoke-songs', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  refreshKaraokeSongs: vi.fn(async () => {
    songsApi.refreshes += 1
    return Promise.resolve()
  }),
}))

import { TAB_KARAOKE, TAB_SINGING } from '@/features/tabs/constants'
import { notifications, setNotifications } from '@/stores/notifications-store'
import { activeTab, setActiveTab } from '@/stores/ui-store'
import type { ImportRow } from './karaoke-import-queue'
import { duplicateOf, enqueueImports, IMPORT_QUEUE_CAP, importRowLine, importRows, importsInFlight, KARAOKE_IMPORT_SENDING_KEY, KARAOKE_IMPORTS_KEY, karaokeNewSongs, markKaraokeSongPlayed, removeImport, removeImportedSong, resetImportQueueForTests, retryImport, sendingTitle, setImportGateHandler, showImportGate, startKaraokeImportQueue, } from './karaoke-import-queue'
import { karaokeSongRequest, resetKaraokeRoomForTests, } from './karaoke-room-store'
import { resetKaraokeSongsForTests } from './karaoke-songs'

function song(name: string): File {
  return new File([new Uint8Array([1, 2, 3])], name, { type: 'audio/mpeg' })
}

/** Everything queued so far has had its turn at the microtask queue. */
async function settle(): Promise<void> {
  for (let i = 0; i < 12; i += 1) await Promise.resolve()
}

function session(id: string): UvrSession {
  const found = fake.sessions?.().find((s) => s.sessionId === id)
  if (found === undefined) throw new Error(`no session ${id}`)
  return found
}

function patch(id: string, next: Partial<UvrSession>): void {
  fake.setSessions?.(
    (fake.sessions?.() ?? []).map((s) =>
      s.sessionId === id ? { ...s, ...next } : s,
    ),
  )
}

/** The server took the song: the pipeline persisted its job id. */
function accept(run: FakeRun, jobId = `rp_${run.sessionId}`): void {
  patch(run.sessionId, { apiSessionId: jobId })
}

function refusal(status: number): Error {
  return Object.assign(new Error(`HTTP ${status}`), { status })
}

const lines = (): string[] =>
  importRows().map(
    (row: ImportRow) => `${row.title}: ${importRowLine(row.state)}`,
  )

let stop: () => void = () => undefined

beforeEach(() => {
  fake.runs = []
  fake.resumed = []
  fake.originals.clear()
  fake.deletedOriginals = []
  fake.deleted = []
  fake.saveFails = false
  fake.setSessions?.([])
  songsApi.refreshes = 0
  localStorage.clear()
  resetImportQueueForTests()
  resetKaraokeRoomForTests()
  resetKaraokeSongsForTests({
    left: 18,
    subscribed: true,
    renewsAt: '2026-10-27T10:00:00.000Z',
    perPeriod: 20,
  })
  setNotifications([])
  setActiveTab(TAB_SINGING)
  Object.defineProperty(navigator, 'onLine', {
    configurable: true,
    get: () => true,
  })
})

afterEach(() => {
  stop()
  vi.useRealTimers()
})

async function started(): Promise<void> {
  stop = startKaraokeImportQueue()
  await settle()
}

describe('songs picked', () => {
  it('each become a row, the original kept on the phone', async () => {
    await started()

    const result = await enqueueImports([
      song('Harbour Lights.mp3'),
      song('Salt and Honey.flac'),
    ])
    await settle()

    expect(result.refused).toEqual([])
    expect(result.queued).toHaveLength(2)
    expect([...fake.originals.keys()]).toEqual(result.queued)
    expect(
      JSON.parse(localStorage.getItem(KARAOKE_IMPORTS_KEY) ?? '[]'),
    ).toEqual(result.queued)
    // Newest first, as the library lists your songs.
    expect(lines()).toEqual([
      'Salt and Honey: Waiting to be sent',
      'Harbour Lights: Sending · 0%',
    ])
  })

  it('are sent one at a time, the next as soon as the server has the last', async () => {
    await started()
    await enqueueImports([
      song('Harbour Lights.mp3'),
      song('Salt and Honey.flac'),
    ])
    await settle()
    expect(fake.runs.map((run) => run.file.name)).toEqual([
      'Harbour Lights.mp3',
    ])

    const first = fake.runs[0] as FakeRun
    first.onUploadProgress?.(0.45)
    expect(lines()).toContain('Harbour Lights: Sending · 45%')
    expect(sendingTitle()).toBe('Harbour Lights')

    accept(first)
    await settle()

    expect(fake.runs.map((run) => run.file.name)).toEqual([
      'Harbour Lights.mp3',
      'Salt and Honey.flac',
    ])
    expect(sendingTitle()).toBe('Salt and Honey')
    expect(localStorage.getItem(KARAOKE_IMPORT_SENDING_KEY)).toBe(
      fake.runs[1]?.sessionId,
    )
  })

  it("show the server's progress, then saving, then leave the queue ready", async () => {
    await started()
    await enqueueImports([song('Long Road North.m4a')])
    await settle()
    const run = fake.runs[0] as FakeRun
    patch(run.sessionId, {
      status: 'processing',
      phase: 'queued',
      indeterminate: true,
    })
    accept(run)
    await settle()
    expect(lines()).toEqual(['Long Road North: Waiting for a studio slot'])
    expect(sendingTitle()).toBeNull()

    // The server can report progress while the job still waits for a GPU.
    patch(run.sessionId, { phase: 'queued', indeterminate: false, progress: 0 })
    expect(lines()).toEqual(['Long Road North: Waiting for a studio slot'])

    patch(run.sessionId, {
      phase: 'processing',
      indeterminate: false,
      progress: 62,
    })
    expect(lines()).toEqual(['Long Road North: Separating · 62%'])

    patch(run.sessionId, { status: 'finalizing', progress: 100 })
    expect(lines()).toEqual(['Long Road North: Saving to this phone'])
    expect(importsInFlight()).toBe(1)

    await run.callbacks.onComplete({
      outputs: { vocal: 'blob:v', instrumental: 'blob:i' },
      stemMeta: {},
    })
    run.resolve()
    await settle()

    expect(lines()).toEqual([])
    expect(importsInFlight()).toBe(0)
    expect(karaokeNewSongs()).toEqual([run.sessionId])
    // The stems are what plays; the copy kept for a resend is not needed.
    expect(fake.deletedOriginals).toEqual([run.sessionId])
    expect(
      JSON.parse(localStorage.getItem(KARAOKE_IMPORTS_KEY) ?? '[]'),
    ).toEqual([])
  })

  it('say when a song is ready, and Open puts it on the stage', async () => {
    await started()
    await enqueueImports([song('Long Road North.m4a')])
    await settle()
    const run = fake.runs[0] as FakeRun
    accept(run)
    await settle()

    patch(run.sessionId, {
      status: 'completed',
      outputs: { vocal: 'v', instrumental: 'i' },
    })
    await settle()

    const toast = notifications().at(-1)
    expect(toast?.message).toBe('Long Road North is ready to sing.')
    expect(toast?.action?.label).toBe('Open')
    toast?.action?.onClick()
    expect(karaokeSongRequest()?.sessionId).toBe(run.sessionId)
    expect(activeTab()).toBe(TAB_KARAOKE)
  })

  it('stays New until it is first sung', async () => {
    await started()
    await enqueueImports([song('Long Road North.m4a')])
    await settle()
    const run = fake.runs[0] as FakeRun
    accept(run)
    patch(run.sessionId, { status: 'completed' })
    await settle()
    expect(karaokeNewSongs()).toEqual([run.sessionId])

    markKaraokeSongPlayed(run.sessionId)

    expect(karaokeNewSongs()).toEqual([])
  })

  it('refuses a song past the queue cap, and one already here', async () => {
    await started()
    const many = Array.from({ length: IMPORT_QUEUE_CAP + 2 }, (_, index) =>
      song(`Song ${index + 1}.mp3`),
    )

    const result = await enqueueImports(many)

    expect(result.queued).toHaveLength(IMPORT_QUEUE_CAP)
    expect(result.refused.map((entry) => entry.title)).toEqual([
      'Song 16',
      'Song 17',
    ])
    expect(result.refused[0]?.refusal.title).toBe('The queue is full')
    expect(duplicateOf(song('Song 1.mp3'))?.title).toBe(
      'Song 1 is already on its way',
    )
  })

  it('refuses a song it cannot keep a copy of, and keeps no row for it', async () => {
    await started()
    fake.saveFails = true

    const result = await enqueueImports([song('Harbour Lights.mp3')])

    expect(result.queued).toEqual([])
    expect(result.refused[0]?.refusal.title).toBe(
      'Not enough space on this phone',
    )
    expect(fake.deleted).toHaveLength(1)
    expect(lines()).toEqual([])
  })
})

describe('a song the server does not take', () => {
  it('waits when no songs are left, and the gate is shown', async () => {
    const gate = vi.fn()
    setImportGateHandler(gate)
    resetKaraokeSongsForTests({
      left: 0,
      subscribed: false,
      renewsAt: null,
      perPeriod: 20,
    })
    await started()
    await enqueueImports([song('Salt and Honey.flac')])
    await settle()
    ;(fake.runs[0] as FakeRun).reject(refusal(402))
    await settle()

    expect(gate).toHaveBeenCalledTimes(1)
    expect(lines()).toEqual(['Salt and Honey: Waiting: subscribe to continue'])
    expect(session(fake.runs[0]?.sessionId ?? '').status).toBe('idle')
    expect(importsInFlight()).toBe(0)

    // Songs arrive: the queue carries on by itself.
    resetKaraokeSongsForTests({
      left: 20,
      subscribed: true,
      renewsAt: '2026-10-27T10:00:00.000Z',
      perPeriod: 20,
    })
    await settle()
    expect(fake.runs).toHaveLength(2)
  })

  it('shows the gate again when its row asks for songs', async () => {
    const gate = vi.fn()
    setImportGateHandler(gate)
    resetKaraokeSongsForTests({
      left: 0,
      subscribed: false,
      renewsAt: null,
      perPeriod: 20,
    })
    await started()
    await enqueueImports([song('Salt and Honey.flac')])
    await settle()
    ;(fake.runs[0] as FakeRun).reject(refusal(402))
    await settle()
    gate.mockClear()

    showImportGate()

    expect(gate).toHaveBeenCalledTimes(1)
    expect(gate).toHaveBeenCalledWith(
      expect.objectContaining({ left: 0, subscribed: false }),
    )
  })

  it("waits for a subscriber's songs to come back", async () => {
    resetKaraokeSongsForTests({
      left: 0,
      subscribed: true,
      renewsAt: '2026-10-27T10:00:00.000Z',
      perPeriod: 20,
    })
    await started()
    await enqueueImports([song('Salt and Honey.flac')])
    await settle()
    ;(fake.runs[0] as FakeRun).reject(refusal(402))
    await settle()

    expect(lines()).toEqual([
      'Salt and Honey: Waiting for your songs to come back',
    ])
  })

  it('tries again in a minute when the studio is busy', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
    await started()
    await enqueueImports([song('Harbour Lights.mp3')])
    await settle()
    ;(fake.runs[0] as FakeRun).reject(refusal(503))
    await settle()
    expect(lines()).toEqual([
      'Harbour Lights: The studio is busy. Trying again in a minute.',
    ])

    await vi.advanceTimersByTimeAsync(59_000)
    expect(fake.runs).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(1_000)
    await settle()
    expect(fake.runs).toHaveLength(2)
  })

  it('waits for a connection, and sends when the phone is back online', async () => {
    let online = false
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      get: () => online,
    })
    await started()
    await enqueueImports([song('Salt and Honey.flac')])
    await settle()

    expect(fake.runs).toHaveLength(0)
    expect(lines()).toEqual([
      'Salt and Honey: Waiting for a connection. It is sent when the phone is back online.',
    ])

    online = true
    window.dispatchEvent(new Event('online'))
    await settle()
    expect(fake.runs).toHaveLength(1)
  })

  it('sends again from the start when the connection drops mid-send', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
    await started()
    await enqueueImports([song('Harbour Lights.mp3')])
    await settle()
    ;(fake.runs[0] as FakeRun).reject(new TypeError('Failed to fetch'))
    await settle()
    // Not at once: a moment first, and the row says what it waits for.
    expect(fake.runs).toHaveLength(1)
    expect(lines()).toEqual([
      'Harbour Lights: Waiting for a connection. It is sent when the phone is back online.',
    ])
    await vi.advanceTimersByTimeAsync(5_000)
    await settle()

    expect(fake.runs).toHaveLength(2)
    fake.runs[1]?.onUploadProgress?.(0.05)
    expect(lines()).toEqual(['Harbour Lights: Sending again · 5%'])
  })

  it('is not sent, and costs nothing, when the server refuses it outright', async () => {
    await started()
    await enqueueImports([
      song('Harbour Lights.mp3'),
      song('Salt and Honey.flac'),
    ])
    await settle()
    ;(fake.runs[0] as FakeRun).reject(refusal(400))
    await settle()

    expect(lines()).toContain(
      'Harbour Lights: This song could not be sent. Nothing was used.',
    )
    // The next one does not wait behind it.
    expect(fake.runs).toHaveLength(2)
  })
})

describe('a song the app closed on', () => {
  it('is sent again from its copy on the next launch, saying why', async () => {
    // Left by the last run: the song mid-send, which the store's own
    // startup check marked interrupted because it had no job yet.
    fake.setSessions?.([
      {
        sessionId: 'uvr-session-a',
        status: 'error',
        error: 'Session interrupted by page reload or closure.',
        progress: 0,
        processingMode: 'server',
        originalFile: {
          name: 'Harbour Lights.mp3',
          size: 3,
          mimeType: 'audio/mpeg',
        },
        createdAt: 1,
      },
    ])
    fake.originals.set('uvr-session-a', song('Harbour Lights.mp3'))
    localStorage.setItem(KARAOKE_IMPORTS_KEY, JSON.stringify(['uvr-session-a']))
    localStorage.setItem(KARAOKE_IMPORT_SENDING_KEY, 'uvr-session-a')
    resetImportQueueForTests()

    await started()
    fake.runs[0]?.onUploadProgress?.(0.05)

    expect(fake.runs.map((run) => run.sessionId)).toEqual(['uvr-session-a'])
    expect(lines()).toEqual([
      'Harbour Lights: Sending again · 5%. The app closed before it finished.',
    ])
  })

  it('says why even when the app closed before the send began', async () => {
    fake.setSessions?.([
      {
        sessionId: 'uvr-session-c',
        status: 'idle',
        progress: 0,
        processingMode: 'server',
        originalFile: {
          name: 'Salt and Honey.flac',
          size: 3,
          mimeType: 'audio/flac',
        },
        createdAt: 1,
      },
    ])
    fake.originals.set('uvr-session-c', song('Salt and Honey.flac'))
    localStorage.setItem(KARAOKE_IMPORTS_KEY, JSON.stringify(['uvr-session-c']))
    localStorage.setItem(KARAOKE_IMPORT_SENDING_KEY, 'uvr-session-c')
    resetImportQueueForTests()

    await started()
    fake.runs[0]?.onUploadProgress?.(0)

    expect(lines()).toEqual([
      'Salt and Honey: Sending again · 0%. The app closed before it finished.',
    ])
  })

  it('is left to the resume when the server had already taken it', async () => {
    fake.setSessions?.([
      {
        sessionId: 'uvr-session-b',
        apiSessionId: 'rp_job-b',
        status: 'processing',
        phase: 'queued',
        indeterminate: true,
        progress: 0,
        processingMode: 'server',
        originalFile: {
          name: 'Long Road North.m4a',
          size: 3,
          mimeType: 'audio/mp4',
        },
        createdAt: 1,
      },
    ])
    localStorage.setItem(KARAOKE_IMPORTS_KEY, JSON.stringify(['uvr-session-b']))
    localStorage.setItem(KARAOKE_IMPORT_SENDING_KEY, 'uvr-session-b')
    resetImportQueueForTests()

    await started()

    expect(fake.runs).toHaveLength(0)
    expect(localStorage.getItem(KARAOKE_IMPORT_SENDING_KEY)).toBeNull()
    expect(lines()).toEqual(['Long Road North: Waiting for a studio slot'])
  })
})

describe('a song that fails on the server', () => {
  async function failed(message: string, keepJob = false): Promise<FakeRun> {
    await started()
    await enqueueImports([song('Long Road North.m4a')])
    await settle()
    const run = fake.runs[0] as FakeRun
    accept(run)
    await settle()
    run.callbacks.onError(message)
    if (keepJob) {
      // A save that failed on the phone ends the run without a rejection,
      // the job id kept: the stems are still on the server.
      run.resolve()
    } else {
      // A server-confirmed failure clears the id and rejects the run.
      patch(run.sessionId, { apiSessionId: undefined })
      run.reject(new Error(message))
    }
    await settle()
    return run
  }

  it('is given back, and can be tried again', async () => {
    const run = await failed('Separation failed: CUDA out of memory')

    expect(lines()).toEqual([
      'Long Road North: This song could not be separated. It was given back.',
    ])
    expect(importsInFlight()).toBe(0)
    expect(songsApi.refreshes).toBeGreaterThan(0)

    retryImport(run.sessionId)
    await settle()

    expect(fake.runs).toHaveLength(2)
    expect(fake.runs[1]?.sessionId).toBe(run.sessionId)
  })

  it('says a song that expired before it reached the phone did', async () => {
    const run = await failed(
      'Your separated stems have expired. Please separate the song again.',
    )

    expect(lines()).toEqual([
      'Long Road North: This song expired on the server before it reached your phone.',
    ])
    expect(importRows()[0]?.state).toEqual({
      kind: 'failed',
      reason: 'expired',
    })

    retryImport(run.sessionId)
    await settle()
    expect(fake.runs).toHaveLength(2)
  })

  it('says a full phone is one', async () => {
    await failed('Storage is full — free up space and try again.', true)

    expect(lines()).toEqual([
      'Long Road North: Not enough space on this phone. Free up about 20 MB.',
    ])
  })

  it('fetches a separated song again for free when it only failed to save', async () => {
    const run = await failed(
      'Could not save the separated stems locally. Please try again.',
      true,
    )
    // The job id survived: the song is still on the server, paid for.
    expect(lines()).toEqual([
      'Long Road North: The song could not be saved to this phone.',
    ])

    retryImport(run.sessionId)
    await settle()

    expect(fake.resumed).toEqual([run.sessionId])
    expect(fake.runs).toHaveLength(1)
  })

  it('waits for the resume when only the connection to it was lost', async () => {
    await started()
    await enqueueImports([song('Long Road North.m4a')])
    await settle()
    const run = fake.runs[0] as FakeRun
    accept(run)
    await settle()

    run.callbacks.onError('Network error while polling')
    run.reject(new TypeError('Failed to fetch'))
    await settle()

    expect(session(run.sessionId).status).toBe('interrupted')
    expect(lines()).toEqual(['Long Road North: Waiting for a studio slot'])
  })
})

describe('removing a row', () => {
  it('follows a song removed in the studio out of the queue', async () => {
    await started()
    const { queued } = await enqueueImports([song('Harbour Lights.mp3')])
    await settle()
    fake.setSessions?.([])
    await settle()

    expect(
      JSON.parse(localStorage.getItem(KARAOKE_IMPORTS_KEY) ?? '[]'),
    ).toEqual([])
    expect(queued).toHaveLength(1)
  })

  it('removes a ready song from the phone, and its New mark with it', async () => {
    await started()
    await enqueueImports([song('Long Road North.m4a')])
    await settle()
    const run = fake.runs[0] as FakeRun
    accept(run)
    patch(run.sessionId, { status: 'completed' })
    await settle()
    expect(karaokeNewSongs()).toEqual([run.sessionId])

    const removed = await removeImportedSong(run.sessionId)

    expect(removed).toBe(true)
    expect(fake.deleted).toEqual([run.sessionId])
    expect(karaokeNewSongs()).toEqual([])
    expect(fake.sessions?.()).toEqual([])
  })

  it('forgets a song that was waiting, and nothing was used', async () => {
    await started()
    await enqueueImports([
      song('Harbour Lights.mp3'),
      song('Salt and Honey.flac'),
    ])
    await settle()
    const waiting = importRows().find((row) => row.title === 'Salt and Honey')

    await removeImport(waiting?.sessionId ?? '')

    expect(fake.deleted).toEqual([waiting?.sessionId])
    expect(lines()).toEqual(['Harbour Lights: Sending · 0%'])
  })

  it('stops a song being sent, and sends the next', async () => {
    await started()
    await enqueueImports([
      song('Harbour Lights.mp3'),
      song('Salt and Honey.flac'),
    ])
    await settle()
    const sending = fake.runs[0] as FakeRun

    await removeImport(sending.sessionId)
    await settle()

    expect(sending.signal?.aborted).toBe(true)
    expect(fake.runs.map((run) => run.file.name)).toEqual([
      'Harbour Lights.mp3',
      'Salt and Honey.flac',
    ])
    expect(lines()).toEqual(['Salt and Honey: Sending · 0%'])
  })
})

describe('the words', () => {
  it('never say credits, and every wait says what it waits for', () => {
    const states = [
      { kind: 'waiting-turn' },
      { kind: 'waiting-network' },
      { kind: 'sending', share: 0.45, again: null },
      { kind: 'sending', share: 0.05, again: 'closed' },
      { kind: 'busy' },
      { kind: 'blocked', subscribed: false },
      { kind: 'queued' },
      { kind: 'separating', percent: 62 },
      { kind: 'saving' },
      { kind: 'failed', reason: 'separation' },
      { kind: 'failed', reason: 'missing' },
    ] as const
    for (const state of states) {
      expect(importRowLine(state)).not.toMatch(/credit|nothing uploaded/i)
    }
    expect(importRowLine({ kind: 'sending', share: 0.4549, again: null })).toBe(
      'Sending · 45%',
    )
    expect(importRowLine({ kind: 'failed', reason: 'missing' })).toBe(
      'The copy of this song on this phone is gone. Choose it again from Files.',
    )
  })
})
