// Local database gives standalone rooms a narrow device-only Dexie lifetime.
// ============================================================

import { DexieAdapter } from './adapters/dexie-adapter'

let localDatabase: DexieAdapter | null = null

/** Device-only adapter; standalone route changes create a new document lifetime. */
export function getLocalDatabase(): DexieAdapter {
  localDatabase ??= new DexieAdapter()
  return localDatabase
}
