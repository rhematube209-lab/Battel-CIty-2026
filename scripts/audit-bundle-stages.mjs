import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const bundleFiles = fs.readdirSync('dist/assets').filter(f => f.startsWith('index-') && f.endsWith('.js'));
if (bundleFiles.length === 0) throw new Error('No index JS bundle found');
const bundlePath = path.join('dist/assets', bundleFiles[0]);
const bundle = fs.readFileSync(bundlePath, 'utf8');

console.log('Inspecting production bundle:', bundlePath);

// Find occurrences of EnemyArchetypeId or enemy sequence arrays
// In TypeScript/Vite minified code, enum EnemyArchetypeId:
// STANDARD: 'standard', FAST: 'fast', ARMOR: 'armor'
const standardCount01 = (bundle.match(/displayName:\"CYBER OUTPOST\"/g) || []).length;
console.log('CYBER OUTPOST in bundle:', standardCount01 > 0);

// Let's find the section for CYBER OUTPOST / stage01
const s1Idx = bundle.indexOf('CYBER OUTPOST');
if (s1Idx !== -1) {
  const snippet = bundle.slice(Math.max(0, s1Idx - 500), s1Idx + 500);
  console.log('\n--- Stage 01 snippet around CYBER OUTPOST ---');
  console.log(snippet);
}

const s2Idx = bundle.indexOf('IRON DELTA');
if (s2Idx !== -1) {
  const snippet = bundle.slice(Math.max(0, s2Idx - 500), s2Idx + 500);
  console.log('\n--- Stage 02 snippet around IRON DELTA ---');
  console.log(snippet);
}
