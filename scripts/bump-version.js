import fs from 'fs';
import path from 'path';

const pkgPath = path.resolve(process.cwd(), 'package.json');
const propPath = path.resolve(process.cwd(), 'android/app/version.properties');

try {
  // 1. Read package.json
  const pkgData = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  let currentVersion = pkgData.version || '1.0.2';
  if (currentVersion === '0.0.0') currentVersion = '1.0.2';

  // Increment patch version (e.g. 1.0.2 -> 1.0.3)
  const parts = currentVersion.split('.').map(Number);
  if (parts.length === 3 && !parts.some(isNaN)) {
    parts[2] += 1;
    pkgData.version = parts.join('.');
  } else {
    pkgData.version = '1.0.3';
  }

  fs.writeFileSync(pkgPath, JSON.stringify(pkgData, null, 2) + '\n');

  // 2. Read and bump android/app/version.properties
  let versionCode = 3;
  if (fs.existsSync(propPath)) {
    const content = fs.readFileSync(propPath, 'utf8');
    const match = content.match(/VERSION_CODE=(\d+)/);
    if (match && match[1]) {
      versionCode = parseInt(match[1], 10) + 1;
    }
  }

  const today = new Date().toISOString().split('T')[0];
  const newPropContent = `VERSION_CODE=${versionCode}
VERSION_NAME=${pkgData.version}
BUILD_NUMBER=${versionCode}
APPLICATION_ID=com.fixocar.workshop
LAST_UPDATED=${today}
`;

  fs.writeFileSync(propPath, newPropContent);

  console.log(`\n======================================================`);
  console.log(`🚀 APP VERSION BUMP SUCCESSFUL!`);
  console.log(`   New Version Name: ${pkgData.version}`);
  console.log(`   New Version Code: ${versionCode}`);
  console.log(`   Updated Files: package.json, android/app/version.properties`);
  console.log(`======================================================\n`);
} catch (err) {
  console.error('❌ Version bump error:', err);
  process.exit(1);
}
