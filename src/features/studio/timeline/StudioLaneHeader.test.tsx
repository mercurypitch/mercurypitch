// Studio lane header pieces — the role plate shows the role's picture or its line icon, the choice is kept on this device, and the arm button arms, moves and disarms through the recorder.
import { fireEvent, render, screen } from '@solidjs/testing-library'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { createSignal } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { StudioRecordPhase } from '@/lib/studio/record/studio-recorder'
import { TRACK_ROLES } from '@/lib/studio-fx/role-chains'
import { reloadStudioRolePictures, setStudioRolePictures, studioRolePicture, studioRolePictures, } from './role-pictures'
import { StudioArmButton, StudioRolePlate } from './StudioLaneHeader'

const KEY = 'mercurypitch.studio.role-pictures'

afterEach(() => {
  localStorage.clear()
  reloadStudioRolePictures()
})

describe('Studio role plate', () => {
  it('shows the role’s picture, named for its role, while pictures are on', () => {
    render(() => <StudioRolePlate role="acoustic-guitar" />)

    const plate = screen.getByRole('img', { name: 'Acoustic guitar' })
    const picture = plate.querySelector('img')
    expect(picture).toHaveAttribute('src', '/studio/roles/acoustic-guitar.webp')
    expect(picture).toHaveAttribute('alt', '')
    expect(picture).toHaveAttribute('loading', 'lazy')
    expect(plate.querySelector('svg')).toBeNull()
  })

  it('shows the line icon with pictures off, and keeps that choice on this device', () => {
    render(() => <StudioRolePlate role="drums" />)
    const plate = screen.getByRole('img', { name: 'Drums' })

    setStudioRolePictures(false)

    expect(plate.querySelector('img')).toBeNull()
    expect(plate.querySelector('svg')).not.toBeNull()
    expect(localStorage.getItem(KEY)).toBe('off')
    setStudioRolePictures(true)
    reloadStudioRolePictures()
    expect(studioRolePictures()).toBe(true)
    expect(localStorage.getItem(KEY)).toBeNull()
  })

  it('starts with pictures off when this device chose that before', () => {
    localStorage.setItem(KEY, 'off')
    reloadStudioRolePictures()

    render(() => <StudioRolePlate role="bass" />)

    expect(
      screen.getByRole('img', { name: 'Bass' }).querySelector('img'),
    ).toBeNull()
  })

  it('falls back to the icon when a picture does not load, until the role changes', () => {
    const [role, setRole] = createSignal<'voice' | 'keys'>('voice')
    render(() => <StudioRolePlate role={role()} />)
    const plate = screen.getByRole('img', { name: 'Lead vocal' })

    fireEvent.error(plate.querySelector('img')!)
    expect(plate.querySelector('img')).toBeNull()
    expect(plate.querySelector('svg')).not.toBeNull()

    setRole('keys')
    expect(
      screen.getByRole('img', { name: 'Keys and synths' }).querySelector('img'),
    ).toHaveAttribute('src', '/studio/roles/keys.webp')
  })

  it('has a picture on disk for every role', () => {
    const missing = TRACK_ROLES.filter(
      (role) =>
        !existsSync(
          resolve(
            __dirname,
            '../../../../public',
            studioRolePicture(role).slice(1),
          ),
        ),
    )
    expect(missing).toEqual([])
  })
})

function arming(start: { phase: StudioRecordPhase; armed: string | null }) {
  const [phase, setPhase] = createSignal(start.phase)
  const [armed, setArmed] = createSignal(start.armed)
  const [canArm, setCanArm] = createSignal(true)
  const toggle = vi.fn()
  return {
    handle: {
      armedTrackId: armed,
      phase,
      canArm,
      toggle,
    },
    setPhase,
    setArmed,
    setCanArm,
    toggle,
  }
}

describe('Studio arm button', () => {
  it('arms its lane through the recorder, and says so', () => {
    const lanes = arming({ phase: 'idle', armed: null })
    render(() => (
      <StudioArmButton trackId="lane-1" name="Vocals" arming={lanes.handle} />
    ))
    const button = screen.getByRole('button', {
      name: 'Arm Vocals for recording',
    })
    expect(button).toHaveAttribute('aria-pressed', 'false')
    expect(button).toHaveAttribute('title', 'Arm Vocals for recording')

    fireEvent.click(button)

    expect(lanes.toggle).toHaveBeenCalledExactlyOnceWith('lane-1')
  })

  it('lights while its lane is armed and stays lit, held, while the take records', () => {
    const lanes = arming({ phase: 'armed', armed: 'lane-1' })
    render(() => (
      <>
        <StudioArmButton trackId="lane-1" name="Vocals" arming={lanes.handle} />
        <StudioArmButton trackId="lane-2" name="Bass" arming={lanes.handle} />
      </>
    ))
    const vocals = screen.getByRole('button', { name: /Vocals/ })
    const bass = screen.getByRole('button', { name: /Bass/ })
    expect(vocals).toHaveAttribute('aria-pressed', 'true')
    expect(vocals.title).toBe(
      'Vocals is armed. Record (R) starts a take here. Press to disarm.',
    )
    expect(bass).toHaveAttribute('aria-pressed', 'false')
    expect(bass).toBeEnabled()

    lanes.setPhase('recording')

    expect(vocals).toHaveAttribute('aria-pressed', 'true')
    expect(vocals).toHaveAttribute('data-phase', 'recording')
    expect(vocals).toBeDisabled()
    expect(bass).toBeDisabled()
    expect(bass.title).toBe('Stop the take to arm another lane')
  })

  it('waits while the song cannot take a recording, unless its lane is the armed one', () => {
    const lanes = arming({ phase: 'idle', armed: null })
    lanes.setCanArm(false)
    render(() => (
      <StudioArmButton trackId="lane-1" name="Vocals" arming={lanes.handle} />
    ))
    const button = screen.getByRole('button', { name: /Vocals/ })
    expect(button).toBeDisabled()

    lanes.setPhase('armed')
    lanes.setArmed('lane-1')

    expect(button).toBeEnabled()
  })
})
