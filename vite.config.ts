import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  base: '/PaginaPortafolio/',
  plugins: [react(), tailwindcss()],
})
