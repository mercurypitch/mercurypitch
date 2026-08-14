// ============================================================
// Architecture fitness functions — the layering rules from
// docs/agent/INDEX.md §1, made executable.
// ============================================================
//
// INDEX.md describes a layered design: routes compose features, features own
// their surface, lib holds pure algorithms, stores hold global state. Prose
// cannot enforce that. This file can.
//
//   pnpm arch          # report every violation
//   pnpm arch:graph    # write an SVG of the module graph
//
// Severity is deliberate:
//
//   error  — rules the codebase already satisfies, or is close enough that the
//            remaining violations are individually listed as known debt. These
//            must not grow.
//   warn   — rules the codebase does NOT satisfy today. They are recorded so
//            the number is visible and ratcheted by scripts/code-metrics.mjs,
//            but they do not fail a build, because a permanently red check
//            teaches people to ignore red checks.
//
// When a `warn` rule reaches zero, promote it to `error` and delete this note
// for it. That is the intended direction of travel.

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    // ── Cycles ────────────────────────────────────────────────
    {
      name: 'no-circular',
      comment:
        'A cycle means neither module can be understood, tested, or loaded without the other. ' +
        'It also makes module-init order significant, which is a class of bug that only shows ' +
        'up in production bundling.',
      severity: 'warn',
      from: {},
      to: { circular: true },
    },

    // ── The lib layer must stay pure ──────────────────────────
    // lib is the only layer that is cheap to unit test: no DOM, no reactive
    // graph, no global state. Every import from lib into an upper layer takes
    // a piece of the codebase out of reach of a fast test.
    {
      name: 'lib-no-components',
      comment: 'src/lib is algorithms. It must not depend on UI components.',
      severity: 'error',
      from: { path: '^src/lib/' },
      to: { path: '^src/components/' },
    },
    {
      name: 'lib-no-features',
      comment:
        'src/lib must not depend on src/features. Where lib needs a feature type, that type ' +
        'belongs in lib (or in src/types) and the feature should import it from there.',
      severity: 'warn',
      from: { path: '^src/lib/' },
      to: { path: '^src/features/' },
    },
    {
      name: 'lib-no-stores',
      comment:
        'src/lib must not read global state. A function that reaches into a store cannot be ' +
        'called from a test without booting the store. Pass the value in as an argument.',
      severity: 'warn',
      from: { path: '^src/lib/' },
      to: { path: '^src/stores/' },
    },

    // ── Direction of dependency between UI layers ─────────────
    {
      name: 'components-no-features',
      comment:
        'src/components is the shared/legacy layer; src/features is the newer layer built on ' +
        'top of it. An import in this direction inverts the dependency and is the main reason ' +
        'src/components cannot be extracted or deleted piecemeal.',
      severity: 'warn',
      from: { path: '^src/components/' },
      to: { path: '^src/features/' },
    },
    {
      name: 'stores-no-ui',
      comment:
        'A store is state. It must not import UI. Where a store needs a constant that lives ' +
        'beside a component, move the constant down, not the import up.',
      severity: 'warn',
      from: { path: '^src/stores/' },
      to: { path: '^src/(components|features)/' },
    },
    {
      name: 'db-no-ui',
      comment:
        'src/db is persistence. Importing a feature module into it couples the storage schema ' +
        'to a screen, which is what makes migrations frightening.',
      severity: 'warn',
      from: { path: '^src/db/' },
      to: { path: '^src/(components|features|pages)/' },
    },

    // ── Feature isolation ─────────────────────────────────────
    {
      name: 'no-cross-feature-import',
      comment:
        'A feature reaching into a sibling feature is the coupling that makes features ' +
        'impossible to move or delete. Shared code belongs in src/lib or src/components.',
      severity: 'warn',
      from: { path: '^src/features/([^/]+)/' },
      to: { path: '^src/features/([^/]+)/', pathNot: '^src/features/$1/' },
    },

    // ── Hygiene ───────────────────────────────────────────────
    {
      name: 'no-orphans',
      comment:
        'A module nothing imports is either dead code or a missing wiring.',
      severity: 'warn',
      from: {
        orphan: true,
        pathNot: [
          '(^|/)\\.[^/]+\\.(js|cjs|mjs|ts|json)$',
          '\\.d\\.ts$',
          '^src/(index|worker|share-handler|uvr-container)',
          '(^|/)vite\\.config\\.ts$',
        ],
      },
      to: {},
    },
    {
      name: 'no-deprecated-core',
      comment:
        'Node core modules that have been deprecated should not appear in new code.',
      severity: 'error',
      from: {},
      to: { dependencyTypes: ['core'], path: '^(punycode|domain|sys)$' },
    },
    {
      name: 'not-to-dev-dep',
      comment:
        'Shipped source must not import a devDependency — it will be missing at runtime.',
      severity: 'error',
      from: { path: '^src/', pathNot: '\\.(test|spec)\\.(ts|tsx)$|^src/e2e/' },
      to: { dependencyTypes: ['npm-dev'] },
    },
    {
      name: 'no-non-package-json',
      comment:
        'An import that is not declared in package.json will break a clean install.',
      severity: 'error',
      from: {},
      to: { dependencyTypes: ['npm-no-pkg', 'npm-unknown'] },
    },
  ],

  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: {
      path: [
        '\\.(test|spec)\\.(ts|tsx)$',
        '^src/e2e/',
        '^src/tests/',
        'node_modules',
      ],
    },
    tsConfig: { fileName: 'tsconfig.json' },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
      mainFields: ['module', 'main', 'types', 'typings'],
    },
    reporterOptions: {
      dot: {
        collapsePattern: '^src/(features|components|lib|stores|db|pages)/[^/]+',
      },
      archi: {
        collapsePattern: '^src/(features|components|lib|stores|db|pages)/[^/]+',
      },
    },
  },
}
