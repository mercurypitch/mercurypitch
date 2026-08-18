import { cleanup, fireEvent, render, screen, waitFor, } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { UvrSession } from '@/stores/uvr-store'
import { UvrSessionActions } from '../UvrSessionActions'

const mocks = vi.hoisted(() => ({
  getOriginalFileBlob: vi.fn(),
  listSessionExportStems: vi.fn(),
  exportSession: vi.fn(),
  showNotification: vi.fn(),
}))

vi.mock('@/db/services/session-export-service', () => ({
  listSessionExportStems: mocks.listSessionExportStems,
  exportSession: mocks.exportSession,
}))
vi.mock('@/db/services/uvr-service', () => ({
  getOriginalFileBlob: mocks.getOriginalFileBlob,
}))
vi.mock('@/stores/notifications-store', () => ({
  showNotification: mocks.showNotification,
}))
vi.mock('../icons', () => ({
  DeviceSync: () => <span>DeviceSync</span>,
  Download: () => <span>Download</span>,
  X: () => <span>Close</span>,
  Zap: () => <span>Zap</span>,
}))

/** The actions all live behind one "..." now; open it before reaching in. */
function openMenu(): HTMLElement {
  const trigger = screen.getByRole('button', {
    name: 'More actions for this song',
  })
  fireEvent.click(trigger)
  return trigger
}

function completedSession(overrides: Partial<UvrSession> = {}): UvrSession {
  return {
    sessionId: 'session-123',
    status: 'completed',
    progress: 100,
    processingMode: 'local',
    createdAt: Date.now(),
    originalFile: {
      name: 'original.mp3',
      size: 1024,
      mimeType: 'audio/mpeg',
    },
    ...overrides,
  } as UvrSession
}

describe('UvrSessionActions', () => {
  beforeEach(() => {
    mocks.getOriginalFileBlob.mockReset()
    mocks.listSessionExportStems.mockReset()
    mocks.exportSession.mockReset()
    mocks.showNotification.mockReset()
    mocks.listSessionExportStems.mockResolvedValue(['vocal', 'instrumental'])
    mocks.exportSession.mockResolvedValue(undefined)
    class TestUrl extends URL {
      static createObjectURL = vi.fn(() => 'blob:original')
      static revokeObjectURL = vi.fn()
    }
    vi.stubGlobal('URL', TestUrl)
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('only offers actions supported by the session', () => {
    const { unmount } = render(() => (
      <UvrSessionActions
        sessionId="session-123"
        session={completedSession()}
        onRerunHq={vi.fn()}
      />
    ))

    openMenu()
    expect(screen.getByTestId('overflow-original')).toBeInTheDocument()
    expect(screen.getByTestId('overflow-export-zip')).toBeInTheDocument()
    expect(screen.getByTestId('overflow-hq-same')).toBeInTheDocument()

    unmount()
    render(() => (
      <UvrSessionActions
        sessionId="session-123"
        session={completedSession({
          processingMode: 'server',
          originalFile: undefined,
        })}
        onRerunHq={vi.fn()}
      />
    ))

    // A server-processed session with no stored original can be neither
    // downloaded nor re-run, so neither row is offered at all — which
    // leaves the export alone, and a menu of one is just a button.
    const sole = screen.getByTestId('session-more')
    expect(sole).not.toHaveAttribute('aria-haspopup')
    expect(sole).toHaveAccessibleName('Export session ZIP')
  })

  // ------------------------------------------------------------
  // A menu of one
  // ------------------------------------------------------------

  it('runs the only action directly instead of opening onto it', async () => {
    mocks.listSessionExportStems.mockResolvedValue(['vocal', 'instrumental'])
    render(() => (
      <UvrSessionActions
        sessionId="session-123"
        session={completedSession({
          processingMode: 'server',
          originalFile: undefined,
        })}
      />
    ))

    fireEvent.click(screen.getByTestId('session-more'))
    await waitFor(() =>
      expect(mocks.exportSession).toHaveBeenCalledWith(
        'session-123',
        expect.any(Function),
        ['vocal', 'instrumental'],
      ),
    )
  })

  it('keeps the menu the moment there is a second thing to say', () => {
    render(() => (
      <UvrSessionActions
        sessionId="session-123"
        session={completedSession({
          processingMode: 'server',
          originalFile: undefined,
        })}
        extraItems={[
          {
            key: 'delete',
            label: 'Delete this song',
            onSelect: vi.fn(),
          },
        ]}
      />
    ))

    const trigger = screen.getByTestId('session-more')
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu')
    openMenu()
    expect(screen.getByTestId('overflow-export-zip')).toBeInTheDocument()
    expect(screen.getByTestId('overflow-delete')).toBeInTheDocument()
  })

  it('exports a core-only session immediately', async () => {
    render(() => (
      <UvrSessionActions sessionId="session-123" session={completedSession()} />
    ))

    openMenu()
    fireEvent.click(screen.getByTestId('overflow-export-zip'))

    await waitFor(() =>
      expect(mocks.exportSession).toHaveBeenCalledWith(
        'session-123',
        expect.any(Function),
        ['vocal', 'instrumental'],
      ),
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('defaults full-band sessions to All and supports a restorable custom selection', async () => {
    mocks.listSessionExportStems.mockResolvedValue([
      'vocal',
      'instrumental',
      'drums',
      'bass',
    ])
    render(() => (
      <UvrSessionActions sessionId="session-123" session={completedSession()} />
    ))

    openMenu()
    fireEvent.click(screen.getByTestId('overflow-export-zip'))

    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(
      screen.getByRole('radio', { name: /All available stems/ }),
    ).toBeChecked()

    fireEvent.click(screen.getByRole('radio', { name: /Custom/ }))
    for (const label of ['Vocal', 'Instrumental', 'Drums', 'Bass']) {
      expect(screen.getByRole('checkbox', { name: label })).toBeChecked()
    }

    fireEvent.click(screen.getByRole('checkbox', { name: 'Vocal' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Instrumental' }))
    expect(screen.getByText(/Keep Vocal or Instrumental/i)).toBeInTheDocument()
    expect(screen.getByTestId('session-export-submit')).toBeDisabled()

    fireEvent.click(screen.getByRole('checkbox', { name: 'Vocal' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Bass' }))
    fireEvent.click(screen.getByTestId('session-export-submit'))

    await waitFor(() =>
      expect(mocks.exportSession).toHaveBeenCalledWith(
        'session-123',
        expect.any(Function),
        ['vocal', 'drums'],
      ),
    )
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    )
  })

  it('exports every available full-band stem from the default All preset', async () => {
    mocks.listSessionExportStems.mockResolvedValue([
      'vocal',
      'instrumental',
      'drums',
      'bass',
    ])
    render(() => (
      <UvrSessionActions sessionId="session-123" session={completedSession()} />
    ))

    openMenu()
    fireEvent.click(screen.getByTestId('overflow-export-zip'))
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('session-export-submit'))

    await waitFor(() =>
      expect(mocks.exportSession).toHaveBeenCalledWith(
        'session-123',
        expect.any(Function),
        ['vocal', 'instrumental', 'drums', 'bass'],
      ),
    )
  })

  it('exports only Vocal and Instrumental from the core preset', async () => {
    mocks.listSessionExportStems.mockResolvedValue([
      'vocal',
      'instrumental',
      'drums',
      'bass',
    ])
    render(() => (
      <UvrSessionActions sessionId="session-123" session={completedSession()} />
    ))

    openMenu()
    fireEvent.click(screen.getByTestId('overflow-export-zip'))
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    fireEvent.click(
      screen.getByRole('radio', { name: /Vocal \+ instrumental/ }),
    )
    fireEvent.click(screen.getByTestId('session-export-submit'))

    await waitFor(() =>
      expect(mocks.exportSession).toHaveBeenCalledWith(
        'session-123',
        expect.any(Function),
        ['vocal', 'instrumental'],
      ),
    )
  })

  it('keeps the selector open and reports an archive export failure', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    mocks.listSessionExportStems.mockResolvedValue([
      'vocal',
      'instrumental',
      'drums',
    ])
    mocks.exportSession.mockRejectedValueOnce(new Error('stem read failed'))
    render(() => (
      <UvrSessionActions sessionId="session-123" session={completedSession()} />
    ))

    openMenu()
    fireEvent.click(screen.getByTestId('overflow-export-zip'))
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('session-export-submit'))

    expect(
      await screen.findByText(/session ZIP could not be created/i),
    ).toHaveAttribute('role', 'alert')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(mocks.showNotification).toHaveBeenCalledWith(
      'The session ZIP could not be created. Please try again.',
      'error',
    )
  })

  it('dismisses the full-band selector with Escape and restores trigger focus', async () => {
    mocks.listSessionExportStems.mockResolvedValue([
      'vocal',
      'instrumental',
      'drums',
    ])
    render(() => (
      <UvrSessionActions sessionId="session-123" session={completedSession()} />
    ))
    const trigger = openMenu()
    fireEvent.click(screen.getByTestId('overflow-export-zip'))
    const dialog = await screen.findByRole('dialog')
    fireEvent.keyDown(dialog, { key: 'Escape' })

    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    )
    expect(trigger).toHaveFocus()
  })

  it('uses the filename captured when the download starts', async () => {
    let resolveFile!: (file: File) => void
    mocks.getOriginalFileBlob.mockReturnValue(
      new Promise<File>((resolve) => {
        resolveFile = resolve
      }),
    )
    const clickedNames: string[] = []
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(
      function click(this: HTMLAnchorElement) {
        clickedNames.push(this.download)
      },
    )
    const [session, setSession] = createSignal(completedSession())
    render(() => (
      <UvrSessionActions sessionId="session-123" session={session()} />
    ))

    openMenu()
    fireEvent.click(screen.getByTestId('overflow-original'))
    setSession(
      completedSession({
        originalFile: {
          name: 'renamed.mp3',
          size: 1024,
          mimeType: 'audio/mpeg',
        },
      }),
    )
    resolveFile(new File(['audio'], 'stored.mp3', { type: 'audio/mpeg' }))

    await waitFor(() => expect(clickedNames).toEqual(['original.mp3']))
  })

  it('reports a missing stored original without attempting a download', async () => {
    mocks.getOriginalFileBlob.mockResolvedValue(null)
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click')
    render(() => (
      <UvrSessionActions sessionId="session-123" session={completedSession()} />
    ))

    openMenu()
    fireEvent.click(screen.getByTestId('overflow-original'))

    await waitFor(() =>
      expect(mocks.showNotification).toHaveBeenCalledWith(
        expect.stringContaining("isn't stored"),
        'warning',
      ),
    )
    expect(click).not.toHaveBeenCalled()
  })

  it('runs each HQ target and closes the menu', () => {
    const onRerunHq = vi.fn()
    render(() => (
      <UvrSessionActions
        sessionId="session-123"
        session={completedSession()}
        onRerunHq={onRerunHq}
      />
    ))

    openMenu()
    fireEvent.click(screen.getByTestId('overflow-hq-same'))
    expect(onRerunHq).toHaveBeenLastCalledWith('session-123', 'same')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()

    openMenu()
    fireEvent.click(screen.getByTestId('overflow-hq-new'))
    expect(onRerunHq).toHaveBeenLastCalledWith('session-123', 'new')
  })

  it('fences off the row that replaces the stems', () => {
    render(() => (
      <UvrSessionActions
        sessionId="session-123"
        session={completedSession()}
        onRerunHq={vi.fn()}
      />
    ))

    openMenu()
    const rows = screen.getAllByRole('menuitem')
    // "Upgrade this session" throws away the stems that are there. It sits
    // at the bottom, under a divider, away from Export ZIP.
    expect(rows[rows.length - 1]).toHaveAttribute(
      'data-testid',
      'overflow-hq-same',
    )
    expect(screen.getByRole('separator')).toBeInTheDocument()
  })

  it('shows the card own rows in the same menu', () => {
    const onDelete = vi.fn()
    render(() => (
      <UvrSessionActions
        sessionId="session-123"
        session={completedSession()}
        extraItems={[
          {
            key: 'delete',
            label: 'Delete',
            destructive: true,
            onSelect: onDelete,
          },
        ]}
      />
    ))

    openMenu()
    fireEvent.click(screen.getByTestId('overflow-delete'))
    expect(onDelete).toHaveBeenCalledTimes(1)
  })
})
