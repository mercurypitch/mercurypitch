// ============================================================
// Feature switch client — the Content Studio's reads and writes of the experimental feature switches
// ============================================================
//
// The two admin routes (src/lib/experimental-features.ts holds their
// shapes; workers/db-worker/src/experimental-feature-routes.ts answers them):
//
//   GET /api/admin/features         Every feature on the worker's list,
//                                   switched or not.
//   PUT /api/admin/features/:name   {"enabled": true} or false sets the
//                                   switch; null hands the feature back to
//                                   the build's default.
//
// The admin credential travels as the studio's other services send it, in
// X-Admin-Key. Nothing here throws: each call answers a result the page can
// show, with the API's own error text, and a refused key is a kind of its
// own, because the page then offers to unlock the studio again. The list is
// read past the HTTP cache: the console has to show what a save just did.
//
// A row is kept whatever its name. The console offers what the worker lists,
// and a worker deployed ahead of this build may list a feature it does not
// know yet; the page says so beside it.

import { API_BASE_URL } from '@/lib/defaults'
import { ADMIN_FEATURES_PATH } from '@/lib/experimental-features'
import type { AdminEnvironment } from '../admin-environment'
import { adminEnvironment } from '../admin-environment'

export type Fetcher = (input: string, init?: RequestInit) => Promise<Response>

/** One feature's switch as the API lists it. */
export interface FeatureSwitchState {
  readonly name: string
  /** The owner's switch, or null where the build's default stands. */
  readonly enabled: boolean | null
  /** When the switch last changed; null while none is set. */
  readonly updatedAt: string | null
}

/** What a save answered: the feature as it now stands, and whether the save moved it. */
export interface FeatureSwitchSaved {
  readonly row: FeatureSwitchState
  readonly changed: boolean
}

/** Why a call came back without what it asked for. */
export type FeatureApiError =
  /** 403: the admin key is missing or wrong. */
  | { readonly kind: 'forbidden'; readonly message: string }
  /** Any other answer that is not a success, with the API's error text. */
  | {
      readonly kind: 'refused'
      readonly status: number
      readonly message: string
    }
  /** A success whose body this page cannot read. */
  | { readonly kind: 'unreadable'; readonly message: string }
  /** The request failed before the API answered. */
  | { readonly kind: 'offline'; readonly message: string }

export type FeatureApiResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: FeatureApiError }

// Read at call time, so a test that stubs the global is the one asked.
const fetchNow: Fetcher = (input, init) => fetch(input, init)

/** Same-origin when no API is configured, as in the e2e bundle. */
function url(path: string): string {
  return `${API_BASE_URL ?? ''}${path}`
}

/**
 * The environment these switches belong to: the one behind this build's
 * API, or the page's own origin where the build has none and the calls go
 * there.
 */
export function featureSwitchEnvironment(): AdminEnvironment {
  const base = API_BASE_URL ?? ''
  return adminEnvironment(base === '' ? window.location.origin : base)
}

const OFFLINE: FeatureApiError = {
  kind: 'offline',
  message: 'The API could not be reached.',
}

const UNREADABLE: FeatureApiError = {
  kind: 'unreadable',
  message: 'The API answered something this page cannot read.',
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

async function bodyOf(response: Response): Promise<unknown> {
  try {
    return (await response.json()) as unknown
  } catch {
    return undefined
  }
}

/** A refusal, in the API's words when it gave any. */
async function refusal(response: Response): Promise<FeatureApiError> {
  const body = await bodyOf(response)
  const said =
    isRecord(body) && typeof body.error === 'string' ? body.error : null
  if (response.status === 403) {
    return { kind: 'forbidden', message: said ?? 'Admin key required' }
  }
  return {
    kind: 'refused',
    status: response.status,
    message: said ?? `The API answered ${response.status}.`,
  }
}

/** One request, read by `read` on a success; null from `read` is an unreadable body. */
async function call<T>(
  fetcher: Fetcher,
  path: string,
  init: RequestInit,
  read: (body: unknown) => T | null,
): Promise<FeatureApiResult<T>> {
  let response: Response
  try {
    response = await fetcher(url(path), init)
  } catch {
    return { ok: false, error: OFFLINE }
  }
  if (!response.ok) return { ok: false, error: await refusal(response) }
  const value = read(await bodyOf(response))
  return value === null ? { ok: false, error: UNREADABLE } : { ok: true, value }
}

/** One row as the worker answers it, or null for anything else. */
function readRow(value: unknown): FeatureSwitchState | null {
  if (!isRecord(value)) return null
  const { name, enabled, updatedAt } = value
  if (typeof name !== 'string' || name === '') return null
  if (enabled !== null && typeof enabled !== 'boolean') return null
  if (updatedAt !== null && typeof updatedAt !== 'string') return null
  return { name, enabled, updatedAt }
}

/**
 * The whole list, or null when any row of it is unreadable: a console that
 * dropped the row it could not read would hide that feature's switch.
 */
function readList(body: unknown): FeatureSwitchState[] | null {
  if (!isRecord(body) || !Array.isArray(body.features)) return null
  const rows = body.features.map(readRow)
  return rows.every((row): row is FeatureSwitchState => row !== null)
    ? rows
    : null
}

function readSave(body: unknown): FeatureSwitchSaved | null {
  if (!isRecord(body) || typeof body.changed !== 'boolean') return null
  const row = readRow(body.row)
  return row === null ? null : { row, changed: body.changed }
}

/** Every feature on the worker's list, with its switch, in list order. */
export function fetchFeatureSwitches(
  adminKey: string,
  fetcher: Fetcher = fetchNow,
): Promise<FeatureApiResult<FeatureSwitchState[]>> {
  return call(
    fetcher,
    ADMIN_FEATURES_PATH,
    { headers: { 'X-Admin-Key': adminKey }, cache: 'no-store' },
    readList,
  )
}

/**
 * Switch feature `name` on (true) or off (false) for this environment, or
 * hand it back to the build's default (null). Answers the feature as it
 * now stands, and whether the save moved it.
 */
export function saveFeatureSwitch(
  adminKey: string,
  name: string,
  enabled: boolean | null,
  fetcher: Fetcher = fetchNow,
): Promise<FeatureApiResult<FeatureSwitchSaved>> {
  return call(
    fetcher,
    `${ADMIN_FEATURES_PATH}/${encodeURIComponent(name)}`,
    {
      method: 'PUT',
      headers: {
        'X-Admin-Key': adminKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ enabled }),
    },
    readSave,
  )
}
