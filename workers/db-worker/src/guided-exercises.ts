// ── Guided Zen exercises, managed playback, and Ascent assignments ────────
//
// These routes deliberately bypass the generic CRUD table registry. Draft
// specifications are private, publishing is an explicit immutable transition,
// and public reads expose only validated published/superseded versions.

import type { ZenExampleAudio, ZenExerciseDefinition, } from '../../../src/features/zen/types'
import { parseZenExerciseStructure, parseZenExerciseVersion, } from '../../../src/features/zen/validate-exercise'
import type { Env } from './auth'

type JsonResponder = (body: object | null, init?: ResponseInit) => Response

export interface GuidedExerciseHandlerContext {
  admin: boolean
  corsHeaders: Readonly<Record<string, string>>
  respond: JsonResponder
}

interface GuidedExerciseRow {
  id: string
  createdAt: string
  updatedAt: string
  category: ZenExerciseDefinition['category']
  level: ZenExerciseDefinition['level']
  sortOrder: number
  status: 'active' | 'archived'
  publishedVersion: number | null
  archivedAt: string | null
}

interface GuidedExerciseVersionRow {
  exerciseId: string
  version: number
  schemaVersion: number
  locale: 'en-GB'
  lifecycle: 'draft' | 'published' | 'superseded'
  draftRevision: number
  specJson: string
  exampleMediaId: string | null
  contentHash: string | null
  createdAt: string
  updatedAt: string
  publishedAt: string | null
  supersededAt: string | null
}

interface GuidedExerciseMediaRow {
  id: string
  createdAt: string
  updatedAt: string
  status: 'uploading' | 'ready' | 'failed'
  locale: 'en-GB'
  source: ZenExampleAudio['source']
  transcript: string
  durationMs: number
  objectKey: string
  mimeType: string | null
  byteLength: number | null
  sha256: string | null
  etag: string | null
  readyAt: string | null
}

interface PathLessonAssignmentRow {
  id: string
  createdAt: string
  updatedAt: string
  pathId: string
  weekNumber: number
  dayNumber: number
  slotNumber: number
  exerciseId: string
  exerciseVersion: number
}

interface ValidationIssue {
  path: string
  message: string
}

interface ParsedDraft {
  exercise: ZenExerciseDefinition | null
  issues: ValidationIssue[]
  exampleMediaId: string | null
}

const EXERCISE_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const PATH_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const MAX_PLAYBACK_BYTES = 2 * 1024 * 1024
const STALE_UPLOAD_MAX_AGE_MS = 24 * 60 * 60 * 1000
const ORPHANED_READY_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000
const MEDIA_GC_BATCH_SIZE = 25
const MEDIA_REFERENCE_NOT_READY = 'GUIDED_MEDIA_NOT_READY'
const workerCrypto = (globalThis as typeof globalThis & { crypto: Crypto })
  .crypto
const ALLOWED_PLAYBACK_TYPES = new Set([
  'audio/mpeg',
  'audio/mp4',
  'audio/aac',
  'audio/x-m4a',
])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasOwn(value: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key)
}

function parseJsonObject(raw: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(raw) as unknown
    return isRecord(parsed) ? parsed : null
  } catch {
    return null
  }
}

async function readJsonObject(
  request: Request,
): Promise<Record<string, unknown> | null> {
  try {
    const value = (await request.json()) as unknown
    return isRecord(value) ? value : null
  } catch {
    return null
  }
}

function finiteInteger(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) ? value : null
}

function isMediaReferenceConflict(error: unknown): boolean {
  return String(error).includes(MEDIA_REFERENCE_NOT_READY)
}

function mediaReferenceConflict(respond: JsonResponder): Response {
  return respond(
    {
      error:
        'Managed playback changed before it could be attached. Upload or select it again.',
    },
    { status: 409 },
  )
}

function decodeVersion(row: GuidedExerciseVersionRow): {
  exercise: ZenExerciseDefinition | null
  issues: ValidationIssue[]
} {
  const parsed = parseJsonObject(row.specJson)
  if (parsed === null) {
    return {
      exercise: null,
      issues: [
        { path: '', message: 'Stored exercise specification is invalid JSON.' },
      ],
    }
  }
  return row.lifecycle === 'draft'
    ? parseZenExerciseStructure(parsed)
    : parseZenExerciseVersion(parsed, row.schemaVersion)
}

function mediaAudio(media: GuidedExerciseMediaRow): ZenExampleAudio {
  return {
    src: `/api/guided-media/${encodeURIComponent(media.id)}`,
    durationMs: media.durationMs,
    locale: media.locale,
    source: media.source,
    transcript: media.transcript,
  }
}

async function findMedia(
  env: Env,
  mediaId: string,
): Promise<GuidedExerciseMediaRow | null> {
  return env.DB.prepare(`SELECT * FROM guidedExerciseMedia WHERE id = ?`)
    .bind(mediaId)
    .first<GuidedExerciseMediaRow>()
}

async function parseDraftInput(
  env: Env,
  input: unknown,
  exerciseId: string,
  version: number,
  requestedMediaId: string | null,
): Promise<ParsedDraft> {
  if (!isRecord(input)) {
    return {
      exercise: null,
      issues: [{ path: '', message: 'Exercise must be a JSON object.' }],
      exampleMediaId: requestedMediaId,
    }
  }

  const candidate: Record<string, unknown> = {
    ...input,
    id: exerciseId,
    version,
  }

  if (requestedMediaId !== null) {
    const media = await findMedia(env, requestedMediaId)
    if (media === null) {
      return {
        exercise: null,
        issues: [
          {
            path: 'exampleMediaId',
            message: 'Managed playback was not found.',
          },
        ],
        exampleMediaId: requestedMediaId,
      }
    }
    if (media.status !== 'ready') {
      return {
        exercise: null,
        issues: [
          {
            path: 'exampleMediaId',
            message:
              'Managed playback must finish uploading before it can be attached.',
          },
        ],
        exampleMediaId: requestedMediaId,
      }
    }
    candidate.exampleAudio = mediaAudio(media)
  } else {
    delete candidate.exampleAudio
  }

  const parsed = parseZenExerciseStructure(candidate)
  return {
    exercise: parsed.exercise,
    issues: parsed.issues,
    exampleMediaId: requestedMediaId,
  }
}

function publicVersionAllowed(row: GuidedExerciseVersionRow): boolean {
  return row.lifecycle === 'published' || row.lifecycle === 'superseded'
}

function adminVersion(row: GuidedExerciseVersionRow): Record<string, unknown> {
  const parsed = decodeVersion(row)
  return {
    exerciseId: row.exerciseId,
    version: row.version,
    schemaVersion: row.schemaVersion,
    locale: row.locale,
    lifecycle: row.lifecycle,
    draftRevision: row.draftRevision,
    exampleMediaId: row.exampleMediaId,
    contentHash: row.contentHash,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    publishedAt: row.publishedAt,
    supersededAt: row.supersededAt,
    exercise: parsed.exercise,
    issues: parsed.issues,
  }
}

async function listPublished(
  env: Env,
  respond: JsonResponder,
): Promise<Response> {
  const { results } = await env.DB.prepare(
    `SELECT v.*
       FROM guidedExercises e
       JOIN guidedExerciseVersions v
         ON v.exerciseId = e.id AND v.version = e.publishedVersion
      WHERE e.status = 'active'
        AND v.lifecycle = 'published'
      ORDER BY e.sortOrder ASC, e.id ASC`,
  ).all<GuidedExerciseVersionRow>()

  const exercises: ZenExerciseDefinition[] = []
  for (const row of results ?? []) {
    const parsed = decodeVersion(row)
    if (parsed.exercise === null) {
      console.error('[guided-exercises] invalid published catalogue entry', {
        exerciseId: row.exerciseId,
        version: row.version,
        issues: parsed.issues,
      })
      return respond(
        { error: 'Published exercise catalogue is unavailable' },
        { status: 500 },
      )
    }
    exercises.push(parsed.exercise)
  }
  return respond(
    { exercises },
    {
      headers: {
        'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
      },
    },
  )
}

async function getPublished(
  env: Env,
  respond: JsonResponder,
  exerciseId: string,
  requestedVersion: number | null,
): Promise<Response> {
  let row: GuidedExerciseVersionRow | null
  if (requestedVersion === null) {
    row = await env.DB.prepare(
      `SELECT v.*
         FROM guidedExercises e
         JOIN guidedExerciseVersions v
           ON v.exerciseId = e.id AND v.version = e.publishedVersion
        WHERE e.id = ? AND e.status = 'active' AND v.lifecycle = 'published'`,
    )
      .bind(exerciseId)
      .first<GuidedExerciseVersionRow>()
  } else {
    row = await env.DB.prepare(
      `SELECT *
         FROM guidedExerciseVersions
        WHERE exerciseId = ? AND version = ?
          AND lifecycle IN ('published', 'superseded')`,
    )
      .bind(exerciseId, requestedVersion)
      .first<GuidedExerciseVersionRow>()
  }

  if (row === null || !publicVersionAllowed(row)) {
    return respond({ error: 'Exercise not found' }, { status: 404 })
  }
  const parsed = decodeVersion(row)
  if (parsed.exercise === null) {
    console.error('[guided-exercises] invalid published specification', {
      exerciseId,
      version: row.version,
      issues: parsed.issues,
    })
    return respond(
      { error: 'Published exercise is unavailable' },
      { status: 500 },
    )
  }
  const headers: Record<string, string> = {
    'Cache-Control':
      requestedVersion === null
        ? 'public, max-age=60, stale-while-revalidate=300'
        : 'public, max-age=31536000, immutable',
  }
  if (row.contentHash !== null) headers.ETag = `"${row.contentHash}"`
  return respond({ exercise: parsed.exercise }, { headers })
}

async function listAdmin(env: Env, respond: JsonResponder): Promise<Response> {
  const [{ results: exercises }, { results: versions }] = await Promise.all([
    env.DB.prepare(
      `SELECT * FROM guidedExercises ORDER BY sortOrder ASC, id ASC`,
    ).all<GuidedExerciseRow>(),
    env.DB.prepare(
      `SELECT * FROM guidedExerciseVersions
        ORDER BY exerciseId ASC, version DESC`,
    ).all<GuidedExerciseVersionRow>(),
  ])

  const byExercise = new Map<string, GuidedExerciseVersionRow[]>()
  for (const version of versions ?? []) {
    const rows = byExercise.get(version.exerciseId) ?? []
    rows.push(version)
    byExercise.set(version.exerciseId, rows)
  }

  return respond({
    exercises: (exercises ?? []).map((exercise) => ({
      ...exercise,
      versions: (byExercise.get(exercise.id) ?? []).map(adminVersion),
    })),
  })
}

async function createExercise(
  request: Request,
  env: Env,
  respond: JsonResponder,
): Promise<Response> {
  const body = await readJsonObject(request)
  if (body === null)
    return respond({ error: 'Invalid JSON body' }, { status: 400 })
  const input = body.exercise
  if (!isRecord(input)) {
    return respond({ error: 'exercise is required' }, { status: 400 })
  }
  const exerciseId = typeof input.id === 'string' ? input.id.trim() : ''
  if (!EXERCISE_ID.test(exerciseId)) {
    return respond(
      { error: 'Exercise id must be a stable lowercase slug' },
      { status: 400 },
    )
  }
  const mediaId =
    typeof body.exampleMediaId === 'string' && body.exampleMediaId.trim() !== ''
      ? body.exampleMediaId.trim()
      : null
  const parsed = await parseDraftInput(env, input, exerciseId, 1, mediaId)
  if (parsed.exercise === null) {
    return respond(
      { error: 'Exercise validation failed', issues: parsed.issues },
      { status: 400 },
    )
  }
  const sortOrder = finiteInteger(body.sortOrder) ?? 0
  const now = new Date().toISOString()
  try {
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO guidedExercises
          (id, createdAt, updatedAt, category, level, sortOrder, status,
           publishedVersion, archivedAt)
         VALUES (?, ?, ?, ?, ?, ?, 'active', NULL, NULL)`,
      ).bind(
        exerciseId,
        now,
        now,
        parsed.exercise.category,
        parsed.exercise.level,
        sortOrder,
      ),
      env.DB.prepare(
        `INSERT INTO guidedExerciseVersions
          (exerciseId, version, schemaVersion, locale, lifecycle, draftRevision,
           specJson, exampleMediaId, contentHash, createdAt, updatedAt,
           publishedAt, supersededAt)
         VALUES (?, 1, 1, 'en-GB', 'draft', 1, ?, ?, NULL, ?, ?, NULL, NULL)`,
      ).bind(
        exerciseId,
        JSON.stringify(parsed.exercise),
        parsed.exampleMediaId,
        now,
        now,
      ),
    ])
  } catch (error) {
    if (isMediaReferenceConflict(error)) {
      return mediaReferenceConflict(respond)
    }
    return respond({ error: 'Exercise id already exists' }, { status: 409 })
  }
  return respond(
    {
      exercise: {
        id: exerciseId,
        category: parsed.exercise.category,
        level: parsed.exercise.level,
        sortOrder,
        status: 'active',
        publishedVersion: null,
        createdAt: now,
        updatedAt: now,
        archivedAt: null,
        versions: [],
      },
      draft: {
        exercise: parsed.exercise,
        version: 1,
        draftRevision: 1,
        exampleMediaId: parsed.exampleMediaId,
      },
    },
    { status: 201 },
  )
}

async function cloneDraft(
  exerciseId: string,
  env: Env,
  respond: JsonResponder,
): Promise<Response> {
  const existingDraft = await env.DB.prepare(
    `SELECT version FROM guidedExerciseVersions
      WHERE exerciseId = ? AND lifecycle = 'draft'`,
  )
    .bind(exerciseId)
    .first<{ version: number }>()
  if (existingDraft !== null) {
    return respond(
      { error: 'This exercise already has an editable draft' },
      { status: 409 },
    )
  }

  const source = await env.DB.prepare(
    `SELECT * FROM guidedExerciseVersions
      WHERE exerciseId = ? AND lifecycle IN ('published', 'superseded')
      ORDER BY version DESC LIMIT 1`,
  )
    .bind(exerciseId)
    .first<GuidedExerciseVersionRow>()
  if (source === null) {
    return respond(
      { error: 'Publish the first draft before cloning another' },
      { status: 409 },
    )
  }

  const maxVersion = await env.DB.prepare(
    `SELECT MAX(version) AS version FROM guidedExerciseVersions WHERE exerciseId = ?`,
  )
    .bind(exerciseId)
    .first<{ version: number | null }>()
  const nextVersion = (maxVersion?.version ?? 0) + 1
  const sourceSpec = parseJsonObject(source.specJson)
  const parsed = await parseDraftInput(
    env,
    sourceSpec,
    exerciseId,
    nextVersion,
    source.exampleMediaId,
  )
  if (parsed.exercise === null) {
    return respond(
      {
        error: 'The published version could not be cloned',
        issues: parsed.issues,
      },
      { status: 500 },
    )
  }

  const now = new Date().toISOString()
  try {
    await env.DB.prepare(
      `INSERT INTO guidedExerciseVersions
        (exerciseId, version, schemaVersion, locale, lifecycle, draftRevision,
         specJson, exampleMediaId, contentHash, createdAt, updatedAt,
         publishedAt, supersededAt)
       VALUES (?, ?, 1, 'en-GB', 'draft', 1, ?, ?, NULL, ?, ?, NULL, NULL)`,
    )
      .bind(
        exerciseId,
        nextVersion,
        JSON.stringify(parsed.exercise),
        parsed.exampleMediaId,
        now,
        now,
      )
      .run()
  } catch (error) {
    if (isMediaReferenceConflict(error)) {
      return mediaReferenceConflict(respond)
    }
    return respond(
      { error: 'An editable draft already exists' },
      { status: 409 },
    )
  }

  return respond(
    {
      draft: {
        exercise: parsed.exercise,
        version: nextVersion,
        draftRevision: 1,
        exampleMediaId: parsed.exampleMediaId,
      },
    },
    { status: 201 },
  )
}

async function getDraft(
  env: Env,
  exerciseId: string,
): Promise<GuidedExerciseVersionRow | null> {
  return env.DB.prepare(
    `SELECT * FROM guidedExerciseVersions
      WHERE exerciseId = ? AND lifecycle = 'draft'`,
  )
    .bind(exerciseId)
    .first<GuidedExerciseVersionRow>()
}

function requestedMediaId(
  body: Record<string, unknown>,
  current: string | null,
): string | null | undefined {
  if (!hasOwn(body, 'exampleMediaId')) return current
  if (body.exampleMediaId === null || body.exampleMediaId === '') return null
  return typeof body.exampleMediaId === 'string'
    ? body.exampleMediaId.trim()
    : undefined
}

async function saveDraft(
  exerciseId: string,
  request: Request,
  env: Env,
  respond: JsonResponder,
): Promise<Response> {
  const body = await readJsonObject(request)
  if (body === null)
    return respond({ error: 'Invalid JSON body' }, { status: 400 })
  const expectedRevision = finiteInteger(body.expectedRevision)
  if (expectedRevision === null || expectedRevision < 1) {
    return respond(
      { error: 'expectedRevision must be a positive integer' },
      { status: 400 },
    )
  }
  const row = await getDraft(env, exerciseId)
  if (row === null)
    return respond({ error: 'Draft not found' }, { status: 404 })
  if (row.draftRevision !== expectedRevision) {
    return respond(
      {
        error: 'Draft changed in another editor',
        currentRevision: row.draftRevision,
      },
      { status: 409 },
    )
  }
  const mediaId = requestedMediaId(body, row.exampleMediaId)
  if (mediaId === undefined) {
    return respond(
      { error: 'exampleMediaId must be a string or null' },
      { status: 400 },
    )
  }
  const parsed = await parseDraftInput(
    env,
    body.exercise,
    exerciseId,
    row.version,
    mediaId,
  )
  if (parsed.exercise === null) {
    return respond(
      { error: 'Exercise validation failed', issues: parsed.issues },
      { status: 400 },
    )
  }

  const now = new Date().toISOString()
  const draftUpdate = env.DB.prepare(
    `UPDATE guidedExerciseVersions
        SET specJson = ?, exampleMediaId = ?, draftRevision = draftRevision + 1,
            updatedAt = ?
      WHERE exerciseId = ? AND version = ? AND lifecycle = 'draft'
        AND draftRevision = ?`,
  ).bind(
    JSON.stringify(parsed.exercise),
    parsed.exampleMediaId,
    now,
    exerciseId,
    row.version,
    expectedRevision,
  )
  const sortOrder = finiteInteger(body.sortOrder)
  const statements =
    sortOrder === null
      ? [draftUpdate]
      : [
          env.DB.prepare(
            `UPDATE guidedExercises
                SET sortOrder = ?, updatedAt = ?
              WHERE id = ? AND EXISTS (
                SELECT 1 FROM guidedExerciseVersions d
                 WHERE d.exerciseId = ? AND d.version = ?
                   AND d.lifecycle = 'draft' AND d.draftRevision = ?
              )`,
          ).bind(
            sortOrder,
            now,
            exerciseId,
            exerciseId,
            row.version,
            expectedRevision,
          ),
          draftUpdate,
        ]
  let results: D1Result[]
  try {
    results = await env.DB.batch(statements)
  } catch (error) {
    if (isMediaReferenceConflict(error)) {
      return mediaReferenceConflict(respond)
    }
    throw error
  }
  const draftResult = results.at(-1)
  if ((draftResult?.meta.changes ?? 0) !== 1) {
    const fresh = await getDraft(env, exerciseId)
    return respond(
      {
        error: 'Draft changed in another editor',
        currentRevision: fresh?.draftRevision ?? null,
      },
      { status: 409 },
    )
  }

  return respond({
    draft: {
      exercise: parsed.exercise,
      version: row.version,
      draftRevision: expectedRevision + 1,
      exampleMediaId: parsed.exampleMediaId,
    },
  })
}

async function validateDraft(
  exerciseId: string,
  env: Env,
  respond: JsonResponder,
): Promise<Response> {
  const row = await getDraft(env, exerciseId)
  if (row === null)
    return respond({ error: 'Draft not found' }, { status: 404 })
  const spec = parseJsonObject(row.specJson)
  const parsed = await parseDraftInput(
    env,
    spec,
    exerciseId,
    row.version,
    row.exampleMediaId,
  )
  return respond({
    valid: parsed.exercise !== null && parsed.issues.length === 0,
    issues: parsed.issues,
    draftRevision: row.draftRevision,
  })
}

async function sha256Hex(value: string | ArrayBuffer): Promise<string> {
  const data =
    typeof value === 'string' ? new TextEncoder().encode(value) : value
  const digest = await workerCrypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

async function publishDraft(
  exerciseId: string,
  request: Request,
  env: Env,
  respond: JsonResponder,
): Promise<Response> {
  const body = await readJsonObject(request)
  if (body === null)
    return respond({ error: 'Invalid JSON body' }, { status: 400 })
  const expectedRevision = finiteInteger(body.expectedRevision)
  if (expectedRevision === null || expectedRevision < 1) {
    return respond(
      { error: 'expectedRevision must be a positive integer' },
      { status: 400 },
    )
  }
  const row = await getDraft(env, exerciseId)
  if (row === null)
    return respond({ error: 'Draft not found' }, { status: 404 })
  if (row.draftRevision !== expectedRevision) {
    return respond(
      {
        error: 'Draft changed in another editor',
        currentRevision: row.draftRevision,
      },
      { status: 409 },
    )
  }
  const spec = parseJsonObject(row.specJson)
  const parsed = await parseDraftInput(
    env,
    spec,
    exerciseId,
    row.version,
    row.exampleMediaId,
  )
  if (parsed.exercise === null || parsed.issues.length > 0) {
    return respond(
      { error: 'Exercise validation failed', issues: parsed.issues },
      { status: 400 },
    )
  }

  const canonical = JSON.stringify(parsed.exercise)
  const contentHash = await sha256Hex(canonical)
  const now = new Date().toISOString()
  const guardSql = `EXISTS (
    SELECT 1 FROM guidedExerciseVersions d
     WHERE d.exerciseId = ? AND d.version = ?
       AND d.lifecycle = 'draft' AND d.draftRevision = ?
  )`
  const results = await env.DB.batch([
    env.DB.prepare(
      `UPDATE guidedExerciseVersions
          SET lifecycle = 'superseded', supersededAt = ?, updatedAt = ?
        WHERE exerciseId = ? AND lifecycle = 'published' AND ${guardSql}`,
    ).bind(now, now, exerciseId, exerciseId, row.version, expectedRevision),
    env.DB.prepare(
      `UPDATE guidedExerciseVersions
          SET lifecycle = 'published', contentHash = ?, publishedAt = ?,
              supersededAt = NULL, updatedAt = ?
        WHERE exerciseId = ? AND version = ? AND lifecycle = 'draft'
          AND draftRevision = ?`,
    ).bind(contentHash, now, now, exerciseId, row.version, expectedRevision),
    env.DB.prepare(
      `UPDATE guidedExercises
          SET publishedVersion = ?, category = ?, level = ?, status = 'active',
              archivedAt = NULL, updatedAt = ?
        WHERE id = ? AND EXISTS (
          SELECT 1 FROM guidedExerciseVersions v
           WHERE v.exerciseId = ? AND v.version = ?
             AND v.lifecycle = 'published' AND v.contentHash = ?
        )`,
    ).bind(
      row.version,
      parsed.exercise.category,
      parsed.exercise.level,
      now,
      exerciseId,
      exerciseId,
      row.version,
      contentHash,
    ),
  ])

  if ((results[1]?.meta.changes ?? 0) !== 1) {
    const fresh = await getDraft(env, exerciseId)
    return respond(
      {
        error: 'Draft changed before it could be published',
        currentRevision: fresh?.draftRevision ?? null,
      },
      { status: 409 },
    )
  }
  return respond({
    exercise: parsed.exercise,
    version: row.version,
    contentHash,
    publishedAt: now,
  })
}

async function archiveExercise(
  exerciseId: string,
  env: Env,
  respond: JsonResponder,
): Promise<Response> {
  const now = new Date().toISOString()
  const result = await env.DB.prepare(
    `UPDATE guidedExercises
        SET status = 'archived', archivedAt = ?, updatedAt = ?
      WHERE id = ?`,
  )
    .bind(now, now, exerciseId)
    .run()
  if ((result.meta.changes ?? 0) !== 1) {
    return respond({ error: 'Exercise not found' }, { status: 404 })
  }
  return respond({ ok: true, archivedAt: now })
}

function validateMediaMetadata(body: Record<string, unknown>): {
  metadata: Omit<
    GuidedExerciseMediaRow,
    | 'id'
    | 'createdAt'
    | 'updatedAt'
    | 'status'
    | 'objectKey'
    | 'mimeType'
    | 'byteLength'
    | 'sha256'
    | 'etag'
    | 'readyAt'
  > | null
  error?: string
} {
  const locale = body.locale ?? 'en-GB'
  const source = body.source
  const transcript =
    typeof body.transcript === 'string' ? body.transcript.trim() : ''
  const durationMs = finiteInteger(body.durationMs)
  if (locale !== 'en-GB')
    return { metadata: null, error: 'locale must be en-GB' }
  if (source !== 'coach' && source !== 'generated' && source !== 'imported') {
    return {
      metadata: null,
      error: 'source must be coach, generated, or imported',
    }
  }
  if (transcript === '' || transcript.length > 500) {
    return { metadata: null, error: 'transcript must be 1 to 500 characters' }
  }
  if (durationMs === null || durationMs < 1 || durationMs > 15_000) {
    return { metadata: null, error: 'durationMs must be from 1 to 15000' }
  }
  return {
    metadata: {
      locale,
      source,
      transcript,
      durationMs,
    },
  }
}

function publicMedia(row: GuidedExerciseMediaRow): Record<string, unknown> {
  return {
    id: row.id,
    status: row.status,
    locale: row.locale,
    source: row.source,
    transcript: row.transcript,
    durationMs: row.durationMs,
    mimeType: row.mimeType,
    byteLength: row.byteLength,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    readyAt: row.readyAt,
    url:
      row.status === 'ready'
        ? `/api/guided-media/${encodeURIComponent(row.id)}`
        : null,
  }
}

async function cleanupOrphanedMedia(env: Env): Promise<void> {
  const bucket = env.GUIDED_MEDIA_BUCKET
  if (bucket === undefined) return

  const now = new Date()
  const staleUploadBefore = new Date(
    now.getTime() - STALE_UPLOAD_MAX_AGE_MS,
  ).toISOString()
  const orphanedReadyBefore = new Date(
    now.getTime() - ORPHANED_READY_MAX_AGE_MS,
  ).toISOString()
  const { results } = await env.DB.prepare(
    `SELECT m.*
       FROM guidedExerciseMedia m
      WHERE (
        (m.status IN ('uploading', 'failed') AND m.createdAt < ?)
        OR (
          m.status = 'ready'
          AND COALESCE(m.readyAt, m.createdAt) < ?
        )
      )
        AND NOT EXISTS (
          SELECT 1 FROM guidedExerciseVersions v
           WHERE v.exampleMediaId = m.id
        )
      ORDER BY m.createdAt ASC
      LIMIT ?`,
  )
    .bind(staleUploadBefore, orphanedReadyBefore, MEDIA_GC_BATCH_SIZE)
    .all<GuidedExerciseMediaRow>()

  for (const media of results ?? []) {
    const claimed = await env.DB.prepare(
      `UPDATE guidedExerciseMedia
          SET status = 'failed', updatedAt = ?
        WHERE id = ?
          AND NOT EXISTS (
            SELECT 1 FROM guidedExerciseVersions v
             WHERE v.exampleMediaId = guidedExerciseMedia.id
          )
          AND (
            (status IN ('uploading', 'failed') AND createdAt < ?)
            OR (
              status = 'ready'
              AND COALESCE(readyAt, createdAt) < ?
            )
          )`,
    )
      .bind(now.toISOString(), media.id, staleUploadBefore, orphanedReadyBefore)
      .run()
    if ((claimed.meta.changes ?? 0) !== 1) continue

    await bucket.delete(media.objectKey)
    await env.DB.prepare(
      `DELETE FROM guidedExerciseMedia
        WHERE id = ? AND status = 'failed'
          AND NOT EXISTS (
            SELECT 1 FROM guidedExerciseVersions v
             WHERE v.exampleMediaId = guidedExerciseMedia.id
          )`,
    )
      .bind(media.id)
      .run()
  }
}

async function reserveMedia(
  request: Request,
  env: Env,
  respond: JsonResponder,
): Promise<Response> {
  const body = await readJsonObject(request)
  if (body === null)
    return respond({ error: 'Invalid JSON body' }, { status: 400 })
  const validated = validateMediaMetadata(body)
  if (validated.metadata === null) {
    return respond(
      { error: validated.error ?? 'Invalid media metadata' },
      { status: 400 },
    )
  }
  if (env.GUIDED_MEDIA_BUCKET === undefined) {
    return respond(
      { error: 'Guided media storage is not configured' },
      { status: 503 },
    )
  }
  try {
    await cleanupOrphanedMedia(env)
  } catch (error) {
    console.warn('[guided-exercises] orphaned media cleanup failed', error)
  }
  const id = workerCrypto.randomUUID()
  const now = new Date().toISOString()
  const objectKey = `guided-exercise-media/${id}/playback`
  await env.DB.prepare(
    `INSERT INTO guidedExerciseMedia
      (id, createdAt, updatedAt, status, locale, source, transcript, durationMs,
       objectKey, mimeType, byteLength, sha256, etag, readyAt)
     VALUES (?, ?, ?, 'uploading', ?, ?, ?, ?, ?, NULL, NULL, NULL, NULL, NULL)`,
  )
    .bind(
      id,
      now,
      now,
      validated.metadata.locale,
      validated.metadata.source,
      validated.metadata.transcript,
      validated.metadata.durationMs,
      objectKey,
    )
    .run()
  const row = await findMedia(env, id)
  return respond(
    {
      media: row === null ? { id, status: 'uploading' } : publicMedia(row),
      uploadUrl: `/api/admin/guided-media/${encodeURIComponent(id)}/content`,
      maxByteLength: MAX_PLAYBACK_BYTES,
    },
    { status: 201 },
  )
}

async function uploadMedia(
  mediaId: string,
  request: Request,
  env: Env,
  respond: JsonResponder,
): Promise<Response> {
  const bucket = env.GUIDED_MEDIA_BUCKET
  if (bucket === undefined) {
    return respond(
      { error: 'Guided media storage is not configured' },
      { status: 503 },
    )
  }
  const row = await findMedia(env, mediaId)
  if (row === null)
    return respond({ error: 'Media reservation not found' }, { status: 404 })
  if (row.status !== 'uploading') {
    return respond(
      { error: 'This playback reservation is no longer writable' },
      { status: 409 },
    )
  }
  const mimeType = (request.headers.get('Content-Type') ?? '')
    .split(';', 1)[0]!
    .trim()
    .toLowerCase()
  if (!ALLOWED_PLAYBACK_TYPES.has(mimeType)) {
    return respond(
      { error: 'Playback must be MP3, MP4/M4A, or AAC audio' },
      { status: 415 },
    )
  }
  const declaredLength = Number(request.headers.get('Content-Length'))
  if (Number.isFinite(declaredLength) && declaredLength > MAX_PLAYBACK_BYTES) {
    return respond(
      { error: 'Playback exceeds the 2 MiB limit' },
      { status: 413 },
    )
  }
  const bytes = await request.arrayBuffer()
  if (bytes.byteLength === 0) {
    return respond({ error: 'Playback file is empty' }, { status: 400 })
  }
  if (bytes.byteLength > MAX_PLAYBACK_BYTES) {
    return respond(
      { error: 'Playback exceeds the 2 MiB limit' },
      { status: 413 },
    )
  }
  const digest = await workerCrypto.subtle.digest('SHA-256', bytes)
  const sha256 = [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
  const object = await bucket.put(row.objectKey, bytes, {
    onlyIf: { etagDoesNotMatch: '*' },
    httpMetadata: {
      contentType: mimeType,
      cacheControl: 'public, max-age=31536000, immutable',
    },
    customMetadata: { mediaId, sha256 },
    sha256: digest,
  })
  if (object === null) {
    return respond(
      { error: 'This playback reservation has already been uploaded' },
      { status: 409 },
    )
  }
  const now = new Date().toISOString()
  try {
    const result = await env.DB.prepare(
      `UPDATE guidedExerciseMedia
          SET status = 'ready', mimeType = ?, byteLength = ?, sha256 = ?,
              etag = ?, readyAt = ?, updatedAt = ?
        WHERE id = ? AND status = 'uploading'`,
    )
      .bind(
        mimeType,
        bytes.byteLength,
        sha256,
        object.httpEtag,
        now,
        now,
        mediaId,
      )
      .run()
    if ((result.meta.changes ?? 0) !== 1) {
      await bucket.delete(row.objectKey)
      return respond(
        { error: 'This playback reservation is no longer writable' },
        { status: 409 },
      )
    }
  } catch (error) {
    await bucket.delete(row.objectKey)
    throw error
  }
  const updated = await findMedia(env, mediaId)
  return respond({
    media:
      updated === null
        ? { id: mediaId, status: 'ready' }
        : publicMedia(updated),
  })
}

interface ResolvedByteRange {
  offset: number
  length: number
}

function parseByteRange(
  value: string | null,
  size: number,
): ResolvedByteRange | null | 'invalid' {
  if (value === null) return null
  const match = value.match(/^bytes=(\d*)-(\d*)$/)
  if (match === null) return 'invalid'
  const startRaw = match[1]!
  const endRaw = match[2]!
  if (startRaw === '' && endRaw === '') return 'invalid'
  if (startRaw === '') {
    const suffix = Number(endRaw)
    if (!Number.isInteger(suffix) || suffix <= 0) return 'invalid'
    const length = Math.min(size, suffix)
    return { offset: size - length, length }
  }
  const start = Number(startRaw)
  const end = endRaw === '' ? size - 1 : Number(endRaw)
  if (
    !Number.isInteger(start) ||
    !Number.isInteger(end) ||
    start < 0 ||
    end < start ||
    start >= size
  ) {
    return 'invalid'
  }
  const boundedEnd = Math.min(size - 1, end)
  return { offset: start, length: boundedEnd - start + 1 }
}

async function streamMedia(
  row: GuidedExerciseMediaRow,
  request: Request,
  env: Env,
  context: GuidedExerciseHandlerContext,
  isPublic: boolean,
): Promise<Response> {
  const bucket = env.GUIDED_MEDIA_BUCKET
  if (bucket === undefined) {
    return context.respond(
      { error: 'Guided media storage is not configured' },
      { status: 503 },
    )
  }
  if (row.status !== 'ready' || row.byteLength === null) {
    return context.respond({ error: 'Playback is not ready' }, { status: 404 })
  }
  const ifNoneMatch = request.headers.get('If-None-Match')
  if (row.etag !== null && ifNoneMatch === row.etag) {
    return new Response(null, {
      status: 304,
      headers: {
        ...context.corsHeaders,
        ETag: row.etag,
        'Cache-Control': isPublic
          ? 'public, max-age=31536000, immutable'
          : 'private, max-age=0, must-revalidate',
      },
    })
  }
  const range = parseByteRange(request.headers.get('Range'), row.byteLength)
  if (range === 'invalid') {
    return new Response(null, {
      status: 416,
      headers: {
        ...context.corsHeaders,
        'Content-Range': `bytes */${row.byteLength}`,
      },
    })
  }
  const object =
    request.method === 'HEAD'
      ? await bucket.head(row.objectKey)
      : await bucket.get(row.objectKey, range === null ? undefined : { range })
  if (object === null) {
    return context.respond(
      { error: 'Playback object is missing' },
      { status: 404 },
    )
  }
  const headers = new Headers(context.corsHeaders)
  object.writeHttpMetadata(headers)
  headers.set('Content-Type', row.mimeType ?? 'application/octet-stream')
  headers.set('Accept-Ranges', 'bytes')
  headers.set('ETag', object.httpEtag)
  headers.set(
    'Cache-Control',
    isPublic
      ? 'public, max-age=31536000, immutable'
      : 'private, max-age=0, must-revalidate',
  )
  let status = 200
  if (range === null) {
    headers.set('Content-Length', String(row.byteLength))
  } else {
    status = 206
    headers.set('Content-Length', String(range.length))
    headers.set(
      'Content-Range',
      `bytes ${range.offset}-${range.offset + range.length - 1}/${row.byteLength}`,
    )
  }
  return new Response(
    request.method === 'HEAD' ? null : (object as R2ObjectBody).body,
    { status, headers },
  )
}

async function getPublicMedia(
  mediaId: string,
  request: Request,
  env: Env,
  context: GuidedExerciseHandlerContext,
): Promise<Response> {
  const row = await env.DB.prepare(
    `SELECT m.*
       FROM guidedExerciseMedia m
      WHERE m.id = ? AND m.status = 'ready'
        AND EXISTS (
          SELECT 1 FROM guidedExerciseVersions v
           WHERE v.exampleMediaId = m.id
             -- Public playback follows public specs: published versions and
             -- the superseded ones still reachable by version deep-links.
             -- Media attached only to a draft is admin-only until publish.
             AND v.lifecycle IN ('published', 'superseded')
        )`,
  )
    .bind(mediaId)
    .first<GuidedExerciseMediaRow>()
  if (row === null) {
    return context.respond({ error: 'Playback not found' }, { status: 404 })
  }
  return streamMedia(row, request, env, context, true)
}

async function getAdminMedia(
  mediaId: string,
  request: Request,
  env: Env,
  context: GuidedExerciseHandlerContext,
): Promise<Response> {
  const row = await findMedia(env, mediaId)
  if (row === null) {
    return context.respond({ error: 'Playback not found' }, { status: 404 })
  }
  return streamMedia(row, request, env, context, false)
}

async function listPathAssignments(
  pathId: string,
  env: Env,
  respond: JsonResponder,
): Promise<Response> {
  const { results } = await env.DB.prepare(
    `SELECT * FROM pathLessonAssignments
      WHERE pathId = ?
      ORDER BY weekNumber ASC, dayNumber ASC, slotNumber ASC`,
  )
    .bind(pathId)
    .all<PathLessonAssignmentRow>()
  return respond({ pathId, assignments: results ?? [] })
}

async function savePathAssignment(
  pathId: string,
  request: Request,
  env: Env,
  respond: JsonResponder,
): Promise<Response> {
  const body = await readJsonObject(request)
  if (body === null)
    return respond({ error: 'Invalid JSON body' }, { status: 400 })
  const assignment = isRecord(body.assignment) ? body.assignment : body
  const weekNumber = finiteInteger(assignment.weekNumber)
  const dayNumber = finiteInteger(assignment.dayNumber) ?? 0
  const slotNumber = finiteInteger(assignment.slotNumber)
  const exerciseId =
    typeof assignment.exerciseId === 'string'
      ? assignment.exerciseId.trim()
      : ''
  const exerciseVersion = finiteInteger(assignment.exerciseVersion)
  if (
    !PATH_ID.test(pathId) ||
    weekNumber === null ||
    weekNumber < 1 ||
    dayNumber < 0 ||
    dayNumber > 7 ||
    slotNumber === null ||
    slotNumber < 1 ||
    !EXERCISE_ID.test(exerciseId) ||
    exerciseVersion === null ||
    exerciseVersion < 1
  ) {
    return respond({ error: 'Invalid path assignment' }, { status: 400 })
  }
  const version = await env.DB.prepare(
    `SELECT lifecycle FROM guidedExerciseVersions
      WHERE exerciseId = ? AND version = ?
        AND lifecycle IN ('published', 'superseded')`,
  )
    .bind(exerciseId, exerciseVersion)
    .first<{ lifecycle: string }>()
  if (version === null) {
    return respond(
      { error: 'Assignments must pin a published exercise version' },
      { status: 400 },
    )
  }

  const requestedId =
    typeof assignment.id === 'string' && assignment.id.trim() !== ''
      ? assignment.id.trim()
      : null
  const now = new Date().toISOString()
  if (requestedId !== null) {
    try {
      const updated = await env.DB.prepare(
        `UPDATE pathLessonAssignments
            SET weekNumber = ?, dayNumber = ?, slotNumber = ?,
                exerciseId = ?, exerciseVersion = ?, updatedAt = ?
          WHERE id = ? AND pathId = ?`,
      )
        .bind(
          weekNumber,
          dayNumber,
          slotNumber,
          exerciseId,
          exerciseVersion,
          now,
          requestedId,
          pathId,
        )
        .run()
      if ((updated.meta.changes ?? 0) !== 1) {
        return respond({ error: 'Path assignment not found' }, { status: 404 })
      }
    } catch {
      return respond(
        { error: 'That path slot already has an assignment' },
        { status: 409 },
      )
    }
  } else {
    const id = workerCrypto.randomUUID()
    await env.DB.prepare(
      `INSERT INTO pathLessonAssignments
        (id, createdAt, updatedAt, pathId, weekNumber, dayNumber, slotNumber,
         exerciseId, exerciseVersion)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(pathId, weekNumber, dayNumber, slotNumber)
       DO UPDATE SET exerciseId = excluded.exerciseId,
                     exerciseVersion = excluded.exerciseVersion,
                     updatedAt = excluded.updatedAt`,
    )
      .bind(
        id,
        now,
        now,
        pathId,
        weekNumber,
        dayNumber,
        slotNumber,
        exerciseId,
        exerciseVersion,
      )
      .run()
  }
  const saved = await env.DB.prepare(
    `SELECT * FROM pathLessonAssignments
      WHERE pathId = ? AND weekNumber = ? AND dayNumber = ? AND slotNumber = ?`,
  )
    .bind(pathId, weekNumber, dayNumber, slotNumber)
    .first<PathLessonAssignmentRow>()
  return respond({ assignment: saved }, { status: 201 })
}

async function deletePathAssignment(
  assignmentId: string,
  env: Env,
  respond: JsonResponder,
): Promise<Response> {
  const result = await env.DB.prepare(
    `DELETE FROM pathLessonAssignments WHERE id = ?`,
  )
    .bind(assignmentId)
    .run()
  if ((result.meta.changes ?? 0) !== 1) {
    return respond({ error: 'Path assignment not found' }, { status: 404 })
  }
  return respond({ ok: true })
}

/**
 * Route guided-content requests. Returns null when the path belongs to another
 * worker feature, matching the auth/billing router convention.
 */
export async function handleGuidedExerciseRequest(
  request: Request,
  env: Env,
  url: URL,
  context: GuidedExerciseHandlerContext,
): Promise<Response | null> {
  const { pathname } = url
  const method = request.method

  if (pathname === '/api/guided-exercises' && method === 'GET') {
    return listPublished(env, context.respond)
  }
  const publicExercise = pathname.match(
    /^\/api\/guided-exercises\/([^/]+?)(?:\/versions\/(\d+))?$/,
  )
  if (publicExercise !== null && method === 'GET') {
    return getPublished(
      env,
      context.respond,
      decodeURIComponent(publicExercise[1]!),
      publicExercise[2] === undefined ? null : Number(publicExercise[2]),
    )
  }

  const publicMediaMatch = pathname.match(/^\/api\/guided-media\/([^/]+)$/)
  if (publicMediaMatch !== null && (method === 'GET' || method === 'HEAD')) {
    return getPublicMedia(
      decodeURIComponent(publicMediaMatch[1]!),
      request,
      env,
      context,
    )
  }

  const publicPath = pathname.match(
    /^\/api\/guided-paths\/([^/]+)\/assignments$/,
  )
  if (publicPath !== null && method === 'GET') {
    return listPathAssignments(
      decodeURIComponent(publicPath[1]!),
      env,
      context.respond,
    )
  }

  const ownsAdminRoute =
    pathname.startsWith('/api/admin/guided-exercises') ||
    pathname.startsWith('/api/admin/guided-media') ||
    pathname.startsWith('/api/admin/guided-paths') ||
    pathname.startsWith('/api/admin/guided-path-assignments')
  if (!ownsAdminRoute) return null
  if (!context.admin) {
    return context.respond({ error: 'Admin key required' }, { status: 403 })
  }

  if (pathname === '/api/admin/guided-exercises') {
    if (method === 'GET') return listAdmin(env, context.respond)
    if (method === 'POST') {
      return createExercise(request, env, context.respond)
    }
  }
  const adminExercise = pathname.match(
    /^\/api\/admin\/guided-exercises\/([^/]+)(?:\/(draft|validate|publish|archive))?$/,
  )
  if (adminExercise !== null) {
    const exerciseId = decodeURIComponent(adminExercise[1]!)
    const action = adminExercise[2]
    if (action === 'draft' && method === 'POST') {
      return cloneDraft(exerciseId, env, context.respond)
    }
    if (action === 'draft' && method === 'PATCH') {
      return saveDraft(exerciseId, request, env, context.respond)
    }
    if (action === 'validate' && method === 'POST') {
      return validateDraft(exerciseId, env, context.respond)
    }
    if (action === 'publish' && method === 'POST') {
      return publishDraft(exerciseId, request, env, context.respond)
    }
    if (action === 'archive' && method === 'POST') {
      return archiveExercise(exerciseId, env, context.respond)
    }
  }

  if (pathname === '/api/admin/guided-media' && method === 'POST') {
    return reserveMedia(request, env, context.respond)
  }
  const adminMedia = pathname.match(
    /^\/api\/admin\/guided-media\/([^/]+)(?:\/content)?$/,
  )
  if (adminMedia !== null) {
    const mediaId = decodeURIComponent(adminMedia[1]!)
    if (pathname.endsWith('/content') && method === 'PUT') {
      return uploadMedia(mediaId, request, env, context.respond)
    }
    if (
      !pathname.endsWith('/content') &&
      (method === 'GET' || method === 'HEAD')
    ) {
      return getAdminMedia(mediaId, request, env, context)
    }
  }

  const adminPath = pathname.match(
    /^\/api\/admin\/guided-paths\/([^/]+)\/assignments$/,
  )
  if (adminPath !== null) {
    const pathId = decodeURIComponent(adminPath[1]!)
    if (method === 'GET') {
      return listPathAssignments(pathId, env, context.respond)
    }
    if (method === 'POST') {
      return savePathAssignment(pathId, request, env, context.respond)
    }
  }
  const deleteAssignment = pathname.match(
    /^\/api\/admin\/guided-path-assignments\/([^/]+)$/,
  )
  if (deleteAssignment !== null && method === 'DELETE') {
    return deletePathAssignment(
      decodeURIComponent(deleteAssignment[1]!),
      env,
      context.respond,
    )
  }

  return context.respond({ error: 'Not found' }, { status: 404 })
}
