import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://bogota-al-dia-ten.vercel.app',
  output: 'static',
  build: {
    format: 'directory'
  }
});
