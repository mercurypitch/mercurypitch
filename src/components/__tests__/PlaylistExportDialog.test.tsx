import { fireEvent, render, screen } from '@solidjs/testing-library'
import { describe, expect, it, vi } from 'vitest'
import { PlaylistExportDialog } from '../PlaylistExportDialog'

const baseProps = {
  open: true,
  playlistName: 'Friday Set',
  songCount: 3,
  progress: 92,
  status: 'running' as const,
  onClose: () => {},
}

describe('PlaylistExportDialog', () => {
  it('presents progress as a blocking, accessible long-running task', () => {
    const onClose = vi.fn()
    render(() => <PlaylistExportDialog {...baseProps} onClose={onClose} />)

    const dialog = screen.getByRole('dialog', {
      name: 'Packing “Friday Set”',
    })
    expect(dialog).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByText(/preparing 3 songs/i)).toBeVisible()
    expect(screen.getByText('Compressing your playlist ZIP')).toBeVisible()
    expect(screen.getByLabelText('Export progress')).toHaveTextContent('92%')
    expect(
      screen.getByRole('progressbar', { name: 'Exporting Friday Set' }),
    ).toHaveAttribute('aria-valuenow', '92')
    expect(screen.queryByRole('button', { name: 'Close' })).toBeNull()

    fireEvent.keyDown(dialog, { key: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()
  })

  it('shows a recoverable error instead of silently disappearing', () => {
    const onClose = vi.fn()
    render(() => (
      <PlaylistExportDialog {...baseProps} status="error" onClose={onClose} />
    ))

    expect(
      screen.getByRole('dialog', { name: 'Export couldn’t be finished' }),
    ).not.toHaveAttribute('aria-busy')
    expect(screen.getByText('The ZIP archive was not created')).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
