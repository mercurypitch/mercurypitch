// Studio pointer lifetime tests — interruptions discard previews and release capture without edits.
import { createRoot, createSignal } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { studioFixture } from '@/lib/studio/model/model.test-fixtures'
import { useStudioPointer } from './useStudioPointer'

afterEach(() => {
  document.body.replaceChildren()
  vi.unstubAllGlobals()
})

function setup() {
  const { project, asset, clip } = studioFixture()
  const [song, setSong] = createSignal(project)
  const [writable, setWritable] = createSignal(true)
  const [scale, setScale] = createSignal(120)
  const viewport = document.createElement('div')
  const row = document.createElement('div')
  row.dataset.studioTrack = clip.trackId
  const button = document.createElement('button')
  row.append(button)
  viewport.append(row)
  document.body.append(viewport)
  const rect = {
    top: 100,
    bottom: 400,
    left: 0,
    right: 1200,
    x: 0,
    y: 100,
    width: 1200,
    height: 300,
    toJSON: () => ({}),
  }
  viewport.getBoundingClientRect = () => rect
  row.getBoundingClientRect = () => ({ ...rect, top: 148, bottom: 252 })
  viewport.scrollBy = vi.fn()
  let captured = false
  button.setPointerCapture = vi.fn(() => {
    captured = true
  })
  button.hasPointerCapture = vi.fn(() => captured)
  button.releasePointerCapture = vi.fn(() => {
    captured = false
  })
  vi.stubGlobal('CSS', { escape: (value: string) => value })
  const command = vi.fn(() => true)
  const scope = createRoot((dispose) => {
    const pointer = useStudioPointer(
      {
        get project() {
          return song()
        },
        assets: [asset],
        selectedClipId: clip.id,
        playheadFrame: 0,
        pixelsPerSecond: 120,
        get writable() {
          return writable()
        },
        phone: false,
        onSelectClip: vi.fn(),
        onSeek: vi.fn(),
        onCommand: command,
        onClipDetails: vi.fn(),
        onTrackDetails: vi.fn(),
        readCanonicalAsset: vi.fn(),
      },
      {
        viewport: () => viewport,
        scale,
        width: () => 1200,
        headerWidth: () => 232,
        snap: () => false,
      },
    )
    return { pointer, dispose }
  })
  const start = () =>
    scope.pointer.start(
      {
        currentTarget: button,
        pointerId: 1,
        clientX: 500,
        clientY: 200,
        pointerType: 'mouse',
        button: 0,
        isPrimary: true,
        altKey: true,
        preventDefault: vi.fn(),
      } as unknown as PointerEvent,
      clip,
      'move',
    )
  const dispatch = (type: string, values: Record<string, unknown> = {}) => {
    const event = new Event(type, { bubbles: true, cancelable: true })
    Object.assign(
      event,
      { pointerId: 1, clientX: 620, clientY: 200, altKey: true },
      values,
    )
    window.dispatchEvent(event)
  }
  return {
    ...scope,
    start,
    dispatch,
    command,
    button,
    setSong,
    song,
    setWritable,
    setScale,
  }
}

describe('Studio pointer ownership', () => {
  it('returns focus to the stable clip target if committing removes its focused handle', async () => {
    const fixture = setup()
    const replacement = document.createElement('button')
    replacement.dataset.studioClip = 'clip-1'
    const lane = fixture.button.parentElement!
    fixture.command.mockImplementationOnce(() => {
      fixture.button.remove()
      lane.append(replacement)
      return true
    })
    try {
      fixture.start()
      fixture.dispatch('pointermove')
      fixture.dispatch('pointerup')
      await Promise.resolve()
      expect(replacement).toHaveFocus()
    } finally {
      fixture.dispose()
    }
  })
  it('commits one move on pointerup while intermediate motion remains a local draft', () => {
    const fixture = setup()
    try {
      fixture.start()
      fixture.dispatch('pointermove')
      fixture.dispatch('pointermove', { clientX: 680 })
      expect(fixture.command).not.toHaveBeenCalled()
      expect(fixture.pointer.draft()?.clip.startFrame).toBe(72100)
      fixture.dispatch('pointerup', { clientX: 680 })
      expect(fixture.command).toHaveBeenCalledExactlyOnceWith({
        type: 'move-clip',
        clipId: 'clip-1',
        trackId: 'track-1',
        startFrame: 72100,
      })
      expect(fixture.pointer.draft()).toBeNull()
      expect(fixture.button.releasePointerCapture).toHaveBeenCalledOnce()
    } finally {
      fixture.dispose()
    }
  })

  it.each([
    'Escape',
    'pointercancel',
    'lostpointercapture',
    'resize',
    'blur',
    'revision',
    'lease',
    'zoom',
    'second-pointer',
    'unmount',
  ])('cancels on %s without a command', (reason) => {
    const fixture = setup()
    try {
      fixture.start()
      fixture.dispatch('pointermove')
      expect(fixture.pointer.draft()).not.toBeNull()
      if (reason === 'Escape')
        window.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
        )
      else if (reason === 'revision')
        fixture.setSong((project) => ({
          ...project,
          revision: project.revision + 1,
        }))
      else if (reason === 'lease') fixture.setWritable(false)
      else if (reason === 'zoom') fixture.setScale(60)
      else if (reason === 'second-pointer')
        fixture.dispatch('pointerdown', { pointerId: 2 })
      else if (reason === 'lostpointercapture') {
        const event = new Event(reason)
        Object.assign(event, { pointerId: 1 })
        fixture.button.dispatchEvent(event)
      } else if (reason === 'unmount') fixture.dispose()
      else fixture.dispatch(reason)
      fixture.dispatch('pointerup')
      expect(fixture.command).not.toHaveBeenCalled()
      expect(fixture.pointer.draft()).toBeNull()
      expect(fixture.button.releasePointerCapture).toHaveBeenCalledOnce()
    } finally {
      fixture.dispose()
    }
  })
})
