import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();
page.on('pageerror', e => console.log('PAGE ERROR:', e.message));

await page.goto('http://localhost:8082/', { waitUntil: 'networkidle', timeout: 15000 });
await page.waitForTimeout(1500);

// Open profile dialog
await page.locator('aside button').last().click();
await page.waitForTimeout(1500);

const dialog = page.locator('[role="dialog"]');
const box = await dialog.boundingBox();
console.log('Dialog box:', box);

const centered = box && box.y > 0 && box.y < 100;
console.log('Dialog properly centered (y < 100):', centered);

await page.screenshot({ path: 'final-1-dialog.png' });

// Click เพิ่มผลงาน
const addBtn = dialog.locator('button', { hasText: 'เพิ่มผลงาน' });
await addBtn.scrollIntoViewIfNeeded();
await addBtn.click();
await page.waitForTimeout(600);

const newBox = await dialog.boundingBox();
console.log('Dialog box after clicking add portfolio:', newBox);
await page.screenshot({ path: 'final-2-add-portfolio.png' });

// Check header visible
const h3 = dialog.locator('h3');
const h3Text = await h3.innerText().catch(() => 'not found');
const h3Box = await h3.boundingBox().catch(() => null);
console.log('Header "แนบผลงาน":', h3Text, 'visible box:', h3Box);
console.log('Header y > 0 (in viewport):', h3Box && h3Box.y > 0);

// Click portfolio card
await dialog.locator('button').filter({ hasText: 'ย้อนกลับ' }).click().catch(async () => {
  console.log('Back button not found — that is expected when form is visible');
});
await page.waitForTimeout(400);

// Go back and click portfolio card
const portfolioCard = page.locator('div[role="dialog"] div.cursor-pointer').first();
const cardCount = await portfolioCard.count();
console.log('Portfolio cards found:', cardCount);

console.log('\nNo page errors above = PASS');
await browser.close();
