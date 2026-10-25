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

  // A confirm opens over a tab that may be playing, and the app's shortcuts
  // listen on the window: a Space on Cancel played the tab behind, and the
  // press never reached Cancel.
  it('keeps its keys from the app behind without being asked', () => {
    const heard = vi.fn()
    window.addEventListener('keydown', heard)
    render(() => <ConfirmDialog {...baseProps} open={true} />)
    const cancel = screen.getByRole('button', { name: 'Cancel' })

    fireEvent.keyDown(cancel, { key: ' ', code: 'Space' })
    fireEvent.keyDown(cancel, { key: 'm', code: 'KeyM' })

    window.removeEventListener('keydown', heard)
    expect(heard).not.toHaveBeenCalled()
    // And takes the focus from a press on its words, so the keys after it stay.
    expect(screen.getByRole('alertdialog')).toHaveAttribute('tabindex', '-1')
  })

  it('lets its keys through when a caller turns that off', () => {
    const heard = vi.fn()
    window.addEventListener('keydown', heard)
    render(() => (
      <ConfirmDialog {...baseProps} open={true} isolateKeyboard={false} />
    ))

    fireEvent.keyDown(screen.getByRole('button', { name: 'Cancel' }), {
      key: ' ',
      code: 'Space',
    })

    window.removeEventListener('keydown', heard)
    expect(heard).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('alertdialog')).not.toHaveAttribute('tabindex')
  })

  it('fires onConfirm (not onCancel) when the delete button is clicked', () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    render(() => (
      <ConfirmDialog
        {...baseProps}
        open={true}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    ))
    fireEvent.click(screen.getByTestId('confirm-delete'))
    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('fires onCancel when the cancel button is clicked', () => {
    const onCancel = vi.fn()
    render(() => (
      <ConfirmDialog {...baseProps} open={true} onCancel={onCancel} />
    ))
    fireEvent.click(screen.getByTestId('confirm-cancel'))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('fires onCancel when the overlay backdrop is clicked', () => {
    const onCancel = vi.fn()
    render(() => (
      <ConfirmDialog {...baseProps} open={true} onCancel={onCancel} />
    ))
    fireEvent.click(screen.getByTestId('confirm-overlay'))
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
    render(() => (
      <ConfirmDialog {...baseProps} open={true} confirmLabel="Remove" />
    ))
    const confirmBtn = screen.getByTestId('confirm-delete')
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
    render(() => (
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
    fireEvent.click(screen.getByTestId('confirm-overlay'))
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

  // Type-to-confirm — the gate on unrecoverable actions (account erasure).
  describe('confirmPhrase', () => {
    it('keeps confirm disabled until the exact phrase is typed', () => {
      const onConfirm = vi.fn()
      render(() => (
        <ConfirmDialog
          {...baseProps}
          open={true}
          confirmPhrase="delete"
          onConfirm={onConfirm}
        />
      ))
      const confirm = screen.getByTestId('confirm-delete')
      const input = screen.getByTestId('confirm-phrase')

      expect(confirm).toBeDisabled()
      fireEvent.click(confirm)
      expect(onConfirm).not.toHaveBeenCalled()

      // A near-miss must not unlock it.
      fireEvent.input(input, { target: { value: 'delet' } })
      expect(confirm).toBeDisabled()

      fireEvent.input(input, { target: { value: 'delete' } })
      expect(confirm).not.toBeDisabled()
      fireEvent.click(confirm)
      expect(onConfirm).toHaveBeenCalledTimes(1)
    })

    it('accepts case and whitespace variations of the phrase', () => {
      const onConfirm = vi.fn()
      render(() => (
        <ConfirmDialog
          {...baseProps}
          open={true}
          confirmPhrase="delete"
          onConfirm={onConfirm}
        />
      ))
      fireEvent.input(screen.getByTestId('confirm-phrase'), {
        target: { value: '  DELETE ' },
      })
      fireEvent.click(screen.getByTestId('confirm-delete'))
      expect(onConfirm).toHaveBeenCalledTimes(1)
    })

    it('clears the typed phrase when reopened, so the next delete is not one click', () => {
      const [open, setOpen] = createSignal(true)
      render(() => (
        <ConfirmDialog {...baseProps} open={open()} confirmPhrase="delete" />
      ))
      fireEvent.input(screen.getByTestId('confirm-phrase'), {
        target: { value: 'delete' },
      })
      expect(screen.getByTestId('confirm-delete')).not.toBeDisabled()

      setOpen(false)
      setOpen(true)
      expect(screen.getByTestId('confirm-delete')).toBeDisabled()
    })

    it('confirms on Enter once the phrase matches', () => {
      const onConfirm = vi.fn()
      render(() => (
        <ConfirmDialog
          {...baseProps}
          open={true}
          confirmPhrase="delete"
          onConfirm={onConfirm}
        />
      ))
      const input = screen.getByTestId('confirm-phrase')
      fireEvent.keyDown(input, { key: 'Enter' })
      expect(onConfirm).not.toHaveBeenCalled()

      fireEvent.input(input, { target: { value: 'delete' } })
      fireEvent.keyDown(input, { key: 'Enter' })
      expect(onConfirm).toHaveBeenCalledTimes(1)
    })

    it('leaves dialogs without a phrase working as a plain confirm', () => {
      const onConfirm = vi.fn()
      render(() => (
        <ConfirmDialog {...baseProps} open={true} onConfirm={onConfirm} />
      ))
      expect(screen.queryByTestId('confirm-phrase')).toBeNull()
      expect(screen.getByTestId('confirm-delete')).not.toBeDisabled()
      fireEvent.click(screen.getByTestId('confirm-delete'))
      expect(onConfirm).toHaveBeenCalledTimes(1)
    })
  })
})

describe('ConfirmDialog tone and secondary action', () => {
  it('paints a primary confirm without the destructive class and offers a labelled third way out', () => {
    const onSecondary = vi.fn()
    const onCancel = vi.fn()
    render(() => (
      <ConfirmDialog
        open={true}
        title="Sing it for the board?"
        message="A ranked take goes on the public board."
        tone="primary"
        confirmLabel="Put me on the board"
        secondaryLabel="Sing as practice"
        onSecondary={onSecondary}
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />
    ))
    const confirm = screen.getByTestId('confirm-delete')
    expect(confirm.className).not.toContain('delete')
    expect(confirm.className).toContain('primary')

    fireEvent.click(screen.getByRole('button', { name: 'Sing as practice' }))
    expect(onSecondary).toHaveBeenCalledTimes(1)
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('keeps the destructive style and no third action by default', () => {
    render(() => (
      <ConfirmDialog
        open={true}
        title="Delete this take?"
        message="Gone for good."
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    ))
    expect(screen.getByTestId('confirm-delete').className).toContain('delete')
    expect(screen.queryByTestId('confirm-secondary')).toBeNull()
  })
})

describe("ConfirmDialog's Cancel label", () => {
  // A label is a label: the layout is the variant's to change, not the words'.
  it('names Cancel without changing the usual pair', () => {
    render(() => (
      <ConfirmDialog
        open={true}
        title="Replace the take?"
        message="The old one goes."
        cancelLabel="Back"
        confirmLabel="Replace"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    ))

    const back = screen.getByRole('button', { name: 'Back' })
    const replace = screen.getByRole('button', { name: /Replace/ })
    expect(back.className).toContain('cancel')
    expect(replace.className).toContain('delete')
    expect(screen.getByTestId('trash-icon')).toBeTruthy()
    expect((back.parentElement as HTMLElement).className).not.toContain(
      'stacked',
    )
  })
})

describe('ConfirmDialog as a way to stay', () => {
  function stay(onCancel = vi.fn(), onConfirm = vi.fn()) {
    render(() => (
      <ConfirmDialog
        open={true}
        title="Skip the intro?"
        message="Stay, and you get:"
        details={['Your range', 'A plan']}
        variant="stay"
        cancelLabel="Keep going"
        confirmLabel="Yes, skip"
        isolateKeyboard
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    ))
    return { onCancel, onConfirm }
  }

  it('offers Keep going on top as the one primary, and Yes, skip under it without an icon', () => {
    stay()

    const keep = screen.getByRole('button', { name: 'Keep going' })
    const skip = screen.getByRole('button', { name: 'Yes, skip' })
    expect(keep.className).toContain('keep')
    expect(skip.className).toContain('quiet')
    expect(skip.className).not.toContain('delete')
    expect(skip.className).not.toContain('primary')
    expect(screen.queryByTestId('trash-icon')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull()
    // Two buttons, stacked: Keep going first in the reading order.
    const actions = keep.parentElement as HTMLElement
    expect(actions.className).toContain('stacked')
    expect([...actions.querySelectorAll('button')]).toEqual([keep, skip])
  })

  it('opens with the focus on Keep going', async () => {
    stay()

    await Promise.resolve()

    expect(screen.getByRole('button', { name: 'Keep going' })).toHaveFocus()
  })

  it('lists the details under the message, outside its paragraph, and reads them as the description', () => {
    stay()

    const dialog = screen.getByRole('alertdialog')
    const items = screen.getAllByRole('listitem')
    expect(items.map((item) => item.textContent)).toEqual([
      'Your range',
      'A plan',
    ])
    expect(items[0]?.closest('p')).toBeNull()
    const described = (dialog.getAttribute('aria-describedby') ?? '').split(' ')
    expect(described).toHaveLength(2)
    expect(document.getElementById(described[1] ?? '')).toContainElement(
      items[0] ?? null,
    )
  })

  it('shows no list, and describes by the message alone, without details', () => {
    render(() => (
      <ConfirmDialog
        open={true}
        title="Leave?"
        message="Sure?"
        details={[]}
        variant="stay"
        cancelLabel="Stay"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    ))

    expect(screen.queryByRole('list')).toBeNull()
    expect(
      screen.getByRole('alertdialog').getAttribute('aria-describedby'),
    ).not.toContain(' ')
  })

  it('keeps going on Keep going and skips on Yes, skip', () => {
    const { onCancel, onConfirm } = stay()

    fireEvent.click(screen.getByRole('button', { name: 'Keep going' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Yes, skip' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('keeps its keys from the app behind when asked to', () => {
    const heard = vi.fn()
    window.addEventListener('keydown', heard)
    stay()

    fireEvent.keyDown(screen.getByRole('button', { name: 'Keep going' }), {
      key: ' ',
      code: 'Space',
    })

    window.removeEventListener('keydown', heard)
    expect(heard).not.toHaveBeenCalled()
  })
})
