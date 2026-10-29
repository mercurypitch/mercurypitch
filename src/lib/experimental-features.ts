// ============================================================
// Experimental features — their names, the switch's shape, and how one resolves
// ============================================================
//
// One list for every side. The db-worker stores and serves a switch only for
// a name here (workers/db-worker/src/experimental-feature-routes.ts), the app
// gates a surface on one (src/stores/experimental-features-store.ts), and
// the owner's console offers whatever the worker says is here. Adding a
// feature is one line in EXPERIMENTAL_FEATURES; graduating one is deleting
// that line and the gates that ask for it.
//
// A feature is on by default where the build says so (dev.mercurypitch.com,
// PR previews, `pnpm dev`, the e2e bundle) and off in the production web
// build and the native app (tools/experimental-features.ts). A switch the
// owner sets for an environment wins over that default either way, so the
// toggle is a real on and off; clearing it hands the feature back to the
// build.
//
// Two readers, as lesson-state.ts has them: parseFeatureOverrides is tolerant
// (a page keeps working when the API answers a name it does not know), and
// parseFeatureSwitch is strict (it guards the one write).
//
// Pure and import-free: the db-worker compiles it in, and deploy-db.yml lists
// this file so a change here redeploys the dev worker.

/** Every experimental feature, by the name its switch is stored and sent under. */
export const EXPERIMENTAL_FEATURES = ['studio'] as const

export type ExperimentalFeature = (typeof EXPERIMENTAL_FEATURES)[number]

/** The switches that are set, as GET /api/features answers them. Absent: the build's default. */
export type FeatureOverrides = Partial<Record<ExperimentalFeature, boolean>>

/** The public read: the switches the owner has set, and only those. */
export const FEATURES_PATH = '/api/features'

/** The admin routes: GET lists every feature, PUT `/<name>` sets or clears one. */
export const ADMIN_FEATURES_PATH = '/api/admin/features'

/** One feature as the admin read lists it. */
export interface FeatureSwitchRow {
  name: ExperimentalFeature
  /** The owner's switch, or null when the build's default stands. */
  enabled: boolean | null
  /** When the switch last changed; null when there is none. */
  updatedAt: string | null
}

/** GET /api/admin/features: every feature, set or not, in list order. */
export interface FeatureSwitches {
  features: FeatureSwitchRow[]
}

/** PUT /api/admin/features/:name: the feature as it stands, and whether the call moved it. */
export interface FeatureSwitchSave {
  row: FeatureSwitchRow
  changed: boolean
}

export type FeatureSwitchPatch =
  | { ok: true; enabled: boolean | null }
  | { ok: false; error: string }

export function isExperimentalFeature(
  value: unknown,
): value is ExperimentalFeature {
  return (EXPERIMENTAL_FEATURES as readonly unknown[]).includes(value)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * The switches in an answer from GET /api/features: a known name with a
 * boolean. Anything else, a whole answer that is not an object included,
 * reads as no switch at all, which is the build's default.
 */
export function parseFeatureOverrides(value: unknown): FeatureOverrides {
  const overrides: FeatureOverrides = {}
  if (!isRecord(value)) return overrides
  for (const name of EXPERIMENTAL_FEATURES) {
    const enabled = value[name]
    if (typeof enabled === 'boolean') overrides[name] = enabled
  }
  return overrides
}

/** A feature as a page shows it: the owner's switch where one is set, the build's default otherwise. */
export function resolveExperimentalFeature(
  name: ExperimentalFeature,
  buildDefault: boolean,
  overrides: FeatureOverrides,
): boolean {
  return overrides[name] ?? buildDefault
}

/**
 * The body of PUT /api/admin/features/:name: exactly `{"enabled": true}`,
 * `{"enabled": false}` or `{"enabled": null}`, the last handing the feature
 * back to the build's default. Any other field is refused, so a misspelled
 * one cannot read as saved while changing nothing.
 */
export function parseFeatureSwitch(value: unknown): FeatureSwitchPatch {
  if (!isRecord(value)) {
    return { ok: false, error: 'Body must be a JSON object' }
  }
  const extra = Object.keys(value).filter((key) => key !== 'enabled')
  if (extra.length > 0) {
    return { ok: false, error: `Unknown field: ${extra.join(', ')}` }
  }
  const { enabled } = value
  if (enabled === null || typeof enabled === 'boolean') {
    return { ok: true, enabled }
  }
  return { ok: false, error: 'enabled must be true, false or null' }
}
