# EARS Compliance Report: Playback Modes

**Date:** 2023-10-27
**Spec:** `docs/playback-modes-spec.md`
**Implementation:** `src/components/shared/SharedControlToolbar.tsx`, `src/App.tsx`, `src/stores/app-store.ts`
**Tests:** `src/e2e/playback.spec.ts`

---

## 1. Mode Selection (PR-PLAYBACK-01 to 05)

| Requirement | Status | Analysis |
| :--- | :--- | :--- |
| **PR-PLAYBACK-01** | 🟢 **Implemented** | The `SharedControlToolbar` component contains three buttons (`#btn-once`, `#btn-repeat`, `#btn-session`) that call `props.playModeChange` with the correct mode. |
| **PR-PLAYBACK-02** | 🟢 **Implemented** | 'once' mode is the default behavior. When `playMode` is 'once', no special logic is applied, and the melody plays a single time. |
| **PR-PLAYBACK-03** | 🟡 **Partially Implemented** | The UI for setting repeat cycles exists in `SharedControlToolbar`. However, the core logic in `App.tsx`'s `onComplete` handler does not seem to re-trigger playback for the next cycle. This appears to be a **missing feature**. |
| **PR-PLAYBACK-04** | 🟡 **Partially Implemented** | The UI for "Session mode" exists. However, the backing logic in `practice-engine.ts` to play a sequence of items is missing. The button sets the mode to `'practice'`, but nothing consumes this state to execute a session. |
| **PR-PLAYBACK-05** | 🟢 **Implemented** | The mode buttons in `SharedControlToolbar` correctly apply the `.active` class based on the current `playMode`. |

---

## 2. Once Mode Behavior (PR-ONCE-01 to 05)

| Requirement | Status | Analysis |
| :--- | :--- | :--- |
| **PR-ONCE-01 to 04** | 🟢 **Implemented** | This is the default, baseline playback behavior. The `melody-engine.ts` handles playing a melody from start to finish and calling `onComplete`. |
| **PR-ONCE-05** | 🟢 **Implemented** | The cycle counter in `SharedControlToolbar` is correctly hidden when `playMode` is 'once'. |

---

## 3. Repeat Mode Behavior (PR-REP-01 to 07)

| Requirement | Status | Analysis |
| :--- | :--- | :--- |
| **PR-REP-01, 02** | 🟡 **Partially Implemented** | The playback starts correctly. However, the logic to restart from the beginning is missing from the `onComplete` handler in `App.tsx`. |
| **PR-REP-03** | 🔴 **Not Implemented** | The core logic to repeat `N` times is missing. This is a **critical missing feature** for this mode. |
| **PR-REP-04** | 🟢 **Implemented** | The cycle counter correctly displays "↻" when `playMode` is 'repeat'. |
| **PR-REP-05** | 🔴 **Not Implemented** | Since the repeat loop is not implemented, the logic to stop after N cycles is also missing. |
| **PR-REP-06, 07** | 🔴 **Not Implemented** | The `onComplete` handler is not being called cyclically. |

---

## 4. Session Mode Behavior (PR-SES-01 to 11)

| Requirement | Status | Analysis |
| :--- | :--- | :--- |
| **PR-SES-01 to 04** | 🔴 **Not Implemented** | The `practice-engine.ts` does not contain the logic to load a session and play its items sequentially. This is a **major missing feature**. |
| **PR-SES-05** | 🟡 **Partially Implemented** | The UI in `SharedControlToolbar` attempts to display `C{current}/{total}`, but the props (`currentCycle`, `practiceCycles`) are not correctly wired for session mode. They seem to be incorrectly linked to repeat mode's state. This is a **bug**. |
| **PR-SES-06 to 08** | 🔴 **Not Implemented** | Logic for handling different `SessionItem` types (rest, preset, melody, scale) is missing. |
| **PR-SES-09, 10** | 🔴 **Not Implemented** | There is no session summary UI or data collection for results. |
| **PR-SES-11** | 🟢 **Implemented** | The "Session mode" button exists in `SharedControlToolbar`. |

---

## 5. Test Coverage

| Area | Status | Analysis |
| :--- | :--- | :--- |
| **E2E Tests** | 🔴 **Poor** | The `playback.spec.ts` file only tests the fundamental play/pause/stop functionality. It **does not** contain any tests that switch between playback modes or verify the specific behavior of 'repeat' or 'session' modes. This is a **critical gap in test coverage**. |
| **Unit Tests** | 🔴 **None** | There are no unit tests for `SharedControlToolbar.tsx` to verify that the UI correctly reflects the state of the playback modes. |
