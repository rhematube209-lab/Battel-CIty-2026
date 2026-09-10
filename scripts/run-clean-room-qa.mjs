import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import crypto from 'node:crypto';

const srcDir = 'c:/Users/tamer/Documents/battel city 2026';
const dstDir = 'c:/Users/tamer/Documents/battel-city-2026-clean-room';

console.log('1. Preparing clean-room directory:', dstDir);
if (fs.existsSync(dstDir)) {
  fs.rmSync(dstDir, { recursive: true, force: true });
}
fs.mkdirSync(dstDir, { recursive: true });

function copyRecursive(src, dst) {
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const dstPath = path.join(dst, entry.name);

    if (
      entry.name === 'node_modules' ||
      entry.name === 'dist' ||
      entry.name === '.git' ||
      entry.name === '.tempmediaStorage' ||
      entry.name === 'playwright-report' ||
      entry.name === 'test-results'
    ) {
      continue;
    }
    if (entry.name.endsWith('.png') || entry.name.endsWith('.webp')) {
      continue;
    }

    if (entry.isDirectory()) {
      fs.mkdirSync(dstPath, { recursive: true });
      copyRecursive(srcPath, dstPath);
    } else {
      fs.copyFileSync(srcPath, dstPath);
    }
  }
}

console.log('2. Copying clean repository tree (excluding node_modules, dist, temp media)...');
copyRecursive(srcDir, dstDir);

console.log('3. Computing initial package-lock.json sha256...');
const lockBefore = fs.readFileSync(path.join(dstDir, 'package-lock.json'), 'utf8');
const hashBefore = crypto.createHash('sha256').update(lockBefore).digest('hex');
console.log('   SHA256 (before):', hashBefore);

console.log('4. Running `npm ci` in clean-room directory...');
const ciOut = execSync('npm ci', { cwd: dstDir, encoding: 'utf8' });
console.log('   npm ci output:\n' + ciOut.trim());

console.log('\n5. Verifying package-lock.json integrity after npm ci...');
const lockAfter = fs.readFileSync(path.join(dstDir, 'package-lock.json'), 'utf8');
const hashAfter = crypto.createHash('sha256').update(lockAfter).digest('hex');
console.log('   SHA256 (after): ', hashAfter);
if (hashBefore !== hashAfter) {
  throw new Error('package-lock.json was modified during npm ci!');
}
console.log('   ✓ package-lock.json is 100% UNCHANGED');

console.log('\n6. Running `npm audit` in clean-room directory...');
const auditOut = execSync('npm audit', { cwd: dstDir, encoding: 'utf8' });
console.log('   npm audit output:\n' + auditOut.trim());

console.log('\n7. Verifying TypeScript compilation (`npx tsc --noEmit`) in clean-room directory...');
execSync('npx tsc --noEmit', { cwd: dstDir, encoding: 'utf8' });
console.log('   ✓ TypeScript compilation clean (exit 0)');

console.log('\n8. Running full automated test suite (`node scripts/verify-test-summary.mjs`) in clean-room directory...');
const testOut = execSync('node scripts/verify-test-summary.mjs', { cwd: dstDir, encoding: 'utf8' });
console.log(testOut.trim());

console.log('\n=============================================================');
console.log('CLEAN-ROOM VERIFICATION SUCCESSFUL');
console.log('=============================================================\n');
