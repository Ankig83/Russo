/*
 * Конвертация фото проектов портфолио: HEIC/JPEG → WebP.
 *
 * sharp в prebuilt-виде НЕ декодирует HEIC (нет HEVC-кодека), поэтому
 * HEIC сначала раскодируется через heic-convert (WASM libheif), а resize
 * и кодирование в WebP делает sharp.
 *
 * Использование:
 *   node scripts/convert_portfolio_images.mjs --src "<папка с фото>" --slug <slug> [--width 2200] [--quality 82]
 *
 * Результат: public/assets/portfolio/<slug>/01.webp, 02.webp, ... + cover.webp (первый кадр).
 */
import { readdir, mkdir, readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import heicConvert from 'heic-convert'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

function parseArgs(argv) {
  const args = {}
  for (let i = 2; i < argv.length; i++) {
    const key = argv[i]
    if (key.startsWith('--')) {
      args[key.slice(2)] = argv[i + 1]
      i++
    }
  }
  return args
}

const HEIC_RE = /\.heic$/i
const IMG_RE = /\.(heic|jpe?g|png|webp)$/i

async function toRgbBuffer(file) {
  if (HEIC_RE.test(file)) {
    const inputBuffer = await readFile(file)
    // heic-convert отдаёт JPEG-буфер, который sharp уже прочитает
    return heicConvert({ buffer: inputBuffer, format: 'JPEG', quality: 0.95 })
  }
  return readFile(file)
}

async function main() {
  const args = parseArgs(process.argv)
  const { src, slug } = args
  const width = Number(args.width ?? 2200)
  const quality = Number(args.quality ?? 82)

  if (!src || !slug) {
    console.error('Использование: --src "<папка>" --slug <slug> [--width 2200] [--quality 82]')
    process.exit(1)
  }
  if (!existsSync(src)) {
    console.error(`Папка не найдена: ${src}`)
    process.exit(1)
  }

  const outDir = path.join(ROOT, 'public', 'assets', 'portfolio', slug)
  await mkdir(outDir, { recursive: true })

  const entries = (await readdir(src, { withFileTypes: true }))
    .filter((e) => e.isFile() && IMG_RE.test(e.name))
    .map((e) => e.name)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))

  if (entries.length === 0) {
    console.error(`В папке нет изображений: ${src}`)
    process.exit(1)
  }

  console.log(`Конвертирую ${entries.length} фото → ${outDir}`)

  const outNames = []
  for (let i = 0; i < entries.length; i++) {
    const name = entries[i]
    const full = path.join(src, name)
    const index = String(i + 1).padStart(2, '0')
    const outName = `${index}.webp`
    const outPath = path.join(outDir, outName)

    const rgb = await toRgbBuffer(full)
    await sharp(rgb)
      .rotate() // учесть EXIF-ориентацию
      .resize({ width, withoutEnlargement: true })
      .webp({ quality })
      .toFile(outPath)

    outNames.push(outName)
    console.log(`  ${name} → ${outName}`)
  }

  // cover.webp — уменьшенная копия первого кадра для карточек hub-страницы
  const firstRgb = await toRgbBuffer(path.join(src, entries[0]))
  await sharp(firstRgb)
    .rotate()
    .resize({ width: 1200, withoutEnlargement: true })
    .webp({ quality: 80 })
    .toFile(path.join(outDir, 'cover.webp'))

  console.log(`  cover.webp (из ${entries[0]})`)
  console.log('\nГотово. Для portfolioProjects.js:')
  console.log(`images: [${outNames.map((n) => `'${n}'`).join(', ')}]`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
