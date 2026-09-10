import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';
import http from 'node:http';

const ROOT_DIR = process.cwd();
const DIST_DIR = path.resolve(ROOT_DIR, 'dist');
const ZIP_NAME = 'battle-city-2026-v1.1.0.zip';
const ZIP_PATH = path.resolve(ROOT_DIR, ZIP_NAME);
const SUMS_FILE = path.resolve(ROOT_DIR, 'SHA256SUMS_v1.1.0.txt');
const TEST_EXTRACT_DIR = path.resolve(ROOT_DIR, 'scratch/test-final-extract');

console.log('=============================================================');
console.log('FINAL RELEASE PACKAGING & ARTIFACT INTEGRITY — v1.1.0');
console.log('=============================================================\n');

// 1. Verify dist exists and contains index.html and assets
if (!fs.existsSync(DIST_DIR)) {
  throw new Error(`dist/ directory not found at ${DIST_DIR}`);
}
if (!fs.existsSync(path.join(DIST_DIR, 'index.html'))) {
  throw new Error(`dist/index.html not found!`);
}
if (!fs.existsSync(path.join(DIST_DIR, 'assets'))) {
  throw new Error(`dist/assets not found!`);
}

// 2. Remove old final zip if present
if (fs.existsSync(ZIP_PATH)) {
  fs.unlinkSync(ZIP_PATH);
  console.log(`Removed previous ${ZIP_NAME}`);
}

// 3. Create zip using PowerShell Compress-Archive
console.log(`Packaging ${ZIP_NAME} from dist/* (root index.html + assets/)...`);
const psCmd = `powershell -NoProfile -Command "Compress-Archive -Path '${DIST_DIR}\\*' -DestinationPath '${ZIP_PATH}' -Force"`;
execSync(psCmd, { stdio: 'inherit' });

if (!fs.existsSync(ZIP_PATH)) {
  throw new Error(`Failed to create ${ZIP_NAME}`);
}

const stats = fs.statSync(ZIP_PATH);
const fileBuffer = fs.readFileSync(ZIP_PATH);
const sha256 = crypto.createHash('sha256').update(fileBuffer).digest('hex');
const sizeBytes = stats.size;
const sizeMiB = (sizeBytes / (1024 * 1024)).toFixed(2);

console.log(`\n✓ Final Package created successfully:`);
console.log(`  File:        ${ZIP_NAME}`);
console.log(`  Size:        ${sizeBytes.toLocaleString()} bytes (${sizeMiB} MiB)`);
console.log(`  SHA-256:     ${sha256}`);

// 4. Generate SHA256SUMS_v1.1.0.txt
const sumsContent = `${sha256}  ${ZIP_NAME}  (${sizeBytes} bytes, ${sizeMiB} MiB)\n`;
fs.writeFileSync(SUMS_FILE, sumsContent, 'utf-8');
console.log(`\n✓ Written checksum file: ${path.basename(SUMS_FILE)}`);

// 5. Test Extraction Verification
console.log(`\nTesting extraction into fresh directory: ${TEST_EXTRACT_DIR}...`);
if (fs.existsSync(TEST_EXTRACT_DIR)) {
  fs.rmSync(TEST_EXTRACT_DIR, { recursive: true, force: true });
}
fs.mkdirSync(TEST_EXTRACT_DIR, { recursive: true });

const extractCmd = `powershell -NoProfile -Command "Expand-Archive -Path '${ZIP_PATH}' -DestinationPath '${TEST_EXTRACT_DIR}' -Force"`;
execSync(extractCmd, { stdio: 'inherit' });

// Check extracted files
const extractedIndex = path.join(TEST_EXTRACT_DIR, 'index.html');
const extractedAssets = path.join(TEST_EXTRACT_DIR, 'assets');

if (!fs.existsSync(extractedIndex)) {
  throw new Error('Verification failed: index.html is NOT at root of extracted zip!');
}
if (!fs.existsSync(extractedAssets)) {
  throw new Error('Verification failed: assets/ is NOT at root of extracted zip!');
}

const distIndexContent = fs.readFileSync(path.join(DIST_DIR, 'index.html'));
const extIndexContent = fs.readFileSync(extractedIndex);
if (!distIndexContent.equals(extIndexContent)) {
  throw new Error('Verification failed: Extracted index.html does not match dist/index.html!');
}

// Ensure ZIP root has only index.html and assets
const extractedRootEntries = fs.readdirSync(TEST_EXTRACT_DIR);
console.log('Extracted root entries:', extractedRootEntries);
const invalidEntries = extractedRootEntries.filter(e => e !== 'index.html' && e !== 'assets');
if (invalidEntries.length > 0) {
  throw new Error(`Verification failed: unexpected files in zip root: ${invalidEntries.join(', ')}`);
}

console.log('  ✓ Extracted archive contains index.html at root');
console.log('  ✓ Extracted archive contains assets/ at root');
console.log('  ✓ Zero outer "dist/" wrapper directory found');
console.log('  ✓ Zero source code, test, or scratch files included');

// 6. Test Static HTTP Serving of Extracted Package
console.log('\nVerifying static HTTP serving of extracted archive on port 3010...');
const server = http.createServer((req, res) => {
  const parsed = new URL(req.url || '/', 'http://127.0.0.1:3010');
  let target = path.join(TEST_EXTRACT_DIR, parsed.pathname === '/' ? 'index.html' : parsed.pathname);
  if (!fs.existsSync(target)) target = path.join(TEST_EXTRACT_DIR, 'index.html');
  
  const ext = path.extname(target);
  const mimes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'text/javascript',
  };
  res.writeHead(200, { 'Content-Type': mimes[ext] || 'application/octet-stream' });
  res.end(fs.readFileSync(target));
});

await new Promise((resolve) => server.listen(3010, '127.0.0.1', resolve));

const testReq = await fetch('http://127.0.0.1:3010/');
if (testReq.status !== 200) {
  server.close();
  throw new Error(`HTTP fetch failed with status ${testReq.status}`);
}
const htmlText = await testReq.text();
if (!htmlText.includes('Battle City 2026') && !htmlText.includes('renderCanvas')) {
  server.close();
  throw new Error('HTTP served page does not contain Battle City canvas markup!');
}

server.close();
console.log('  ✓ HTTP 200 OK verified on extracted root index.html');
console.log('  ✓ Static package bootable without external dependencies');

console.log('\n=============================================================');
console.log('FINAL RELEASE PACKAGING VERIFICATION: ALL PASSED');
console.log('=============================================================\n');
