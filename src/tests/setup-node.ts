// Setup for the `node` Vitest project: the shared doubles only.
//
// No `@testing-library/jest-dom` — its matchers assert against a document,
// and a test that needs one belongs in the jsdom project instead.
import './setup-common'
