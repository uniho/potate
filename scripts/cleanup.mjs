import fs from 'fs';

setupOutdir('public', 'dist')

function setupOutdir(publicDir, outdir) {
  // Clean up & Recreate dist
  if (fs.existsSync(outdir)) {
    fs.rmSync(outdir, { recursive: true, force: true });
  }
  fs.mkdirSync(outdir, { recursive: true });

  // Copy all files from public to dist
  if (fs.existsSync(publicDir)) {
    fs.cpSync(publicDir, outdir, { recursive: true });
  }
}

console.log('✅ cleanup complete')
