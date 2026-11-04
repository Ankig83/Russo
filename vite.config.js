import fs from 'node:fs'
import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * public/ копируется в dist целиком. На сайт реально уходят только эти файлы;
 * остальное — черновики Blender / запасные карты, их выкидываем после копирования.
 */
function isDeployExtra(rel) {
  const name = rel.replaceAll('\\', '/')
  if (name.startsWith('models/')) {
    return name !== 'models/shkaf-cabinet.glb' && name !== 'models/studio-scene.glb'
  }
  if (name.startsWith('HDRI/')) return name !== 'HDRI/studio_small_08_2k.hdr'
  if (name.startsWith('textures/')) {
    return !(
      name.startsWith('textures/aged-copper/')
      || name.startsWith('textures/leather/')
      || name.startsWith('textures/cabinet-props/')
      || name.startsWith('textures/cycles-bake/lm/')
      || name.startsWith('textures/cycles-bake/walnut/')
      || name.startsWith('textures/cycles-bake/interior/')
      || name.startsWith('textures/cycles-bake/doors/')
      || name === 'textures/cycles-bake/studio_cycles_2k_raw.hdr'
    )
  }
  if (name.startsWith('assets/textures/') || name.startsWith('assets/labels/')) return true
  return name === 'bg.jpg' || name === 'icons.svg' || name === 'images/russo-logo.png'
}

function stripUnusedPublic() {
  return {
    name: 'strip-unused-public',
    apply: 'build',
    closeBundle() {
      const dist = path.resolve('dist')
      if (!fs.existsSync(dist)) return
      let removed = 0
      const walk = (dir) => {
        for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
          const abs = path.join(dir, ent.name)
          if (ent.isDirectory()) {
            walk(abs)
            if (fs.readdirSync(abs).length === 0) fs.rmdirSync(abs)
            continue
          }
          const rel = path.relative(dist, abs)
          if (!isDeployExtra(rel)) continue
          fs.rmSync(abs)
          removed += 1
        }
      }
      walk(dist)
      console.log(`\nstrip-unused-public: убрано из dist файлов: ${removed}`)
    },
  }
}

/** VPS Beget — `/` | GitHub Pages preview — `VITE_BASE_PATH` */
export default defineConfig({
  plugins: [react(), tailwindcss(), stripUnusedPublic()],
  base: process.env.VITE_BASE_PATH || '/',
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (id.includes('three') || id.includes('@react-three')) return 'three'
          if (id.includes('gsap')) return 'gsap'
          if (id.includes('react-router')) return 'router'
          return undefined
        },
      },
    },
    chunkSizeWarningLimit: 900,
  },
})
