const path = require('path');
const { execFileSync } = require('child_process');
const { formatDateYmd } = require('../miniprogram/utils/coupons');

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
    TableName: 'user_coupons',
    CommandType: 'FIND',
    Command: JSON.stringify({ find: 'user_coupons', limit: 20 }),
  },
]);
const rows = JSON.parse(raw).data.results[0] || [];
for (const r of rows) {
  const vf = num(r.validFrom);
  const ea = num(r.expireAt);
  console.log(
    `${r._id}  ${formatDateYmd(vf)} ~ ${formatDateYmd(ea)}  status=${r.status}`,
  );
}
