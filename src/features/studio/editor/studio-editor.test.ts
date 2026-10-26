// Studio keyboard regressions — native focus, one-step held edits and clipboard ownership use real model commands.
import { createComputed, createRoot, createSignal } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createStudioTrack } from '@/lib/studio/model/defaults'
import { createStudioHistory, executeStudioCommand, redoStudioCommand, undoStudioCommand, } from '@/lib/studio/model/history'
import { studioFixture } from '@/lib/studio/model/model.test-fixtures'
import type { StudioClip } from '@/lib/studio/model/types'
import { studioGridInterval } from '../timeline/timeline-snap'
import { createStudioEditor } from './studio-editor'

const cleanups: (() => void)[] = []
afterEach(() => {
  cleanups.splice(0).forEach((cleanup) => cleanup())
  document.body.replaceChildren()
})

function editorFixture() {
  const fixture = studioFixture()
  let history = createStudioHistory(fixture.project)
  let writable = true
  let zoom = 120
  let playhead = 150
  let preview: StudioClip | null = null
  let sequence = 0
  const root = document.createElement('div')
  const lane = document.createElement('div')
  lane.dataset.studioTrack = 'track-1'
  const clip = document.createElement('button')
  clip.dataset.studioClip = fixture.clip.id
  const header = document.createElement('button')
  header.dataset.studioTrackHeader = 'track-1'
  lane.append(header, clip)
  root.append(lane)
  document.body.append(root)
  const announce = vi.fn()
  const focus = vi.fn()
  const selection = vi.fn()
  const dispatch = vi.fn((command) => {
    history = executeStudioCommand(history, command, {
      assets: [fixture.asset],
    })
    return true
  })
  const editor = createStudioEditor({
    project: () => history.present,
    writable: () => writable,
    pixelsPerSecond: () => zoom,
    playheadFrame: () => playhead,
    previewClip: (value) => {
      preview = value
    },
    dispatch,
    selectClip: selection,
    announce,
    focusClip: focus,
    createId: () => `generated-${++sequence}`,
  })
  root.addEventListener('keydown', editor.keyDown)
  root.addEventListener('keyup', editor.keyUp)
  cleanups.push(editor.dispose)
  const key = (
    target: HTMLElement,
    type: 'keydown' | 'keyup',
    value: string,
    options: KeyboardEventInit = {},
  ) => {
    const event = new KeyboardEvent(type, {
      key: value,
      bubbles: true,
      cancelable: true,
      ...options,
    })
    target.dispatchEvent(event)
    return event
  }
  return {
    ...fixture,
    root,
    lane,
    clip,
    header,
    editor,
    key,
    dispatch,
    announce,
    focus,
    selection,
    state: () => history,
    preview: () => preview,
    setWritable: (value: boolean) => {
      writable = value
      editor.sync()
    },
    setZoom: (value: number) => {
      zoom = value
      editor.sync()
    },
    setPlayhead: (value: number) => {
      playhead = value
    },
    replace: (project: typeof fixture.project) => {
      history = createStudioHistory(project)
      editor.sync()
    },
    undo: () => {
      history = undoStudioCommand(history, { assets: [fixture.asset] })
      editor.sync()
    },
    redo: () => {
      history = redoStudioCommand(history, { assets: [fixture.asset] })
      editor.sync()
    },
  }
}

describe('Studio keyboard edits', () => {
  it('subscribes to ownership before a draft begins so lease loss clears its preview immediately', () => {
    const f = editorFixture()
    createRoot((dispose) => {
      cleanups.push(dispose)
      const [writable, setWritable] = createSignal(true)
      const preview = vi.fn()
      const editor = createStudioEditor({
        project: () => f.project,
        writable,
        pixelsPerSecond: () => 120,
        playheadFrame: () => 0,
        dispatch: vi.fn(() => true),
        selectClip: vi.fn(),
        previewClip: preview,
        announce: vi.fn(),
      })
      cleanups.push(editor.dispose)
      createComputed(editor.sync)
      const event = new KeyboardEvent('keydown', {
        key: 'ArrowRight',
        altKey: true,
        cancelable: true,
      })
      Object.defineProperty(event, 'target', { value: f.clip })
      editor.keyDown(event)
      expect(preview).toHaveBeenLastCalledWith(
        expect.objectContaining({ startFrame: 148 }),
      )
      setWritable(false)
      expect(preview).toHaveBeenLastCalledWith(null)
    })
  })

  it('previews repeated fine nudges and commits one undoable revision only on keyup', () => {
    const f = editorFixture()
    f.key(f.clip, 'keydown', 'ArrowRight', { altKey: true })
    f.key(f.clip, 'keydown', 'ArrowRight', { altKey: true, repeat: true })
    f.key(f.clip, 'keydown', 'ArrowRight', { altKey: true, repeat: true })
    expect(f.preview()?.startFrame).toBe(244)
    expect(f.state().present.revision).toBe(0)
    expect(f.dispatch).not.toHaveBeenCalled()
    f.key(f.clip, 'keyup', 'ArrowRight', { altKey: true })
    expect(f.preview()).toBeNull()
    expect(f.dispatch).toHaveBeenCalledTimes(1)
    expect(f.state().past).toHaveLength(1)
    expect(f.state().present.clips[0].startFrame).toBe(244)
    f.undo()
    expect(f.state().present.clips[0].startFrame).toBe(100)
    f.redo()
    expect(f.state().present.clips[0].startFrame).toBe(244)
    expect(f.state().present.revision).toBe(3)
  })

  it.each(['Escape', 'Tab', 'blur', 'lease', 'revision', 'zoom'])(
    'cancels the transient nudge on %s without a command',
    (reason) => {
      const f = editorFixture()
      f.key(f.clip, 'keydown', 'ArrowRight', { altKey: true })
      if (reason === 'Escape' || reason === 'Tab') {
        const event = f.key(f.clip, 'keydown', reason)
        expect(event.defaultPrevented).toBe(reason === 'Escape')
      } else if (reason === 'blur') window.dispatchEvent(new Event('blur'))
      else if (reason === 'lease') f.setWritable(false)
      else if (reason === 'zoom') f.setZoom(80)
      else f.replace({ ...f.project, revision: 1 })
      expect(f.preview()).toBeNull()
      f.key(f.clip, 'keyup', 'ArrowRight')
      expect(f.dispatch).not.toHaveBeenCalled()
      expect(f.state().present.clips[0].startFrame).toBe(100)
    },
  )

  it('does not accumulate rounding drift at fractional beat intervals or a boundary overrun', () => {
    const f = editorFixture()
    f.replace({ ...f.project, ruler: 'bars', tempoBpm: 123 })
    for (let index = 0; index < 200; index++)
      f.key(f.clip, 'keydown', 'ArrowRight', { repeat: index > 0 })
    expect(f.preview()?.startFrame).toBe(
      Math.round(100 + studioGridInterval(120, 123) * 200),
    )
    f.editor.cancel()
    for (let index = 0; index < 10; index++)
      f.key(f.clip, 'keydown', 'ArrowLeft', { altKey: true, repeat: index > 0 })
    expect(f.preview()?.startFrame).toBe(0)
    f.key(f.clip, 'keydown', 'ArrowRight', { altKey: true })
    expect(f.preview()?.startFrame).toBe(48)
  })

  it('copies trimmed audio, retains it after removal, and clears it when changing project', () => {
    const f = editorFixture()
    f.replace({
      ...f.project,
      clips: [
        { ...f.project.clips[0], sourceInFrame: 150, sourceOutFrame: 900 },
      ],
    })
    f.key(f.clip, 'keydown', 'c', { ctrlKey: true })
    expect(f.dispatch).not.toHaveBeenCalled()
    expect(f.editor.canPaste()).toBe(true)
    f.key(f.clip, 'keydown', 'Delete')
    f.setPlayhead(3000)
    f.key(f.header, 'keydown', 'v', { ctrlKey: true })
    expect(f.state().present.clips[0]).toMatchObject({
      sourceInFrame: 150,
      sourceOutFrame: 900,
      startFrame: 3000,
      fades: f.project.clips[0].fades,
      assetId: f.asset.id,
    })
    expect(f.focus).toHaveBeenLastCalledWith('generated-1', 'track-1')
    f.replace({ ...f.project, id: 'another-project' })
    expect(f.editor.canPaste()).toBe(false)
    f.dispatch.mockClear()
    f.key(f.header, 'keydown', 'v', { ctrlKey: true })
    expect(f.dispatch).not.toHaveBeenCalled()
  })

  it('pastes into the focused occupied lane with one fallback lane and preserves the copied descriptor', () => {
    const f = editorFixture()
    const destination = createStudioTrack({
      id: 'destination',
      name: 'Voice',
      order: 1,
      role: 'voice',
    })
    f.replace({
      ...f.project,
      tracks: [...f.project.tracks, destination],
      clips: [
        ...f.project.clips,
        { ...f.project.clips[0], id: 'occupied', trackId: destination.id },
      ],
    })
    f.key(f.clip, 'keydown', 'c', { metaKey: true })
    f.header.dataset.studioTrackHeader = destination.id
    f.key(f.header, 'keydown', 'v', { metaKey: true })
    expect(f.state().present.clips[2]).toMatchObject({
      trackId: 'generated-2',
      startFrame: 150,
      assetId: f.asset.id,
    })
    expect(f.state().present.tracks[2].role).toBe('voice')
    expect(f.announce).toHaveBeenLastCalledWith('Added on a new lane.')
    expect(f.state().past).toHaveLength(1)
    f.undo()
    expect(f.state().present.tracks).toHaveLength(2)
    expect(f.state().present.clips).toHaveLength(2)
  })

  it('keeps native controls, dialogs and unrelated buttons outside editing shortcuts', () => {
    const f = editorFixture()
    const input = document.createElement('input')
    input.type = 'range'
    const editable = document.createElement('div')
    editable.setAttribute('contenteditable', 'true')
    const button = document.createElement('button')
    f.clip.append(input, editable, button)
    for (const target of [input, editable, button]) {
      expect(f.key(target, 'keydown', 'ArrowRight').defaultPrevented).toBe(
        false,
      )
      expect(f.key(target, 'keydown', 'Delete').defaultPrevented).toBe(false)
      expect(
        f.key(target, 'keydown', 'v', { ctrlKey: true }).defaultPrevented,
      ).toBe(false)
    }
    f.root.setAttribute('role', 'dialog')
    expect(f.key(f.clip, 'keydown', 'Delete').defaultPrevented).toBe(false)
    expect(f.dispatch).not.toHaveBeenCalled()
    expect(f.preview()).toBeNull()
  })

  it('ignores repeated destructive shortcuts and scopes mute/solo to the lane header', () => {
    const f = editorFixture()
    f.key(f.header, 'keydown', 'm')
    f.key(f.header, 'keydown', 'm', { repeat: true })
    expect(f.state().present.tracks[0].mute).toBe(true)
    expect(f.dispatch).toHaveBeenCalledTimes(1)
    f.key(f.header, 'keydown', 's')
    expect(f.state().present.tracks[0].solo).toBe(true)
    f.key(f.clip, 'keydown', 'd', { ctrlKey: true })
    f.key(f.clip, 'keydown', 'd', { ctrlKey: true, repeat: true })
    expect(f.state().present.clips).toHaveLength(2)
    expect(f.state().present.clips[1].startFrame).toBe(1100)
    f.key(f.clip, 'keydown', 's')
    f.key(f.clip, 'keydown', 's', { repeat: true })
    expect(f.state().present.clips).toHaveLength(3)
    expect(f.state().present.clips[0].sourceOutFrame).toBe(50)
  })
})
