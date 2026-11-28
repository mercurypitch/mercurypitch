// ============================================================
// Before every test in this app's suite
// ============================================================
//
// Whether the API is worth asking is the page's state (src/db/api-reachability.ts
// at the repo root), and a test file is one page: a test whose request got no
// answer would leave the API refused for every test after it in that file.
// Each test starts with the API reachable, as the web suite's do
// (src/tests/setup-common.ts).

import { beforeEach } from 'vitest'
import { resetApiReachabilityForTests } from '@/db/api-reachability'

beforeEach(() => {
  resetApiReachabilityForTests()
})
