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
    { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 },
  );
}

function num(v) {
  if (v == null) return 0;
  if (typeof v === 'number') return v;
  if (typeof v === 'object') {
    if (v.$numberDouble != null) return Number(v.$numberDouble);
    if (v.$numberLong != null) return Number(v.$numberLong);
    if (v.$numberInt != null) return Number(v.$numberInt);
  }
  return Number(v);
}

const raw = run([
  {
    TableName: 'package_orders',
    CommandType: 'FIND',
    Command: JSON.stringify({ find: 'package_orders', limit: 40 }),
  },
]);
const rows = (((JSON.parse(raw).data || {}).results || [])[0]) || [];
rows
  .sort((a, b) => num(b.createdAt) - num(a.createdAt))
  .slice(0, 20)
  .forEach((r) => {
    console.log(
      [
        r._id,
        r.status,
        r.payMethod || r.channel,
        `fen=${num(r.payAmountFen)}`,
        `prin=${num(r.principalPaid)}`,
        `bonus=${num(r.bonusPaid)}`,
        r.refundFailReason || '-',
        r.packageName || '',
      ].join(' | '),
    );
  });
