// ============================================================
// The room names, read out of their module's source
// ============================================================
//
// probe-bundle.mjs runs under bare node and cannot import a .ts module, so it
// reads `src/features/rooms/room-names.ts` as text to measure the names that
// ship. It used to fail OPEN: a name in double quotes (what prettier writes
// for a name with an apostrophe) or with a trailing comment was skipped, six
// of seven still passed a "at least six" guard, and the step reported every
// name fitting while the one that changed was never measured. Every key in
// the object must now be read, or this throws.

/**
 * @param {string} source the text of room-names.ts
 * @returns {Record<string, string>} every room id to its name
 */
export function parseRoomNames(source) {
  const block = /ROOM_NAMES[^=]*=\s*\{([^}]*)\}/u.exec(source)
  if (block === null) throw new Error('room names: no ROOM_NAMES object')
  // Comments go first: a name never contains `//`.
  const body = block[1]
    .replace(/\/\/.*$/gmu, '')
    .replace(/\/\*[\s\S]*?\*\//gu, '')
  const keys = [...body.matchAll(/^\s*['"]?([\w-]+)['"]?\s*:/gmu)].map(
    (match) => match[1],
  )
  /** @type {Record<string, string>} */
  const names = {}
  for (const [, id, , name] of body.matchAll(
    /^\s*['"]?([\w-]+)['"]?\s*:\s*(['"])((?:(?!\2).)+)\2\s*,?\s*$/gmu,
  )) {
    names[id] = name
  }
  const unread = keys.filter((key) => names[key] === undefined)
  if (keys.length === 0 || unread.length > 0) {
    throw new Error(
      `room names: ${keys.length} keys, could not read ${unread.join(', ') || 'any'}`,
    )
  }
  return names
}
