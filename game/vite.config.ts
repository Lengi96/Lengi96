import { defineConfig } from 'vite';

// Relative base so the build also works when served from a repo subpath
// such as https://<user>.github.io/<repo>/.
export default defineConfig({
  base: './',
  build: { target: 'es2022', outDir: 'dist' },
});
