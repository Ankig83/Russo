/**
 * Экспорт runtime-шкафа (закрытые дверцы + ножки + медальоны) в GLB.
 *
 * Usage:
 *   node scripts/export_runtime_shkaf_glb.mjs [outPath] [--url http://localhost:5174/]
 */
import { chromium } from 'playwright'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const args = process.argv.slice(2)
const urlFlag = args.indexOf('--url')
const baseUrl = urlFlag >= 0 ? args[urlFlag + 1] : null
const outArg = args.find((a, i) => !a.startsWith('--') && (urlFlag < 0 || i !== urlFlag + 1))
const outPath = path.resolve(
  outArg || path.join(__dirname, '../public/models/shkaf-closed-legs-medallion.glb'),
)

async function findDevUrl() {
  if (baseUrl) return baseUrl
  for (const port of [5174, 5175, 5173, 5176]) {
    const u = `http://localhost:${port}/`
    try {
      const res = await fetch(u, { signal: AbortSignal.timeout(2000) })
      if (res.ok) return u
    } catch {
      /* try next */
    }
  }
  throw new Error('Vite не найден на 5173–5176. Запусти npm run dev.')
}

const url = await findDevUrl()
console.log('URL:', url)
console.log('Out:', outPath)

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
page.setDefaultTimeout(300000)

const logs = []
page.on('console', (msg) => {
  const t = msg.text()
  if (/РУССО:(export|mat)|sheet-metal|exporter ready|GLB ready/i.test(t)) {
    logs.push(t)
    console.log(' ', t.slice(0, 220))
  }
})

await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 })
await page.waitForFunction(() => {
  const text = document.body?.innerText || ''
  return (text.includes('открой шкаф') || text.includes('нажми на шкаф')) && !/ЗАГРУЗКА/i.test(text)
}, null, { timeout: 240000 })

try {
  await page.waitForFunction(
    () => document.querySelectorAll('.fixed.inset-0.z-50').length === 0,
    null,
    { timeout: 12000 },
  )
} catch {
  await page.evaluate(() => {
    document.querySelectorAll('.fixed.inset-0.z-50').forEach((el) => el.remove())
  })
}

await page.waitForFunction(
  () => typeof window.__RUSSO_EXPORT_SHKAF_GLB === 'function',
  null,
  { timeout: 180000 },
)

// закрытые дверцы
await page.evaluate(() => {
  if (window.__RUSSO?.doorsOpen) {
    console.warn('РУССО:export doors were open — export всё равно (visible only)')
  }
})

console.log('Exporting…')
const result = await page.evaluate(async () => {
  const r = await window.__RUSSO_EXPORT_SHKAF_GLB()
  return { bytes: r.bytes, base64: r.base64 }
})

const buf = Buffer.from(result.base64, 'base64')
fs.mkdirSync(path.dirname(outPath), { recursive: true })
fs.writeFileSync(outPath, buf)
await browser.close()

console.log(`Wrote ${outPath}`)
console.log(`Size: ${(buf.length / 1024 / 1024).toFixed(2)} MB (${buf.length} bytes)`)
console.log('Logs:', logs.filter((l) => /export|pairs=/i.test(l)).slice(-5))
