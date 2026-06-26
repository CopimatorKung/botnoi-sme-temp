import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();

const errors = [];
page.on('pageerror', err => errors.push(err.message));
page.on('console', msg => {
  if (msg.type() === 'error') console.log('[console.error]', msg.text());
});

await page.goto('http://localhost:8082/', { waitUntil: 'networkidle', timeout: 15000 });
await page.waitForTimeout(1500);

// Open profile dialog
await page.locator('aside button').last().click();
await page.waitForTimeout(1500);

const dialog = page.locator('[role="dialog"]');
console.log('Dialog visible:', await dialog.isVisible());

// Scroll down inside the dialog to see portfolio section
const scrollable = dialog.locator('.overflow-y-auto').first();
await scrollable.evaluate(el => el.scrollTop = 800);
await page.waitForTimeout(500);
await page.screenshot({ path: 'verify-portfolio-section.png' });
console.log('Screenshot: portfolio section');

// Try clicking เพิ่มผลงาน button
const addBtn = dialog.locator('button').filter({ hasText: 'เพิ่มผลงาน' });
const addBtnCount = await addBtn.count();
console.log('เพิ่มผลงาน button count:', addBtnCount);

if (addBtnCount > 0) {
  await addBtn.first().click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'verify-add-portfolio.png' });
  const overlayVisible = await dialog.locator('.bg-black\\/40').isVisible().catch(() => false);
  console.log('Portfolio overlay visible:', overlayVisible);
  const overlayText = await dialog.locator('.bg-white.rounded-2xl').last().innerText().catch(() => '(err)');
  console.log('Overlay text:', overlayText.slice(0, 200));
}

// Try clicking a portfolio card
await dialog.locator('button').filter({ hasText: 'ระบบจัดการ' }).first().click().catch(async () => {
  // maybe it's a div, not a button
  await dialog.locator('div').filter({ hasText: 'ระบบจัดการคลังสินค้า' }).first().click().catch(() => {});
});
await page.waitForTimeout(800);
await page.screenshot({ path: 'verify-portfolio-detail.png' });
console.log('Screenshot: after clicking portfolio card');

// Close overlay if visible
const closeBtn = dialog.locator('button').filter({ has: page.locator('svg') }).last();

console.log('\n--- Page errors ---');
if (errors.length === 0) console.log('NONE - no page errors');
else errors.forEach(e => console.log('ERROR:', e));

await browser.close();
