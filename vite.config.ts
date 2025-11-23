import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // IMPORTANT: This must match your GitHub repository name exactly
  // If your repo is https://github.com/Jakemathewsunil/Assignment_Duper
  // The base must be '/Assignment_Duper/'
  base: '/Assignment_Duper/',
  build: {
    outDir: 'dist',
  },
  define: {
    // Prevents 'process is not defined' error in browser when checking process.env.API_KEY
    'process.env': {}
  }
});