// ============================================================
// home-session-ask: today's session, asked of Home from outside it
// ============================================================
//
// First Light and the plan layer ask; Home's card mount answers. These cases
// run the channel alone: when an ask is answered, how often, and by which
// Home. Each case imports a fresh copy, so an ask one case leaves waiting is
// never another's.

import type { Mock } from 'vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as HomeSessionAsk from './home-session-ask'

let channel: typeof HomeSessionAsk
const goings: (() => void)[] = []

beforeEach(async () => {
  vi.resetModules()
  channel = await import('./home-session-ask')
})

afterEach(() => {
  for (const go of goings.splice(0)) go()
  vi.restoreAllMocks()
})

/** A Home that answers from now on: what it answered, and how it goes. */
function home(): { answer: Mock<() => void>; go: () => void } {
  const answer = vi.fn<() => void>()
  const go = channel.answerHomeSessionAsks(answer)
  goings.push(go)
  return { answer, go }
}

const microtask = (): Promise<void> => Promise.resolve()

describe("asking Home for today's session", () => {
  it('is answered by the Home that is drawn, a microtask after the ask, and once', async () => {
    const { answer } = home()

    channel.askHomeForTodaysSession()
    expect(answer).not.toHaveBeenCalled()
    await microtask()
    await microtask()

    expect(answer).toHaveBeenCalledOnce()
  })

  it('waits for a Home that is not drawn yet, which answers it a microtask after it is', async () => {
    channel.askHomeForTodaysSession()
    const { answer } = home()
    expect(answer).not.toHaveBeenCalled()

    await microtask()

    expect(answer).toHaveBeenCalledOnce()
  })

  it('is not answered again by the next Home', async () => {
    const first = home()
    channel.askHomeForTodaysSession()
    await microtask()
    first.go()

    const next = home()
    await microtask()

    expect(first.answer).toHaveBeenCalledOnce()
    expect(next.answer).not.toHaveBeenCalled()
  })

  it('is left for the next Home by a Home that goes before it answers', async () => {
    const going = home()
    channel.askHomeForTodaysSession()
    going.go()
    const next = home()

    await microtask()

    expect(going.answer).not.toHaveBeenCalled()
    expect(next.answer).toHaveBeenCalledOnce()
  })

  it('is answered up to five seconds after it was made', async () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(1_000_000)
    channel.askHomeForTodaysSession()
    now.mockReturnValue(1_005_000)

    const { answer } = home()
    await microtask()

    expect(answer).toHaveBeenCalledOnce()
  })

  it('is dropped when no Home answers it in five seconds, so a later visit to Home is only a visit', async () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(1_000_000)
    channel.askHomeForTodaysSession()
    now.mockReturnValue(1_005_001)

    const late = home()
    await microtask()
    late.go()
    const later = home()
    await microtask()

    expect(late.answer).not.toHaveBeenCalled()
    expect(later.answer).not.toHaveBeenCalled()
  })
})
