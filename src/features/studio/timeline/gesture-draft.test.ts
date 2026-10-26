// Studio gesture geometry tests — frame bounds, deterministic snap and immutable fade anchors.
import { describe, expect, it } from 'vitest'
import { studioFixture } from '@/lib/studio/model/model.test-fixtures'
import type { StudioGestureInput } from './gesture-draft'
import { draftStudioGesture, STUDIO_NEW_LANE, studioGestureCommand, } from './gesture-draft'
import { snapStudioPosition, studioGridFrame, studioGridInterval, } from './timeline-snap'

function fixture(): StudioGestureInput {
  const { project, asset, clip } = studioFixture()
  return {
    project,
    asset,
    clip,
    kind: 'move',
    deltaFrames: 0,
    targetTrackId: clip.trackId,
    pixelsPerSecond: 120,
    playheadFrame: 0,
    snap: false,
  }
}

describe('Studio gesture drafts', () => {
  it('preserves offset-derived movement and source/fade coordinates without mutating the project', () => {
    const input = fixture()
    const before = structuredClone(input.project)
    const result = draftStudioGesture({ ...input, deltaFrames: 48000 })
    expect(result.clip).toEqual({
      ...input.clip,
      startFrame: input.clip.startFrame + 48000,
    })
    expect(input.project).toEqual(before)
    expect(studioGestureCommand(result, input.clip)).toEqual({
      type: 'move-clip',
      clipId: input.clip.id,
      trackId: input.clip.trackId,
      startFrame: input.clip.startFrame + 48000,
    })
  })

  it('rejects occupied moves while allowing exact adjacency and an explicit new lane', () => {
    const input = fixture()
    input.project = {
      ...input.project,
      clips: [
        ...input.project.clips,
        { ...input.clip, id: 'other', startFrame: 2000 },
      ],
    }
    const occupied = draftStudioGesture({ ...input, deltaFrames: 1900 })
    expect(occupied.valid).toBe(false)
    expect(occupied.message).toMatch(/overlaps another clip/)
    expect(studioGestureCommand(occupied, input.clip)).toBeNull()
    expect(draftStudioGesture({ ...input, deltaFrames: 900 }).valid).toBe(true)
    const newLane = draftStudioGesture({
      ...input,
      deltaFrames: 1900,
      targetTrackId: STUDIO_NEW_LANE,
    })
    expect(studioGestureCommand(newLane, input.clip)).toMatchObject({
      type: 'move-clip-to-new-track',
      clipId: input.clip.id,
      startFrame: 2000,
    })
  })

  it('clamps trims to source bounds, a nonnegative timeline and one remaining frame', () => {
    const input = fixture()
    const head = draftStudioGesture({
      ...input,
      kind: 'trim-head',
      deltaFrames: 99999,
    })
    expect(head.clip.sourceInFrame).toBe(999)
    expect(head.clip.startFrame).toBe(1099)
    expect(head.clip.fades).toEqual(input.clip.fades)
    const tail = draftStudioGesture({
      ...input,
      kind: 'trim-tail',
      deltaFrames: -99999,
    })
    expect(tail.clip.sourceOutFrame).toBe(1)
    expect(
      draftStudioGesture({ ...input, kind: 'trim-tail', deltaFrames: 99999 })
        .clip.sourceOutFrame,
    ).toBe(1000)
    const partial = { ...input.clip, startFrame: 20, sourceInFrame: 100 }
    expect(
      draftStudioGesture({
        ...input,
        clip: partial,
        kind: 'trim-head',
        deltaFrames: -99,
      }).clip,
    ).toMatchObject({ startFrame: 0, sourceInFrame: 80 })
  })

  it('adjusts a retained fade in source space and preserves it during a later trim', () => {
    const input = fixture()
    const clip = { ...input.clip, sourceInFrame: 100, sourceOutFrame: 900 }
    const fade = draftStudioGesture({
      ...input,
      clip,
      kind: 'fade-in',
      deltaFrames: 50,
    })
    expect(fade.clip.fades.in).toEqual({
      fromSourceFrame: 0,
      toSourceFrame: 250,
    })
    expect(fade.clip.fades.out).toEqual(clip.fades.out)
    const trimmed = draftStudioGesture({
      ...input,
      clip: fade.clip,
      kind: 'trim-head',
      deltaFrames: 20,
    })
    expect(trimmed.clip.fades).toEqual(fade.clip.fades)
    const bounded = draftStudioGesture({
      ...input,
      kind: 'fade-in',
      deltaFrames: 99999,
    })
    expect(bounded.clip.fades.in?.toSourceFrame).toBe(
      input.clip.fades.out?.fromSourceFrame,
    )
  })

  it('keeps a zero-distance draft a no-op', () => {
    const input = fixture()
    expect(
      studioGestureCommand(draftStudioGesture(input), input.clip),
    ).toBeNull()
  })
})

describe('Studio snap targets', () => {
  const snap = {
    value: 0,
    min: 0,
    max: 480000,
    pixelsPerSecond: 120,
    playheadFrame: 48000,
    clips: [],
    excludeClipId: 'moving',
    enabled: true,
  }
  it('uses an eight-pixel tolerance and an explicit bypass', () => {
    expect(snapStudioPosition({ ...snap, value: 48000 + 3200 })).toEqual({
      value: 48000,
      target: 48000,
    })
    expect(snapStudioPosition({ ...snap, value: 48000 + 3201 })).toEqual({
      value: 51201,
      target: null,
    })
    expect(
      snapStudioPosition({ ...snap, value: 50000, enabled: false }),
    ).toEqual({ value: 50000, target: null })
  })
  it('snaps a trailing edge and resolves equal-distance targets in stable priority order', () => {
    expect(
      snapStudioPosition({ ...snap, value: 46000, offsets: [0, 1000] }),
    ).toEqual({ value: 47000, target: 48000 })
    const { clip } = studioFixture()
    expect(
      snapStudioPosition({
        ...snap,
        value: 49000,
        clips: [{ ...clip, id: 'other', startFrame: 50000 }],
      }).target,
    ).toBe(48000)
  })
  it('rounds absolute musical targets once at fractional tempos', () => {
    const interval = studioGridInterval(120, 123)
    expect(Number.isInteger(interval)).toBe(false)
    expect(studioGridFrame(10001, 120, 123)).toBe(Math.round(10001 * interval))
    expect(studioGridFrame(10001, 120, 123)).not.toBe(
      10001 * Math.round(interval),
    )
  })
})
