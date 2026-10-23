/**
 * Patch store.main.routeTip (remove WeChat contact wording).
 * Usage: node scripts/patch-store-route-tip.js
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
const ROUTE_TIP = '地址在 A幢 2617；电梯到顶楼就到，找不到直接打电话。';

function run(command) {
  return execFileSync(
    process.execPath,
    [TCB_JS, 'db', 'nosql', 'execute', '-e', ENV, '--command', JSON.stringify(command), '--json'],
    { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 },
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
            u: { $set: { routeTip: ROUTE_TIP } },
            multi: false,
          },
        ],
      }),
    },
  ]).trim(),
);

const raw = run([
  {
    TableName: 'store',
    CommandType: 'FIND',
    Command: JSON.stringify({ find: 'store', filter: { _id: 'main' }, limit: 1 }),
  },
]);
const rows = (((JSON.parse(raw).data || {}).results || [])[0]) || [];
console.log('routeTip=', rows[0] && rows[0].routeTip);
