// ============================================================
// Drum groove draft controller tests — isolated variation drafts and gestures
// ============================================================

import { createRoot } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createDrumGrooveDraftController } from './drum-groove-draft-controller'

const disposers: Array<() => void> = []

function controller(
  options?: Parameters<typeof createDrumGrooveDraftController>[0],
) {
  return createRoot((dispose) => {
    disposers.push(dispose)
    return createDrumGrooveDraftController(options)
  })
}

afterEach(() => {
  for (const dispose of disposers.splice(0)) dispose()
})

describe('createDrumGrooveDraftController', () => {
  it('keeps one independent session-local draft per prepared variation', () => {
    const drafts = controller()

    const classic = drafts.addHit(51, 2)
    expect(classic.changed).toBe(true)
    const classicHitId = classic.state.hits.find(
      (hit) => hit.gmKey === 51 && hit.stepIndex === 2,
    )?.id
    expect(classicHitId).toBe('editor:0001')

    drafts.selectVariant('tight')
    expect(drafts.state().hits.some((hit) => hit.id === classicHitId)).toBe(
      false,
    )
    const funk = drafts.addHit(48, 3)
    expect(funk.state.hits).toContainEqual(
      expect.objectContaining({ id: 'editor:0001', gmKey: 48, stepIndex: 3 }),
    )

    drafts.selectVariant('source')
    expect(drafts.state().hits).toContainEqual(
      expect.objectContaining({ id: classicHitId, gmKey: 51, stepIndex: 2 }),
    )
    expect(drafts.draftFor('tight').hits).toContainEqual(
      expect.objectContaining({ id: 'editor:0001', gmKey: 48, stepIndex: 3 }),
    )
  })

  it('keeps document identity stable for selection, paging, and local previews', () => {
    const onChange = vi.fn()
    const drafts = controller({ onChange })
    const initialDocument = drafts.document()
    const kick = drafts
      .state()
      .hits.find((hit) => hit.gmKey === 36 && hit.stepIndex === 0)!

    expect(drafts.selectHit(kick.id)).toBe(true)
    drafts.setPageSize(4)
    drafts.nextPage()
    drafts.setPageIndex(0)
    expect(drafts.beginMovePreview(kick.id)).toBe(true)
    expect(drafts.updateMovePreview(2)).toBe(true)
    expect(drafts.document()).toBe(initialDocument)
    expect(onChange).not.toHaveBeenCalled()

    const outcome = drafts.commitMovePreview()
    expect(outcome?.changed).toBe(true)
    expect(drafts.document()).not.toBe(initialDocument)
    expect(onChange).toHaveBeenCalledOnce()
    expect(onChange.mock.calls[0]?.[0]).toMatchObject({
      variantId: 'source',
      command: { type: 'move-hit', hitId: kick.id, stepIndex: 2 },
    })
  })

  it('commits one valid drag command and rejects occupied previews', () => {
    const onChange = vi.fn()
    const drafts = controller({ onChange })
    const kick = drafts
      .state()
      .hits.find((hit) => hit.gmKey === 36 && hit.stepIndex === 0)!

    drafts.beginMovePreview(kick.id)
    expect(drafts.updateMovePreview(2)).toBe(true)
    expect(drafts.updateMovePreview(3)).toBe(true)
    expect(drafts.commitMovePreview()).toMatchObject({ changed: true })
    expect(onChange).toHaveBeenCalledOnce()
    expect(drafts.state().revision).toBe(1)

    const movedKick = drafts.state().hits.find((hit) => hit.id === kick.id)!
    const occupiedStep = drafts
      .state()
      .hits.find(
        (hit) => hit.gmKey === 36 && hit.id !== movedKick.id,
      )!.stepIndex
    drafts.beginMovePreview(movedKick.id)
    expect(drafts.updateMovePreview(occupiedStep)).toBe(false)
    expect(drafts.movePreview()).toMatchObject({ valid: false })
    expect(drafts.commitMovePreview()).toBeNull()
    expect(onChange).toHaveBeenCalledOnce()
    expect(drafts.state().revision).toBe(1)
  })

  it('preserves the visible musical position when page size changes', () => {
    const drafts = controller()

    drafts.setPageSize(4)
    drafts.setPageIndex(5)
    expect(drafts.pageStartStep()).toBe(20)
    drafts.setPageSize(8)
    expect(drafts.pageStartStep()).toBe(16)
    drafts.setPageSize(16)
    expect(drafts.pageStartStep()).toBe(16)
    expect(drafts.pageCount()).toBe(2)
  })

  it('clears invalid selection after remove and restores through undo', () => {
    const drafts = controller()
    const added = drafts.addHit(48, 1)
    const hit = added.state.hits.find(
      (candidate) => candidate.gmKey === 48 && candidate.stepIndex === 1,
    )!

    expect(drafts.selectedHitId()).toBe(hit.id)
    expect(drafts.removeSelectedHit()).toMatchObject({ changed: true })
    expect(drafts.selectedHit()).toBeNull()
    expect(drafts.undo()).toMatchObject({ changed: true })
    expect(
      drafts.state().hits.some((candidate) => candidate.id === hit.id),
    ).toBe(true)
  })

  it('atomically restores validated project drafts without reporting an edit', () => {
    const onChange = vi.fn()
    const source = controller()
    source.addHit(51, 2)
    source.selectVariant('tight')
    source.addHit(48, 3)

    const restored = controller({ onChange })
    expect(
      restored.replaceDrafts(
        {
          source: source.draftFor('source'),
          tight: source.draftFor('tight'),
          loose: source.draftFor('loose'),
          'half-time': source.draftFor('half-time'),
        },
        'tight',
      ),
    ).toBe(true)

    expect(restored.variantId()).toBe('tight')
    expect(restored.state().hits).toContainEqual(
      expect.objectContaining({ id: 'editor:0001', gmKey: 48, stepIndex: 3 }),
    )
    expect(restored.draftFor('source').hits).toContainEqual(
      expect.objectContaining({ id: 'editor:0001', gmKey: 51, stepIndex: 2 }),
    )
    expect(restored.selectedHitId()).toBeNull()
    expect(restored.pageIndex()).toBe(0)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('leaves every live draft untouched when a restore candidate is invalid', () => {
    const drafts = controller()
    const before = drafts.document()
    const invalid = {
      source: drafts.draftFor('source'),
      tight: drafts.draftFor('tight'),
      loose: drafts.draftFor('loose'),
      'half-time': {
        ...drafts.draftFor('half-time'),
        sourceDocument: {
          ...drafts.draftFor('half-time').sourceDocument,
          sourceFormat: 'midi' as const,
        },
      },
    }

    expect(drafts.canReplaceDrafts(invalid, 'source')).toBe(false)
    expect(drafts.replaceDrafts(invalid, 'source')).toBe(false)
    expect(drafts.document()).toBe(before)
    expect(drafts.variantId()).toBe('source')
  })
})
