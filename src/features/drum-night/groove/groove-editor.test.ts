// ============================================================
// Drum Night groove editor tests — deterministic canonical edits
// ============================================================

import { describe, expect, it } from 'vitest'
import type { DrumSessionDocument } from '@/features/drum-night/session/drum-session'
import { createFirstPocketGroove } from '@/features/drum-night/session/prepared-grooves'
import { activeDrumGrooveHits, applyDrumGrooveCommand, createEditableDrumGroove, DRUM_GROOVE_FAMILIES, groupDrumGrooveHits, materializeDrumGrooveDocument, MAX_DRUM_GROOVE_SWING_OFFSET_BEATS, MAX_DRUM_GROOVE_UNDO_STEPS, } from './groove-editor'

function commandState(
  state: ReturnType<typeof createEditableDrumGroove>,
  command: Parameters<typeof applyDrumGrooveCommand>[1],
): ReturnType<typeof createEditableDrumGroove> {
  const outcome = applyDrumGrooveCommand(state, command)
  expect(outcome).toMatchObject({ changed: true, reason: null })
  return outcome.state
}

function hits(document: DrumSessionDocument) {
  return document.percussionTracks.flatMap((track) => track.percussionHits)
}

describe('createEditableDrumGroove', () => {
  it('seeds a deterministic two-bar grid while retaining exact source truth', () => {
    const prepared = createFirstPocketGroove('source').document
    const sourceHit = prepared.percussionTracks[0]!.percussionHits[0]!
    sourceHit.source = {
      format: 'midi',
      channel: 9,
      midiKey: sourceHit.gmKey,
      label: 'source evidence',
    }

    const first = createEditableDrumGroove(prepared)
    const second = createEditableDrumGroove(prepared)

    expect(first).toMatchObject({
      barCount: 2,
      durationBeats: 8,
      subdivisionBeats: 0.25,
      stepCount: 32,
      swing: 0,
      density: 1,
      revision: 0,
      undoDepth: 0,
    })
    expect(first.hits.map((hit) => hit.id)).toEqual(
      second.hits.map((hit) => hit.id),
    )
    expect(
      first.hits
        .map(
          (hit) =>
            `${hit.origin.kind === 'source' ? hit.origin.sourceHitId : hit.id}:${hit.gmKey}`,
        )
        .sort(),
    ).toEqual(
      hits(prepared)
        .map((hit) => `${hit.id ?? 'anonymous'}:${hit.gmKey}`)
        .sort(),
    )
    const retainedSourceHit = first.hits.find(
      (hit) =>
        hit.origin.kind === 'source' && hit.origin.sourceHitId === sourceHit.id,
    )
    expect(retainedSourceHit?.origin).toMatchObject({
      kind: 'source',
      sourceHitId: sourceHit.id,
      authoredBeat: sourceHit.startBeat,
      sourceEvidence: sourceHit.source,
      canonicalHit: sourceHit,
    })

    sourceHit.gmKey = 81
    expect(retainedSourceHit?.gmKey).not.toBe(81)
  })

  it('supports a one-bar projection without carrying second-bar hits', () => {
    const prepared = createFirstPocketGroove('tight').document
    const state = createEditableDrumGroove(prepared, { barCount: 1 })
    const document = materializeDrumGrooveDocument(state)

    expect(state.stepCount).toBe(16)
    expect(state.hits.every((hit) => hit.stepIndex < 16)).toBe(true)
    expect(hits(document).every((hit) => hit.startBeat < 4)).toBe(true)
    expect(document.durationBeats).toBe(4)
    expect(document.canonicalSong.bpm).toBe(prepared.canonicalSong.bpm)
    expect(document.canonicalSong.tempoChanges).toEqual(
      prepared.canonicalSong.tempoChanges,
    )
  })

  it('keeps imported songs and non-common-time material outside this slice', () => {
    const prepared = createFirstPocketGroove('source').document
    expect(() =>
      createEditableDrumGroove({ ...prepared, sourceFormat: 'midi' }),
    ).toThrow(/prepared Drum Night sessions only/i)
    expect(() =>
      createEditableDrumGroove({
        ...prepared,
        canonicalSong: {
          ...prepared.canonicalSong,
          timeSignatures: [{ beat: 0, numerator: 3, denominator: 4 }],
        },
      }),
    ).toThrow(/requires 4\/4 meter/i)
  })
})

describe('applyDrumGrooveCommand', () => {
  it('adds, moves, removes, and undoes exact GM hits with replay-stable ids', () => {
    const initial = createEditableDrumGroove(
      createFirstPocketGroove('source').document,
    )
    const added = applyDrumGrooveCommand(initial, {
      type: 'add-hit',
      gmKey: 53,
      stepIndex: 11,
      velocity: 200,
    })
    expect(added).toMatchObject({ changed: true, reason: null })
    const editorHit = added.state.hits.find((hit) => hit.id === 'editor:0001')
    expect(editorHit).toMatchObject({
      gmKey: 53,
      family: 'cymbal',
      stepIndex: 11,
      velocity: 127,
      origin: { kind: 'editor', createdOrdinal: 1 },
    })

    const moved = commandState(added.state, {
      type: 'move-hit',
      hitId: editorHit!.id,
      stepIndex: 13,
    })
    expect(moved.hits.find((hit) => hit.id === editorHit!.id)).toMatchObject({
      gmKey: 53,
      stepIndex: 13,
      offsetBeats: 0,
    })
    const removed = commandState(moved, {
      type: 'remove-hit',
      hitId: editorHit!.id,
    })
    expect(removed.hits.some((hit) => hit.id === editorHit!.id)).toBe(false)

    const restored = commandState(removed, { type: 'undo' })
    expect(restored.hits.some((hit) => hit.id === editorHit!.id)).toBe(true)

    const replay = applyDrumGrooveCommand(initial, {
      type: 'add-hit',
      gmKey: 53,
      stepIndex: 11,
    })
    expect(replay.state.hits.some((hit) => hit.id === 'editor:0001')).toBe(true)
  })

  it('never folds invalid GM identity or stacks an accidental duplicate cell', () => {
    const state = createEditableDrumGroove(
      createFirstPocketGroove('tight').document,
    )
    expect(
      applyDrumGrooveCommand(state, {
        type: 'add-hit',
        gmKey: 92,
        stepIndex: 1,
      }),
    ).toMatchObject({ state, changed: false, reason: 'invalid-gm-key' })

    const existing = state.hits[0]!
    expect(
      applyDrumGrooveCommand(state, {
        type: 'add-hit',
        gmKey: existing.gmKey,
        stepIndex: existing.stepIndex,
        trackId: existing.trackId,
      }),
    ).toMatchObject({ state, changed: false, reason: 'occupied' })
  })

  it('retains authored truth when a source hit moves and reset is undoable', () => {
    const initial = createEditableDrumGroove(
      createFirstPocketGroove('source').document,
    )
    const offGrid = initial.hits.find((hit) => hit.offsetBeats !== 0)!
    const moved = commandState(initial, {
      type: 'move-hit',
      hitId: offGrid.id,
      stepIndex: offGrid.stepIndex + 1,
    })
    const movedHit = moved.hits.find((hit) => hit.id === offGrid.id)!
    expect(movedHit.offsetBeats).toBe(0)
    expect(movedHit.origin).toMatchObject({
      kind: 'source',
      authoredBeat:
        offGrid.origin.kind === 'source'
          ? offGrid.origin.authoredBeat
          : undefined,
      authoredOffsetBeats: offGrid.offsetBeats,
    })

    const reset = commandState(moved, { type: 'reset' })
    expect(reset.hits).toBe(reset.sourceHits)
    expect(reset.hits.find((hit) => hit.id === offGrid.id)?.offsetBeats).toBe(
      offGrid.offsetBeats,
    )
    const undoReset = commandState(reset, { type: 'undo' })
    expect(undoReset.hits.find((hit) => hit.id === offGrid.id)?.stepIndex).toBe(
      offGrid.stepIndex + 1,
    )
  })

  it('bounds undo snapshots without making rejected commands history', () => {
    let state = createEditableDrumGroove(
      createFirstPocketGroove('source').document,
    )
    for (let index = 0; index < MAX_DRUM_GROOVE_UNDO_STEPS + 8; index += 1) {
      state = commandState(state, {
        type: 'set-swing',
        amount: index % 2 === 0 ? 0.25 : 0.75,
      })
    }
    expect(state.undoDepth).toBe(MAX_DRUM_GROOVE_UNDO_STEPS)
    expect(state.undoHistory).toHaveLength(MAX_DRUM_GROOVE_UNDO_STEPS)

    const rejected = applyDrumGrooveCommand(state, {
      type: 'move-hit',
      hitId: 'missing',
      stepIndex: 0,
    })
    expect(rejected).toMatchObject({
      state,
      changed: false,
      reason: 'hit-not-found',
    })
  })
})

describe('non-destructive groove transforms', () => {
  it('adds triplet swing only to odd sixteenths and restores source timing at zero', () => {
    const initial = createEditableDrumGroove(
      createFirstPocketGroove('tight').document,
    )
    const straight = materializeDrumGrooveDocument(initial)
    expect(hits(straight).map((hit) => hit.startBeat)).toEqual(
      hits(initial.sourceDocument).map((hit) => hit.startBeat),
    )

    const swung = commandState(initial, { type: 'set-swing', amount: 1 })
    const materialized = materializeDrumGrooveDocument(swung)
    const byId = new Map(hits(materialized).map((hit) => [hit.id, hit]))
    for (const hit of swung.hits) {
      const projected = byId.get(
        hit.origin.kind === 'source'
          ? (hit.origin.sourceHitId ?? hit.id)
          : hit.id,
      )!
      const expectedOffset =
        hit.stepIndex % 2 === 1 ? MAX_DRUM_GROOVE_SWING_OFFSET_BEATS : 0
      expect(projected.startBeat).toBeCloseTo(
        hit.stepIndex * 0.25 + hit.offsetBeats + expectedOffset,
        8,
      )
      expect(projected.gmKey).toBe(hit.gmKey)
    }
    expect(swung.hits).toBe(initial.hits)
    expect(materializeDrumGrooveDocument(swung)).toEqual(materialized)
  })

  it('selects a deterministic monotonic density subset without deleting events', () => {
    const initial = createEditableDrumGroove(
      createFirstPocketGroove('tight').document,
    )
    const half = commandState(initial, { type: 'set-density', amount: 0.5 })
    const quarter = commandState(half, { type: 'set-density', amount: 0.25 })
    const halfIds = new Set(activeDrumGrooveHits(half).map((hit) => hit.id))
    const quarterIds = activeDrumGrooveHits(quarter).map((hit) => hit.id)

    expect(half.hits).toBe(initial.hits)
    expect(activeDrumGrooveHits(half)).toHaveLength(
      Math.round(initial.hits.length * 0.5),
    )
    expect(quarterIds.every((id) => halfIds.has(id))).toBe(true)
    expect(materializeDrumGrooveDocument(half).hitCount).toBe(halfIds.size)

    const restored = commandState(quarter, {
      type: 'set-density',
      amount: 1,
    })
    expect(activeDrumGrooveHits(restored)).toHaveLength(initial.hits.length)
    expect(restored.hits.map((hit) => hit.id)).toEqual(
      initial.hits.map((hit) => hit.id),
    )
  })

  it('publishes stable per-family groups with exact articulation metadata', () => {
    const state = commandState(
      createEditableDrumGroove(createFirstPocketGroove('loose').document),
      { type: 'set-density', amount: 0.5 },
    )
    const groups = groupDrumGrooveHits(state)

    expect(groups.map((group) => group.id)).toEqual(
      DRUM_GROOVE_FAMILIES.map((family) => family.id),
    )
    expect(groups.find((group) => group.id === 'tom')).toMatchObject({
      gmKeys: [45, 47, 48],
      hitCount: 3,
    })
    expect(groups.find((group) => group.id === 'cymbal')?.gmKeys).toEqual([
      49, 51,
    ])
    expect(
      groups.every((group) => group.activeHitCount <= group.hitCount),
    ).toBe(true)
    expect(groups.reduce((total, group) => total + group.hitCount, 0)).toBe(
      state.hits.length,
    )
  })
})

describe('load-pattern', () => {
  const patternHits = [
    { gmKey: 36, stepIndex: 0, velocity: 114, writtenDuration: 0.25 },
    { gmKey: 38, stepIndex: 4, velocity: 88, writtenDuration: 0.25 },
    { gmKey: 49, stepIndex: 0, velocity: 114, writtenDuration: 0.5 },
  ]

  it('replaces every hit with editor-origin events in one undo step', () => {
    const initial = createEditableDrumGroove(
      createFirstPocketGroove('source').document,
    )
    const loaded = commandState(initial, {
      type: 'load-pattern',
      hits: patternHits,
    })

    expect(loaded.hits).toHaveLength(3)
    expect(loaded.hits.every((hit) => hit.origin.kind === 'editor')).toBe(true)
    expect(loaded.hits.map((hit) => hit.stepIndex)).toEqual([0, 0, 4])
    expect(loaded.hits.find((hit) => hit.gmKey === 49)?.writtenDuration).toBe(
      0.5,
    )
    expect(loaded.undoDepth).toBe(1)

    const undone = commandState(loaded, { type: 'undo' })
    expect(undone.hits).toEqual(initial.hits)
  })

  it('leaves the draft untouched when any entry is unusable', () => {
    const initial = createEditableDrumGroove(
      createFirstPocketGroove('source').document,
    )

    for (const bad of [
      [],
      [
        { gmKey: 36, stepIndex: 0, velocity: 114 },
        { gmKey: 36, stepIndex: 0, velocity: 90 },
      ],
      [{ gmKey: 36, stepIndex: 999, velocity: 114 }],
      [{ gmKey: 3, stepIndex: 0, velocity: 114 }],
      [{ gmKey: 36, stepIndex: 0, velocity: 0 }],
      [{ gmKey: 36, stepIndex: 0, velocity: 114, writtenDuration: 0 }],
    ]) {
      const outcome = applyDrumGrooveCommand(initial, {
        type: 'load-pattern',
        hits: bad,
      })
      expect(outcome.changed).toBe(false)
      expect(outcome.state).toBe(initial)
    }
  })

  it('materializes the loaded pattern into the canonical document', () => {
    const loaded = commandState(
      createEditableDrumGroove(createFirstPocketGroove('source').document),
      { type: 'load-pattern', hits: patternHits },
    )
    const document = materializeDrumGrooveDocument(loaded)

    expect(hits(document)).toHaveLength(3)
    expect(hits(document).map((hit) => hit.startBeat)).toEqual([0, 0, 1])
  })
})
