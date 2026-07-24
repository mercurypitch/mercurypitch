import { fireEvent, render, screen } from '@solidjs/testing-library'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { KaraokePlaylistRecord } from '@/db'
import { KaraokePlaylistGallery } from '../KaraokePlaylistGallery'

const mocks = vi.hoisted(() => ({
  startExport: vi.fn(),
  closeExport: vi.fn(),
  createPlaylist: vi.fn(),
  deletePlaylist: vi.fn(),
  renamePlaylist: vi.fn(),
  startPlaylist: vi.fn(),
}))

const playlist: KaraokePlaylistRecord = {
  id: 'playlist-1',
  name: 'Friday Set',
  createdAt: '2026-07-24T12:00:00.000Z',
  updatedAt: '2026-07-24T12:00:00.000Z',
  items: [
    {
      id: 'item-1',
      kind: 'session',
      refId: 'session-1',
      singerName: 'Mia',
    },
  ],
}

vi.mock('../playlist-export-controller', () => ({
  createPlaylistExportController: () => ({
    task: () => null,
    start: mocks.startExport,
    close: mocks.closeExport,
  }),
}))

vi.mock('@/stores/karaoke-playlist-store', () => ({
  createPlaylist: mocks.createPlaylist,
  deletePlaylist: mocks.deletePlaylist,
  getPlaylistsReactive: () => [playlist],
  renamePlaylist: mocks.renamePlaylist,
  startPlaylist: mocks.startPlaylist,
}))

vi.mock('@/stores/uvr-store', () => ({
  getGroupsReactive: () => [],
}))

vi.mock('../KaraokePlaylistEditor', () => ({
  KaraokePlaylistEditor: () => <div>Playlist editor</div>,
}))

describe('KaraokePlaylistGallery export action', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('starts a playlist export with concrete set details', () => {
    render(() => <KaraokePlaylistGallery />)

    const exportButton = screen.getByRole('button', {
      name: 'Export Friday Set',
    })
    expect(exportButton).toHaveAttribute(
      'title',
      'Export this playlist + its songs (singers, groups) to a ZIP',
    )

    fireEvent.click(exportButton)

    expect(mocks.startExport).toHaveBeenCalledWith({
      playlistId: 'playlist-1',
      playlistName: 'Friday Set',
      songCount: 1,
    })
  })
})
