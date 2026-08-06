# Supporter Feature Perks — EARS Requirements

Requirements for group-assigned early-access features, the authenticated Lab
gate, Admin Premium Perks Studio, and supporter benefit copy.

**Source:** `src/lib/supporter-feature-catalog.ts`,
`src/lib/backgrounds/background-access.ts`, `src/pages/LabPage.tsx`,
`src/features/admin/premium-perks-admin-service.ts`,
`src/features/admin/AdminPremiumPerksPage.tsx`,
`workers/db-worker/src/supporter-feature-access.ts`,
`workers/db-worker/src/premium-background-admin.ts`,
`workers/db-worker/migrations/0019_supporter_feature_perks.sql`
**Tests:** `src/lib/backgrounds/background-access.test.ts`,
`src/tests/lab-page.test.tsx`, `src/tests/admin-premium-perks-page.test.tsx`,
`src/tests/premium-perks-admin-service.test.ts`,
`workers/db-worker/src/supporter-feature-access.test.ts`,
`workers/db-worker/src/premium-background-admin.test.ts`,
`workers/db-worker/node-tests/supporter-feature-migration.test.ts`

EARS keywords: **WHEN** (event), **WHILE** (state), **IF/THEN** (unwanted
behavior), **WHERE** (optional feature), otherwise ubiquitous ("shall").

## Access authority — `FEATURE-ACCESS-*`

- **FEATURE-ACCESS-1** — The system shall define assignable supporter feature identifiers in one typed allowlist shared by the Worker, Admin Studio, and app client.
- **FEATURE-ACCESS-2** — WHILE an account has an active supporter entitlement, the system shall grant active features assigned to the reserved automatic `active-supporters` group.
- **FEATURE-ACCESS-3** — WHILE a verified account email belongs to an active manual supporter group, the system shall grant that group's active feature assignments independently of supporter status.
- **FEATURE-ACCESS-4** — IF an email is unverified, a supporter expiry is expired or malformed, a group is inactive or deleted, or an assignment is revoked, THEN the system shall not grant the feature through that evidence.
- **FEATURE-ACCESS-5** — The authenticated `/api/perks/me` response shall return current feature identifiers resolved from the environment-local main D1 authority.
- **FEATURE-ACCESS-6** — The Worker and app shall discard unknown feature identifiers, and the app shall not derive feature access from local storage, query parameters, or the former advanced-features preference.
- **FEATURE-ACCESS-7** — WHEN authentication changes, Lab is revisited, the page regains focus, or the user requests another check, the app shall refresh feature access so grants and revocations take effect without a local flag.

## Lab route — `FEATURE-LAB-*`

- **FEATURE-LAB-1** — WHILE the Lab access check is pending, the Lab deep link shall show a compact, nonblank checking state.
- **FEATURE-LAB-2** — IF Lab access is unavailable or denied, THEN the Lab deep link shall show a compact explanation, a retry action, and a link to Settings Credits supporter benefits.
- **FEATURE-LAB-3** — The production app shall not import or render `LabSurface` until the authenticated Worker grants `lab-access`; an explicit development build may bypass the grant.
- **FEATURE-LAB-4** — WHILE `lab-access` is granted, the existing `lab`, `pitch-test`, and `pitch-algo` deep links shall open their matching Lab tool without adding Lab to the normal tab bar.

## Administration and donation copy — `FEATURE-STUDIO-*`

- **FEATURE-STUDIO-1** — Every feature assignment route shall use the existing admin resolver, reject identifiers outside the typed catalog, guard mutations against a concurrently deleted group, and append an immutable audit event after a successful mutation.
- **FEATURE-STUDIO-2** — WHEN an admin assigns or revokes a feature in Premium Perks Studio, the refreshed group ledger shall show the current assignment state.
- **FEATURE-STUDIO-3** — The system shall not delete a manual supporter group while it has an active feature assignment.
- **FEATURE-STUDIO-4** — Migration `0019` shall seed `lab-access` for the automatic active-supporters group and shall remain replay-safe without restoring an intentionally revoked row.
- **FEATURE-STUDIO-5** — Migration `0019` shall append the Lab benefit to every donation plan without replacing valid operator-authored perk bullets or duplicating the benefit on replay.
- **FEATURE-STUDIO-6** — Settings Credits shall state that core singing and practice tools remain free while supporter status adds optional backgrounds, recognition, and early Lab access.
