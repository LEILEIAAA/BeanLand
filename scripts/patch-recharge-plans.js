/**
 * Sync recharge_plans from cloudbase-seed-export/recharge_plans.json
 * Usage: node scripts/patch-recharge-plans.js
 */
const fs = require('fs');
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
const seedPath = path.join(__dirname, 'cloudbase-seed-export', 'recharge_plans.json');

function run(command) {
  return execFileSync(
    process.execPath,
    [TCB_JS, 'db', 'nosql', 'execute', '-e', ENV, '--command', JSON.stringify(command), '--json'],
    { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], maxBuffer: 20 * 1024 * 1024 },
  );
}

function deleteById(id) {
  try {
    run([
      {
        TableName: 'recharge_plans',
        CommandType: 'DELETE',
        Command: JSON.stringify({
          delete: 'recharge_plans',
          deletes: [{ q: { _id: id }, limit: 1 }],
        }),
      },
    ]);
    console.log(`deleted recharge_plans/${id}`);
  } catch (error) {
    console.warn(`delete warn recharge_plans/${id}`);
  }
}

function insert(doc) {
  const payload = { _id: doc.id, ...doc };
  console.log(`insert recharge_plans/${payload._id}`);
  console.log(
    run([
      {
        TableName: 'recharge_plans',
        CommandType: 'INSERT',
        Command: JSON.stringify({
          insert: 'recharge_plans',
          documents: [payload],
        }),
      },
    ]).trim() || 'ok',
  );
}

const plans = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
if (!Array.isArray(plans) || !plans.length) {
  console.error('recharge_plans.json empty');
  process.exit(1);
}

for (const plan of plans) {
  deleteById(plan.id);
  insert(plan);
}

console.log(
  'verify recharge_plans',
  run([
    {
      TableName: 'recharge_plans',
      CommandType: 'FIND',
      Command: JSON.stringify({ find: 'recharge_plans', limit: 20 }),
    },
  ]).trim(),
);
console.log('patch-recharge-plans done');
