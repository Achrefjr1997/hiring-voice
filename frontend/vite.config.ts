import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [tailwindcss()],
  server: {
    proxy: { '/session': 'http://localhost:8000', '/audio': 'http://localhost:8000', '/auth': 'http://localhost:8000', '/ws': { target: 'ws://localhost:8000', ws: true } },
  },
})
