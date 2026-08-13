// The menu that keeps the session card from being a wall of buttons.
//
// Two properties carry the weight. The destructive row is always last,
// under a divider, whatever order the caller listed things in — a host
// that puts Delete in the middle of its own array must not be able to
// put it next to Play along. And the whole thing works from a keyboard,
// because a menu that only opens to a mouse has just hidden nine actions
// from anyone who does not use one.

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { OverflowMenuItem } from '../OverflowMenu'
import { OverflowMenu } from '../OverflowMenu'

afterEach(cleanup)

function open(items: OverflowMenuItem[]): void {
  render(() => <OverflowMenu label="More actions" items={items} />)
  fireEvent.click(screen.getByRole('button', { name: 'More actions' }))
}

const noop = (): void => {}

describe('OverflowMenu', () => {
  it('shows nothing until it is asked', () => {
    render(() => (
      <OverflowMenu
        label="More actions"
        items={[{ key: 'send', label: 'Send to device', onSelect: noop }]}
      />
    ))
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'More actions' }),
    ).toHaveAttribute('aria-expanded', 'false')
  })

  it('opens on a click and says so', () => {
    open([{ key: 'send', label: 'Send to device', onSelect: noop }])
    expect(screen.getByRole('menu')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'More actions' }),
    ).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('Send to device')).toBeInTheDocument()
  })

  it('runs the row and closes', () => {
    const send = vi.fn()
    open([{ key: 'send', label: 'Send to device', onSelect: send }])

    fireEvent.click(screen.getByTestId('overflow-send'))

    expect(send).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('puts a destructive row last however it was listed', () => {
    open([
      { key: 'delete', label: 'Delete', destructive: true, onSelect: noop },
      { key: 'send', label: 'Send to device', onSelect: noop },
      { key: 'zip', label: 'Export ZIP', onSelect: noop },
    ])

    const labels = screen
      .getAllByRole('menuitem')
      .map((row) => row.textContent?.trim())
    expect(labels).toEqual(['Send to device', 'Export ZIP', 'Delete'])
    // And it is fenced off, not merely last.
    expect(screen.getByRole('separator')).toBeInTheDocument()
  })

  it('does not draw a divider when nothing is destructive', () => {
    open([
      { key: 'send', label: 'Send to device', onSelect: noop },
      { key: 'zip', label: 'Export ZIP', onSelect: noop },
    ])
    expect(screen.queryByRole('separator')).not.toBeInTheDocument()
  })

  it('will not run a disabled row', () => {
    const hq = vi.fn()
    open([{ key: 'hq', label: 'HQ re-run', disabled: true, onSelect: hq }])

    fireEvent.click(screen.getByTestId('overflow-hq'))

    expect(hq).not.toHaveBeenCalled()
    // Still open: nothing happened, so nothing should have moved.
    expect(screen.getByRole('menu')).toBeInTheDocument()
  })

  it('closes on Escape and gives focus back to the trigger', () => {
    open([{ key: 'send', label: 'Send to device', onSelect: noop }])

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    // Focus must land somewhere findable. Dropping it on <body> strands a
    // keyboard user at the top of the page.
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'More actions' }),
    )
  })

  it('opens from the keyboard alone', () => {
    render(() => (
      <OverflowMenu
        label="More actions"
        items={[{ key: 'send', label: 'Send to device', onSelect: noop }]}
      />
    ))
    fireEvent.keyDown(screen.getByRole('button', { name: 'More actions' }), {
      key: 'ArrowDown',
    })
    expect(screen.getByRole('menu')).toBeInTheDocument()
  })

  it('carries a note for a row whose consequence is not obvious', () => {
    open([
      {
        key: 'hq-same',
        label: 'Upgrade this session',
        note: 'Replaces these stems with cloud HQ stems',
        destructive: true,
        onSelect: noop,
      },
    ])
    expect(
      screen.getByText('Replaces these stems with cloud HQ stems'),
    ).toBeInTheDocument()
  })

  it('announces itself as a menu, not a button that does something', () => {
    render(() => (
      <OverflowMenu
        label="More actions"
        items={[{ key: 'send', label: 'Send', onSelect: noop }]}
      />
    ))
    expect(
      screen.getByRole('button', { name: 'More actions' }),
    ).toHaveAttribute('aria-haspopup', 'menu')
  })
})
