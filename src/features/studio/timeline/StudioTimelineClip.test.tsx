// Studio clip tests — an active captured control survives its own extreme draft geometry, and a scroll redraws a waveform only past its grid.
import { cleanup, render, screen } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { studioFixture } from '@/lib/studio/model/model.test-fixtures'
import type { StudioClip } from '@/lib/studio/model/types'
import { STUDIO_SAMPLE_RATE } from '@/lib/studio/model/types'
import type { StudioGestureDraft } from './gesture-draft'
import { StudioTimelineClip, studioWaveSpan } from './StudioTimelineClip'
import { createStudioWaveformResource } from './waveform-resource'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

const idlePointer = () => ({
  draft: () => null,
  offsetY: () => 0,
  active: () => false,
  message: () => '',
  start: vi.fn(),
  cancel: vi.fn(),
  suppressClick: () => false,
})

describe('Studio clip waveform span', () => {
  it('draws the part of a clip in view, widened to a 512 px grid', () => {
    expect(studioWaveSpan(3000, -100, 900)).toEqual({ from: 0, to: 1024 })
    expect(studioWaveSpan(3000, 600, 1600)).toEqual({ from: 512, to: 2048 })
    expect(studioWaveSpan(700, 100, 1100)).toEqual({ from: 0, to: 700 })
    expect(studioWaveSpan(3000, 3000, 4000)).toBeNull()
    expect(studioWaveSpan(3000, -1000, 0)).toBeNull()
  })

  it('leaves the waveform alone while a scroll keeps its drawn span', () => {
    const frames = new Map<number, FrameRequestCallback>()
    let next = 0
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      frames.set(++next, callback)
      return next
    })
    vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id))
    const flush = () => {
      const due = [...frames.values()]
      frames.clear()
      for (const callback of due) callback(0)
    }
    // A draw asks for its context once; this one has none, so it stops there.
    const draws = vi
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue(null)
    vi.spyOn(HTMLCanvasElement.prototype, 'clientWidth', 'get').mockReturnValue(
      1000,
    )
    vi.spyOn(
      HTMLCanvasElement.prototype,
      'clientHeight',
      'get',
    ).mockReturnValue(60)
    vi.spyOn(
      HTMLCanvasElement.prototype,
      'getBoundingClientRect',
    ).mockReturnValue(new DOMRect(0, 0, 1000, 60))
    const base = studioFixture()
    const clip: StudioClip = {
      ...base.clip,
      startFrame: 0,
      sourceOutFrame: 30 * STUDIO_SAMPLE_RATE,
      fades: { curve: 'linear-amplitude' },
    }
    const [scroll, setScroll] = createSignal(0)
    const resource = createStudioWaveformResource(() => new Promise(() => {}))
    render(() => (
      <StudioTimelineClip
        clip={clip}
        asset={base.asset}
        trackName="Guitar"
        selected={false}
        writable
        phone={false}
        tablet={false}
        scale={100}
        scroll={scroll()}
        contentWidth={1000}
        resource={resource}
        pointer={idlePointer()}
        onSelect={vi.fn()}
        onDetails={vi.fn()}
      />
    ))
    flush()
    expect(draws).toHaveBeenCalledTimes(1)
    for (const step of [8, 16, 24]) {
      setScroll(step)
      flush()
    }
    expect(draws).toHaveBeenCalledTimes(1)
    // Past the grid line the span moves on, and the waveform with it.
    setScroll(600)
    flush()
    expect(draws).toHaveBeenCalledTimes(2)
    resource.dispose()
  })
})

describe('Studio selected handles', () => {
  it.each(['trim-head', 'fade-in'] as const)(
    'keeps %s mounted and focused until its extreme draft finishes',
    (kind) => {
      const base = studioFixture()
      const initial: StudioClip = {
        ...base.clip,
        sourceOutFrame: 192000,
        fades: { curve: 'linear-amplitude' },
      }
      const [clip, setClip] = createSignal(initial)
      const [draft, setDraft] = createSignal<StudioGestureDraft | null>(null)
      const resource = createStudioWaveformResource(() => new Promise(() => {}))
      render(() => (
        <StudioTimelineClip
          clip={clip()}
          asset={base.asset}
          trackName="Guitar"
          selected
          writable
          phone={false}
          tablet={false}
          scale={120}
          scroll={0}
          contentWidth={1000}
          resource={resource}
          pointer={{
            draft,
            offsetY: () => 0,
            active: () => draft() !== null,
            message: () => '',
            start: vi.fn(),
            cancel: vi.fn(),
            suppressClick: () => false,
          }}
          onSelect={vi.fn()}
          onDetails={vi.fn()}
        />
      ))
      const label = kind === 'trim-head' ? 'Trim start' : 'Fade in'
      const handle = screen.getByRole('button', { name: label })
      handle.focus()
      const next: StudioClip =
        kind === 'trim-head'
          ? {
              ...initial,
              startFrame: initial.startFrame + 191999,
              sourceInFrame: 191999,
            }
          : {
              ...initial,
              fades: {
                curve: 'linear-amplitude',
                in: { fromSourceFrame: 0, toSourceFrame: 192000 },
              },
            }
      setDraft({
        clip: next,
        kind,
        targetTrackId: next.trackId,
        snapFrame: null,
        valid: true,
        message: '',
      })
      expect(screen.getByRole('button', { name: label })).toBe(handle)
      expect(handle).toHaveFocus()
      setClip(next)
      setDraft(null)
      expect(
        screen.queryByRole('button', { name: label }),
      ).not.toBeInTheDocument()
      resource.dispose()
    },
  )
})
