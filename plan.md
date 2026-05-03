1. Install necessary dependencies for PostCSS parser if I want to do it automatically, or just split `app.css` using regex/string parsing for each major component.
2. I see `src/styles/app.css` is nearly 10,000 lines long!
3. I'll write a python script to break down `src/styles/app.css` into respective `Component.module.css` files inside `src/components/`.
    - E.g., The `/* ===== Welcome Screen (GH #131) ===== */` section can be parsed out to `WelcomeScreen.module.css`.
    - `/* ===== Focus Mode — full-screen minimal practice UI ===== */` to `FocusMode.module.css`.
    - And so on for `SettingsPanel`, `PianoRollCanvas`, `PitchCanvas`, `WalkthroughModal`, `CrashModal`, etc.
4. I will refactor the React/SolidJS components to import these newly created `.module.css` files, replacing `class="..."` with `class={styles.myClass}`.
5. Some global classes like colors, resets, grid layouts will remain in `app.css` or a new `global.css`.
6. Use Pre-commit checks to verify my changes.
7. Submit the PR.
