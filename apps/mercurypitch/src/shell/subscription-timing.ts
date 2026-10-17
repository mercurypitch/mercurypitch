// ============================================================
// How long the subscription took, step by step, for the Developer screen
// ============================================================
//
// Subscribe took close to a minute on TestFlight build 919 before "You're
// subscribed" came up, and nothing said which step. On a test build every
// step of a Subscribe, a Restore purchase and a sign-in's carry is timed
// here (karaoke-subscription.ts asks a SubscriptionTimer): setting up the
// store (initialize), the server naming the singer (identify), telling the
// store who that is (logIn), its catalogue (getOfferings), whose the
// subscription is (getCustomer), the store's own sheet and receipt
// (purchase), and restore.
//
// Then the wait for the server. RevenueCat's webhook reaches it in its own
// time after the store's yes, and the app learns of it from the songs it
// asks for anyway (karaoke-songs.ts awaitSubscription, about half a minute
// of asking). The wait is read off those answers, so it is the wait the
// singer had: "no songs" means the app stopped asking first, and Settings
// still says Not subscribed until something asks again. Nothing here asks
// the server on its own, so a test build behaves as a store build does.
//
// Each finished flow is also one `[subscription]` line in the console, which
// a test build keeps and the portable console copies.
//
// A test build's only. The wiring passes the timer behind
// VITE_PORTABLE_CONSOLE, and the panel that shows it
// (SubscriptionTimingPanel.tsx) is registered behind the same constant
// through a dynamic import. Nothing runs as this module loads, and
// vite.config.ts declares it free of side effects with Stage 2, so a build
// that uses neither carries none of it.

import type { Accessor } from 'solid-js'
import { createEffect, createRoot, createSignal, on } from 'solid-js'
import { karaokeSongs } from '@/features/karaoke-room/karaoke-songs'
import type { SubscriptionTimer, TimedFlow, TimedRun, TimedStep, } from './karaoke-subscription'

export interface StepTiming {
  readonly step: TimedStep
  readonly ms: number
  readonly failed: boolean
}

/** Where the wait for the server stands, after the store said yes. */
export type ServerWait = 'waiting' | 'heard' | 'not-heard'

export interface FlowTiming {
  readonly id: number
  readonly flow: TimedFlow
  /** When it started, by the wall clock. */
  readonly startedAt: number
  readonly steps: readonly StepTiming[]
  /** Null while it runs. */
  readonly totalMs: number | null
  readonly outcome: string | null
  /** Null when there was no yes to wait for. */
  readonly server: ServerWait | null
  /** From the store's yes to the songs, or to giving up on them. */
  readonly serverMs: number | null
}

/** The flows kept, newest first. */
export const KEPT_FLOWS = 8

/** How long the songs are watched for after a yes, at most. */
export const SERVER_WAIT_MS = 120_000

/** The outcomes that are the store's yes: the songs should follow. */
const YES: ReadonlySet<string> = new Set(['purchased', 'moved', 'restored'])

export const FLOW_NAMES: Readonly<Record<TimedFlow, string>> = {
  subscribe: 'Subscribe',
  restore: 'Restore purchase',
  carry: 'Carry after sign-in',
}

/** "820 ms", "4.2 s". */
export function formatMs(ms: number): string {
  return ms < 1000
    ? `${String(Math.round(ms))} ms`
    : `${(ms / 1000).toFixed(1)} s`
}

/** The steps on one line: "initialize 3 ms, identify 120 ms, ...". */
export function stepsLine(flow: FlowTiming): string {
  if (flow.steps.length === 0) return 'no store steps'
  return flow.steps
    .map(
      (step) =>
        `${step.step} ${formatMs(step.ms)}${step.failed ? ' (failed)' : ''}`,
    )
    .join(', ')
}

/** What the flow ended in, and how long it took. */
export function outcomeLine(flow: FlowTiming): string {
  if (flow.totalMs === null) return 'running'
  return `${flow.outcome ?? 'ended'} in ${formatMs(flow.totalMs)}`
}

/** Where the songs are, or null when there was no yes to wait for. */
export function serverLine(flow: FlowTiming): string | null {
  switch (flow.server) {
    case null:
      return null
    case 'waiting':
      return 'waiting for the songs'
    case 'heard':
      return `songs ${formatMs(flow.serverMs ?? 0)} after the store's yes`
    case 'not-heard':
      return `no songs ${formatMs(flow.serverMs ?? 0)} after the store's yes`
  }
}

/** A flow's name and when it started: "Subscribe at 14:02:31". */
export function flowTitle(flow: FlowTiming): string {
  const at = new Date(flow.startedAt).toLocaleTimeString('en-GB')
  return `${FLOW_NAMES[flow.flow]} at ${at}`
}

/** One flow as one line, for the console and the copied report. */
export function flowLine(flow: FlowTiming): string {
  const server = serverLine(flow)
  return `${flowTitle(flow)}: ${outcomeLine(flow)} (${stepsLine(flow)})${server === null ? '' : `; ${server}`}`
}

export interface SubscriptionTimingOptions {
  /** A monotonic clock, in ms. */
  readonly now?: () => number
  /** The wall clock, in epoch ms. */
  readonly wall?: () => number
  /** Whether the server says subscribed, as the app last heard. */
  readonly subscribed?: Accessor<boolean>
  readonly serverWaitMs?: number
  readonly log?: (line: string) => void
}

export interface SubscriptionTiming {
  readonly timer: SubscriptionTimer
  /** The flows timed, newest first. Reactive. */
  readonly flows: Accessor<readonly FlowTiming[]>
}

export function createSubscriptionTiming(
  options: SubscriptionTimingOptions = {},
): SubscriptionTiming {
  const now = options.now ?? (() => performance.now())
  const wall = options.wall ?? (() => Date.now())
  const subscribed = options.subscribed ?? (() => karaokeSongs().subscribed)
  const serverWaitMs = options.serverWaitMs ?? SERVER_WAIT_MS
  const log =
    options.log ??
    ((line: string) => {
      console.info(`[subscription] ${line}`)
    })

  const [flows, setFlows] = createSignal<readonly FlowTiming[]>([])
  let nextId = 1

  /** Change one flow; null once it has dropped off the list. */
  function update(
    id: number,
    change: (flow: FlowTiming) => Partial<FlowTiming>,
  ): FlowTiming | null {
    const list = flows().map((flow) =>
      flow.id === id ? { ...flow, ...change(flow) } : flow,
    )
    setFlows(list)
    return list.find((flow) => flow.id === id) ?? null
  }

  /** Read the wait for the songs off what the app hears from the server. */
  function awaitServer(id: number, from: number): void {
    const settle = (server: ServerWait): void => {
      const done = update(id, () => ({ server, serverMs: now() - from }))
      if (done !== null) log(`${flowTitle(done)}: ${serverLine(done) ?? ''}`)
    }
    if (subscribed()) {
      settle('heard')
      return
    }
    update(id, () => ({ server: 'waiting' }))
    createRoot((dispose) => {
      const giveUp = setTimeout(() => {
        settle('not-heard')
        dispose()
      }, serverWaitMs)
      createEffect(
        on(
          subscribed,
          (yes) => {
            if (!yes) return
            clearTimeout(giveUp)
            settle('heard')
            dispose()
          },
          { defer: true },
        ),
      )
    })
  }

  const timer: SubscriptionTimer = {
    begin(flow: TimedFlow): TimedRun {
      const id = nextId
      nextId += 1
      const started = now()
      setFlows((list) =>
        [
          {
            id,
            flow,
            startedAt: wall(),
            steps: [],
            totalMs: null,
            outcome: null,
            server: null,
            serverMs: null,
          },
          ...list,
        ].slice(0, KEPT_FLOWS),
      )
      const record = (step: TimedStep, ms: number, failed: boolean): void => {
        update(id, (each) => ({
          steps: [...each.steps, { step, ms, failed }],
        }))
      }
      return {
        async step<T>(name: TimedStep, work: () => Promise<T>): Promise<T> {
          const from = now()
          try {
            const answer = await work()
            record(name, now() - from, false)
            return answer
          } catch (error) {
            record(name, now() - from, true)
            throw error
          }
        },
        end(outcome: string): void {
          const ended = now()
          const done = update(id, () => ({ totalMs: ended - started, outcome }))
          if (done !== null) log(flowLine(done))
          if (YES.has(outcome)) awaitServer(id, ended)
        },
      }
    },
  }

  return { timer, flows }
}

/** The one the app times with and the Developer screen reads, made on the
 *  first ask so that loading this module runs nothing. */
let appTiming: SubscriptionTiming | undefined

export function appSubscriptionTiming(): SubscriptionTiming {
  appTiming ??= createSubscriptionTiming()
  return appTiming
}
