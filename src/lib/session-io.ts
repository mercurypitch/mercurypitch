// ============================================================
// Session I/O — Export/import full vocal analysis workspace
// ============================================================

import type { Annotation, PaneLayoutState } from '@/types'

export interface WorkspaceSnapshot {
  version: string
  exportedAt: number
  annotations: Annotation[]
  paneLayout: PaneLayoutState
  analysisResults?: {
    onsets?: Array<{
      time: number
      strength: number
      isBeat: boolean
      beatPosition?: number
    }>
    key?: { key: string; tonic: string; mode: string; confidence: number }
    chords?: Array<{
      time: number
      chord: string
      root: string
      quality: string
      confidence: number
    }>
    segments?: Array<{
      startTime: number
      endTime: number
      label: string
      confidence: number
    }>
    detectedBpm?: number
  }
  settings?: Record<string, unknown>
}

/**
 * Export workspace to a downloadable JSON file.
 */
export function exportWorkspace(snapshot: WorkspaceSnapshot): void {
  const json = JSON.stringify(snapshot, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `vocal-analysis-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * Import workspace from a JSON file. Returns the parsed snapshot or null.
 */
export function importWorkspace(file: File): Promise<WorkspaceSnapshot | null> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string) as WorkspaceSnapshot
        if (data.version === undefined || !Array.isArray(data.annotations)) {
          resolve(null)
          return
        }
        resolve(data)
      } catch {
        resolve(null)
      }
    }
    reader.onerror = () => resolve(null)
    reader.readAsText(file)
  })
}
