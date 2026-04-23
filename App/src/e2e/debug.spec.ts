import { test, expect } from '@playwright/test'
import { dismissOverlays } from '@/e2e/helpers/ui'

test('check if appStore is available in evaluate', async ({ page }) => {
  await page.goto('/')
  await page.waitForLoadState('domcontentloaded')

  // Check if any JavaScript errors occurred
  const errors = await page.evaluate(() => {
    return (window as any).__lastError || null
  })

  console.log('JavaScript errors:', errors)

  // Check basic DOM state
  const rootHtml = await page.evaluate(() => {
    const root = document.getElementById('root')
    return {
      hasRoot: !!root,
      rootChildren: root?.children.length ?? 0,
      rootText: root?.textContent?.substring(0, 100) ?? null,
      fullHtml: document.documentElement.outerHTML.substring(0, 500),
    }
  })

  console.log('Root state:', JSON.stringify(rootHtml))

  // Check if onMount was called by checking for a debug marker
  const debugRendered = await page.evaluate(() => {
    const debugEl = document.querySelector('[data-debug-rendered]') as HTMLElement | null
    return !!debugEl
  })

  console.log('Debug render marker found:', debugRendered)

  // Check if window.onerror was called
  const errorOccurred = await page.evaluate(() => {
    return (window as any).__errorOccurred || false
  })

  console.log('Error occurred:', errorOccurred)

  // Wait and check after load
  await page.waitForLoadState('networkidle', { timeout: 10000 })
  const afterLoad = await page.evaluate(() => {
    return {
      appStore: typeof (window as any).__appStore !== 'undefined',
      hasRoot: !!document.getElementById('root'),
      rootChildren: document.getElementById('root')?.children.length ?? 0,
      bodyHtml: document.body.innerHTML.substring(0, 200),
      scripts: Array.from(document.querySelectorAll('script')).map((s) => s.src || s.textContent?.substring(0, 50)),
    }
  })
  console.log('After networkidle:', JSON.stringify(afterLoad))

  // Get browser console logs
  const consoleLogs = await page.evaluate(() => {
    return (window as any).__consoleLogs || []
  })
  console.log('Console logs:', JSON.stringify(consoleLogs))
})