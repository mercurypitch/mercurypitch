// ============================================================
// Hear Yourself Dry Capture — feature-facing compatibility exports
// ============================================================
//
// The recorder is shared with challenge capture, so its implementation lives
// in lib while this path keeps the feature's established internal API stable.

export * from '@/lib/use-dry-voice-capture'
