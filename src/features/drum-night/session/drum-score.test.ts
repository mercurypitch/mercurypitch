// Drum Night score tests — whole-song queries, authored meter, and groove offsets.

import { describe, expect, it } from 'vitest'
import { createDrumScoreIndex, drumScoreBeatX, drumScoreEventsNearBeat, drumScoreNextEvent, drumScoreVoiceForGmKey, drumScoreWindow, MAX_DRUM_SCORE_EVENTS, MAX_DRUM_SEMANTIC_EVENTS, projectDrumGroove, projectDrumScore, queryDrumScoreRange, } from './drum-score'
import { drumSongFixture, percussionTrackFixture, readyDocumentFixture, } from './drum-session.test-fixtures'

function irregularDocument() {
  const song = drumSongFixture({
    percussionTracks: [
      percussionTrackFixture({
        hits: [
          { id: 'kick', gmKey: 36, startBeat: 0, velocity: 118 },
          { id: 'hat', gmKey: 42, startBeat: 1.1, velocity: 64 },
          { id: 'snare', gmKey: 38, startBeat: 3.5, velocity: 102 },
          { id: 'tambourine', gmKey: 54, startBeat: 4, velocity: 76 },
        ],
        droppedHitCount: 2,
      }),
    ],
  })
  song.timeSignatures = [{ beat: 0, numerator: 3, denominator: 4 }]
  return readyDocumentFixture({ song })
}

describe('projectDrumScore', () => {
  it('keeps exact authored hits while placing local queries into source-meter bars', () => {
    const document = irregularDocument()
    const score = projectDrumScore(document)
    const query = queryDrumScoreRange(createDrumScoreIndex(document), {
      startBeat: 0,
      endBeat: score.coverageEndBeat,
    })

    expect(score.bars.slice(0, 2)).toEqual([
      { index: 0, startBeat: 0, beats: 3 },
      { index: 1, startBeat: 3, beats: 3 },
    ])
    expect(query.events.map((event) => event.hit.startBeat)).toEqual([
      0, 1.1, 3.5, 4,
    ])
    expect(query.events[2]).toEqual(
      expect.objectContaining({ barIndex: 1, beatInBar: 0.5 }),
    )
    expect(score.droppedHitCount).toBe(2)
    expect(document.percussionTracks[0]?.percussionHits[1]?.startBeat).toBe(1.1)
  })

  it('does not invent an empty bar after a phrase ends on a bar line', () => {
    const document = readyDocumentFixture({
      song: drumSongFixture({
        percussionTracks: [
          percussionTrackFixture({
            hits: [
              {
                id: 'final-hat',
                gmKey: 42,
                startBeat: 7.5,
                velocity: 82,
                writtenDuration: 0.5,
              },
            ],
          }),
        ],
      }),
    })

    expect(document.durationBeats).toBe(8)
    expect(projectDrumScore(document).bars).toHaveLength(2)
  })

  it('sorts only its reusable index and leaves canonical track order unchanged', () => {
    const document = readyDocumentFixture({
      song: drumSongFixture({
        percussionTracks: [
          percussionTrackFixture({
            hits: [
              { id: 'authored-late', gmKey: 38, startBeat: 2, velocity: 90 },
              { id: 'authored-early', gmKey: 36, startBeat: 0, velocity: 96 },
            ],
          }),
        ],
      }),
    })
    const index = createDrumScoreIndex(document)
    const query = queryDrumScoreRange(index, { startBeat: 0, endBeat: 3 })

    expect(query.events.map((event) => event.id)).toEqual([
      'authored-early',
      'authored-late',
    ])
    expect(
      document.percussionTracks[0]?.percussionHits.map((hit) => hit.id),
    ).toEqual(['authored-late', 'authored-early'])
  })

  it('uses percussion notation and physical anchors without treating GM as pitch', () => {
    expect(drumScoreVoiceForGmKey(36)).toEqual(
      expect.objectContaining({
        label: 'Bass Drum 1',
        family: 'kick',
        seatAnchor: 'kick',
        notehead: 'normal',
      }),
    )
    expect(drumScoreVoiceForGmKey(42)).toEqual(
      expect.objectContaining({
        family: 'hi-hat',
        seatAnchor: 'hi-hat',
        notehead: 'cross',
      }),
    )
    expect(drumScoreVoiceForGmKey(54)).toEqual(
      expect.objectContaining({
        label: 'Tambourine',
        family: 'auxiliary',
        seatAnchor: 'auxiliary',
        notehead: 'diamond',
      }),
    )
  })

  it('maps the playhead within unequal source bars rather than a global grid', () => {
    const score = projectDrumScore(irregularDocument())

    expect(drumScoreBeatX(score, 1.5, 220, 64)).toBe(174)
    expect(drumScoreBeatX(score, 4.5, 220, 64)).toBe(394)
  })

  it('queries a late phrase below bar 4096 even after a dense opening', () => {
    const earlyHits = Array.from(
      { length: MAX_DRUM_SCORE_EVENTS + 7 },
      (_, index) => ({
        id: `roll-${index}`,
        gmKey: 38,
        startBeat: index / 1000,
        velocity: 90,
      }),
    )
    const document = readyDocumentFixture({
      song: drumSongFixture({
        percussionTracks: [
          percussionTrackFixture({
            hits: [
              ...earlyHits,
              { id: 'late-pocket', gmKey: 36, startBeat: 12_000, velocity: 99 },
              { id: 'beyond-bars', gmKey: 42, startBeat: 20_000, velocity: 70 },
            ],
          }),
        ],
      }),
    })
    const index = createDrumScoreIndex(document)
    const opening = queryDrumScoreRange(index, { startBeat: 0, endBeat: 4 })
    const late = queryDrumScoreRange(index, {
      startBeat: 11_999,
      endBeat: 12_001,
    })
    const lateWindow = drumScoreWindow(index, 12_000, { barCount: 2 })

    expect(index.score.bars).toHaveLength(4096)
    expect(opening.events).toHaveLength(MAX_DRUM_SCORE_EVENTS)
    expect(opening.omittedEventCount).toBe(7)
    expect(late.events.map((event) => event.id)).toEqual(['late-pocket'])
    expect(lateWindow.events.map((event) => event.id)).toEqual(['late-pocket'])
    expect(drumScoreEventsNearBeat(index, 12_000, 0.001).events).toEqual([
      expect.objectContaining({ id: 'late-pocket' }),
    ])
    expect(drumScoreNextEvent(index, 11_999)?.id).toBe('late-pocket')
    expect(index.score.outOfRangeHitCount).toBe(1)
    expect(index.score.hitCount).toBe(MAX_DRUM_SCORE_EVENTS + 9)
    expect(lateWindow.events.some((event) => event.id === 'beyond-bars')).toBe(
      false,
    )
  })

  it('bounds each requested score window and its semantic event list locally', () => {
    const hits = Array.from(
      { length: MAX_DRUM_SCORE_EVENTS + 9 },
      (_, index) => ({
        id: `dense-${index}`,
        gmKey: index % 2 === 0 ? 36 : 38,
        startBeat: index / 1000,
        velocity: 70 + (index % 30),
      }),
    )
    const document = readyDocumentFixture({
      song: drumSongFixture({
        percussionTracks: [percussionTrackFixture({ hits })],
      }),
    })
    const index = createDrumScoreIndex(document)
    const desktop = drumScoreWindow(index, 0, { barCount: 4 })
    const phone = drumScoreWindow(index, 0, { barCount: 2 })

    expect(desktop.bars.length).toBeLessThanOrEqual(4)
    expect(phone.bars.length).toBeLessThanOrEqual(2)
    expect(desktop.events).toHaveLength(MAX_DRUM_SCORE_EVENTS)
    expect(desktop.omittedEventCount).toBe(9)
    expect(desktop.semanticEvents).toHaveLength(MAX_DRUM_SEMANTIC_EVENTS)
    expect(desktop.semanticOmittedCount).toBe(
      MAX_DRUM_SCORE_EVENTS - MAX_DRUM_SEMANTIC_EVENTS,
    )
    expect(drumScoreEventsNearBeat(index, 1, 0).events).toEqual([
      expect.objectContaining({ id: 'dense-1000' }),
    ])
    expect(drumScoreNextEvent(index, 1)?.id).toBe('dense-1001')
  })

  it('retains normalized authored meter even when bar lengths coincide', () => {
    const sixEightSong = drumSongFixture()
    sixEightSong.timeSignatures = [{ beat: 0, numerator: 6, denominator: 8 }]
    const threeFourSong = drumSongFixture()
    threeFourSong.timeSignatures = [{ beat: 0, numerator: 3, denominator: 4 }]

    const sixEight = projectDrumScore(
      readyDocumentFixture({ song: sixEightSong }),
    )
    const threeFour = projectDrumScore(
      readyDocumentFixture({ song: threeFourSong }),
    )

    expect(sixEight.bars[0]?.beats).toBe(3)
    expect(threeFour.bars[0]?.beats).toBe(3)
    expect(sixEight.timeSignatures[0]).toEqual(
      expect.objectContaining({ numerator: 6, denominator: 8 }),
    )
    expect(threeFour.timeSignatures[0]).toEqual(
      expect.objectContaining({ numerator: 3, denominator: 4 }),
    )
  })

  it('retains a normalized meter change at its authored bar boundary', () => {
    const song = drumSongFixture({
      percussionTracks: [
        percussionTrackFixture({
          hits: [
            { id: 'opening', gmKey: 36, startBeat: 0, velocity: 90 },
            { id: 'seven-eight', gmKey: 38, startBeat: 4, velocity: 90 },
          ],
        }),
      ],
    })
    song.timeSignatures = [
      { beat: 0, numerator: 4, denominator: 4 },
      { beat: 4, numerator: 7, denominator: 8 },
    ]

    const score = projectDrumScore(readyDocumentFixture({ song }))

    expect(score.timeSignatures).toEqual(song.timeSignatures)
    expect(score.bars.slice(0, 2)).toEqual([
      { index: 0, startBeat: 0, beats: 4 },
      { index: 1, startBeat: 4, beats: 3.5 },
    ])
  })
})

describe('projectDrumGroove', () => {
  it('retains fractional authored timing beside its nearest display step', () => {
    const document = irregularDocument()

    const groove = projectDrumGroove(document, {
      startBeat: 0,
      endBeat: 3,
      subdivisionBeats: 0.25,
    })

    const hat = groove.steps
      .flatMap((step) => step.hits)
      .find((hit) => hit.event.id === 'hat')
    expect(hat).toEqual(expect.objectContaining({ gridBeat: 1 }))
    expect(hat?.offsetBeats).toBeCloseTo(0.1)
    expect(hat?.event.hit.startBeat).toBe(1.1)
    expect(groove.offGridHitCount).toBe(1)
    expect(groove.steps[0]?.peakVelocity).toBe(118)
    expect(groove.rangeTruncated).toBe(false)
  })

  it('returns no grid steps for a zero-length requested range', () => {
    const groove = projectDrumGroove(irregularDocument(), {
      startBeat: 2,
      endBeat: 2,
    })

    expect(groove.steps).toEqual([])
    expect(groove.offGridHitCount).toBe(0)
  })
})
