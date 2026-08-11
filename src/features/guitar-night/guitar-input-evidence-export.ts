// Query-gated input evidence export emits take metadata and never raw audio.
// ============================================================

import type { GuitarInputEvidenceReport } from '@/lib/guitar/guitar-input-benchmark'
import { buildGuitarInputEvidenceReport, serializeGuitarInputEvidenceReport, } from '@/lib/guitar/guitar-input-benchmark'
import type { GuitarTakeSnapshot } from '@/lib/guitar/guitar-take-recorder'

export const GUITAR_INPUT_EVIDENCE_QUERY = 'input-evidence'

export function guitarInputEvidenceExportEnabled(search?: string): boolean {
  const value =
    search ?? (typeof window === 'undefined' ? '' : window.location.search)
  return new URLSearchParams(value).get(GUITAR_INPUT_EVIDENCE_QUERY) === '1'
}

export function buildGuitarTakeEvidenceReport(
  take: GuitarTakeSnapshot,
  createdAt = new Date().toISOString(),
): GuitarInputEvidenceReport {
  const attacks = take.events.filter((event) => event.kind === 'attack').length
  const pitchChanges = take.events.filter(
    (event) => event.kind === 'pitch-change',
  ).length
  const releases = take.events.filter(
    (event) => event.kind === 'release',
  ).length
  return buildGuitarInputEvidenceReport({
    createdAt,
    evidenceOrigin: 'real-device-run',
    hardwareValidation: 'user-captured-unverified',
    fixture: null,
    input: take.input,
    runtime: {
      browser:
        typeof navigator === 'undefined' ? null : navigator.userAgent || null,
      platform:
        typeof navigator === 'undefined' ? null : navigator.platform || null,
      appVersion: null,
    },
    take: {
      id: take.id,
      lifecycle: take.lifecycle,
      sampleRate: take.clock.sampleRate,
      timingSource: take.clock.attack.timingSource,
      precision: take.clock.attack.precision,
      latencySeconds: take.clock.latency.seconds,
      latencyProvenance: take.clock.latency.provenance,
      latencyUncertaintySeconds: take.clock.latency.uncertaintySeconds,
      eventCounts: { attacks, pitchChanges, releases },
      truncated: take.truncated,
    },
    attack: null,
    pitch: null,
  })
}

export function downloadGuitarInputEvidenceReport(
  report: GuitarInputEvidenceReport,
  search?: string,
): boolean {
  if (!guitarInputEvidenceExportEnabled(search)) return false
  if (
    typeof document === 'undefined' ||
    typeof URL.createObjectURL !== 'function'
  ) {
    return false
  }
  const url = URL.createObjectURL(
    new Blob([serializeGuitarInputEvidenceReport(report)], {
      type: 'application/json',
    }),
  )
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `guitar-input-evidence-${report.createdAt.replace(/[:.]/g, '-')}.json`
  anchor.click()
  URL.revokeObjectURL(url)
  return true
}
