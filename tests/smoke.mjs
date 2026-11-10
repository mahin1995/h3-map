import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
try {
  await page.goto(process.env.APP_URL || 'http://127.0.0.1:5173');
  await page.waitForSelector('#status.present');
  assert.match(await page.locator('#stats').innerText(), /162/);
  assert.match(await page.locator('#code').inputValue(), /ZONE_CELLS = set/);
  await page.locator('#uLat').fill('0');
  await page.locator('#uLng').fill('0');
  await page.locator('#uLng').dispatchEvent('change');
  assert.equal(await page.locator('#status').innerText(), 'Absent');
  await page.locator('#uLat').fill('100');
  await page.locator('#uLat').dispatchEvent('change');
  assert.equal(await page.locator('#status').innerText(), 'Invalid coordinates');
  await page.locator('#clear').click();
  assert.equal(await page.locator('.leaflet-marker-pane .leaflet-marker-icon').count(), 1);
  const map = await page.locator('#map').boundingBox();
  for (const [x,y] of [[300,220],[550,220],[450,480]]) {
    await page.mouse.click(map.x+x, map.y+y);
  }
  assert.equal(await page.locator('.leaflet-marker-pane .leaflet-marker-icon').count(), 4);
  await page.locator('#modeCrew').click();
  await page.mouse.click(map.x+440, map.y+300);
  assert.equal(await page.locator('#status').innerText(), 'Present');
  await page.locator('#edge').uncheck();
  await page.locator('#buf').fill('50');
  await page.locator('#buf').dispatchEvent('input');
  assert.match(await page.locator('#code').inputValue(), /BUFFER_METERS = 50\nINCLUDE_EDGE = False/);
  await page.locator('#undo').click();
  assert.equal(await page.locator('#status').innerText(), 'কমপক্ষে ৩টি কোণা দিন');
  assert.deepEqual(errors, []);
  await page.reload();
  await page.waitForSelector('#status.present');
  await page.waitForTimeout(3000);
  const tiles = await page.locator('.leaflet-tile-loaded').count();
  console.log(`PASS: drawing, undo, clear, crew placement, attendance, invalid coordinates, edge/buffer controls, Python export; loaded tiles: ${tiles}`);
  await page.screenshot({ path: 'docs/screenshot.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  assert.ok(await page.locator('#map').isVisible());
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  console.log('PASS: mobile layout');
} finally { await browser.close(); }
