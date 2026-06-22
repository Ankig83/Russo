import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/** VPS Beget — сайт в корне домена */
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/',
})
