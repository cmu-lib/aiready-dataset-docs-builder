import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  base: '/aiready-dataset-docs-builder/',
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'node',
  },
});
