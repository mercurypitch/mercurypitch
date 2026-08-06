// ── Managed testing-account provisioning ───────────────────────────
// Development-only, service-to-service account lifecycle for Mission Control.
// The dedicated key is intentionally separate from the broad admin surface.

import { SUPPORTER_FEATURE_PERK_IDS } from '../../../src/lib/supporter-feature-catalog'
import type { Env } from './auth'
import { hashPassword, timingSafeEqual } from './auth'
import { PERK_IDS } from './perks'
import { assertManagedTestAccountActive, MANAGED_TEST_EMAIL_DOMAIN, type ManagedTestAccountState, } from './testing-account-state'

type Respond = (body: object | null, init?: ResponseInit) => Response

const BASE_PATH = '/api/admin/testing-accounts'
const ID_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_ACCOUNT_DAYS = 90
const CREDIT_ALLOWLIST = [0, 10, 25, 50, 100, 250, 500] as const
const KNOWN_PERKS = new Set<string>(PERK_IDS)

interface ManagedAccountRow extends ManagedTestAccountState {
  email: string
  displayName: string
}

interface ProvisionBody {
  campaignId?: unknown
  testerId?: unknown
  displayName?: unknown
  expiresAt?: unknown
  grants?: unknown
}

interface GrantInput {
  credits?: unknown
  supporter?: unknown
  perks?: unknown
}

interface RenewBody {
  expiresAt?: unknown
}

interface NormalizedGrants {
  credits: number
  supporter: boolean
  perks: string[]
}

interface NormalizedProvision {
  campaignId: string
  testerId: string
  displayName: string
  expiresAt: string
  grants: NormalizedGrants
}

function problem(respond: Respond, error: string, status = 400): Response {
  return respond({ error }, { status })
}

async function readJson(
  request: Request,
): Promise<Record<string, unknown> | null> {
  try {
    const value = await request.json<unknown>()
    return value !== null && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null
  } catch {
    return null
  }
}

function normalizeIdentifier(value: unknown, label: string): string {
  if (typeof value !== 'string' || !ID_RE.test(value)) {
    throw new Error(`${label} must be 1-160 safe identifier characters`)
  }
  return value
}

function normalizeDisplayName(value: unknown): string {
  if (typeof value !== 'string') throw new Error('displayName required')
  const normalized = value.trim().replace(/\s+/g, ' ')
  if (normalized.length < 1 || normalized.length > 80) {
    throw new Error('displayName must be 1-80 characters')
  }
  return normalized
}

function normalizeExpiry(value: unknown, nowMs = Date.now()): string {
  if (typeof value !== 'string') throw new Error('expiresAt required')
  const parsed = Date.parse(value)
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== value) {
    throw new Error('expiresAt must be an ISO timestamp')
  }
  if (parsed <= nowMs) throw new Error('expiresAt must be in the future')
  if (parsed > nowMs + MAX_ACCOUNT_DAYS * 24 * 60 * 60 * 1000) {
    throw new Error(`expiresAt cannot exceed ${MAX_ACCOUNT_DAYS} days`)
  }
  return value
}

function normalizeCredits(value: unknown): number {
  if (
    typeof value !== 'number' ||
    !(CREDIT_ALLOWLIST as readonly number[]).includes(value)
  ) {
    throw new Error(`credits must be one of ${CREDIT_ALLOWLIST.join(', ')}`)
  }
  return value
}

function normalizePerks(value: unknown): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new Error('perks must be an array of known perk ids')
  }
  const unique = [...new Set(value as string[])]
  if (unique.some((perk) => !KNOWN_PERKS.has(perk))) {
    throw new Error('perks contains an unknown perk id')
  }
  return unique.sort()
}

function normalizeGrants(
  value: unknown,
  fallback: NormalizedGrants = { credits: 0, supporter: false, perks: [] },
): NormalizedGrants {
  if (value === undefined) return fallback
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('grants must be an object')
  }
  const grants = value as GrantInput
  const supporter = grants.supporter ?? fallback.supporter
  if (typeof supporter !== 'boolean') {
    throw new Error('supporter must be true or false')
  }
  return {
    credits:
      grants.credits === undefined
        ? fallback.credits
        : normalizeCredits(grants.credits),
    supporter,
    perks:
      grants.perks === undefined
        ? fallback.perks
        : normalizePerks(grants.perks),
  }
}

function normalizeProvision(body: ProvisionBody): NormalizedProvision {
  return {
    campaignId: normalizeIdentifier(body.campaignId, 'campaignId'),
    testerId: normalizeIdentifier(body.testerId, 'testerId'),
    displayName: normalizeDisplayName(body.displayName),
    expiresAt: normalizeExpiry(body.expiresAt),
    grants: normalizeGrants(body.grants),
  }
}

function parseStoredPerks(value: string): string[] {
  try {
    return normalizePerks(JSON.parse(value))
  } catch {
    return []
  }
}

function statusFor(
  account: ManagedTestAccountState,
  nowMs = Date.now(),
): string {
  if (account.revokedAt !== null) return 'revoked'
  return Date.parse(account.expiresAt) <= nowMs ? 'expired' : 'active'
}

function publicAccount(account: ManagedAccountRow): object {
  return {
    campaignId: account.campaignId,
    createdAt: account.createdAt,
    displayName: account.displayName,
    email: account.email,
    expiresAt: account.expiresAt,
    grants: {
      credits: account.creditAllowance,
      features:
        account.supporterEnabled === 1 ? SUPPORTER_FEATURE_PERK_IDS : [],
      perks: parseStoredPerks(account.perksJson),
      supporter: account.supporterEnabled === 1,
    },
    grantRevision: account.grantRevision,
    revokedAt: account.revokedAt,
    status: statusFor(account),
    testerId: account.testerId,
    updatedAt: account.updatedAt,
    userId: account.userId,
  }
}

async function accountByPair(
  db: D1Database,
  campaignId: string,
  testerId: string,
): Promise<ManagedAccountRow | null> {
  return db
    .prepare(
      `SELECT m.*, u.email, p.displayName
         FROM managedTestAccounts m
         JOIN users u ON u.id = m.userId
         JOIN userProfiles p ON p.id = m.userId
        WHERE m.campaignId = ?1 AND m.testerId = ?2
        LIMIT 1`,
    )
    .bind(campaignId, testerId)
    .first<ManagedAccountRow>()
}

async function accountByUserId(
  db: D1Database,
  userId: string,
): Promise<ManagedAccountRow | null> {
  return db
    .prepare(
      `SELECT m.*, u.email, p.displayName
         FROM managedTestAccounts m
         JOIN users u ON u.id = m.userId
         JOIN userProfiles p ON p.id = m.userId
        WHERE m.userId = ?1
        LIMIT 1`,
    )
    .bind(userId)
    .first<ManagedAccountRow>()
}

async function syntheticEmail(
  campaignId: string,
  testerId: string,
): Promise<string> {
  const data = new TextEncoder().encode(`${campaignId}\0${testerId}`)
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', data))
  const key = [...digest]
    .slice(0, 12)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
  return `mc-test-${key}@${MANAGED_TEST_EMAIL_DOMAIN}`
}

function randomPassword(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(18))
  const token = [...bytes]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
  return `Mp7-${token}`
}

function entitlementStatement(
  env: Env,
  userId: string,
  source: string,
  expiresAt: string,
  now: string,
): D1PreparedStatement {
  return env.DB.prepare(
    `INSERT INTO entitlements
       (id, createdAt, updatedAt, userId, feature, source, expiresAt)
     VALUES (?1, ?2, ?2, ?3, 'supporter', ?4, ?5)
     ON CONFLICT(userId, feature) DO UPDATE SET
       updatedAt = excluded.updatedAt,
       source = excluded.source,
       expiresAt = excluded.expiresAt`,
  ).bind(crypto.randomUUID(), now, userId, source, expiresAt)
}

function perkStatements(
  env: Env,
  userId: string,
  perks: string[],
  now: string,
  expiresAt: string,
): D1PreparedStatement[] {
  return perks.map((perk) =>
    env.DB.prepare(
      `INSERT INTO managedTestAccountPerks
         (userId, perkId, grantedAt, expiresAt)
       VALUES (?1, ?2, ?3, ?4)`,
    ).bind(userId, perk, now, expiresAt),
  )
}

async function provision(
  request: Request,
  env: Env,
  respond: Respond,
): Promise<Response> {
  const body = await readJson(request)
  if (body === null) return problem(respond, 'Invalid JSON body')

  let input: NormalizedProvision
  try {
    input = normalizeProvision(body)
  } catch (error) {
    return problem(
      respond,
      error instanceof Error ? error.message : String(error),
    )
  }

  const existing = await accountByPair(env.DB, input.campaignId, input.testerId)
  if (existing !== null) return respond({ account: publicAccount(existing) })

  const now = new Date().toISOString()
  const userId = crypto.randomUUID()
  const email = await syntheticEmail(input.campaignId, input.testerId)
  const password = randomPassword()
  const passwordHash = await hashPassword(password)
  const source = `testing:${input.campaignId}:${input.testerId}`
  const statements: D1PreparedStatement[] = [
    env.DB.prepare(
      `INSERT INTO users
         (id, createdAt, updatedAt, authProvider, providerId, email,
          emailVerified, passwordHash, lastLoginAt, lastActiveAt, tokenVersion,
          stripeCustomerId)
       VALUES (?1, ?2, ?2, 'password', NULL, ?3, 1, ?4, NULL, NULL, 1, NULL)`,
    ).bind(userId, now, email, passwordHash),
    env.DB.prepare(
      `INSERT INTO userProfiles
         (id, createdAt, updatedAt, displayName, avatarUrl, joinDate,
          lastPracticeDate, currentStreak)
       VALUES (?1, ?2, ?2, ?3, NULL, ?2, NULL, 0)`,
    ).bind(userId, now, input.displayName),
    env.DB.prepare(
      `INSERT INTO managedTestAccounts
         (userId, campaignId, testerId, createdAt, updatedAt, expiresAt,
          revokedAt, creditAllowance, supporterEnabled, perksJson,
          grantRevision)
       VALUES (?1, ?2, ?3, ?4, ?4, ?5, NULL, ?6, ?7, ?8, 1)`,
    ).bind(
      userId,
      input.campaignId,
      input.testerId,
      now,
      input.expiresAt,
      input.grants.credits,
      input.grants.supporter ? 1 : 0,
      JSON.stringify(input.grants.perks),
    ),
  ]

  if (input.grants.credits > 0) {
    statements.push(
      env.DB.prepare(
        `INSERT INTO creditLedger
           (id, createdAt, userId, delta, reason, jobRef, idempotencyKey)
         VALUES (?1, ?2, ?3, ?4, 'Managed testing allowance', NULL, ?5)`,
      ).bind(
        crypto.randomUUID(),
        now,
        userId,
        input.grants.credits,
        `${source}:grant:1`,
      ),
    )
  }
  if (input.grants.supporter) {
    statements.push(
      entitlementStatement(env, userId, source, input.expiresAt, now),
    )
  }
  statements.push(
    ...perkStatements(env, userId, input.grants.perks, now, input.expiresAt),
  )

  try {
    await env.DB.batch(statements)
  } catch (error) {
    // A concurrent identical request may win the unique campaign/tester or
    // synthetic-email constraint. Resolve that race as the same idempotent
    // response; propagate unrelated storage errors to the Worker boundary.
    const raced = await accountByPair(env.DB, input.campaignId, input.testerId)
    if (raced !== null) return respond({ account: publicAccount(raced) })
    throw error
  }

  const created = await accountByUserId(env.DB, userId)
  if (created === null) throw new Error('Provisioned testing account missing')
  return respond(
    {
      account: publicAccount(created),
      credentials: { email, password },
    },
    { status: 201 },
  )
}

async function inspect(
  url: URL,
  env: Env,
  respond: Respond,
): Promise<Response> {
  let campaignId: string
  let testerId: string
  try {
    campaignId = normalizeIdentifier(
      url.searchParams.get('campaignId'),
      'campaignId',
    )
    testerId = normalizeIdentifier(url.searchParams.get('testerId'), 'testerId')
  } catch (error) {
    return problem(
      respond,
      error instanceof Error ? error.message : String(error),
    )
  }
  const account = await accountByPair(env.DB, campaignId, testerId)
  if (account === null)
    return problem(respond, 'Testing account not found', 404)
  return respond({ account: publicAccount(account) })
}

async function updateGrants(
  request: Request,
  env: Env,
  userId: string,
  respond: Respond,
): Promise<Response> {
  const account = await accountByUserId(env.DB, userId)
  if (account === null)
    return problem(respond, 'Testing account not found', 404)
  assertManagedTestAccountActive(account)
  const body = await readJson(request)
  if (body === null) return problem(respond, 'Invalid JSON body')

  const current: NormalizedGrants = {
    credits: account.creditAllowance,
    supporter: account.supporterEnabled === 1,
    perks: parseStoredPerks(account.perksJson),
  }
  let desired: NormalizedGrants
  try {
    desired = normalizeGrants(body, current)
  } catch (error) {
    return problem(
      respond,
      error instanceof Error ? error.message : String(error),
    )
  }
  if (desired.credits < current.credits) {
    return problem(
      respond,
      'credits cannot be reduced; revoke the account to end access',
    )
  }
  if (
    desired.credits === current.credits &&
    desired.supporter === current.supporter &&
    JSON.stringify(desired.perks) === JSON.stringify(current.perks)
  ) {
    return respond({ account: publicAccount(account) })
  }

  const now = new Date().toISOString()
  const revision = account.grantRevision + 1
  const source = `testing:${account.campaignId}:${account.testerId}`
  const statements: D1PreparedStatement[] = [
    env.DB.prepare(
      `UPDATE managedTestAccounts
          SET updatedAt = ?1, creditAllowance = ?2, supporterEnabled = ?3,
              perksJson = ?4, grantRevision = ?5
        WHERE userId = ?6`,
    ).bind(
      now,
      desired.credits,
      desired.supporter ? 1 : 0,
      JSON.stringify(desired.perks),
      revision,
      userId,
    ),
    env.DB.prepare(
      'DELETE FROM managedTestAccountPerks WHERE userId = ?1',
    ).bind(userId),
  ]
  const delta = desired.credits - current.credits
  if (delta > 0) {
    statements.push(
      env.DB.prepare(
        `INSERT OR IGNORE INTO creditLedger
           (id, createdAt, userId, delta, reason, jobRef, idempotencyKey)
         VALUES (?1, ?2, ?3, ?4, 'Managed testing allowance', NULL, ?5)`,
      ).bind(
        crypto.randomUUID(),
        now,
        userId,
        delta,
        `${source}:grant:${revision}`,
      ),
    )
  }
  if (desired.supporter) {
    statements.push(
      entitlementStatement(env, userId, source, account.expiresAt, now),
    )
  } else {
    statements.push(
      env.DB.prepare(
        `DELETE FROM entitlements
          WHERE userId = ?1 AND feature = 'supporter' AND source = ?2`,
      ).bind(userId, source),
    )
  }
  statements.push(
    ...perkStatements(env, userId, desired.perks, now, account.expiresAt),
  )
  await env.DB.batch(statements)

  const updated = await accountByUserId(env.DB, userId)
  if (updated === null) throw new Error('Updated testing account missing')
  return respond({ account: publicAccount(updated) })
}

async function rotatePassword(
  env: Env,
  userId: string,
  respond: Respond,
): Promise<Response> {
  const account = await accountByUserId(env.DB, userId)
  if (account === null)
    return problem(respond, 'Testing account not found', 404)
  assertManagedTestAccountActive(account)
  const password = randomPassword()
  const passwordHash = await hashPassword(password)
  const now = new Date().toISOString()
  await env.DB.batch([
    env.DB.prepare(
      `UPDATE users
          SET passwordHash = ?1, tokenVersion = tokenVersion + 1,
              updatedAt = ?2
        WHERE id = ?3`,
    ).bind(passwordHash, now, userId),
    env.DB.prepare(
      'UPDATE managedTestAccounts SET updatedAt = ?1 WHERE userId = ?2',
    ).bind(now, userId),
  ])
  const updated = await accountByUserId(env.DB, userId)
  if (updated === null) throw new Error('Rotated testing account missing')
  return respond({
    account: publicAccount(updated),
    credentials: { email: updated.email, password },
  })
}

async function renew(
  request: Request,
  env: Env,
  userId: string,
  respond: Respond,
): Promise<Response> {
  const account = await accountByUserId(env.DB, userId)
  if (account === null)
    return problem(respond, 'Testing account not found', 404)
  if (account.revokedAt !== null) {
    return problem(respond, 'Revoked testing accounts cannot be renewed', 409)
  }
  const body = await readJson(request)
  if (body === null) return problem(respond, 'Invalid JSON body')

  let expiresAt: string
  try {
    expiresAt = normalizeExpiry((body as RenewBody).expiresAt)
  } catch (error) {
    return problem(
      respond,
      error instanceof Error ? error.message : String(error),
    )
  }

  const now = new Date().toISOString()
  const source = `testing:${account.campaignId}:${account.testerId}`
  const statements: D1PreparedStatement[] = [
    env.DB.prepare(
      `UPDATE managedTestAccounts
          SET expiresAt = ?1, updatedAt = ?2
        WHERE userId = ?3 AND revokedAt IS NULL`,
    ).bind(expiresAt, now, userId),
    env.DB.prepare(
      `UPDATE users
          SET tokenVersion = tokenVersion + 1, updatedAt = ?1
        WHERE id = ?2`,
    ).bind(now, userId),
    env.DB.prepare(
      'UPDATE managedTestAccountPerks SET expiresAt = ?1 WHERE userId = ?2',
    ).bind(expiresAt, userId),
  ]
  if (account.supporterEnabled === 1) {
    statements.push(entitlementStatement(env, userId, source, expiresAt, now))
  }
  await env.DB.batch(statements)

  const updated = await accountByUserId(env.DB, userId)
  if (updated === null) throw new Error('Renewed testing account missing')
  return respond({ account: publicAccount(updated) })
}

async function revoke(
  env: Env,
  userId: string,
  respond: Respond,
): Promise<Response> {
  const account = await accountByUserId(env.DB, userId)
  if (account === null)
    return problem(respond, 'Testing account not found', 404)
  if (account.revokedAt === null) {
    const now = new Date().toISOString()
    const source = `testing:${account.campaignId}:${account.testerId}`
    await env.DB.batch([
      env.DB.prepare(
        `UPDATE managedTestAccounts
            SET revokedAt = ?1, updatedAt = ?1
          WHERE userId = ?2 AND revokedAt IS NULL`,
      ).bind(now, userId),
      env.DB.prepare(
        `UPDATE users
            SET tokenVersion = tokenVersion + 1, updatedAt = ?1
          WHERE id = ?2`,
      ).bind(now, userId),
      env.DB.prepare(
        `UPDATE entitlements SET expiresAt = ?1, updatedAt = ?1
          WHERE userId = ?2 AND source = ?3`,
      ).bind(now, userId, source),
      env.DB.prepare(
        `UPDATE managedTestAccountPerks SET expiresAt = ?1 WHERE userId = ?2`,
      ).bind(now, userId),
    ])
  }
  const updated = await accountByUserId(env.DB, userId)
  if (updated === null) throw new Error('Revoked testing account missing')
  return respond({ account: publicAccount(updated) })
}

/** Route managed testing-account operations; null means this is another path. */
export async function handleTestingAccountRequest(
  request: Request,
  env: Env,
  url: URL,
  respond: Respond,
): Promise<Response | null> {
  if (url.pathname !== BASE_PATH && !url.pathname.startsWith(`${BASE_PATH}/`)) {
    return null
  }
  if (env.ALLOW_TEST_ACCOUNT_PROVISIONING !== '1') {
    return problem(respond, 'Not found', 404)
  }
  const suppliedKey = request.headers.get('X-Testing-Provision-Key')
  if (
    env.TESTING_PROVISION_KEY === undefined ||
    env.TESTING_PROVISION_KEY.length < 32 ||
    suppliedKey === null ||
    !timingSafeEqual(suppliedKey, env.TESTING_PROVISION_KEY)
  ) {
    return problem(respond, 'Unauthorized', 401)
  }

  if (url.pathname === BASE_PATH) {
    if (request.method === 'POST') return provision(request, env, respond)
    if (request.method === 'GET') return inspect(url, env, respond)
    return problem(respond, 'Method not allowed', 405)
  }
  if (
    url.pathname === `${BASE_PATH}/capabilities` &&
    request.method === 'GET'
  ) {
    return respond({ capabilities: MANAGED_TEST_ACCOUNT_CAPABILITIES })
  }

  const match = url.pathname.match(
    /^\/api\/admin\/testing-accounts\/([^/]+)\/(grants|renew|rotate-password|revoke)$/,
  )
  if (match === null) return problem(respond, 'Not found', 404)
  let userId: string
  try {
    userId = decodeURIComponent(match[1])
  } catch {
    return problem(respond, 'Testing account not found', 404)
  }
  if (!UUID_RE.test(userId))
    return problem(respond, 'Testing account not found', 404)
  if (match[2] === 'grants' && request.method === 'PATCH') {
    return updateGrants(request, env, userId, respond)
  }
  if (match[2] === 'renew' && request.method === 'POST') {
    return renew(request, env, userId, respond)
  }
  if (match[2] === 'rotate-password' && request.method === 'POST') {
    return rotatePassword(env, userId, respond)
  }
  if (match[2] === 'revoke' && request.method === 'POST') {
    return revoke(env, userId, respond)
  }
  return problem(respond, 'Method not allowed', 405)
}

/** Used by tests and Mission Control to render controls from one allowlist. */
export const MANAGED_TEST_ACCOUNT_CAPABILITIES = {
  credits: CREDIT_ALLOWLIST,
  features: SUPPORTER_FEATURE_PERK_IDS,
  maxAccountDays: MAX_ACCOUNT_DAYS,
  perks: PERK_IDS,
} as const
