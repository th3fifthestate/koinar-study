// app/eslint.config.mjs
//
// Next.js 16 flat ESLint config. Rules sourced from:
//   - eslint-config-next/core-web-vitals (core-web-vitals-hardened Next rules)
//   - eslint-config-next/typescript     (typescript-eslint/recommended)
//
// CLAUDE.md §1 tooling baseline: this gate catches React/Next hazards and
// gratuitous `any`/`unused-vars` before they land. Hook rule violations are
// errors (exhaustive-deps, rules-of-hooks) because the cost of a subtle infinite
// loop in production dwarfs the reconfiguration cost.
//
// Local overrides keep the config opinionated-but-shippable:
//   - react/no-unescaped-entities OFF — unicode apostrophes are intentional
//     throughout the hero/editorial copy, which this rule doesn't handle well.
//   - @typescript-eslint/no-unused-vars configured to allow a leading `_` prefix
//     so "intentionally unused" can be expressed without suppressing the rule.
//   - @typescript-eslint/no-explicit-any DOWNGRADED to warn — many library
//     boundary types still legitimately return `any`, and failing CI on every
//     unmigrated call site blocks the whole audit. Warn keeps them visible.
//
// Add /* eslint-disable-next-line <rule> -- <reason> */ rather than globally
// disabling. If you find yourself reaching for a global disable, flag it here.

import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  {
    rules: {
      // Intentional stylized copy (e.g. "we've", "don't") already renders
      // correctly without &apos;/&rsquo; escapes. This rule produces a large
      // volume of false positives on editorial text and we've decided to let
      // Prettier/our own review catch typos.
      'react/no-unescaped-entities': 'off',

      // Allow `_`-prefixed args / vars to opt out of the rule without a
      // blanket suppression. Caught-error args are lenient because `catch (e)`
      // blocks are often intentionally ignored.
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrors: 'none',
          ignoreRestSiblings: true,
        },
      ],

      // Keep visible but don't block CI while we migrate untyped library
      // boundaries. Flip back to 'error' once the outstanding surface is under
      // 20 hits (measured by: `npx eslint . | grep no-explicit-any | wc -l`).
      '@typescript-eslint/no-explicit-any': 'warn',

      // React 19 compiler advisories — downgraded to `warn` as a migration
      // posture. All four rules are new in Next 16 / React 19 and fire on
      // patterns that are idiomatic today (SSR hydration via setState in
      // useEffect, Date.now()/Math.random() at render time, forward refs to
      // useCallback-wrapped functions, ref.current reads during render).
      //
      // The compiler-enforced refactor to move these into effects / event
      // handlers / useMemo is substantial (35+ call sites across the
      // reader, bench, and admin surfaces). We surface the violations so
      // they don't get forgotten, but we don't block CI on them while
      // Stream D and the post-alpha work is in flight.
      //
      // Acceptance for flipping back to 'error': each rule must be clean on
      // `npm run lint`, tracked as part of the React-compiler migration
      // brief.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/refs': 'warn',
    },
  },

  // Scripts + tests are allowed to be looser with types. They're not shipped
  // to users and don't hit the React/Next rules anyway.
  {
    files: ['scripts/**/*.ts', '**/*.test.ts', '**/*.test.tsx'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'warn',
    },
  },

  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'node_modules/**',
    'next-env.d.ts',
    // Data files — not source code
    'data/**',
    'public/**',
    // Playwright output
    'test-results/**',
    'playwright-report/**',
  ]),
]);

export default eslintConfig;
