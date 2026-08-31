// ============================================================
// Drum Project Library tests — lazy truth, guarded writes, and ledger order
// ============================================================

import { cleanup, fireEvent, render, screen, waitFor, within, } from '@solidjs/testing-library'
import { batch, createSignal } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DrumProjectLibraryProps, DrumProjectLibraryRow, DrumProjectLibraryView, } from './DrumProjectLibrary'
import { DrumProjectLibrary } from './DrumProjectLibrary'
import { DrumProjectSavePrompt } from './DrumProjectSavePrompt'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const PROJECTS: readonly DrumProjectLibraryRow[] = [
  {
    id: 'project-late-pocket',
    name: 'Late Pocket',
    variationLabel: 'Half-time',
    barCount: 2,
    hitCount: 28,
    tempoBpm: 84,
    editedAt: Date.parse('2026-08-26T12:30:00.000Z'),
    onStage: false,
  },
  {
    id: 'project-night-train',
    name: 'Night Train',
    variationLabel: 'Four on the floor',
    barCount: 4,
    hitCount: 64,
    tempoBpm: 118,
    editedAt: Date.parse('2026-08-26T18:45:00.000Z'),
    onStage: true,
  },
]

function defaultView(
  overrides: Partial<DrumProjectLibraryView> = {},
): DrumProjectLibraryView {
  return {
    library: {
      kind: 'ready',
      projects: PROJECTS,
      skippedCount: 0,
      futureCount: 0,
    },
    current: {
      id: 'project-night-train',
      name: 'Night Train',
      suggestedName: 'Night Train',
      dirty: false,
      persisted: true,
    },
    savePromptOpen: false,
    operation: { kind: 'idle' },
    ...overrides,
  }
}

function libraryCallbacks(
  overrides: Partial<Omit<DrumProjectLibraryProps, 'view'>> = {},
): Omit<DrumProjectLibraryProps, 'view'> {
  return {
    onLoad: vi.fn(),
    onRetry: vi.fn(),
    onSaveCurrent: vi.fn(),
    onRetrySave: vi.fn(),
    onRevertCurrent: vi.fn(),
    onCancelSavePrompt: vi.fn(),
    onOpenProject: vi.fn(),
    onSaveCurrentThenOpen: vi.fn(),
    onDiscardCurrentThenOpen: vi.fn(),
    onRenameProject: vi.fn(),
    onDeleteProject: vi.fn(),
    onEraseAll: vi.fn(),
    ...overrides,
  }
}

function mountLibrary(
  view: DrumProjectLibraryView = defaultView(),
  overrides: Partial<Omit<DrumProjectLibraryProps, 'view'>> = {},
) {
  const props = libraryCallbacks(overrides)
  const mounted = render(() => <DrumProjectLibrary view={view} {...props} />)
  return { ...mounted, props }
}

describe('DrumProjectLibrary', () => {
  it('loads only when the lazy surface mounts and never touches device APIs', () => {
    const indexedDbOpen = vi.fn()
    const audioContext = vi.fn()
    const requestMidiAccess = vi.fn()
    vi.stubGlobal('indexedDB', { open: indexedDbOpen })
    vi.stubGlobal('AudioContext', audioContext)
    Object.defineProperty(navigator, 'requestMIDIAccess', {
      configurable: true,
      value: requestMidiAccess,
    })
    const onLoad = vi.fn()

    mountLibrary(
      defaultView({
        library: { kind: 'idle' },
      }),
      { onLoad },
    )

    expect(onLoad).toHaveBeenCalledOnce()
    expect(screen.getByText('Opening your drum projects')).toBeVisible()
    expect(indexedDbOpen).not.toHaveBeenCalled()
    expect(audioContext).not.toHaveBeenCalled()
    expect(requestMidiAccess).not.toHaveBeenCalled()
  })

  it('orders rows newest first and renders only project musical facts', () => {
    mountLibrary()

    const rows = screen.getAllByRole('listitem')
    expect(within(rows[0]!).getByText('Night Train')).toBeVisible()
    expect(within(rows[1]!).getByText('Late Pocket')).toBeVisible()
    expect(screen.getByText('4 bars')).toBeVisible()
    expect(screen.getByText('64 hits')).toBeVisible()
    expect(screen.getByText('118 BPM')).toBeVisible()
    expect(screen.getByText('On stage')).toBeVisible()
    expect(
      screen.queryByText(/^(kit|room|midi mapping)$/i),
    ).not.toBeInTheDocument()
    expect(
      screen.getByText(/Audio and device setup are never part/i),
    ).toBeVisible()
  })

  it('submits and cancels the inline first-save prompt', () => {
    const onSaveCurrent = vi.fn()
    const onCancelSavePrompt = vi.fn()
    mountLibrary(
      defaultView({
        current: {
          id: null,
          name: '',
          suggestedName: 'First Pocket — Classic',
          dirty: true,
          persisted: false,
        },
        savePromptOpen: true,
      }),
      { onSaveCurrent, onCancelSavePrompt },
    )

    const input = screen.getByRole('textbox', { name: 'Project name' })
    expect(input).toHaveValue('First Pocket — Classic')
    fireEvent.input(input, { target: { value: '  My pocket  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save on this device' }))
    expect(onSaveCurrent).toHaveBeenCalledWith('My pocket')

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancelSavePrompt).toHaveBeenCalledOnce()
  })

  it('focuses a first-save name after delayed initialization becomes idle only once', async () => {
    const [view, setView] = createSignal(
      defaultView({
        current: {
          id: null,
          name: '',
          suggestedName: 'Delayed Pocket',
          dirty: true,
          persisted: false,
        },
        savePromptOpen: true,
        operation: { kind: 'pending', action: 'save' },
      }),
    )
    render(() => (
      <DrumProjectSavePrompt
        open={view().savePromptOpen}
        current={view().current}
        operation={view().operation}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />
    ))

    const input = screen.getByRole('textbox', { name: 'Project name' })
    expect(input).toBeDisabled()
    await Promise.resolve()
    expect(input).not.toHaveFocus()

    setView((current) => ({
      ...current,
      operation: { kind: 'idle' },
    }))
    await waitFor(() => expect(input).toHaveFocus())

    const cancel = screen.getByRole('button', { name: 'Cancel' })
    cancel.focus()
    expect(cancel).toHaveFocus()
    setView((current) => ({ ...current }))
    await Promise.resolve()
    expect(cancel).toHaveFocus()
  })

  it('guards dirty replacement with save, discard, and cancel choices', () => {
    const onSaveCurrentThenOpen = vi.fn()
    const onDiscardCurrentThenOpen = vi.fn()
    mountLibrary(
      defaultView({
        current: {
          id: null,
          name: '',
          suggestedName: 'New pocket',
          dirty: true,
          persisted: false,
        },
      }),
      { onSaveCurrentThenOpen, onDiscardCurrentThenOpen },
    )

    fireEvent.click(screen.getByRole('button', { name: 'Open' }))
    const firstDialog = screen.getByRole('alertdialog')
    expect(within(firstDialog).getByText('Open Late Pocket?')).toBeVisible()
    const currentName = within(firstDialog).getByRole('textbox', {
      name: 'Current project name',
    })
    fireEvent.input(currentName, { target: { value: 'Saved answer' } })
    fireEvent.click(
      within(firstDialog).getByRole('button', {
        name: 'Save current and open',
      }),
    )
    expect(onSaveCurrentThenOpen).toHaveBeenCalledWith(
      'project-late-pocket',
      'Saved answer',
    )

    fireEvent.click(screen.getByRole('button', { name: 'Open' }))
    const secondDialog = screen.getByRole('alertdialog')
    fireEvent.click(
      within(secondDialog).getByRole('button', {
        name: 'Discard and open',
      }),
    )
    expect(onDiscardCurrentThenOpen).toHaveBeenCalledWith('project-late-pocket')

    fireEvent.click(screen.getByRole('button', { name: 'Open' }))
    const thirdDialog = screen.getByRole('alertdialog')
    fireEvent.click(within(thirdDialog).getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('keeps rename and delete confirmation inline and names the target', () => {
    const onRenameProject = vi.fn()
    const onDeleteProject = vi.fn()
    mountLibrary(defaultView(), { onRenameProject, onDeleteProject })

    fireEvent.click(screen.getByRole('button', { name: 'Rename Late Pocket' }))
    const renameForm = screen.getByRole('form', { name: 'Rename Late Pocket' })
    const renameInput = within(renameForm).getByRole('textbox', {
      name: 'New project name',
    })
    fireEvent.input(renameInput, { target: { value: '  Late Answer  ' } })
    fireEvent.click(
      within(renameForm).getByRole('button', { name: 'Rename project' }),
    )
    expect(onRenameProject).toHaveBeenCalledWith(
      'project-late-pocket',
      'Late Answer',
    )

    fireEvent.click(screen.getByRole('button', { name: 'Delete Night Train' }))
    const deleteDialog = screen.getByRole('alertdialog')
    expect(within(deleteDialog).getByText('Delete Night Train?')).toBeVisible()
    expect(
      within(deleteDialog).getByText(/groove on stage stays open/i),
    ).toBeVisible()
    fireEvent.click(
      within(deleteDialog).getByRole('button', { name: 'Delete project' }),
    )
    expect(onDeleteProject).toHaveBeenCalledWith('project-night-train')
  })

  it('states load failure and skipped or future rows without changing the stage', () => {
    const onRetry = vi.fn()
    const failed = mountLibrary(
      defaultView({
        library: {
          kind: 'error',
          message: 'First Pocket is still ready on stage.',
        },
      }),
      { onRetry },
    )

    expect(screen.getByText('Projects could not be opened')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(onRetry).toHaveBeenCalledOnce()
    failed.unmount()

    mountLibrary(
      defaultView({
        library: {
          kind: 'ready',
          projects: [],
          skippedCount: 2,
          futureCount: 1,
        },
      }),
    )
    expect(screen.getByText('No saved grooves yet')).toBeVisible()
    expect(screen.getByText(/2 saved grooves.*skipped/i)).toBeVisible()
    expect(screen.getByText(/1 saved groove.*newer Drum Night/i)).toBeVisible()
  })

  it('focuses failed-save recovery and confirms restoring the durable version', async () => {
    const onRetrySave = vi.fn()
    const onRevertCurrent = vi.fn()
    mountLibrary(
      defaultView({
        current: {
          id: 'project-night-train',
          name: 'Night Train',
          suggestedName: 'Night Train',
          dirty: true,
          persisted: true,
        },
        operation: {
          kind: 'error',
          action: 'save',
          message: 'Local storage is unavailable.',
        },
      }),
      { onRetrySave, onRevertCurrent },
    )

    const retry = screen.getByRole('button', { name: 'Try save again' })
    await waitFor(() => expect(retry).toHaveFocus())
    fireEvent.click(retry)
    expect(onRetrySave).toHaveBeenCalledOnce()

    fireEvent.click(screen.getByRole('button', { name: 'Restore last saved' }))
    let dialog = screen.getByRole('alertdialog', {
      name: 'Restore last saved version?',
    })
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Keep unsaved changes' }),
    )
    expect(onRevertCurrent).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Restore last saved' }))
    dialog = screen.getByRole('alertdialog', {
      name: 'Restore last saved version?',
    })
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Restore saved version' }),
    )
    expect(onRevertCurrent).toHaveBeenCalledOnce()
  })

  it('names and confirms the Drum-only erase boundary', () => {
    const onEraseAll = vi.fn()
    mountLibrary(defaultView(), { onEraseAll })

    fireEvent.click(
      screen.getByRole('button', { name: 'Erase Drum projects and takes' }),
    )
    let dialog = screen.getByRole('alertdialog', {
      name: 'Erase Drum projects and summary history?',
    })
    expect(
      screen.getByText(/leaves kits, rooms, input mappings/i),
    ).toBeVisible()
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Keep Drum data' }),
    )
    expect(onEraseAll).not.toHaveBeenCalled()

    fireEvent.click(
      screen.getByRole('button', { name: 'Erase Drum projects and takes' }),
    )
    dialog = screen.getByRole('alertdialog', {
      name: 'Erase Drum projects and summary history?',
    })
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Erase Drum data' }),
    )
    expect(onEraseAll).toHaveBeenCalledOnce()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('restores erase focus when durable success settles directly back to idle', async () => {
    const [view, setView] = createSignal(defaultView())
    const onEraseAll = vi.fn(() => {
      batch(() => {
        setView((current) => ({
          ...current,
          operation: { kind: 'pending', action: 'erase' },
        }))
        setView((current) => ({
          ...current,
          library: {
            kind: 'ready',
            projects: [],
            skippedCount: 0,
            futureCount: 0,
          },
          current: {
            id: null,
            name: '',
            suggestedName: 'First Pocket',
            dirty: false,
            persisted: false,
          },
          operation: { kind: 'idle' },
        }))
      })
    })
    const props = libraryCallbacks({ onEraseAll })
    render(() => <DrumProjectLibrary view={view()} {...props} />)

    fireEvent.click(
      screen.getByRole('button', { name: 'Erase Drum projects and takes' }),
    )
    const dialog = screen.getByRole('alertdialog', {
      name: 'Erase Drum projects and summary history?',
    })
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Erase Drum data' }),
    )

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    await waitFor(() =>
      expect(
        screen.getByRole('button', {
          name: 'Erase Drum projects and takes',
        }),
      ).toHaveFocus(),
    )
  })

  it('keeps erase failure truth visible after closing the confirmation', async () => {
    const [view, setView] = createSignal(defaultView())
    const onEraseAll = vi.fn(() => {
      setView((current) => ({
        ...current,
        operation: {
          kind: 'error',
          action: 'erase',
          message: 'Local drum projects are unavailable.',
        },
      }))
    })
    const props = libraryCallbacks({ onEraseAll })
    render(() => <DrumProjectLibrary view={view()} {...props} />)

    fireEvent.click(
      screen.getByRole('button', { name: 'Erase Drum projects and takes' }),
    )
    fireEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', {
        name: 'Erase Drum data',
      }),
    )

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Local drum projects are unavailable.',
    )
    await waitFor(() =>
      expect(
        screen.getByRole('button', {
          name: 'Erase Drum projects and takes',
        }),
      ).toHaveFocus(),
    )
  })
})
