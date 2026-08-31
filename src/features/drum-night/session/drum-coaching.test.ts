// Drum Night coaching tests — timing/dynamics evidence and bounded recovery.

import { describe, expect, it } from 'vitest'
import type { DrumCapturedHit } from './drum-coaching'
import { coachDrumSession } from './drum-coaching'
import { drumSongFixture, percussionTrackFixture, readyDocumentFixture, } from './drum-session.test-fixtures'

describe('coachDrumSession', () => {
  it('reports measured late timing and suggests the affected source bar', () => {
    const document = readyDocumentFixture()
    const captures: DrumCapturedHit[] = [
      {
        id: 'played-snare-1',
        source: 'midi',
        gmKey: 38,
        beat: 1.1,
        velocity: 114,
      },
      {
        id: 'played-snare-2',
        source: 'midi',
        gmKey: 38,
        beat: 2.08,
        velocity: 110,
      },
    ]

    const result = coachDrumSession(document, captures)

    expect(result.status).toBe('ready')
    expect(result.dataSourceLabel).toBe(
      'E-kit MIDI · mapped timing and velocity',
    )
    expect(result.confidenceLabel).toBe('High-confidence evidence')
    expect(result.meanTimingOffsetMs).toBe(45)
    expect(result.lateCount).toBe(2)
    expect(result.observation).toBe('Matched attacks landed about 45 ms late.')
    expect(result.recovery).toEqual(
      expect.objectContaining({
        startBeat: 0,
        endBeat: 4,
        barNumber: 1,
        focus: 'timing',
        label: 'Repeat bar 1',
      }),
    )
  })

  it('limits room-microphone evidence to onset timing', () => {
    const document = readyDocumentFixture()
    const captures: DrumCapturedHit[] = [
      {
        id: 'mic-1',
        source: 'room-mic',
        beat: 0.04,
        confidence: 0.91,
        timingUncertaintyMs: 14,
      },
      {
        id: 'mic-2',
        source: 'room-mic',
        beat: 1.02,
        confidence: 0.88,
        timingUncertaintyMs: 16,
      },
    ]

    const result = coachDrumSession(document, captures)

    expect(result.status).toBe('ready')
    expect(result.dataSourceLabel).toBe('Room mic · onset timing only')
    expect(result.evidenceScope).toBe('timing-only')
    expect(result.meanVelocityOffset).toBeNull()
    expect(result.matches.every((match) => match.velocityOffset === null)).toBe(
      true,
    )
  })

  it('makes a dynamics recovery suggestion only from direct velocity evidence', () => {
    const document = readyDocumentFixture()
    const captures: DrumCapturedHit[] = [
      {
        id: 'touch-kick',
        source: 'touch',
        gmKey: 36,
        beat: 0,
        velocity: 50,
      },
      {
        id: 'touch-snare',
        source: 'touch',
        gmKey: 38,
        beat: 1,
        velocity: 62,
      },
    ]

    const result = coachDrumSession(document, captures)

    expect(result.status).toBe('ready')
    expect(result.meanTimingOffsetMs).toBe(0)
    expect(result.meanAbsoluteVelocityOffset).toBe(46)
    expect(result.observation).toContain(
      'captured velocities differed from the authored accents',
    )
    expect(result.recovery?.focus).toBe('dynamics')
  })

  it('withholds coaching when the aligned evidence is below confidence', () => {
    const document = readyDocumentFixture()
    const captures: DrumCapturedHit[] = [
      {
        id: 'uncertain-1',
        source: 'room-mic',
        beat: 0,
        confidence: 0.2,
        timingUncertaintyMs: 80,
      },
      {
        id: 'uncertain-2',
        source: 'room-mic',
        beat: 1,
        confidence: 0.3,
        timingUncertaintyMs: 80,
      },
    ]

    const result = coachDrumSession(document, captures)

    expect(result.status).toBe('insufficient-evidence')
    expect(result.matchedHitCount).toBe(0)
    expect(result.confidenceLabel).toBe('Low-confidence evidence')
    expect(result.observation).toBe(
      'Not enough aligned, confident attacks were captured to make a timing claim.',
    )
    expect(result.recovery).toBeNull()
  })

  it('does not turn a mismatched mapped voice into a timing judgment', () => {
    const document = readyDocumentFixture()
    const captures: DrumCapturedHit[] = [
      {
        id: 'ride-1',
        source: 'keyboard',
        gmKey: 51,
        beat: 0,
        velocity: 90,
      },
      {
        id: 'ride-2',
        source: 'keyboard',
        gmKey: 51,
        beat: 1,
        velocity: 90,
      },
    ]

    const result = coachDrumSession(document, captures)

    expect(result.status).toBe('insufficient-evidence')
    expect(result.matchedHitCount).toBe(0)
    expect(result.observation).not.toMatch(/wrong|limb|stick|grip/i)
  })

  it('requires the exact GM articulation even within the same voice family', () => {
    const document = readyDocumentFixture({
      song: drumSongFixture({
        percussionTracks: [
          percussionTrackFixture({
            hits: [
              { id: 'snare-a', gmKey: 38, startBeat: 0, velocity: 90 },
              { id: 'snare-b', gmKey: 38, startBeat: 1, velocity: 90 },
            ],
          }),
        ],
      }),
    })
    const captures: DrumCapturedHit[] = [
      { id: 'electric-a', source: 'midi', gmKey: 40, beat: 0, velocity: 90 },
      { id: 'electric-b', source: 'midi', gmKey: 40, beat: 1, velocity: 90 },
    ]

    const result = coachDrumSession(document, captures)

    expect(result.status).toBe('insufficient-evidence')
    expect(result.matchedHitCount).toBe(0)
  })

  it('matches a dense exact-articulation roll in deterministic source order', () => {
    const document = readyDocumentFixture({
      song: drumSongFixture({
        percussionTracks: [
          percussionTrackFixture({
            hits: [
              { id: 'roll-1', gmKey: 38, startBeat: 0, velocity: 80 },
              { id: 'roll-2', gmKey: 38, startBeat: 0.1, velocity: 82 },
              {
                id: 'roll-3',
                gmKey: 38,
                startBeat: 0.2,
                velocity: 84,
                writtenDuration: 0.2,
              },
            ],
          }),
        ],
      }),
    })
    const captures: DrumCapturedHit[] = [
      { id: 'played-1', source: 'midi', gmKey: 38, beat: 0.04, velocity: 80 },
      { id: 'played-2', source: 'midi', gmKey: 38, beat: 0.12, velocity: 82 },
      { id: 'played-3', source: 'midi', gmKey: 38, beat: 0.19, velocity: 84 },
    ]

    const result = coachDrumSession(document, captures)

    expect(result.matches.map((match) => match.target.id)).toEqual([
      'roll-1',
      'roll-2',
      'roll-3',
    ])
    expect(result.matches.map((match) => match.captured.id)).toEqual([
      'played-1',
      'played-2',
      'played-3',
    ])
  })

  it('maximises ordered direct matches, then minimises their total timing offset', () => {
    const document = readyDocumentFixture({
      song: drumSongFixture({
        percussionTracks: [
          percussionTrackFixture({
            hits: [0, 0.2, 1, 1.2].map((startBeat, index) => ({
              id: `target-${index}`,
              gmKey: 38,
              startBeat,
              velocity: 90,
              writtenDuration: index === 3 ? 0.5 : undefined,
            })),
          }),
        ],
      }),
    })
    const captures: DrumCapturedHit[] = [0.18, 1.18].map((beat, index) => ({
      id: `capture-${index}`,
      source: 'midi',
      gmKey: 38,
      beat,
      velocity: 90,
    }))

    const result = coachDrumSession(document, captures)

    expect(result.matches.map((match) => match.target.id)).toEqual([
      'target-1',
      'target-3',
    ])
    expect(result.matches.map((match) => match.timingOffsetMs)).toEqual([
      -10, -10,
    ])
  })

  it('uses the same optimal monotone matcher for room-mic onset groups', () => {
    const document = readyDocumentFixture({
      song: drumSongFixture({
        percussionTracks: [
          percussionTrackFixture({
            hits: [0, 0.2, 1, 1.2].map((startBeat, index) => ({
              id: `target-${index}`,
              gmKey: index % 2 === 0 ? 36 : 38,
              startBeat,
              velocity: 90,
              writtenDuration: index === 3 ? 0.5 : undefined,
            })),
          }),
        ],
      }),
    })
    const captures: DrumCapturedHit[] = [0.18, 1.18].map((beat, index) => ({
      id: `mic-${index}`,
      source: 'room-mic',
      beat,
      confidence: 1,
      timingUncertaintyMs: 0,
    }))

    const result = coachDrumSession(document, captures)

    expect(result.matches.map((match) => match.target.id)).toEqual([
      'target-1',
      'target-3',
    ])
    expect(result.matches.map((match) => match.timingOffsetMs)).toEqual([
      -10, -10,
    ])
  })

  it('uses stable source-order ties for equally optimal direct pairs', () => {
    const twoTargets = readyDocumentFixture({
      song: drumSongFixture({
        percussionTracks: [
          percussionTrackFixture({
            hits: [
              { id: 'target-a', gmKey: 38, startBeat: 0, velocity: 90 },
              {
                id: 'target-b',
                gmKey: 38,
                startBeat: 0,
                velocity: 90,
                writtenDuration: 0.5,
              },
            ],
          }),
        ],
      }),
    })
    const targetTie = coachDrumSession(
      twoTargets,
      [
        {
          id: 'capture-only',
          source: 'midi',
          gmKey: 38,
          beat: 0,
          velocity: 90,
        },
      ],
      { minimumMatchedHits: 1 },
    )
    const oneTarget = readyDocumentFixture({
      song: drumSongFixture({
        percussionTracks: [
          percussionTrackFixture({
            hits: [
              {
                id: 'target-only',
                gmKey: 38,
                startBeat: 0,
                velocity: 90,
                writtenDuration: 0.5,
              },
            ],
          }),
        ],
      }),
    })
    const captureTie = coachDrumSession(
      oneTarget,
      [
        { id: 'capture-a', source: 'midi', gmKey: 38, beat: 0, velocity: 90 },
        { id: 'capture-b', source: 'midi', gmKey: 38, beat: 0, velocity: 90 },
      ],
      { minimumMatchedHits: 1 },
    )

    expect(targetTie.matches[0]?.target.id).toBe('target-a')
    expect(captureTie.matches[0]?.captured.id).toBe('capture-a')
  })

  it('treats simultaneous authored hits as one room-mic onset cluster', () => {
    const document = readyDocumentFixture({
      song: drumSongFixture({
        percussionTracks: [
          percussionTrackFixture({
            hits: [
              { id: 'kick-together', gmKey: 36, startBeat: 0, velocity: 96 },
              {
                id: 'snare-together',
                gmKey: 38,
                startBeat: 0,
                velocity: 104,
                writtenDuration: 0.25,
              },
            ],
          }),
        ],
      }),
    })

    const result = coachDrumSession(
      document,
      [
        {
          id: 'mic-cluster',
          source: 'room-mic',
          beat: 0.02,
          confidence: 0.94,
          timingUncertaintyMs: 12,
        },
      ],
      { minimumMatchedHits: 1 },
    )

    expect(result.status).toBe('ready')
    expect(result.matches).toHaveLength(1)
    expect(result.matches[0]?.targetCluster.map((event) => event.id)).toEqual([
      'kick-together',
      'snare-together',
    ])
    expect(result.matchedHitCount).toBe(2)
  })

  it('keeps the match window fixed and withholds direction under uncertainty', () => {
    const document = readyDocumentFixture({
      song: drumSongFixture({
        percussionTracks: [
          percussionTrackFixture({
            hits: [
              { id: 'kick', gmKey: 36, startBeat: 0, velocity: 96 },
              {
                id: 'snare',
                gmKey: 38,
                startBeat: 1,
                velocity: 108,
                writtenDuration: 0.5,
              },
            ],
          }),
        ],
      }),
    })
    const outsideWindow: DrumCapturedHit[] = [
      {
        id: 'outside-1',
        source: 'room-mic',
        beat: 0.3,
        confidence: 1,
        timingUncertaintyMs: 200,
      },
      {
        id: 'outside-2',
        source: 'room-mic',
        beat: 1.3,
        confidence: 1,
        timingUncertaintyMs: 200,
      },
    ]

    const outside = coachDrumSession(document, outsideWindow, {
      minimumConfidence: 0,
    })
    expect(outside.matchedHitCount).toBe(0)

    const uncertain = coachDrumSession(document, [
      {
        id: 'uncertain-kick',
        source: 'room-mic',
        beat: 0.1,
        confidence: 1,
        timingUncertaintyMs: 80,
      },
      {
        id: 'uncertain-snare',
        source: 'room-mic',
        beat: 1.1,
        confidence: 1,
        timingUncertaintyMs: 80,
      },
    ])

    expect(uncertain.status).toBe('ready')
    expect(uncertain.confidenceLabel).toBe('Low-confidence evidence')
    expect(uncertain.uncertainTimingCount).toBe(2)
    expect(uncertain.earlyCount).toBe(0)
    expect(uncertain.lateCount).toBe(0)
    expect(uncertain.observation).toBe(
      'Capture uncertainty does not support an early-or-late direction for this take.',
    )
    expect(uncertain.recovery).toBeNull()
  })

  it.each([
    {
      label: '10 ± 80 ms',
      offsetMs: 10,
      centred: 0,
      uncertain: 2,
      late: 0,
      recovery: false,
    },
    {
      label: '100 ± 80 ms',
      offsetMs: 100,
      centred: 0,
      uncertain: 2,
      late: 0,
      recovery: false,
    },
    {
      label: '120 ± 80 ms',
      offsetMs: 120,
      centred: 0,
      uncertain: 0,
      late: 2,
      recovery: true,
    },
  ])(
    'classifies the complete uncertainty interval for $label',
    ({ offsetMs, centred, uncertain, late, recovery }) => {
      const document = readyDocumentFixture({
        song: drumSongFixture({
          percussionTracks: [
            percussionTrackFixture({
              hits: [
                { id: 'target-a', gmKey: 38, startBeat: 0, velocity: 90 },
                {
                  id: 'target-b',
                  gmKey: 38,
                  startBeat: 1,
                  velocity: 90,
                  writtenDuration: 0.5,
                },
              ],
            }),
          ],
        }),
      })
      const offsetBeats = offsetMs / 500
      const result = coachDrumSession(
        document,
        [0, 1].map((beat, index) => ({
          id: `mic-${index}`,
          source: 'room-mic' as const,
          beat: beat + offsetBeats,
          confidence: 1,
          timingUncertaintyMs: 80,
        })),
        { matchWindowMs: 121 },
      )

      expect(result.status).toBe('ready')
      expect(result.centredCount).toBe(centred)
      expect(result.uncertainTimingCount).toBe(uncertain)
      expect(result.lateCount).toBe(late)
      expect(result.recovery === null).toBe(!recovery)
    },
  )

  it('filters score and capture ranges before applying bounded analysis caps', () => {
    const earlyTargets = Array.from({ length: 2050 }, (_, index) => ({
      id: `early-target-${index}`,
      gmKey: 38,
      startBeat: index / 1000,
      velocity: 90,
    }))
    const document = readyDocumentFixture({
      song: drumSongFixture({
        percussionTracks: [
          percussionTrackFixture({
            hits: [
              ...earlyTargets,
              { id: 'late-a', gmKey: 38, startBeat: 1000, velocity: 90 },
              {
                id: 'late-b',
                gmKey: 38,
                startBeat: 1001,
                velocity: 90,
                writtenDuration: 0.5,
              },
            ],
          }),
        ],
      }),
    })
    const irrelevantCapturePrefix: DrumCapturedHit[] = Array.from(
      { length: 4097 },
      (_, index) => ({
        id: `early-capture-${index}`,
        source: 'midi' as const,
        gmKey: 38,
        beat: index / 1000,
        velocity: 90,
      }),
    )
    const captures: DrumCapturedHit[] = [
      ...irrelevantCapturePrefix,
      {
        id: 'late-capture-a',
        source: 'midi',
        gmKey: 38,
        beat: 1000,
        velocity: 90,
      },
      {
        id: 'late-capture-b',
        source: 'midi',
        gmKey: 38,
        beat: 1001,
        velocity: 90,
      },
    ]

    const result = coachDrumSession(document, captures, {
      startBeat: 999.5,
      endBeat: 1001.5,
    })

    expect(result.status).toBe('ready')
    expect(result.targetHitCount).toBe(2)
    expect(result.matchedHitCount).toBe(2)
    expect(result.matches.map((match) => match.target.id)).toEqual([
      'late-a',
      'late-b',
    ])
    expect(result.unprocessedCaptureHitCount).toBe(0)
  })

  it('does not prescribe recovery for a take within timing and velocity thresholds', () => {
    const result = coachDrumSession(readyDocumentFixture(), [
      { id: 'kick', source: 'midi', gmKey: 36, beat: 0.02, velocity: 100 },
      { id: 'snare', source: 'midi', gmKey: 38, beat: 1.02, velocity: 104 },
    ])

    expect(result.status).toBe('ready')
    expect(result.recovery).toBeNull()
  })

  it('chooses recovery from aggregate bar evidence rather than one worst hit', () => {
    const hits = [0, 1, 2, 3, 4, 5].map((startBeat, index) => ({
      id: `target-${index}`,
      gmKey: 38,
      startBeat,
      velocity: 90,
      writtenDuration: index === 5 ? 1 : undefined,
    }))
    const document = readyDocumentFixture({
      song: drumSongFixture({
        percussionTracks: [percussionTrackFixture({ hits })],
      }),
    })
    const playedBeats = [0.2, 1, 2, 3, 4.12, 5.12]
    const captures: DrumCapturedHit[] = playedBeats.map((beat, index) => ({
      id: `played-${index}`,
      source: 'midi',
      gmKey: 38,
      beat,
      velocity: 90,
    }))

    const result = coachDrumSession(document, captures)

    expect(result.status).toBe('ready')
    expect(result.recovery).toEqual(
      expect.objectContaining({ barNumber: 2, startBeat: 4, focus: 'timing' }),
    )
  })

  it('asks for a take when no captured events exist', () => {
    const result = coachDrumSession(readyDocumentFixture(), [])

    expect(result.status).toBe('no-captures')
    expect(result.dataSourceLabel).toBe('No captured input')
    expect(result.observation).toBe(
      'Play the phrase once to collect timing evidence.',
    )
  })

  describe('loop-pass scoping', () => {
    // Fixture targets: kick 0, snare 1, hat 1.5, snare 2 at 120 BPM
    // (500 ms per beat), so a 0.16-beat offset is 80 ms.
    const twoPassCaptures = (): DrumCapturedHit[] => [
      {
        id: 'p0-kick',
        source: 'midi',
        gmKey: 36,
        beat: 0,
        velocity: 96,
        pass: 0,
      },
      {
        id: 'p0-snare-1',
        source: 'midi',
        gmKey: 38,
        beat: 1,
        velocity: 108,
        pass: 0,
      },
      {
        id: 'p0-hat',
        source: 'midi',
        gmKey: 42,
        beat: 1.5,
        velocity: 72,
        pass: 0,
      },
      {
        id: 'p0-snare-2',
        source: 'midi',
        gmKey: 38,
        beat: 2,
        velocity: 104,
        pass: 0,
      },
      {
        id: 'p1-kick',
        source: 'midi',
        gmKey: 36,
        beat: 0.16,
        velocity: 96,
        pass: 1,
      },
      {
        id: 'p1-snare-1',
        source: 'midi',
        gmKey: 38,
        beat: 1.16,
        velocity: 108,
        pass: 1,
      },
      {
        id: 'p1-hat',
        source: 'midi',
        gmKey: 42,
        beat: 1.66,
        velocity: 72,
        pass: 1,
      },
      {
        id: 'p1-snare-2',
        source: 'midi',
        gmKey: 38,
        beat: 2.16,
        velocity: 104,
        pass: 1,
      },
    ]

    it('reports the scoped pass instead of the best capture from any pass', () => {
      const document = readyDocumentFixture()

      const latePass = coachDrumSession(document, twoPassCaptures(), {
        scopeToPass: 1,
      })
      expect(latePass.status).toBe('ready')
      expect(latePass.matchedHitCount).toBe(4)
      expect(latePass.meanTimingOffsetMs).toBe(80)
      expect(latePass.lateCount).toBe(4)
      expect(latePass.centredCount).toBe(0)

      const cleanPass = coachDrumSession(document, twoPassCaptures(), {
        scopeToPass: 0,
      })
      expect(cleanPass.matchedHitCount).toBe(4)
      expect(cleanPass.meanTimingOffsetMs).toBe(0)
      expect(cleanPass.centredCount).toBe(4)
    })

    it('pools every pass when unscoped, keeping the whole-take summary view', () => {
      const pooled = coachDrumSession(readyDocumentFixture(), twoPassCaptures())

      expect(pooled.matchedHitCount).toBe(4)
      expect(pooled.meanTimingOffsetMs).toBe(0)
      expect(pooled.unmatchedCaptureCount).toBe(4)
    })

    it('treats a pass with no evidence yet as an empty take', () => {
      const fresh = coachDrumSession(
        readyDocumentFixture(),
        twoPassCaptures(),
        {
          scopeToPass: 2,
        },
      )

      expect(fresh.status).toBe('no-captures')
    })

    it('scores hits without pass provenance as pass zero', () => {
      const result = coachDrumSession(
        readyDocumentFixture(),
        [
          {
            id: 'legacy-snare',
            source: 'midi',
            gmKey: 38,
            beat: 1.05,
            velocity: 108,
          },
        ],
        { scopeToPass: 0, minimumMatchedHits: 1 },
      )

      expect(result.matchedHitCount).toBe(1)
      expect(result.meanTimingOffsetMs).toBe(25)
    })
  })
})
