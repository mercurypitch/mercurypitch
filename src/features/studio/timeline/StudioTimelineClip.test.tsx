// Studio handle lifetime tests — an active captured control survives its own extreme draft geometry.
import { cleanup, render, screen } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { studioFixture } from '@/lib/studio/model/model.test-fixtures'
import type { StudioClip } from '@/lib/studio/model/types'
import type { StudioGestureDraft } from './gesture-draft'
import { StudioTimelineClip } from './StudioTimelineClip'
import { createStudioWaveformResource } from './waveform-resource'

afterEach(cleanup)

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
