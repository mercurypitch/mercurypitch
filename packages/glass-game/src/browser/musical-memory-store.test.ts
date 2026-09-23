// Local memory persistence checks — namespaces, replacement, deletion and corrupt data.
import { IDBFactory } from 'fake-indexeddb'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MusicalMemory } from '../core/musical-memory'
import { isMusicalMemory, memoryFileName } from '../core/musical-memory'
import { createBrowserMemoryStore } from './musical-memory-store'

const take = (title = 'A little light'): MusicalMemory => ({
  version: 1,
  levelId: 'glassworks-journey',
  melodyId: 'first-arc',
  melodyVersion: 1,
  title,
  recordedAt: Date.UTC(2026, 8, 24),
  rootMidi: 60,
  pace: 1,
  transposeSemitones: 0,
  durationSeconds: 3.5,
  audio: new Blob(['locally captured input'], {
    type: 'audio/webm;codecs=opus',
  }),
})

beforeEach(() => vi.stubGlobal('indexedDB', new IDBFactory()))

describe('local musical memory store', () => {
  it('keeps explicit saves across adapters and isolates product hosts', async () => {
    const one = createBrowserMemoryStore('beside-cue')
    expect(await one.get('glassworks-journey')).toBeNull()
    await one.put(take())
    const restored =
      await createBrowserMemoryStore('beside-cue').get('glassworks-journey')
    expect(restored?.title).toBe('A little light')
    expect(await restored?.audio.text()).toBe('locally captured input')
    expect(
      await createBrowserMemoryStore('mercurypitch').get('glassworks-journey'),
    ).toBeNull()
  })
  it('replaces one gallery atomically without changing another, then deletes explicitly', async () => {
    const store = createBrowserMemoryStore('replace')
    await store.put(take())
    await store.put({ ...take('Other gallery'), levelId: 'twin-galleries' })
    await store.put(take('My second take'))
    expect((await store.get('glassworks-journey'))?.title).toBe(
      'My second take',
    )
    await store.remove('glassworks-journey')
    expect(await store.get('glassworks-journey')).toBeNull()
    expect((await store.get('twin-galleries'))?.title).toBe('Other gallery')
  })
  it('rejects empty, unbounded and malformed recordings without replacing the saved take', async () => {
    const store = createBrowserMemoryStore('validation')
    await store.put(take())
    for (const patch of [
      { durationSeconds: Infinity },
      { durationSeconds: 46 },
      { rootMidi: NaN },
      { audio: new Blob([], { type: 'audio/webm' }) },
      { audio: new Blob(['script'], { type: 'text/html' }) },
      { melodyVersion: 0 },
    ])
      await expect(store.put({ ...take(), ...patch })).rejects.toThrow()
    expect((await store.get('glassworks-journey'))?.title).toBe(
      'A little light',
    )
    expect(isMusicalMemory(null)).toBe(false)
    expect(memoryFileName(take())).toBe(
      'merc-glassworks-journey-2026-09-24.webm',
    )
  })
  it('reports unavailable storage instead of claiming a save', async () => {
    vi.stubGlobal('indexedDB', undefined)
    await expect(
      createBrowserMemoryStore('unavailable').put(take()),
    ).rejects.toThrow()
  })
})
