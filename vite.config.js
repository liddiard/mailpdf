import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// API routes that should be proxied to the Express server during development.
const API_ROUTES = ['/upload', '/verify_address', '/checkout', '/finalize', '/track', '/uploads']

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: Object.fromEntries(
      API_ROUTES.map(route => [route, 'http://localhost:3000'])
    )
  },
  build: {
    outDir: 'dist'
  }
})
