// Archive outcome diagnostics — portable-only primitives correlate earned notes with app inactivity.
export function reportArchiveOutcome(
  levelId: string,
  itemId: string,
  outcome: 'awaken' | 'protection',
): void {
  if (import.meta.env.VITE_PORTABLE_CONSOLE !== 'true') return
  console.info('[Glassworks Archive outcome]', {
    levelId: levelId.slice(0, 100),
    itemId: itemId.slice(0, 100),
    outcome,
    at: Date.now(),
    elapsedMs: Math.round(performance.now()),
    visibility: document.visibilityState,
    focused: document.hasFocus(),
  })
}
