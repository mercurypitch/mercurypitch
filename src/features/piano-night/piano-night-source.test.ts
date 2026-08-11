// ============================================================
// Piano Night source tests — stable provenance and truthful project metadata
// ============================================================

import { describe, expect, it } from 'vitest'
import type { PianoProject } from '@/features/piano-project/piano-project'
import { PIANO_NIGHT_DEMO_PROJECT } from './piano-night-demo-project'
import { PIANO_NIGHT_INCLUDED_SOURCE, pianoProjectToPianoNightSource, } from './piano-night-source'

describe('pianoProjectToPianoNightSource', () => {
  it('publishes the authored bundled study as the included source', () => {
    expect(PIANO_NIGHT_INCLUDED_SOURCE).toMatchObject({
      id: `piano-night:included:${PIANO_NIGHT_DEMO_PROJECT.id}`,
      provenance: 'included',
      provenanceLabel: 'Included study',
      practiceTrackLabel: 'Acoustic Grand Piano',
      additionalTrackCount: 0,
      keyLabel: 'E-flat major',
      hasAuthoredCoach: true,
      tempoMapChangeCount: 0,
      project: PIANO_NIGHT_DEMO_PROJECT,
    })
    expect(PIANO_NIGHT_INCLUDED_SOURCE.stage.title).toBe(
      PIANO_NIGHT_DEMO_PROJECT.name,
    )
  })

  it('maps imported project provenance without claiming authored coaching', () => {
    const project: PianoProject = {
      ...PIANO_NIGHT_DEMO_PROJECT,
      id: 'imported-study',
      name: 'Imported Study',
      source: {
        kind: 'midi',
        fileName: 'imported-study.mid',
        byteLength: 1_024,
        sha256:
          '1f0e3dad99908345f7439f8ffabdffc4a5286ee2781d0a23c63b1eb3e8e7a932',
        format: 1,
        ticksPerQuarter: 480,
      },
      tempoMap: [
        ...PIANO_NIGHT_DEMO_PROJECT.tempoMap,
        {
          sourceTrackIndex: 0,
          order: 3,
          tick: 960,
          microsecondsPerQuarter: 600_000,
        },
      ],
      backingTrackIds: ['afterglow-backing'],
      tracks: [
        ...PIANO_NIGHT_DEMO_PROJECT.tracks,
        {
          id: 'afterglow-backing',
          sourceTrackIndex: 1,
          channel: 1,
          isPercussion: false,
          name: 'Strings',
          instrumentName: 'String Ensemble',
          events: [],
        },
      ],
    }

    const source = pianoProjectToPianoNightSource(project)

    expect(source).toMatchObject({
      id: 'piano-night:midi:imported-study',
      provenance: 'midi',
      provenanceLabel: 'Imported MIDI',
      practiceTrackLabel: 'Acoustic Grand Piano',
      additionalTrackCount: 1,
      keyLabel: 'E-flat major',
      hasAuthoredCoach: false,
      tempoMapChangeCount: 1,
      project,
    })
    expect(source.stage.title).toBe('Imported Study')
  })
})
