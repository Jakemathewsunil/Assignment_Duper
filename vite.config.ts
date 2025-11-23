import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // This MUST match your GitHub repository name for the site to load correctly
  base: '/Assignment_Duper/',
  build: {
    outDir: 'dist',
  }
});