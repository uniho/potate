import esbuild from 'esbuild'

// Server-side specific files (Node.js)
await esbuild.build({
  entryPoints: [
    "./src/server/astro-render.js",
    "./src/server/astro-integration.js",
    "./src/server/vite-integration.js",
  ],
  outdir: 'dist',
  bundle: true,
  splitting: true,
  format: 'esm',
  platform: 'node',
  target: 'es2020',
  sourcemap: false,
  minify: true,
  external: ['potatejs', 'vite', 'lightningcss'],
  banner: {
    js: `import { createRequire } from 'module';const require = createRequire(import.meta.url);`,
  },
})

// Client-side / Shared files (Neutral)
await esbuild.build({
  entryPoints: [
    "./src/server/astro-client.js",
    "./src/server/renderToString.js",
  ],
  outdir: 'dist',
  bundle: true,
  splitting: true,
  format: 'esm',
  platform: 'neutral',
  target: 'es2020',
  sourcemap: false,
  minify: true,
  external: ['potatejs', 'vite', 'lightningcss'],
})

console.log('✅ build server complete')
