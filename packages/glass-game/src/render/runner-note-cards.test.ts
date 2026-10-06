// Split-window note card regressions — readable pane-local pitches follow each ordered note's existing fill.

import type { CanvasTexture, Mesh, MeshBasicMaterial } from 'three'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { runnerCourseFixture } from '../browser/__fixtures__/runner-course'
import { SINGING_CURRENT_WALL_PROFILES } from '../content/singing-current-wall-profiles'
import type { RunnerSnapshot } from '../runner/contracts'
import { createSongRunnerGame } from '../runner/game'
import { createRunnerNoteCards } from './runner-note-cards'

afterEach(() => vi.unstubAllGlobals())

describe('split-window ordered note cards', () => {
  it('keeps two large pitches clear of the mullion, advances only the supplied second fill, and owns no scoring changes', () => {
    const contexts: ReturnType<typeof drawing>[] = []

    function drawing() {
      return {
        scale: vi.fn(),
        clearRect: vi.fn(),
        beginPath: vi.fn(),
        roundRect: vi.fn(),
        fill: vi.fn(),
        stroke: vi.fn(),
        fillText: vi.fn(),
        strokeText: vi.fn(),
        save: vi.fn(),
        restore: vi.fn(),
        arc: vi.fn(),
        font: '',
        fillStyle: '',
        strokeStyle: '',
        lineWidth: 0,
        textAlign: '',
      }
    }
    vi.stubGlobal('document', {
      createElement: () => {
        const context = drawing()
        contexts.push(context)
        return { width: 0, height: 0, getContext: () => context }
      },
    })
    const anchors =
      SINGING_CURRENT_WALL_PROFILES.W03.presentation.notation.noteCards
    const cards = createRunnerNoteCards(anchors)
    const meshes = cards.plane.children as Mesh[]
    expect(meshes).toHaveLength(2)
    expect(meshes[0]!.position.x + anchors[0]!.width / 2).toBeLessThan(-0.08)
    expect(meshes[1]!.position.x - anchors[1]!.width / 2).toBeGreaterThan(0.08)
    for (const anchor of anchors) {
      expect(anchor.width).toBeGreaterThan(0.8)
      expect(anchor.height).toBeGreaterThan(0.8)
    }
    const course = runnerCourseFixture()
    const note = course.targets[0]!.notes[0]!
    const target = {
      ...course.targets[0]!,
      notes: [
        note,
        { ...note, index: 1, startOffsetSemitones: 2, endOffsetSemitones: 2 },
      ],
    }
    const snapshot: RunnerSnapshot = {
      ...createSongRunnerGame(course, { comfortableMidi: 60 }).snapshot(),
      activeTarget: {
        id: target.id,
        phase: 'judging',
        phaseStartCourseSeconds: 5,
        phaseEndCourseSeconds: 6,
        phaseProgress: 0.5,
        noteIndex: 1,
        currentTargetMidi: 62,
        pitchFeedback: {
          state: 'accepted',
          observedMidi: 62,
          comparedTargetMidi: 62,
          errorCents: 0,
          correction: null,
        },
        notes: [
          {
            index: 0,
            startMidi: 60,
            endMidi: 60,
            targetMidi: 60,
            fillProgress: 1,
            state: 'filled',
          },
          {
            index: 1,
            startMidi: 62,
            endMidi: 62,
            targetMidi: 62,
            fillProgress: 0.4,
            state: 'filling',
          },
        ],
      },
    }
    const before = JSON.stringify(snapshot)
    cards.update(target, snapshot, 60, 0)
    for (const context of contexts) {
      expect(context.fill).not.toHaveBeenCalled()
      expect(context.roundRect).not.toHaveBeenCalled()
      expect(context).toMatchObject({ shadowColor: '#173d41', shadowBlur: 4 })
      expect(context.strokeText.mock.calls).toEqual(context.fillText.mock.calls)
      expect(context.strokeText.mock.invocationCallOrder[0]).toBeLessThan(
        context.fillText.mock.invocationCallOrder[0]!,
      )
    }
    expect(contexts[0]!.fillText).toHaveBeenCalledWith('C4', 128, 180)
    expect(contexts[1]!.fillText).toHaveBeenCalledWith('D4', 128, 180)
    expect(contexts.every((context) => context.font.includes('104px'))).toBe(
      true,
    )
    expect(contexts[0]!.arc).toHaveBeenLastCalledWith(
      128,
      148,
      84,
      -Math.PI / 2,
      -Math.PI / 2 + Math.PI * 2,
    )
    expect(contexts[1]!.arc).toHaveBeenLastCalledWith(
      128,
      148,
      84,
      -Math.PI / 2,
      -Math.PI / 2 + Math.PI * 2 * 0.4,
    )
    const texture = (mesh: Mesh) =>
      (mesh.material as MeshBasicMaterial).map as CanvasTexture
    const firstVersion = texture(meshes[0]!).version
    const secondVersion = texture(meshes[1]!).version
    cards.update(
      target,
      {
        ...snapshot,
        activeTarget: {
          ...snapshot.activeTarget!,
          notes: [
            snapshot.activeTarget!.notes[0]!,
            { ...snapshot.activeTarget!.notes[1]!, fillProgress: 0.7 },
          ],
        },
      },
      60,
      0,
    )
    expect(texture(meshes[0]!).version).toBe(firstVersion)
    expect(texture(meshes[1]!).version).toBe(secondVersion + 1)
    expect(JSON.stringify(snapshot)).toBe(before)
    expect(snapshot.resolvedTargets).toHaveLength(0)
    const disposals = meshes.flatMap((mesh) => [
      vi.spyOn(mesh.geometry, 'dispose'),
      vi.spyOn(mesh.material as MeshBasicMaterial, 'dispose'),
      vi.spyOn(texture(mesh), 'dispose'),
    ])
    cards.dispose()
    cards.dispose()
    disposals.forEach((dispose) => expect(dispose).toHaveBeenCalledOnce())
  })
})
