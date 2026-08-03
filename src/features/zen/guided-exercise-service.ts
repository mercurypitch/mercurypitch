// ============================================================
// Guided exercise content API
// ============================================================
//
// Published reads deliberately return null when the cloud is absent or sends
// invalid content. The caller can then retain the bundled ZEN_EXERCISES seed
// catalogue as its offline and rollout fallback.

import { API_BASE_URL } from '@/lib/defaults'
import type { ZenExampleAudio, ZenExerciseDefinition } from './types'
import { parseZenExercise } from './validate-exercise'

export interface ApiValidationIssue {
  path: string
  message: string
}

export type ApiResult<T> =
  | { ok: true; data: T }
  | {
      ok: false
      error: string
      status: number
      issues?: ApiValidationIssue[]
    }

export interface AdminGuidedExerciseVersion {
  exerciseId: string
  version: number
  schemaVersion: 1
  locale: 'en-GB'
  lifecycle: 'draft' | 'published' | 'superseded'
  draftRevision: number
  exampleMediaId: string | null
  contentHash: string | null
  createdAt: string
  updatedAt: string
  publishedAt: string | null
  supersededAt: string | null
  exercise: ZenExerciseDefinition | null
  issues: ApiValidationIssue[]
}

export interface AdminGuidedExercise {
  id: string
  createdAt: string
  updatedAt: string
  category: ZenExerciseDefinition['category']
  level: ZenExerciseDefinition['level']
  sortOrder: number
  status: 'active' | 'archived'
  publishedVersion: number | null
  archivedAt: string | null
  versions: AdminGuidedExerciseVersion[]
}

export interface AdminGuidedExerciseDraft {
  exercise: ZenExerciseDefinition
  version: number
  draftRevision: number
  exampleMediaId: string | null
}

export interface GuidedExerciseMedia {
  id: string
  status: 'uploading' | 'ready' | 'failed'
  locale: 'en-GB'
  source: ZenExampleAudio['source']
  transcript: string
  durationMs: number
  mimeType: string | null
  byteLength: number | null
  createdAt: string
  updatedAt: string
  readyAt: string | null
  url: string | null
}

export interface GuidedExerciseMediaMetadata {
  durationMs: number
  source: ZenExampleAudio['source']
  transcript: string
  locale?: 'en-GB'
}

export interface GuidedPathAssignment {
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

export interface GuidedPathAssignmentDraft {
  id?: string
  weekNumber: number
  dayNumber?: number
  slotNumber: number
  exerciseId: string
  exerciseVersion: number
}

interface ErrorBody {
  error?: unknown
  issues?: unknown
}

const MAX_GUIDED_MEDIA_BYTES = 2 * 1024 * 1024

function base(): string {
  return API_BASE_URL ?? ''
}

function adminHeaders(key: string): Record<string, string> {
  return { 'X-Admin-Key': key }
}

function validationIssues(value: unknown): ApiValidationIssue[] | undefined {
  if (!Array.isArray(value)) return undefined
  const issues = value.flatMap((item) => {
    if (
      typeof item !== 'object' ||
      item === null ||
      !('path' in item) ||
      !('message' in item) ||
      typeof item.path !== 'string' ||
      typeof item.message !== 'string'
    ) {
      return []
    }
    return [{ path: item.path, message: item.message }]
  })
  return issues.length === 0 ? undefined : issues
}

async function apiRequest<T>(
  path: string,
  init?: RequestInit,
): Promise<ApiResult<T>> {
  if (base() === '') {
    return { ok: false, error: 'No API configured', status: 0 }
  }
  try {
    const response = await fetch(`${base()}${path}`, init)
    let body: unknown = null
    try {
      body = await response.json()
    } catch {
      body = null
    }
    if (!response.ok) {
      const errorBody =
        typeof body === 'object' && body !== null ? (body as ErrorBody) : null
      return {
        ok: false,
        error:
          typeof errorBody?.error === 'string'
            ? errorBody.error
            : `Request failed (${response.status})`,
        status: response.status,
        ...(validationIssues(errorBody?.issues) === undefined
          ? {}
          : { issues: validationIssues(errorBody?.issues) }),
      }
    }
    return { ok: true, data: body as T }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      status: 0,
    }
  }
}

function jsonInit(
  method: 'POST' | 'PATCH',
  body: object,
  key?: string,
): RequestInit {
  return {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(key === undefined ? {} : adminHeaders(key)),
    },
    body: JSON.stringify(body),
  }
}

export async function listPublishedGuidedExercises(): Promise<
  ZenExerciseDefinition[] | null
> {
  const result = await apiRequest<{ exercises: unknown[] }>(
    '/api/guided-exercises',
  )
  if (!result.ok || !Array.isArray(result.data.exercises)) return null
  const exercises: ZenExerciseDefinition[] = []
  for (const input of result.data.exercises) {
    const parsed = parseZenExercise(input)
    if (parsed.exercise === null) return null
    exercises.push(parsed.exercise)
  }
  return exercises
}

export async function getPublishedGuidedExercise(
  exerciseId: string,
  version?: number,
): Promise<ZenExerciseDefinition | null> {
  const suffix =
    version === undefined ? '' : `/versions/${encodeURIComponent(version)}`
  const result = await apiRequest<{ exercise: unknown }>(
    `/api/guided-exercises/${encodeURIComponent(exerciseId)}${suffix}`,
  )
  if (!result.ok) return null
  return parseZenExercise(result.data.exercise).exercise
}

export async function listAdminGuidedExercises(
  key: string,
): Promise<ApiResult<AdminGuidedExercise[]>> {
  const result = await apiRequest<{ exercises: AdminGuidedExercise[] }>(
    '/api/admin/guided-exercises',
    { headers: adminHeaders(key) },
  )
  return result.ok ? { ok: true, data: result.data.exercises } : result
}

export async function createGuidedExercise(
  exercise: ZenExerciseDefinition,
  key: string,
  options: { sortOrder?: number; exampleMediaId?: string | null } = {},
): Promise<
  ApiResult<{
    exercise: AdminGuidedExercise
    draft: AdminGuidedExerciseDraft
  }>
> {
  return apiRequest('/api/admin/guided-exercises', {
    ...jsonInit(
      'POST',
      {
        exercise,
        ...(options.sortOrder === undefined
          ? {}
          : { sortOrder: options.sortOrder }),
        ...(options.exampleMediaId === undefined
          ? {}
          : { exampleMediaId: options.exampleMediaId }),
      },
      key,
    ),
  })
}

export async function saveGuidedExerciseDraft(
  exerciseId: string,
  exercise: ZenExerciseDefinition,
  expectedRevision: number,
  key: string,
  options: { sortOrder?: number; exampleMediaId?: string | null } = {},
): Promise<ApiResult<{ draft: AdminGuidedExerciseDraft }>> {
  return apiRequest(
    `/api/admin/guided-exercises/${encodeURIComponent(exerciseId)}/draft`,
    jsonInit(
      'PATCH',
      {
        exercise,
        expectedRevision,
        ...(options.sortOrder === undefined
          ? {}
          : { sortOrder: options.sortOrder }),
        ...(options.exampleMediaId === undefined
          ? {}
          : { exampleMediaId: options.exampleMediaId }),
      },
      key,
    ),
  )
}

export async function cloneGuidedExerciseDraft(
  exerciseId: string,
  key: string,
): Promise<ApiResult<{ draft: AdminGuidedExerciseDraft }>> {
  return apiRequest(
    `/api/admin/guided-exercises/${encodeURIComponent(exerciseId)}/draft`,
    jsonInit('POST', {}, key),
  )
}

export async function validateGuidedExerciseDraft(
  exerciseId: string,
  key: string,
): Promise<
  ApiResult<{
    valid: boolean
    issues: ApiValidationIssue[]
    draftRevision: number
  }>
> {
  return apiRequest(
    `/api/admin/guided-exercises/${encodeURIComponent(exerciseId)}/validate`,
    jsonInit('POST', {}, key),
  )
}

export async function publishGuidedExercise(
  exerciseId: string,
  expectedRevision: number,
  key: string,
): Promise<
  ApiResult<{
    exercise: ZenExerciseDefinition
    version: number
    contentHash: string
    publishedAt: string
  }>
> {
  return apiRequest(
    `/api/admin/guided-exercises/${encodeURIComponent(exerciseId)}/publish`,
    jsonInit('POST', { expectedRevision }, key),
  )
}

export async function archiveGuidedExercise(
  exerciseId: string,
  key: string,
): Promise<ApiResult<{ ok: true; archivedAt: string }>> {
  return apiRequest(
    `/api/admin/guided-exercises/${encodeURIComponent(exerciseId)}/archive`,
    jsonInit('POST', {}, key),
  )
}

function playbackMime(file: File): string {
  if (file.type !== '') return file.type.split(';', 1)[0]!.toLowerCase()
  const lower = file.name.toLowerCase()
  if (lower.endsWith('.mp3')) return 'audio/mpeg'
  if (lower.endsWith('.m4a') || lower.endsWith('.mp4')) return 'audio/mp4'
  if (lower.endsWith('.aac')) return 'audio/aac'
  if (lower.endsWith('.webm')) return 'audio/webm'
  if (lower.endsWith('.ogg') || lower.endsWith('.oga')) return 'audio/ogg'
  if (lower.endsWith('.wav')) return 'audio/wav'
  return 'application/octet-stream'
}

export async function downloadAdminGuidedExerciseMedia(
  mediaId: string,
  key: string,
): Promise<ApiResult<Blob>> {
  if (base() === '') {
    return { ok: false, error: 'No API configured', status: 0 }
  }
  try {
    const response = await fetch(
      `${base()}/api/admin/guided-media/${encodeURIComponent(mediaId)}`,
      { headers: adminHeaders(key) },
    )
    if (!response.ok) {
      let message = `Playback request failed (${response.status})`
      try {
        const body = (await response.json()) as ErrorBody
        if (typeof body.error === 'string') message = body.error
      } catch {
        // Non-JSON proxy and network error responses still retain their status.
      }
      return { ok: false, error: message, status: response.status }
    }
    return { ok: true, data: await response.blob() }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      status: 0,
    }
  }
}

export async function uploadGuidedExerciseMedia(
  file: File,
  metadata: GuidedExerciseMediaMetadata,
  key: string,
): Promise<ApiResult<GuidedExerciseMedia>> {
  if (file.size > MAX_GUIDED_MEDIA_BYTES) {
    return {
      ok: false,
      error: 'Playback exceeds the 2 MiB upload limit',
      status: 413,
    }
  }
  const reserved = await apiRequest<{
    media: GuidedExerciseMedia
    uploadUrl: string
    maxByteLength: number
  }>(
    '/api/admin/guided-media',
    jsonInit(
      'POST',
      {
        durationMs: metadata.durationMs,
        source: metadata.source,
        transcript: metadata.transcript,
        locale: metadata.locale ?? 'en-GB',
      },
      key,
    ),
  )
  if (!reserved.ok) return reserved
  if (file.size > reserved.data.maxByteLength) {
    return {
      ok: false,
      error: 'Playback exceeds the server upload limit',
      status: 413,
    }
  }
  const uploaded = await apiRequest<{ media: GuidedExerciseMedia }>(
    reserved.data.uploadUrl,
    {
      method: 'PUT',
      headers: {
        ...adminHeaders(key),
        'Content-Type': playbackMime(file),
      },
      body: file,
    },
  )
  return uploaded.ok
    ? {
        ok: true,
        data: uploaded.data.media,
      }
    : uploaded
}

export async function listGuidedPathAssignments(
  pathId: string,
  key?: string,
): Promise<ApiResult<GuidedPathAssignment[]>> {
  const prefix = key === undefined ? '/api' : '/api/admin'
  const result = await apiRequest<{
    pathId: string
    assignments: GuidedPathAssignment[]
  }>(
    `${prefix}/guided-paths/${encodeURIComponent(pathId)}/assignments`,
    key === undefined ? undefined : { headers: adminHeaders(key) },
  )
  return result.ok ? { ok: true, data: result.data.assignments } : result
}

export async function saveGuidedPathAssignment(
  pathId: string,
  assignment: GuidedPathAssignmentDraft,
  key: string,
): Promise<ApiResult<GuidedPathAssignment>> {
  const result = await apiRequest<{ assignment: GuidedPathAssignment }>(
    `/api/admin/guided-paths/${encodeURIComponent(pathId)}/assignments`,
    jsonInit('POST', { assignment }, key),
  )
  return result.ok ? { ok: true, data: result.data.assignment } : result
}

export async function deleteGuidedPathAssignment(
  assignmentId: string,
  key: string,
): Promise<ApiResult<{ ok: true }>> {
  return apiRequest(
    `/api/admin/guided-path-assignments/${encodeURIComponent(assignmentId)}`,
    {
      method: 'DELETE',
      headers: adminHeaders(key),
    },
  )
}
