/**
 * node scripts/shot_hero.mjs [outPath] [--mobile]
 */
import { chromium } from 'playwright'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const args = process.argv.slice(2)
const mobile = args.includes('--mobile')
const out = args.find((arg) => !arg.startsWith('--'))
  || path.join(__dirname, '../screenshots/hero-match-current.png')

fs.mkdirSync(path.dirname(out), { recursive: true })

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({
  viewport: mobile ? { width: 390, height: 844 } : { width: 1600, height: 900 },
  deviceScaleFactor: 1,
  isMobile: mobile,
  hasTouch: mobile,
})

page.setDefaultTimeout(300000)
await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded', timeout: 120000 })

await page.waitForFunction(() => !!window.__RUSSO_EXPORT_SHKAF_GLB, null, { timeout: 240000 })

// Ждём снятия LoadingOverlay (иначе снимаем PreloaderCanvas на чёрном void).
await page.waitForFunction(
  () => document.querySelectorAll('.fixed.inset-0.z-50').length === 0,
  null,
  { timeout: 180000 },
).catch(async () => {
  // Fallback: скрыть без removeChild (removeChild ломает React)
  await page.evaluate(() => {
    document.querySelectorAll('.fixed.inset-0.z-50').forEach((el) => {
      el.style.display = 'none'
      el.style.visibility = 'hidden'
      el.style.pointerEvents = 'none'
    })
  })
})

await page.waitForFunction(() => {
  const text = document.body?.innerText || ''
  return (text.includes('открой шкаф') || text.includes('нажми на шкаф')) && !/ЗАГРУЗКА/i.test(text)
}, null, { timeout: 60000 }).catch(() => {})

await page.waitForTimeout(4000)
// Playwright viewport shot (includes postFX). Prefer over gl.readback.
await page.screenshot({
  path: out,
  type: 'png',
  timeout: 180000,
  animations: 'disabled',
  caret: 'hide',
})
await browser.close()
console.log(`Wrote ${out}`)
