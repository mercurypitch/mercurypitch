// ============================================================
// How long the subscription took, step by step
// ============================================================
//
// Subscribe took close to a minute on TestFlight build 919, and the build
// could not say which step. A test build times every step of a Subscribe, a
// Restore purchase and a sign-in's carry, then the wait for the songs after
// the store's yes, read off what the app hears from the server. The clock
// is a fake one the steps move; the store is the fake RevenueCat.

import { createSignal } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fakeRevenueCat } from './fake-revenuecat.test-fixtures'
import { createKaraokeSubscription } from './karaoke-subscription'
import type { SubscriptionTimingOptions } from './subscription-timing'
import { createSubscriptionTiming, flowLine, KEPT_FLOWS, } from './subscription-timing'

const PHONE = '0a0a0a0a-0000-4000-8000-00000000000a'
const ACCOUNT = '0b0b0b0b-0000-4000-8000-00000000000b'

/** A timing on a clock the test moves, with what it logged. */
function timing(options: SubscriptionTimingOptions = {}) {
  let clock = 1_000
  const [subscribed, setSubscribed] = createSignal(false)
  const lines: string[] = []
  const made = createSubscriptionTiming({
    now: () => clock,
    wall: () => Date.UTC(2026, 9, 17, 12, 0, 0),
    subscribed,
    log: (line) => lines.push(line),
    ...options,
  })
  return {
    ...made,
    lines,
    setSubscribed,
    /** Time passes. */
    pass(ms: number) {
      clock += ms
    },
  }
}

afterEach(() => {
  vi.useRealTimers()
})

describe('a timed flow', () => {
  it('has every step in order, with its time, and what it ended in', async () => {
    const t = timing()
    const run = t.timer.begin('subscribe')

    await run.step('initialize', async () => {
      t.pass(4)
    })
    await run.step('identify', async () => {
      t.pass(310)
    })
    await run.step('purchase', async () => {
      t.pass(41_250)
    })
    run.end('cancelled')

    const [flow] = t.flows()
    expect(flow).toMatchObject({
      flow: 'subscribe',
      outcome: 'cancelled',
      totalMs: 41_564,
      server: null,
      steps: [
        { step: 'initialize', ms: 4, failed: false },
        { step: 'identify', ms: 310, failed: false },
        { step: 'purchase', ms: 41_250, failed: false },
      ],
    })
    expect(t.lines).toHaveLength(1)
    expect(t.lines[0]).toMatch(
      /^Subscribe at \d\d:\d\d:\d\d: cancelled in 41\.6 s \(initialize 4 ms, identify 310 ms, purchase 41\.3 s\)$/u,
    )
  })

  it('marks the step that failed and lets its error through', async () => {
    const t = timing()
    const run = t.timer.begin('restore')

    await expect(
      run.step('restore', async () => {
        t.pass(900)
        throw new Error('the store is down')
      }),
    ).rejects.toThrow('the store is down')
    run.end('failed')

    expect(t.flows()[0]?.steps).toEqual([
      { step: 'restore', ms: 900, failed: true },
    ])
    expect(t.lines[0]).toContain('restore 900 ms (failed)')
  })

  it('says it is running until it ends', () => {
    const t = timing()
    t.timer.begin('carry')

    const [flow] = t.flows()
    if (flow === undefined) throw new Error('nothing was timed')
    expect(flow.totalMs).toBeNull()
    expect(flowLine(flow)).toMatch(/: running \(no store steps\)$/u)
  })

  it('keeps the last eight, newest first', () => {
    const t = timing()
    for (let n = 0; n < KEPT_FLOWS + 2; n += 1) {
      t.timer.begin(n % 2 === 0 ? 'subscribe' : 'restore').end('nothing')
    }

    const ids = t.flows().map((flow) => flow.id)
    expect(ids).toHaveLength(KEPT_FLOWS)
    expect(ids[0]).toBe(KEPT_FLOWS + 2)
    expect(ids.at(-1)).toBe(3)
  })
})

describe('the wait for the songs after the store says yes', () => {
  it('is read off the moment the app hears the server has them', () => {
    const t = timing()
    const run = t.timer.begin('subscribe')
    t.pass(2_000)
    run.end('purchased')
    expect(t.flows()[0]?.server).toBe('waiting')

    t.pass(4_200)
    t.setSubscribed(true)

    expect(t.flows()[0]).toMatchObject({ server: 'heard', serverMs: 4_200 })
    expect(t.lines.at(-1)).toMatch(
      /^Subscribe at \d\d:\d\d:\d\d: songs 4\.2 s after the store's yes$/u,
    )
  })

  it('is nothing when the server already had them', () => {
    const t = timing()
    t.setSubscribed(true)

    t.timer.begin('restore').end('restored')

    expect(t.flows()[0]).toMatchObject({ server: 'heard', serverMs: 0 })
  })

  it('says so when the songs did not come in time', () => {
    vi.useFakeTimers()
    const t = timing({ serverWaitMs: 60_000 })
    t.timer.begin('carry').end('moved')

    t.pass(60_000)
    vi.advanceTimersByTime(60_000)

    expect(t.flows()[0]).toMatchObject({
      server: 'not-heard',
      serverMs: 60_000,
    })
    expect(t.lines.at(-1)).toContain("no songs 60.0 s after the store's yes")
  })

  it('is not waited for after an answer that sold nothing', () => {
    const t = timing()
    for (const outcome of [
      'cancelled',
      'pending',
      'held-elsewhere',
      'nothing',
    ]) {
      t.timer.begin('subscribe').end(outcome)
    }

    expect(t.flows().every((flow) => flow.server === null)).toBe(true)
  })
})

describe('the subscription, timed', () => {
  /** A phone signed out on its anonymous identity, timed. */
  function phone() {
    const t = timing()
    const store = fakeRevenueCat()
    let session = { id: PHONE, account: false }
    let kept: string | null = null
    const subscription = createKaraokeSubscription(
      store,
      async () => Promise.resolve(session.id),
      {
        phone: {
          accountHeld: () => session.account,
          accountId: () => (session.account ? session.id : null),
          anonymousId: () => PHONE,
        },
        note: {
          read: () => kept,
          write: (id) => {
            kept = id
          },
          clear: () => {
            kept = null
          },
        },
        timer: t.timer,
      },
    )
    return {
      t,
      subscription,
      signIn(id: string) {
        session = { id, account: true }
      },
    }
  }

  const stepsOf = (t: ReturnType<typeof timing>, index = 0) =>
    t.flows()[index]?.steps.map((step) => step.step)

  it('times a Subscribe by its store steps', async () => {
    const { t, subscription } = phone()

    await expect(subscription.subscribe()).resolves.toBe('purchased')

    expect(t.flows()[0]?.outcome).toBe('purchased')
    expect(stepsOf(t)).toEqual([
      'initialize',
      'identify',
      'logIn',
      'getOfferings',
      'purchase',
    ])
  })

  it('times a Restore purchase by its store steps', async () => {
    const { t, subscription } = phone()

    await expect(subscription.restore()).resolves.toBe('nothing')

    expect(t.flows()[0]?.outcome).toBe('nothing')
    expect(stepsOf(t)).toEqual(['initialize', 'identify', 'logIn', 'restore'])
  })

  it("times a sign-in's carry, both store sign-ins included", async () => {
    const { t, subscription, signIn } = phone()
    await subscription.subscribe()
    signIn(ACCOUNT)

    await expect(subscription.carryToAccount?.()).resolves.toBe('moved')

    expect(t.flows()[0]?.flow).toBe('carry')
    expect(t.flows()[0]?.outcome).toBe('moved')
    expect(stepsOf(t)).toEqual([
      'initialize',
      'identify',
      'logIn',
      'getCustomer',
      'logIn',
      'restore',
    ])
  })

  it('times nothing for a sign-in that has nothing to carry', async () => {
    const { t, subscription, signIn } = phone()
    signIn(ACCOUNT)

    await expect(subscription.carryToAccount?.()).resolves.toBe('nothing')

    expect(t.flows()).toEqual([])
  })
})
