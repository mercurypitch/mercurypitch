// ============================================================
// A Google sign-up from Guitar Night, and the welcome it asks for
// ============================================================
//
// The room's sign-in dialog is the shared AuthModal. A Google sign-up started
// there adopts this device's takes when it lands back on the room (main.tsx),
// so the redirect may carry the voiceprint hint for the new account's first
// mail (REQ-VPR-022). A host that adopted nothing would have to send none.

import { cleanup, fireEvent, render, screen, within, } from '@solidjs/testing-library'
import { afterEach, beforeAll, expect, it, onTestFinished, vi } from 'vitest'
import type * as GoogleSignIn from '@/lib/google-sign-in'
import { GuitarNightApp } from './GuitarNightApp'
import type { GuitarNightSongPort } from './song-port'

// Starting Google navigates the page away, so the start itself is the seam:
// what the room's dialog asks for is recorded, and everything before it is
// real.
const googleSignIn = vi.hoisted(() => ({
  start: vi.fn(async (_options: unknown) => null),
}))
vi.mock('@/lib/google-sign-in', async (importOriginal) => ({
  ...(await importOriginal<typeof GoogleSignIn>()),
  startGoogleSignIn: (options: unknown) => googleSignIn.start(options),
}))

function silentPort(): GuitarNightSongPort {
  return {
    initialize: vi.fn(async () => undefined),
    completedSongs: () => [],
    openSession: vi.fn(async () => ({ ok: false, code: 'not-found' })),
  } as unknown as GuitarNightSongPort
}

/** A voiceprint measured on this device before any account existed. */
function seedTake(): void {
  localStorage.setItem(
    'mercurypitch.voiceprints.v1',
    JSON.stringify([
      {
        id: 'mirror-take',
        summary: {
          lowMidi: 57,
          highMidi: 77,
          semitones: 20,
          accuracy: 70,
          steadiness: null,
        },
        twin: 'Adele',
        source: 'onboarding',
        takenAt: '2026-10-08T09:00:00.000Z',
      },
    ]),
  )
  onTestFinished(() => localStorage.removeItem('mercurypitch.voiceprints.v1'))
}

// The room loads two parts of its sign-in lazily: the account chip as it
// opens, and the shared AuthModal when Sign in is pressed. A first import
// builds the part's module graph inside the wait for it, which for the modal
// took most of the second. Import both once before the test, so each wait
// measures the room, not that build.
beforeAll(async () => {
  await import('./GuitarNightAccount')
  await import('@/components/account/AuthModal')
})

afterEach(() => {
  cleanup()
  googleSignIn.start.mockClear()
})

it("lets a Google sign-up carry this device's voiceprint for the welcome", async () => {
  seedTake()
  render(() => (
    <GuitarNightApp loadSongPort={() => Promise.resolve(silentPort())} />
  ))

  // The chip is drawn in the room's top bar. A role query over the whole room
  // took about a third of the second this wait has, so the test asks only the
  // top bar.
  const topbar = screen.getByTestId('guitar-night-topbar')
  fireEvent.click(
    await within(topbar).findByRole('button', {
      name: 'Sign in to MercuryPitch',
    }),
  )
  const dialog = await screen.findByRole('dialog')
  fireEvent.click(await within(dialog).findByTestId('auth-google'))

  await vi.waitFor(() =>
    expect(googleSignIn.start).toHaveBeenCalledWith(
      expect.objectContaining({
        signup: {
          voiceprintHint: {
            twin: 'Adele',
            lowMidi: 57,
            highMidi: 77,
            accuracy: 70,
          },
        },
      }),
    ),
  )
})
