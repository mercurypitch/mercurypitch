// Studio export fixtures — deterministic render outputs for lifecycle and measurement presentation tests.
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
