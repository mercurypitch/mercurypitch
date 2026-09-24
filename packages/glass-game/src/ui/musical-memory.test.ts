// Memory consent checks — capture only the judged interval and retire late asynchronous work.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { glassMelody } from '../content/melodies'
import { compileMelody } from '../core/melody-contour'
import type { MusicalMemoryStore } from '../core/musical-memory'
import type { GlassVoiceSession } from '../host'
import type { MelodyPracticeSnapshot } from './melody-practice'
import { createMusicalMemory } from './musical-memory'

function harness() {
  let now = Date.UTC(2026, 8, 24)
  let resolveTake!: (audio: Blob | null) => void
  const finalized = new Promise<Blob | null>((resolve) => {
    resolveTake = resolve
  })
  const take = { finish: vi.fn(() => finalized), discard: vi.fn() }
  const voice = {
    startRecording: vi.fn(() => take),
  } as unknown as GlassVoiceSession
  const store: MusicalMemoryStore = {
    get: vi.fn(async () => null),
    put: vi.fn(async () => {}),
    remove: vi.fn(async () => {}),
  }
  const changed = vi.fn()
  const controller = createMusicalMemory({
    levelId: 'glassworks-journey',
    title: 'A little light',
    store,
    onChange: changed,
    now: () => now,
  })
  const contour = compileMelody(glassMelody('first-arc'), { rootMidi: 60 })
  const snapshot = {
    contour,
    rootMidi: 60,
    pace: 1,
    transposeSemitones: 0,
    judge: { complete: true },
  } as MelodyPracticeSnapshot
  return {
    controller,
    voice,
    take,
    store,
    changed,
    snapshot,
    resolveTake,
    advance: () => {
      now += 5000
    },
  }
}

afterEach(() => vi.useRealTimers())

describe('musical memory consent', () => {
  it('ends recording status at its bound while leaving the melody session alone', async () => {
    vi.useFakeTimers()
    const h = harness()
    h.controller.setConsent(true)
    h.controller.recording.start(h.voice)
    h.advance()
    await vi.advanceTimersByTimeAsync(250)
    expect(h.controller.snapshot().elapsedSeconds).toBe(5)
    for (let index = 0; index < 8; index++) h.advance()
    await vi.advanceTimersByTimeAsync(250)
    expect(h.controller.snapshot().recording).toBe(false)
    expect(h.take.discard).toHaveBeenCalledOnce()
    expect(h.controller.snapshot().message).toContain('Keep singing')
    h.controller.dispose()
  })
  it('never records or saves with default consent and never acquires a stream', async () => {
    const h = harness()
    await h.controller.load()
    h.controller.recording.start(h.voice)
    h.controller.recording.stop(h.voice, 'complete')
    await h.controller.completed(h.snapshot)
    expect(h.voice.startRecording).not.toHaveBeenCalled()
    expect(h.store.put).not.toHaveBeenCalled()
  })
  it('previews a completed take, saves only on request and deletes it explicitly', async () => {
    const h = harness()
    h.controller.setConsent(true)
    h.controller.recording.start(h.voice)
    expect(h.controller.snapshot().recording).toBe(true)
    h.advance()
    h.controller.recording.stop(h.voice, 'complete')
    expect(h.take.finish).toHaveBeenCalledOnce()
    const complete = h.controller.completed(h.snapshot)
    h.resolveTake(new Blob(['voice'], { type: 'audio/webm' }))
    await complete
    expect(h.controller.snapshot().candidate?.durationSeconds).toBe(5)
    expect(h.store.put).not.toHaveBeenCalled()
    await h.controller.save()
    expect(h.store.put).toHaveBeenCalledOnce()
    expect(h.controller.snapshot().saved?.melodyId).toBe('first-arc')
    await h.controller.deleteSaved()
    expect(h.controller.snapshot().candidate).toBeNull()
    expect(h.controller.snapshot().saved).toBeNull()
    expect(h.store.remove).toHaveBeenCalledWith('glassworks-journey')
  })
  it('consumes one opt-in for one sung take and requires an explicit re-arm', async () => {
    const h = harness()
    h.controller.setConsent(true)
    h.controller.recording.start(h.voice)
    expect(h.controller.snapshot().consent).toBe(false)
    expect(h.voice.startRecording).toHaveBeenCalledOnce()
    h.advance()
    h.controller.recording.stop(h.voice, 'complete')
    h.resolveTake(new Blob(['voice'], { type: 'audio/webm' }))
    await h.controller.completed(h.snapshot)

    h.controller.recording.start(h.voice)
    expect(h.voice.startRecording).toHaveBeenCalledOnce()

    h.controller.setConsent(true)
    h.controller.recording.start(h.voice)
    expect(h.voice.startRecording).toHaveBeenCalledTimes(2)
    h.controller.dispose()
  })
  it.each(['cancel', 'revoke', 'dispose'] as const)(
    'discards capture on %s without losing the lesson',
    async (action) => {
      const h = harness()
      h.controller.setConsent(true)
      h.controller.recording.start(h.voice)
      if (action === 'cancel') h.controller.recording.stop(h.voice, 'cancelled')
      if (action === 'revoke') h.controller.setConsent(false)
      if (action === 'dispose') h.controller.dispose()
      expect(h.take.discard).toHaveBeenCalledOnce()
      await h.controller.completed(h.snapshot)
      expect(h.store.put).not.toHaveBeenCalled()
    },
  )
  it('ignores late finalized bytes after a new attempt or consent revocation', async () => {
    const h = harness()
    h.controller.setConsent(true)
    h.controller.recording.start(h.voice)
    h.advance()
    h.controller.recording.stop(h.voice, 'complete')
    const complete = h.controller.completed(h.snapshot)
    h.controller.setConsent(false)
    h.resolveTake(new Blob(['voice'], { type: 'audio/webm' }))
    await complete
    expect(h.controller.snapshot().candidate).toBeNull()
  })
  it('keeps a preview available after a failed save and reports the failure', async () => {
    const h = harness()
    vi.mocked(h.store.put).mockRejectedValue(new Error('quota'))
    h.controller.setConsent(true)
    h.controller.recording.start(h.voice)
    h.advance()
    h.controller.recording.stop(h.voice, 'complete')
    h.resolveTake(new Blob(['voice'], { type: 'audio/webm' }))
    await h.controller.completed(h.snapshot)
    await h.controller.save()
    expect(h.controller.snapshot().candidate).not.toBeNull()
    expect(h.controller.snapshot().saved).toBeNull()
    expect(h.controller.snapshot().message).toContain('Could not save')
  })
})
