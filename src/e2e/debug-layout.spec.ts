import { test } from '@playwright/test'
import { dismissOverlays } from '@/e2e/helpers/ui'
import fs from 'fs'

test('debug layout - find off-screen culprit', async ({ page }, testInfo) => {
  const output: string[] = []
  const log = (msg: string) => {
    output.push(msg)
    console.log(msg)
  }

  await page.addInitScript(() => {
    ;(window as any).E2E_TEST_MODE = true
  })
  await page.goto('/')
  await page.waitForSelector('#app-tabs', { timeout: 10000 })
  await dismissOverlays(page)

  await page.evaluate(() => {
    window.location.hash = '#/singing'
    const pp = (window as any).__pp
    if (pp?.appStore?.setActiveTab) {
      pp.appStore.setActiveTab('singing')
    }
  })
  await page.waitForTimeout(2000)

  // Walk the DOM tree from #app to find where layout goes wrong
  const tree = await page.evaluate(() => {
    const results: any[] = []

    function walk(el: Element, depth: number, maxDepth: number) {
      if (depth > maxDepth) return

      const rect = el.getBoundingClientRect()
      const style = window.getComputedStyle(el)
      const tag = el.tagName
      const id = (el as HTMLElement).id || ''
      const cls =
        typeof el.className === 'string' ? el.className.substring(0, 60) : ''

      // Only log elements that are either large, far off-screen, or structural
      const isOffScreen = rect.y > window.innerHeight * 2
      const isLarge = rect.height > 500
      const isStructural =
        ['HEADER', 'MAIN', 'NAV', 'DIV'].includes(tag) && depth < 5

      if (isOffScreen || isLarge || isStructural) {
        results.push({
          depth,
          tag,
          id,
          cls,
          y: Math.round(rect.y),
          h: Math.round(rect.height),
          display: style.display,
          position: style.position,
          flexDirection: style.flexDirection,
          overflow: style.overflow,
        })
      }

      for (const child of el.children) {
        walk(child, depth + 1, maxDepth)
      }
    }

    const app = document.querySelector('#app')
    if (app) walk(app, 0, 8)

    return results
  })
  log(`LAYOUT TREE: ${JSON.stringify(tree, null, 2)}`)

  // Also check the computed flex layout of #app's direct children
  const appChildren = await page.evaluate(() => {
    const app = document.querySelector('#app')
    if (!app) return 'NO #APP'
    const children: any[] = []
    for (const child of app.children) {
      const rect = child.getBoundingClientRect()
      const style = window.getComputedStyle(child)
      children.push({
        tag: child.tagName,
        id: (child as HTMLElement).id || '',
        class:
          typeof child.className === 'string'
            ? child.className.substring(0, 60)
            : '',
        y: Math.round(rect.y),
        h: Math.round(rect.height),
        display: style.display,
        position: style.position,
        flex: style.flex,
        flexGrow: style.flexGrow,
        flexShrink: style.flexShrink,
      })
    }
    return children
  })
  log(`#APP DIRECT CHILDREN: ${JSON.stringify(appChildren, null, 2)}`)

  const outPath = testInfo.outputPath('debug-layout-output.txt')
  fs.writeFileSync(outPath, output.join('\n'))
})
