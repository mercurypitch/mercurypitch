// The Developer screen's Cloud subscription section, read the way a tester
// reads it on the phone: the last flows, newest first, each with its store
// steps and the wait for the songs, and a Copy timings that hands them over
// or selects them where the clipboard is refused.

import { createSignal } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RenderedShell } from './render-for-test'
import { renderShell } from './render-for-test'
import { createSubscriptionTiming } from './subscription-timing'
import { SubscriptionTimingPanel } from './SubscriptionTimingPanel'

let view: RenderedShell | null = null

afterEach(() => {
  view?.unmount()
  view = null
  vi.unstubAllGlobals()
})

/** A timing on a clock the test moves, and the panel showing it. */
function open() {
  let clock = 0
  const [subscribed, setSubscribed] = createSignal(false)
  const timing = createSubscriptionTiming({
    now: () => clock,
    subscribed,
    log: () => undefined,
  })
  view = renderShell(() => <SubscriptionTimingPanel timing={timing} />)
  return {
    timing,
    setSubscribed,
    pass(ms: number) {
      clock += ms
    },
  }
}

function el<T extends Element>(selector: string): T {
  const found = view?.container.querySelector<T>(selector)
  if (found === null || found === undefined) throw new Error(selector)
  return found
}

const rows = (flow: string): string[] =>
  [
    ...(view?.container.querySelectorAll(
      `[data-flow="${flow}"] .mp-dev__readout-row`,
    ) ?? []),
  ].map((row) => row.textContent ?? '')

const settle = async (): Promise<void> => {
  await Promise.resolve()
  await Promise.resolve()
}

describe('the Cloud subscription section', () => {
  it('says nothing has been timed yet', () => {
    open()

    expect(el('[data-testid="dev-cloud-timings"]').textContent).toContain(
      'nothing yet',
    )
  })

  it('lists a Subscribe step by step, then when the songs came', async () => {
    const phone = open()
    const run = phone.timing.timer.begin('subscribe')
    await run.step('initialize', async () => {
      phone.pass(6)
    })
    await run.step('logIn', async () => {
      phone.pass(820)
    })
    await run.step('purchase', async () => {
      phone.pass(38_400)
    })
    run.end('purchased')

    expect(rows('subscribe')).toEqual([
      expect.stringMatching(
        /^Subscribepurchased in 39\.2 s · \d\d:\d\d:\d\d$/u,
      ),
      'initialize6 ms',
      'logIn820 ms',
      'purchase38.4 s',
      'serverwaiting for the songs',
    ])

    phone.pass(12_000)
    phone.setSubscribed(true)

    expect(rows('subscribe').at(-1)).toBe(
      "serversongs 12.0 s after the store's yes",
    )
  })

  it('puts the newest flow first', () => {
    const phone = open()
    phone.timing.timer.begin('subscribe').end('cancelled')
    phone.timing.timer.begin('restore').end('nothing')

    const flows = [
      ...(view?.container.querySelectorAll('[data-flow]') ?? []),
    ].map((flow) => flow.getAttribute('data-flow'))
    expect(flows).toEqual(['restore', 'subscribe'])
  })

  it('says Copied when the clipboard takes the timings', async () => {
    const writeText = vi.fn(async () => undefined)
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } })
    const phone = open()
    phone.timing.timer.begin('restore').end('nothing')

    el<HTMLButtonElement>('[data-testid="dev-cloud-timings-copy"]').click()
    await settle()

    expect(writeText).toHaveBeenCalledTimes(1)
    expect(writeText).toHaveBeenCalledWith(
      expect.stringMatching(
        /^Cloud subscription, newest first:\nRestore purchase at \d\d:\d\d:\d\d: nothing in 0 ms \(no store steps\)$/u,
      ),
    )
    expect(el('[data-testid="dev-cloud-timings-copy"]').textContent).toContain(
      'Copied',
    )
  })

  it('selects the timings where the clipboard is refused', async () => {
    const writeText = vi.fn(async () => {
      throw new DOMException('Write permission denied.', 'NotAllowedError')
    })
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } })
    const phone = open()
    phone.timing.timer.begin('carry').end('moved')

    el<HTMLButtonElement>('[data-testid="dev-cloud-timings-copy"]').click()
    await settle()

    const report = el('[data-testid="dev-cloud-timings-report"]').textContent
    expect(report).toContain('Carry after sign-in at')
    expect(window.getSelection()?.toString()).toBe(report)
  })
})
