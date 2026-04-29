Plan for SolidJS Store & Component Practice Improvements

Goal: Eliminate direct 'window' object exposure for application logic and E2E testing, centralize global event handling, and leverage SolidJS's reactivity and context API more effectively.
Phase 1: Centralize Global Event Listeners & Remove Direct 'window.addEventListener'

Issue: Global event listeners ('keydown', 'resize', 'scroll', 'error', 'unhandledrejection') are scattered across 'App.tsx', 'Walkthrough.tsx', and 'index.tsx'.
1. Create 'src/components/GlobalEventProvider.tsx'

    Mount once in 'App.tsx'.

    Encapsulate all 'window.addEventListener' and 'window.removeEventListener' calls.

    Use SolidJS's 'createEffect' and 'onCleanup' for lifecycle management.

    Dispatch actions to stores or use context instead of direct calls like 'appStore.exitFocusMode'.

    Expose reactive signals ('windowWidth', 'windowHeight', 'scrollTop') via Context.

2. Refactor Components

    App.tsx: Move keyboard shortcut logic to 'GlobalEventProvider'. Remove custom event listeners.

    Walkthrough.tsx: Remove direct resize/scroll listeners. Consume dimensions from 'GlobalEventProvider' context.

    index.tsx: Move global error and rejection handlers to 'GlobalEventProvider'.

Phase 2: Eliminate 'window' Exposure for E2E Testing

Issue: Properties like '__appStore' and '__playbackRuntime' are exposed for testing, cluttering the global namespace.
1. Create 'src/lib/test-utils.ts'

export function exposeForE2E(key: string, value: any) {
if (process.env.NODE_ENV === 'test' || (window as any).E2E_TEST_MODE) {
(window as any)[key] = value;
}
}
2. Refactor App.tsx

    Replace all direct '(window as any).__someVar = value' with 'exposeForE2E('__someVar', value)'.

Phase 3: Replace 'window.dispatchEvent' with SolidJS Context or Direct Store Updates

Issue: 'window.dispatchEvent' is used for inter-component communication in 'app-store.ts' and 'lib/piano-roll.ts'.
1. Refactor 'app-store.ts'

    Remove all 'window.dispatchEvent' calls (theme, grid, presets).

    Components should 'createEffect' on relevant signals directly from the store.

    Replace 'window.__exitFocusMode' with direct store method calls.

2. Refactor 'lib/piano-roll.ts'

    Replace 'pitchperfect:gridToggle' dispatch with a direct call to 'appStore.setGridLines()'.

Phase 4: Encapsulate DOM-Specific APIs

Issue: Direct usage of 'window.location', 'window.history', 'window.alert', and 'window.devicePixelRatio'.
1. Create 'src/lib/dom-utils.ts'

    URL Management: Move 'generateShareURL' and 'loadFromURL' here to encapsulate 'location' and 'history'.

    Alerts: Create 'showAlert(message: string)' calling 'appStore.showNotification' instead of 'window.alert'.

    Device Pixel Ratio: Create 'getDevicePixelRatio()' with a fallback to 1.

2. Implementation Map

    lib/piano-roll.ts: Use 'dom-utils.showAlert()' and 'dom-utils.getDevicePixelRatio()'.

    Canvas Components: Use 'dom-utils.getDevicePixelRatio()'.

    Walkthrough.tsx: Use reactive window signals from the context.

High-Level Implementation Steps

- Setup Utilities: Create 'GlobalEventProvider.tsx', 'dom-utils.ts', and 'test-utils.ts'.

- Entry Point Cleanup: Integrate 'GlobalEventProvider' in 'App.tsx' and move handlers from 'index.tsx'.

- Store Refactoring: Remove 'window.dispatchEvent' and replace with exported signals/actions.

- Component Updates: Update 'Walkthrough', 'HistoryCanvas', and 'PitchCanvas' to use the new utilities and context.

- Test Hardening: Transition all E2E window exposures to the 'test-utils' gate