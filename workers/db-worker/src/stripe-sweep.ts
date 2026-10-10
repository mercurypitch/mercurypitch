// ============================================================
// stripe-sweep — apply the Stripe events the webhook missed
// ============================================================
//
// Every six hours (index.ts, scheduled, through billing.ts reconcileBilling)
// the worker lists the event types it handles (HANDLED_EVENTS) from Stripe's
// Events API, which keeps every event for 30 days whether or not a webhook
// endpoint subscribes to it. Each one is handed, oldest first, to the
// webhook's own handler (billing.ts, applyStripeEvent), which skips what
// billingEvents has recorded. One code path, keyed by event id: an event
// applies once, whichever of the two reaches it first, or both at once.
//
// The last ten minutes are left out. An event that new is most likely on
// its way through the webhook, and applying it here would report a delivery
// that was never missed. Each event applies on its own: one that fails
// stays unrecorded for the next run, and the rest go on.
//
// D1 allows a Worker invocation 1,000 queries. The sweep asks billingEvents
// about a whole page of events in one query (`recorded`), so a recorded
// event costs nothing more, and applies at most SWEEP_MONEY_BACK_PER_RUN
// refunds and disputes, which cost about ten queries each; the next run
// applies the rest. Purchases are not capped: a missed one is rare, and a
// paid pack waits for nothing.
//
// The owner hears (`alert`, sendBillingAlert) when the sweep applied
// anything, since that means the webhook missed it; when an event failed;
// and when Stripe would not list the events, or not all of them. The
// events migration 0065 reopened, which an older worker recorded without
// applying them, are no webhook failure: the sweep applies them quietly
// and lists them all in one summary.
//
// Stripe, the handler, the alert and the clock come in as ports, so the
// tests drive the sweep through fakes.

import type { BillingAlert } from './stripe-alerts'
import type { StripeGet } from './stripe-charge'
import { isRecord } from './stripe-charge'
import type { StripeEventInput, StripeEventResult } from './stripe-events'
import { HANDLED_EVENTS, isMoneyBackEvent, parseStripeEvent, } from './stripe-events'

/** How far back the sweep looks: all that Stripe's events list keeps. */
export const SWEEP_WINDOW_SECONDS = 30 * 24 * 60 * 60
/** How recent an event the sweep leaves to the webhook. */
export const SWEEP_GRACE_SECONDS = 10 * 60
/** Stripe's largest page. */
const PAGE_SIZE = 100
/** A runaway guard: a thousand handled events in 30 days is far past this
 *  shop's volume, and the alert says the sweep stopped short. */
export const SWEEP_MAX_PAGES = 10
/** Each page is asked for twice before the sweep gives up on the list. */
const LIST_ATTEMPTS = 2
/** The refunds and disputes one run applies at most. At about ten D1
 *  queries each, with the listing and the purchases, a run stays far below
 *  D1's 1,000 queries per invocation; the next run applies the rest. */
export const SWEEP_MONEY_BACK_PER_RUN = 25

/** The type migration 0065 gave each refund and dispute event an older
 *  worker recorded without applying it: `reopened:<type>`. The webhook and
 *  the sweep take such an event as not recorded, and recording it drops the
 *  prefix (billing.ts, recordBillingEvent). */
export const REOPENED_PREFIX = 'reopened:'

/** What billingEvents holds of an event the sweep listed: done, or reopened
 *  by migration 0065 for the sweep to apply. */
export type EventRecord = 'recorded' | 'reopened'

export interface SweepPorts {
  get: StripeGet
  /** What billingEvents holds of these events, in one query: up to a page
   *  of them. An event it holds nothing of is missing from the map. */
  recorded: (ids: string[]) => Promise<Map<string, EventRecord>>
  /** The webhook's handler. Throws when the event may pass on a retry. With
   *  `held`, the alert a refund or dispute sends goes there instead. */
  apply: (
    event: StripeEventInput,
    held?: BillingAlert[],
  ) => Promise<StripeEventResult>
  alert: (subject: string, lines: string[]) => Promise<void>
  /** Now, in seconds since 1970. */
  nowSec: number
}

export interface SweepReport {
  /** The events Stripe listed, recorded or not. */
  listed: number
  /** The events the sweep applied, each with what it did. */
  recovered: string[]
  /** The events migration 0065 reopened that the sweep applied. */
  reapplied: string[]
  /** The events that failed, left for the next run. */
  failed: string[]
  /** The refunds and disputes past SWEEP_MONEY_BACK_PER_RUN, left for the
   *  next run. */
  left: number
  /** Why the list stopped short, or null when Stripe listed it all. */
  incomplete: string | null
}

interface Listing {
  /** Oldest first. */
  events: StripeEventInput[]
  incomplete: string | null
}

function errorText(err: unknown): string {
  const text =
    err instanceof Error ? `${err.name}: ${err.message}` : String(err)
  return text.length > 300 ? `${text.slice(0, 300)}...` : text
}

function pageQuery(
  from: number,
  to: number,
  startingAfter: string | undefined,
): string {
  const query = new URLSearchParams({
    limit: String(PAGE_SIZE),
    'created[gte]': String(from),
    'created[lte]': String(to),
  })
  for (const type of HANDLED_EVENTS) query.append('types[]', type)
  if (startingAfter !== undefined) query.set('starting_after', startingAfter)
  return query.toString()
}

type Page =
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; why: string }

async function readPage(get: StripeGet, query: string): Promise<Page> {
  let why = ''
  for (let attempt = 0; attempt < LIST_ATTEMPTS; attempt += 1) {
    try {
      const res = await get(`/events?${query}`)
      if (res.ok) return { ok: true, data: res.data }
      why = `Stripe answered ${res.status} to the events list`
    } catch (err) {
      why = `Stripe could not be reached for the events list (${errorText(err)})`
    }
  }
  return { ok: false, why }
}

function oldestFirst(newestFirst: StripeEventInput[]): StripeEventInput[] {
  // Stripe lists newest first; the sort keeps that order reversed within
  // one second.
  return [...newestFirst].reverse().sort((a, b) => a.created - b.created)
}

/** Where the next page starts: the id of this page's last item. */
function lastId(items: unknown[]): string | undefined {
  const last = items.at(-1)
  return isRecord(last) && typeof last.id === 'string' && last.id !== ''
    ? last.id
    : undefined
}

/** Every handled event of the window, oldest first: all of them, or as
 *  many as Stripe listed before it stopped. */
async function listEvents(ports: SweepPorts): Promise<Listing> {
  const from = ports.nowSec - SWEEP_WINDOW_SECONDS
  const to = ports.nowSec - SWEEP_GRACE_SECONDS
  const listed: StripeEventInput[] = []
  let startingAfter: string | undefined
  for (let page = 0; page < SWEEP_MAX_PAGES; page += 1) {
    const res = await readPage(ports.get, pageQuery(from, to, startingAfter))
    if (!res.ok) return { events: oldestFirst(listed), incomplete: res.why }
    const items = Array.isArray(res.data.data) ? res.data.data : []
    for (const item of items) {
      const event = parseStripeEvent(item)
      if (!('ignored' in event)) listed.push(event)
    }
    startingAfter = lastId(items)
    if (res.data.has_more !== true || startingAfter === undefined) {
      return { events: oldestFirst(listed), incomplete: null }
    }
  }
  return {
    events: oldestFirst(listed),
    incomplete: `more than ${SWEEP_MAX_PAGES * PAGE_SIZE} events in 30 days, and the oldest were not listed`,
  }
}

function recoveredLine(
  label: string,
  result: StripeEventResult,
): string | null {
  if (result.kind === 'ignored') {
    return `${label}: acknowledged, ${result.reason}`
  }
  if (result.kind !== 'applied') return null
  return result.detail === undefined ? label : `${label}: ${result.detail}`
}

/** What a reopened event's reapplication did, for the summary: its line,
 *  with the alert it would have sent beneath it. Null when another delivery
 *  recorded it first. */
function reappliedLines(
  label: string,
  result: StripeEventResult,
  held: BillingAlert[],
): string[] | null {
  if (result.kind === 'duplicate') return null
  const what =
    held.length > 0
      ? held.map((alert) => alert.subject).join('; ')
      : result.kind === 'ignored'
        ? `acknowledged, ${result.reason}`
        : 'nothing moved now'
  return [
    `${label}: ${what}`,
    ...held.flatMap((alert) => alert.lines.map((line) => `  ${line}`)),
  ]
}

/** What billingEvents holds of the listed events: one query a page. */
async function recordsOf(
  ports: SweepPorts,
  events: StripeEventInput[],
): Promise<Map<string, EventRecord>> {
  const records = new Map<string, EventRecord>()
  for (let start = 0; start < events.length; start += PAGE_SIZE) {
    const ids = events.slice(start, start + PAGE_SIZE).map((event) => event.id)
    for (const [id, record] of await ports.recorded(ids)) {
      records.set(id, record)
    }
  }
  return records
}

interface Applied {
  recovered: string[]
  /** One entry per event, its lines. */
  reapplied: string[][]
  failed: string[]
  left: number
}

async function applyAll(
  ports: SweepPorts,
  events: StripeEventInput[],
): Promise<Applied> {
  const records = await recordsOf(ports, events)
  const applied: Applied = { recovered: [], reapplied: [], failed: [], left: 0 }
  let moneyBack = 0
  for (const event of events) {
    const record = records.get(event.id)
    if (record === 'recorded') continue
    if (isMoneyBackEvent(event.type)) {
      if (moneyBack >= SWEEP_MONEY_BACK_PER_RUN) {
        applied.left += 1
        continue
      }
      moneyBack += 1
    }
    const label = `${event.id} (${event.type})`
    const held: BillingAlert[] | undefined =
      record === 'reopened' ? [] : undefined
    try {
      const result = await ports.apply(event, held)
      if (held === undefined) {
        const line = recoveredLine(label, result)
        if (line !== null) applied.recovered.push(line)
      } else {
        const lines = reappliedLines(label, result, held)
        if (lines !== null) applied.reapplied.push(lines)
      }
    } catch (err) {
      console.error(
        `[billing] sweep: ${label} failed, left for the next run:`,
        err,
      )
      applied.failed.push(`${label}: ${errorText(err)}`)
    }
  }
  if (applied.left > 0) {
    console.warn(
      `[billing] sweep: applied ${SWEEP_MONEY_BACK_PER_RUN} refund and dispute event(s), the most one run applies; ${applied.left} left for the next run`,
    )
  }
  return applied
}

async function alertRecovered(
  ports: SweepPorts,
  recovered: string[],
): Promise<void> {
  console.error(
    `[billing] sweep: applied ${recovered.length} event(s) the webhook missed:\n${recovered.join('\n')}`,
  )
  await ports.alert(`Sweep recovered ${recovered.length} missed event(s)`, [
    'The reconciliation sweep applied these Stripe events, which the webhook',
    'never did. Each refund or dispute among them sent its own alert too.',
    'A recovery means webhook delivery is failing: check the endpoint and its',
    'recent deliveries in the Stripe Dashboard, under Developers, Webhooks.',
    '',
    ...recovered,
  ])
}

async function alertReapplied(
  ports: SweepPorts,
  reapplied: string[][],
  left: number,
): Promise<void> {
  console.log(
    `[billing] sweep: reapplied ${reapplied.length} event(s) after migration 0065`,
  )
  await ports.alert(
    `Reapplied ${reapplied.length} event(s) after migration 0065`,
    [
      'Migration 0065 reopened the refund and dispute events an older worker',
      '(v0.9.16) recorded without applying them. The sweep has applied these',
      'now. That is not a webhook failure, so they are listed here, each with',
      'the alert it would have sent, instead of one alert each.',
      ...(left > 0
        ? [
            '',
            `${left} more refund and dispute event(s) are left for the next run, in six hours.`,
          ]
        : []),
      ...reapplied.flatMap((lines) => ['', ...lines]),
    ],
  )
}

async function alertFailed(ports: SweepPorts, failed: string[]): Promise<void> {
  await ports.alert(`Sweep could not apply ${failed.length} event(s)`, [
    'The reconciliation sweep could not apply these Stripe events. They stay',
    'unapplied, and the next run, in six hours, tries them again. If one keeps',
    'failing, the worker logs say why.',
    '',
    ...failed,
  ])
}

async function alertIncomplete(
  ports: SweepPorts,
  why: string,
  listed: number,
): Promise<void> {
  console.error(`[billing] sweep: incomplete, ${why}`)
  await ports.alert(`Sweep failed: ${why}`, [
    'The reconciliation sweep could not list all of the last 30 days of Stripe',
    'events, so a purchase, refund or dispute the webhook missed may not be',
    `applied yet. It applied what it did list (${listed} event(s)), and runs`,
    'again in six hours. If this repeats, check STRIPE_SECRET_KEY and the',
    'status of the Stripe API.',
  ])
}

/** List the window's events, apply the ones billingEvents has not recorded,
 *  and tell the owner what that took. */
export async function sweepStripeEvents(
  ports: SweepPorts,
): Promise<SweepReport> {
  const listing = await listEvents(ports)
  const { recovered, reapplied, failed, left } = await applyAll(
    ports,
    listing.events,
  )
  if (recovered.length > 0) await alertRecovered(ports, recovered)
  if (reapplied.length > 0) await alertReapplied(ports, reapplied, left)
  if (failed.length > 0) await alertFailed(ports, failed)
  if (listing.incomplete !== null) {
    await alertIncomplete(ports, listing.incomplete, listing.events.length)
  }
  console.log(
    `[billing] sweep: ${listing.events.length} event(s) listed, ${recovered.length} recovered, ${reapplied.length} reapplied after migration 0065, ${failed.length} failed, ${left} left for the next run`,
  )
  return {
    listed: listing.events.length,
    recovered,
    reapplied: reapplied.map((lines) => lines[0]),
    failed,
    left,
    incomplete: listing.incomplete,
  }
}
