// Quick switching keeps gallery gestures, local-only metadata and destructive confirmation separate.
import { cleanup, fireEvent, render, screen, within, } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { GuitarRecording } from '@/lib/guitar/recording-types'
import { GuitarRecordingGalleryButton } from './GuitarRecordingGallery'

const preview = vi.hoisted(() => vi.fn())
vi.mock('@/db/services/guitar-recording-service', () => ({
  createGuitarRecordingStore: () => ({ preview }),
}))
const row = (index: number): GuitarRecording =>
  ({
    id: `take-${index}`,
    title: `Idea ${index}`,
    state: 'kept',
    takeId: `audio-${index}`,
    createdAt: '2026-09-07T10:00:00Z',
    frames: 480000,
    sampleRate: 48000,
  }) as GuitarRecording
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.clearAllMocks()
})

function deferred() {
  let resolve!: () => void
  let reject!: (cause: Error) => void
  const promise = new Promise<void>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}

function mount(
  count = 2,
  select = vi.fn().mockResolvedValue(undefined),
  remove = vi.fn().mockResolvedValue(undefined),
) {
  const gallery = vi.fn()
  const changed = vi.fn()
  const [rows, setRows] = createSignal(
    Array.from({ length: count }, (_, index) => row(index)),
  )
  const [disabled, setDisabled] = createSignal(false)
  render(() => (
    <GuitarRecordingGalleryButton
      count={rows().length}
      rows={rows()}
      currentId="take-0"
      onOpen={gallery}
      onSelect={select}
      onRemove={remove}
      disabled={disabled()}
      onQuickOpenChange={changed}
    />
  ))
  return { gallery, changed, select, remove, setRows, setDisabled }
}
const open = () =>
  fireEvent.click(screen.getByRole('button', { name: 'Quick switch melody' }))
const touch = (type: string, x: number, y: number) => {
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.defineProperties(event, {
    pointerType: { value: 'touch' },
    clientX: { value: x },
    clientY: { value: y },
  })
  return event
}

describe('quick melody switching', () => {
  it('preserves gallery click, offers an explicit quick button and bounds catalogue-only rows', async () => {
    const h = mount(10)
    fireEvent.click(
      screen.getByRole('button', { name: 'My melodies, 10 recordings' }),
    )
    expect(h.gallery).toHaveBeenCalledOnce()
    open()
    const menu = screen.getByRole('dialog', { name: 'Switch melody' })
    expect(within(menu).getAllByRole('listitem')).toHaveLength(8)
    expect(
      screen.getByRole('button', { name: 'Loaded Idea 0' }),
    ).toHaveAttribute('aria-current', 'true')
    expect(preview).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Load Idea 1' }))
    expect(h.select).toHaveBeenCalledWith('take-1')
    await Promise.resolve()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(h.changed).toHaveBeenLastCalledWith(false)
  })
  it('exposes the full collection without loading audio and closes with Escape', async () => {
    const h = mount(10)
    open()
    fireEvent.click(
      screen.getByRole('button', { name: 'Open full gallery (10)' }),
    )
    expect(h.gallery).toHaveBeenCalledOnce()
    open()
    fireEvent.keyDown(screen.getByRole('dialog', { name: 'Switch melody' }), {
      key: 'Escape',
    })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(preview).not.toHaveBeenCalled()
    await Promise.resolve()
  })
  it('opens on touch hold without also opening the gallery and cancels scrolling gestures', () => {
    vi.useFakeTimers()
    const h = mount()
    const trigger = screen.getByRole('button', {
      name: 'My melodies, 2 recordings',
    })
    trigger.dispatchEvent(touch('pointerdown', 10, 10))
    trigger.dispatchEvent(touch('pointermove', 10, 35))
    vi.advanceTimersByTime(500)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    trigger.dispatchEvent(touch('pointerdown', 10, 10))
    vi.advanceTimersByTime(500)
    trigger.dispatchEvent(touch('pointerup', 10, 10))
    fireEvent.click(trigger)
    expect(screen.getByRole('dialog', { name: 'Switch melody' })).toBeVisible()
    expect(h.gallery).not.toHaveBeenCalled()
    expect(h.select).not.toHaveBeenCalled()
  })
  it('keeps failed selection visible, prevents overlap, and closes when the host blocks it', async () => {
    const pending = deferred()
    const h = mount(2, vi.fn().mockReturnValue(pending.promise))
    open()
    fireEvent.click(screen.getByRole('button', { name: 'Load Idea 1' }))
    expect(screen.getByRole('button', { name: 'Loaded Idea 0' })).toBeDisabled()
    pending.reject(new Error('Recording missing'))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Recording missing',
    )
    expect(screen.getByRole('button', { name: 'Load Idea 1' })).toBeEnabled()
    h.setDisabled(true)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
  it('requires exact-take removal confirmation and preserves the row on failure', async () => {
    const remove = vi
      .fn()
      .mockRejectedValueOnce(new Error('Storage unavailable'))
      .mockResolvedValueOnce(undefined)
    const h = mount(2, undefined, remove)
    open()
    fireEvent.click(screen.getByRole('button', { name: 'Remove Idea 1' }))
    const confirm = screen.getByRole('alertdialog', {
      name: 'Remove this melody?',
    })
    expect(confirm).toHaveTextContent('Idea 1')
    expect(confirm).toHaveTextContent(
      'song attachments and Hear Yourself entry',
    )
    expect(remove).not.toHaveBeenCalled()
    fireEvent.click(within(confirm).getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Remove Idea 1' }))
    fireEvent.click(screen.getByRole('button', { name: 'Remove melody' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Storage unavailable',
    )
    expect(
      screen.getByRole('button', { name: 'Load Idea 1' }),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Remove melody' }))
    await Promise.resolve()
    await Promise.resolve()
    expect(h.remove).toHaveBeenNthCalledWith(1, 'take-1')
    expect(h.remove).toHaveBeenNthCalledWith(2, 'take-1')
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })
  it('explains empty and interrupted collections without enabling deletion of live drafts', () => {
    const h = mount(0)
    open()
    expect(
      screen.getByText(/Your recorded ideas will appear here/),
    ).toBeVisible()
    h.setRows([{ ...row(2), state: 'capturing' }])
    expect(screen.getByRole('button', { name: 'Load Idea 2' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Remove Idea 2' })).toBeDisabled()
    expect(screen.getByText(/Needs recovery/)).toBeVisible()
  })
})
