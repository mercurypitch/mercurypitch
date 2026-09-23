// ============================================================
// Melody reference playback contract — platform output for one compiled curve.
// ============================================================

export interface MelodyReferencePlayer {
  /** Resolves only when the audio clock passes the complete compiled melody. */
  play(onProgress?: (timelineSeconds: number) => void): Promise<void>
  /** Cancel pending playback with a bounded audible release. */
  stop(): void
  dispose(): void
}
