// Studio clip take menu tests — a clip's takes as radio rows, the playing one checked, then Show takes or Hide takes; a pick plays its step and the playing one changes nothing, and a loop take alone lists its passes with nothing to show.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { studioClipWithTakes } from '@/lib/studio/model/clip-takes'
import { studioFixture } from '@/lib/studio/model/model.test-fixtures'
import type { StudioAsset, StudioClip } from '@/lib/studio/model/types'
import { studioClipTakeMenu } from './clip-take-menu'
import { closeStudioTakes, studioTakesClipId } from './comp-editor'

afterEach(() => closeStudioTakes())

function takes(count: number) {
  const { asset, clip } = studioFixture()
  const assets = new Map<string, StudioAsset>(
    Array.from({ length: count }, (_, index) => {
      const id = `take-${index + 1}`
      return [id, { ...asset, id, originalName: `Take ${index + 1}.wav` }]
    }),
  )
  const list: StudioClip[] = [...assets.keys()].map((assetId) => ({
    ...clip,
    assetId,
  }))
  return { clip: studioClipWithTakes(list, count - 1), assets }
}

describe('Studio clip take menu', () => {
  it('lists the takes, the playing one checked, then Show takes, which opens them and then reads Hide takes', () => {
    const { clip, assets } = takes(2)
    const onCommand = vi.fn(() => true)
    const items = studioClipTakeMenu(clip, assets, onCommand, true)
    expect(
      items.map(({ label, checked, separatorBefore }) => ({
        label,
        checked,
        separatorBefore,
      })),
    ).toEqual([
      { label: 'Take 1', checked: false, separatorBefore: undefined },
      { label: 'Take 2', checked: true, separatorBefore: undefined },
      { label: 'Show takes', checked: undefined, separatorBefore: true },
    ])
    items[1].onSelect()
    expect(onCommand).not.toHaveBeenCalled()
    items[0].onSelect()
    expect(onCommand).toHaveBeenCalledWith({
      type: 'choose-take',
      clipId: clip.id,
      take: 0,
    })
    items[2].onSelect()
    expect(studioTakesClipId()).toBe(clip.id)
    const again = studioClipTakeMenu(clip, assets, onCommand, true)
    expect(again[2].label).toBe('Hide takes')
    again[2].onSelect()
    expect(studioTakesClipId()).toBeNull()
  })

  it('lists the passes of a loop take alone, with no takes to show, and none to choose in a song that cannot be changed', () => {
    const { clip, assets } = takes(1)
    const loop: StudioClip = {
      ...clip,
      sourceInFrame: 200,
      sourceOutFrame: 300,
      passes: { firstFrame: 0, frames: 100, count: 3 },
    }
    const items = studioClipTakeMenu(loop, assets, vi.fn(), false)
    expect(items.map((item) => item.label)).toEqual([
      'Take 1, pass 1 of 3',
      'Take 1, pass 2 of 3',
      'Take 1, pass 3 of 3',
    ])
    expect(items.every((item) => item.disabled === true)).toBe(true)
  })
})
