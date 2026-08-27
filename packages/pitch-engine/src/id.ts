// ============================================================
// Unique ID Generator
// ============================================================

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}-${Math.random().toString(36).substring(2, 9)}`
}

export function generateSessionItemId(): string {
  return `item-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}
