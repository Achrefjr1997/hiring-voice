import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [tailwindcss()],
  server: {
    proxy: { '/sessions': 'http://localhost:8000', '/session': 'http://localhost:8000', '/candidates': 'http://localhost:8000', '/candidate': 'http://localhost:8000', '/jobs': 'http://localhost:8000', '/stats': 'http://localhost:8000', '/audio': 'http://localhost:8000', '/auth': 'http://localhost:8000', '/ws': { target: 'ws://localhost:8000', ws: true } },
  },
})
