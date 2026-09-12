// ============================================================
// Purchase kit — the build-time rules every store bundle must satisfy
// ============================================================
//
// The `.ts` extensions are load-bearing, not a style choice. This module is
// imported from a `vite.config.ts`, and Vite externalises a workspace package
// when it bundles a config file -- so the re-export below is resolved by
// Node's own ESM loader, which requires a real file extension. Without them
// both apps fail before their build starts:
//
//   Error [ERR_MODULE_NOT_FOUND]: Cannot find module
//   .../packages/purchase-kit/src/build-policy imported from
//   .../packages/purchase-kit/src/index.ts
//
// `allowImportingTsExtensions` in this package's tsconfig is what lets
// TypeScript accept them; it is safe here because the package is never
// emitted -- consumers compile it from source.

export type { PurchaseBuildPolicy } from './build-policy.ts'
export { assertPurchaseBuildSafe } from './build-policy.ts'
export type {
  ReviewUnlock,
  ReviewUnlockGrant,
  ReviewUnlockOptions,
  ReviewUnlockOutcome,
  ReviewUnlockResult,
  ReviewUnlockStorage,
} from './review-unlock.ts'
export {
  createReviewUnlock,
  REVIEW_CODE_ALPHABET,
  isReviewUnlockDigest,
  normalizeReviewCode,
  readReviewGrant,
  reviewUnlockDigestInput,
  serializeReviewGrant,
} from './review-unlock.ts'
