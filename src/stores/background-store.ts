// ============================================================
// Premium background store compatibility facade
// ============================================================
//
// The account-safe catalog store is route-neutral so standalone surfaces can
// use it without importing the main application store graph. Existing app
// imports remain valid through this facade while they migrate incrementally.

export * from '@/lib/backgrounds/background-catalog-store'
