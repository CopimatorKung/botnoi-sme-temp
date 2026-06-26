import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await context.newPage();

const errors = [];
const consoleMessages = [];

page.on('console', msg => {
  if (msg.type() === 'error' || msg.type() === 'warning') {
    consoleMessages.push(`[${msg.type()}] ${msg.text()}`);
  }
});
page.on('pageerror', err => {
  errors.push(err.message);
});

console.log('Navigating...');
await page.goto('http://localhost:8082/', { waitUntil: 'networkidle', timeout: 15000 });
await page.waitForTimeout(2000);
await page.screenshot({ path: 'verify-step1.png' });

const btnCount = await page.locator('aside button').count();
console.log('Buttons in sidebar:', btnCount);

// Print text of each button
for (let i = 0; i < btnCount; i++) {
  const txt = await page.locator('aside button').nth(i).innerText().catch(() => '');
  console.log(`  button[${i}]: "${txt.trim().replace(/\n/g, ' ')}"`);
}

// Click the last button in the aside (user profile footer)
if (btnCount > 0) {
  await page.locator('aside button').last().click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'verify-step2.png' });

  const dialog = page.locator('[role="dialog"]');
  const dialogVisible = await dialog.isVisible().catch(() => false);
  console.log('Dialog visible after click:', dialogVisible);

  if (dialogVisible) {
    const dialogText = await dialog.innerText().catch(() => '(error getting text)');
    console.log('Dialog text (first 600 chars):\n', dialogText.slice(0, 600));
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'verify-step3-dialog.png' });
  } else {
    const bodyText = await page.locator('body').innerText().catch(() => '');
    console.log('No dialog — body text:', bodyText.slice(0, 400));
  }
}

console.log('\n--- Console errors/warnings ---');
consoleMessages.forEach(m => console.log(m));
console.log('--- Page errors ---');
if (errors.length === 0) console.log('none');
else errors.forEach(e => console.log('ERROR:', e));

await browser.close();
