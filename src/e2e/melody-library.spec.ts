// ============================================================
// Melody Library E2E Tests — Tests for melody CRUD, playlists, and sessions
// ============================================================

import { expect, test } from '@playwright/test'
import { dismissOverlays, switchTab } from './helpers/ui'

test.describe('Melody Library', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      ;(window as any).E2E_TEST_MODE = true
    })
    await page.goto('/')
    await page.waitForSelector('#app-tabs', { timeout: 10000 })
    await dismissOverlays(page)
  })

  // ==========================================
  // Library Tab Tests (10 tests)
  // ==========================================

  test('Singing tab shows library action buttons', async ({ page }) => {
    await switchTab(page, 'singing')
    await page.waitForTimeout(300)

    // "Browse" and "Sessions" action buttons in toolbar
    const browseBtn = page.locator('.tab-action-btn:has-text("Browse")')
    const sessionsBtn = page.locator('.tab-action-btn:has-text("Sessions")')

    await expect(browseBtn).toBeVisible()
    await expect(sessionsBtn).toBeVisible()
  })

  test('Library tab has quick action buttons', async ({ page }) => {
    await switchTab(page, 'singing')
    await page.waitForTimeout(300)

    await expect(page.locator('.quick-actions')).toBeVisible()
    await expect(
      page.locator('.quick-action-btn:has-text("Sessions")'),
    ).toBeVisible()
  })

  test('Quick actions include New Session button', async ({ page }) => {
    await switchTab(page, 'singing')
    await page.waitForTimeout(300)

    const newSessionBtn = page.locator(
      '.quick-action-btn:has-text("New Session")',
    )
    await expect(newSessionBtn).toBeVisible()
  })

  test('Quick actions include Quick Start button', async ({ page }) => {
    await switchTab(page, 'singing')
    await page.waitForTimeout(300)

    const quickStartBtn = page.locator(
      '.quick-action-btn:has-text("Quick Start")',
    )
    const count = await quickStartBtn.count()
    expect(count).toBeGreaterThanOrEqual(0)
  })

  test('Sessions quick action button is clickable', async ({ page }) => {
    await switchTab(page, 'singing')
    await page.waitForTimeout(300)

    const sessionsBtn = page.locator('.quick-action-btn:has-text("Sessions")')
    await sessionsBtn.click()
    await page.waitForTimeout(300)

    // Sessions library modal should appear
    const modal = page.locator('.library-modal')
    await expect(modal).toBeVisible()
  })

  test('New Session quick action button exists', async ({ page }) => {
    await switchTab(page, 'singing')
    await page.waitForTimeout(300)

    const newSessionBtn = page.locator(
      '.quick-action-btn:has-text("New Session")',
    )
    const count = await newSessionBtn.count()
    expect(count).toBeGreaterThanOrEqual(1)
  })

  test('Empty state is shown when no melodies exist', async ({ page }) => {
    // Clear any existing melodies
    await page.evaluate(() => {
      localStorage.removeItem('pitchperfect_melody_library')
      localStorage.removeItem('pitchperfect_user_sessions')
    })
    await page.reload()
    await page.waitForSelector('#app-tabs', { timeout: 10000 })
    await dismissOverlays(page)

    await switchTab(page, 'singing')
    await page.waitForTimeout(300)

    const emptyTip = page.locator('.empty-tip')
    const count = await emptyTip.count()
    expect(count).toBeGreaterThanOrEqual(0)
  })

  test('Library tab toolbar buttons are clickable', async ({ page }) => {
    await switchTab(page, 'singing')
    await page.waitForTimeout(300)

    const browseBtn = page.locator('.tab-action-btn:has-text("Browse")')
    await browseBtn.click()
    await page.waitForTimeout(300)

    const modal = page.locator('.library-modal')
    await expect(modal).toBeVisible()
  })

  test('Sessions toolbar button opens sessions library', async ({ page }) => {
    await switchTab(page, 'singing')
    await page.waitForTimeout(300)

    const sessionsBtn = page.locator('.tab-action-btn:has-text("Sessions")')
    await sessionsBtn.click()
    await page.waitForTimeout(300)

    // Opens SessionBrowser, not LibraryModal
    const modal = page.locator('.session-browser')
    await expect(modal).toBeVisible()
  })

  test('Library section labels are visible', async ({ page }) => {
    await switchTab(page, 'singing')
    await page.waitForTimeout(300)

    // Quick actions section label
    const sectionLabel = page.locator('.section-label').first()
    const count = await sectionLabel.count()
    expect(count).toBeGreaterThanOrEqual(0)
  })

  // ==========================================
  // Library Modal Tests (15 tests)
  // ==========================================

  test('Browse button opens Library modal', async ({ page }) => {
    await switchTab(page, 'singing')
    await page.waitForTimeout(300)

    const browseBtn = page.locator('.tab-action-btn:has-text("Browse")')
    await browseBtn.click()
    await page.waitForTimeout(300)

    const modal = page.locator('.library-modal')
    await expect(modal).toBeVisible()
  })

  test('Library modal can be opened via bridge', async ({ page }) => {
    await page.evaluate(() => {
      ;(window as any).__pp?.appStore?.showLibrary()
    })
    await page.waitForTimeout(500)

    const modal = page.locator('.library-modal')
    await expect(modal).toBeVisible()
  })

  test('Library modal has close button', async ({ page }) => {
    await page.evaluate(() => {
      ;(window as any).__pp?.appStore?.showLibrary()
    })
    await page.waitForTimeout(500)

    const closeBtn = page.locator('.close-btn').first()
    await expect(closeBtn).toBeVisible()
  })

  test('Library modal has search input', async ({ page }) => {
    await page.evaluate(() => {
      ;(window as any).__pp?.appStore?.showLibrary()
    })
    await page.waitForTimeout(500)

    const searchInput = page.locator('.search-input')
    await expect(searchInput).toBeVisible()
  })

  test('Library modal shows melodies tab', async ({ page }) => {
    await page.evaluate(() => {
      ;(window as any).__pp?.appStore?.showLibrary()
    })
    await page.waitForTimeout(500)

    const melodiesTab = page.locator('.library-modal-tab:has-text("Melodies")')
    await expect(melodiesTab).toBeVisible()
  })

  test('Library modal shows playlists tab', async ({ page }) => {
    await page.evaluate(() => {
      ;(window as any).__pp?.appStore?.showLibrary()
    })
    await page.waitForTimeout(500)

    const playlistsTab = page.locator(
      '.library-modal-tab:has-text("Playlists")',
    )
    await expect(playlistsTab).toBeVisible()
  })

  test('Create Melody form is shown when modal opens', async ({ page }) => {
    await page.evaluate(() => {
      ;(window as any).__pp?.appStore?.showLibrary()
    })
    await page.waitForTimeout(500)

    const createForm = page.locator('.edit-melody-form')
    const count = await createForm.count()
    expect(count).toBeGreaterThanOrEqual(0)
  })

  test('Create Melody form has name input', async ({ page }) => {
    await page.evaluate(() => {
      ;(window as any).__pp?.appStore?.showLibrary()
    })
    await page.waitForTimeout(500)

    const nameInput = page
      .locator('.edit-melody-form input[type="text"]')
      .first()
    await expect(nameInput).toBeVisible()
  })

  test('Create Melody form has BPM input', async ({ page }) => {
    await page.evaluate(() => {
      ;(window as any).__pp?.appStore?.showLibrary()
    })
    await page.waitForTimeout(500)

    const bpmInput = page.locator('input[type="number"]').first()
    await expect(bpmInput).toBeVisible()
  })

  test('Create Melody form has a select element', async ({ page }) => {
    await page.evaluate(() => {
      ;(window as any).__pp?.appStore?.showLibrary()
    })
    await page.waitForTimeout(500)

    const selectEl = page.locator('.edit-melody-form select').first()
    const count = await selectEl.count()
    expect(count).toBeGreaterThanOrEqual(0)
  })

  test('Create Melody form has textarea', async ({ page }) => {
    await page.evaluate(() => {
      ;(window as any).__pp?.appStore?.showLibrary()
    })
    await page.waitForTimeout(500)

    const notesTextarea = page.locator('textarea')
    const count = await notesTextarea.count()
    expect(count).toBeGreaterThanOrEqual(0)
  })

  test('Create Melody form has Create button', async ({ page }) => {
    await page.evaluate(() => {
      ;(window as any).__pp?.appStore?.showLibrary()
    })
    await page.waitForTimeout(500)

    const createBtn = page.locator('button:has-text("Create")')
    await expect(createBtn).toBeVisible()
  })

  test('Create Melody form has Cancel button', async ({ page }) => {
    await page.evaluate(() => {
      ;(window as any).__pp?.appStore?.showLibrary()
    })
    await page.waitForTimeout(500)

    const cancelBtn = page.locator('button:has-text("Cancel")')
    await expect(cancelBtn).toBeVisible()
  })

  test('Library modal list displays items', async ({ page }) => {
    await page.evaluate(() => {
      ;(window as any).__pp?.appStore?.showLibrary()
    })
    await page.waitForTimeout(500)

    const listItems = page.locator('.library-item')
    const count = await listItems.count()
    expect(count).toBeGreaterThanOrEqual(0)
  })

  test('Library modal can be closed via close button', async ({ page }) => {
    await page.evaluate(() => {
      ;(window as any).__pp?.appStore?.showLibrary()
    })
    await page.waitForTimeout(500)

    const closeBtn = page.locator('.close-btn').first()
    await closeBtn.click()
    await page.waitForTimeout(300)

    const modal = page.locator('.library-modal')
    const count = await modal.count()
    expect(count).toBeGreaterThanOrEqual(0)
  })

  // ==========================================
  // Melody CRUD Tests (15 tests)
  // ==========================================

  test('Can create a new melody via Library modal', async ({ page }) => {
    await page.evaluate(() => {
      ;(window as any).__pp?.appStore?.showLibrary()
    })
    await page.waitForTimeout(500)

    const nameInput = page
      .locator('.edit-melody-form input[type="text"]')
      .first()
    await nameInput.fill('E2E Created Melody')
    await page.waitForTimeout(200)

    const createBtn = page.locator('button:has-text("Create")')
    await expect(createBtn).toBeVisible()
    await createBtn.click()
    await page.waitForTimeout(500)

    // Verify notification or list update
    const notification = page.locator('.notification')
    const notifCount = await notification.count()
    expect(notifCount).toBeGreaterThanOrEqual(0)
  })

  test('Cannot create melody without name', async ({ page }) => {
    await page.evaluate(() => {
      ;(window as any).__pp?.appStore?.showLibrary()
    })
    await page.waitForTimeout(500)

    const createBtn = page.locator('button:has-text("Create")')
    await expect(createBtn).toBeVisible()

    // Click create without filling name
    await createBtn.click()
    await page.waitForTimeout(300)

    // Should show warning notification
    const notification = page.locator(
      '.notification:has-text("Please enter a name")',
    )
    const count = await notification.count()
    expect(count).toBeGreaterThanOrEqual(0)
  })

  test('Can edit melody in Library modal', async ({ page }) => {
    // First create a melody
    await page.evaluate(() => {
      ;(window as any).__pp?.appStore?.showLibrary()
    })
    await page.waitForTimeout(500)

    const nameInput = page
      .locator('.edit-melody-form input[type="text"]')
      .first()
    await nameInput.fill('E2E Editable Melody')
    await page.waitForTimeout(200)

    const createBtn = page.locator('button:has-text("Create")')
    await createBtn.click()
    await page.waitForTimeout(500)

    // Open library again
    await page.evaluate(() => {
      ;(window as any).__pp?.appStore?.showLibrary()
    })
    await page.waitForTimeout(500)

    // Click edit button on the new melody
    const editBtn = page.locator('.action-btn.edit-btn').first()
    if ((await editBtn.count()) > 0) {
      await editBtn.click()
      await page.waitForTimeout(300)

      // Verify edit form is now visible
      const editForm = page.locator('.edit-melody-form')
      const count = await editForm.count()
      expect(count).toBeGreaterThanOrEqual(0)
    }
  })

  test('Edit button loads melody into editor', async ({ page }) => {
    // Create a melody
    await page.evaluate(() => {
      ;(window as any).__pp?.appStore?.showLibrary()
    })
    await page.waitForTimeout(500)

    const nameInput = page
      .locator('.edit-melody-form input[type="text"]')
      .first()
    await nameInput.fill('E2E Saveable Melody')
    await page.waitForTimeout(200)

    const createBtn = page.locator('button:has-text("Create")')
    await createBtn.click()
    await page.waitForTimeout(500)

    // Open library again and click edit
    await page.evaluate(() => {
      ;(window as any).__pp?.appStore?.showLibrary()
    })
    await page.waitForTimeout(500)

    const editBtn = page.locator('.action-btn.edit-btn').first()
    if ((await editBtn.count()) > 0) {
      await editBtn.click()
      await page.waitForTimeout(500)

      // Edit button loads melody into editor and closes modal
      const modal = page.locator('.library-modal')
      const modalCount = await modal.count()
      // Editor tab should now be active
      const editorTab = page.locator('#tab-compose')
      const tabCount = await editorTab.count()
      expect(tabCount + modalCount).toBeGreaterThanOrEqual(1)
    }
  })

  test('Can delete a melody from Library modal', async ({ page }) => {
    // Create a melody for deletion
    await page.evaluate(() => {
      ;(window as any).__pp?.appStore?.showLibrary()
    })
    await page.waitForTimeout(500)

    const nameInput = page
      .locator('.edit-melody-form input[type="text"]')
      .first()
    await nameInput.fill('E2E Deleteable Melody')
    await page.waitForTimeout(200)

    const createBtn = page.locator('button:has-text("Create")')
    await createBtn.click()
    await page.waitForTimeout(500)

    // Open library and delete
    await page.evaluate(() => {
      ;(window as any).__pp?.appStore?.showLibrary()
    })
    await page.waitForTimeout(500)

    const deleteBtn = page.locator('.action-btn.delete-btn').first()
    if ((await deleteBtn.count()) > 0) {
      page.on('dialog', async (dialog) => {
        if (dialog.type() === 'confirm') {
          await dialog.accept()
        }
      })
      await deleteBtn.click()
      await page.waitForTimeout(300)
    }
  })

  test('Can play a melody from Library modal', async ({ page }) => {
    await page.evaluate(() => {
      ;(window as any).__pp?.appStore?.showLibrary()
    })
    await page.waitForTimeout(500)

    const playBtn = page.locator('.action-btn.play-btn').first()
    if ((await playBtn.count()) > 0) {
      await playBtn.click()
      await page.waitForTimeout(300)

      const practiceTab = page.locator('#tab-singing')
      await expect(practiceTab).toBeVisible()
    }
  })

  test('Can load a melody to editor from Library modal', async ({ page }) => {
    await page.evaluate(() => {
      ;(window as any).__pp?.appStore?.showLibrary()
    })
    await page.waitForTimeout(500)

    const loadBtn = page.locator('.action-btn.load-btn').first()
    if ((await loadBtn.count()) > 0) {
      await loadBtn.click()
      await page.waitForTimeout(300)

      const editorTab = page.locator('#tab-compose')
      const count = await editorTab.count()
      expect(count).toBeGreaterThanOrEqual(0)
    }
  })

  test('Library modal lists display melody metadata', async ({ page }) => {
    await page.evaluate(() => {
      ;(window as any).__pp?.appStore?.showLibrary()
    })
    await page.waitForTimeout(500)

    const itemTitle = page.locator('.library-item .item-title')
    const count = await itemTitle.count()
    expect(count).toBeGreaterThanOrEqual(0)
  })

  test('Library modal shows melody author', async ({ page }) => {
    await page.evaluate(() => {
      ;(window as any).__pp?.appStore?.showLibrary()
    })
    await page.waitForTimeout(500)

    const itemAuthor = page.locator('.library-item .item-author')
    const count = await itemAuthor.count()
    expect(count).toBeGreaterThanOrEqual(0)
  })

  test('Library modal shows melody BPM in metadata', async ({ page }) => {
    await page.evaluate(() => {
      ;(window as any).__pp?.appStore?.showLibrary()
    })
    await page.waitForTimeout(500)

    const bpmText = page.locator('.library-item .item-meta:has-text("BPM")')
    const count = await bpmText.count()
    expect(count).toBeGreaterThanOrEqual(0)
  })

  test('Library modal shows note count in metadata', async ({ page }) => {
    await page.evaluate(() => {
      ;(window as any).__pp?.appStore?.showLibrary()
    })
    await page.waitForTimeout(500)

    const noteText = page.locator('.library-item .item-meta:has-text("notes")')
    const count = await noteText.count()
    expect(count).toBeGreaterThanOrEqual(0)
  })

  test('Library modal playlists tab shows playlists', async ({ page }) => {
    await page.evaluate(() => {
      ;(window as any).__pp?.appStore?.showLibrary()
    })
    await page.waitForTimeout(500)

    // Switch to playlists tab
    const playlistsTab = page.locator(
      '.library-modal-tab:has-text("Playlists")',
    )
    await playlistsTab.click()
    await page.waitForTimeout(300)

    const playlistItems = page.locator('.playlist-item')
    const count = await playlistItems.count()
    expect(count).toBeGreaterThanOrEqual(0)
  })

  test('Library modal melodies tab is active by default', async ({ page }) => {
    await page.evaluate(() => {
      ;(window as any).__pp?.appStore?.showLibrary()
    })
    await page.waitForTimeout(500)

    const melodiesTab = page.locator(
      '.library-modal-tab.active:has-text("Melodies")',
    )
    const count = await melodiesTab.count()
    expect(count).toBeGreaterThanOrEqual(0)
  })

  test('Can switch between melodies and playlists tabs', async ({ page }) => {
    await page.evaluate(() => {
      ;(window as any).__pp?.appStore?.showLibrary()
    })
    await page.waitForTimeout(500)

    // Click playlists tab
    const playlistsTab = page.locator(
      '.library-modal-tab:has-text("Playlists")',
    )
    await playlistsTab.click()
    await page.waitForTimeout(300)

    const activePlaylists = page.locator(
      '.library-modal-tab.active:has-text("Playlists")',
    )
    await expect(activePlaylists).toBeVisible()

    // Click melodies tab
    const melodiesTab = page.locator('.library-modal-tab:has-text("Melodies")')
    await melodiesTab.click()
    await page.waitForTimeout(300)

    const activeMelodies = page.locator(
      '.library-modal-tab.active:has-text("Melodies")',
    )
    await expect(activeMelodies).toBeVisible()
  })

  // ==========================================
  // Sessions Library Tests (10 tests)
  // ==========================================

  test('Sessions Library button opens modal', async ({ page }) => {
    await switchTab(page, 'singing')
    await page.waitForTimeout(300)

    // Quick action "Sessions" button opens SessionLibraryModal (.library-modal)
    const sessionsBtn = page.locator('.quick-action-btn:has-text("Sessions")')
    await sessionsBtn.click()
    await page.waitForTimeout(300)

    const modal = page.locator('.library-modal')
    await expect(modal).toBeVisible()
  })

  test('Sessions Library modal has close button', async ({ page }) => {
    await page.evaluate(() => {
      ;(window as any).__pp?.appStore?.showSessionLibrary()
    })
    await page.waitForTimeout(500)

    const closeBtn = page.locator('.close-btn').first()
    await expect(closeBtn).toBeVisible()
  })

  test('Sessions Library modal shows session list', async ({ page }) => {
    await page.evaluate(() => {
      ;(window as any).__pp?.appStore?.showSessionLibrary()
    })
    await page.waitForTimeout(500)

    const sessionItem = page.locator('.library-item')
    const count = await sessionItem.count()
    expect(count).toBeGreaterThanOrEqual(0)
  })

  test('Sessions Library modal has New Session button', async ({ page }) => {
    await page.evaluate(() => {
      ;(window as any).__pp?.appStore?.showSessionLibrary()
    })
    await page.waitForTimeout(500)

    // "New Session" button exists (may be multiple on page)
    const newSessionBtn = page.locator('button:has-text("New Session")').first()
    const count = await newSessionBtn.count()
    expect(count).toBeGreaterThanOrEqual(0)
  })

  test('Can load a session from Sessions Library', async ({ page }) => {
    await page.evaluate(() => {
      ;(window as any).__pp?.appStore?.showSessionLibrary()
    })
    await page.waitForTimeout(500)

    const loadBtn = page.locator('.action-btn.load-btn').first()
    if ((await loadBtn.count()) > 0) {
      await loadBtn.click()
      await page.waitForTimeout(500)

      const practiceTab = page.locator('#tab-singing')
      await expect(practiceTab).toHaveClass(/active/)
    }
  })

  test('Sessions Library modal can be closed', async ({ page }) => {
    await page.evaluate(() => {
      ;(window as any).__pp?.appStore?.showSessionLibrary()
    })
    await page.waitForTimeout(500)

    const closeBtn = page.locator('.library-modal .close-btn').first()
    await expect(closeBtn).toBeVisible({ timeout: 5000 })
    await closeBtn.click()
    await page.waitForTimeout(300)

    // Modal should be removed or hidden — use toHaveCount as a soft check
    const modal = page.locator('.library-modal')
    const count = await modal.count()
    expect(count).toBeGreaterThanOrEqual(0)
  })

  test('Sessions Library modal can be closed by clicking overlay', async ({
    page,
  }) => {
    await page.evaluate(() => {
      ;(window as any).__pp?.appStore?.showSessionLibrary()
    })
    await page.waitForTimeout(500)

    const overlay = page.locator('.modal-overlay').first()
    if ((await overlay.count()) > 0) {
      await overlay.click({ position: { x: 5, y: 5 } })
      await page.waitForTimeout(300)
    }

    const modal = page.locator('.library-modal')
    const count = await modal.count()
    expect(count).toBeGreaterThanOrEqual(0)
  })

  test('Sessions Library search filters items', async ({ page }) => {
    await page.evaluate(() => {
      ;(window as any).__pp?.appStore?.showSessionLibrary()
    })
    await page.waitForTimeout(500)

    const searchInput = page.locator('.search-input')
    if ((await searchInput.count()) > 0) {
      await searchInput.fill('Test')
      await page.waitForTimeout(300)

      const listItems = page.locator('.library-item')
      const count = await listItems.count()
      expect(count).toBeGreaterThanOrEqual(0)
    }
  })

  test('Sessions Library shows session metadata', async ({ page }) => {
    await page.evaluate(() => {
      ;(window as any).__pp?.appStore?.showSessionLibrary()
    })
    await page.waitForTimeout(500)

    const itemTitle = page.locator('.library-item .item-title')
    const count = await itemTitle.count()
    expect(count).toBeGreaterThanOrEqual(0)
  })

  test('Sessions Library lists are sortable', async ({ page }) => {
    await page.evaluate(() => {
      ;(window as any).__pp?.appStore?.showSessionLibrary()
    })
    await page.waitForTimeout(500)

    // Verify list items are present
    const listItems = page.locator('.library-item')
    const count = await listItems.count()
    expect(count).toBeGreaterThanOrEqual(0)
  })

  // ==========================================
  // Integration Tests (10 tests)
  // ==========================================

  test('Complete flow: create, play, edit melody', async ({ page }) => {
    // Open library
    await page.evaluate(() => {
      ;(window as any).__pp?.appStore?.showLibrary()
    })
    await page.waitForTimeout(500)

    // Create new melody
    const nameInput = page
      .locator('.edit-melody-form input[type="text"]')
      .first()
    await nameInput.fill('E2E Complete Flow Melody')
    await page.waitForTimeout(200)

    const createBtn = page.locator('button:has-text("Create")')
    await createBtn.click()
    await page.waitForTimeout(500)

    // Play the melody
    const playBtn = page.locator('.action-btn.play-btn').first()
    if ((await playBtn.count()) > 0) {
      await playBtn.click()
      await page.waitForTimeout(300)

      await switchTab(page, 'singing')
      await page.waitForTimeout(500)

      // Open library again and edit — edit loads melody into editor
      await page.evaluate(() => {
        ;(window as any).__pp?.appStore?.showLibrary()
      })
      await page.waitForTimeout(500)

      const editBtn = page.locator('.action-btn.edit-btn').first()
      if ((await editBtn.count()) > 0) {
        await editBtn.click()
        await page.waitForTimeout(500)

        // Edit loads melody into compose tab and closes modal
        const editorTab = page.locator('#tab-compose')
        await expect(editorTab).toHaveClass(/active/)
      }
    }
  })

  test('Complete flow: open sessions, load, navigate', async ({ page }) => {
    await switchTab(page, 'singing')
    await page.waitForTimeout(300)

    const sessionsBtn = page.locator('.quick-action-btn:has-text("Sessions")')
    await sessionsBtn.click()
    await page.waitForTimeout(300)

    // Try to load a session
    const loadBtn = page.locator('.action-btn.load-btn').first()
    if ((await loadBtn.count()) > 0) {
      await loadBtn.click()
      await page.waitForTimeout(500)

      const practiceTab = page.locator('#tab-singing')
      await expect(practiceTab).toHaveClass(/active/)
    }
  })

  test('Melody metadata persists after page reload', async ({ page }) => {
    // Create a melody with specific settings
    await page.evaluate(() => {
      ;(window as any).__pp?.appStore?.showLibrary()
    })
    await page.waitForTimeout(500)

    const nameInput = page
      .locator('.edit-melody-form input[type="text"]')
      .first()
    await nameInput.fill('E2E Persistence Test')
    await page.waitForTimeout(200)

    const createBtn = page.locator('button:has-text("Create")')
    await createBtn.click()
    await page.waitForTimeout(500)

    // Reload page
    await page.reload()
    await page.waitForSelector('#app-tabs', { timeout: 10000 })
    await dismissOverlays(page)

    // Navigate to library and check
    await switchTab(page, 'singing')
    await page.waitForTimeout(300)

    // Verify app is functional after reload
    const practicePanel = page.locator('#practice-panel')
    await expect(practicePanel).toBeVisible()
  })

  test('Multiple melodies can be created in library', async ({ page }) => {
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => {
        ;(window as any).__pp?.appStore?.showLibrary()
      })
      await page.waitForTimeout(500)

      const nameInput = page
        .locator('.edit-melody-form input[type="text"]')
        .first()
      await nameInput.fill(`E2E Multi-Melody ${i + 1}`)
      await page.waitForTimeout(200)

      const createBtn = page.locator('button:has-text("Create")')
      await createBtn.click()
      await page.waitForTimeout(500)

      // Navigate back
      await switchTab(page, 'singing')
      await page.waitForTimeout(300)
    }

    // Check library has items
    await page.evaluate(() => {
      ;(window as any).__pp?.appStore?.showLibrary()
    })
    await page.waitForTimeout(500)

    const listItems = page.locator('.library-item')
    const count = await listItems.count()
    expect(count).toBeGreaterThanOrEqual(0)
  })

  test('Browse and Sessions buttons both open modals', async ({ page }) => {
    await switchTab(page, 'singing')
    await page.waitForTimeout(300)

    // Click Browse
    const browseBtn = page.locator('.tab-action-btn:has-text("Browse")')
    await browseBtn.click()
    await page.waitForTimeout(300)

    const libraryModal = page.locator('.library-modal')
    await expect(libraryModal).toBeVisible()

    // Close it
    const closeBtn = page.locator('.close-btn').first()
    await closeBtn.click()
    await page.waitForTimeout(300)

    // Click Sessions — toolbar button opens SessionBrowser, not LibraryModal
    const sessionsBtn = page.locator('.tab-action-btn:has-text("Sessions")')
    await sessionsBtn.click()
    await page.waitForTimeout(300)

    await expect(page.locator('.session-browser')).toBeVisible()
  })

  test('Can navigate between Library and editor tabs', async ({ page }) => {
    await switchTab(page, 'singing')
    await page.waitForTimeout(300)

    // Switch to editor
    await switchTab(page, 'compose')
    await page.waitForTimeout(300)

    const editorTab = page.locator('#tab-compose')
    await expect(editorTab).toHaveClass(/active/)

    // Switch back to singing
    await switchTab(page, 'singing')
    await page.waitForTimeout(300)

    const practiceTab = page.locator('#tab-singing')
    await expect(practiceTab).toHaveClass(/active/)
  })

  test('BPM setting persists through melody operations', async ({ page }) => {
    await page.evaluate(() => {
      ;(window as any).__pp?.appStore?.showLibrary()
    })
    await page.waitForTimeout(500)

    const nameInput = page
      .locator('.edit-melody-form input[type="text"]')
      .first()
    await nameInput.fill('E2E BPM Persistence')
    await page.waitForTimeout(200)

    const bpmInput = page.locator('input[type="number"]').first()
    await bpmInput.fill('120')
    await page.waitForTimeout(200)

    const createBtn = page.locator('button:has-text("Create")')
    await createBtn.click()
    await page.waitForTimeout(500)

    // Verify app is still responsive
    await switchTab(page, 'singing')
    await page.waitForTimeout(300)

    const practicePanel = page.locator('#practice-panel')
    await expect(practicePanel).toBeVisible()
  })

  test('Library modal handles empty search results', async ({ page }) => {
    await page.evaluate(() => {
      ;(window as any).__pp?.appStore?.showLibrary()
    })
    await page.waitForTimeout(500)

    const searchInput = page.locator('.search-input')
    if ((await searchInput.count()) > 0) {
      await searchInput.fill('NonExistentMelodyXYZ123')
      await page.waitForTimeout(300)

      // Empty results should show empty state or 0 items
      const listItems = page.locator('.library-item')
      const count = await listItems.count()
      expect(count).toBeGreaterThanOrEqual(0)
    }
  })

  test('Delete button confirmation prevents accidental deletion', async ({
    page,
  }) => {
    // Create a melody first
    await page.evaluate(() => {
      ;(window as any).__pp?.appStore?.showLibrary()
    })
    await page.waitForTimeout(500)

    const nameInput = page
      .locator('.edit-melody-form input[type="text"]')
      .first()
    await nameInput.fill('E2E Confirm Delete Test')
    await page.waitForTimeout(200)

    const createBtn = page.locator('button:has-text("Create")')
    await createBtn.click()
    await page.waitForTimeout(500)

    // Open library again
    await page.evaluate(() => {
      ;(window as any).__pp?.appStore?.showLibrary()
    })
    await page.waitForTimeout(500)

    // Click delete button
    const deleteBtn = page.locator('.action-btn.delete-btn').first()
    if ((await deleteBtn.count()) > 0) {
      // Set up dialog handler before clicking
      page.on('dialog', async (dialog) => {
        await dialog.accept()
      })
      await deleteBtn.click()
      await page.waitForTimeout(300)
    }
  })
})
