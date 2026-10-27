// Studio source picker tests — stale reads and playback completions cannot restart previews.
import { cleanup, fireEvent, render, screen, waitFor, } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createStudioProject } from '@/lib/studio/model/defaults'
import type { StudioSourceEntry } from './integration/source-catalog'
import { StudioSourcePicker } from './StudioSourcePicker'
import type { StudioController } from './useStudioController'

afterEach(cleanup)

const entries: StudioSourceEntry[] = ['First take', 'Second take'].map(
  (title, index) => ({
    id: `take-${index}`,
    source: 'freeform',
    title,
    sourceLabel: 'Hear Yourself',
    audioDescription: 'Kept microphone audio.',
    suggestedRole: 'voice',
    durationMs: 1000,
    sizeBytes: 3,
    capturedAt: '2026-10-26T10:00:00.000Z',
    mimeType: 'audio/wav',
  }),
)

function mount() {
  const [epoch, setEpoch] = createSignal(0)
  const [playing, setPlaying] = createSignal(false)
  const [pending, setPending] = createSignal(false)
  const [project, setProject] = createSignal(createStudioProject({ id: 'one' }))
  const read = vi.fn<StudioController['readSourcePreview']>(
    async () => new Blob(['abc']),
  )
  const onPreviewGesture = vi.fn(async () => true)
  const onPreview = vi.fn(async (_blob: Blob) => {
    setPlaying(true)
    return true
  })
  const onStopPreview = vi.fn(() => {
    setPending(false)
    setPlaying(false)
  })
  const onAdd = vi.fn(async (_entries: readonly StudioSourceEntry[]) => true)
  const studio = {
    sources: () => entries,
    sourceError: () => null,
    busy: () => false,
    editBlocked: () => false,
    writable: () => true,
    importing: () => false,
    refreshSources: vi.fn(async () => undefined),
    readSourcePreview: read,
    project,
  }
  const view = render(() => (
    <StudioSourcePicker
      studio={studio}
      onAdd={onAdd}
      onFile={() => undefined}
      onPreview={onPreview}
      onPreviewGesture={onPreviewGesture}
      onStopPreview={onStopPreview}
      previewEpoch={epoch()}
      previewing={playing()}
      previewPending={pending()}
    />
  ))
  return {
    ...view,
    read,
    onPreview,
    onPreviewGesture,
    onStopPreview,
    onAdd,
    setPlaying,
    setPending,
    setEpoch,
    setProject,
  }
}

describe('Studio selected source previews', () => {
  it('cancels a pending original-byte read when its source starts being dragged', async () => {
    const ui = mount()
    let finish!: (blob: Blob) => void
    ui.read.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    await fireEvent.click(
      screen.getByRole('button', { name: 'Preview First take' }),
    )
    const signal = ui.read.mock.calls[0][1]?.signal
    expect(signal?.aborted).toBe(false)
    const row = screen.getByText('First take').closest('li')
    if (!row) throw new Error('Missing kept take row')
    const dataTransfer = { setData: vi.fn(), effectAllowed: '' }
    await fireEvent.dragStart(row, { dataTransfer })
    expect(dataTransfer.setData).toHaveBeenCalledWith(
      'application/x-mercurypitch-studio-take',
      entries[0].id,
    )
    expect(signal?.aborted).toBe(true)
    finish(new Blob(['abc']))
    await Promise.resolve()
    await Promise.resolve()
    expect(ui.onPreview).not.toHaveBeenCalled()
    expect(
      screen.getByRole('button', { name: 'Preview First take' }),
    ).toBeDefined()
  })

  it('stops preview before a source filter hides its row', async () => {
    const ui = mount()
    await fireEvent.click(
      screen.getByRole('button', { name: 'Preview First take' }),
    )
    await waitFor(() => expect(ui.onPreview).toHaveBeenCalledTimes(1))
    const stops = ui.onStopPreview.mock.calls.length
    await fireEvent.click(screen.getByRole('button', { name: 'Guitar' }))
    expect(ui.onStopPreview).toHaveBeenCalledTimes(stops + 1)
    expect(
      screen.queryByRole('button', { name: 'Stop preview of First take' }),
    ).toBeNull()
  })

  it('primes audio in the click before reading bytes and refuses reads after an unlock failure', async () => {
    const ui = mount()
    const order: string[] = []
    let finishPrime!: (ready: boolean) => void
    ui.onPreviewGesture.mockImplementationOnce(() => {
      order.push('prime')
      return new Promise((resolve) => {
        finishPrime = resolve
      })
    })
    ui.read.mockImplementation(async () => {
      order.push('read')
      return new Blob(['abc'])
    })
    await fireEvent.click(
      screen.getByRole('button', { name: 'Preview First take' }),
    )
    expect(order).toEqual(['prime'])
    expect(ui.read).not.toHaveBeenCalled()
    finishPrime(true)
    await waitFor(() => expect(ui.onPreview).toHaveBeenCalledTimes(1))
    expect(order).toEqual(['prime', 'read'])
    ui.onPreviewGesture.mockResolvedValueOnce(false)
    await fireEvent.click(
      screen.getByRole('button', { name: 'Preview Second take' }),
    )
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain(
        'Audio could not start',
      ),
    )
    expect(ui.read).toHaveBeenCalledTimes(1)
    expect(ui.onPreview).toHaveBeenCalledTimes(1)
  })

  it('cancels a pending source read before song Play and never starts its late result', async () => {
    const ui = mount()
    let finish!: (blob: Blob) => void
    ui.read.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    await fireEvent.click(
      screen.getByRole('button', { name: 'Preview First take' }),
    )
    const signal = ui.read.mock.calls[0][1]?.signal
    expect(signal?.aborted).toBe(false)
    ui.setEpoch(1)
    expect(signal?.aborted).toBe(true)
    expect(
      screen.getByRole('button', { name: 'Preview First take' }),
    ).toBeDefined()
    finish(new Blob(['abc']))
    await Promise.resolve()
    await Promise.resolve()
    expect(ui.onPreview).not.toHaveBeenCalled()
  })

  it('aborts pending reads on close and stops active playback on close', async () => {
    const ui = mount()
    let finish!: (blob: Blob) => void
    ui.read.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    await fireEvent.click(
      screen.getByRole('button', { name: 'Preview First take' }),
    )
    const signal = ui.read.mock.calls[0][1]?.signal
    ui.unmount()
    expect(signal?.aborted).toBe(true)
    finish(new Blob(['abc']))
    await Promise.resolve()
    await Promise.resolve()
    expect(ui.onPreview).not.toHaveBeenCalled()
    const active = mount()
    await fireEvent.click(
      screen.getByRole('button', { name: 'Preview First take' }),
    )
    await waitFor(() => expect(active.onPreview).toHaveBeenCalledTimes(1))
    const stops = active.onStopPreview.mock.calls.length
    active.unmount()
    expect(active.onStopPreview).toHaveBeenCalledTimes(stops + 1)
  })

  it('ignores an old preview completion while another row is playing and clears the icon on natural end', async () => {
    const ui = mount()
    let finishOld!: (played: boolean) => void
    ui.onPreview.mockImplementationOnce(() => {
      ui.setPending(true)
      return new Promise((resolve) => {
        finishOld = resolve
      })
    })
    await fireEvent.click(
      screen.getByRole('button', { name: 'Preview First take' }),
    )
    await waitFor(() => expect(ui.onPreview).toHaveBeenCalledTimes(1))
    await fireEvent.click(
      screen.getByRole('button', { name: 'Preview Second take' }),
    )
    await waitFor(() => expect(ui.onPreview).toHaveBeenCalledTimes(2))
    expect(
      screen.getByRole('button', { name: 'Stop preview of Second take' }),
    ).toBeDefined()
    finishOld(false)
    await Promise.resolve()
    expect(
      screen.getByRole('button', { name: 'Stop preview of Second take' }),
    ).toBeDefined()
    expect(
      screen.getByRole('button', { name: 'Preview First take' }),
    ).toBeDefined()
    ui.setPlaying(false)
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Preview Second take' }),
      ).toBeDefined(),
    )
  })

  it('cancels a pending read when the project changes and ignores a stale Add completion', async () => {
    const ui = mount()
    let finishRead!: (blob: Blob) => void
    ui.read.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishRead = resolve
        }),
    )
    await fireEvent.click(
      screen.getByRole('button', { name: 'Preview First take' }),
    )
    const signal = ui.read.mock.calls[0][1]?.signal
    ui.setProject(createStudioProject({ id: 'two' }))
    expect(signal?.aborted).toBe(true)
    finishRead(new Blob(['abc']))
    await Promise.resolve()
    expect(ui.onPreview).not.toHaveBeenCalled()
    let finishAdd!: (added: boolean) => void
    ui.onAdd.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishAdd = resolve
        }),
    )
    await fireEvent.click(screen.getAllByRole('checkbox')[0])
    await fireEvent.click(screen.getByRole('button', { name: 'Add 1 take' }))
    ui.setProject(createStudioProject({ id: 'three' }))
    await fireEvent.click(screen.getAllByRole('checkbox')[1])
    finishAdd(true)
    await Promise.resolve()
    expect(
      (screen.getAllByRole('checkbox')[1] as HTMLInputElement).checked,
    ).toBe(true)
  })
})
