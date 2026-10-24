// ============================================================
// plan-chrome — what the two screens may and may not do with the shared sheet
// ============================================================
//
// PlanQuestions.module.css and PlanScreen.module.css `composes` classes of
// plan-chrome.module.css, so a screen's element wears the shared class and its
// own. The build puts the shared rules after the importing sheet's own for the
// first sheet that imports them, and before them for the next (Lightning CSS,
// as Vite 6.4.4 runs it), so at equal specificity a screen's own rule beats a
// shared one in one screen and loses to it in the other. Vitest does not
// process CSS, so no other test sees that. This reads the sheets and holds
// them to two rules:
//
// - A class that composes a chrome class sets none of the properties that
//   class sets, a longhand counting against its shorthand (padding-bottom
//   against padding). A screen that needs a value of its own sets a custom
//   property the chrome class reads, which no order can undo.
// - Every composed name exists in the chrome. A misspelt one builds with exit
//   0 and drops the shared class without a word.
//
// Each rule is tried on bad samples first, then run on the real sheets, which
// are also held to the compositions their screens depend on. The reader takes
// flat CSS only: a nested rule throws, so the guard cannot pass by skipping
// what it cannot read, and a `{` inside a string throws too (a false alarm,
// never a false pass). A green run still says nothing about inline style, a
// rule whose subject is not a class (`.root button`), a local class that
// composes the chrome through another local class, or a shorthand LONGHANDS
// lacks (`overscroll-behavior`), which collides only with itself.
//
// The last block pins two values the rulings fixed, which nothing else
// would notice losing: Vitest sees no CSS, so a test of the screens' markup
// stays green when one of them goes. The room a host lends the regions, in
// their padding and scroll-padding, is pinned in plan-overhang.test.ts.

import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// ── Reading a stylesheet ────────────────────────────────────────────────

interface Decl {
  prop: string
  value: string
}

interface Rule {
  selector: string
  /** The grouping at-rules the rule sits in, such as `@media (min-width: 720px)`. */
  context: string
  decls: Decl[]
}

interface Composition {
  cls: string
  names: string[]
  /** The sheet the names come from; empty when they are this sheet's own. */
  from: string
}

/**
 * What the two readers below step through: a quoted string whole, so a `;` or
 * a `{` inside one is not syntax, then the characters that are.
 */
const SPLIT_TOKENS = /'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|[(),;]/g
const BLOCK_TOKENS = /'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|[{}]/g
const CLASS = /\.(-?[_a-zA-Z][\w-]*)/g
const GROUPING = /^@(?:media|supports|layer|container|scope)\b/

/** Where the chrome's classes are composed from, as the screens write it. */
const CHROME_FILE = 'plan-chrome.module.css'
const CHROME_PATH = `./${CHROME_FILE}`

/**
 * Splits `text` at `sep`, but not inside brackets or strings. Each piece
 * keeps its whitespace.
 */
function splitTopLevel(text: string, sep: ',' | ';'): string[] {
  const parts: string[] = []
  let depth = 0
  let from = 0
  for (const found of text.matchAll(SPLIT_TOKENS)) {
    if (found[0] === '(') depth += 1
    else if (found[0] === ')') depth -= 1
    else if (found[0] === sep && depth === 0) {
      parts.push(text.slice(from, found.index))
      from = found.index + 1
    }
  }
  parts.push(text.slice(from))
  return parts
}

/** The `prelude { body }` blocks at the top level of `css`, bodies whole. */
function blocksOf(css: string): { prelude: string; body: string }[] {
  const blocks: { prelude: string; body: string }[] = []
  let depth = 0
  let from = 0
  let open = 0
  for (const found of css.matchAll(BLOCK_TOKENS)) {
    if (found[0] === '{') {
      if (depth === 0) open = found.index
      depth += 1
    } else if (found[0] === '}') {
      depth -= 1
      if (depth < 0) throw new Error('A } with no { before it.')
      if (depth === 0) {
        const raw = css.slice(from, open)
        blocks.push({
          prelude: raw.slice(raw.lastIndexOf(';') + 1).trim(),
          body: css.slice(open + 1, found.index),
        })
        from = found.index + 1
      }
    }
  }
  if (depth !== 0) throw new Error('A { with no } after it.')
  return blocks
}

function declarationsOf(body: string): Decl[] {
  return splitTopLevel(body, ';').flatMap((part) => {
    const colon = part.indexOf(':')
    if (colon < 1) return []
    const prop = part.slice(0, colon).trim()
    return [
      {
        prop: prop.startsWith('--') ? prop : prop.toLowerCase(),
        value: part.slice(colon + 1).trim(),
      },
    ]
  })
}

/** Every style rule of a stylesheet, grouping at-rules unwrapped, keyframes and font faces left out. */
function rulesOf(css: string, context = ''): Rule[] {
  const plain = css.replace(/\/\*[\s\S]*?\*\//g, '')
  return blocksOf(plain).flatMap(({ prelude, body }) => {
    if (prelude.startsWith('@')) {
      return GROUPING.test(prelude)
        ? rulesOf(body, `${context} ${prelude}`.trim())
        : []
    }
    if (body.includes('{')) {
      throw new Error(`Nested rule in "${prelude}": flat CSS only.`)
    }
    return [{ selector: prelude, context, decls: declarationsOf(body) }]
  })
}

// ── What a rule styles ──────────────────────────────────────────────────

const selectorItems = (selector: string): string[] =>
  splitTopLevel(selector, ',')
    .map((item) => item.trim().replace(/\s+/g, ' '))
    .filter((item) => item !== '')

/** The selector with what sits in (...) and [...] blanked, so no space or dot in there counts. */
function masked(selector: string): string {
  let depth = 0
  return [...selector]
    .map((ch) => {
      const inside = depth > 0
      if (ch === '(' || ch === '[') depth += 1
      if (ch === ')' || ch === ']') depth -= 1
      return inside ? '_' : ch
    })
    .join('')
}

/** The classes of the element a selector styles, and the pseudo-element it styles, if any. */
function subjectOf(item: string): { classes: string[]; pseudo: string } {
  const compound =
    masked(item)
      .split(/[\s>+~]+/)
      .pop() ?? ''
  const pseudo =
    /::?(?:before|after|first-line|first-letter|placeholder|selection|marker|backdrop)\b/.exec(
      compound,
    )
  return {
    classes: [...compound.matchAll(CLASS)].map((found) => found[1]),
    pseudo: pseudo === null ? '' : `::${pseudo[0].replace(/^:+/, '')}`,
  }
}

/** The key a rule's properties are filed under: the class, and its pseudo-element if it has one. */
const subjectsOf = (rule: Rule): string[] =>
  selectorItems(rule.selector).flatMap((item) => {
    const { classes, pseudo } = subjectOf(item)
    return classes.map((name) => `${name}${pseudo}`)
  })

/** Every property set on each subject, whatever the state or the media query. */
function propsBySubject(rules: Rule[]): Map<string, Set<string>> {
  const bySubject = new Map<string, Set<string>>()
  for (const rule of rules) {
    const props = rule.decls.map((d) => d.prop).filter((p) => p !== 'composes')
    for (const key of subjectsOf(rule)) {
      bySubject.set(key, new Set([...(bySubject.get(key) ?? []), ...props]))
    }
  }
  return bySubject
}

const classesIn = (css: string): Set<string> =>
  new Set(
    rulesOf(css).flatMap((rule) =>
      [...rule.selector.matchAll(CLASS)].map((found) => found[1]),
    ),
  )

/** `root scroll from './x.css'` as its names and its source, unquoted; the source is empty when the names are the sheet's own. */
function parseComposes(value: string): { names: string[]; from: string } {
  const words = value.split(/\s+/).filter(Boolean)
  const at = words.lastIndexOf('from')
  if (at === -1) return { names: words, from: '' }
  const quoted = /^(['"])(.*)\1$/.exec(words[at + 1] ?? '')
  return { names: words.slice(0, at), from: quoted?.[2] ?? '' }
}

/** What each `composes` declaration of a sheet composes, and where from. */
function composesOf(rules: Rule[]): Composition[] {
  return rules.flatMap(({ selector, decls }) =>
    decls
      .filter((d) => d.prop === 'composes')
      .map(({ value }) => {
        const cls = /^\.(-?[_a-zA-Z][\w-]*)$/.exec(selector.trim())?.[1]
        if (cls === undefined) {
          throw new Error(`composes in "${selector}": one class only.`)
        }
        return { cls, ...parseComposes(value) }
      }),
  )
}

// ── When two properties are one ─────────────────────────────────────────

/** What each shorthand sets, one line each: the ones these sheets could plausibly reach for. */
const TABLE = `
  margin: margin-top margin-right margin-bottom margin-left margin-block margin-inline
  margin-block: margin-block-start margin-block-end
  margin-inline: margin-inline-start margin-inline-end
  padding: padding-top padding-right padding-bottom padding-left padding-block padding-inline
  padding-block: padding-block-start padding-block-end
  padding-inline: padding-inline-start padding-inline-end
  scroll-margin: scroll-margin-top scroll-margin-right scroll-margin-bottom scroll-margin-left scroll-margin-block scroll-margin-inline
  scroll-padding: scroll-padding-top scroll-padding-right scroll-padding-bottom scroll-padding-left scroll-padding-block scroll-padding-inline
  inset: top right bottom left inset-block inset-inline
  border: border-width border-style border-color border-top border-right border-bottom border-left
  border-width: border-top-width border-right-width border-bottom-width border-left-width
  border-style: border-top-style border-right-style border-bottom-style border-left-style
  border-color: border-top-color border-right-color border-bottom-color border-left-color
  border-top: border-top-width border-top-style border-top-color
  border-right: border-right-width border-right-style border-right-color
  border-bottom: border-bottom-width border-bottom-style border-bottom-color
  border-left: border-left-width border-left-style border-left-color
  border-radius: border-top-left-radius border-top-right-radius border-bottom-right-radius border-bottom-left-radius
  background: background-color background-image background-position background-size background-repeat background-origin background-clip background-attachment
  font: font-style font-variant font-weight font-stretch font-size line-height font-family
  flex: flex-grow flex-shrink flex-basis
  flex-flow: flex-direction flex-wrap
  gap: row-gap column-gap
  overflow: overflow-x overflow-y
  outline: outline-width outline-style outline-color
  transition: transition-property transition-duration transition-timing-function transition-delay
  animation: animation-name animation-duration animation-timing-function animation-delay animation-iteration-count animation-direction animation-fill-mode animation-play-state
  text-decoration: text-decoration-line text-decoration-style text-decoration-color text-decoration-thickness
  list-style: list-style-type list-style-position list-style-image
  place-items: align-items justify-items
  place-content: align-content justify-content
  place-self: align-self justify-self
  grid-template: grid-template-rows grid-template-columns grid-template-areas
  columns: column-width column-count
`

const LONGHANDS = new Map(
  TABLE.trim()
    .split('\n')
    .map((line): [string, string[]] => {
      const [name, longhands] = line.split(':')
      return [name.trim(), longhands.trim().split(/\s+/)]
    }),
)

/** The property and every longhand it sets. */
function expand(prop: string): Set<string> {
  const all = new Set([prop])
  for (const part of LONGHANDS.get(prop) ?? []) {
    for (const leaf of expand(part)) all.add(leaf)
  }
  return all
}

/** Do two declarations set the same property, one of them perhaps through a shorthand? */
function collide(a: string, b: string): boolean {
  if (a.startsWith('--') || b.startsWith('--')) return a === b
  const [x, y] = [a, b].map((prop) => prop.replace(/^-(?:webkit|moz|ms)-/, ''))
  if (x === 'all' || y === 'all') return true
  const theirs = expand(y)
  return [...expand(x)].some((prop) => theirs.has(prop))
}

// ── The two rules ───────────────────────────────────────────────────────

/** The pseudo-element part of a subject key (`say::before` of `say`), or null when the key is another class's. */
function pseudoOf(key: string, cls: string): string | null {
  if (key === cls) return ''
  return key.startsWith(`${cls}::`) ? key.slice(cls.length) : null
}

/** The chrome keys a screen's key is held against: each composed name, with the key's own pseudo-element. */
function chromeKeysFor(key: string, cls: string, names: string[]): string[] {
  const pseudo = pseudoOf(key, cls)
  return pseudo === null ? [] : names.map((name) => `${name}${pseudo}`)
}

/** The pairs of properties, one from each side, that set the same thing. */
function clashes(
  mine: Set<string>,
  theirs: Set<string> | undefined,
): [string, string][] {
  return [...(theirs ?? [])].flatMap((other) =>
    [...mine]
      .filter((prop) => collide(prop, other))
      .map((prop): [string, string] => [prop, other]),
  )
}

/** What one composing class, with its pseudo-elements, sets that the chrome classes it composes set as well. */
function collisionsOfClass(
  { cls, names }: Composition,
  own: Map<string, Set<string>>,
  shared: Map<string, Set<string>>,
): string[] {
  return [...own].flatMap(([key, mine]) =>
    chromeKeysFor(key, cls, names).flatMap((against) =>
      clashes(mine, shared.get(against)).map(
        ([prop, theirs]) =>
          `.${key}: ${prop} collides with .${against}'s ${theirs}`,
      ),
    ),
  )
}

/** Properties a screen's class sets that the chrome class it composes sets as well. */
function collisions(chromeCss: string, screenCss: string): string[] {
  const shared = propsBySubject(rulesOf(chromeCss))
  const rules = rulesOf(screenCss)
  const own = propsBySubject(rules)
  return composesOf(rules)
    .filter(({ from }) => from === CHROME_PATH)
    .flatMap((composition) => collisionsOfClass(composition, own, shared))
}

/** Names a screen composes from the chrome that the chrome does not define. */
function missingNames(chromeCss: string, screenCss: string): string[] {
  const defined = classesIn(chromeCss)
  return composesOf(rulesOf(screenCss))
    .filter(({ from }) => from === CHROME_PATH)
    .flatMap(({ cls, names }) =>
      names
        .filter((name) => !defined.has(name))
        .map(
          (name) =>
            `.${cls} composes ${name}, which plan-chrome does not define`,
        ),
    )
}

// ── The guard, tried on samples ─────────────────────────────────────────

const FROM = `from '${CHROME_PATH}'`

const SAMPLE_CHROME = `
  .root { width: 100%; padding: 4px; }
  .scroll { display: flex; flex-direction: column; margin-top: -14px; }
  .headline { max-width: var(--pc-headline-max, 14ch); font-size: var(--pc-headline-size, 31px); }
  .say { margin: -6px 0 2px; background: #222; }
  .say::before { top: -6px; }
`

describe('the guard on samples: a screen setting what the chrome sets', () => {
  it.each([
    [
      'the same property',
      `.question { composes: headline ${FROM}; max-width: 20ch; }`,
      [".question: max-width collides with .headline's max-width"],
    ],
    [
      'the same property inside a media query, the order trap itself',
      `.question { composes: headline ${FROM}; }
       @media (min-width: 720px) { .question { font-size: 46px; } }`,
      [".question: font-size collides with .headline's font-size"],
    ],
    [
      "a longhand of the chrome's shorthand",
      `.screen { composes: root ${FROM}; padding-bottom: 10px; }`,
      [".screen: padding-bottom collides with .root's padding"],
    ],
    [
      "a shorthand over the chrome's longhand",
      `.region { composes: scroll ${FROM}; margin: 0; }`,
      [".region: margin collides with .scroll's margin-top"],
    ],
    [
      'a property of the pseudo-element the chrome styles',
      `.bubble { composes: say ${FROM}; } .bubble::before { top: 0; }`,
      [".bubble::before: top collides with .say::before's top"],
    ],
    [
      'a property of one of two composed classes',
      `.both { composes: root scroll ${FROM}; width: 50%; display: block; }`,
      [
        ".both: width collides with .root's width",
        ".both: display collides with .scroll's display",
      ],
    ],
  ])('fails on %s', (_what, screen, expected) => {
    expect(collisions(SAMPLE_CHROME, screen).sort()).toEqual(
      [...expected].sort(),
    )
  })

  it('fails on a property the chrome gains after the screen set it', () => {
    const chrome = `${SAMPLE_CHROME} .scroll { height: 10px; }`
    const screen = `.region { composes: scroll ${FROM}; height: 1px; }`

    expect(collisions(chrome, screen)).toEqual([
      ".region: height collides with .scroll's height",
    ])
  })

  it.each([
    [
      'a custom property the chrome class reads',
      `.question { composes: headline ${FROM}; --pc-headline-max: 20ch; }`,
    ],
    [
      'a property of the element, where the chrome styles the pseudo-element',
      `.bubble { composes: say ${FROM}; top: 0; }`,
    ],
    [
      "flex beside the chrome's flex-direction, which it does not set",
      `.region { composes: scroll ${FROM}; flex: 1; }`,
    ],
    [
      'a property of a state the chrome does not set',
      `.bubble { composes: say ${FROM}; } .bubble[data-pop='1'] { animation: pop 1s; }`,
    ],
    ['a class that composes nothing', '.plain { max-width: 20ch; }'],
    [
      'a class composed from another sheet',
      ".other { composes: headline from './other.module.css'; max-width: 20ch; }",
    ],
    [
      'a property that is commented out',
      `.question { composes: headline ${FROM}; /* max-width: 20ch; */ }`,
    ],
    [
      'keyframes and font faces, which style no class',
      `@keyframes pop { from { opacity: 0; } to { opacity: 1; } }
       .root2 { composes: root ${FROM}; }`,
    ],
  ])('passes on %s', (_what, screen) => {
    expect(collisions(SAMPLE_CHROME, screen)).toEqual([])
  })

  it('refuses CSS it cannot read, rather than pass by skipping it', () => {
    expect(() =>
      collisions(SAMPLE_CHROME, '.a { .b { color: red; } }'),
    ).toThrow(/Nested rule/)
    expect(() => collisions(SAMPLE_CHROME, '.a { color: red;')).toThrow(/\{/)
    expect(() =>
      collisions(SAMPLE_CHROME, `.a .b { composes: root ${FROM}; }`),
    ).toThrow(/one class only/)
  })
})

describe('the guard on samples: a name the chrome does not have', () => {
  it.each([
    [
      'a misspelt name',
      `.a { composes: headlin ${FROM}; }`,
      ['.a composes headlin, which plan-chrome does not define'],
    ],
    [
      'one wrong name among right ones',
      `.a { composes: root scrol ${FROM}; }`,
      ['.a composes scrol, which plan-chrome does not define'],
    ],
  ])('fails on %s', (_what, screen, expected) => {
    expect(missingNames(SAMPLE_CHROME, screen)).toEqual(expected)
  })

  it('passes on names the chrome has, and on names from another sheet', () => {
    const screen = `
      .a { composes: root scroll ${FROM}; }
      .b { composes: nothere from './other.module.css'; }
      .c { composes: local; }`

    expect(missingNames(SAMPLE_CHROME, screen)).toEqual([])
  })
})

// ── The real stylesheets ────────────────────────────────────────────────

const PLAN = join(process.cwd(), 'src/features/plan')
const read = (name: string): string => readFileSync(join(PLAN, name), 'utf8')

/** The sheets in the folder that compose from the chrome, found rather than listed. */
const composers = (): string[] =>
  readdirSync(PLAN).filter(
    (name) =>
      name.endsWith('.module.css') &&
      name !== CHROME_FILE &&
      read(name).includes(CHROME_PATH),
  )

describe('the real stylesheets', () => {
  it('finds the sheets that compose from the chrome', () => {
    expect(composers()).toEqual(
      expect.arrayContaining([
        'PlanQuestions.module.css',
        'PlanScreen.module.css',
      ]),
    )
  })

  it.each(composers())(
    '%s sets nothing the classes it composes set',
    (name) => {
      const css = read(name)

      expect(composesOf(rulesOf(css)).length).toBeGreaterThan(0)
      expect(collisions(read(CHROME_FILE), css)).toEqual([])
    },
  )

  it.each(composers())('%s composes only names the chrome defines', (name) => {
    expect(missingNames(read(CHROME_FILE), read(name))).toEqual([])
  })

  // A `composes` line that goes is silent to both rules above.
  it.each([
    ['PlanScreen.module.css', 'root', ['root']],
    ['PlanScreen.module.css', 'scroll', ['scroll']],
    ['PlanScreen.module.css', 'headline', ['headline']],
    ['PlanScreen.module.css', 'say', ['say']],
    ['PlanScreen.module.css', 'lit', ['lit']],
    ['PlanQuestions.module.css', 'root', ['root', 'scroll']],
    ['PlanQuestions.module.css', 'question', ['headline']],
    ['PlanQuestions.module.css', 'say', ['say']],
    ['PlanQuestions.module.css', 'lit', ['lit']],
  ])('%s: .%s composes %j from the chrome', (name, cls, names) => {
    const composed = composesOf(rulesOf(read(name)))
      .filter((c) => c.cls === cls && c.from === CHROME_PATH)
      .flatMap((c) => c.names)

    expect(composed).toEqual(expect.arrayContaining(names))
  })
})

/** The last value a rule of this selector, outside any media query, gives a property. */
function valueOf(
  css: string,
  selector: string,
  prop: string,
): string | undefined {
  return rulesOf(css)
    .filter((rule) => rule.selector === selector && rule.context === '')
    .flatMap((rule) => rule.decls)
    .filter((decl) => decl.prop === prop)
    .at(-1)
    ?.value.replace(/\s+/g, ' ')
}

describe('what the rulings fixed', () => {
  it("gives the plan the mock's 16ch headline measure, through the chrome's property", () => {
    expect(
      valueOf(read('PlanScreen.module.css'), '.headline', '--pc-headline-max'),
    ).toBe('16ch')
  })

  it("pads the questions' region by the home indicator's inset, through the property the chrome pads with", () => {
    expect(
      valueOf(read('PlanQuestions.module.css'), '.root', '--pc-end'),
    ).toContain('env(safe-area-inset-bottom, 0px)')
    expect(valueOf(read(CHROME_FILE), '.scroll', 'padding')).toContain(
      'var(--pc-end, var(--pc-bleed))',
    )
  })
})
