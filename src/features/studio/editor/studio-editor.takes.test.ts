// Studio take keys — T and Shift+T on a focused clip of several takes play the next and the previous, round and round, each one undo step; a clip of one take, typing and Alt leave T alone.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { studioClipActiveTake, studioClipWithTakes, } from '@/lib/studio/model/clip-takes'
import { createStudioHistory, executeStudioCommand, undoStudioCommand, } from '@/lib/studio/model/history'
import { studioFixture } from '@/lib/studio/model/model.test-fixtures'
import type { StudioClip } from '@/lib/studio/model/types'
import { createStudioEditor } from './studio-editor'

const cleanups: (() => void)[] = []
afterEach(() => {
  cleanups.splice(0).forEach((cleanup) => cleanup())
  document.body.replaceChildren()
})

/** clip-1 of three takes, the newest playing, focused in its lane; or of one loop take of three passes, its third playing. */
function takesEditor(takes = 3, loop = false) {
  const { project, asset, clip } = studioFixture()
  const assets = Array.from({ length: takes }, (_, index) =>
    index === 0
      ? asset
      : {
          ...asset,
          id: `asset-${index + 1}`,
          canonicalPcmId: `pcm-${index + 1}`,
        },
  )
  const list: StudioClip[] = assets.map((each) => ({
    ...clip,
    assetId: each.id,
    ...(loop && {
      sourceInFrame: 200,
      sourceOutFrame: 300,
      passes: { firstFrame: 0, frames: 100, count: 3 },
      fades: { curve: 'linear-amplitude' as const },
    }),
  }))
  let history = createStudioHistory({
    ...project,
    clips: [studioClipWithTakes(list, takes - 1)],
  })
  const lane = document.createElement('div')
  lane.dataset.studioTrack = 'track-1'
  const button = document.createElement('button')
  button.dataset.studioClip = clip.id
  lane.append(button)
  document.body.append(lane)
  const announce = vi.fn()
  const editor = createStudioEditor({
    project: () => history.present,
    writable: () => true,
    pixelsPerSecond: () => 120,
    playheadFrame: () => 0,
    previewClip: () => undefined,
    dispatch: (command) => {
      history = executeStudioCommand(history, command, { assets })
      return true
    },
    selectClip: vi.fn(),
    announce,
    focusClip: vi.fn(),
  })
  lane.addEventListener('keydown', editor.keyDown)
  cleanups.push(editor.dispose)
  const press = (key: string, options: KeyboardEventInit = {}) => {
    const event = new KeyboardEvent('keydown', {
      key,
      bubbles: true,
      cancelable: true,
      ...options,
    })
    button.dispatchEvent(event)
    return event
  }
  return {
    press,
    announce,
    playing: () => studioClipActiveTake(history.present.clips[0]),
    clip: () => history.present.clips[0],
    undo: () => {
      history = undoStudioCommand(history, { assets })
    },
  }
}

describe('Studio take keys', () => {
  it('T plays the next take and Shift+T the previous, round and round, each one undo step', () => {
    const editor = takesEditor()
    expect(editor.playing()).toBe(2)
    expect(editor.press('t').defaultPrevented).toBe(true)
    expect(editor.playing()).toBe(0)
    expect(editor.announce).toHaveBeenLastCalledWith('Playing take 1 of 3.')
    editor.press('T', { shiftKey: true })
    expect(editor.playing()).toBe(2)
    editor.press('T', { shiftKey: true })
    expect(editor.playing()).toBe(1)
    editor.undo()
    expect(editor.playing()).toBe(2)
  })

  it('steps through the passes of a loop take alone, which keeps no takes', () => {
    const editor = takesEditor(1, true)
    expect(editor.clip()).toMatchObject({ sourceInFrame: 200 })
    editor.press('t')
    expect(editor.clip()).toMatchObject({ sourceInFrame: 0 })
    expect(editor.clip().takes).toBeUndefined()
    expect(editor.announce).toHaveBeenLastCalledWith('Playing take 1 of 3.')
    editor.press('T', { shiftKey: true })
    expect(editor.clip()).toMatchObject({ sourceInFrame: 200 })
  })

  it('leaves T to the page on a clip of one take and with Ctrl, and swallows a held T on a clip of takes without stepping', () => {
    const one = takesEditor(1)
    expect(one.press('t').defaultPrevented).toBe(false)
    expect(
      one.press('T', { shiftKey: true, altKey: true }).defaultPrevented,
    ).toBe(false)
    const three = takesEditor()
    expect(three.press('t', { ctrlKey: true }).defaultPrevented).toBe(false)
    expect(three.press('t', { repeat: true }).defaultPrevented).toBe(true)
    expect(three.playing()).toBe(2)
  })

  it('crops the clip to the take it plays on Alt+Shift+T as one undo step, whatever character a Mac reports for it', () => {
    const editor = takesEditor()
    const event = editor.press('ˇ', {
      shiftKey: true,
      altKey: true,
      code: 'KeyT',
    })
    expect(event.defaultPrevented).toBe(true)
    expect(editor.clip().takes).toBeUndefined()
    expect(editor.clip().assetId).toBe('asset-3')
    expect(editor.announce).toHaveBeenLastCalledWith(
      'Cropped to the take that plays.',
    )
    editor.undo()
    expect(editor.clip().takes).toHaveLength(2)
  })
})
