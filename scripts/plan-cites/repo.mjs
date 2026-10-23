// ============================================================
// plan-cites/repo — the files a citation names, in the working tree or at a commit
// ============================================================
//
// A citation's file is read where the README says: a pinned one at its
// pin, with `git show <sha>:<path>`, and every other one in the working
// tree. Its name is resolved against the citing document's own folder
// first, then as a path from the repository's root, then as the end of a
// path. A bare name that ends two paths is ambiguous, unless an earlier
// name in the same paragraph spells out which.

import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join, posix } from 'node:path'
import { isPattern } from './parse.mjs'

export function openRepo(root) {
  const git = (args, allowFail = false) => {
    const r = spawnSync('git', ['-C', root, ...args], {
      encoding: 'utf8',
      maxBuffer: 1 << 28,
    })
    if (r.status === 0) return r.stdout
    if (allowFail) return null
    throw new Error(`git ${args.join(' ')} failed: ${r.stderr.trim()}`)
  }
  const memo = (fn) => {
    const cache = new Map()
    return (...key) => {
      const k = key.join('\0')
      if (!cache.has(k)) cache.set(k, fn(...key))
      return cache.get(k)
    }
  }

  // `rev` is a commit, or '' for the working tree
  const tree = memo((rev) => {
    const list =
      rev === ''
        ? git(['ls-files', '-z', '--cached', '--others', '--exclude-standard'])
            .split('\0')
            .filter((p) => p !== '' && existsSync(join(root, p)))
        : git(['ls-tree', '-r', '-z', '--name-only', rev])
            .split('\0')
            .filter(Boolean)
    const byName = new Map()
    for (const p of new Set(list)) {
      const name = posix.basename(p)
      if (!byName.has(name)) byName.set(name, [])
      byName.get(name).push(p)
    }
    return { set: new Set(list), byName }
  })

  const ending = (t, token) =>
    (t.byName.get(posix.basename(token)) ?? []).filter(
      (p) => p === token || p.endsWith(`/${token}`),
    )

  /**
   * What `token`, cited in `doc`, names at `rev`: { path }, { pattern },
   * { missing } or { ambiguous: [paths] }. `earlier` lists the names
   * written before it in its paragraph, nearest first.
   */
  function resolve(token, doc, rev = '', earlier = []) {
    if (isPattern(token)) return { pattern: true }
    const t = tree(rev)
    const local = posix.normalize(posix.join(posix.dirname(doc), token))
    if (t.set.has(local)) return { path: local }
    if (t.set.has(token)) return { path: token }
    const found = ending(t, token)
    if (found.length === 1) return { path: found[0] }
    if (found.length === 0) return { missing: true }
    for (const e of earlier) {
      if (posix.basename(e) !== posix.basename(token)) continue
      const near = posix.normalize(posix.join(posix.dirname(doc), e))
      const hits = found.filter(
        (p) => p === e || p === near || p.endsWith(`/${e}`),
      )
      if (hits.length === 1) return { path: hits[0] }
    }
    return { ambiguous: found }
  }

  const read = memo((rev, path) => {
    let text = null
    if (rev === '') {
      try {
        text = readFileSync(join(root, path), 'utf8')
      } catch {
        text = null
      }
    } else text = git(['show', `${rev}:${path}`], true)
    if (text === null) return null
    const lines = text.split('\n')
    if (text.endsWith('\n')) lines.pop()
    return lines
  })

  const isCommit = memo(
    (sha) =>
      git(['rev-parse', '--verify', '--quiet', `${sha}^{commit}`], true) !==
      null,
  )

  // Where git last saw a path that is gone: renamed (to the path it
  // records), deleted, or neither within the history this clone holds.
  const gone = memo((token) => {
    const at = git(
      [
        'log',
        '-1',
        '--format=%H',
        '--diff-filter=DR',
        '-M',
        'HEAD',
        '--',
        token,
        `*/${token}`,
      ],
      true,
    )?.trim()
    if (!at) return null
    const status =
      git(['diff', '--name-status', '-M', `${at}^`, at], true) ?? ''
    for (const line of status.split('\n')) {
      const [kind, from, to] = line.split('\t')
      if (from !== token && !from?.endsWith(`/${token}`)) continue
      if (kind?.startsWith('R')) return { renamed: to, commit: at.slice(0, 9) }
      if (kind === 'D') return { deleted: true, commit: at.slice(0, 9) }
    }
    return null
  })

  return { root, git, resolve, read, isCommit, gone }
}
