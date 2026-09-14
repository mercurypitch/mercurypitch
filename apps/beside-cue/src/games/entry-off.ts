// What `@/games/entry` resolves to in a build without the B-side games, and
// under vitest. See entry.ts. The type import is erased at build time, so this
// stub gives the bundler nothing of the games to load.

import type { GamesScreenLoader } from './entry'

export const loadGamesScreen: GamesScreenLoader | undefined = undefined
