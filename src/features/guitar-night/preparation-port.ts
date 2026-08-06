// ============================================================
// Guitar Night preparation port keeps the room independent from separation stores and workers
// ============================================================

export type GuitarNightPreparationPhase =
  | 'checking-library'
  | 'saving-original'
  | 'preparing'
  | 'separating'
  | 'finalizing'

export interface GuitarNightPreparationUpdate {
  phase: GuitarNightPreparationPhase
  progress: number | null
}

export type GuitarNightPreparationResult =
  | { status: 'completed'; sessionId: string }
  | { status: 'existing'; sessionId: string }
  | {
      status: 'in-flight'
      sessionId: string
      requiresHydration?: boolean
    }
  | { status: 'cancelled'; sessionId?: string }
  | { status: 'error'; sessionId?: string; message: string }

export interface GuitarNightPreparationPort {
  prepare(
    file: File,
    options: {
      signal: AbortSignal
      onUpdate(update: GuitarNightPreparationUpdate): void
      onWarning(message: string): void
    },
  ): Promise<GuitarNightPreparationResult>
}
