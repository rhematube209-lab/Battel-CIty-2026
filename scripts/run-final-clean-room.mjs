import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import crypto from 'node:crypto';

const srcDir = 'c:/Users/tamer/Documents/battel city 2026';
const dstDir = 'c:/Users/tamer/Documents/battel-city-2026-v110-final-clean-room';

console.log('=============================================================');
console.log('FINAL RELEASE CLEAN-ROOM PROMOTION — BATTLE CITY 2026 v1.1.0');
console.log('=============================================================\n');

console.log('1. Preparing fresh clean-room sibling directory:', dstDir);
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
      entry.name === 'scratch' ||
      entry.name === '.tempmediaStorage' ||
      entry.name === 'playwright-report' ||
      entry.name === 'test-results'
    ) {
      continue;
    }
    if (entry.name.endsWith('.png') || entry.name.endsWith('.webp') || entry.name.endsWith('.zip')) {
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

console.log('2. Copying clean repository tree (excluding node_modules, dist, temp media, zip artifacts)...');
copyRecursive(srcDir, dstDir);

console.log('3. Computing package-lock.json SHA-256 before npm ci...');
const lockBefore = fs.readFileSync(path.join(dstDir, 'package-lock.json'), 'utf8');
const hashBefore = crypto.createHash('sha256').update(lockBefore).digest('hex');
console.log('   SHA-256 (before npm ci):', hashBefore);

console.log('\n4. Running `npm ci` in fresh clean-room directory...');
const ciOut = execSync('npm ci', { cwd: dstDir, encoding: 'utf8' });
console.log('   npm ci output:\n' + ciOut.trim());

console.log('\n5. Verifying package-lock.json integrity after npm ci...');
const lockAfter = fs.readFileSync(path.join(dstDir, 'package-lock.json'), 'utf8');
const hashAfter = crypto.createHash('sha256').update(lockAfter).digest('hex');
console.log('   SHA-256 (after npm ci): ', hashAfter);
if (hashBefore !== hashAfter) {
  throw new Error('package-lock.json was modified during npm ci!');
}
console.log('   ✓ package-lock.json is 100% UNCHANGED');

console.log('\n6. Running `npm audit` in clean-room directory...');
const auditOut = execSync('npm audit', { cwd: dstDir, encoding: 'utf8' });
console.log('   npm audit output:\n' + auditOut.trim());

console.log('\n7. Verifying TypeScript compilation (`npx tsc --noEmit`) in clean-room directory...');
execSync('npx tsc --noEmit', { cwd: dstDir, encoding: 'utf8' });
console.log('   ✓ TypeScript compilation clean (exit code 0, 0 errors)');

console.log('\n8. Running full automated test suite (`node scripts/verify-test-summary.mjs`) in clean-room directory...');
const testOut = execSync('node scripts/verify-test-summary.mjs', { cwd: dstDir, encoding: 'utf8' });
console.log(testOut.trim());

console.log('\n9. Building production distribution (`npm run build`) in clean-room directory...');
const buildOut = execSync('npm run build', { cwd: dstDir, encoding: 'utf8' });
console.log(buildOut.trim());

console.log('\n=============================================================');
console.log('FINAL CLEAN-ROOM VERIFICATION & BUILD: COMPLETE & PASSING');
console.log('=============================================================\n');
