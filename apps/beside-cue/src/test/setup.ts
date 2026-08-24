import { cleanup } from '@solidjs/testing-library'
import { afterEach } from 'vitest'
import '@testing-library/jest-dom/vitest'

// JSDOM intentionally omits media playback. Keep component tests quiet while
// explicit play/ended/error events continue to drive the runtime contract.
Object.defineProperties(HTMLMediaElement.prototype, {
  load: { configurable: true, value: () => undefined },
  pause: { configurable: true, value: () => undefined },
  play: { configurable: true, value: () => Promise.resolve() },
})

afterEach(() => cleanup())
