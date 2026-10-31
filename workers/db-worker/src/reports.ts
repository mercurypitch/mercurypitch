// ============================================================
// Reports — a singer flags what another posted; the owner answers
// ============================================================
//
// `POST /api/reports` takes a report (report-rules.ts says what one may say)
// from a registered singer about another singer, their profile, or a public
// shared melody or result. The first open report on a target mails the
// owner, on the billing alert's pattern, so a report is answered within a
// day: the store guidelines ask for a timely answer, and a report nobody
// reads is not one.
//
// The owner answers through the moderation routes, admin only and curl-first
// like the suspension route beside them:
//
//   GET    /api/admin/reports?status=open                 newest first
//   POST   /api/admin/reports/<id>                        {"status":"actioned"}
//   DELETE /api/admin/shares/<melody|session>/<id>        take a share down
//   GET    /api/admin/name-audit?kind=profiles&after=<id> the one-off audit
//
// Resolving a report resolves every open report on the same target: the
// answer is about the content, not about who flagged it, and a takedown
// resolves them as actioned. The name audit is the one pass over rows written
// before the name filter. It lists them for the owner; it rewrites nobody's
// name behind their back.

import type { AdminResolution } from './access'
import type { AuthUser, Env } from './auth'
import { sendOwnerAlert } from './email'
import { hasFilteredWord } from './name-filter'
import type { FieldProblem } from './public-text'
import { publicTextProblems } from './public-text'
import { isRegistered } from './registered'
import type { ReportBody, ReportKind } from './report-rules'
import { parseReportBody, readTargetId } from './report-rules'

type Respond = (body: object | null, init?: ResponseInit) => Response

const ACCOUNT_REQUIRED = 'Create an account to report a singer'

const REPORT_STATUSES = ['open', 'actioned', 'dismissed'] as const
type ReportStatus = (typeof REPORT_STATUSES)[number]

const LIST_LIMIT = 100
const LIST_LIMIT_MAX = 500
const AUDIT_PAGE = 200

/** Who stands behind a target, for a target a singer may see. */
const SINGER_BEHIND: Readonly<Record<ReportKind, string>> = {
  user: 'SELECT id AS userId FROM users WHERE id = ?',
  profile: 'SELECT id AS userId FROM users WHERE id = ?',
  melody: 'SELECT userId FROM sharedMelodies WHERE id = ? AND isPublic = 1',
  session: 'SELECT userId FROM sharedSessions WHERE id = ? AND isPublic = 1',
}

const KIND_WORDS: Readonly<Record<ReportKind, string>> = {
  user: 'a singer',
  profile: 'a profile',
  melody: 'a shared melody',
  session: 'a shared result',
}

// The singer's current name and, for a share, its title: what the owner
// reads to judge a report without opening anything.
const SUMMARY_COLUMNS = `
  COALESCE(NULLIF(p.displayName, ''), 'Singer-' || substr(r.targetUserId, 1, 6)) AS targetSinger,
  CASE r.targetKind
    WHEN 'melody' THEN (SELECT melodyName FROM sharedMelodies WHERE id = r.targetId)
    WHEN 'session' THEN (SELECT sessionName FROM sharedSessions WHERE id = r.targetId)
    ELSE NULL
  END AS targetTitle,
  (SELECT COUNT(*) FROM contentReports o
    WHERE o.targetKind = r.targetKind AND o.targetId = r.targetId
      AND o.status = 'open') AS openOnTarget`

interface ReportSummary {
  targetSinger: string
  targetTitle: string | null
  openOnTarget: number
  firstOpen: string | null
}

async function reportedSinger(
  db: D1Database,
  report: ReportBody,
): Promise<string | null> {
  const row = await db
    .prepare(SINGER_BEHIND[report.targetKind])
    .bind(report.targetId)
    .first<{ userId: string }>()
  return row?.userId ?? null
}

/**
 * The owner hears of the first open report on a target, not of every one.
 * "First" is the earliest open report, read after this one is written, so of
 * two singers reporting at once exactly one mails, whichever wrote first.
 */
async function tellOwner(
  env: Env,
  id: string,
  report: ReportBody,
): Promise<void> {
  const summary = await env.DB.prepare(
    `SELECT ${SUMMARY_COLUMNS},
            (SELECT f.id FROM contentReports f
              WHERE f.targetKind = r.targetKind AND f.targetId = r.targetId
                AND f.status = 'open'
              ORDER BY f.createdAt, f.id
              LIMIT 1) AS firstOpen
     FROM contentReports r
     LEFT JOIN userProfiles p ON p.id = r.targetUserId
     WHERE r.id = ?`,
  )
    .bind(id)
    .first<ReportSummary>()
  if (summary === null || summary.firstOpen !== id) return
  const what =
    summary.targetTitle === null
      ? summary.targetSinger
      : `"${summary.targetTitle}" by ${summary.targetSinger}`
  await sendOwnerAlert(
    { apiKey: env.RESEND_API_KEY, from: env.EMAIL_FROM },
    env.BILLING_ALERT_EMAIL ?? '',
    'report',
    `${KIND_WORDS[report.targetKind]}, ${report.reason}`,
    [
      `A singer reported ${KIND_WORDS[report.targetKind]}: ${report.reason}.`,
      `What: ${what}`,
      `Target: ${report.targetKind} ${report.targetId}`,
      `Note: ${report.note ?? '(none)'}`,
      '',
      `Answer it: POST /api/admin/reports/${id} {"status":"actioned"} or {"status":"dismissed"}`,
      'Every open report: GET /api/admin/reports',
    ],
  ).catch(() => false)
}

/**
 * `POST /api/reports`. The router applies the rate limit, and hands over
 * `defer` (the request's waitUntil) so the owner's mail does not hold the
 * singer's answer; without one, the mail is awaited.
 */
export async function handleReport(
  request: Request,
  auth: AuthUser | null,
  env: Env,
  respond: Respond,
  defer?: (work: Promise<unknown>) => void,
): Promise<Response> {
  if (request.method !== 'POST') {
    return respond({ error: 'Method not allowed' }, { status: 405 })
  }
  if (!auth) return respond({ error: 'Unauthorized' }, { status: 401 })
  if (!(await isRegistered(auth.userId, env))) {
    return respond({ error: ACCOUNT_REQUIRED }, { status: 403 })
  }
  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return respond({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const report = parseReportBody(raw)
  if ('error' in report) return respond(report, { status: 400 })

  const targetUserId = await reportedSinger(env.DB, report)
  if (targetUserId === null) {
    return respond({ error: 'Nothing to report there' }, { status: 404 })
  }
  if (targetUserId === auth.userId) {
    return respond({ error: 'You can’t report yourself' }, { status: 400 })
  }

  const id = crypto.randomUUID()
  // A second report on the same target while the first is open changes
  // nothing (the partial unique index), and says so without an error: the
  // singer's report is already with the owner.
  const result = await env.DB.prepare(
    `INSERT OR IGNORE INTO contentReports
       (id, createdAt, reporterId, targetUserId, targetKind, targetId, reason, note)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      new Date().toISOString(),
      auth.userId,
      targetUserId,
      report.targetKind,
      report.targetId,
      report.reason,
      report.note,
    )
    .run()
  if (result.meta.changes === 0) return respond({ status: 'open' })
  const mail = tellOwner(env, id, report).catch(() => undefined)
  if (defer === undefined) await mail
  else defer(mail)
  return respond({ id, status: 'open' }, { status: 201 })
}

// ── The owner's side ─────────────────────────────────────────────────

function oneOf<T extends string>(
  list: readonly T[],
  value: unknown,
): value is T {
  return (
    typeof value === 'string' && (list as readonly string[]).includes(value)
  )
}

function segment(raw: string | undefined): string | null {
  if (raw === undefined) return null
  try {
    return readTargetId(decodeURIComponent(raw))
  } catch {
    return null
  }
}

async function listReports(
  url: URL,
  env: Env,
  respond: Respond,
): Promise<Response> {
  const status = url.searchParams.get('status') ?? 'open'
  if (!oneOf(REPORT_STATUSES, status)) {
    return respond({ error: 'Unknown status' }, { status: 400 })
  }
  const asked = Number(url.searchParams.get('limit'))
  const limit =
    Number.isInteger(asked) && asked > 0
      ? Math.min(asked, LIST_LIMIT_MAX)
      : LIST_LIMIT
  const { results } = await env.DB.prepare(
    `SELECT r.id, r.createdAt, r.reporterId, r.targetUserId, r.targetKind,
            r.targetId, r.reason, r.note, r.status, r.resolvedAt, r.resolvedBy,
            ${SUMMARY_COLUMNS}
     FROM contentReports r
     LEFT JOIN userProfiles p ON p.id = r.targetUserId
     WHERE r.status = ?
     ORDER BY r.createdAt DESC
     LIMIT ?`,
  )
    .bind(status, limit)
    .all()
  return respond({ reports: results ?? [] })
}

async function resolveReport(
  id: string,
  request: Request,
  by: string | null,
  env: Env,
  respond: Respond,
): Promise<Response> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return respond({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const status =
    typeof body === 'object' && body !== null
      ? (body as { status?: unknown }).status
      : undefined
  if (status !== 'actioned' && status !== 'dismissed') {
    return respond(
      { error: 'status must be actioned or dismissed' },
      { status: 400 },
    )
  }
  const report = await env.DB.prepare(
    'SELECT targetKind, targetId FROM contentReports WHERE id = ?',
  )
    .bind(id)
    .first<{ targetKind: string; targetId: string }>()
  if (report === null) {
    return respond({ error: 'No such report' }, { status: 404 })
  }
  const result = await env.DB.prepare(
    `UPDATE contentReports SET status = ?, resolvedAt = ?, resolvedBy = ?
     WHERE id = ? OR (targetKind = ? AND targetId = ? AND status = 'open')`,
  )
    .bind(
      status satisfies ReportStatus,
      new Date().toISOString(),
      by,
      id,
      report.targetKind,
      report.targetId,
    )
    .run()
  return respond({ status, resolved: result.meta.changes })
}

const SHARE_TABLES: Readonly<Record<string, string>> = {
  melody: 'sharedMelodies',
  session: 'sharedSessions',
}

async function takeDown(
  kind: string,
  id: string,
  by: string | null,
  env: Env,
  respond: Respond,
): Promise<Response> {
  const table = Object.hasOwn(SHARE_TABLES, kind)
    ? SHARE_TABLES[kind]
    : undefined
  if (table === undefined) {
    return respond({ error: 'Unknown share kind' }, { status: 400 })
  }
  const share = await env.DB.prepare(`SELECT id FROM "${table}" WHERE id = ?`)
    .bind(id)
    .first<{ id: string }>()
  if (share === null)
    return respond({ error: 'No such share' }, { status: 404 })
  const [, resolved] = await env.DB.batch([
    env.DB.prepare(`DELETE FROM "${table}" WHERE id = ?`).bind(id),
    env.DB.prepare(
      `UPDATE contentReports SET status = 'actioned', resolvedAt = ?, resolvedBy = ?
       WHERE targetKind = ? AND targetId = ? AND status = 'open'`,
    ).bind(new Date().toISOString(), by, kind, id),
  ])
  return respond({ removed: true, resolved: resolved?.meta.changes ?? 0 })
}

interface AuditKind {
  entity: string
  select: string
}

const AUDITS: Readonly<Record<string, AuditKind>> = {
  profiles: {
    entity: 'userProfiles',
    select:
      'SELECT id, id AS userId, displayName, bio, avatarUrl FROM userProfiles',
  },
  melodies: {
    entity: 'sharedMelodies',
    select:
      'SELECT id, userId, melodyName, author, tags, itemsJson FROM sharedMelodies',
  },
  sessions: {
    entity: 'sharedSessions',
    select: 'SELECT id, userId, sessionName, author FROM sharedSessions',
  },
}

function auditRow(
  entity: string,
  row: Record<string, unknown>,
): FieldProblem[] {
  const problems = publicTextProblems(entity, row)
  const author = row.author
  if (typeof author === 'string' && hasFilteredWord(author)) {
    problems.push({ field: 'author', problem: 'words' })
  }
  return problems
}

async function nameAudit(
  url: URL,
  env: Env,
  respond: Respond,
): Promise<Response> {
  const kind = url.searchParams.get('kind') ?? 'profiles'
  const audit = Object.hasOwn(AUDITS, kind) ? AUDITS[kind] : undefined
  if (audit === undefined) {
    return respond(
      { error: `kind must be one of ${Object.keys(AUDITS).join(', ')}` },
      { status: 400 },
    )
  }
  const after = url.searchParams.get('after') ?? ''
  const { results } = await env.DB.prepare(
    `${audit.select} WHERE id > ? ORDER BY id LIMIT ?`,
  )
    .bind(after, AUDIT_PAGE)
    .all<Record<string, unknown>>()
  const rows = results ?? []
  const hits = rows.flatMap((row) =>
    auditRow(audit.entity, row).map(({ field, problem }) => ({
      id: row.id,
      userId: row.userId,
      field,
      problem,
      text:
        field === 'itemsJson'
          ? '(the lyrics)'
          : String(row[field] ?? '').slice(0, 200),
    })),
  )
  const last = rows.at(-1)
  return respond({
    kind,
    scanned: rows.length,
    hits,
    next: rows.length === AUDIT_PAGE && last ? last.id : null,
  })
}

type AdminRoute =
  | { route: 'list' }
  | { route: 'resolve'; id: string | null }
  | { route: 'takedown'; kind: string; id: string | null }
  | { route: 'audit' }
  | { route: 'method' }

function adminRoute(pathname: string, method: string): AdminRoute | null {
  if (pathname === '/api/admin/reports') {
    return method === 'GET' ? { route: 'list' } : { route: 'method' }
  }
  if (pathname === '/api/admin/name-audit') {
    return method === 'GET' ? { route: 'audit' } : { route: 'method' }
  }
  const report = /^\/api\/admin\/reports\/([^/]+)$/u.exec(pathname)
  if (report !== null) {
    return method === 'POST'
      ? { route: 'resolve', id: segment(report[1]) }
      : { route: 'method' }
  }
  const share = /^\/api\/admin\/shares\/([a-z]+)\/([^/]+)$/u.exec(pathname)
  if (share !== null) {
    return method === 'DELETE'
      ? { route: 'takedown', kind: share[1], id: segment(share[2]) }
      : { route: 'method' }
  }
  return null
}

/** The moderation console's routes. Null when the path is none of them. */
export async function handleModerationAdmin(
  request: Request,
  url: URL,
  env: Env,
  respond: Respond,
  admin: () => Promise<AdminResolution>,
): Promise<Response | null> {
  const route = adminRoute(url.pathname, request.method)
  if (route === null) return null
  if (route.route === 'method') {
    return respond({ error: 'Method not allowed' }, { status: 405 })
  }
  const resolution = await admin()
  if (!resolution.authorized) {
    return respond({ error: 'Admin key required' }, { status: 403 })
  }
  const by = resolution.accessIdentity?.subject ?? null
  switch (route.route) {
    case 'list':
      return listReports(url, env, respond)
    case 'audit':
      return nameAudit(url, env, respond)
    case 'resolve':
      return route.id === null
        ? respond({ error: 'No such report' }, { status: 404 })
        : resolveReport(route.id, request, by, env, respond)
    case 'takedown':
      return route.id === null
        ? respond({ error: 'No such share' }, { status: 404 })
        : takeDown(route.kind, route.id, by, env, respond)
  }
}
