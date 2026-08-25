// Play-along band preparation ports keep the paid full-band split injectable.
// ============================================================

export type PlayAlongBandPreparationPhase =
  | 'opening'
  | 'uploading'
  | 'processing'
  | 'saving'
  | 'opening-song'

export interface PlayAlongBandPreparationUpdate {
  phase: Exclude<PlayAlongBandPreparationPhase, 'opening' | 'opening-song'>
  progress: number
  detail?: string
}

export interface PlayAlongBandPreparationResult {
  saved: readonly string[]
}

export interface PlayAlongBandPreparationPort {
  /**
   * Reconnect an already-durable result without entering a billable path.
   * `null` means the caller must authorize and run prepareBand instead.
   */
  reusePreparedBand?(
    sessionId: string,
    options: { signal: AbortSignal },
  ): Promise<PlayAlongBandPreparationResult | null>
  prepareBand(
    sessionId: string,
    options: {
      signal: AbortSignal
      onUpdate(update: PlayAlongBandPreparationUpdate): void
    },
  ): Promise<PlayAlongBandPreparationResult>
}
