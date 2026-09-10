// ============================================================
// The instrument room door — asked once, then remembered
// ============================================================
//
// Piano and Guitar each open two rooms now, so the tab has to ask which one.
// The part worth pinning is the tick: unticking it must leave NOTHING behind,
// so the door opens again next time. That is why the stored value is
// 'ask' | 'night' | 'workspace' rather than a choice plus a boolean — the two
// states "asked and declined to commit" and "never asked" have to be the same
// state, or the door starts remembering an answer nobody gave it.

import { fireEvent, render, screen } from '@solidjs/testing-library'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { InstrumentRoomDoor } from '@/features/instrument-room/InstrumentRoomDoor'
import { guitarRoomChoice, pianoRoomChoice, roomChoice, setRoomChoice, } from '@/features/instrument-room/room-preference'

beforeEach(() => {
  localStorage.clear()
  setRoomChoice('piano', 'ask')
  setRoomChoice('guitar', 'ask')
})

describe('the stored preference', () => {
  it('starts by asking, for both instruments', () => {
    expect(pianoRoomChoice()).toBe('ask')
    expect(guitarRoomChoice()).toBe('ask')
  })

  it('keeps the two instruments independent', () => {
    setRoomChoice('piano', 'night')
    expect(roomChoice('piano')).toBe('night')
    expect(roomChoice('guitar')).toBe('ask')
  })

  it('survives a reload', () => {
    setRoomChoice('guitar', 'workspace')
    expect(localStorage.getItem('pitchperfect_room_guitar')).toContain(
      'workspace',
    )
  })
})

describe('the door', () => {
  it('offers both rooms, named for the instrument it was opened for', () => {
    render(() => (
      <InstrumentRoomDoor
        instrument="guitar"
        onChoose={vi.fn()}
        onDismiss={vi.fn()}
      />
    ))

    expect(screen.getByText('Guitar Night')).toBeTruthy()
    expect(screen.getByText('Guitar workspace')).toBeTruthy()
  })

  it('reports the choice with remember ticked by default', () => {
    const onChoose = vi.fn()
    render(() => (
      <InstrumentRoomDoor
        instrument="piano"
        onChoose={onChoose}
        onDismiss={vi.fn()}
      />
    ))

    fireEvent.click(screen.getByTestId('room-door-night'))

    expect(onChoose).toHaveBeenCalledWith('night', true)
  })

  it('reports remember false once the tick is cleared', () => {
    const onChoose = vi.fn()
    render(() => (
      <InstrumentRoomDoor
        instrument="piano"
        onChoose={onChoose}
        onDismiss={vi.fn()}
      />
    ))

    fireEvent.click(screen.getByLabelText(/Remember this/))
    fireEvent.click(screen.getByTestId('room-door-workspace'))

    expect(onChoose).toHaveBeenCalledWith('workspace', false)
  })

  it('dismisses without answering when the backdrop is pressed', () => {
    const onChoose = vi.fn()
    const onDismiss = vi.fn()
    const { container } = render(() => (
      <InstrumentRoomDoor
        instrument="piano"
        onChoose={onChoose}
        onDismiss={onDismiss}
      />
    ))

    // The Portal renders outside the container, so reach the scrim through
    // the dialog's own parent rather than a query that assumes the tree.
    const scrim = screen.getByTestId('instrument-room-door').parentElement!
    fireEvent.click(scrim)

    expect(onDismiss).toHaveBeenCalled()
    expect(onChoose).not.toHaveBeenCalled()
    expect(container).toBeTruthy()
  })

  it('leaves the preference alone when a press lands inside the dialog', () => {
    const onDismiss = vi.fn()
    render(() => (
      <InstrumentRoomDoor
        instrument="piano"
        onChoose={vi.fn()}
        onDismiss={onDismiss}
      />
    ))

    fireEvent.click(screen.getByTestId('instrument-room-door'))

    expect(onDismiss).not.toHaveBeenCalled()
    expect(roomChoice('piano')).toBe('ask')
  })
})
