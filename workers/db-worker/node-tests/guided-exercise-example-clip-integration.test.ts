// @vitest-environment node
// ============================================================
// A guided exercise keeps the example clip it was written with
// ============================================================
// An exercise can carry its clip in its own spec: Mah Meh Mee Moh Moo plays a
// static file under /exercises/examples, with no managed upload behind it.
// The admin path used to derive the clip from the managed media id alone, so
// a spec without one lost its clip on create, on every save and on publish.
// The owner decided on 13 Oct 2026 that it stays until an admin replaces or
// removes it by hand. These run the real worker and SQL end to end.

import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getZenExercise } from '../../../src/features/zen/exercise-catalog'
import type { ZenExampleAudio, ZenExerciseDefinition, } from '../../../src/features/zen/types'
import type { Env } from '../src/auth'
import worker from '../src/index'
import { applyMigrations, SqliteD1Database } from './sqlite-d1'

const ADMIN_KEY = 'guided-example-clip-test-admin'
const EXERCISE_ID = 'mah-meh-mee-moh-moo'

let sqlite: DatabaseSync
let env: Env

beforeEach(() => {
  sqlite = new DatabaseSync(':memory:')
  sqlite.exec('PRAGMA foreign_keys = ON')
  applyMigrations(sqlite)
  env = {
    DB: new SqliteD1Database(sqlite) as unknown as D1Database,
    ALLOWED_ORIGINS: 'http://localhost',
    JWT_SECRET: 'guided-example-clip-test-jwt',
    ADMIN_KEY,
  }
})

afterEach(() => sqlite.close())

function seedExercise(): ZenExerciseDefinition {
  const seed = getZenExercise(EXERCISE_ID)
  if (seed === null) throw new Error(`${EXERCISE_ID} is not in the catalogue`)
  return structuredClone(seed)
}

function seedClip(): ZenExampleAudio {
  const clip = seedExercise().exampleAudio
  if (clip === undefined) throw new Error(`${EXERCISE_ID} has no clip`)
  return clip
}

function call(
  path: string,
  method: string,
  body?: Record<string, unknown>,
): Promise<Response> {
  return worker.fetch(
    new Request(`http://localhost${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Key': ADMIN_KEY,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
    env,
    {} as ExecutionContext,
  )
}

interface DraftBody {
  draft: {
    exercise: ZenExerciseDefinition
    draftRevision: number
    exampleMediaId: string | null
  }
}

async function json<T>(response: Response, status: number): Promise<T> {
  const body = (await response.json()) as T
  expect(response.status, JSON.stringify(body)).toBe(status)
  return body
}

async function publishedClip(): Promise<ZenExampleAudio | undefined> {
  const { exercises } = await json<{ exercises: ZenExerciseDefinition[] }>(
    await call('/api/guided-exercises', 'GET'),
    200,
  )
  return exercises.find((exercise) => exercise.id === EXERCISE_ID)?.exampleAudio
}

describe('a guided exercise with a clip of its own', () => {
  it('keeps the clip through create, save, publish and a new draft', async () => {
    const created = await json<DraftBody>(
      await call('/api/admin/guided-exercises', 'POST', {
        exercise: seedExercise(),
      }),
      201,
    )
    expect(created.draft.exampleMediaId).toBeNull()
    expect(created.draft.exercise.exampleAudio).toEqual(seedClip())

    // A save that sends no media id at all, the way the editor saves a
    // title change.
    const saved = await json<DraftBody>(
      await call(`/api/admin/guided-exercises/${EXERCISE_ID}/draft`, 'PATCH', {
        exercise: { ...created.draft.exercise, title: 'Mah to Moo' },
        expectedRevision: created.draft.draftRevision,
      }),
      200,
    )
    expect(saved.draft.exercise.exampleAudio).toEqual(seedClip())

    const published = await json<{ exercise: ZenExerciseDefinition }>(
      await call(`/api/admin/guided-exercises/${EXERCISE_ID}/publish`, 'POST', {
        expectedRevision: saved.draft.draftRevision,
      }),
      200,
    )
    expect(published.exercise.exampleAudio).toEqual(seedClip())
    expect(await publishedClip()).toEqual(seedClip())

    const next = await json<DraftBody>(
      await call(`/api/admin/guided-exercises/${EXERCISE_ID}/draft`, 'POST'),
      201,
    )
    expect(next.draft.exercise.exampleAudio).toEqual(seedClip())
  })

  it('lets an admin take the clip out by hand', async () => {
    const created = await json<DraftBody>(
      await call('/api/admin/guided-exercises', 'POST', {
        exercise: seedExercise(),
      }),
      201,
    )
    // The editor's Remove drops the clip from the exercise and clears the
    // media id; nothing puts it back.
    const { exampleAudio: _removed, ...withoutClip } = created.draft.exercise
    const saved = await json<DraftBody>(
      await call(`/api/admin/guided-exercises/${EXERCISE_ID}/draft`, 'PATCH', {
        exercise: withoutClip,
        exampleMediaId: null,
        expectedRevision: created.draft.draftRevision,
      }),
      200,
    )
    expect(saved.draft.exercise.exampleAudio).toBeUndefined()

    await json(
      await call(`/api/admin/guided-exercises/${EXERCISE_ID}/publish`, 'POST', {
        expectedRevision: saved.draft.draftRevision,
      }),
      200,
    )
    expect(await publishedClip()).toBeUndefined()
  })

  it('lets an admin replace the clip by hand', async () => {
    const created = await json<DraftBody>(
      await call('/api/admin/guided-exercises', 'POST', {
        exercise: seedExercise(),
      }),
      201,
    )
    const replacement: ZenExampleAudio = {
      ...seedClip(),
      src: '/exercises/examples/mah-meh-mee-moh-moo-slow.mp3',
      durationMs: 5200,
    }
    const saved = await json<DraftBody>(
      await call(`/api/admin/guided-exercises/${EXERCISE_ID}/draft`, 'PATCH', {
        exercise: { ...created.draft.exercise, exampleAudio: replacement },
        expectedRevision: created.draft.draftRevision,
      }),
      200,
    )
    expect(saved.draft.exercise.exampleAudio).toEqual(replacement)
  })
})
