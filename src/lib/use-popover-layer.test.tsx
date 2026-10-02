// One closing rule for every floating panel: what closes it, what does not,
// and which of two open panels Escape belongs to.

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import type { Accessor } from 'solid-js'
import { createSignal, Show } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PopoverCloseReason } from './use-popover-layer'
import { placePopover, usePopoverLayer } from './use-popover-layer'

afterEach(cleanup)

interface LayerProps {
  name: string
  open: Accessor<boolean>
  onClose: (reason: PopoverCloseReason) => void
  pinned?: Accessor<boolean>
}

function Layer(props: LayerProps) {
  let trigger: HTMLButtonElement | undefined
  let panel: HTMLDivElement | undefined
  usePopoverLayer({
    open: () => props.open(),
    onClose: (reason) => props.onClose(reason),
    inside: () => [trigger, panel],
    pinned: () => props.pinned?.() === true,
  })
  return (
    <div data-testid={`${props.name}-host`}>
      <button ref={trigger} type="button">
        {props.name}
      </button>
      <Show when={props.open()}>
        <div ref={panel} data-testid={`${props.name}-panel`}>
          <button type="button">{props.name} row</button>
        </div>
      </Show>
    </div>
  )
}

/** A layer that really closes when asked, and records why. */
function mountLayer(name: string, pinned?: Accessor<boolean>) {
  const [open, setOpen] = createSignal(true)
  const reasons: PopoverCloseReason[] = []
  const onClose = (reason: PopoverCloseReason) => {
    reasons.push(reason)
    setOpen(false)
  }
  return {
    open,
    reasons,
    view: () => (
      <Layer name={name} open={open} onClose={onClose} pinned={pinned} />
    ),
  }
}

describe('usePopoverLayer', () => {
  it('closes on a pointerdown outside, and not on one on its trigger or in its panel', () => {
    const layer = mountLayer('speed')
    render(() => (
      <>
        {layer.view()}
        <p>Lyrics</p>
      </>
    ))

    fireEvent.pointerDown(screen.getByRole('button', { name: 'speed' }))
    fireEvent.pointerDown(screen.getByRole('button', { name: 'speed row' }))
    expect(layer.reasons).toEqual([])

    fireEvent.pointerDown(screen.getByText('Lyrics'))
    expect(layer.reasons).toEqual(['outside'])
    expect(screen.queryByTestId('speed-panel')).toBeNull()
  })

  it('gives Escape to the top layer only, and claims it', () => {
    const lower = mountLayer('more')
    const upper = mountLayer('key')
    render(() => lower.view())
    render(() => upper.view())

    const first = fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(first).toBe(false)
    expect(upper.reasons).toEqual(['escape'])
    expect(lower.open()).toBe(true)

    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(lower.reasons).toEqual(['escape'])
  })

  it('leaves an Escape that something above it already claimed', () => {
    const layer = mountLayer('key')
    render(() => (
      <>
        {layer.view()}
        <div role="dialog" onKeyDown={(event) => event.preventDefault()}>
          <button type="button">Baritone</button>
        </div>
      </>
    ))

    fireEvent.keyDown(screen.getByRole('button', { name: 'Baritone' }), {
      key: 'Escape',
    })

    expect(layer.reasons).toEqual([])
    expect(layer.open()).toBe(true)
  })

  it('closes when a scroll moves its trigger, not for one elsewhere or inside it', () => {
    const layer = mountLayer('key')
    render(() => (
      <>
        <div data-testid="lyrics">auto-scrolling words</div>
        {layer.view()}
      </>
    ))

    fireEvent.scroll(screen.getByTestId('lyrics'))
    fireEvent.scroll(screen.getByTestId('key-panel'))
    expect(layer.reasons).toEqual([])

    fireEvent.scroll(screen.getByTestId('key-host'))
    expect(layer.reasons).toEqual(['scroll'])
  })

  it('closes when the page itself scrolls', () => {
    const layer = mountLayer('key')
    render(() => layer.view())

    fireEvent.scroll(document)

    expect(layer.reasons).toEqual(['scroll'])
  })

  it('closes on a window resize', () => {
    const layer = mountLayer('more')
    render(() => layer.view())

    fireEvent(window, new Event('resize'))

    expect(layer.reasons).toEqual(['resize'])
  })

  it('keeps a pinned sheet through scrolls and resizes, but not outside presses', () => {
    const layer = mountLayer('more', () => true)
    render(() => (
      <>
        {layer.view()}
        <p>Lyrics</p>
      </>
    ))

    fireEvent.scroll(document)
    fireEvent(window, new Event('resize'))
    expect(layer.reasons).toEqual([])

    fireEvent.pointerDown(screen.getByText('Lyrics'))
    expect(layer.reasons).toEqual(['outside'])
  })

  it('stops listening once it is closed', () => {
    const [open, setOpen] = createSignal(true)
    const onClose = vi.fn()
    render(() => (
      <>
        <Layer name="speed" open={open} onClose={onClose} />
        <p>Lyrics</p>
      </>
    ))
    setOpen(false)

    fireEvent.pointerDown(screen.getByText('Lyrics'))
    fireEvent.keyDown(document.body, { key: 'Escape' })
    fireEvent(window, new Event('resize'))

    expect(onClose).not.toHaveBeenCalled()
  })
})

describe('placePopover', () => {
  const viewport = { width: 1000, height: 600 }
  const panel = { width: 200, height: 120 }
  const anchor = (left: number, top: number, width = 40, height = 30) => ({
    left,
    top,
    right: left + width,
    bottom: top + height,
  })

  it('hangs below the trigger, right edges lined up', () => {
    expect(placePopover(anchor(500, 100), panel, viewport)).toEqual({
      x: 340,
      y: 136,
      above: false,
    })
  })

  it('keeps clear of both side edges', () => {
    expect(placePopover(anchor(20, 100), panel, viewport).x).toBe(8)
    expect(
      placePopover(anchor(950, 100), panel, viewport, { align: 'start' }).x,
    ).toBe(792)
  })

  it('opens above when there is no room below', () => {
    expect(placePopover(anchor(500, 520), panel, viewport)).toEqual({
      x: 340,
      y: 394,
      above: true,
    })
  })

  it('stays inside the viewport when neither side has room', () => {
    const tall = { width: 200, height: 580 }
    const placed = placePopover(anchor(500, 250), tall, viewport)
    expect(placed.y).toBe(12)
    expect(placed.y + tall.height).toBeLessThanOrEqual(viewport.height - 8)
  })

  it('opens beside a trigger on the inline axis, flipping off the right edge', () => {
    expect(
      placePopover(anchor(20, 200), panel, viewport, {
        axis: 'inline',
        align: 'start',
      }),
    ).toEqual({ x: 66, y: 200, above: false })
    expect(
      placePopover(anchor(940, 200), panel, viewport, {
        axis: 'inline',
        align: 'start',
      }).x,
    ).toBe(734)
  })
})
