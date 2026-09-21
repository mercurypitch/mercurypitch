// Audit-only ESLint config — NOT part of the everyday `pnpm check` gate.
//
// Wires eslint-plugin-security (data-flow / injection / timing rules) and
// eslint-plugin-sonarjs (cognitive-complexity, duplicate-code, bug-pattern
// smells) for the DevSecOps audit. Run via `pnpm lint:audit`. All rules are
// emitted as warnings so a run never fails CI and never blocks the main gate;
// the JSON output feeds `.audit_telemetry/eslint_results.json`.
//
// eslint-plugin-security is scoped to backend/worker + src; its noisiest rule
// (detect-object-injection, which fires on every bracket/Map access) is off.

import security from 'eslint-plugin-security'
import solid from 'eslint-plugin-solid'
import sonarjs from 'eslint-plugin-sonarjs'
import tseslint from 'typescript-eslint'

/** Re-emit every rule in a flat-config block as a warning. */
function asWarnings(config) {
  const rules = {}
  for (const name of Object.keys(config.rules ?? {})) rules[name] = 'warn'
  return { ...config, rules }
}

export default tseslint.config(
  {
    ignores: [
      '**/dist',
      '**/node_modules',
      '**/coverage',
      '**/.pnpm-store',
      '**/*.css.d.ts',
      '**/*.spec.ts',
      '**/*.test.ts',
      '**/e2e/**',
      'docs/**',
    ],
  },
  // Non-type-checked TS parse — safe across both the app tsconfig and the
  // workers, which are not in the root project's `include`.
  ...tseslint.configs.recommended,
  // Security rules on the real attack surface (workers) and the app source.
  {
    files: ['workers/**/*.ts', 'src/**/*.{ts,tsx}'],
    ...asWarnings(security.configs.recommended),
    rules: {
      ...asWarnings(security.configs.recommended).rules,
      'security/detect-object-injection': 'off',
    },
  },
  // Code-smell / maintainability rules across all source.
  {
    files: ['src/**/*.{ts,tsx}', 'workers/**/*.ts'],
    ...asWarnings(sonarjs.configs.recommended),
  },
  // Silence the purely-stylistic / false-positive-prone sonarjs rules so the
  // actionable signal (complexity, duplication, bug patterns) stands out.
  {
    files: ['src/**/*.{ts,tsx}', 'workers/**/*.ts'],
    rules: {
      'sonarjs/arrow-function-convention': 'off',
      'sonarjs/no-implicit-dependencies': 'off',
      'sonarjs/no-reference-error': 'off',
      'sonarjs/file-header': 'off',
      'sonarjs/shorthand-property-grouping': 'off',
      'sonarjs/void-use': 'off',
      'sonarjs/no-undefined-assignment': 'off',
      'sonarjs/max-union-size': 'off',
      'sonarjs/elseif-without-else': 'off',
      'sonarjs/no-built-in-override': 'off',
      'sonarjs/variable-name': 'off',
    },
  },
  // eslint-plugin-solid, registered for one reason: this config's job is
  // complexity and security, but without the plugin every
  // `// eslint-disable-next-line solid/reactivity` in src — 143 of them, all
  // legitimate under the everyday gate — is reported as "Definition for rule
  // 'solid/reactivity' was not found". That made 145 of this config's 275
  // errors artefacts of the config rather than defects in the code, and the
  // count grew every time someone correctly suppressed the rule.
  //
  // Severity matches eslint.config.js (warn, pending a dedicated cleanup
  // pass), so a suppression the main gate accepts is never an audit error.
  // Scoped to src: workers carry no JSX and no solid directives.
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { solid },
    rules: {
      'solid/reactivity': 'warn',
      'solid/prefer-for': 'warn',
    },
  },
  // The everyday gate's ignore patterns (eslint.config.js:105-113), carried
  // over verbatim. `no-unused-vars` arrives as an error from
  // tseslint.configs.recommended above; without these patterns it fires on
  // every deliberately underscore-prefixed name — 127 of them — which is a
  // convention this repo enforces, not a defect it tolerates. A name the main
  // gate is happy with must not read as an audit finding, or the errors this
  // config reports cannot be trusted enough to act on.
  {
    files: ['src/**/*.{ts,tsx}', 'workers/**/*.ts'],
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
    },
  },
)
