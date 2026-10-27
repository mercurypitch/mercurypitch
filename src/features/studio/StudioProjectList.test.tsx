// Studio song list tests — each song row opens, exports or saves a backup on its own.
import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { StudioProjectSummary } from '@/lib/studio/model/types'
import { StudioProjectList } from './StudioProjectList'

afterEach(cleanup)

function song(
  id: string,
  title: string,
  durationFrames: number,
): StudioProjectSummary {
  return {
    id,
    title,
    revision: 1,
    createdAt: '2026-10-27T08:00:00.000Z',
    updatedAt: '2026-10-27T08:00:00.000Z',
    trackCount: 2,
    clipCount: durationFrames > 0 ? 2 : 0,
    durationFrames,
  }
}

describe('Studio song list', () => {
  it('exports or backs up a song from its row without opening it first', () => {
    const handlers = {
      onCreate: vi.fn(),
      onOpen: vi.fn(),
      onExport: vi.fn(),
      onBackup: vi.fn(),
      onRestore: vi.fn(),
    }
    render(() => (
      <StudioProjectList
        projects={[
          song('a', 'Window seat', 48000 * 95),
          song('b', 'Sketch', 0),
        ]}
        blocked={false}
        {...handlers}
      />
    ))
    fireEvent.click(screen.getByRole('button', { name: 'Export Window seat' }))
    expect(handlers.onExport).toHaveBeenCalledWith('a')
    fireEvent.click(
      screen.getByRole('button', { name: 'Save a backup of Sketch' }),
    )
    expect(handlers.onBackup).toHaveBeenCalledWith('b')
    expect(handlers.onOpen).not.toHaveBeenCalled()
    // An empty song has nothing to export yet.
    expect(screen.getByRole('button', { name: 'Export Sketch' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: /^Window seat/ }))
    expect(handlers.onOpen).toHaveBeenCalledWith('a')
  })
})
