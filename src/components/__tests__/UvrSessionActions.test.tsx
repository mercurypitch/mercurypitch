import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { UvrSession } from '@/stores/uvr-store'
import { UvrSessionActions } from '../UvrSessionActions'

const mocks = vi.hoisted(() => ({
  getOriginalFileBlob: vi.fn(),
  showNotification: vi.fn(),
}))

vi.mock('@/db/services/uvr-service', () => ({
  getOriginalFileBlob: mocks.getOriginalFileBlob,
}))
vi.mock('@/stores/notifications-store', () => ({
  showNotification: mocks.showNotification,
}))
vi.mock('../icons', () => ({
  ChevronDown: () => <span>ChevronDown</span>,
  Download: () => <span>Download</span>,
  Zap: () => <span>Zap</span>,
}))

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
    mocks.showNotification.mockReset()
    class TestUrl extends URL {
      static createObjectURL = vi.fn(() => 'blob:original')
      static revokeObjectURL = vi.fn()
    }
    vi.stubGlobal('URL', TestUrl)
  })

  afterEach(() => {
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

    expect(screen.getByRole('button', { name: /Original/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /HQ/ })).toBeInTheDocument()

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

    expect(
      screen.queryByRole('button', { name: /Original/ }),
    ).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /HQ/ })).not.toBeInTheDocument()
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

    fireEvent.click(screen.getByRole('button', { name: /Original/ }))
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

    fireEvent.click(screen.getByRole('button', { name: /Original/ }))

    await waitFor(() =>
      expect(mocks.showNotification).toHaveBeenCalledWith(
        expect.stringContaining("isn't stored"),
        'warning',
      ),
    )
    expect(click).not.toHaveBeenCalled()
  })

  it('exposes an accessible HQ menu and closes it with Escape', () => {
    render(() => (
      <UvrSessionActions
        sessionId="session-123"
        session={completedSession()}
        onRerunHq={vi.fn()}
      />
    ))
    const trigger = screen.getByRole('button', { name: /HQ/ })

    fireEvent.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(
      screen.getByRole('menu', { name: 'HQ processing options' }),
    ).toBeInTheDocument()

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
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
    const trigger = screen.getByRole('button', { name: /HQ/ })

    fireEvent.click(trigger)
    fireEvent.click(screen.getByRole('menuitem', { name: /Upgrade/ }))
    expect(onRerunHq).toHaveBeenLastCalledWith('session-123', 'same')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()

    fireEvent.click(trigger)
    fireEvent.click(screen.getByRole('menuitem', { name: /New session/ }))
    expect(onRerunHq).toHaveBeenLastCalledWith('session-123', 'new')
  })
})
