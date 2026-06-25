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
)
