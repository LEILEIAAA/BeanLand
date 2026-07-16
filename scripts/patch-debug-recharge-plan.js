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
    { encoding: 'utf8' },
  );
}

const doc = {
  _id: 'r100',
  id: 'r100',
  rechargeAmount: 0.02,
  bonusAmount: 0.01,
  arrivalAmount: 0.03,
  audience: '调试档：本金+赠金（上线前改回）',
};

run([
  {
    TableName: 'recharge_plans',
    CommandType: 'DELETE',
    Command: JSON.stringify({
      delete: 'recharge_plans',
      deletes: [{ q: { _id: 'r100' }, limit: 1 }],
    }),
  },
]);

run([
  {
    TableName: 'recharge_plans',
    CommandType: 'INSERT',
    Command: JSON.stringify({
      insert: 'recharge_plans',
      documents: [doc],
    }),
  },
]);

console.log(
  run([
    {
      TableName: 'recharge_plans',
      CommandType: 'FIND',
      Command: JSON.stringify({
        find: 'recharge_plans',
        filter: { _id: 'r100' },
        limit: 1,
      }),
    },
  ]).trim(),
);
