// The review proposal crosses real score and IndexedDB boundaries; only browser Worker is faked.
import { cleanup, fireEvent, render, screen, waitFor, } from '@solidjs/testing-library'
import { Blob as NodeBlob } from 'node:buffer'
import { createSignal } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import 'fake-indexeddb/auto'
import { DexieAdapter } from '@/db/adapters/dexie-adapter'
import { createGuitarRecordingStore } from '@/db/services/guitar-recording-service'
import { DEFAULT_GUITAR_ELECTRIC_AMP_PARAMETERS } from '@/lib/guitar/guitar-electric-amp'
import { DEFAULT_GUITAR_TUNING } from '@/lib/guitar/instrument-tuning'
import { createRecordingScore } from '@/lib/guitar/recording-score'
import type { GuitarPracticeScore, GuitarRecording, } from '@/lib/guitar/recording-types'
import { BASIC_PITCH } from '@/lib/transcription/basic-pitch-inference'
import type { GuitarRefinementMessage } from '@/lib/transcription/guitar-recording-refinement'
import { GuitarChordRefinementPanel } from './GuitarChordRefinementPanel'
import { useGuitarChordRefinement } from './useGuitarChordRefinement'
import { useGuitarRecordingPlayback } from './useGuitarRecordingPlayback'

class BrowserWorker {
  static instances: BrowserWorker[] = []
  onmessage: ((event: MessageEvent<GuitarRefinementMessage>) => void) | null =
    null
  terminate = vi.fn()
  postMessage = vi.fn()
  constructor() {
    BrowserWorker.instances.push(this)
  }
  finish(notes = [57, 64]) {
    this.onmessage?.({
      data: {
        type: 'result',
        result: {
          notes: notes.map((midi) => ({
            midi,
            startSeconds: 0.1,
            endSeconds: 0.8,
            confidence: 0.85,
          })),
          duration: 1,
          processingMs: 30,
          modelSha256: BASIC_PITCH.modelSha256,
          decoderVersion: BASIC_PITCH.decoderVersion,
        },
      },
    } as MessageEvent<GuitarRefinementMessage>)
  }
}

describe('chord proposal review', () => {
  let db: DexieAdapter
  let store: ReturnType<typeof createGuitarRecordingStore>
  beforeEach(() => {
    vi.stubGlobal('Blob', NodeBlob)
    vi.stubGlobal('Worker', BrowserWorker)
    BrowserWorker.instances = []
    db = new DexieAdapter()
    store = createGuitarRecordingStore(db)
  })
  afterEach(async () => {
    cleanup()
    vi.restoreAllMocks()
    await db.destroy()
    vi.unstubAllGlobals()
  })

  async function setup(auto = false) {
    const row: GuitarRecording = {
      id: 'review-refine',
      version: 1,
      detectorVersion: 'original',
      title: 'My idea',
      createdAt: '2026-09-08T10:00:00Z',
      updatedAt: '2026-09-08T10:00:00Z',
      state: 'capturing',
      sampleRate: 8000,
      inputChannel: 0,
      inputKind: 'interface',
      frames: 0,
      chunks: 0,
      audioStartFrame: null,
      clockAnomalies: 0,
      interruption: null,
      amp: null,
      backing: null,
      takeId: null,
      scoreId: null,
    }
    const evidence = {
      id: 'original',
      midi: 57,
      startFrame: 800,
      endFrame: 6400,
      clarity: 0.9,
      onset: 'attack' as const,
    }
    await store.begin(row)
    await store.checkpoint({
      id: `${row.id}:0`,
      recordingId: row.id,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      kind: 'audio',
      sequence: 0,
      firstFrame: 0,
      frames: 8000,
      pcm: new Int16Array(8000).buffer,
      pitches: [],
      attacks: [800],
      notes: [evidence],
      peak: 0.2,
    })
    await store.finish(
      row.id,
      {
        frames: 8000,
        notes: [evidence],
        clockAnomalies: 0,
        interruption: null,
      },
      0,
    )
    const draft = await store.load(row.id)
    let view!: ReturnType<typeof useGuitarChordRefinement>
    let current!: () => GuitarPracticeScore
    let edit!: (next: GuitarPracticeScore) => void
    let close!: () => void
    let reopen!: () => void
    const consumed = vi.fn()
    const rendered = render(() => {
      const [score, setScore] = createSignal(
        createRecordingScore(
          draft.recording,
          draft.notes,
          DEFAULT_GUITAR_TUNING,
        ),
      )
      const [open, setOpen] = createSignal(true)
      current = score
      edit = setScore
      close = () => setOpen(false)
      reopen = () => setOpen(true)
      const playback = useGuitarRecordingPlayback({
        draft: () => draft,
        score,
        currentAmp: () => DEFAULT_GUITAR_ELECTRIC_AMP_PARAMETERS,
        blocked: () => false,
        activate: async () => null,
        beforePlay: () => {},
      })
      view = useGuitarChordRefinement({
        draft,
        score,
        open,
        blocked: () => false,
        onScore: setScore,
        autoStart: () => auto,
        onAutoStart: consumed,
        onSaved: () => {},
        playback,
        store,
      })
      return (
        <GuitarChordRefinementPanel
          controller={view}
          score={score()}
          disabled={false}
          hasAudio={true}
        />
      )
    })
    return { view, current, edit, close, reopen, consumed, rendered, draft }
  }

  async function proposal() {
    const previousWorkers = BrowserWorker.instances.length
    fireEvent.click(screen.getByRole('button', { name: 'Refine chords' }))
    await waitFor(() =>
      expect(BrowserWorker.instances.length).toBe(previousWorkers + 1),
    )
    BrowserWorker.instances[previousWorkers].finish()
    await screen.findByRole('button', { name: 'Use refined notes' })
  }

  it('automatically prepares a proposal once without accepting it, and never restarts after cancel/reopen', async () => {
    const state = await setup(true)
    await waitFor(() => expect(BrowserWorker.instances).toHaveLength(1))
    expect(state.consumed).toHaveBeenCalledOnce()
    BrowserWorker.instances[0].finish()
    await screen.findByRole('button', { name: 'Use refined notes' })
    expect(state.current().notes).toHaveLength(1)
    expect(
      (await store.load(state.draft.recording.id)).editableScore,
    ).toBeUndefined()
    state.close()
    state.reopen()
    expect(state.view.candidate()).toBeNull()
    expect(BrowserWorker.instances).toHaveLength(1)
    expect(state.consumed).toHaveBeenCalledOnce()
  })

  it('compares without writing, then applies and restores without modifying source evidence', async () => {
    const state = await setup()
    await proposal()
    expect(state.current().notes).toHaveLength(1)
    expect(state.view.preview()?.notes).toHaveLength(2)
    expect(
      (await store.load(state.draft.recording.id)).editableScore,
    ).toBeUndefined()
    fireEvent.click(screen.getByRole('radio', { name: 'Current · 1 note' }))
    expect(state.view.preview()).toBeNull()
    fireEvent.click(screen.getByRole('radio', { name: 'Refined · 2 notes' }))
    fireEvent.click(screen.getByRole('button', { name: 'Use refined notes' }))
    await waitFor(() => expect(state.current().notes).toHaveLength(2))
    expect((await store.load(state.draft.recording.id)).notes).toEqual(
      state.draft.notes,
    )
    expect(await store.scores()).toEqual([])
    fireEvent.click(
      screen.getByRole('button', { name: 'Restore previous notes' }),
    )
    await waitFor(() => expect(state.current().notes).toHaveLength(1))
    expect(
      (await store.load(state.draft.recording.id)).refinementBackup,
    ).toBeUndefined()
  })

  it.each(['cancel', 'close', 'unmount'] as const)(
    'retires %s during inference and never applies a late result',
    async (action) => {
      const state = await setup()
      fireEvent.click(screen.getByRole('button', { name: 'Refine chords' }))
      await waitFor(() => expect(BrowserWorker.instances.length).toBe(1))
      const worker = BrowserWorker.instances[0]
      if (action === 'cancel')
        fireEvent.click(
          screen.getByRole('button', { name: 'Cancel chord analysis' }),
        )
      else if (action === 'close') state.close()
      else state.rendered.unmount()
      worker.finish()
      await waitFor(() => expect(worker.terminate).toHaveBeenCalledOnce())
      expect(state.view.candidate()).toBeNull()
      expect(state.current().notes).toHaveLength(1)
      expect(
        (await store.load(state.draft.recording.id)).editableScore,
      ).toBeUndefined()
    },
  )

  it('keeps a failed concurrent save actionable without overwriting the newer corrections', async () => {
    const state = await setup()
    await proposal()
    const other = { ...state.current(), title: 'Edited in another tab' }
    await store.saveCorrections(other)
    fireEvent.click(screen.getByRole('button', { name: 'Use refined notes' }))
    await screen.findByRole('alert')
    expect(
      screen.getByRole('button', { name: 'Use refined notes' }),
    ).toBeEnabled()
    expect((await store.load(state.draft.recording.id)).editableScore).toEqual(
      other,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Keep current notes' }))
    expect(state.current().notes).toHaveLength(1)
    expect(state.view.candidate()).toBeNull()
  })

  it('reports an empty result without replacing the previous melody or requesting playback', async () => {
    const state = await setup()
    fireEvent.click(screen.getByRole('button', { name: 'Refine chords' }))
    await waitFor(() => expect(BrowserWorker.instances.length).toBe(1))
    BrowserWorker.instances[0].finish([])
    await screen.findByText(/No chord notes were found/)
    expect(state.current().notes).toHaveLength(1)
    expect(state.view.candidate()).toBeNull()
    expect(
      (await store.load(state.draft.recording.id)).editableScore,
    ).toBeUndefined()
  })

  it.each(['notes', 'refinement'] as const)(
    'rejects saved-state refresh when another tab changed %s and does not adopt its write baseline',
    async (changed) => {
      const state = await setup()
      await proposal()
      fireEvent.click(screen.getByRole('button', { name: 'Use refined notes' }))
      await waitFor(() => expect(state.current().notes).toHaveLength(2))
      const intended = structuredClone(state.current())
      const other = structuredClone(intended)
      if (changed === 'notes') other.notes[0].midi += 1
      else other.refinement!.decoderVersion = 'another-decoder/2'
      await store.saveCorrections(other)

      await expect(state.view.saved(intended)).rejects.toThrow(
        'These notes changed in another tab',
      )
      expect(state.current()).toEqual(intended)

      // A failed refresh must not make a later proposal eligible to overwrite
      // the other tab's notes merely because this review has now seen them.
      await proposal()
      fireEvent.click(screen.getByRole('button', { name: 'Use refined notes' }))
      await screen.findByRole('alert')
      expect(
        (await store.load(state.draft.recording.id)).editableScore,
      ).toEqual(other)
    },
  )

  it('refreshes a successful manual save without re-enabling refinement undo over those corrections', async () => {
    const state = await setup()
    await proposal()
    fireEvent.click(screen.getByRole('button', { name: 'Use refined notes' }))
    await waitFor(() => expect(state.view.canRestore()).toBe(true))
    const manual = { ...state.current(), title: 'Edited after refinement' }
    state.edit(manual)
    expect(state.view.canRestore()).toBe(false)
    await store.saveCorrections(manual)
    await state.view.saved(manual)

    expect(state.view.canRestore()).toBe(false)
    expect(
      screen.getByRole('button', { name: 'Restore previous notes' }),
    ).toBeDisabled()
    await state.view.restore()
    expect((await store.load(state.draft.recording.id)).editableScore).toEqual(
      manual,
    )
    expect(state.view.hasBackup()).toBe(true)
  })

  it.each(['apply', 'restore'] as const)(
    'keeps a completed %s synchronized when review closes during its durable write',
    async (action) => {
      const state = await setup()
      await proposal()
      if (action === 'restore') {
        fireEvent.click(
          screen.getByRole('button', { name: 'Use refined notes' }),
        )
        await waitFor(() => expect(state.current().notes).toHaveLength(2))
      }
      let release!: () => void
      const gate = new Promise<void>((resolve) => {
        release = resolve
      })
      const transaction = db.transaction.bind(db)
      // Delay only IndexedDB admission; the actual transaction and service remain real.
      vi.spyOn(db, 'transaction').mockImplementation(async (operation) => {
        await gate
        return transaction(operation)
      })
      fireEvent.click(
        screen.getByRole('button', {
          name:
            action === 'apply' ? 'Use refined notes' : 'Restore previous notes',
        }),
      )
      await waitFor(() => expect(state.view.persisting()).toBe(true))
      state.close()
      release()
      await waitFor(() => expect(state.view.persisting()).toBe(false))
      expect(state.current().notes).toHaveLength(action === 'apply' ? 2 : 1)
      expect(
        (await store.load(state.draft.recording.id)).editableScore,
      ).toEqual(state.current())
      expect(state.view.candidate()).toBeNull()
    },
  )
})
