import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import basicSsl from '@vitejs/plugin-basic-ssl'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages serves the repo under /<repo-name>/ — set BASE_PATH at build
  // time (see package.json "deploy" script) or default to root for local dev.
  base: process.env.BASE_PATH || '/',
  plugins: [
    react(),
    tailwindcss(),
    // Camera features (QR scan, purchase-bill OCR capture) need a secure
    // context. `npm run dev:https` sets HTTPS_DEV so you can open the dev
    // server's LAN address from a phone and actually test the camera —
    // plain `npm run dev` skips this (self-signed cert => browser warning).
    process.env.HTTPS_DEV === '1' && basicSsl(),
  ].filter(Boolean),
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
