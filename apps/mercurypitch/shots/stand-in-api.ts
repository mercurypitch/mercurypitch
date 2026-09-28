// ============================================================
// Stand-in API — the dev worker's answers, from fictional fixtures
// ============================================================
//
// The shots bundle names the dev worker (apps/mercurypitch/.env). No request
// reaches it, or anything else off this machine: every request that is not
// for the local preview server is either answered here or refused, and both
// are logged, so a new endpoint the app starts calling shows up in the run's
// output instead of in a screenshot as an error card.
//
// What is answered: the account (GET /api/auth/me, for the Settings card)
// and the worker's REST tables (server-adapter.ts), which the fictional
// account holds nothing in: a read is answered empty, the way a new account
// is, and a write is taken and handed back, so no "could not save" notice
// appears. Everything else on the worker gets a 404, which every reader in
// the app already treats as "nothing there"; anything on another host is
// aborted.

import type { BrowserContext, Request, Route } from '@playwright/test'
import { me, SINGER } from './fixtures'

const DEV_API = 'api-dev.mercurypitch.com'

/** The worker's REST tables (hybrid-adapter.ts, CLOUD_ENTITIES). */
const TABLES = new Set([
  'userProfiles',
  'sessionRecords',
  'voiceprints',
  'userActivity',
  'challengeDefinitions',
  'challengeProgress',
  'badgeDefinitions',
  'userBadges',
  'achievements',
  'userAchievements',
  'sharedMelodies',
  'sharedSessions',
  'featureFlags',
  'userSettings',
  'follows',
  'userSurveyResponses',
  'songManifests',
])

export interface StandInLog {
  /** `METHOD host/path` for every request the stand-in answered. */
  readonly answered: string[]
  /** Every request refused because it would have left the machine. */
  readonly refused: string[]
}

interface StandInOptions {
  /** Whether the fictional account exists on this device. */
  readonly signedIn: boolean
}

function json(route: Route, status: number, body: unknown): Promise<void> {
  return route.fulfill({
    status,
    contentType: 'application/json',
    headers: {
      'access-control-allow-origin': '*',
      'access-control-allow-headers': '*',
      'access-control-allow-methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS',
    },
    body: JSON.stringify(body),
  })
}

/** A write, taken and handed back the way the worker would. */
function echo(request: Request, table: string, id: string | undefined) {
  const at = new Date().toISOString()
  let body: Record<string, unknown> = {}
  try {
    body = (request.postDataJSON() ?? {}) as Record<string, unknown>
  } catch {
    body = {}
  }
  return {
    id: id ?? `shots-${table}-${Date.now()}`,
    createdAt: at,
    updatedAt: at,
    userId: SINGER.id,
    ...body,
  }
}

async function answerApi(
  route: Route,
  request: Request,
  url: URL,
  options: StandInOptions,
): Promise<boolean> {
  const method = request.method()
  if (method === 'OPTIONS') {
    await json(route, 204, null)
    return true
  }

  if (url.pathname === '/api/auth/me' && method === 'GET') {
    if (options.signedIn) await json(route, 200, me())
    else await json(route, 401, { error: 'unauthorized' })
    return true
  }

  const table = /^\/api\/([A-Za-z]+)(?:\/([^/]+))?$/u.exec(url.pathname)
  if (table === null || !TABLES.has(table[1])) return false
  const [, name, rest] = table
  if (method === 'GET') {
    if (rest === undefined) await json(route, 200, [])
    else if (rest === 'count') await json(route, 200, { count: 0 })
    else await json(route, 404, { error: 'not found' })
    return true
  }
  if (method === 'DELETE') await json(route, 200, { ok: true })
  else await json(route, 200, echo(request, name, rest))
  return true
}

/**
 * Answer the dev worker for `context`, and refuse everything else that is
 * not the local preview server. Returns the log the run prints.
 */
export async function installStandInApi(
  context: BrowserContext,
  options: StandInOptions,
): Promise<StandInLog> {
  const log: StandInLog = { answered: [], refused: [] }
  await context.route('**/*', async (route, request) => {
    const url = new URL(request.url())
    const local =
      url.protocol === 'data:' ||
      url.protocol === 'blob:' ||
      (url.protocol === 'http:' &&
        (url.hostname === '127.0.0.1' || url.hostname === 'localhost'))
    if (local) {
      await route.fallback()
      return
    }
    const line = `${request.method()} ${url.host}${url.pathname}`
    if (
      url.hostname === DEV_API &&
      (await answerApi(route, request, url, options))
    ) {
      log.answered.push(line)
      return
    }
    log.refused.push(line)
    if (url.hostname === DEV_API) await json(route, 404, { error: 'not found' })
    else await route.abort('internetdisconnected')
  })
  return log
}
