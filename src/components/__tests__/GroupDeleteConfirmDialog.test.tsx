import { render, screen } from '@solidjs/testing-library'
import { describe, expect, it, vi } from 'vitest'
import { GroupDeleteConfirmDialog } from '../GroupDeleteConfirmDialog'

describe('GroupDeleteConfirmDialog', () => {
  it('states the destructive scope for a populated group', () => {
    render(() => (
      <GroupDeleteConfirmDialog
        target={{ id: 'group-1', name: 'Friday set', songCount: 3 }}
        busy={false}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    ))

    expect(
      screen.getByRole('alertdialog', { name: 'Delete "Friday set"?' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        '3 songs and their saved stems will be permanently deleted. This cannot be undone.',
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Delete group' }),
    ).toBeInTheDocument()
  })

  it('uses singular copy and exposes pending state', () => {
    render(() => (
      <GroupDeleteConfirmDialog
        target={{ id: 'group-1', name: 'Solo', songCount: 1 }}
        busy={true}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    ))

    expect(
      screen.getByText(
        '1 song and its saved stems will be permanently deleted. This cannot be undone.',
      ),
    ).toBeInTheDocument()
    expect(screen.getByRole('alertdialog')).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByRole('button', { name: 'Deleting…' })).toBeDisabled()
  })
})
