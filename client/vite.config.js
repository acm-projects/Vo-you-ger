import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { fileURLToPath } from 'node:url'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
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
