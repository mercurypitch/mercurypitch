// ============================================================
// Premium perk audit — immutable lifecycle and capability events
// ============================================================

import type { Env } from './auth'

const workerCrypto = Reflect.get(globalThis, 'crypto') as Crypto

export interface PremiumAuditEvent {
  action: string
  actorId?: string | null
  actorType: 'access' | 'admin-key' | 'system' | 'user'
  details?: Readonly<Record<string, unknown>>
  entityId: string
  entityType: string
}

export interface PremiumAdminAuditActor {
  actorId: string | null
  actorType: 'access' | 'admin-key'
}

export function premiumAuditStatement(
  env: Env,
  event: PremiumAuditEvent,
  createdAt = new Date().toISOString(),
): D1PreparedStatement {
  return env.DB.prepare(
    `INSERT INTO premiumPerkAudit
      (id, actorType, actorId, action, entityType, entityId, detailsJson, createdAt)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`,
  ).bind(
    workerCrypto.randomUUID(),
    event.actorType,
    event.actorId ?? null,
    event.action,
    event.entityType,
    event.entityId,
    JSON.stringify(event.details ?? {}),
    createdAt,
  )
}

/**
 * Audit a conditional mutation only when the immediately preceding statement
 * changed a row. Call this only as the next statement in the same D1 batch.
 */
export function premiumAuditAfterMutationStatement(
  env: Env,
  event: PremiumAuditEvent,
  createdAt = new Date().toISOString(),
): D1PreparedStatement {
  return env.DB.prepare(
    `INSERT INTO premiumPerkAudit
      (id, actorType, actorId, action, entityType, entityId, detailsJson, createdAt)
     SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8
      WHERE changes() = 1`,
  ).bind(
    workerCrypto.randomUUID(),
    event.actorType,
    event.actorId ?? null,
    event.action,
    event.entityType,
    event.entityId,
    JSON.stringify(event.details ?? {}),
    createdAt,
  )
}
