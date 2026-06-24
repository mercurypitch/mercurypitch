// ============================================================
// Annotation Store — Sonic Visualiser-style annotation CRUD
// ============================================================

import { createPersistedSignal } from '@/lib/storage'
import type { Annotation, AnnotationType, Region, TimeInstant, TimeValue, } from '@/types'

const STORAGE_KEY = 'pitchperfect_annotations'

export const [annotations, setAnnotations] = createPersistedSignal<
  Annotation[]
>(STORAGE_KEY, [])

let _nextId = 1

/** Generate a unique annotation ID. */
function generateId(): string {
  return `ann_${Date.now()}_${_nextId++}`
}

// ── CRUD ────────────────────────────────────────────────────────

// Using a looser type here because TypeScript's strict discriminated unions
// don't play well with Omit<> across union members.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnnotationInput = Record<string, any> & {
  type: AnnotationType
  time: number
}

export function addAnnotation(input: AnnotationInput): Annotation {
  const newAnnotation: Annotation = {
    ...input,
    id: generateId(),
    createdAt: Date.now(),
  } as Annotation
  setAnnotations((prev) => [...prev, newAnnotation])
  return newAnnotation
}

export function removeAnnotation(id: string): void {
  setAnnotations((prev) => prev.filter((a) => a.id !== id))
}

export function updateAnnotation(
  id: string,
  updates: Partial<Annotation>,
): void {
  setAnnotations((prev) =>
    prev.map((a) => (a.id === id ? ({ ...a, ...updates } as Annotation) : a)),
  )
}

// ── Queries ─────────────────────────────────────────────────────

export function getAnnotationsInRange(
  startTime: number,
  endTime: number,
): Annotation[] {
  return annotations().filter((a) => {
    if (a.type === 'region') {
      const r = a as Region
      return r.time <= endTime && r.endTime >= startTime
    }
    return a.time >= startTime && a.time <= endTime
  })
}

export function getAnnotationsByType(type: AnnotationType): Annotation[] {
  return annotations().filter((a) => a.type === type)
}

export function getAnnotationsBySession(sessionId: string): Annotation[] {
  return annotations().filter((a) => a.sessionId === sessionId)
}

// ── Helpers ─────────────────────────────────────────────────────

export function createTimeInstant(
  time: number,
  label?: string,
  sessionId?: string,
): TimeInstant {
  return addAnnotation({
    type: 'instant',
    time,
    label,
    source: 'manual',
    sessionId,
  }) as TimeInstant
}

export function createTimeValue(
  time: number,
  value: number,
  valueUnit: TimeValue['valueUnit'],
  label?: string,
): TimeValue {
  return addAnnotation({
    type: 'value',
    time,
    value,
    valueUnit,
    label,
    source: 'manual',
  }) as TimeValue
}

export function createRegion(
  time: number,
  endTime: number,
  label?: string,
): Region {
  return addAnnotation({
    type: 'region',
    time,
    endTime,
    label,
    source: 'manual',
  }) as Region
}

// ── CSV Export ──────────────────────────────────────────────────

export function exportAnnotationsCSV(): string {
  const header = 'time,type,label,value,endTime'
  const rows = annotations().map((a) => {
    const label = a.label ?? ''
    if (a.type === 'instant') {
      return `${a.time.toFixed(3)},instant,"${label}",,`
    } else if (a.type === 'value') {
      return `${a.time.toFixed(3)},value,"${label}",${a.value},`
    } else {
      const r = a as Region
      return `${r.time.toFixed(3)},region,"${label}",${r.value ?? ''},${r.endTime.toFixed(3)}`
    }
  })
  return [header, ...rows].join('\n')
}

// ── CSV Import ──────────────────────────────────────────────────

export function importAnnotationsCSV(csv: string): Annotation[] {
  const lines = csv.trim().split('\n')
  if (lines.length < 2) return []

  const imported: Annotation[] = []
  // Skip header row
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    // Simple CSV parse: split by comma, respecting quoted fields
    const parts = parseCSVLine(line)
    if (parts.length < 3) continue

    const time = parseFloat(parts[0]!)
    const type = parts[1] as AnnotationType
    const label = parts[2] || undefined

    if (isNaN(time) || time < 0) continue

    if (type === 'instant') {
      imported.push(createTimeInstant(time, label))
    } else if (type === 'value') {
      const value = parseFloat(parts[3]!)
      if (isNaN(value)) continue
      imported.push(createTimeValue(time, value, 'cents', label))
    } else if (type === 'region') {
      const value = parts[3] ? parseFloat(parts[3]) : undefined
      const endTime = parseFloat(parts[4]!)
      if (isNaN(endTime)) continue
      const region = addAnnotation({
        type: 'region',
        time,
        endTime,
        label,
        value: value !== undefined && !isNaN(value) ? value : undefined,
        source: 'manual',
      }) as Region
      imported.push(region)
    }
  }

  return imported
}

/** Parse a single CSV line respecting quoted fields. */
function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (const ch of line) {
    if (ch === '"') {
      inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  result.push(current)
  return result
}

// ── Bulk Operations ─────────────────────────────────────────────

export function clearAnnotations(): void {
  setAnnotations([])
  _nextId = 1
}

export function count(): number {
  return annotations().length
}
