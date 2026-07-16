import { test, expect } from '@playwright/test';

test.describe('Mermify Getting Started Tour', () => {
  test.beforeEach(async ({ page }) => {
    // Disable transitions and animations to prevent layout shifting during tests
    await page.addInitScript(() => {
      window.addEventListener('DOMContentLoaded', () => {
        const style = document.createElement('style');
        style.innerHTML = `
          *, *::before, *::after {
            transition: none !important;
            transition-duration: 0s !important;
            animation: none !important;
            animation-duration: 0s !important;
          }
        `;
        document.head.appendChild(style);
      });
    });
  });

  test('should show the tour automatically on first load, step through it, and save state', async ({ page }) => {
    // Pre-seed localStorage to ensure first load triggers the tour
    await page.addInitScript(() => {
      localStorage.removeItem('mermify-tour-completed');
      localStorage.removeItem('mermify-tour-version');
    });
    
    await page.goto('/');
    await expect(page.locator('.monaco-editor .view-lines')).toBeVisible({ timeout: 15000 });

    // Step 1: Welcome step should be visible
    await expect(page.locator('h2:has-text("Welcome to Mermify!")')).toBeVisible();
    await expect(page.locator('text=Step 1 of 7')).toBeVisible();

    // Click Next
    await page.waitForTimeout(200);
    await page.getByRole('button', { name: 'Next' }).click();

    // Step 2: Hybrid Code Editor
    await expect(page.locator('h2:has-text("Hybrid Code Editor")')).toBeVisible();
    await expect(page.locator('text=Step 2 of 7')).toBeVisible();

    // Click Next
    await page.waitForTimeout(200);
    await page.getByRole('button', { name: 'Next' }).click();

    // Step 3: Interactive Preview Canvas
    await expect(page.locator('h2:has-text("Interactive Preview Canvas")')).toBeVisible();
    await expect(page.locator('text=Step 3 of 7')).toBeVisible();

    // Click Next
    await page.waitForTimeout(200);
    await page.getByRole('button', { name: 'Next' }).click();

    // Step 4: Drag to Connect Nodes (with animation)
    await expect(page.locator('h2:has-text("Drag to Connect Nodes")')).toBeVisible();
    await expect(page.locator('text=Step 4 of 7')).toBeVisible();

    // Click Next
    await page.waitForTimeout(200);
    await page.getByRole('button', { name: 'Next' }).click();

    // Step 5: Drag to Spawn New Nodes (with animation)
    await expect(page.locator('h2:has-text("Drag to Spawn New Nodes")')).toBeVisible();
    await expect(page.locator('text=Step 5 of 7')).toBeVisible();

    // Click Next
    await page.waitForTimeout(200);
    await page.getByRole('button', { name: 'Next' }).click();

    // Step 6: Double-Click or Click to Edit (with animation)
    await expect(page.locator('h2:has-text("Double-Click or Click to Edit")')).toBeVisible();
    await expect(page.locator('text=Step 6 of 7')).toBeVisible();

    // Click Next
    await page.waitForTimeout(200);
    await page.getByRole('button', { name: 'Next' }).click();

    // Step 7: Export & Share
    await expect(page.locator('h2:has-text("Export & Share")')).toBeVisible();
    await expect(page.locator('text=Step 7 of 7')).toBeVisible();

    // Click Finish
    await page.waitForTimeout(200);
    await page.getByRole('button', { name: 'Finish' }).click();

    // The tour popover should close
    await expect(page.locator('h2:has-text("Export & Share")')).not.toBeVisible();

    // Verify localStorage updated
    const isCompleted = await page.evaluate(() => localStorage.getItem('mermify-tour-completed'));
    const tourVersion = await page.evaluate(() => localStorage.getItem('mermify-tour-version'));
    expect(isCompleted).toBe('true');
    expect(tourVersion).toBe('0.3.0');
  });

  test('should allow skipping the tour', async ({ page }) => {
    // Pre-seed localStorage
    await page.addInitScript(() => {
      localStorage.removeItem('mermify-tour-completed');
      localStorage.removeItem('mermify-tour-version');
    });
    await page.goto('/');
    await expect(page.locator('.monaco-editor .view-lines')).toBeVisible({ timeout: 15000 });

    // Step 1: Welcome step visible
    await expect(page.locator('h2:has-text("Welcome to Mermify!")')).toBeVisible();

    // Click Skip button
    await page.waitForTimeout(200);
    await page.getByRole('button', { name: 'Skip', exact: true }).click();

    // Tour should be gone
    await expect(page.locator('h2:has-text("Welcome to Mermify!")')).not.toBeVisible();

    // Verify localStorage updated
    const isCompleted = await page.evaluate(() => localStorage.getItem('mermify-tour-completed'));
    const tourVersion = await page.evaluate(() => localStorage.getItem('mermify-tour-version'));
    expect(isCompleted).toBe('true');
    expect(tourVersion).toBe('0.3.0');
  });

  test('should show the update tour automatically for returning users with older tour version', async ({ page }) => {
    // Pre-seed localStorage with older version completed
    await page.addInitScript(() => {
      localStorage.setItem('mermify-tour-completed', 'true');
      localStorage.setItem('mermify-tour-version', '0.2.0');
    });
    await page.goto('/');
    await expect(page.locator('.monaco-editor .view-lines')).toBeVisible({ timeout: 15000 });

    // Should auto-open update tour (v0.3.0)
    await expect(page.locator('h2:has-text("New: Sequence Diagram Support!")')).toBeVisible();
    await expect(page.locator('text=Step 1 of 2')).toBeVisible();

    // Verify sequence diagram is loaded
    await expect.poll(async () => {
      return await page.evaluate(() => {
        return (window as any).monaco?.editor?.getModels()?.[0]?.getValue() || '';
      });
    }).toContain('sequenceDiagram');

    // Click Next
    await page.waitForTimeout(200);
    await page.getByRole('button', { name: 'Next' }).click();

    await expect(page.locator('h2:has-text("Interactive Sequence Canvas")')).toBeVisible();
    await expect(page.locator('text=Step 2 of 2')).toBeVisible();

    // Click Finish
    await page.waitForTimeout(200);
    await page.getByRole('button', { name: 'Finish' }).click();

    // Popover should close
    await expect(page.locator('h2:has-text("Interactive Sequence Canvas")')).not.toBeVisible();

    // Tour version should be updated to current
    const tourVersion = await page.evaluate(() => localStorage.getItem('mermify-tour-version'));
    expect(tourVersion).toBe('0.3.0');
  });

  test('should relaunch the full tour when clicking the help icon in the split button', async ({ page }) => {
    // Set tour as already completed
    await page.addInitScript(() => {
      localStorage.setItem('mermify-tour-completed', 'true');
      localStorage.setItem('mermify-tour-version', '0.3.0');
    });
    await page.goto('/');
    await expect(page.locator('.monaco-editor .view-lines')).toBeVisible({ timeout: 15000 });

    // Tour should NOT be open initially
    await expect(page.locator('h2:has-text("Welcome to Mermify!")')).not.toBeVisible();

    // Click the relaunch help button (left part of the split button)
    await page.waitForTimeout(200);
    const relaunchBtn = page.getByTestId('tour-relaunch-btn');
    await relaunchBtn.click();

    // Tour should now be open with full steps
    await expect(page.locator('h2:has-text("Welcome to Mermify!")')).toBeVisible();
    await expect(page.locator('text=Step 1 of 7')).toBeVisible();
  });

  test('should allow launching specific tours from the dropdown menu', async ({ page }) => {
    // Set tour as already completed
    await page.addInitScript(() => {
      localStorage.setItem('mermify-tour-completed', 'true');
      localStorage.setItem('mermify-tour-version', '0.3.0');
    });
    await page.goto('/');
    await expect(page.locator('.monaco-editor .view-lines')).toBeVisible({ timeout: 15000 });

    // Click the dropdown trigger
    await page.waitForTimeout(200);
    const dropdownBtn = page.getByTestId('tour-dropdown-btn');
    await dropdownBtn.click();

    // Dropdown options should be visible
    const updateTourOption = page.locator('button:has-text("v0.3.0: Sequence Diagrams")');
    await expect(updateTourOption).toBeVisible();

    // Click the update tour option
    await updateTourOption.click();

    // Update tour should open
    await expect(page.locator('h2:has-text("New: Sequence Diagram Support!")')).toBeVisible();
    await expect(page.locator('text=Step 1 of 2')).toBeVisible();

    // Verify sequence diagram is loaded
    await expect.poll(async () => {
      return await page.evaluate(() => {
        return (window as any).monaco?.editor?.getModels()?.[0]?.getValue() || '';
      });
    }).toContain('sequenceDiagram');
  });
});

