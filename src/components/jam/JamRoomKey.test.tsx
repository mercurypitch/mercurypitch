// The room's key: the host moves it, a guest only sees it.
import { fireEvent, render, screen } from '@solidjs/testing-library'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const room = vi.hoisted(() => ({
  songRoom: true,
  host: true,
  key: 0,
  available: true,
  sets: [] as number[],
}))

vi.mock('@/stores/jam-store', () => ({
  jamIsSongRoom: () => room.songRoom,
  jamIsHost: () => room.host,
  jamRoomKeyShift: () => room.key,
  jamKeyShiftAvailable: () => room.available,
  setJamRoomKeyShift: (semitones: number) => {
    room.sets.push(semitones)
  },
}))

const { JamRoomKey } = await import('./JamRoomKey')

beforeEach(() => {
  room.songRoom = true
  room.host = true
  room.key = 0
  room.available = true
  room.sets = []
})

describe('JamRoomKey', () => {
  it('gives the host one small chip that opens the stepper where it stands', () => {
    room.key = 2

    render(() => <JamRoomKey />)
    const chip = screen.getByRole('button', { name: 'Room key +2' })
    expect(chip.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByRole('button', { name: 'Raise the key' })).toBeNull()

    fireEvent.click(chip)

    expect(chip.getAttribute('aria-expanded')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: 'Raise the key' }))
    expect(room.sets).toEqual([3])
  })

  it('folds the stepper away on a tap elsewhere, or on Escape', () => {
    render(() => <JamRoomKey />)
    const chip = screen.getByRole('button', { name: 'Room key 0' })

    fireEvent.click(chip)
    fireEvent.pointerDown(document.body)
    expect(screen.queryByRole('button', { name: 'Raise the key' })).toBeNull()

    fireEvent.click(chip)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('button', { name: 'Raise the key' })).toBeNull()
  })

  it('stays open while the stepper is in use', () => {
    render(() => <JamRoomKey />)
    fireEvent.click(screen.getByRole('button', { name: 'Room key 0' }))
    const raise = screen.getByRole('button', { name: 'Raise the key' })

    fireEvent.pointerDown(raise)
    fireEvent.click(raise)

    expect(screen.getByRole('button', { name: 'Raise the key' })).toBe(raise)
  })

  it('shows a guest the key once it has moved, with nothing to press', () => {
    room.host = false
    room.key = 2

    render(() => <JamRoomKey />)

    expect(screen.getByTestId('jam-room-key').textContent).toContain('+2')
    expect(screen.queryAllByRole('button')).toHaveLength(0)
  })

  it('keeps out of a guest’s way while the song is in its own key', () => {
    room.host = false

    render(() => <JamRoomKey />)

    expect(screen.queryByTestId('jam-room-key')).toBeNull()
  })

  it('says why on a device that cannot shift', () => {
    room.available = false

    render(() => <JamRoomKey />)
    fireEvent.click(screen.getByRole('button', { name: 'Room key 0' }))

    const raise = screen.getByRole('button', { name: 'Raise the key' })
    expect(raise.hasAttribute('disabled')).toBe(true)
    expect(raise.title).toBe('Changing the key is not available on this device')
  })

  it('tells a guest when this device plays the original key', () => {
    room.host = false
    room.key = 2
    room.available = false

    render(() => <JamRoomKey />)

    // On the chip itself, beside the key the room is in.
    expect(
      screen.getByTitle('Changing the key is not available on this device'),
    ).toHaveTextContent('+2')
  })

  it('has no place in a drill room', () => {
    room.songRoom = false

    render(() => <JamRoomKey />)

    expect(screen.queryByTestId('jam-room-key')).toBeNull()
  })
})
