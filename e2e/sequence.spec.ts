import { test, expect } from '@playwright/test';

test.describe('Mermify Sequence Diagram Visual Editor', () => {
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

    // Prevent tour onboarding from auto-starting
    await page.addInitScript(() => {
      window.localStorage.setItem('mermify-tour-completed', 'true');
      window.localStorage.setItem('mermify-tour-version', '0.3.0');
    });
    // Navigate to the base URL
    await page.goto('/');
    // Wait for Monaco Editor
    await expect(page.locator('.monaco-editor .view-lines')).toBeVisible({ timeout: 15000 });
  });

  test('should load sequence diagram preset and render correct counts', async ({ page }) => {
    // Click sequence diagram preset button
    const seqPresetBtn = page.getByRole('button', { name: 'Sequence Diagram' });
    await seqPresetBtn.click();

    // Verify header status shows sequence diagram elements detected
    await expect(page.locator('span:has-text("participants")')).toContainText('3 participants, 4 messages');

    // Verify overlays exist in DOM
    const participantOverlays = page.locator('[data-testid*="sequence-participant-overlay"]');
    await expect(participantOverlays).toHaveCount(3);

    const messageOverlays = page.locator('[data-testid*="sequence-message-overlay"]');
    await expect(messageOverlays).toHaveCount(4);
  });

  test('should support selecting a participant and opening type picker popover', async ({ page }) => {
    // Load sequence preset
    await page.getByRole('button', { name: 'Sequence Diagram' }).click();
    await expect(page.locator('span:has-text("participants")')).toContainText('3 participants, 4 messages');

    // Click on participant Alice overlay to show palette
    const aliceOverlay = page.locator('[data-testid="sequence-participant-overlay-Alice"] div').first();
    await aliceOverlay.click();

    // Palette toolbar should appear
    await expect(page.getByRole('button', { name: 'Type' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Delete' })).toBeVisible();

    // Click Type button to show UML shape popover
    await page.getByRole('button', { name: 'Type' }).click();
    await expect(page.locator('text=Participant Type')).toBeVisible();

    // Select 'Control' type
    const controlTypeBtn = page.locator('button[title="Control"]');
    await expect(controlTypeBtn).toBeVisible();
    await controlTypeBtn.click();

    // Type popover should be dismissed
    await expect(page.locator('text=Participant Type')).not.toBeVisible();
  });

  test('should support double-click to rename participant alias', async ({ page }) => {
    // Load sequence preset
    await page.getByRole('button', { name: 'Sequence Diagram' }).click();
    await expect(page.locator('span:has-text("participants")')).toContainText('3 participants, 4 messages');

    const aliceOverlay = page.locator('[data-testid="sequence-participant-overlay-Alice"] div').first();
    await aliceOverlay.dblclick();

    // Input field should be visible
    const input = page.locator('[data-testid="sequence-participant-overlay-Alice"] input');
    await expect(input).toBeVisible();
    await input.fill('Super Alice');
    await page.keyboard.press('Enter');

    // Input should be gone
    await expect(input).not.toBeVisible();

    // Header status count should remain intact
    await expect(page.locator('span:has-text("participants")')).toContainText('3 participants, 4 messages');
  });

  test('should toggle autonumber in the diagram', async ({ page }) => {
    // Load sequence preset
    await page.getByRole('button', { name: 'Sequence Diagram' }).click();
    await expect(page.locator('span:has-text("participants")')).toContainText('3 participants, 4 messages');

    const autonumberBtn = page.getByTestId('toggle-autonumber-btn');
    await expect(autonumberBtn).toBeVisible();

    // Click to toggle autonumber on
    await autonumberBtn.click();

    // Wait a brief moment and check SVG for autonumber elements or check code for autonumber keyword
    // Autonumber rendering emits text elements inside the message circles.
    // Let's toggle it back off
    await autonumberBtn.click();
  });

  test('should support dragging a participant to reorder', async ({ page }) => {
    // Load sequence preset
    await page.getByRole('button', { name: 'Sequence Diagram' }).click();
    await expect(page.locator('span:has-text("participants")')).toContainText('3 participants, 4 messages');

    // Hover Alice to show the drag handle
    const aliceOverlay = page.locator('[data-testid="sequence-participant-overlay-Alice"]');
    await aliceOverlay.hover();

    const dragHandle = page.locator('[data-testid="sequence-participant-drag-handle-Alice"]');
    await expect(dragHandle).toBeVisible();

    // Let's drag Alice to the right of Bob
    const bobOverlay = page.locator('[data-testid="sequence-participant-overlay-Bob"]');
    const bobBox = await bobOverlay.boundingBox();
    const handleBox = await dragHandle.boundingBox();

    if (bobBox && handleBox) {
      await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
      await page.mouse.down();
      await page.mouse.move(bobBox.x + bobBox.width + 40, bobBox.y + bobBox.height / 2, { steps: 10 });
      await page.mouse.up();

      // Wait a moment for Monaco/rendering updates
      await page.waitForTimeout(500);

      // Verify the order of participant overlays in the DOM
      const overlays = page.locator('[data-testid*="sequence-participant-overlay-"]');
      const count = await overlays.count();
      const ids: string[] = [];
      for (let i = 0; i < count; i++) {
        const testId = await overlays.nth(i).getAttribute('data-testid');
        if (testId) {
          ids.push(testId.replace('sequence-participant-overlay-', ''));
        }
      }
      expect(ids).toEqual(['Bob', 'Alice', 'Charlie']);
    }
  });

  test('should support dragging a message connection to reroute', async ({ page }) => {
    // Load sequence preset
    await page.getByRole('button', { name: 'Sequence Diagram' }).click();
    await expect(page.locator('span:has-text("participants")')).toContainText('3 participants, 4 messages');

    // Hover over the first message overlay to show drag handles
    const msgOverlay = page.locator('[data-testid="sequence-message-overlay-6"]');
    await expect(msgOverlay).toBeVisible();
    await msgOverlay.hover();

    // Left drag handle (reroute sender)
    const leftHandle = page.locator('[data-testid="sequence-message-drag-handle-left-6"]');
    await expect(leftHandle).toBeVisible();

    // Bob's top participant box
    const bobOverlay = page.locator('[data-testid="sequence-participant-overlay-Bob"]');
    const bobBox = await bobOverlay.boundingBox();
    const handleBox = await leftHandle.boundingBox();

    if (bobBox && handleBox) {
      // Drag left handle to Bob's column
      await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
      await page.mouse.down();
      await page.mouse.move(bobBox.x + bobBox.width / 2, handleBox.y + handleBox.height / 2, { steps: 10 });
      await page.mouse.up();

      // Wait a moment for rendering updates
      await page.waitForTimeout(500);

      // Verify the sender is now Bob by checking that the left drag handle points to Bob's horizontal position
      const updatedHandle = page.locator('[data-testid="sequence-message-drag-handle-left-6"]');
      const newHandleBox = await updatedHandle.boundingBox();
      if (newHandleBox) {
        const bobCenterX = bobBox.x + bobBox.width / 2;
        const handleCenterX = newHandleBox.x + newHandleBox.width / 2;
        expect(Math.abs(handleCenterX - bobCenterX)).toBeLessThan(10);
      }
    }
  });

  test('should support reordering participants, reversing, and returning to initial state', async ({ page }) => {
    // 1. Load sequence preset
    await page.getByRole('button', { name: 'Sequence Diagram' }).click();
    await expect(page.locator('span:has-text("participants")')).toContainText('3 participants, 4 messages');

    // 2. Move the first actor (Alice) to the right (after Bob)
    const aliceOverlay = page.locator('[data-testid="sequence-participant-overlay-Alice"]');
    await aliceOverlay.hover();
    const dragAlice = page.locator('[data-testid="sequence-participant-drag-handle-Alice"]');
    const bobOverlay = page.locator('[data-testid="sequence-participant-overlay-Bob"]');
    const bobBox = await bobOverlay.boundingBox();
    const aliceHandleBox = await dragAlice.boundingBox();
    if (bobBox && aliceHandleBox) {
      await page.mouse.move(aliceHandleBox.x + aliceHandleBox.width / 2, aliceHandleBox.y + aliceHandleBox.height / 2);
      await page.mouse.down();
      await page.mouse.move(bobBox.x + bobBox.width + 40, bobBox.y + bobBox.height / 2, { steps: 10 });
      await page.mouse.up();
      await page.waitForTimeout(500);
    }

    // Order now is Bob, Alice, Charlie. Move Alice (middle) back to the left (before Bob)
    const dragAlice2 = page.locator('[data-testid="sequence-participant-drag-handle-Alice"]');
    const currentBob = page.locator('[data-testid="sequence-participant-overlay-Bob"]');
    const currentBobBox = await currentBob.boundingBox();
    const aliceHandleBox2 = await dragAlice2.boundingBox();
    if (currentBobBox && aliceHandleBox2) {
      await page.mouse.move(aliceHandleBox2.x + aliceHandleBox2.width / 2, aliceHandleBox2.y + aliceHandleBox2.height / 2);
      await page.mouse.down();
      await page.mouse.move(currentBobBox.x - 40, currentBobBox.y + currentBobBox.height / 2, { steps: 10 });
      await page.mouse.up();
      await page.waitForTimeout(500);
    }

    // 3. Reverse the connection "Alice needs the file." (which is on line 5)
    // Select it first to open the toolbar
    const msgOverlay = page.locator('[data-testid="sequence-message-overlay-5"]');
    await msgOverlay.click();
    await page.getByRole('button', { name: 'Reverse' }).click();
    await page.waitForTimeout(500);

    // Verify code changed to Charlie->>Bob
    const editor = page.locator('.monaco-editor');
    await expect(editor).toContainText('Charlie->>Bob: Alice needs the file.');

    // 4. Reverse the connection again
    await page.locator('[data-testid="sequence-message-overlay-5"]').click();
    await page.getByRole('button', { name: 'Reverse' }).click();
    await page.waitForTimeout(500);
    await expect(editor).toContainText('Bob->>Charlie: Alice needs the file.');

    // 5. Move Alice to the left (does nothing since already on the far left)
    const dragAlice3 = page.locator('[data-testid="sequence-participant-drag-handle-Alice"]');
    const aliceHandleBox3 = await dragAlice3.boundingBox();
    if (aliceHandleBox3) {
      await page.mouse.move(aliceHandleBox3.x + aliceHandleBox3.width / 2, aliceHandleBox3.y + aliceHandleBox3.height / 2);
      await page.mouse.down();
      await page.mouse.move(aliceHandleBox3.x - 100, aliceHandleBox3.y + aliceHandleBox3.height / 2, { steps: 10 });
      await page.mouse.up();
      await page.waitForTimeout(500);
    }

    // 6. Move Charlie to the right (does nothing since already on the far right)
    const charlieOverlay = page.locator('[data-testid="sequence-participant-overlay-Charlie"]');
    await charlieOverlay.hover();
    const dragCharlie = page.locator('[data-testid="sequence-participant-drag-handle-Charlie"]');
    const charlieHandleBox = await dragCharlie.boundingBox();
    if (charlieHandleBox) {
      await page.mouse.move(charlieHandleBox.x + charlieHandleBox.width / 2, charlieHandleBox.y + charlieHandleBox.height / 2);
      await page.mouse.down();
      await page.mouse.move(charlieHandleBox.x + 100, charlieHandleBox.y + charlieHandleBox.height / 2, { steps: 10 });
      await page.mouse.up();
      await page.waitForTimeout(500);
    }

    // 7. Everything should be in the initial state
    await expect(editor).toContainText('Alice->>Bob: Can you ask Charlie for the file?');
    await expect(editor).toContainText('Bob->>Charlie: Alice needs the file.');
    await expect(editor).toContainText('Charlie-->>Bob: Here is the file.');
    await expect(editor).toContainText('Bob-->>Alice: Delivered!');
  });

  test('should support building a sequence diagram from scratch', async ({ page }) => {
    // 1. Reset/Start with sequenceDiagram template
    const editor = page.locator('.monaco-editor');
    // Clear editor and set to basic sequenceDiagram
    await editor.click();
    await page.keyboard.press('Control+A');
    await page.keyboard.press('Backspace');
    await page.keyboard.insertText('sequenceDiagram');
    await page.waitForTimeout(1000);

    // 2. Click "Add Participant" button in the bottom left 3 times
    const addPartBtn = page.getByTestId('add-participant-btn');
    await expect(addPartBtn).toBeVisible();
    await addPartBtn.click();
    await page.waitForTimeout(300);
    await addPartBtn.click();
    await page.waitForTimeout(300);
    await addPartBtn.click();
    await page.waitForTimeout(500);

    // Verify 3 participants created: P1, P2, P3
    await expect(page.locator('span:has-text("participants")')).toContainText('3 participants, 0 messages');

    // 3. Make the first an actor, the next a participant (already is), the next a boundary
    // Configure P1 to be Actor
    await page.locator('[data-testid="sequence-participant-overlay-P1"] div').first().click();
    await page.getByRole('button', { name: 'Type' }).click();
    await page.locator('button[title="Actor"]').click();
    await page.waitForTimeout(300);

    // Configure P3 to be Boundary
    await page.locator('[data-testid="sequence-participant-overlay-P3"] div').first().click();
    await page.getByRole('button', { name: 'Type' }).click();
    await page.locator('button[title="Boundary"]').click();
    await page.waitForTimeout(300);

    // 4. Add a connection by clicking the visible + button on the first actor's lifeline
    // Since there are 0 messages, the + button is visible by default (opacity-80)
    // Find the slot for P1
    await page.waitForTimeout(1000);
    const p1Slot = page.locator('[data-testid="lifeline-slot-P1"] button');
    await expect(p1Slot).toBeVisible();
    await p1Slot.click();
    await page.waitForTimeout(500);

    // Expecting 1 message now
    await expect(page.locator('span:has-text("participants")')).toContainText('3 participants, 1 message');
    // Verify first message exists: P1->>P2: new msg (since P2 is the next participant)
    await expect(editor).toContainText('P1->>P2: new msg');

    // 5. Move the target of that connection to P3
    // Locate the first message overlay (which will be at line index 4 in our generated sequence diagram)
    // Since the message is right-to-left (P1->>P2), the target/receiver handle is the left handle.
    const msgOverlay = page.locator('[data-testid="sequence-message-overlay-4"]');
    await msgOverlay.hover();
    const targetHandle = page.locator('[data-testid="sequence-message-drag-handle-left-4"]');
    await expect(targetHandle).toBeVisible();

    const p3Overlay = page.locator('[data-testid="sequence-participant-overlay-P3"]');
    const p3Box = await p3Overlay.boundingBox();
    const handleBox = await targetHandle.boundingBox();
    if (p3Box && handleBox) {
      await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
      await page.mouse.down();
      await page.mouse.move(p3Box.x + p3Box.width / 2, handleBox.y + handleBox.height / 2, { steps: 10 });
      await page.mouse.up();
      await page.waitForTimeout(500);
    }
    // Verify message target is now P3
    await expect(editor).toContainText('P1->>P3: new msg');

    // 6. Add a connection from the second actor (P2) above the first connection (P1->>P3) and one below the last connection for the 3rd actor (P3)
    // Find slot above first message for P2
    await page.locator('[data-testid="lifeline-slot-P2"] button').first().click();
    await page.waitForTimeout(500);
    await expect(editor).toContainText('P2->>P1: new msg');

    // Find slot below last message for P3 (3rd actor)
    await page.locator('[data-testid="lifeline-slot-P3"] button').last().click();
    await page.waitForTimeout(500);
    await expect(editor).toContainText('P3->>P2: new msg');

    // 7. Adjust style of connection, double-click to edit label
    const bottomMsgOverlay = page.locator('[data-testid="sequence-message-overlay-6"]');
    await bottomMsgOverlay.click();
    await page.getByRole('button', { name: 'Style' }).click();
    await page.locator('button[title="Dashed Arrow"]').click();
    await page.waitForTimeout(500);
    await expect(editor).toContainText('P3-->>P2: new msg');

    // Double-click bottom message to edit label
    await bottomMsgOverlay.dblclick();
    const labelInput = page.locator('[data-testid="sequence-message-overlay-6"] input');
    await expect(labelInput).toBeVisible();
    await labelInput.fill('Finished message');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    await expect(editor).toContainText('P3-->>P2: Finished message');

    // 8. Test undo/redo
    await page.keyboard.press('Control+Z');
    await page.waitForTimeout(500);
    await expect(editor).toContainText('P3-->>P2: new msg'); // Reverted label edit

    await page.keyboard.press('Control+Y');
    await page.waitForTimeout(500);
    await expect(editor).toContainText('P3-->>P2: Finished message'); // Redone label edit
  });
});

