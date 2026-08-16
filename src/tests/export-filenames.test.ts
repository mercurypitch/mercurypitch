// ============================================================
// Exports wear the app's own name (CLAUDE-JOURNEY-025)
// ============================================================
//
// Melody and audio exports were named `pitchperfect-<timestamp>` — a
// product name that appears nowhere in the app, so a Downloads folder
// full of them cannot be traced back to MercuryPitch. The name lives on
// deliberately in internal storage identifiers (localStorage keys,
// the `pitchperfect-models` IndexedDB) because renaming those would
// orphan every existing user's data; what a user can SEE must say
// mercurypitch.

import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import type { MelodyItem } from '@/types'

vi.mock('@/stores/notifications-store', () => ({
  showNotification: vi.fn(),
}))

const { downloadMIDI, exportFilename } = await import('@/lib/piano-roll')
const { useEditorController } =
  await import('@/features/editor/useEditorController')
const { melodyStore } = await import('@/stores/melody-store')
const { AudioEngine } = await import('@/lib/audio-engine')

function makeNote(midi: number, startBeat: number, duration = 1): MelodyItem {
  return {
    id: 1,
    note: { midi, name: 'C', octave: 4, freq: 261.63 },
    startBeat,
    duration,
  }
}

describe('exportFilename', () => {
  it('brands the file with the app name and keeps the sortable timestamp', () => {
    const name = exportFilename('mid')
    expect(name).toMatch(
      /^mercurypitch-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.mid$/,
    )
  })

  it('carries the extension it was asked for', () => {
    expect(exportFilename('wav').endsWith('.wav')).toBe(true)
  })
})

describe('downloadMIDI fallback name', () => {
  it('names an unnamed download after the app, not a former product', () => {
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:test'),
      revokeObjectURL: vi.fn(),
    })
    const anchors: HTMLAnchorElement[] = []
    const originalCreate = document.createElement.bind(document)
    const createSpy = vi
      .spyOn(document, 'createElement')
      .mockImplementation((tag: string) => {
        const el = originalCreate(tag)
        if (tag === 'a') anchors.push(el as HTMLAnchorElement)
        return el
      })
    try {
      expect(downloadMIDI([makeNote(60, 0)], 120)).toBe(true)
      expect(anchors).toHaveLength(1)
      expect(anchors[0].download).toBe('mercurypitch-melody.mid')
    } finally {
      createSpy.mockRestore()
      vi.unstubAllGlobals()
    }
  })
})

describe('the Compose export button', () => {
  it('downloads under the app name with the sortable stamp', () => {
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:test'),
      revokeObjectURL: vi.fn(),
    })
    const anchors: HTMLAnchorElement[] = []
    const originalCreate = document.createElement.bind(document)
    const createSpy = vi
      .spyOn(document, 'createElement')
      .mockImplementation((tag: string) => {
        const el = originalCreate(tag)
        if (tag === 'a') anchors.push(el as HTMLAnchorElement)
        return el
      })
    try {
      melodyStore.setMelody([makeNote(60, 0)])
      const controller = useEditorController({
        audioEngine: new AudioEngine(),
      })
      controller.handleExportMIDI()
      expect(anchors).toHaveLength(1)
      expect(anchors[0].download).toMatch(
        /^mercurypitch-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.mid$/,
      )
    } finally {
      createSpy.mockRestore()
      vi.unstubAllGlobals()
      melodyStore.setMelody([])
    }
  })
})

describe('no export site still says pitchperfect', () => {
  // The user-facing sites are string literals inside DOM event handlers,
  // out of reach of a render test — so pin the sources themselves, the way
  // admin-studio-responsive-preview.test.ts pins workflow files. Internal
  // storage identifiers use `pitchperfect_` (underscore) or the model-cache
  // constant and are exempt by the hyphen match.
  it.each([
    'src/lib/piano-roll.ts',
    'src/features/editor/useEditorController.ts',
  ])('%s', (path) => {
    expect(readFileSync(path, 'utf8')).not.toContain('pitchperfect-')
  })
})
