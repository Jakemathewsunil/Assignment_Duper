import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // This matches your GitHub repository name
  base: '/Assignment_Duper/',
  build: {
    outDir: 'dist',
  },
  // Polyfill process.env so the app doesn't crash when checking for API keys
  define: {
    'process.env': {}
  }
});