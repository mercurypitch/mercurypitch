# SolidJS Architecture & Refactoring Plan

This document outlines the systematic approach for auditing and refactoring the PitchPerfect codebase to adhere strictly to SolidJS best practices. The protocol enforces safe, test-driven modifications while eliminating common React-based anti-patterns.

## Phase 1: Agent Initialization & Investigation Protocol (Read-Only)
**Goal:** Build context and avoid hallucination by operating strictly in read-only/planning mode.

**Execution Steps:**
1. **Context Gathering:** Map the directory structure, identify core packages, and review the global state solutions (`src/stores/*`).
2. **Iterative Grepping:** Use targeted searches (e.g., checking for `createEffect`, `createSignal`, JSX mappings) rather than mass-reading files to maintain focus and prevent context overload.
3. **The Spec-First Rule:** Produce a comprehensive `AUDIT.md` report detailing current architectural flaws, identified anti-patterns, and a step-by-step refactoring priority list. *No code generation occurs until this spec is approved.*

## Phase 2: Enforcing Modularity & Architecture
**Goal:** Ensure strict separation of concerns by decoupling UI components from business logic.

**Execution Steps:**
1. **Component Size Audit:** Flag any `.jsx`/`.tsx` file exceeding 200 lines (e.g., `App.tsx`, complex canvases). Propose breaking them into atomic units (Atoms, Molecules, Organisms).
2. **Logic Extraction:** Strip heavy state logic, side effects, and audio/API integrations from UI components. Extract them into custom reactive primitives (`createResource`) or reusable modular hooks.
3. **Prop Drilling Resolution:** Identify deep prop-passing chains. Suggest and implement replacements using Solid's Context API (`createContext`/`useContext`) or modular global stores.
4. **File Structure Verification:** Enforce Feature-Sliced Design. Ensure files are grouped by feature domain (e.g., `/features/piano-roll/components`, `/features/piano-roll/api`) rather than simply by type.

## Phase 3: SolidJS Bug Hunting & Best Practices
**Goal:** Eradicate React mental models that cause reactivity bugs.

**Execution Steps:**
1. **The "Run-Once" Component Rule:** 
   * **Audit:** Find dynamic assignments or `console.log` statements directly inside component bodies.
   * **Fix:** Relocate dynamic logic into JSX blocks, tracking scopes, or wrap them in `createMemo`.
2. **Prop Destructuring (Reactivity Killer):**
   * **Audit:** Search for `const { something } = props;`.
   * **Fix:** Rewrite to access `props.something` directly, or utilize `splitProps` and `mergeProps` if destructuring is strictly required.
3. **Abuse of `createEffect`:**
   * **Audit:** Locate instances of signal setters being invoked inside `createEffect` loops.
   * **Fix:** Replace these with derived state functions or `createMemo`. Reserve `createEffect` strictly for external side-effects (e.g., interacting with the DOM, AudioEngine, or network APIs).
4. **Improper Control Flow:**
   * **Audit:** Search for native JS `.map()` operations or complex ternary operators (`condition ? <A /> : <B />`) within JSX.
   * **Fix:** Convert to SolidJS native control components: `<For>` (for stable ID arrays), `<Index>` (for primitives), `<Show>`, and `<Switch>/<Match>`.
5. **State vs. Store Mismatch:**
   * **Audit:** Identify complex, nested objects stored inside a `createSignal`.
   * **Fix:** Convert these to `createStore` for fine-grained, property-level reactivity updates without tearing down the entire object structure.

## Phase 4: Agent Execution & Refactoring Loop
**Goal:** Safely implement the approved refactoring spec.

**Execution Steps:**
1. **Test-Driven Modification:** Run `vitest` before touching any component. If tests are missing, a baseline test must be generated first. Post-modification, the tests must pass.
2. **Single-Responsibility Commits/PRs:** Do not bundle multiple unrelated fixes. Execute one pass specifically for prop destructuring, another pass for `createEffect` cleanup, and so on.
3. **Code Health Safeguards:** Run `pnpm lint` (specifically leveraging `eslint-plugin-solid`) to ensure that no new anti-patterns have been introduced during the refactor.
