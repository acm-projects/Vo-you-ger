import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { fileURLToPath } from 'node:url'
import { cpSync } from 'node:fs'
import { resolve } from 'node:path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), {
    name: 'journal-static-page',
    // The journal from main uses plain HTML/JS with relative image paths.
    // Preserve that page and its assets together in the production output.
    writeBundle(options) {
      cpSync(fileURLToPath(new URL('./ItineraryFinal', import.meta.url)),
        resolve(options.dir, 'ItineraryFinal'), { recursive: true })
    },
  }],
  build: {
    rolldownOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        itinerary: fileURLToPath(new URL('./ItineraryNew/itenNew.html', import.meta.url)),
        signup: fileURLToPath(new URL('./signUpAndLogin/signup.html', import.meta.url)),
        login: fileURLToPath(new URL('./signUpAndLogin/login.html', import.meta.url)),
        assessment: fileURLToPath(new URL('./Assessments/assessments.html', import.meta.url)),
      },
    },
  },
})
