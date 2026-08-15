// ============================================================
// The trash can the Default Session does not get
// ============================================================
//
// Deleting "Default Session" used to run the whole ceremony — confirm dialog,
// `Deleted "Default Session"` toast, an Undo button — and leave the session
// exactly where it was. `getDefaultSession()` rebuilds and persists it the
// moment anything asks for a session list, which the Library tab does on every
// render, so the delete could never take.
//
// `isDeletableSession` now says the session is permanent, and this pins the
// half of that which the singer actually sees: no trash icon on the one row
// that cannot go, trash icons everywhere else.

import { fireEvent, render, screen } from '@solidjs/testing-library'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PlaybackSession } from '@/types'

const playback = vi.hoisted(() => ({
  playSessionSequence: vi.fn(),
  loadAndPlayMelodyForSession: vi.fn(),
}))

vi.mock('@/contexts/PlaybackContext', () => ({
  usePlayback: () => playback,
}))

const shown = vi.hoisted(() => ({ messages: [] as string[] }))

vi.mock('@/stores', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    showNotification: (message: string) => shown.messages.push(message),
    showActionNotification: (message: string) => shown.messages.push(message),
  }
})

import { SessionLibraryModal } from '@/components/SessionLibraryModal'
import { melodyStore, seedDefaultSession } from '@/stores/melody-store'
import { saveSession } from '@/stores/session-store'

const MINE: PlaybackSession = {
  id: 'session-mine',
  name: 'My Warmup',
  deletable: true,
  created: 1,
  items: [],
}

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
  shown.messages = []
  seedDefaultSession()
  saveSession(MINE)
})

/** Every session row, paired with whether it offers a delete button. */
function rowsWithDelete(): Map<string, boolean> {
  const rows = new Map<string, boolean>()
  for (const del of screen.queryAllByLabelText('Delete')) {
    // The actions sit alongside the title inside the row.
    const row = del.closest('li') ?? del.parentElement?.parentElement
    rows.set(row?.textContent ?? '', true)
  }
  return rows
}

describe('SessionLibraryModal delete affordance', () => {
  it('offers no trash can on the Default Session', () => {
    render(() => <SessionLibraryModal isOpen={true} close={() => {}} />)

    // Both sessions are listed — the point was never to hide the default one.
    expect(screen.getByText('Default Session')).toBeTruthy()
    expect(screen.getByText('My Warmup')).toBeTruthy()

    // But only one of them can actually be deleted, so only one says so.
    const deletable = [...rowsWithDelete().keys()].join(' | ')
    expect(deletable).toContain('My Warmup')
    expect(deletable).not.toContain('Default Session')
    expect(screen.queryAllByLabelText('Delete')).toHaveLength(1)
  })

  it('leaves play and edit alone — permanence is not read-only', () => {
    render(() => <SessionLibraryModal isOpen={true} close={() => {}} />)

    // Two sessions, both still playable and editable. Losing the trash can is
    // the whole of the change.
    expect(screen.queryAllByLabelText('Play')).toHaveLength(2)
    expect(screen.queryAllByLabelText('Edit')).toHaveLength(2)
  })

  it('refuses the delete even if the button is reached anyway', () => {
    render(() => <SessionLibraryModal isOpen={true} close={() => {}} />)

    // Belt and braces: the store is the one that says no, so a stale render,
    // a keyboard path or a future surface cannot talk it round.
    expect(melodyStore.deleteSession('default')).toBe(false)
    expect(melodyStore.getSessions().map((s) => s.id)).toContain('default')
  })

  it('still deletes a session the singer made, and says so once it is gone', () => {
    render(() => <SessionLibraryModal isOpen={true} close={() => {}} />)

    fireEvent.click(screen.getByLabelText('Delete'))
    // The confirm step is not the fix — it was always there. What changed is
    // that the toast on the other side of it now reports what happened.
    fireEvent.click(screen.getByTestId('confirm-delete'))

    expect(melodyStore.getSession('session-mine')).toBeUndefined()
    expect(shown.messages).toContain('Deleted "My Warmup"')
  })

  it('announces nothing when the session went away before the confirm', () => {
    render(() => <SessionLibraryModal isOpen={true} close={() => {}} />)

    fireEvent.click(screen.getByLabelText('Delete'))
    // Gone underneath the open dialog — another surface, an undo elsewhere,
    // a second tab. The confirm then has nothing left to delete, and the
    // toast has to follow the outcome rather than the intention.
    melodyStore.deleteSession('session-mine')
    fireEvent.click(screen.getByTestId('confirm-delete'))

    expect(shown.messages).not.toContain('Deleted "My Warmup"')
  })

  it('does not open a dialog for a row that is already stale', () => {
    render(() => <SessionLibraryModal isOpen={true} close={() => {}} />)

    // The click that arrives a moment too late: the row was drawn while the
    // session existed, and by the time the handler runs the store no longer
    // has it. Asking the store first is what keeps that from becoming a
    // dialog about nothing.
    const gone = vi
      .spyOn(melodyStore, 'getSession')
      .mockReturnValueOnce(undefined)
    fireEvent.click(screen.getByLabelText('Delete'))
    gone.mockRestore()

    expect(screen.queryByTestId('confirm-delete')).toBeNull()
    expect(shown.messages).toHaveLength(0)
  })
})
