import fs from 'node:fs';
import path from 'node:path';

const distDir = 'dist';
const files = fs.readdirSync(distDir);
console.log('dist root files:', files);

const assetsDir = path.join(distDir, 'assets');
const assetFiles = fs.readdirSync(assetsDir);
console.log('dist/assets files:', assetFiles);

// Check for .map files
const mapFiles = assetFiles.filter(f => f.endsWith('.map'));
console.log('Any .map files:', mapFiles.length);

// Audit index.html and JS bundle
const indexHtml = fs.readFileSync(path.join(distDir, 'index.html'), 'utf-8');
const jsBundleName = assetFiles.find(f => f.startsWith('index-') && f.endsWith('.js'));
const bundleJs = fs.readFileSync(path.join(assetsDir, jsBundleName), 'utf-8');

const checks = [
  { name: 'No .map files in dist', pass: mapFiles.length === 0 },
  { name: 'No 127.0.0.1 hardcoded dev references', pass: !indexHtml.includes('127.0.0.1') && !bundleJs.includes('127.0.0.1') },
  { name: 'No http://localhost dev server references', pass: !indexHtml.includes('http://localhost') && !bundleJs.includes('http://localhost') },
  { name: 'applyDevStageBootstrap tree-shaken from bundle', pass: !bundleJs.includes('applyDevStageBootstrap') },
  { name: 'window.__GAME_INSTANCE__ production assignment tree-shaken', pass: !bundleJs.includes('__GAME_INSTANCE__') },
  { name: 'No 1.1.0-rc.1 strings in dist', pass: !indexHtml.includes('1.1.0-rc.1') && !bundleJs.includes('1.1.0-rc.1') },
  { name: 'No 1.1.0-dev strings in dist', pass: !indexHtml.includes('1.1.0-dev') && !bundleJs.includes('1.1.0-dev') },
  { name: 'No RC channel branding in bundle', pass: !bundleJs.includes('channel:"RC"') && !bundleJs.includes("channel:'RC'") },
  { name: 'No DEV channel branding in bundle', pass: !bundleJs.includes('channel:"DEV"') && !bundleJs.includes("channel:'DEV'") },
  { name: 'Contains version 1.1.0', pass: bundleJs.includes('1.1.0') },
  { name: 'Contains channel RELEASE', pass: bundleJs.includes('RELEASE') },
  { name: 'Root index.html present', pass: files.includes('index.html') },
  { name: 'Assets directory present', pass: files.includes('assets') },
];

let failed = false;
for (const c of checks) {
  if (c.pass) {
    console.log(`  [PASS] ${c.name}`);
  } else {
    console.error(`  [FAIL] ${c.name}`);
    failed = true;
  }
}

console.log('\n--- Build Info Verification ---');
console.log('JS Bundle Name:', jsBundleName);
console.log('JS Bundle Size:', fs.statSync(path.join(assetsDir, jsBundleName)).size, 'bytes');

if (failed) {
  throw new Error('Final dist audit failed!');
}
console.log('\n✓ FINAL DIST AUDIT PASSED 100%');
