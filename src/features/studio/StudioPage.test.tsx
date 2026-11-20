// Studio page tests — the save picker empties the file it hands back, so everything that could refuse a backup is asked before it opens; and the page's one banner offers what its state can use.
import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { StudioProjectSummary } from '@/lib/studio/model/types'
import { studioSongs } from '@/stores/studio-songs-store'
import type * as BackupTarget from './backup/backup-target'
import type { StudioBackupTarget } from './backup/backup-target'
import { setStudioTakeRunning } from './record/take-running'
import { StudioPage } from './StudioPage'

const picker = vi.hoisted(() => ({ open: vi.fn(), sweep: vi.fn() }))
vi.mock('./backup/backup-target', async (importOriginal) => ({
  ...(await importOriginal<typeof BackupTarget>()),
  openStudioBackupTarget: picker.open,
  sweepStudioBackupCopies: picker.sweep,
}))
const studio = vi.hoisted(() => ({ current: {} as Record<string, unknown> }))
vi.mock('./useStudioController', () => ({
  useStudioController: () => studio.current,
}))
vi.mock('./StudioWorkspace', () => ({ StudioWorkspace: () => null }))

afterEach(() => {
  cleanup()
  picker.open.mockReset()
  picker.sweep.mockReset()
  vi.useRealTimers()
  setStudioTakeRunning(false)
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
function mountPage(
  problem: string | null = null,
  overrides: Record<string, unknown> = {},
) {
  const controller = {
    project: () => ({ id: 'one', title: 'Window seat' }),
    projects: () => [song('one', 'Window seat'), song('two', 'Sketch')],
    loading: () => false,
    busy: () => false,
    editBlocked: () => false,
    hasUnsavedChanges: () => false,
    importing: () => false,
    problem: () => problem,
    saveState: () => 'error',
    writable: () => true,
    protection: () => null,
    refreshProjects: vi.fn(),
    canBackup: vi.fn(() => true),
    openForBackup: vi.fn(async () => true),
    open: vi.fn(async () => {}),
    backup: vi.fn(async () => true),
    takeOver: vi.fn(async () => {}),
    fork: vi.fn(async () => {}),
    discardAndReload: vi.fn(async () => {}),
    ...overrides,
  }
  studio.current = controller
  render(() => <StudioPage />)
  return controller
}

describe('Studio page backups', () => {
  it('sweeps private backup copies a closed tab left behind when the Studio opens', () => {
    mountPage()
    expect(picker.sweep).toHaveBeenCalledOnce()
  })

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

  it('suggests a name with the date and minute, so the picker never offers the last backup by default', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 9, 29, 11, 42))
    mountPage('Full')
    picker.open.mockResolvedValue(null)

    fireEvent.click(screen.getByRole('button', { name: 'Save project backup' }))
    fireEvent.click(
      screen.getByRole('button', { name: 'Save a backup of Sketch' }),
    )
    await Promise.resolve()

    expect(picker.open.mock.calls).toEqual([
      ['Window-seat-2026-10-29-1142.mpstudio'],
      ['Sketch-2026-10-29-1142.mpstudio'],
    ])
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

describe('Studio page banner', () => {
  const TAKEN =
    'This project is no longer editable in this tab. Reload, make a copy, or take over editing.'

  it('offers the takeover and a plain Reload once editing moved to another tab with nothing unsaved', () => {
    // Arrange
    const controller = mountPage(TAKEN, {
      writable: () => false,
      saveState: () => 'saved',
    })

    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Reload' }))

    // Assert
    expect(screen.getAllByRole('alert')).toHaveLength(1)
    expect(
      screen.getByRole('button', { name: 'Edit in this tab' }),
    ).toBeEnabled()
    expect(
      screen.queryByRole('button', { name: 'Discard changes and reload' }),
    ).toBeNull()
    expect(controller.discardAndReload).toHaveBeenCalledOnce()
  })

  it('asks before a reload that would discard unsaved changes, and offers no takeover while this tab edits', () => {
    const controller = mountPage('Studio could not save your latest changes.', {
      hasUnsavedChanges: () => true,
    })

    fireEvent.click(
      screen.getByRole('button', { name: 'Discard changes and reload' }),
    )

    expect(
      screen.queryByRole('button', { name: 'Edit in this tab' }),
    ).toBeNull()
    expect(controller.discardAndReload).not.toHaveBeenCalled()
    expect(screen.getByRole('alertdialog')).toHaveTextContent(
      'Discard changes?',
    )
  })
})

describe('Studio page song switch for the sidebar', () => {
  it('lends its song list and open song while mounted, and takes them back when it unmounts', () => {
    mountPage()
    const loan = studioSongs()
    expect(loan?.songs().map((entry) => entry.title)).toEqual([
      'Window seat',
      'Sketch',
    ])
    expect(loan?.openId()).toBe('one')
    expect(loan?.hold()).toBeNull()

    cleanup()

    expect(studioSongs()).toBeNull()
  })

  it('switches through the wait for a save in flight and the checks of its own list', async () => {
    const controller = mountPage()

    await studioSongs()!.open('two')

    expect(controller.canBackup).toHaveBeenCalledWith('two')
    expect(controller.openForBackup).toHaveBeenCalledWith('two')
    expect(controller.open).not.toHaveBeenCalled()
  })

  it('opens nothing when the controller refuses the switch', async () => {
    const controller = mountPage()
    controller.canBackup.mockReturnValue(false)

    await studioSongs()!.open('two')

    expect(controller.openForBackup).not.toHaveBeenCalled()
  })

  it('holds the switch while a take runs, as leaving the tab is held', async () => {
    const controller = mountPage(null, { saveState: () => 'saved' })
    setStudioTakeRunning(true)

    expect(studioSongs()!.hold()).toBe('Stop the take to switch songs.')
    await studioSongs()!.open('two')

    expect(controller.canBackup).not.toHaveBeenCalled()
    expect(controller.openForBackup).not.toHaveBeenCalled()
  })

  it('names what else holds it: an import, a song task, or changes a save cannot keep', () => {
    let importing = true
    let working = false
    let unsaved = false
    let saveState = 'saving'
    mountPage(null, {
      importing: () => importing,
      editBlocked: () => importing || working,
      hasUnsavedChanges: () => unsaved,
      saveState: () => saveState,
    })
    const hold = () => studioSongs()!.hold()

    expect(hold()).toBe(
      'Studio is adding audio to this song. Switch once it is in.',
    )
    importing = false
    working = true
    expect(hold()).toBe(
      'Studio is busy with this song. Switch once it finishes.',
    )
    working = false
    unsaved = true
    // A save in flight lands before the switch: no hold.
    expect(hold()).toBeNull()
    saveState = 'error'
    expect(hold()).toBe('Keep or discard this song’s unsaved changes first.')
  })

  it('shows the open song again from the library without reopening it', async () => {
    const controller = mountPage(null, { saveState: () => 'saved' })
    expect(
      screen.getByRole('navigation', { name: 'Studio projects' }),
    ).toBeInTheDocument()

    await studioSongs()!.open('one')

    expect(controller.openForBackup).not.toHaveBeenCalled()
    expect(
      screen.queryByRole('navigation', { name: 'Studio projects' }),
    ).toBeNull()
  })
})
