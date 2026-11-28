// ============================================================
// HybridAdapter: a write a person pressed for
// ============================================================
//
// Unpublish, a survey's Send: a write a person pressed for goes to the
// server as their press, even while the API is out of reach
// (src/db/api-reachability.ts). The hybrid wrapper sits between the call
// site and the ServerAdapter, so it has to hand the press on, and to the
// identity a first write provisions too. A write the app makes by itself
// stays an ordinary call.

import { describe, expect, it, vi } from 'vitest'
import type { DatabaseAdapter, DbEntity, Repository } from '@/db/types'
import { HybridAdapter } from './hybrid-adapter'

/** Stands in for an adapter the test never writes to. */
function unusedAdapter(): DatabaseAdapter {
  const adapter: DatabaseAdapter = {
    schemaVersion: 1,
    getRepository: <T extends DbEntity>() => ({}) as Repository<T>,
    transaction: vi.fn(async (fn) => fn(adapter)),
    destroy: vi.fn(async () => undefined),
  }
  return adapter
}

/** A cloud repository that writes down how each write was asked for. */
function pressRecordingAdapter(): DatabaseAdapter & { writes: unknown[] } {
  const writes: unknown[] = []
  const entity = (id: string): DbEntity => ({
    id,
    createdAt: '',
    updatedAt: '',
  })
  const repo = {
    create: async (_entity: unknown, opts?: unknown) => {
      writes.push(['create', opts])
      return entity('new')
    },
    update: async (id: string, _patch: unknown, opts?: unknown) => {
      writes.push(['update', opts])
      return entity(id)
    },
    delete: async (_id: string, opts?: unknown) => {
      writes.push(['delete', opts])
    },
  } as unknown as Repository<DbEntity>
  const adapter: DatabaseAdapter & { writes: unknown[] } = {
    writes,
    schemaVersion: 1,
    getRepository: <T extends DbEntity>() => repo as Repository<T>,
    transaction: vi.fn(async (fn) => fn(adapter)),
    destroy: vi.fn(async () => undefined),
  }
  return adapter
}

describe('a write a person pressed for', () => {
  it('hands a press on with the write, and nothing else', async () => {
    const cloud = pressRecordingAdapter()
    const hybrid = new HybridAdapter(cloud, unusedAdapter(), () => true)
    const repo = hybrid.getRepository('userSurveyResponses')

    await repo.create({}, { userAction: true })
    await repo.update('x', {}, { userAction: true })
    await repo.delete('x', { userAction: true })
    await repo.update('y', {})

    expect(cloud.writes).toEqual([
      ['create', { userAction: true }],
      ['update', { userAction: true }],
      ['delete', { userAction: true }],
      ['update', undefined],
    ])
  })

  // Refused while the API is out of reach, the provisioning would end the
  // press as "signed out" before the write was ever sent.
  it('provisions as the press when a person pressed for the write', async () => {
    const asked: unknown[] = []
    const provisioning =
      (authed: { now: boolean }) =>
      async (options?: { userAction?: boolean }) => {
        asked.push(options)
        authed.now = true
        return true
      }
    const pressed = { now: false }
    const byItself = { now: false }
    const pressedRepo = new HybridAdapter(
      pressRecordingAdapter(),
      unusedAdapter(),
      () => pressed.now,
      provisioning(pressed),
    ).getRepository('userSurveyResponses')
    const byItselfRepo = new HybridAdapter(
      pressRecordingAdapter(),
      unusedAdapter(),
      () => byItself.now,
      provisioning(byItself),
    ).getRepository('userSurveyResponses')

    await pressedRepo.create({}, { userAction: true })
    await byItselfRepo.create({})

    expect(asked).toEqual([{ userAction: true }, { userAction: false }])
  })
})
