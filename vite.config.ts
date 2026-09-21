import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';
import { animaTailwind } from './src/plugins/vite-tailwind.ts';

export default defineConfig({
  plugins: [
    animaTailwind({ css: 'tests/fixtures/colors.css' }),
    vue(),
    tailwindcss(),
  ],
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
