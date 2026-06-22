import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss(), cloudflare()],
  // GitHub Pages: /Russo/  |  Cloudflare / локально: /
  base: process.env.GITHUB_ACTIONS === 'true' ? '/Russo/' : '/',
}))