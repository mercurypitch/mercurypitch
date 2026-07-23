// ============================================================
// ConfirmDialog Tests — the reusable destructive-action confirm modal
// (used by the karaoke playlist delete prompts).
// ============================================================

import { fireEvent, render, screen } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { describe, expect, it, vi } from 'vitest'
import { ConfirmDialog } from '../ConfirmDialog'

vi.mock('../icons', () => ({
  Trash2: () => <span data-testid="trash-icon">Trash2</span>,
}))

describe('ConfirmDialog', () => {
  const baseProps = {
    title: 'Delete Playlist',
    message: 'Delete this?',
    onConfirm: () => {},
    onCancel: () => {},
  }

  it('renders nothing when closed', () => {
    render(() => <ConfirmDialog {...baseProps} open={false} />)
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('renders the title, message and accessible dialog when open', () => {
    render(() => <ConfirmDialog {...baseProps} open={true} />)
    const dialog = screen.getByRole('alertdialog')
    expect(dialog).toBeTruthy()
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    // Title/body are associated for screen readers.
    expect(dialog.getAttribute('aria-labelledby')).toBeTruthy()
    expect(dialog.getAttribute('aria-describedby')).toBeTruthy()
    expect(screen.getByText('Delete Playlist')).toBeTruthy()
    expect(screen.getByText('Delete this?')).toBeTruthy()
  })

  it('fires onConfirm (not onCancel) when the delete button is clicked', () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    const { container } = render(() => (
      <ConfirmDialog
        {...baseProps}
        open={true}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    ))
    fireEvent.click(container.querySelector('[data-testid="confirm-delete"]')!)
    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('fires onCancel when the cancel button is clicked', () => {
    const onCancel = vi.fn()
    const { container } = render(() => (
      <ConfirmDialog {...baseProps} open={true} onCancel={onCancel} />
    ))
    fireEvent.click(container.querySelector('[data-testid="confirm-cancel"]')!)
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('fires onCancel when the overlay backdrop is clicked', () => {
    const onCancel = vi.fn()
    const { container } = render(() => (
      <ConfirmDialog {...baseProps} open={true} onCancel={onCancel} />
    ))
    const overlay = container.querySelector('[data-testid="confirm-overlay"]')!
    fireEvent.click(overlay)
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('does not fire onCancel when the dialog body is clicked', () => {
    const onCancel = vi.fn()
    render(() => (
      <ConfirmDialog {...baseProps} open={true} onCancel={onCancel} />
    ))
    fireEvent.click(screen.getByRole('alertdialog'))
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('fires onCancel on Escape (focus trap)', () => {
    const onCancel = vi.fn()
    render(() => (
      <ConfirmDialog {...baseProps} open={true} onCancel={onCancel} />
    ))
    fireEvent.keyDown(screen.getByRole('alertdialog'), { key: 'Escape' })
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('honors a custom confirm label', () => {
    const { container } = render(() => (
      <ConfirmDialog {...baseProps} open={true} confirmLabel="Remove" />
    ))
    const confirmBtn = container.querySelector(
      '[data-testid="confirm-delete"]',
    )!
    expect(confirmBtn.textContent).toContain('Remove')
    expect(confirmBtn.textContent).not.toContain('Delete')
  })

  it('defaults the confirm icon to the trash can', () => {
    render(() => <ConfirmDialog {...baseProps} open={true} />)
    expect(screen.getByTestId('trash-icon')).toBeTruthy()
  })

  it('renders a custom confirm icon instead of the trash can', () => {
    render(() => (
      <ConfirmDialog
        {...baseProps}
        open={true}
        confirmLabel="Replace"
        confirmIcon={<span data-testid="custom-icon">!</span>}
      />
    ))
    expect(screen.getByTestId('custom-icon')).toBeTruthy()
    expect(screen.queryByTestId('trash-icon')).toBeNull()
  })

  it('locks dismissal and duplicate confirmation while busy', () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    const { container } = render(() => (
      <ConfirmDialog
        {...baseProps}
        open={true}
        busy={true}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    ))
    const dialog = screen.getByRole('alertdialog')
    const confirm = screen.getByTestId('confirm-delete')
    const cancel = screen.getByTestId('confirm-cancel')

    expect(dialog).toHaveAttribute('aria-busy', 'true')
    expect(confirm).toBeDisabled()
    expect(cancel).toBeDisabled()

    fireEvent.click(confirm)
    fireEvent.click(cancel)
    fireEvent.click(container.querySelector('[data-testid="confirm-overlay"]')!)
    fireEvent.keyDown(dialog, { key: 'Escape' })
    expect(onConfirm).not.toHaveBeenCalled()
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('reactively opens and closes', () => {
    const [open, setOpen] = createSignal(false)
    render(() => <ConfirmDialog {...baseProps} open={open()} />)
    expect(screen.queryByRole('alertdialog')).toBeNull()
    setOpen(true)
    expect(screen.queryByRole('alertdialog')).toBeTruthy()
    setOpen(false)
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })
})
