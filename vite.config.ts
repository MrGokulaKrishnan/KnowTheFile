import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    sourcemap: false,
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('pdfjs-dist')) {
              return 'pdfjs'
            }
            if (id.includes('pdf-lib') || id.includes('@pdfsmaller')) {
              return 'pdf-lib'
            }
            if (id.includes('docx') || id.includes('mammoth') || id.includes('jszip')) {
              return 'document-converters'
            }
            if (id.includes('firebase')) {
              return 'firebase'
            }
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom')) {
              return 'vendor'
            }
          }
        },
      },
    },
  },
  server: { host: '127.0.0.1', port: 5173 },
})
