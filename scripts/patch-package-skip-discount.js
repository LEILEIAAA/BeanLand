/**
 * 修复历史套餐数据：把除 opening-trio 外所有套餐的 skipOpeningDiscount 刷为 false，
 * 让它们参与全局开业折扣。opening-trio 保留 true（设计上不叠加）。
 * Usage: node scripts/patch-package-skip-discount.js
 */
const path = require('path');
const { execFileSync } = require('child_process');

const TCB_JS = path.join(
  process.env.APPDATA || '',
  'npm',
  'node_modules',
  '@cloudbase',
  'cli',
  'bin',
  'tcb',
);
const ENV = 'cloudbase-d8gzrj9d3f09c5171';

function run(command) {
  return execFileSync(
    process.execPath,
    [TCB_JS, 'db', 'nosql', 'execute', '-e', ENV, '--command', JSON.stringify(command), '--json'],
    { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], maxBuffer: 20 * 1024 * 1024 },
  );
}

console.log('before:');
console.log(
  run([
    {
      TableName: 'packages',
      CommandType: 'FIND',
      Command: JSON.stringify({ find: 'packages', limit: 50 }),
    },
  ]).trim(),
);

console.log('update result:');
console.log(
  run([
    {
      TableName: 'packages',
      CommandType: 'UPDATE',
      Command: JSON.stringify({
        update: 'packages',
        updates: [
          {
            q: { id: { $ne: 'opening-trio' }, skipOpeningDiscount: true },
            u: { $set: { skipOpeningDiscount: false } },
            multi: true,
          },
        ],
      }),
    },
  ]).trim(),
);

console.log('after:');
console.log(
  run([
    {
      TableName: 'packages',
      CommandType: 'FIND',
      Command: JSON.stringify({ find: 'packages', limit: 50 }),
    },
  ]).trim(),
);
