// Deterministic saved authored score shared by Guitar Night browser regressions.
import type { Page } from '@playwright/test'

export async function seedAuthoredGuitarScore(
  page: Page,
  songId: string,
  includeSecondaryPart = false,
  options: { electric?: boolean; bpm?: number; percussion?: boolean } = {},
): Promise<void> {
  await page.addInitScript(
    ({ includeSecondary, seededSongId, electric, bpm, percussion }) => {
      const notes = Array.from({ length: 16 }, (_, index) => ({
        midi: index % 2 === 0 ? 64 : 67,
        startBeat: index,
        duration: 1,
        stringIndex: 0,
        fret: index % 2 === 0 ? 0 : 3,
      }))
      const rhythmNotes = Array.from({ length: 16 }, (_, index) => ({
        midi: index % 2 === 0 ? 59 : 62,
        startBeat: index + 0.5,
        duration: 0.5,
        stringIndex: 1,
        fret: index % 2 === 0 ? 0 : 3,
      }))
      localStorage.setItem(
        'pitchperfect_guitar_songs',
        JSON.stringify([
          {
            id: seededSongId,
            name: 'Velvet pointer study',
            bpm,
            tracks: [
              {
                id: 'track-lead',
                name: 'Lead guitar',
                instrumentName: 'Clean Guitar',
                ...(electric
                  ? { sourceProgram: 27, instrumentFamily: 'electric-guitar' }
                  : {}),
                noteCount: notes.length,
                notes,
              },
              ...(includeSecondary
                ? [
                    {
                      id: 'track-rhythm',
                      name: 'Rhythm guitar',
                      instrumentName: 'Rhythm Guitar',
                      ...(electric
                        ? {
                            sourceProgram: 27,
                            instrumentFamily: 'electric-guitar',
                          }
                        : {}),
                      noteCount: rhythmNotes.length,
                      notes: rhythmNotes,
                    },
                  ]
                : []),
              ...(percussion
                ? [
                    {
                      id: 'track-drums',
                      name: 'Studio Drums',
                      kind: 'percussion',
                      noteCount: 0,
                      notes: [],
                      percussionHits: [
                        {
                          gmKey: 36,
                          startBeat: 0,
                          writtenDuration: 0.25,
                          velocity: 100,
                        },
                      ],
                    },
                  ]
                : []),
            ],
            scoreTrackId: 'track-lead',
            backingTrackIds: includeSecondary ? ['track-rhythm'] : [],
            importedAt: Date.now(),
          },
        ]),
      )
    },
    {
      includeSecondary: includeSecondaryPart,
      seededSongId: songId,
      electric: options.electric ?? false,
      bpm: options.bpm ?? 120,
      percussion: options.percussion ?? false,
    },
  )
}
