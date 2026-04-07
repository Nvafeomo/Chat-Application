import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/** Dev + preview: browser uses same origin; proxy to Go/Node on 8080. */
const backendProxy = {
  '/api': {
    target: 'http://localhost:8080',
    changeOrigin: true,
  },
  '/ws': {
    target: 'http://localhost:8080',
    ws: true,
  },
} as const

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { ...backendProxy },
  },
  preview: {
    port: 4173,
    proxy: { ...backendProxy },
  },
})
