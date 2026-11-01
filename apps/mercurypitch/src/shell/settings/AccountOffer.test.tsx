// ============================================================
// Keep v2, drawn: the account offer as S7b §3.5 lays it out
// ============================================================
//
// Top to bottom: a labelled Not now at the top right; the singer's
// voiceprint card when there is one; "Keep your voiceprint" over a measured
// range, else "Save your progress"; one icon and one line a row, each row
// only where it is true of this phone and this build; the one fact line;
// then Apple first on iOS in Apple's style, Google first on Android, and
// Use email. No "Are you sure?" on Not now. The ceremonies are the sign-in
// sheet's, stood in for here; what is pinned is Keep's side of them.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as AuthService from '@/db/services/auth-service'
import type * as BillingService from '@/db/services/billing-service'
import type * as VoiceprintService from '@/db/services/voiceprint-service'
import type * as NativeSignIn from '@/features/account/native-sign-in'
import { NativeSignInError } from '@/features/account/native-sign-in'
import { resetKaraokeSongsForTests } from '@/features/karaoke-room/karaoke-songs'
import type * as NativeBuild from '@/lib/native-build'
import type * as Notifications from '@/stores/notifications-store'
import { actAsIpad } from '@/tests/helpers/ipad-navigator'
import type { RenderedShell } from '../render-for-test'
import { renderShell } from '../render-for-test'
import { setOnboardingShown } from '../run-shell-store'
import { KEEP, keepFact } from './account-copy'
import { closeOffer, declineOffer, forgetAccountOffer, offerOpen, openKeep, openKeepFromReveal, registerRangeFinder, } from './account-offer'
import type * as AccountState from './account-state'
import { AccountOfferSheet } from './AccountOffer'
import { resetAppGift } from './keep-gift'
import { resetSignIn, signInOpen } from './sign-in-state'
import { SignInSheet } from './SignInSheet'

const stand = vi.hoisted(() => ({
  apple: vi.fn(),
  google: vi.fn(),
  adopt: vi.fn(async () => 0),
  hint: vi.fn((): unknown => undefined),
  fillDue: vi.fn(),
  ask: vi.fn(),
  notify: vi.fn(),
  appleOffered: true,
  googleOffered: true,
  importing: false,
  signedOutHere: false,
  prints: [] as unknown[],
  gift: null as { songs: number; endsAt: string | null } | null,
}))

vi.mock('@/features/account/native-sign-in', async (importOriginal) => ({
  ...(await importOriginal<typeof NativeSignIn>()),
  signInWithApple: stand.apple,
  signInWithGoogle: stand.google,
}))
vi.mock('@/features/account/sign-in-methods', () => ({
  appleSignInOffered: () => stand.appleOffered,
  nativeGoogleSignInOffered: () => stand.googleOffered,
  webGoogleSignInOffered: () => false,
}))
vi.mock('@/db/services/auth-service', async (importOriginal) => ({
  ...(await importOriginal<typeof AuthService>()),
  needsSignIn: () => stand.signedOutHere,
}))
vi.mock('@/db/services/voiceprint-service', async (importOriginal) => ({
  ...(await importOriginal<typeof VoiceprintService>()),
  adoptDeviceVoiceprints: stand.adopt,
  buildVoiceprintHint: stand.hint,
  loadLocalVoiceprints: () => stand.prints,
}))
vi.mock('@/db/services/billing-service', async (importOriginal) => ({
  ...(await importOriginal<typeof BillingService>()),
  fetchAppGift: () => Promise.resolve(stand.gift),
}))
vi.mock('@/lib/native-build', async (importOriginal) => ({
  ...(await importOriginal<typeof NativeBuild>()),
  get KARAOKE_IMPORT() {
    return stand.importing
  },
}))
vi.mock('@/stores/notifications-store', async (importOriginal) => ({
  ...(await importOriginal<typeof Notifications>()),
  showNotification: stand.notify,
}))
vi.mock('./account-fill', () => ({ markAccountFillDue: stand.fillDue }))
vi.mock('./voiceprint-ask', () => ({ askAfterSignIn: stand.ask }))
vi.mock('./account-state', async (importOriginal) => ({
  ...(await importOriginal<typeof AccountState>()),
  refreshAccount: vi.fn(async () => undefined),
}))

const SESSION = {
  token: 'header.body.signature',
  userId: 'user-1',
  isNew: false,
  user: {},
}

const GIFT = { songs: 5, endsAt: '2099-01-01T23:59:59.000Z' }

/** The free song's row as it reads: one line; its caveat is in the small print. */
const FREE_SONG_ROW = KEEP.freeSong

/** E2 to G4, with a twin: the take creating an account would adopt. */
function print(fields: Record<string, unknown> = {}): unknown {
  return {
    id: 'print-1',
    summary: {
      lowMidi: 40,
      highMidi: 67,
      semitones: 27,
      accuracy: 80,
      steadiness: 70,
    },
    twin: 'Nina Simone',
    source: 'mirror',
    takenAt: '2026-10-16T09:00:00.000Z',
    madeBy: 'anonymous',
    ...fields,
  }
}

let view: RenderedShell | null = null

function q(testId: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-testid="${testId}"]`)
}

function rows(): string[] {
  return [
    ...document.querySelectorAll<HTMLElement>(
      '[data-testid="account-offer"] .mp-keep__rows > li',
    ),
  ].map((row) => row.textContent?.trim() ?? '')
}

function ways(): Array<string | undefined> {
  return [
    ...document.querySelectorAll<HTMLElement>(
      '[data-testid="account-offer"] .mp-keep__ways button',
    ),
  ].map((button) => button.dataset.testid)
}

/** Let the stood-in ceremonies and the gift's ask settle, and Solid after. */
async function settle(): Promise<void> {
  for (let i = 0; i < 4; i += 1) {
    await new Promise((resolve) => {
      setTimeout(resolve, 0)
    })
  }
}

/** Keep and the sign-in sheet, as the shell draws them, then Keep opened. */
async function open(): Promise<void> {
  view = renderShell(() => (
    <>
      <AccountOfferSheet />
      <SignInSheet />
    </>
  ))
  openKeep()
  await settle()
}

beforeEach(() => {
  stand.apple.mockReset()
  stand.google.mockReset()
  stand.adopt.mockClear()
  stand.hint.mockReset()
  stand.fillDue.mockClear()
  stand.ask.mockClear()
  stand.notify.mockClear()
  stand.appleOffered = true
  stand.googleOffered = true
  stand.importing = false
  stand.signedOutHere = false
  stand.prints = []
  stand.gift = null
  resetAppGift()
  resetKaraokeSongsForTests()
  resetSignIn()
  forgetAccountOffer()
})

afterEach(() => {
  view?.unmount()
  view = null
  resetSignIn()
  forgetAccountOffer()
  resetAppGift()
  resetKaraokeSongsForTests()
})

describe('Not now', () => {
  it('is a labelled text button at the top right, the first control, with no close button', async () => {
    await open()

    const panel = q('sheet-panel')
    const notNow = q('keep-not-now')

    expect(notNow?.textContent).toBe(KEEP.notNow)
    expect(panel?.querySelector('button')).toBe(notNow)
    expect(panel?.querySelector('[aria-label="Close"]')).toBeNull()
  })

  it('closes Keep and asks nothing more: no question, no sign-in sheet', async () => {
    await open()

    q('keep-not-now')?.click()

    expect(offerOpen()).toBe(false)
    expect(signInOpen()).toBe(false)
    expect(document.querySelector('[role="alertdialog"]')).toBeNull()
  })

  it('is what a tap on the backdrop answers', async () => {
    await open()

    q('sheet-panel')?.parentElement?.click()

    expect(offerOpen()).toBe(false)
  })
})

describe('what Keep says', () => {
  it('with no range measured: Save your progress, what an account keeps, and the fact line', async () => {
    await open()

    const sheet = q('account-offer')

    expect(sheet?.dataset.variant).toBe('progress')
    expect(sheet?.querySelector('h2')?.textContent).toBe(KEEP.titleProgress)
    expect(q('keep-voiceprint')).toBeNull()
    expect(rows()).toEqual([KEEP.everywhere])
    expect(sheet?.textContent).toContain(keepFact())
  })

  it('with a measured range: Keep your voiceprint, then its card, and no row saying it again', async () => {
    stand.prints = [print()]

    await open()

    const sheet = q('account-offer')
    const title = sheet?.querySelector('h2')
    const card = q('keep-voiceprint')

    expect(sheet?.dataset.variant).toBe('voiceprint')
    expect(title?.textContent).toBe(KEEP.titleVoiceprint)
    // The title first, then what it is about.
    expect(
      title !== null &&
        title !== undefined &&
        card !== null &&
        (title.compareDocumentPosition(card) &
          Node.DOCUMENT_POSITION_FOLLOWING) !==
          0,
    ).toBe(true)
    expect(card?.textContent).toContain('E2–G4')
    // The twin's name held together on its line.
    expect(card?.textContent).toContain('Nina\u00a0Simone')
    expect(rows()).toEqual([KEEP.everywhere])
  })

  it('offers no voiceprint another account made, or one with no range', async () => {
    stand.prints = [
      print({ id: 'theirs', madeBy: 'someone-else' }),
      print({
        id: 'no-range',
        summary: {
          lowMidi: null,
          highMidi: null,
          semitones: null,
          accuracy: 80,
          steadiness: 70,
        },
      }),
    ]

    await open()

    expect(q('account-offer')?.dataset.variant).toBe('progress')
    expect(q('keep-voiceprint')).toBeNull()
  })

  it('in a build that splits songs: the free song, and the gift while the server says it runs', async () => {
    stand.importing = true
    stand.gift = GIFT

    await open()

    expect(rows()).toEqual([
      KEEP.everywhere,
      FREE_SONG_ROW,
      'Launch gift for new accounts: 5 more songs, until 1 January',
    ])
  })

  it('says in the small print, in one sentence, that the free song needs a confirmed email', async () => {
    stand.importing = true

    await open()

    expect(q('keep-free-song')?.textContent?.trim()).toBe(KEEP.freeSong)
    expect(q('keep-fine')?.textContent?.startsWith(KEEP.freeSongEmail)).toBe(
      true,
    )
  })

  it('says nothing of the email where no free song is offered', async () => {
    await open()

    expect(q('keep-free-song')).toBeNull()
    expect(q('keep-fine')?.textContent).not.toContain(KEEP.freeSongEmail)
  })

  it('has no free song row in a build that splits no songs: there is nothing to spend it on', async () => {
    await open()

    expect(q('keep-free-song')).toBeNull()
  })

  it('has no gift row while the server says no gift runs', async () => {
    stand.importing = true

    await open()

    expect(rows()).toEqual([KEEP.everywhere, FREE_SONG_ROW])
  })

  it('has no gift row once the gift has ended', async () => {
    stand.importing = true
    stand.gift = { songs: 5, endsAt: '2020-01-01T23:59:59.000Z' }

    await open()

    expect(rows()).toEqual([KEEP.everywhere, FREE_SONG_ROW])
  })

  it('has no gift row on a phone signed out of its account: signing back in gets none', async () => {
    stand.importing = true
    stand.gift = GIFT
    stand.signedOutHere = true

    await open()

    expect(rows()).toEqual([KEEP.everywhere, FREE_SONG_ROW])
  })

  it('offers a subscriber neither the free song nor the gift: they have their 20', async () => {
    stand.importing = true
    stand.gift = GIFT
    resetKaraokeSongsForTests({
      left: 20,
      subscribed: true,
      renewsAt: '2026-11-16T00:00:00.000Z',
      perPeriod: 20,
    })

    await open()

    expect(rows()).toEqual([KEEP.everywhere])
  })

  it('puts Find your range first while a range finder is there, runs it and gives way to it', async () => {
    const run = vi.fn()
    registerRangeFinder(run)

    await open()
    const first = rows()[0]
    q('keep-find-range')?.click()

    expect(first).toBe(KEEP.findRange)
    expect(run).toHaveBeenCalledTimes(1)
    expect(offerOpen()).toBe(false)
  })

  it('has no Find your range row over a range already measured', async () => {
    registerRangeFinder(vi.fn())
    stand.prints = [print()]

    await open()

    expect(q('keep-find-range')).toBeNull()
  })

  it('flies the card in straight after a reveal, and only then', async () => {
    stand.prints = [print()]
    view = renderShell(() => <AccountOfferSheet />)

    openKeepFromReveal()
    await settle()
    const fromReveal = q('account-offer')?.dataset.arrival
    declineOffer()
    openKeep()
    await settle()

    expect(fromReveal).toBe('reveal')
    expect(q('account-offer')?.dataset.arrival).toBe('plain')
    expect(q('keep-voiceprint')).not.toBeNull()
  })

  it('names the iPad in its fact line', async () => {
    const restore = actAsIpad()
    try {
      await open()

      expect(q('account-offer')?.textContent).toContain(
        'Without an account, it stays on this iPad only.',
      )
    } finally {
      restore()
    }
  })

  it('keeps its ways in under what scrolls, so a short phone never hides Use email', async () => {
    stand.importing = true
    stand.prints = [print()]

    await open()

    const body = q('keep-body')
    // The title, the card, the rows and the fact scroll; the ways stay put.
    expect(body?.querySelector('h2')).not.toBeNull()
    expect(body?.contains(q('keep-voiceprint'))).toBe(true)
    expect(body?.contains(q('keep-email'))).toBe(false)
    expect(body?.contains(q('keep-fine'))).toBe(false)
  })

  it("takes the onboarding stage's dark palette over the onboarding, and the theme's elsewhere", async () => {
    setOnboardingShown(true)
    try {
      await open()
      const panel = q('account-offer')?.closest('[role="dialog"]')
      expect(panel?.classList.contains('mp-dark-stage')).toBe(true)
    } finally {
      setOnboardingShown(false)
    }
    view?.unmount()
    view = null
    closeOffer()

    await open()
    const panel = q('account-offer')?.closest('[role="dialog"]')
    expect(panel?.classList.contains('mp-dark-stage')).toBe(false)
  })

  it('says what continuing accepts, with the Terms and the Privacy policy', async () => {
    await open()

    const links = [
      ...document.querySelectorAll<HTMLAnchorElement>(
        '[data-testid="account-offer"] .mp-signin__fine a',
      ),
    ].map((link) => link.textContent)

    expect(links).toEqual(['Terms', 'Privacy policy'])
  })
})

describe('the ways in', () => {
  it('on an iPhone: Apple first in its own style, then Google, then Use email', async () => {
    await open()

    expect(ways()).toEqual(['keep-apple', 'keep-google', 'keep-email'])
    expect(q('keep-apple')?.className).toContain('mp-provider--apple')
    expect(q('keep-apple')?.textContent).toBe(KEEP.apple)
    expect(q('keep-email')?.textContent).toBe(KEEP.email)
  })

  it('on Android: Google first, then Use email', async () => {
    stand.appleOffered = false

    await open()

    expect(ways()).toEqual(['keep-google', 'keep-email'])
    expect(q('keep-google')?.textContent).toBe(KEEP.google)
  })

  it('Use email hands over to the sign-in sheet, on its email pane', async () => {
    await open()

    q('keep-email')?.click()
    await settle()

    expect(offerOpen()).toBe(false)
    expect(signInOpen()).toBe(true)
    expect(q('signin-sheet')?.dataset.pane).toBe('email')
  })

  it("an account made with Apple closes Keep, says so, and takes this phone's takes along", async () => {
    stand.apple.mockResolvedValue({ ...SESSION, isNew: true })
    await open()

    q('keep-apple')?.click()
    await settle()

    expect(offerOpen()).toBe(false)
    expect(stand.notify).toHaveBeenCalledWith('Signed in', 'info')
    expect(stand.adopt).toHaveBeenCalledTimes(1)
    expect(stand.fillDue).not.toHaveBeenCalled()
    expect(stand.ask).not.toHaveBeenCalled()
  })

  it('a sign-in to an account that already existed takes nothing, asks about the takes, and its history is announced (REQ-NAM-039, 043)', async () => {
    stand.google.mockResolvedValue(SESSION)
    await open()

    q('keep-google')?.click()
    await settle()

    expect(offerOpen()).toBe(false)
    expect(stand.adopt).not.toHaveBeenCalled()
    expect(stand.fillDue).toHaveBeenCalledWith('user-1')
    expect(stand.ask).toHaveBeenCalledWith('user-1')
  })

  it('names the take to the Apple sheet, for the first mail of an account made here', async () => {
    const hint = { twin: 'Nina Simone', lowMidi: 40, highMidi: 67 }
    stand.hint.mockReturnValue(hint)
    stand.apple.mockResolvedValue(SESSION)
    await open()

    q('keep-apple')?.click()
    await settle()

    expect(stand.apple).toHaveBeenCalledWith({ voiceprintHint: hint })
  })

  it('a second factor owed hands over to the sign-in sheet, on its code pane', async () => {
    stand.apple.mockResolvedValue({ twofaRequired: true, ceremony: 'owed-1' })
    await open()

    q('keep-apple')?.click()
    await settle()

    expect(offerOpen()).toBe(false)
    expect(signInOpen()).toBe(true)
    expect(q('signin-sheet')?.dataset.pane).toBe('twofa')
  })

  it('a dismissed Apple sheet says nothing, and Keep stays', async () => {
    stand.apple.mockRejectedValue(
      new NativeSignInError('cancelled', 'Sign-in was cancelled.'),
    )
    await open()

    q('keep-apple')?.click()
    await settle()

    expect(offerOpen()).toBe(true)
    expect(q('signin-error')).toBeNull()
    expect(q('signin-offline')).toBeNull()
  })

  it('names a lost connection, and says the practice on the phone is safe', async () => {
    stand.google.mockRejectedValue(
      new NativeSignInError('network', 'Could not reach the server.'),
    )
    await open()

    q('keep-google')?.click()
    await settle()

    const note = q('signin-offline')?.textContent ?? ''
    expect(offerOpen()).toBe(true)
    expect(note).toContain('You are still practicing on this phone.')
  })
})
