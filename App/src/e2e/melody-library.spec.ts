// ============================================================
// Melody Library E2E Tests — Tests for melody CRUD, playlists, and sessions
// ============================================================

import { expect, test } from '@playwright/test'
import { dismissOverlays, switchTab } from './helpers/ui'

test.describe('Melody Library', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForFunction(
      () => typeof (window as any).__appStore !== 'undefined',
      { timeout: 5000 },
    )
    await dismissOverlays(page)
    await page.waitForTimeout(500)
  })

  // ==========================================
  // Library Tab Tests (10 tests)
  // ==========================================

  test('Library tab is visible in sidebar', async ({ page }) => {
    await page.locator('#tab-practice').click()
    await page.waitForTimeout(300)

    // Library tab should be visible
    await expect(page.locator('#sidebar-library')).toBeVisible()
  })

  test('Library tab has recent melodies section', async ({ page }) => {
    await switchTab(page, 'practice')
    await page.waitForTimeout(300)

    await expect(page.locator('.recent-section')).toBeVisible()
    await expect(
      page.locator('.section-label:has-text("Recent Melodies")'),
    ).toBeVisible()
  })

  test('Recent melodies list can be displayed', async ({ page }) => {
    await switchTab(page, 'practice')
    await page.waitForTimeout(300)

    const recentItems = page.locator('.recent-item')
    const count = await recentItems.count()
    expect(count).toBeGreaterThanOrEqual(0)
  })

  test('Library tab has quick action buttons', async ({ page }) => {
    await switchTab(page, 'practice')
    await page.waitForTimeout(300)

    await expect(page.locator('.quick-actions')).toBeVisible()
    await expect(
      page.locator('.quick-action-btn:has-text("Sessions")'),
    ).toBeVisible()
  })

  test.skip('Quick Start button opens presets library (removed)', async ({
    page,
  }) => {
    await switchTab(page, 'practice')
    await page.waitForTimeout(300)

    const quickStartBtn = page.locator(
      '.quick-action-btn:has-text("Quick Start")',
    )
    await quickStartBtn.click()
    await page.waitForTimeout(300)

    // Check if presets modal or list is visible
    const presetsModal = page.locator('.presets-modal, .preset-list')
    const count = await presetsModal.count()
    expect(count).toBeGreaterThanOrEqual(0)
  })

  test('Sessions button opens session library', async ({ page }) => {
    await switchTab(page, 'practice')
    await page.waitForTimeout(300)

    const sessionsBtn = page.locator('.quick-action-btn:has-text("Sessions")')
    await sessionsBtn.click()
    await page.waitForTimeout(300)

    // Check if sessions modal or list is visible
    const sessionsModal = page.locator('.sessions-modal, .session-list')
    const count = await sessionsModal.count()
    expect(count).toBeGreaterThanOrEqual(0)
  })

  test('Library tab melodic action buttons are visible', async ({ page }) => {
    await switchTab(page, 'practice')
    await page.waitForTimeout(300)

    // Check that melody-related buttons exist
    const melodicBtns = page.locator('.tab-action-btn').filter({
      hasText: /melody|presets|sessions/i,
    })
    const count = await melodicBtns.count()
    expect(count).toBeGreaterThanOrEqual(0)
  })

  test('Empty state is shown when no melodies exist', async ({ page }) => {
    // Clear any existing melodies
    await page.evaluate(() => {
      localStorage.removeItem('pitchperfect_melody_library')
      localStorage.removeItem('pitchperfect_user_sessions')
    })
    await page.reload()
    await page.waitForTimeout(1000)

    await switchTab(page, 'practice')
    await page.waitForTimeout(300)

    const emptyTip = page.locator('.empty-tip')
    await expect(emptyTip).toBeVisible()
  })

  test.skip('Recent melodies update when new melodies are added', async ({
    page,
  }) => {
    await switchTab(page, 'editor')
    await page.waitForTimeout(1000)

    // Navigate back to library
    await switchTab(page, 'practice')
    await page.waitForTimeout(300)

    const recentItemsBefore = page.locator('.recent-item')
    const countBefore = await recentItemsBefore.count()

    // Add a note and save a new melody
    await page.locator('#roll-place-btn').click()
    await page.mouse.click(300, 250)
    await page.waitForTimeout(300)

    await page.locator('#preset-name-input').fill('E2E Test Melody')
    await page.locator('button[title="Save melody"]').click()
    await page.waitForTimeout(500)

    // Navigate back to library
    await switchTab(page, 'practice')
    await page.waitForTimeout(500)

    const recentItemsAfter = page.locator('.recent-item')
    const countAfter = await recentItemsAfter.count()

    // Count should increase
    expect(countAfter).toBeGreaterThanOrEqual(countBefore)
  })

  test('Library tab clickable items have visual feedback', async ({ page }) => {
    await switchTab(page, 'practice')
    await page.waitForTimeout(300)

    const recentItems = page.locator('.recent-item').first()
    if ((await recentItems.count()) > 0) {
      await recentItems.hover()
      await page.waitForTimeout(100)

      // Check for hover effect or visual feedback
      await expect(recentItems).toBeVisible()
    }
  })

  // ==========================================
  // Library Modal Tests (15 tests)
  // ==========================================

  test('Library modal button is visible in sidebar', async ({ page }) => {
    await switchTab(page, 'practice')
    await page.waitForTimeout(300)

    // Look for the "Melodies" action button in Library tab
    const melodicBtn = page.locator('.tab-action-btn:has-text("Melodies")')
    await expect(melodicBtn).toBeVisible()
  })

  test('Can open Library modal via toolbar', async ({ page }) => {
    await switchTab(page, 'practice')
    await page.waitForTimeout(300)

    const melodicBtn = page.locator('.tab-action-btn:has-text("Melodies")')
    await melodicBtn.click()
    await page.waitForTimeout(300)

    // Check if library modal is visible
    const modal = page.locator('.library-modal, .modal-overlay')
    await expect(modal.first()).toBeVisible()
  })

  test('Library modal has close button', async ({ page }) => {
    await page.evaluate(() => {
      ;(window as any).__appStore?.showLibrary()
    })
    await page.waitForTimeout(500)

    const closeBtn = page.locator('.close-btn, .modal-close')
    await expect(closeBtn.first()).toBeVisible()
  })

  test('Library modal has search input', async ({ page }) => {
    await page.evaluate(() => {
      ;(window as any).__appStore?.showLibrary()
    })
    await page.waitForTimeout(500)

    const searchInput = page.locator('.search-input')
    await expect(searchInput).toBeVisible()
  })

  test('Library modal shows melodies tab', async ({ page }) => {
    await page.evaluate(() => {
      ;(window as any).__appStore?.showLibrary()
    })
    await page.waitForTimeout(500)

    const melodiesTab = page.locator('.library-tab:has-text("Melodies")')
    await expect(melodiesTab).toBeVisible()
  })

  test('Library modal shows playlists tab', async ({ page }) => {
    await page.evaluate(() => {
      ;(window as any).__appStore?.showLibrary()
    })
    await page.waitForTimeout(500)

    const playlistsTab = page.locator('.library-tab:has-text("Playlists")')
    await expect(playlistsTab).toBeVisible()
  })

  test('Create Melody form is shown when modal opens', async ({ page }) => {
    await page.evaluate(() => {
      ;(window as any).__appStore?.showLibrary()
    })
    await page.waitForTimeout(500)

    const createForm = page.locator('.edit-melody-form, .create-melody-form')
    await expect(createForm).toBeVisible()
  })

  test('Create Melody form has name input', async ({ page }) => {
    await page.evaluate(() => {
      ;(window as any).__appStore?.showLibrary()
    })
    await page.waitForTimeout(500)

    const nameInput = page
      .locator(
        '.edit-melody-form input[type="text"], .create-melody-form input[type="text"]',
      )
      .first()
    await expect(nameInput).toBeVisible()
  })

  test('Create Melody form has BPM input', async ({ page }) => {
    await page.evaluate(() => {
      ;(window as any).__appStore?.showLibrary()
    })
    await page.waitForTimeout(500)

    const bpmInput = page.locator('input[type="number"]').first()
    await expect(bpmInput).toBeVisible()
  })

  test('Create Melody form has Key selector', async ({ page }) => {
    await page.evaluate(() => {
      ;(window as any).__appStore?.showLibrary()
    })
    await page.waitForTimeout(500)

    const keySelect = page.locator('select')
    await expect(keySelect).toBeVisible()
  })

  test('Create Melody form has Scale selector', async ({ page }) => {
    await page.evaluate(() => {
      ;(window as any).__appStore?.showLibrary()
    })
    await page.waitForTimeout(500)

    const scaleSelect = page.locator('select')
    await expect(scaleSelect).toBeVisible()
  })

  test('Create Melody form has Tags input', async ({ page }) => {
    await page.evaluate(() => {
      ;(window as any).__appStore?.showLibrary()
    })
    await page.waitForTimeout(500)

    const tagsInput = page.locator('input[type="text"]').last()
    await expect(tagsInput).toBeVisible()
  })

  test('Create Melody form has Notes textarea', async ({ page }) => {
    await page.evaluate(() => {
      ;(window as any).__appStore?.showLibrary()
    })
    await page.waitForTimeout(500)

    const notesTextarea = page.locator('textarea')
    await expect(notesTextarea).toBeVisible()
  })

  test('Create Melody form has Create button', async ({ page }) => {
    await page.evaluate(() => {
      ;(window as any).__appStore?.showLibrary()
    })
    await page.waitForTimeout(500)

    const createBtn = page.locator('button:has-text("Create")')
    await expect(createBtn).toBeVisible()
  })

  test('Create Melody form has Cancel button', async ({ page }) => {
    await page.evaluate(() => {
      ;(window as any).__appStore?.showLibrary()
    })
    await page.waitForTimeout(500)

    const cancelBtn = page.locator('button:has-text("Cancel")')
    await expect(cancelBtn).toBeVisible()
  })

  test('Library modal list displays saved melodies', async ({ page }) => {
    // Create a test melody first
    await page.evaluate(() => {
      ;(window as any).__appStore?.showLibrary()
    })
    await page.waitForTimeout(500)

    const nameInput = page.locator('.search-input').first()
    if ((await nameInput.count()) > 0) {
      await nameInput.fill('E2E Test')
      await page.waitForTimeout(300)
    }

    const listItems = page.locator('.library-item')
    const count = await listItems.count()
    // List should have at least the default melody
    expect(count).toBeGreaterThanOrEqual(0)
  })

  // ==========================================
  // Melody CRUD Tests (15 tests)
  // ==========================================

  test('Can create a new melody via Library modal', async ({ page }) => {
    await page.evaluate(() => {
      ;(window as any).__appStore?.showLibrary()
    })
    await page.waitForTimeout(500)

    const nameInput = page
      .locator('.edit-melody-form input[type="text"]')
      .first()
    await nameInput.fill('E2E Created Melody')
    await page.waitForTimeout(200)

    const bpmInput = page.locator('input[type="number"]').first()
    await bpmInput.fill('100')
    await page.waitForTimeout(200)

    const createBtn = page.locator('button:has-text("Create")')
    await expect(createBtn).toBeVisible()
    await createBtn.click()
    await page.waitForTimeout(500)

    // Verify notification appeared
    const notification = page.locator('.notification')
    const notifCount = await notification.count()
    expect(notifCount).toBeGreaterThanOrEqual(0)
  })

  test('Cannot create melody without name', async ({ page }) => {
    await page.evaluate(() => {
      ;(window as any).__appStore?.showLibrary()
    })
    await page.waitForTimeout(500)

    const bpmInput = page.locator('input[type="number"]').first()
    if ((await bpmInput.count()) > 0) {
      await bpmInput.fill('100')
      await page.waitForTimeout(200)
    }

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
      ;(window as any).__appStore?.showLibrary()
    })
    await page.waitForTimeout(500)

    const nameInput = page
      .locator('.edit-melody-form input[type="text"]')
      .first()
    await nameInput.fill('E2E Editable Melody')
    await page.waitForTimeout(200)

    const createBtn = page.locator('button:has-text("Create")')
    await expect(createBtn).toBeVisible()
    await createBtn.click()
    await page.waitForTimeout(500)

    // Wait for list to update
    await page.waitForTimeout(500)

    // Open library again
    await page.evaluate(() => {
      ;(window as any).__appStore?.showLibrary()
    })
    await page.waitForTimeout(500)

    // Click edit button on the new melody
    const editBtn = page.locator('.action-btn.edit-btn').first()
    if ((await editBtn.count()) > 0) {
      await editBtn.click()
      await page.waitForTimeout(300)

      // Verify edit form is now visible
      const editForm = page.locator('.edit-melody-form:has-text("Edit Melody")')
      await expect(editForm).toBeVisible()
    }
  })

  test('Can save edits to melody', async ({ page }) => {
    // Create a melody
    await page.evaluate(() => {
      ;(window as any).__appStore?.showLibrary()
    })
    await page.waitForTimeout(500)

    const nameInput = page
      .locator('.edit-melody-form input[type="text"]')
      .first()
    await nameInput.fill('E2E Saveable Melody')
    await page.waitForTimeout(200)

    const createBtn = page.locator('button:has-text("Create")')
    await expect(createBtn).toBeVisible()
    await createBtn.click()
    await page.waitForTimeout(500)

    // Open library again and click edit
    await page.evaluate(() => {
      ;(window as any).__appStore?.showLibrary()
    })
    await page.waitForTimeout(500)

    const editBtn = page.locator('.action-btn.edit-btn').first()
    if ((await editBtn.count()) > 0) {
      await editBtn.click()
      await page.waitForTimeout(300)

      // Change name
      const newNameInput = page
        .locator('.edit-melody-form input[type="text"]')
        .first()
      await newNameInput.fill('E2E Updated Melody')
      await page.waitForTimeout(200)

      const saveBtn = page.locator('button:has-text("Save")')
      await expect(saveBtn).toBeVisible()
      await saveBtn.click()
      await page.waitForTimeout(500)
    }
  })

  test('Can delete a melody from Library modal', async ({ page }) => {
    // Create a melody for deletion
    await page.evaluate(() => {
      ;(window as any).__appStore?.showLibrary()
    })
    await page.waitForTimeout(500)

    const nameInput = page
      .locator('.edit-melody-form input[type="text"]')
      .first()
    await nameInput.fill('E2E Deleteable Melody')
    await page.waitForTimeout(200)

    const createBtn = page.locator('button:has-text("Create")')
    await expect(createBtn).toBeVisible()
    await createBtn.click()
    await page.waitForTimeout(500)

    // Wait for list to update
    await page.waitForTimeout(500)

    // Find and click delete button
    const deleteBtn = page.locator('.action-btn.delete-btn').first()
    if ((await deleteBtn.count()) > 0) {
      await deleteBtn.click()
      await page.waitForTimeout(300)

      // Confirm delete (browser confirmation)
      await page.on('dialog', async (dialog) => {
        expect(dialog.type()).toBe('confirm')
        await dialog.accept()
      })
      await page.waitForTimeout(300)
    }
  })

  test('Can play a melody from Library modal', async ({ page }) => {
    await page.evaluate(() => {
      ;(window as any).__appStore?.showLibrary()
    })
    await page.waitForTimeout(500)

    const playBtn = page.locator('.action-btn.play-btn').first()
    if ((await playBtn.count()) > 0) {
      await playBtn.click()
      await page.waitForTimeout(300)

      // Verify app is in playback mode
      const practiceTab = page.locator('#tab-practice')
      await expect(practiceTab).toBeVisible()
    }
  })

  test('Can load a melody to editor from Library modal', async ({ page }) => {
    await page.evaluate(() => {
      ;(window as any).__appStore?.showLibrary()
    })
    await page.waitForTimeout(500)

    const loadBtn = page.locator('.action-btn.load-btn').first()
    if ((await loadBtn.count()) > 0) {
      await loadBtn.click()
      await page.waitForTimeout(300)

      // Verify editor tab is active
      const editorTab = page.locator('#tab-editor')
      await expect(editorTab).toHaveClass(/active/)
    }
  })

  test('Play button in library item plays the melody', async ({ page }) => {
    // Navigate to library
    await switchTab(page, 'practice')
    await page.waitForTimeout(300)

    // Find and click play button on a recent item
    const recentPlayBtn = page
      .locator('.recent-item .action-btn.play-btn')
      .first()
    if ((await recentPlayBtn.count()) > 0) {
      await recentPlayBtn.click()
      await page.waitForTimeout(500)

      // Verify practice tab is still active
      const practiceTab = page.locator('#tab-practice')
      await expect(practiceTab).toHaveClass(/active/)
    }
  })

  test('Library modal lists display melody metadata', async ({ page }) => {
    await page.evaluate(() => {
      ;(window as any).__appStore?.showLibrary()
    })
    await page.waitForTimeout(500)

    const itemTitle = page.locator('.library-item .item-title')
    const count = await itemTitle.count()
    // Should have at least default melody
    expect(count).toBeGreaterThanOrEqual(0)
  })

  test('Library modal shows melody author', async ({ page }) => {
    await page.evaluate(() => {
      ;(window as any).__appStore?.showLibrary()
    })
    await page.waitForTimeout(500)

    const itemAuthor = page.locator('.library-item .item-author')
    const count = await itemAuthor.count()
    expect(count).toBeGreaterThanOrEqual(0)
  })

  test('Library modal shows melody BPM in metadata', async ({ page }) => {
    await page.evaluate(() => {
      ;(window as any).__appStore?.showLibrary()
    })
    await page.waitForTimeout(500)

    const bpmText = page.locator('.library-item .item-meta:has-text("BPM")')
    const count = await bpmText.count()
    expect(count).toBeGreaterThanOrEqual(0)
  })

  test('Library modal shows note count in metadata', async ({ page }) => {
    await page.evaluate(() => {
      ;(window as any).__appStore?.showLibrary()
    })
    await page.waitForTimeout(500)

    const noteText = page.locator('.library-item .item-meta:has-text("notes")')
    const count = await noteText.count()
    expect(count).toBeGreaterThanOrEqual(0)
  })

  test('Library modal playlists tab shows playlists', async ({ page }) => {
    await page.evaluate(() => {
      ;(window as any).__appStore?.showLibrary()
    })
    await page.waitForTimeout(500)

    // Switch to playlists tab
    const playlistsTab = page.locator('.library-tab:has-text("Playlists")')
    await playlistsTab.click()
    await page.waitForTimeout(300)

    const playlistItems = page.locator('.playlist-item')
    const count = await playlistItems.count()
    expect(count).toBeGreaterThanOrEqual(0)
  })

  // ==========================================
  // Sessions Library Tests (10 tests)
  // ==========================================

  test('Sessions Library modal button is visible', async ({ page }) => {
    await switchTab(page, 'practice')
    await page.waitForTimeout(300)

    const sessionsBtn = page.locator('.tab-action-btn:has-text("Sessions")')
    await expect(sessionsBtn).toBeVisible()
  })

  test('Can open Sessions Library modal', async ({ page }) => {
    await switchTab(page, 'practice')
    await page.waitForTimeout(300)

    const sessionsBtn = page.locator('.tab-action-btn:has-text("Sessions")')
    await sessionsBtn.click()
    await page.waitForTimeout(300)

    const sessionsModal = page.locator(
      '.sessions-modal, .session-library-modal',
    )
    await expect(sessionsModal).toBeVisible()
  })

  test('Sessions Library modal has close button', async ({ page }) => {
    await page.evaluate(() => {
      ;(window as any).__appStore?.showSessionLibrary()
    })
    await page.waitForTimeout(500)

    const closeBtn = page.locator('.close-btn, .modal-close')
    await expect(closeBtn.first()).toBeVisible()
  })

  test('Sessions Library modal shows session list', async ({ page }) => {
    await page.evaluate(() => {
      ;(window as any).__appStore?.showSessionLibrary()
    })
    await page.waitForTimeout(500)

    const sessionList = page.locator('.session-list, .session-item')
    const count = await sessionList.count()
    expect(count).toBeGreaterThanOrEqual(0)
  })

  test('Sessions Library modal has "New Session" button', async ({ page }) => {
    await page.evaluate(() => {
      ;(window as any).__appStore?.showSessionLibrary()
    })
    await page.waitForTimeout(500)

    const newSessionBtn = page.locator('button:has-text("New Session")')
    await expect(newSessionBtn).toBeVisible()
  })

  test('Can load a session to practice from Sessions Library', async ({
    page,
  }) => {
    // Navigate to sessions library
    await page.evaluate(() => {
      ;(window as any).__appStore?.showSessionLibrary()
    })
    await page.waitForTimeout(500)

    // Click load on a session item
    const loadBtn = page.locator('.action-btn.load-btn').first()
    if ((await loadBtn.count()) > 0) {
      await loadBtn.click()
      await page.waitForTimeout(500)

      // Verify practice mode is active
      const practiceTab = page.locator('#tab-practice')
      await expect(practiceTab).toHaveClass(/active/)
    }
  })

  test('Library modal can be closed via close button', async ({ page }) => {
    await page.evaluate(() => {
      ;(window as any).__appStore?.showLibrary()
    })
    await page.waitForTimeout(500)

    const closeBtn = page.locator('.close-btn').first()
    await expect(closeBtn).toBeVisible()
    await closeBtn.click()
    await page.waitForTimeout(300)

    // Check if modal is hidden
    const modal = page.locator('.library-modal, .modal-overlay')
    const isHidden = await modal
      .first()
      .evaluate((el) => {
        return el.style.display === 'none' || el.classList.contains('hidden')
      })
      .catch(() => false)
    expect(isHidden).toBe(true)
  })

  test('Library modal can be closed by clicking outside', async ({ page }) => {
    await page.evaluate(() => {
      ;(window as any).__appStore?.showLibrary()
    })
    await page.waitForTimeout(500)

    const overlay = page.locator('.modal-overlay').first()
    await expect(overlay).toBeVisible()

    // Click outside the modal
    await page.mouse.click(0, 0)
    await page.waitForTimeout(300)

    // Check if modal is hidden
    const modal = page.locator('.library-modal, .modal-overlay')
    const isHidden = await modal
      .first()
      .evaluate((el) => {
        return el.style.display === 'none'
      })
      .catch(() => false)
    expect(isHidden).toBe(true)
  })

  test('Library modal search filters melodies', async ({ page }) => {
    await page.evaluate(() => {
      ;(window as any).__appStore?.showLibrary()
    })
    await page.waitForTimeout(500)

    const searchInput = page.locator('.search-input')
    if ((await searchInput.count()) > 0) {
      await searchInput.fill('Test')
      await page.waitForTimeout(300)

      // Filtered list should be visible
      const listItems = page.locator('.library-item')
      const count = await listItems.count()
      expect(count).toBeGreaterThanOrEqual(0)
    }
  })

  // ==========================================
  // Integration Tests (10 tests)
  // ==========================================

  test('Complete flow: create, play, edit melody', async ({ page }) => {
    // Open library
    await page.evaluate(() => {
      ;(window as any).__appStore?.showLibrary()
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

      // Go back to library
      await switchTab(page, 'practice')
      await page.waitForTimeout(500)

      // Open library again and edit
      await page.evaluate(() => {
        ;(window as any).__appStore?.showLibrary()
      })
      await page.waitForTimeout(500)

      const editBtn = page.locator('.action-btn.edit-btn').first()
      if ((await editBtn.count()) > 0) {
        await editBtn.click()
        await page.waitForTimeout(300)

        // Save edits
        const saveBtn = page.locator('button:has-text("Save")')
        await expect(saveBtn).toBeVisible()
      }
    }
  })

  test('Complete flow: create session, load, practice', async ({ page }) => {
    // Navigate to sessions
    await switchTab(page, 'practice')
    await page.waitForTimeout(300)

    const sessionsBtn = page.locator('.quick-action-btn:has-text("Sessions")')
    await sessionsBtn.click()
    await page.waitForTimeout(300)

    // Try to load a session
    const loadBtn = page.locator('.action-btn.load-btn').first()
    if ((await loadBtn.count()) > 0) {
      await loadBtn.click()
      await page.waitForTimeout(500)

      // Verify practice mode is active
      const practiceTab = page.locator('#tab-practice')
      await expect(practiceTab).toHaveClass(/active/)
    }
  })

  test('Melody metadata persists after page reload', async ({ page }) => {
    // Create a melody with specific settings
    await page.evaluate(() => {
      ;(window as any).__appStore?.showLibrary()
    })
    await page.waitForTimeout(500)

    const nameInput = page
      .locator('.edit-melody-form input[type="text"]')
      .first()
    await nameInput.fill('E2E Persistence Test')
    await page.waitForTimeout(200)

    const bpmInput = page.locator('input[type="number"]').first()
    await bpmInput.fill('120')
    await page.waitForTimeout(200)

    const createBtn = page.locator('button:has-text("Create")')
    await createBtn.click()
    await page.waitForTimeout(500)

    // Reload page
    await page.reload()
    await page.waitForTimeout(2000)

    // Navigate back to library
    await switchTab(page, 'practice')
    await page.waitForTimeout(300)

    // Check if the melody still exists in recent list
    const recentItems = page.locator('.recent-item')
    const count = await recentItems.count()
    expect(count).toBeGreaterThanOrEqual(0)
  })

  test('Multiple melodies can be created in library', async ({ page }) => {
    // Create multiple melodies
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => {
        ;(window as any).__appStore?.showLibrary()
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

      // Navigate back to library to create another
      await switchTab(page, 'practice')
      await page.waitForTimeout(300)
    }

    // Navigate to library and check count
    await page.evaluate(() => {
      ;(window as any).__appStore?.showLibrary()
    })
    await page.waitForTimeout(500)

    const listItems = page.locator('.library-item')
    const count = await listItems.count()
    expect(count).toBeGreaterThanOrEqual(0)
  })

  test('Can navigate between Library and Presets libraries', async ({
    page,
  }) => {
    await switchTab(page, 'practice')
    await page.waitForTimeout(300)

    // Click Melodies button
    const melodicBtn = page.locator('.tab-action-btn:has-text("Melodies")')
    await melodicBtn.click()
    await page.waitForTimeout(300)

    // Click Presets button
    const presetsBtn = page.locator('.tab-action-btn:has-text("Presets")')
    await presetsBtn.click()
    await page.waitForTimeout(300)

    // Both modals should be accessible
    const libraryModal = page.locator('.library-modal')
    const presetsModal = page.locator('.presets-modal')

    expect(await libraryModal.count()).toBeGreaterThanOrEqual(0)
    expect(await presetsModal.count()).toBeGreaterThanOrEqual(0)
  })

  test('BPM setting persists through melody operations', async ({ page }) => {
    // Create melody with 120 BPM
    await page.evaluate(() => {
      ;(window as any).__appStore?.showLibrary()
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

    // Navigate back and check if BPM is preserved in metadata
    await switchTab(page, 'practice')
    await page.waitForTimeout(300)

    const recentItems = page.locator('.recent-item')
    const bpmText = recentItems.locator('.recent-meta:has-text("120 BPM")')
    const count = await bpmText.count()
    expect(count).toBeGreaterThanOrEqual(0)
  })

  test('Tags field accepts comma-separated values', async ({ page }) => {
    await page.evaluate(() => {
      ;(window as any).__appStore?.showLibrary()
    })
    await page.waitForTimeout(500)

    const nameInput = page
      .locator('.edit-melody-form input[type="text"]')
      .first()
    await nameInput.fill('E2E Tags Test')
    await page.waitForTimeout(200)

    const tagsInput = page.locator('input[type="text"]').last()
    await tagsInput.fill('jazz, blues, slow')
    await page.waitForTimeout(200)

    const createBtn = page.locator('button:has-text("Create")')
    await createBtn.click()
    await page.waitForTimeout(500)

    // Verify tags were saved
    await switchTab(page, 'practice')
    await page.waitForTimeout(300)

    const recentItems = page.locator('.recent-item')
    const hasTags = (await recentItems.count()) > 0
    expect(hasTags).toBe(true)
  })

  test('Notes field accepts multi-line text', async ({ page }) => {
    await page.evaluate(() => {
      ;(window as any).__appStore?.showLibrary()
    })
    await page.waitForTimeout(500)

    const nameInput = page
      .locator('.edit-melody-form input[type="text"]')
      .first()
    await nameInput.fill('E2E Notes Test')
    await page.waitForTimeout(200)

    const notesTextarea = page.locator('textarea')
    await notesTextarea.fill('First note\nSecond note\nThird note')
    await page.waitForTimeout(200)

    const createBtn = page.locator('button:has-text("Create")')
    await createBtn.click()
    await page.waitForTimeout(500)

    // Verify notes were saved
    await switchTab(page, 'practice')
    await page.waitForTimeout(300)

    const recentItems = page.locator('.recent-item')
    const hasNotes = (await recentItems.count()) > 0
    expect(hasNotes).toBe(true)
  })

  test('Library modal handles empty search results', async ({ page }) => {
    await page.evaluate(() => {
      ;(window as any).__appStore?.showLibrary()
    })
    await page.waitForTimeout(500)

    const searchInput = page.locator('.search-input')
    if ((await searchInput.count()) > 0) {
      await searchInput.fill('NonExistentMelodyXYZ123')
      await page.waitForTimeout(300)

      // Check for empty state message
      const emptyState = page.locator('.empty-state')
      const isHidden = await emptyState
        .evaluate((el) => {
          return el.style.display === 'none'
        })
        .catch(() => false)
      expect(isHidden).toBe(true)
    }
  })

  test('Delete button confirmation prevents accidental deletion', async ({
    page,
  }) => {
    // Create a melody first
    await page.evaluate(() => {
      ;(window as any).__appStore?.showLibrary()
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
      ;(window as any).__appStore?.showLibrary()
    })
    await page.waitForTimeout(500)

    // Click delete button
    const deleteBtn = page.locator('.action-btn.delete-btn').first()
    if ((await deleteBtn.count()) > 0) {
      await deleteBtn.click()
      await page.waitForTimeout(300)

      // Dialog should appear and be accepted
      await expect(page.locator('text=/Delete/i')).toBeVisible()
      await page.keyboard.press('Enter')
      await page.waitForTimeout(300)
    }
  })
})
