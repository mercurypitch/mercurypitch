// KaraokePlaylistSidebar — unified songs and playlist drawer tests.

import { cleanup, fireEvent, render, screen, waitFor, } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { KaraokePlaylistSidebar } from '../KaraokePlaylistSidebar'

vi.mock('@/stores/karaoke-playlist-store', () => ({
  createPlaylist: vi.fn(),
  deletePlaylist: vi.fn(),
  getPlaylistsReactive: () => [],
  renamePlaylist: vi.fn(),
  startPlaylist: vi.fn(),
}))

vi.mock('../KaraokePlaylistEditor', () => ({
  KaraokePlaylistEditor: () => <div>Playlist editor</div>,
}))

afterEach(cleanup)

const songs = [
  {
    sessionId: 'current-song',
    title: 'Current Song',
    availableStems: ['vocal', 'instrumental'] as const,
  },
  {
    sessionId: 'next-song',
    title: 'Next Song',
    availableStems: ['vocal', 'instrumental'] as const,
  },
]

describe('KaraokePlaylistSidebar', () => {
  it('opens on Songs and switches directly to another library song', () => {
    const onClose = vi.fn()
    const onPickSong = vi.fn()
    render(() => (
      <KaraokePlaylistSidebar
        songs={songs}
        currentSessionId="current-song"
        onClose={onClose}
        onPickSong={onPickSong}
      />
    ))

    expect(screen.getByRole('tab', { name: /Songs/ })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(screen.getByRole('button', { name: /Current Song/ })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: /Next Song/ }))

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onPickSong).toHaveBeenCalledWith('next-song')
  })

  it('keeps playlist creation and editing in the Playlists tab', () => {
    render(() => (
      <KaraokePlaylistSidebar
        songs={songs}
        currentSessionId="current-song"
        onClose={vi.fn()}
      />
    ))

    fireEvent.click(screen.getByRole('tab', { name: /Playlists/ }))

    expect(screen.getByText('No playlists yet.')).toBeInTheDocument()
    expect(
      screen.getByPlaceholderText('New playlist name…'),
    ).toBeInTheDocument()
  })

  it('launches a play-along role for the selected song', async () => {
    const onClose = vi.fn()
    const onPlayAlong = vi.fn()
    render(() => (
      <KaraokePlaylistSidebar
        songs={songs}
        currentSessionId="current-song"
        onClose={onClose}
        onPlayAlong={onPlayAlong}
      />
    ))

    const picker = screen.getByRole('combobox', {
      name: 'Choose what you perform in Next Song',
    })
    await waitFor(() => expect(picker).toBeEnabled())
    fireEvent.change(picker, { target: { value: 'sing' } })

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onPlayAlong).toHaveBeenCalledWith(
      'next-song',
      expect.objectContaining({ id: 'sing', mutedStemKeys: ['vocal'] }),
    )
  })
})
