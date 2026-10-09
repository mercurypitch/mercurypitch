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
// The owner hears (`alert`, sendBillingAlert) when the sweep applied
// anything, since that means the webhook missed it; when an event failed;
// and when Stripe would not list the events, or not all of them.
//
// Stripe, the handler, the alert and the clock come in as ports, so the
// tests drive the sweep through fakes.

import type { StripeGet } from './stripe-charge'
import { isRecord } from './stripe-charge'
import type { StripeEventInput, StripeEventResult } from './stripe-payments'
import { HANDLED_EVENTS, parseStripeEvent } from './stripe-payments'

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

export interface SweepPorts {
  get: StripeGet
  /** The webhook's handler. Throws when the event may pass on a retry. */
  apply: (event: StripeEventInput) => Promise<StripeEventResult>
  alert: (subject: string, lines: string[]) => Promise<void>
  /** Now, in seconds since 1970. */
  nowSec: number
}

export interface SweepReport {
  /** The events Stripe listed, recorded or not. */
  listed: number
  /** The events the sweep applied, each with what it did. */
  recovered: string[]
  /** The events that failed, left for the next run. */
  failed: string[]
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

async function applyAll(
  ports: SweepPorts,
  events: StripeEventInput[],
): Promise<{ recovered: string[]; failed: string[] }> {
  const recovered: string[] = []
  const failed: string[] = []
  for (const event of events) {
    const label = `${event.id} (${event.type})`
    try {
      const line = recoveredLine(label, await ports.apply(event))
      if (line !== null) recovered.push(line)
    } catch (err) {
      console.error(
        `[billing] sweep: ${label} failed, left for the next run:`,
        err,
      )
      failed.push(`${label}: ${errorText(err)}`)
    }
  }
  return { recovered, failed }
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
  const { recovered, failed } = await applyAll(ports, listing.events)
  if (recovered.length > 0) await alertRecovered(ports, recovered)
  if (failed.length > 0) await alertFailed(ports, failed)
  if (listing.incomplete !== null) {
    await alertIncomplete(ports, listing.incomplete, listing.events.length)
  }
  console.log(
    `[billing] sweep: ${listing.events.length} event(s) listed, ${recovered.length} recovered, ${failed.length} failed`,
  )
  return {
    listed: listing.events.length,
    recovered,
    failed,
    incomplete: listing.incomplete,
  }
}
