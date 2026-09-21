import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  resolve: {
    alias: [
      {
        find: /^vue-stable$/,
        replacement: 'vue-stable/dist/vue.esm-bundler.js',
      },
    ],
  },
  server: { port: 4173, strictPort: true },
});
