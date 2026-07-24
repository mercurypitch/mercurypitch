import { describe, expect, it } from 'vitest'
import type { SessionPitchData } from '@/db/services/session-pitch-analysis-service'
import { buildMobileAnalysisSummary } from '@/lib/mobile-analysis-summary'

describe('buildMobileAnalysisSummary', () => {
  it('summarizes a cleaned UVR detector pass for the mobile overview', () => {
    const data: SessionPitchData = {
      mergedNotes: [
        { midi: 60, noteName: 'C4', startSec: 0, endSec: 0.4 },
        { midi: 60, noteName: 'C4', startSec: 0.5, endSec: 1 },
        { midi: 64, noteName: 'E4', startSec: 2, endSec: 2.8 },
        { midi: 67, noteName: 'G4', startSec: 3, endSec: 4 },
      ],
      segmentedNotes: [
        { midi: 60, noteName: 'C4', startSec: 0, endSec: 1 },
        { midi: 64, noteName: 'E4', startSec: 2, endSec: 3 },
        { midi: 67, noteName: 'G4', startSec: 3, endSec: 4 },
      ],
      pitchHistory: [],
      editLayer: {
        manual: [{ id: 'm-0', startBeat: 2, endBeat: 3, midi: 64 }],
        deleted: [{ startBeat: 1.8, endBeat: 2.1 }],
        seq: 1,
      },
      keyRegions: [
        {
          tonic: 0,
          mode: 'major',
          confidence: 0.5,
          keyName: 'C',
          scaleType: 'major',
          startSec: 0,
          endSec: 4,
        },
      ],
    }

    expect(buildMobileAnalysisSummary(data)).toMatchObject({
      rawNoteCount: 4,
      cleanedNoteCount: 3,
      voicedSeconds: 3,
      spanSeconds: 4,
      coveragePercent: 75,
      lowNote: 'C4',
      highNote: 'G4',
      rangeSemitones: 7,
      keyLabel: 'C major',
      keyRegionCount: 1,
      manualEditCount: 2,
    })
  })

  it('returns null when a session has no usable pitch notes', () => {
    expect(
      buildMobileAnalysisSummary({
        mergedNotes: [],
        segmentedNotes: [],
        pitchHistory: [],
      }),
    ).toBeNull()
  })
})
