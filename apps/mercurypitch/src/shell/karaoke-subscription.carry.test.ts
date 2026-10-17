// ============================================================
// The subscription and a sign-in: what moves to the account, what stays
// ============================================================
//
// A phone that buys Mercury Pitch Cloud while signed out buys it as its own
// anonymous identity, the server's id for the phone, which is the App User
// ID RevenueCat files the purchase under. Signing in to an account after
// that brings the subscription along, with no Restore tap. A subscription
// another account owns never moves on its own (owner rule D2: a phone can be
// shared); that stays with an explicit Restore purchase.
//
// Run against a fake RevenueCat that keeps one store account and whose its
// subscription is (fake-revenuecat.test-fixtures.ts), and a phone that is
// signed out, then signed in, exactly as auth-service would report it.

import { describe, expect, it } from 'vitest'
import type { FakeRevenueCatOptions } from './fake-revenuecat.test-fixtures'
import { fakeRevenueCat } from './fake-revenuecat.test-fixtures'
import type { PhoneIdentity, SignedOutPurchaseNote, } from './karaoke-subscription'
import { createKaraokeSubscription, settleNote } from './karaoke-subscription'

/** This phone's anonymous identity: its device id, and the server's id. */
const PHONE = '0a0a0a0a-0000-4000-8000-00000000000a'
/** An account that already existed before this phone bought anything. */
const ACCOUNT = '0b0b0b0b-0000-4000-8000-00000000000b'
/** Somebody else's account, signed in on this phone at some point. */
const OTHER = '0c0c0c0c-0000-4000-8000-00000000000c'
/** An account made without this phone's proof, so with an id of its own. */
const FRESH = '0d0d0d0d-0000-4000-8000-00000000000d'

/** The note a phone keeps of a purchase made signed out, kept in memory. */
function memoryNote(): SignedOutPurchaseNote & { held(): string | null } {
  let kept: string | null = null
  return {
    read: () => kept,
    write: (id) => {
      kept = id
    },
    clear: () => {
      kept = null
    },
    held: () => kept,
  }
}

/**
 * A phone on its anonymous identity, with a store. `signIn` is what a
 * session landing does to what auth-service reports: the account's id from
 * then on, and an account held. The same id is an account made in place.
 */
function phone(options: FakeRevenueCatOptions = {}) {
  const store = fakeRevenueCat(options)
  let session: { id: string; account: boolean } | null = {
    id: PHONE,
    account: false,
  }
  const note = memoryNote()
  const identity: PhoneIdentity = {
    accountHeld: () => session?.account === true,
    accountId: () => (session?.account === true ? session.id : null),
    anonymousId: () => PHONE,
  }
  const subscription = createKaraokeSubscription(
    store,
    async () => Promise.resolve(session?.id ?? null),
    {
      phone: identity,
      note,
    },
  )
  return {
    store,
    note,
    subscription,
    /** What every sign-in ends in: carry what this phone bought signed out. */
    async signIn(id: string) {
      session = { id, account: true }
      return subscription.carryToAccount?.()
    },
    /** A session that landed without afterSignIn: a sheet closed mid-way. */
    landWithoutAfterSignIn(id: string) {
      session = { id, account: true }
      settleNote(note, identity)
    },
    signOut() {
      session = null
    },
  }
}

describe('a purchase made signed out, then a sign-in', () => {
  it('moves to an account that already existed, with no Restore tap', async () => {
    const singer = phone()
    await expect(singer.subscription.subscribe()).resolves.toBe('purchased')
    expect(singer.store.owner()).toBe(PHONE)
    const mark = singer.store.calls.length

    await singer.signIn(ACCOUNT)

    expect(singer.store.owner()).toBe(ACCOUNT)
    // RevenueCat is asked whose it is before anything moves, and the move
    // is RevenueCat's own (a restore as the account), so its webhook names
    // the new owner and every renewal after it goes to the account.
    expect(singer.store.since(mark)).toEqual([
      'initialize',
      `logIn ${PHONE}`,
      `getCustomer ${PHONE}`,
      `logIn ${ACCOUNT}`,
      `restore ${ACCOUNT}`,
    ])
    expect(singer.note.held()).toBeNull()
  })

  it('moves to an account made after it with an id of its own', async () => {
    const singer = phone()
    await singer.subscription.subscribe()

    await singer.signIn(FRESH)

    expect(singer.store.owner()).toBe(FRESH)
  })

  it('is already the account made of this phone in place, and moves nowhere after', async () => {
    const singer = phone()
    await singer.subscription.subscribe()
    const mark = singer.store.calls.length

    // Apple, Google, the code and a password all make the account of this
    // phone's anonymous identity when the phone proves it: the same id.
    await singer.signIn(PHONE)

    expect(singer.store.owner()).toBe(PHONE)
    expect(singer.store.since(mark)).not.toContain(`restore ${PHONE}`)

    // That account is a real one now. Signing out and in to another
    // account never takes its subscription along.
    singer.signOut()
    await singer.signIn(OTHER)

    expect(singer.store.owner()).toBe(PHONE)
  })

  it('moves when the purchase waited for approval first', async () => {
    const singer = phone()
    singer.store.purchases.purchase = async () =>
      Promise.resolve({ kind: 'pending' as const })
    await expect(singer.subscription.subscribe()).resolves.toBe('pending')
    // Approved later, outside the app: the store files it under the phone.
    singer.store.grant(PHONE)

    await singer.signIn(ACCOUNT)

    expect(singer.store.owner()).toBe(ACCOUNT)
  })
})

describe("another account's subscription", () => {
  it('asks the store nothing at a sign-in, on a phone that bought nothing signed out', async () => {
    const singer = phone({ owner: OTHER })

    await singer.signIn(ACCOUNT)

    expect(singer.store.calls).toEqual([])
  })

  it('never moves at a sign-in', async () => {
    // Bought on this phone while somebody else was signed in.
    const singer = phone({ owner: OTHER })

    await expect(singer.signIn(ACCOUNT)).resolves.toBe('nothing')

    expect(singer.store.owner()).toBe(OTHER)
    expect(singer.store.calls.some((call) => call.startsWith('restore'))).toBe(
      false,
    )
  })

  it('never moves once an account was made of this phone, even with no afterSignIn', async () => {
    const singer = phone()
    await singer.subscription.subscribe()
    // Made in place, and the sheet closed before afterSignIn ran.
    singer.landWithoutAfterSignIn(PHONE)

    singer.signOut()
    await singer.signIn(ACCOUNT)

    expect(singer.store.owner()).toBe(PHONE)
  })

  it("never moves once this phone's own purchase went to another account", async () => {
    const singer = phone()
    await singer.subscription.subscribe()
    // Restore purchase on another phone with the same store account.
    singer.store.restoreElsewhereAs(OTHER)

    await expect(singer.signIn(ACCOUNT)).resolves.toBe('nothing')

    expect(singer.store.owner()).toBe(OTHER)
    expect(singer.note.held()).toBeNull()
  })
})

describe('Subscribe, while the store holds the subscription', () => {
  it("brings this phone's own signed-out purchase to the account, and buys nothing", async () => {
    const singer = phone({ alreadyOwned: 'store-cancels' })
    await singer.subscription.subscribe()
    // Signed in where the move could not finish (offline, say).
    singer.store.failNext('restore', new Error('offline'))
    await singer.signIn(ACCOUNT)
    expect(singer.store.owner()).toBe(PHONE)
    const mark = singer.store.calls.length

    await expect(singer.subscription.subscribe()).resolves.toBe('moved')

    expect(singer.store.owner()).toBe(ACCOUNT)
    expect(singer.store.since(mark).some((c) => c.startsWith('purchase'))).toBe(
      false,
    )
  })

  it('says another account has it, where the store keeps it there', async () => {
    const singer = phone({ owner: OTHER, alreadyOwned: 'kept' })
    await singer.signIn(ACCOUNT)

    await expect(singer.subscription.subscribe()).resolves.toBe(
      'held-elsewhere',
    )
    expect(singer.store.owner()).toBe(OTHER)
  })

  it('says the same where RevenueCat refuses to file it under this account', async () => {
    const singer = phone({ owner: OTHER, alreadyOwned: 'refused' })
    await singer.signIn(ACCOUNT)

    await expect(singer.subscription.subscribe()).resolves.toBe(
      'held-elsewhere',
    )
    expect(singer.store.owner()).toBe(OTHER)
  })
})

describe('one store, one question at a time', () => {
  it('lets a carry finish before anything else names whom the store sells to', async () => {
    const singer = phone()
    await singer.subscription.subscribe()
    const mark = singer.store.calls.length

    const carried = singer.signIn(ACCOUNT)
    const asked = singer.subscription.storeSubscribed?.()
    await Promise.all([carried, asked])

    expect(singer.store.since(mark)).toEqual([
      'initialize',
      `logIn ${PHONE}`,
      `getCustomer ${PHONE}`,
      `logIn ${ACCOUNT}`,
      `restore ${ACCOUNT}`,
      'initialize',
      `logIn ${ACCOUNT}`,
      `getCustomer ${ACCOUNT}`,
    ])
    await expect(asked).resolves.toBe(true)
  })
})
