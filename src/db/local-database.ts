// Local database gives standalone rooms a narrow read-only Dexie lifetime.
// ============================================================

import { DexieAdapter } from './adapters/dexie-adapter'

let localDatabase: DexieAdapter | null = null

/** Standalone-only adapter; route changes create a new document and lifetime. */
export function getLocalDatabase(): DexieAdapter {
  localDatabase ??= new DexieAdapter()
  return localDatabase
}
