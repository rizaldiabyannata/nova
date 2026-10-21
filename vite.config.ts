import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Port and watch settings follow the Tauri 2 Vite template so `tauri dev` can attach.
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
    watch: { ignored: ['**/src-tauri/**'] },
  },
});
