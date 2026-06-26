import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();

page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

await page.goto('http://localhost:8082/', { waitUntil: 'networkidle', timeout: 15000 });
await page.waitForTimeout(1500);

// Open profile dialog
await page.locator('aside button').last().click();
await page.waitForTimeout(2000);
await page.screenshot({ path: 'verify3-dialog-full.png' });
console.log('Shot 1: full dialog after open');

// Check if dialog is taller than viewport
const dialog = page.locator('[role="dialog"]');
const box = await dialog.boundingBox();
console.log('Dialog bounding box:', box);

// Click เพิ่มผลงาน WITHOUT pre-scrolling
const addBtn = dialog.locator('button', { hasText: 'เพิ่มผลงาน' });
await addBtn.scrollIntoViewIfNeeded();
await addBtn.click();
await page.waitForTimeout(800);
await page.screenshot({ path: 'verify3-add-overlay.png' });
console.log('Shot 2: add portfolio overlay (no pre-scroll)');

// Check the overlay and card bounding boxes
const overlay = page.locator('.absolute.inset-0').first();
const overlayBox = await overlay.boundingBox().catch(() => null);
console.log('Overlay box:', overlayBox);

const card = dialog.locator('.bg-white.rounded-2xl.shadow-2xl');
const cardBox = await card.boundingBox().catch(() => null);
console.log('Card box:', cardBox);

const header = card.locator('h3');
const headerText = await header.innerText().catch(() => 'not found');
const headerBox = await header.boundingBox().catch(() => null);
console.log('Header text:', headerText, 'Header box:', headerBox);

await browser.close();
