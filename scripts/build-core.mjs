// scripts/build-core.mjs
import esbuild from 'esbuild';

const args = process.argv.slice(2);
const isDev = args.includes('--dev');

console.log(isDev ? '🚧 Building for Development...' : '🚀 Building for Production...');

await esbuild.build({
  entryPoints: ['./src/core/index.js'],
  bundle: true,
  outfile: './dist/index.js',
  format: 'esm',
  platform: 'browser',
  target: 'es2018',
  minify: !isDev,
  sourcemap: isDev,
}).catch(() => process.exit(1));

console.log('✅ Build success!');
