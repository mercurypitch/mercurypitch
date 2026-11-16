// Studio export fixtures — deterministic render outputs for lifecycle and measurement presentation tests, and the files a test's page hands the browser to save.
import { vi } from 'vitest'
import type { StudioWavExport } from '@/lib/studio/export/render-wav'
import { STUDIO_ENGINE_VERSION } from '@/lib/studio/model/types'

export function wavResult(revision = 0): StudioWavExport {
  return {
    blob: new Blob(['wav'], { type: 'audio/wav' }),
    token: {
      projectId: 'project-1',
      revision,
      engineVersion: STUDIO_ENGINE_VERSION,
      meterVersion: 'test-v1',
      audioKey: 'fixture',
    },
    before: { integratedLufs: -20, samplePeakDb: -7, truePeakDb: -6.8 },
    measurement: {
      integratedLufs: -16.2,
      samplePeakDb: -2.5,
      truePeakDb: -2.4,
      frames: 48000,
      sampleRate: 48000,
      channels: 2,
      bitDepth: 16,
    },
    gainDb: 4,
    safetyGainDb: -0.2,
    release: vi.fn(),
  }
}

export function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}

/** A file the page asked the browser to save: the anchor's name and the Blob behind its object URL. */
export interface SavedStudioFile {
  readonly name: string
  readonly blob: Blob
}

/**
 * The files the page asks the browser to save from here on, in order: each
 * object URL's Blob is kept, and each anchor clicked is read for its name
 * and the Blob its URL names instead of navigating. Restore the click with
 * vi.restoreAllMocks().
 */
export function captureStudioDownloads(): SavedStudioFile[] {
  const blobs = new Map<string, Blob>()
  const saved: SavedStudioFile[] = []
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: vi.fn((blob: Blob) => {
      const url = `blob:studio-file-${blobs.size + 1}`
      blobs.set(url, blob)
      return url
    }),
  })
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    value: vi.fn(),
  })
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    const blob = blobs.get(this.getAttribute('href') ?? '')
    if (blob === undefined) throw new Error('No Blob behind this download.')
    saved.push({ name: this.download, blob })
  })
  return saved
}

/** A saved file's bytes. jsdom's Blob has no arrayBuffer(), and its FileReader reads one. */
export function savedBytes(file: SavedStudioFile): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer))
    reader.onerror = () => reject(reader.error)
    reader.readAsArrayBuffer(file.blob)
  })
}
