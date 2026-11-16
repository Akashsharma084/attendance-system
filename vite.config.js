import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

function updateServiceWorkerVersionPlugin() {
  return {
    name: 'update-sw-version',
    closeBundle() {
      const distSwPath = path.resolve(__dirname, 'dist/sw.js')
      if (fs.existsSync(distSwPath)) {
        let content = fs.readFileSync(distSwPath, 'utf8')
        const buildTimestamp = Date.now()
        content = content.replace(
          /const CACHE_NAME = ['"][^'"]+['"]/,
          `const CACHE_NAME = 'swl-attendance-build-${buildTimestamp}'`
        )
        content = `// SWL Auto-Build Timestamp: ${new Date().toISOString()}\n` + content
        fs.writeFileSync(distSwPath, content, 'utf8')
        console.log(`[Vite SW Plugin] Updated dist/sw.js with CACHE_NAME: swl-attendance-build-${buildTimestamp}`)
      }
    }
  }
}

export default defineConfig({
  plugins: [react(), updateServiceWorkerVersionPlugin()],
  server: {
    host: true // lets you open the dev server on your phone over LAN to test camera/GPS
  }
})
