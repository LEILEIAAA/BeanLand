/**
 * Sync store.packagePromo tip with current discountRate.
 * Usage: node scripts/patch-package-promo-tip.js
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

console.log(
  'update',
  run([
    {
      TableName: 'store',
      CommandType: 'UPDATE',
      Command: JSON.stringify({
        update: 'store',
        updates: [
          {
            q: { _id: 'main' },
            u: {
              $set: {
                'packagePromo.active': true,
                'packagePromo.discountRate': 9,
                'packagePromo.tip': '全场9折',
                'packagePromo.label': '开业七天',
              },
            },
            multi: false,
          },
        ],
      }),
    },
  ]).trim(),
);

console.log(
  'verify',
  run([
    {
      TableName: 'store',
      CommandType: 'FIND',
      Command: JSON.stringify({ find: 'store', limit: 1 }),
    },
  ]).trim(),
);
