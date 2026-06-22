import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss()],
  // GitHub Pages: /Russo/  |  Cloudflare / локально: /
  base: process.env.GITHUB_ACTIONS === 'true' ? '/Russo/' : '/',
}))
