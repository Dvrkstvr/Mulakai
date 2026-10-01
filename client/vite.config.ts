import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Overridable so a second copy of the stack (the e2e run, a worktree check) can sit beside a running one.
const apiTarget = process.env.MULAKAI_API_URL ?? 'http://127.0.0.1:3001'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: process.env.PORT ? Number(process.env.PORT) : 5173,
    proxy: {
      '/api': apiTarget,
      '/audio': apiTarget,
    },
  },
})
