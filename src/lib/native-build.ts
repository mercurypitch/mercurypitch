// ============================================================
// Which build am I in
// ============================================================
//
// The one place `__NATIVE_BUILD__` is read. Both Vite configs define it, so
// this constant-folds to a literal `true` or `false` before Rollup runs —
// which is the point: a branch guarded by it is dead code in one of the two
// builds and is eliminated outright, taking whatever it imports with it. A
// runtime flag would only hide the UI; this removes it from the bundle.
//
// Under vitest it is neither: `vitest.config.ts` has no `define` block, so the
// identifier survives and reading it bare would be a ReferenceError. The
// `typeof` guard is what makes the module safe to import from a test, and it
// is the same idiom `src/lib/defaults.ts` uses for `__COMMIT_SHA__`.

// Declared here as well as in src/vite-env.d.ts: the db worker type-checks
// this module through the background catalogue (workers/db-worker perks.ts),
// and its program has no Vite globals. Ambient, so it emits nothing.
declare const __NATIVE_BUILD__: boolean | undefined
declare const __KARAOKE_IMPORT__: boolean | undefined
declare const __UVR_ORIGIN__: string | undefined

/** True only inside the `apps/mercurypitch` bundle. False on the web, and
 *  false under vitest — where a test that needs the other answer mocks
 *  `@/lib/native-build`. */
export const IS_NATIVE_BUILD: boolean =
  typeof __NATIVE_BUILD__ !== 'undefined' && __NATIVE_BUILD__

/**
 * Whether this build may offer a way to spend money — credit packs, the
 * supporter tiers, a donation link, or a button that only leads to one.
 *
 * Read this, not `IS_NATIVE_BUILD`, wherever the question is about money.
 * The two give the same answer today for different reasons, and only one of
 * them changes: when in-app purchase lands, credits become buyable inside
 * the store binary and exactly this constant flips. A call site that asked
 * "am I native?" would then have to be found and re-read one by one.
 *
 * A build that answers false must not merely hide the purchase: it must
 * not carry the link, the price, or the words either. App Store guideline
 * 3.1.1 and Play's billing policy are read against the binary.
 */
export const CAN_TAKE_PAYMENT: boolean = !IS_NATIVE_BUILD

/**
 * Whether the Karaoke room offers to import a singer's own songs, which the
 * server separates (plan S8, Stage 2). On in a native test build, TestFlight
 * among them; off in the store build until the subscription is real; never
 * on the web, which has its own upload. Compiled in or out like
 * `IS_NATIVE_BUILD`, so the store build carries none of it
 * (apps/mercurypitch/api-base.mjs decides, from the worker switch).
 */
export const KARAOKE_IMPORT: boolean =
  IS_NATIVE_BUILD &&
  typeof __KARAOKE_IMPORT__ !== 'undefined' &&
  __KARAOKE_IMPORT__

/**
 * Whether this build carries the premium exercises (Long note first). They
 * ride the Karaoke subscription (owner, 9 Oct 2026), so they ship in exactly
 * the builds the subscription does: a native test build, TestFlight among
 * them, and not the store build until the V1 flip puts the subscription in
 * it. Folded like `KARAOKE_IMPORT`, so the store build carries none of their
 * code (assert-bundle.mjs STAGE 2). The flip must turn their own gate on
 * with it (`PREMIUM_GATE`): a build that answers true and leaves the gate
 * off opens them to everyone, as TestFlight does today.
 */
export const PREMIUM_EXERCISES: boolean = KARAOKE_IMPORT

/**
 * Whether the premium rooms hold back once their free taste is used: so
 * many finished runs each (src/lib/free-taste.ts), then the Cloud offer in
 * the room's place, for a singer without the subscription. Off until the V1
 * flip, which turns it on beside the subscription in the store build. A
 * test build can try it before then from the Developer screen's Free taste
 * switch (src/stores/free-taste-store.ts), which leaves this alone.
 */
export const PREMIUM_GATE: boolean = false

/**
 * Whether this build carries the native app's own onboarding (plans S7 and
 * S7b): Merc, the first note and what follows it, from the first Sing door
 * of a new install. It ships with the offer screens it leads to, in one
 * release (owner, 16 Oct 2026), so it is on in exactly the builds the Cloud
 * offer is: a native test build, TestFlight among them, and not the store
 * build until the V1 flip. Folded like `KARAOKE_IMPORT`, so the store build
 * carries none of it (assert-bundle.mjs STAGE 2).
 */
export const NATIVE_ONBOARDING: boolean = KARAOKE_IMPORT

/**
 * Whether this build carries the Ear Lab with Merc: the phone's own Ear Lab
 * tab (the room, the glass, Today and the six stations) and the drill room
 * every one of the nineteen instruments runs in, Merc at its console. It is
 * a new face on the same drills: their engines, their honesty rules and
 * their words are the web's, and the web keeps the bench it has. On in a
 * native test build, TestFlight among them, so the owner can play it before
 * it ships, and off in the store build until the owner flips it. Folded like
 * `KARAOKE_IMPORT`, so the store build carries none of it (assert-bundle.mjs
 * STAGE 2): the room and the tab are one lazy chunk behind this constant
 * (EarStage.tsx, EarLabPage.tsx).
 */
export const EAR_LAB_WITH_MERC: boolean = KARAOKE_IMPORT

/**
 * Whether this build carries Leagues and the weekly challenge on the phone
 * (docs/plans/native-more-and-community.md, slices 2 and 3): the More
 * sheet's Together group, the Leagues screen, the Legend room and the
 * league and Legend the group's rows name. On in every build, the store
 * build among them, since the owner's go (3 Nov 2026: "as for leagues sure
 * if we have things ready it can go in"); before that it rode
 * `KARAOKE_IMPORT`, on in test builds alone. The constant stays so the
 * owner can take Leagues back out of a store build with one line: the
 * screens are still lazy chunks behind it (NativeShell.tsx), so a build
 * that never opens them never loads them.
 */
export const NATIVE_LEAGUES: boolean = true

/**
 * Whether this build carries Community on the phone
 * (docs/plans/native-more-and-community.md, slice 4c): the More sheet's
 * Community row, the screens it pushes (what other singers shared, the
 * singer's own profile, a shared result) and the line the row says. A
 * switch of its own, because its store gate is the moderation work, not a
 * product call: never flipped before report, block, the name filter and
 * the contact line are live (App Store guideline 1.2). On in a native test
 * build, TestFlight among them, off in the store build, and folded like
 * `KARAOKE_IMPORT`, so the store build carries none of it
 * (assert-bundle.mjs STAGE 2): the screens are lazy chunks behind this
 * constant (NativeShell.tsx), and the store the row reads is free of side
 * effects in the native config.
 */
export const NATIVE_COMMUNITY: boolean = KARAOKE_IMPORT

/**
 * Whether this build draws the Progress tab as the native app's own page
 * (apps/mercurypitch/src/shell/progress): the same record as the web's
 * page (useProgressRecord, progress-view-model.ts), in the native rooms'
 * cards, sheets and icons. On in a native test build, TestFlight among
 * them, and off in the store build, which keeps the web page under the
 * shell, until the owner flips it. Folded like `KARAOKE_IMPORT`, so the
 * store build carries none of it (assert-bundle.mjs STAGE 2): the page is
 * a lazy chunk the shell lends the app through the bridge (NativeShell.tsx,
 * App.tsx), and a build with it carries no chunk of the web page.
 */
export const NATIVE_PROGRESS: boolean = KARAOKE_IMPORT

/**
 * The origin `/api/uvr/*` is asked on. Empty on the web, whose page is on
 * the worker that serves it. A native page is on capacitor://localhost, so
 * a native build names the web host that goes with its db-worker.
 */
export const UVR_ORIGIN: string =
  IS_NATIVE_BUILD && typeof __UVR_ORIGIN__ === 'string' ? __UVR_ORIGIN__ : ''
