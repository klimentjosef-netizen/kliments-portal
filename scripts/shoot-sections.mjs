import { chromium } from 'playwright'
const file = new URL('../data/techcars/preview.html', import.meta.url)
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1140, height: 1120 }, deviceScaleFactor: 2 })
await page.goto(file.href)
await page.waitForTimeout(400)
const H = await page.evaluate(() => document.body.scrollHeight)
console.log('výška stránky:', H)
let i = 0
for (let y = 0; y < H; y += 1080) {
  await page.evaluate((yy) => window.scrollTo(0, yy), y)
  await page.waitForTimeout(150)
  await page.screenshot({ path: `data/techcars/sec-${i}.png` })
  console.log('sec-' + i + '.png @ y=' + y)
  i++
}
await browser.close()
