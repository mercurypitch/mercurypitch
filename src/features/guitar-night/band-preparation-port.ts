// Guitar Night band preparation port keeps the second separation pass behind an injectable boundary.
// ============================================================

export type GuitarNightBandPreparationPhase =
  | 'opening'
  | 'uploading'
  | 'processing'
  | 'saving'
  | 'opening-song'

export interface GuitarNightBandPreparationUpdate {
  phase: Exclude<GuitarNightBandPreparationPhase, 'opening' | 'opening-song'>
  progress: number
  detail?: string
}

export interface GuitarNightBandPreparationResult {
  saved: readonly string[]
}

export interface GuitarNightBandPreparationPort {
  prepareBand(
    sessionId: string,
    options: {
      signal: AbortSignal
      onUpdate(update: GuitarNightBandPreparationUpdate): void
    },
  ): Promise<GuitarNightBandPreparationResult>
}
