// Studio page backup tests — the save picker empties the file it hands back, so everything that could refuse a backup is asked before it opens.
import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { StudioProjectSummary } from '@/lib/studio/model/types'
import type * as BackupTarget from './backup/backup-target'
import type { StudioBackupTarget } from './backup/backup-target'
import { StudioPage } from './StudioPage'

const picker = vi.hoisted(() => ({ open: vi.fn() }))
vi.mock('./backup/backup-target', async (importOriginal) => ({
  ...(await importOriginal<typeof BackupTarget>()),
  openStudioBackupTarget: picker.open,
}))
const studio = vi.hoisted(() => ({ current: {} as Record<string, unknown> }))
vi.mock('./useStudioController', () => ({
  useStudioController: () => studio.current,
}))
vi.mock('./StudioWorkspace', () => ({ StudioWorkspace: () => null }))

afterEach(() => {
  cleanup()
  picker.open.mockReset()
})

function song(id: string, title: string): StudioProjectSummary {
  return {
    id,
    title,
    revision: 1,
    createdAt: '2026-10-27T08:00:00.000Z',
    updatedAt: '2026-10-27T08:00:00.000Z',
    trackCount: 2,
    clipCount: 2,
    durationFrames: 48000 * 95,
  }
}

function target(): StudioBackupTarget {
  return {
    kind: 'file',
    name: 'Sketch.mpstudio',
    keepMs: 0,
    reserve: vi.fn(),
    write: vi.fn(),
    close: vi.fn(async () => null),
    discard: vi.fn(async () => {}),
  }
}

/** A controller with `Window seat` open and `Sketch` in the list. */
function mountPage(problem: string | null = null) {
  const controller = {
    project: () => ({ id: 'one', title: 'Window seat' }),
    projects: () => [song('one', 'Window seat'), song('two', 'Sketch')],
    loading: () => false,
    busy: () => false,
    hasUnsavedChanges: () => false,
    problem: () => problem,
    saveState: () => 'error',
    writable: () => true,
    refreshProjects: vi.fn(),
    canBackup: vi.fn(() => true),
    openForBackup: vi.fn(async () => true),
    open: vi.fn(async () => {}),
    backup: vi.fn(async () => true),
  }
  studio.current = controller
  render(() => <StudioPage />)
  return controller
}

describe('Studio page backups', () => {
  it('asks whether a song in the list can be backed up before the save picker opens, and opens none when it cannot', async () => {
    const controller = mountPage()
    controller.canBackup.mockReturnValue(false)

    fireEvent.click(
      screen.getByRole('button', { name: 'Save a backup of Sketch' }),
    )
    await Promise.resolve()

    expect(controller.canBackup).toHaveBeenCalledWith('two')
    expect(picker.open).not.toHaveBeenCalled()
  })

  it('opens the song behind a picked file through the wait for a save in flight, then writes the file', async () => {
    const controller = mountPage()
    const picked = target()
    picker.open.mockResolvedValue(picked)

    fireEvent.click(
      screen.getByRole('button', { name: 'Save a backup of Sketch' }),
    )

    await vi.waitFor(() =>
      expect(controller.backup).toHaveBeenCalledWith(picked),
    )
    expect(controller.openForBackup).toHaveBeenCalledWith('two')
    expect(picked.close).toHaveBeenCalled()
    expect(picked.discard).not.toHaveBeenCalled()
  })

  it("asks the open song's backup too before the save picker opens", async () => {
    const controller = mountPage('Full')
    controller.canBackup.mockReturnValue(false)

    fireEvent.click(screen.getByRole('button', { name: 'Save project backup' }))
    await Promise.resolve()

    expect(controller.canBackup).toHaveBeenCalledWith()
    expect(picker.open).not.toHaveBeenCalled()
  })
})
