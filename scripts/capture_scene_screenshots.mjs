import { chromium } from 'playwright'

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const baseUrl = process.argv[2] ?? 'http://127.0.0.1:5173'
const outPrefix = process.argv[3] ?? 'screenshots/scene'

const browser = await chromium.launch({
  executablePath: chromePath,
  headless: true,
})

const page = await browser.newPage({ viewport: { width: 1024, height: 640 } })
await page.goto(baseUrl, { waitUntil: 'networkidle' })
await page.waitForTimeout(4500)
await page.screenshot({ path: `${outPrefix}-closed.png`, fullPage: true })

await page.mouse.click(512, 310)
await page.waitForTimeout(2500)
await page.screenshot({ path: `${outPrefix}-open.png`, fullPage: true })

await browser.close()
