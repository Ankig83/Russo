import { chromium } from 'playwright'

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const baseUrl = process.argv[2] ?? 'http://127.0.0.1:5173'
const outPrefix = process.argv[3] ?? 'screenshots/medallion-closeup'

const browser = await chromium.launch({
  executablePath: chromePath,
  headless: true,
})

const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
await page.goto(baseUrl, { waitUntil: 'networkidle' })
await page.waitForTimeout(5000)

const clip = { x: 360, y: 120, width: 560, height: 560 }
await page.screenshot({ path: `${outPrefix}-closed.png`, clip })

await page.mouse.click(640, 360)
await page.waitForTimeout(2500)
await page.screenshot({ path: `${outPrefix}-open.png`, clip })

await browser.close()
