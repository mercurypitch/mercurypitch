// ============================================================
// HTMLRewriter double — the Workers runtime's rewriter, on jsdom, for the gate's tests
// ============================================================
//
// `HTMLRewriter` exists only in the Workers runtime. A jsdom suite stubs the
// global with this class (`vi.stubGlobal('HTMLRewriter', HtmlRewriterDouble)`)
// and reads what comes out as a browser would. It keeps the behaviour
// src/lesson-gate.ts relies on, each part of which was checked under
// `wrangler dev`:
//
// - handlers run in document order, and an element's in the order they were
//   registered, so a later one reads `removed` when an earlier one removed
//   or unwrapped the element;
// - getAttribute returns the value as written, not as read. This double
//   writes `&`, `"` and every character outside ASCII as an entity, as a
//   page may (Lesson 5's `&#8220;support&#8221;`), so a reader that does not
//   decode fails here as it would on the site;
// - setAttribute writes its value into the markup with `"` escaped and
//   nothing else, so what is stored is what a browser reads from that;
// - renaming an element renames its end tag; content a handler inserts is
//   not handed to the handlers;
// - a script's text arrives in chunks, the last of them empty.
//
// It does not stream: it reads the whole body, then writes the whole result.
// Text handlers are fed a script's or a style's text only, which is all the
// gate asks for.

interface ContentOptions {
  html?: boolean
}

interface Handlers {
  element?(element: DoubleElement): void
  text?(text: DoubleText): void
}

interface Registered {
  readonly selector: string
  readonly handlers: Handlers
}

/** A value as a page may write it: `&`, `"` and anything outside ASCII as entities. */
function asWritten(value: string): string {
  return value.replace(/[&"]|[^\x20-\x7e]/gu, (ch) => {
    if (ch === '&') return '&amp;'
    if (ch === '"') return '&quot;'
    return `&#${ch.codePointAt(0) ?? 0};`
  })
}

/** What a browser reads from `markup` written as an attribute's value, `"` escaped as the runtime does. */
function asRead(doc: Document, markup: string): string {
  const probe = doc.createElement('template')
  probe.innerHTML = `<i data-v="${markup.replace(/"/g, '&quot;')}"></i>`
  return probe.content.firstElementChild?.getAttribute('data-v') ?? ''
}

const escapeText = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

class DoubleElement {
  removed = false

  constructor(private node: Element) {}

  get tagName(): string {
    return this.node.localName
  }

  set tagName(name: string) {
    const renamed = this.node.ownerDocument.createElement(name)
    for (const { name: key, value } of Array.from(this.node.attributes))
      renamed.setAttribute(key, value)
    renamed.append(...Array.from(this.node.childNodes))
    this.node.replaceWith(renamed)
    this.node = renamed
  }

  /** The element as it now stands, for the text handlers. */
  get current(): Element {
    return this.node
  }

  getAttribute(name: string): string | null {
    const value = this.node.getAttribute(name)
    return value === null ? null : asWritten(value)
  }

  hasAttribute(name: string): boolean {
    return this.node.hasAttribute(name)
  }

  setAttribute(name: string, value: string): void {
    this.node.setAttribute(name, asRead(this.node.ownerDocument, value))
  }

  removeAttribute(name: string): void {
    this.node.removeAttribute(name)
  }

  append(content: string, options?: ContentOptions): void {
    if (options?.html === true)
      this.node.insertAdjacentHTML('beforeend', content)
    else this.node.append(content)
  }

  prepend(content: string, options?: ContentOptions): void {
    if (options?.html === true)
      this.node.insertAdjacentHTML('afterbegin', content)
    else this.node.prepend(content)
  }

  setInnerContent(content: string, options?: ContentOptions): void {
    if (options?.html === true) this.node.innerHTML = content
    else this.node.textContent = content
  }

  remove(): void {
    this.node.remove()
    this.removed = true
  }

  removeAndKeepContent(): void {
    this.node.replaceWith(...Array.from(this.node.childNodes))
    this.removed = true
  }
}

class DoubleText {
  removed = false
  written: string | null = null

  constructor(
    readonly text: string,
    readonly lastInTextNode: boolean,
  ) {}

  replace(content: string, options?: ContentOptions): void {
    this.written = options?.html === true ? content : escapeText(content)
  }

  remove(): void {
    this.removed = true
  }
}

/** A script's text as the runtime hands it over: in two parts, then an empty last chunk. */
function chunksOf(text: string): DoubleText[] {
  const half = Math.ceil(text.length / 2)
  const parts = text === '' ? [] : [text.slice(0, half), text.slice(half)]
  return [
    ...parts.map((part) => new DoubleText(part, false)),
    new DoubleText('', true),
  ]
}

function feedText(element: Element, registered: readonly Registered[]): void {
  if (element.localName !== 'script' && element.localName !== 'style')
    throw new Error(
      `The HTMLRewriter double feeds text handlers a script's or a style's text only, not a <${element.localName}>'s.`,
    )
  const chunks = chunksOf(element.textContent ?? '')
  for (const chunk of chunks)
    for (const { handlers } of registered) handlers.text?.(chunk)
  element.textContent = chunks
    .map((c) => (c.removed ? '' : (c.written ?? c.text)))
    .join('')
}

function serialize(doc: Document): string {
  const doctype = doc.doctype === null ? '' : `<!DOCTYPE ${doc.doctype.name}>`
  return doctype + doc.documentElement.outerHTML
}

/** Rewrites `html` with `registered`, as the runtime would. */
export function rewriteHtml(
  html: string,
  registered: readonly Registered[],
): string {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  for (const node of Array.from(doc.querySelectorAll('*'))) {
    if (!node.isConnected) continue
    const matching = registered.filter((r) => node.matches(r.selector))
    if (matching.length === 0) continue
    const element = new DoubleElement(node)
    for (const { handlers } of matching) handlers.element?.(element)
    const texts = matching.filter((r) => r.handlers.text !== undefined)
    if (texts.length > 0 && !element.removed) feedText(element.current, texts)
  }
  return serialize(doc)
}

/** Stands in for the Workers runtime's `HTMLRewriter` in a jsdom suite. */
export class HtmlRewriterDouble {
  private readonly registered: Registered[] = []

  on(selector: string, handlers: Handlers): this {
    this.registered.push({ selector, handlers })
    return this
  }

  transform(response: Response): Response {
    const registered = this.registered.slice()
    const body = new ReadableStream<Uint8Array>({
      async start(controller) {
        const html = await response.text()
        controller.enqueue(
          new TextEncoder().encode(rewriteHtml(html, registered)),
        )
        controller.close()
      },
    })
    return new Response(body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    })
  }
}
