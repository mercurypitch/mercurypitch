// ============================================================
// Shared audio context tests — one clock, leased by name
// ============================================================

import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, resolve, sep } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { acquireSharedAudioContext, resetSharedAudioContext, sharedAudioContextOwners, } from './shared-audio-context'

class FakeAudioContext {
  state = 'suspended'
  currentTime = 12
  resumeCount = 0
  suspendCount = 0
  closeCount = 0
  private readonly listeners = new Set<() => void>()

  async resume(): Promise<void> {
    this.resumeCount += 1
    this.state = 'running'
    this.emit()
  }

  async suspend(): Promise<void> {
    this.suspendCount += 1
    this.state = 'suspended'
    this.emit()
  }

  async close(): Promise<void> {
    this.closeCount += 1
    this.state = 'closed'
    this.emit()
  }

  addEventListener(type: string, listener: () => void): void {
    if (type === 'statechange') this.listeners.add(listener)
  }

  removeEventListener(_type: string, listener: () => void): void {
    this.listeners.delete(listener)
  }

  /** What iOS does for a phone call, Siri, or another app taking the route. */
  interrupt(): void {
    this.state = 'interrupted'
    this.emit()
  }

  private emit(): void {
    for (const listener of [...this.listeners]) listener()
  }
}

function useFakeContexts(): { built: FakeAudioContext[] } {
  const built: FakeAudioContext[] = []
  resetSharedAudioContext({
    createContext: () => {
      const fake = new FakeAudioContext()
      built.push(fake)
      return fake as unknown as AudioContext
    },
  })
  return { built }
}

function setPageHidden(hidden: boolean): void {
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue(
    hidden ? 'hidden' : 'visible',
  )
  document.dispatchEvent(new Event('visibilitychange'))
}

/** The suspend/resume calls the module makes are fire-and-forget. */
const settle = (): Promise<void> => Promise.resolve().then(() => undefined)

afterEach(() => {
  resetSharedAudioContext()
  vi.restoreAllMocks()
})

describe('the shared audio context', () => {
  it('builds nothing until an owner asks for the clock', () => {
    const { built } = useFakeContexts()

    const lease = acquireSharedAudioContext('asset-output')

    expect(built).toHaveLength(0)
    expect(lease.peek()).toBeNull()
    expect(sharedAudioContextOwners()).toEqual(['asset-output'])
  })

  it('hands every lane the same context', async () => {
    const { built } = useFakeContexts()
    const output = acquireSharedAudioContext('asset-output')
    const onboarding = acquireSharedAudioContext('onboarding-cinematic')
    const tuner = acquireSharedAudioContext('tap-tuner')
    const sing = acquireSharedAudioContext('sing-driver:glass')
    const tap = acquireSharedAudioContext('tap-driver')

    await output.unlock()
    const contexts = [onboarding, tuner, sing, tap].map((lease) =>
      lease.ensure(),
    )

    expect(built).toHaveLength(1)
    expect(new Set([output.peek(), ...contexts]).size).toBe(1)
    // The clock a tap is stamped with is the clock a note is scheduled on.
    expect(tap.peek()?.currentTime).toBe(output.peek()?.currentTime)
  })

  it('resumes on unlock, so a gesture lifts the whole app at once', async () => {
    const { built } = useFakeContexts()

    await expect(acquireSharedAudioContext('tap-tuner').unlock()).resolves.toBe(
      true,
    )

    expect(built[0].state).toBe('running')
    expect(built[0].resumeCount).toBe(1)
  })

  it('reports no clock when the platform has no Web Audio', async () => {
    resetSharedAudioContext({ createContext: () => undefined })
    const lease = acquireSharedAudioContext('sing-driver:glass')

    expect(lease.ensure()).toBeNull()
    await expect(lease.unlock()).resolves.toBe(false)
  })

  it('survives a context factory that throws, without retrying it', () => {
    let calls = 0
    resetSharedAudioContext({
      createContext: () => {
        calls += 1
        throw new Error('no audio hardware')
      },
    })

    expect(acquireSharedAudioContext('asset-output').ensure()).toBeNull()
    expect(acquireSharedAudioContext('tap-driver').ensure()).toBeNull()
    expect(calls).toBe(1)
  })

  it('pauses with the page and comes back on the way in', async () => {
    const { built } = useFakeContexts()
    const lease = acquireSharedAudioContext('tap-driver')
    await lease.unlock()

    setPageHidden(true)
    await settle()
    expect(built[0].state).toBe('suspended')
    expect(built[0].suspendCount).toBe(1)

    setPageHidden(false)
    await settle()
    expect(built[0].state).toBe('running')
    expect(built[0].resumeCount).toBe(2)
  })

  it('leaves the hardware parked when nobody holds a lease', async () => {
    const { built } = useFakeContexts()
    const lease = acquireSharedAudioContext('tap-driver')
    await lease.unlock()
    setPageHidden(true)
    await settle()
    lease.release()

    setPageHidden(false)
    await settle()

    expect(built[0].state).toBe('suspended')
    expect(built[0].resumeCount).toBe(1)
  })

  it('resumes an interrupted context while the page is in front', async () => {
    const { built } = useFakeContexts()
    await acquireSharedAudioContext('sing-driver:glass').unlock()

    built[0].interrupt()
    await settle()

    expect(built[0].state).toBe('running')
    expect(built[0].resumeCount).toBe(2)
  })

  it('leaves an interruption alone while the page is hidden', async () => {
    const { built } = useFakeContexts()
    await acquireSharedAudioContext('sing-driver:glass').unlock()
    setPageHidden(true)
    await settle()

    built[0].interrupt()
    await settle()

    expect(built[0].state).toBe('interrupted')
  })

  it('parks the clock when the last lease goes, and never closes it', async () => {
    const { built } = useFakeContexts()
    const output = acquireSharedAudioContext('asset-output')
    const tuner = acquireSharedAudioContext('tap-tuner')
    await output.unlock()

    tuner.release()
    await settle()
    expect(built[0].state).toBe('running')

    output.release()
    await settle()
    expect(built[0].state).toBe('suspended')
    expect(built[0].closeCount).toBe(0)
    expect(sharedAudioContextOwners()).toEqual([])
  })

  it('gives a re-acquiring lane the same context back', async () => {
    const { built } = useFakeContexts()
    const first = acquireSharedAudioContext('sing-driver:glass')
    await first.unlock()
    const context = first.peek()
    first.release()
    await settle()

    const second = acquireSharedAudioContext('sing-driver:range-finder')
    await second.unlock()

    expect(built).toHaveLength(1)
    expect(second.peek()).toBe(context)
    expect(built[0].state).toBe('running')
  })

  it('ignores a double release', async () => {
    const { built } = useFakeContexts()
    const lease = acquireSharedAudioContext('tap-driver')
    await lease.unlock()

    lease.release()
    lease.release()
    await settle()

    expect(built[0].suspendCount).toBe(1)
    expect(sharedAudioContextOwners()).toEqual([])
  })
})

// ============================================================
// The invariant itself: five call sites became one owner, and the only
// way that stays true is if nothing else can build a context. A sixth
// would have hit the cap older Chrome put on a tab (docs/games/glass-3d.md
// §7), and every extra one is another clock the judging cannot trust.
// ============================================================

const SOURCE_ROOT = resolve(process.cwd(), 'src')
const CONTEXT_OWNER = join('audio', 'shared-audio-context.ts')

function productionSources(): string[] {
  return readdirSync(SOURCE_ROOT, { recursive: true, encoding: 'utf8' })
    .filter((name) => /\.tsx?$/u.test(name) && !/\.test\.tsx?$/u.test(name))
    .map((name) => name.split('/').join(sep))
}

describe('AudioContext construction', () => {
  it('happens in exactly one module', () => {
    const builders = productionSources().filter((name) =>
      /new\s+(?:webkit)?AudioContext\s*\(/u.test(
        readFileSync(join(SOURCE_ROOT, name), 'utf8'),
      ),
    )

    expect(builders).toEqual([CONTEXT_OWNER])
  })

  it('scans a source tree it can actually see', () => {
    const sources = productionSources()

    expect(sources.length).toBeGreaterThan(20)
    expect(sources).toContain(CONTEXT_OWNER)
    expect(relative(SOURCE_ROOT, join(SOURCE_ROOT, CONTEXT_OWNER))).toBe(
      CONTEXT_OWNER,
    )
  })
})
