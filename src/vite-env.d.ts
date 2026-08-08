/// <reference types="vite/client" />
declare const __COMMIT_SHA__: string
/**
 * True for any `vite build`, false under `vite dev` — where dist/sw.js does not
 * exist and registering it would only log a failure. Not `import.meta.env.PROD`
 * on purpose: `build:dev` builds in development mode and still ships a worker.
 */
declare const __SW_ENABLED__: boolean
