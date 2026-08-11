// ============================================================
// Piano Night music panel tests — explicit loading, selection, and import
// ============================================================

import { cleanup, fireEvent, render, screen, waitFor, } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PianoComposition } from '@/features/piano-project/piano-composition-stage'
import type { PianoProject } from '@/features/piano-project/piano-project'
import { PIANO_NIGHT_DEMO_PROJECT } from './piano-night-demo-project'
import type { PianoNightMidiImportResult, PianoNightMusicCatalog, PianoNightMusicCatalogResult, PianoNightMusicSource, } from './piano-night-music-source'
import type { PianoNightSource as PianoNightPerformanceSource } from './piano-night-source'
import { PIANO_NIGHT_INCLUDED_SOURCE } from './piano-night-source'
import { PianoNightMusicPanel } from './PianoNightMusicPanel'

afterEach(cleanup)

function composition(
  index: number,
  name = `Composition ${index}`,
): PianoComposition {
  return {
    id: `composition-${index}`,
    name,
    bpm: 90 + index,
    notes: [
      {
        id: `composition-${index}:note`,
        midi: 60 + (index % 12),
        startBeat: 0,
        duration: 2,
        velocity: 0.76,
      },
    ],
  }
}

function importedProject(name = 'Worker Fixture'): PianoProject {
  return {
    ...PIANO_NIGHT_DEMO_PROJECT,
    id: 'worker-fixture',
    name,
    source: {
      kind: 'midi',
      fileName: 'worker-fixture.mid',
      byteLength: 82,
      sha256:
        '8f868e7f02c6804a6f97927e9d4fbb9a8055ffb9bc2e21106ab2f60f5ec7806f',
      format: 1,
      ticksPerQuarter: 480,
    },
  }
}

function catalog(
  overrides: Partial<PianoNightMusicCatalog> = {},
): PianoNightMusicCatalog {
  return {
    projects: [],
    compositions: [],
    issues: [],
    skipped: {
      projectRecords: 0,
      legacyRows: 0,
      legacyDuplicates: 0,
      compositionRows: 0,
      compositionNotes: 0,
    },
    sourceStatus: {
      migration: 'absent',
      projects: 'ready',
      compositions: 'absent',
    },
    ...overrides,
  }
}

function readyCatalog(
  overrides: Partial<PianoNightMusicCatalog> = {},
): PianoNightMusicCatalogResult {
  const value = catalog(overrides)
  return {
    ok: true,
    status:
      value.projects.length + value.compositions.length === 0
        ? 'empty'
        : 'ready',
    value,
  }
}

function musicSource(
  overrides: Partial<PianoNightMusicSource> = {},
): PianoNightMusicSource {
  return {
    loadCatalog: vi.fn(async () => readyCatalog()),
    importMidi: vi.fn<PianoNightMusicSource['importMidi']>(async () => ({
      ok: false,
      code: 'cancelled',
      message: 'MIDI import was cancelled.',
    })),
    ...overrides,
  }
}

function renderPanel(
  source: PianoNightMusicSource,
  onSelect = vi.fn<(source: PianoNightPerformanceSource) => boolean>(
    () => true,
  ),
) {
  return {
    onSelect,
    ...render(() => (
      <PianoNightMusicPanel
        currentSourceId={() => PIANO_NIGHT_INCLUDED_SOURCE.id}
        legacyPianoPath="/#/piano"
        onSelect={onSelect}
        musicSource={source}
      />
    )),
  }
}

describe('PianoNightMusicPanel', () => {
  it('shows truthful included, composition, and project rows and stages a choice', async () => {
    const project = importedProject()
    const source = musicSource({
      loadCatalog: vi.fn(async () =>
        readyCatalog({
          compositions: [composition(1, 'Quiet Geometry')],
          projects: [{ project, persistence: 'saved' }],
        }),
      ),
    })
    const { onSelect } = renderPanel(source)

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /Quiet Geometry/ }),
      ).toBeVisible()
    })
    expect(
      screen.getByRole('button', { name: /Afterglow Study in E-flat/ }),
    ).toHaveAttribute('aria-pressed', 'true')
    expect(
      screen.getByRole('button', { name: /Worker Fixture/ }),
    ).toHaveTextContent('Imported MIDI')
    expect(
      screen.getByRole('button', { name: /Quiet Geometry/ }),
    ).toHaveTextContent('1 note · 91 BPM')

    fireEvent.click(screen.getByRole('button', { name: /Quiet Geometry/ }))

    expect(onSelect).toHaveBeenCalledOnce()
    expect(onSelect.mock.calls[0]?.[0]).toMatchObject({
      id: 'piano-night:composition:composition-1',
      provenance: 'composition',
      hasAuthoredCoach: false,
      practiceTrackLabel: 'Composed melody',
    })
  })

  it('keeps the included study available when the device library fails and retries', async () => {
    const loadCatalog = vi
      .fn<() => Promise<PianoNightMusicCatalogResult>>()
      .mockResolvedValueOnce({
        ok: false,
        status: 'unavailable',
        code: 'music-library-unavailable',
        message: 'Your Piano music library could not be read on this device.',
        value: catalog(),
      })
      .mockResolvedValueOnce(readyCatalog())
    renderPanel(musicSource({ loadCatalog }))

    await waitFor(() => {
      expect(screen.getByText('Device library unavailable')).toBeVisible()
    })
    expect(
      screen.getByRole('button', { name: /Afterglow Study in E-flat/ }),
    ).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))

    await waitFor(() => expect(loadCatalog).toHaveBeenCalledTimes(2))
    await waitFor(() => {
      expect(
        screen.queryByText('Device library unavailable'),
      ).not.toBeInTheDocument()
    })
    expect(screen.getByText('No saved music on this device yet')).toBeVisible()
  })

  it('keeps a long source title intact for selection and search', async () => {
    const longTitle =
      'Nocturne for a Very Quiet August Evening with the Windows Left Open'
    renderPanel(
      musicSource({
        loadCatalog: vi.fn(async () =>
          readyCatalog({ compositions: [composition(3, longTitle)] }),
        ),
      }),
    )

    expect(
      await screen.findByRole('button', { name: new RegExp(longTitle) }),
    ).toHaveTextContent(longTitle)
  })

  it('searches larger device libraries and bounds the first render', async () => {
    const compositions = Array.from({ length: 45 }, (_, index) =>
      composition(index, index === 44 ? 'Needle Nocturne' : `Study ${index}`),
    )
    renderPanel(
      musicSource({
        loadCatalog: vi.fn(async () => readyCatalog({ compositions })),
      }),
    )

    const search = await screen.findByRole('searchbox', {
      name: 'Search music on this device',
    })
    expect(screen.getAllByRole('button', { pressed: false })).toHaveLength(39)
    expect(
      screen.getByRole('button', { name: 'Show more music' }),
    ).toBeVisible()

    fireEvent.input(search, { target: { value: 'Needle' } })

    expect(
      screen.getByRole('button', { name: /Needle Nocturne/ }),
    ).toBeVisible()
    expect(screen.getByText('1 source')).toBeVisible()
  })

  it('stages a MIDI only after the source port returns its saved project', async () => {
    const project = importedProject('Imported at Night')
    const importMidi = vi.fn(
      async (): Promise<PianoNightMidiImportResult> => ({ ok: true, project }),
    )
    const { container, onSelect } = renderPanel(musicSource({ importMidi }))
    await screen.findByText('Ready to stage')
    const input =
      container.querySelector<HTMLInputElement>('input[type="file"]')
    expect(input).not.toBeNull()
    const file = new File(['midi'], 'night.mid', { type: 'audio/midi' })

    fireEvent.change(input as HTMLInputElement, {
      target: { files: [file] },
    })

    await waitFor(() => expect(onSelect).toHaveBeenCalledOnce())
    expect(importMidi).toHaveBeenCalledWith(file, {
      signal: expect.any(AbortSignal),
    })
    expect(onSelect.mock.calls[0]?.[0]).toMatchObject({
      provenance: 'midi',
      stage: { title: 'Imported at Night' },
      hasAuthoredCoach: false,
    })
  })

  it('shows stable import feedback without exposing implementation errors', async () => {
    const source = musicSource({
      importMidi: vi.fn<PianoNightMusicSource['importMidi']>(async () => ({
        ok: false,
        code: 'invalid-midi',
        message: 'This file is not a supported or complete MIDI file.',
      })),
    })
    const { container } = renderPanel(source)
    await screen.findByText('Ready to stage')
    const input =
      container.querySelector<HTMLInputElement>('input[type="file"]')

    fireEvent.change(input as HTMLInputElement, {
      target: { files: [new File(['bad'], 'bad.mid')] },
    })

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'This file is not a supported or complete MIDI file.',
      )
    })
  })

  it('aborts an in-flight import when the lazy panel unmounts', async () => {
    let capturedSignal: AbortSignal | undefined
    const source = musicSource({
      importMidi: vi.fn(
        (_file, options) =>
          new Promise<PianoNightMidiImportResult>(() => {
            capturedSignal = options?.signal
          }),
      ),
    })
    const { container, unmount } = renderPanel(source)
    await screen.findByText('Ready to stage')
    const input =
      container.querySelector<HTMLInputElement>('input[type="file"]')

    fireEvent.change(input as HTMLInputElement, {
      target: { files: [new File(['midi'], 'long.mid')] },
    })
    await waitFor(() => expect(capturedSignal).toBeDefined())

    unmount()

    expect(capturedSignal?.aborted).toBe(true)
  })
})
